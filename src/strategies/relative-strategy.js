/**
 * 相对定位策略
 * 基于元素的层级关系生成XPath
 */
class RelativeStrategy extends BaseStrategy {
  constructor() {
    super('relative', 60);
  }

  isApplicable(element, context) {
    return element.parentElement !== null;
  }

  generate(element, context) {
    const paths = [];
    
    // 尝试不同的相对定位方式
    paths.push(...this.generateParentBasedPaths(element));
    paths.push(...this.generateSiblingBasedPaths(element));
    paths.push(...this.generateIndexBasedPaths(element));
    
    // 测试每个路径
    for (const xpath of paths) {
      if (this.validateXPath(xpath, element)) {
        return xpath;
      }
    }
    
    return null;
  }

  generateParentBasedPaths(element) {
    const paths = [];
    const tagName = element.tagName.toLowerCase();
    let current = element.parentElement;
    
    while (current && current !== document.body) {
      const parentTag = current.tagName.toLowerCase();
      
      // 基于父元素的ID（使用过滤后的ID）
      if (current.id && Utils.isValidId(current.id)) {
        paths.push(`//*[@id=${Utils.escapeXPath(current.id)}]//${tagName}`);
        paths.push(`//*[@id=${Utils.escapeXPath(current.id)}]/${tagName}`);
      }
      
      // 基于父元素的class（使用过滤后的类名）
      if (current.className && typeof current.className === 'string') {
        const filteredClasses = Utils.getFilteredClasses(current.className);
        for (const cls of filteredClasses.slice(0, 2)) {
          paths.push(`//${parentTag}[@class=${Utils.escapeXPath(cls)}]//${tagName}`);
          paths.push(`//${parentTag}[contains(@class, ${Utils.escapeXPath(cls)})]/${tagName}`);
        }
      }
      
      // 基于父元素的其他属性
      const parentAttrs = this.getUniqueAttributes(current);
      for (const attr of parentAttrs.slice(0, 2)) {
        paths.push(`//${parentTag}[@${attr.name}=${Utils.escapeXPath(attr.value)}]//${tagName}`);
      }
      
      current = current.parentElement;
    }
    
    return paths;
  }

  generateSiblingBasedPaths(element) {
    const paths = [];
    const tagName = element.tagName.toLowerCase();
    
    // 查找有唯一标识的兄弟元素
    if (element.parentElement) {
      const siblings = Array.from(element.parentElement.children);
      
      for (const sibling of siblings) {
        if (sibling === element) continue;
        
        const siblingTag = sibling.tagName.toLowerCase();
        
        // 基于兄弟元素的ID
        if (sibling.id) {
          const siblingIndex = siblings.indexOf(sibling) + 1;
          const elementIndex = siblings.indexOf(element) + 1;
          
          if (elementIndex > siblingIndex) {
            paths.push(`//*[@id=${Utils.escapeXPath(sibling.id)}]/following-sibling::${tagName}`);
          } else {
            paths.push(`//*[@id=${Utils.escapeXPath(sibling.id)}]/preceding-sibling::${tagName}`);
          }
        }
        
        // 基于兄弟元素的文本
        const siblingText = Utils.getVisibleText(sibling);
        if (siblingText && siblingText.length <= 30) {
          const escapedText = Utils.escapeXPath(siblingText);
          paths.push(`//${siblingTag}[text()=${escapedText}]/following-sibling::${tagName}`);
          paths.push(`//${siblingTag}[text()=${escapedText}]/preceding-sibling::${tagName}`);
        }
      }
    }
    
    return paths;
  }

  generateIndexBasedPaths(element) {
    const paths = [];
    const tagName = element.tagName.toLowerCase();
    
    if (!element.parentElement) return paths;
    
    // 在所有子元素中的位置
    const allSiblings = Array.from(element.parentElement.children);
    const allIndex = allSiblings.indexOf(element) + 1;
    
    // 在同标签兄弟元素中的位置
    const sameTags = allSiblings.filter(el => el.tagName === element.tagName);
    const sameTagIndex = sameTags.indexOf(element) + 1;
    
    // 生成基于父元素的索引路径
    const parentPath = this.getParentPath(element.parentElement);
    
    if (parentPath) {
      paths.push(`${parentPath}/*[${allIndex}]`);
      if (sameTags.length > 1) {
        paths.push(`${parentPath}/${tagName}[${sameTagIndex}]`);
      }
    }
    
    // 简单的索引路径
    if (sameTags.length > 1) {
      paths.push(`//${tagName}[${sameTagIndex}]`);
    }
    
    return paths;
  }

  getParentPath(parent) {
    if (!parent || parent === document.body) return null;
    
    const tagName = parent.tagName.toLowerCase();
    
    // 优先使用有效的ID
    if (parent.id && Utils.isValidId(parent.id)) {
      return `//*[@id=${Utils.escapeXPath(parent.id)}]`;
    }
    
    // 使用过滤后的类名
    if (parent.className && typeof parent.className === 'string') {
      const filteredClasses = Utils.getFilteredClasses(parent.className);
      for (const cls of filteredClasses) {
        const xpath = `//${tagName}[@class=${Utils.escapeXPath(cls)}]`;
        try {
          const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          if (result.snapshotLength === 1) {
            return xpath;
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    return null;
  }

  getUniqueAttributes(element) {
    const attributes = [];
    const skipAttrs = ['style', 'class'];
    
    for (const attr of element.attributes) {
      if (skipAttrs.includes(attr.name) || !attr.value) continue;
      
      // 检查属性值是否唯一
      const xpath = `//*[@${attr.name}=${Utils.escapeXPath(attr.value)}]`;
      try {
        const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        if (result.snapshotLength === 1) {
          attributes.push({ name: attr.name, value: attr.value });
        }
      } catch (e) {
        continue;
      }
    }
    
    return attributes;
  }

  getScore(element, context) {
    let score = this.priority;
    
    // 如果父元素有ID，分数较高
    let current = element.parentElement;
    while (current && current !== document.body) {
      if (current.id) {
        score += 20;
        break;
      }
      current = current.parentElement;
    }
    
    // 层级越浅，分数越高
    const depth = this.getElementDepth(element);
    score += Math.max(0, 20 - depth);
    
    return score;
  }

  getElementDepth(element) {
    let depth = 0;
    let current = element;
    while (current && current !== document.body) {
      depth++;
      current = current.parentElement;
    }
    return depth;
  }
}