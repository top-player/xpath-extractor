/**
 * 相邻元素锚定策略
 * 通过相邻的唯一元素来定位目标元素
 */
class AnchorStrategy extends BaseStrategy {
  constructor() {
    super('anchor', 95); // 第二优先级
  }

  isApplicable(element, context) {
    return this.findAnchorElements(element).length > 0;
  }

  generate(element, context) {
    const anchors = this.findAnchorElements(element);
    const tagName = element.tagName.toLowerCase();
    
    for (const anchor of anchors) {
      const anchorXPath = this.getAnchorXPath(anchor.element);
      if (anchorXPath) {
        const strategies = this.generateAnchorBasedPaths(anchorXPath, anchor.relationship, tagName, element);
        
        for (const xpath of strategies) {
          if (this.validateXPath(xpath, element)) {
            return xpath;
          }
        }
      }
    }
    
    return null;
  }

  /**
   * 查找锚点元素
   * @param {Element} element - 目标元素
   * @returns {Array<Object>} 锚点元素列表
   */
  findAnchorElements(element) {
    const anchors = [];
    
    // 查找兄弟元素锚点
    anchors.push(...this.findSiblingAnchors(element));
    
    // 查找父级元素锚点
    anchors.push(...this.findParentAnchors(element));
    
    // 查找子元素锚点
    anchors.push(...this.findChildAnchors(element));
    
    return anchors.sort((a, b) => b.score - a.score);
  }

  /**
   * 查找兄弟元素锚点
   * @param {Element} element - 目标元素
   * @returns {Array<Object>} 兄弟锚点列表
   */
  findSiblingAnchors(element) {
    const anchors = [];
    
    if (!element.parentElement) return anchors;
    
    const siblings = Array.from(element.parentElement.children);
    const elementIndex = siblings.indexOf(element);
    
    for (let i = 0; i < siblings.length; i++) {
      const sibling = siblings[i];
      if (sibling === element) continue;
      
      const uniqueness = this.evaluateElementUniqueness(sibling);
      if (uniqueness.score > 0) {
        anchors.push({
          element: sibling,
          relationship: i < elementIndex ? 'preceding-sibling' : 'following-sibling',
          distance: Math.abs(i - elementIndex),
          score: uniqueness.score,
          type: 'sibling'
        });
      }
    }
    
    return anchors;
  }

  /**
   * 查找父级元素锚点
   * @param {Element} element - 目标元素
   * @returns {Array<Object>} 父级锚点列表
   */
  findParentAnchors(element) {
    const anchors = [];
    let current = element.parentElement;
    let level = 1;
    
    while (current && current !== document.body && level <= 3) {
      const uniqueness = this.evaluateElementUniqueness(current);
      if (uniqueness.score > 0) {
        anchors.push({
          element: current,
          relationship: 'ancestor',
          distance: level,
          score: uniqueness.score - (level * 5), // 距离越远分数越低
          type: 'parent'
        });
      }
      current = current.parentElement;
      level++;
    }
    
    return anchors;
  }

  /**
   * 查找子元素锚点
   * @param {Element} element - 目标元素
   * @returns {Array<Object>} 子元素锚点列表
   */
  findChildAnchors(element) {
    const anchors = [];
    const children = Array.from(element.children);
    
    for (const child of children) {
      const uniqueness = this.evaluateElementUniqueness(child);
      if (uniqueness.score > 0) {
        anchors.push({
          element: child,
          relationship: 'descendant',
          distance: 1,
          score: uniqueness.score - 10, // 子元素分数较低
          type: 'child'
        });
      }
    }
    
    return anchors;
  }

  /**
   * 过滤随机类名
   * @param {Array<string>} classes - 类名数组
   * @returns {Array<string>} 过滤后的类名数组
   */
  getFilteredClasses(classes) {
    return Utils.getFilteredClasses(classes);
  }

  /**
   * 评估元素的唯一性
   * @param {Element} element - 元素
   * @returns {Object} 唯一性评估结果
   */
  evaluateElementUniqueness(element) {
    let score = 0;
    const reasons = [];
    
    // ID属性 - 需要验证ID是否有效
    const validId = Utils.getValidId(element.id);
    if (validId) {
      const xpath = `//*[@id=${Utils.escapeXPath(validId)}]`;
      if (this.isUniqueXPath(xpath)) {
        score += 50;
        reasons.push('unique-id');
      }
    }
    
    // 唯一文本
    const text = Utils.getVisibleText(element);
    if (text && text.length > 0 && text.length <= 30) {
      const xpath = `//*[text()=${Utils.escapeXPath(text)}]`;
      if (this.isUniqueXPath(xpath)) {
        score += 40;
        reasons.push('unique-text');
      }
    }
    
    // 唯一属性组合
    for (const attr of element.attributes) {
      if (['style', 'class'].includes(attr.name)) continue;
      const xpath = `//*[@${attr.name}=${Utils.escapeXPath(attr.value)}]`;
      if (this.isUniqueXPath(xpath)) {
        score += 30;
        reasons.push(`unique-${attr.name}`);
        break; // 只需要一个唯一属性
      }
    }
    
    // 唯一class（过滤随机类名）
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.split(/\s+/).filter(cls => cls);
      const filteredClasses = this.getFilteredClasses(classes);
      
      for (const cls of filteredClasses) {
        const xpath = `//*[contains(@class, ${Utils.escapeXPath(cls)})]`;
        if (this.isUniqueXPath(xpath)) {
          score += 25;
          reasons.push('unique-class');
          break;
        }
      }
    }
    
    return { score, reasons };
  }

  /**
   * 检查XPath是否唯一
   * @param {string} xpath - XPath表达式
   * @returns {boolean} 是否唯一
   */
  isUniqueXPath(xpath) {
    try {
      const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      return result.snapshotLength === 1;
    } catch (e) {
      return false;
    }
  }

  /**
   * 获取锚点元素的XPath
   * @param {Element} anchor - 锚点元素
   * @returns {string|null} 锚点XPath
   */
  getAnchorXPath(anchor) {
    const tagName = anchor.tagName.toLowerCase();
    
    // 优先使用有效的ID
    const validId = Utils.getValidId(anchor.id);
    if (validId) {
      return `//*[@id=${Utils.escapeXPath(validId)}]`;
    }
    
    // 使用唯一文本
    const text = Utils.getVisibleText(anchor);
    if (text && text.length > 0 && text.length <= 30) {
      const xpath = `//${tagName}[text()=${Utils.escapeXPath(text)}]`;
      if (this.isUniqueXPath(xpath)) {
        return xpath;
      }
    }
    
    // 使用唯一属性
    for (const attr of anchor.attributes) {
      if (['style', 'class'].includes(attr.name)) continue;
      const xpath = `//${tagName}[@${attr.name}=${Utils.escapeXPath(attr.value)}]`;
      if (this.isUniqueXPath(xpath)) {
        return xpath;
      }
    }
    
    return null;
  }

  /**
   * 生成基于锚点的路径
   * @param {string} anchorXPath - 锚点XPath
   * @param {string} relationship - 关系类型
   * @param {string} tagName - 目标元素标签名
   * @param {Element} element - 目标元素
   * @returns {Array<string>} 路径列表
   */
  generateAnchorBasedPaths(anchorXPath, relationship, tagName, element) {
    const paths = [];
    
    switch (relationship) {
      case 'preceding-sibling':
        paths.push(`${anchorXPath}/following-sibling::${tagName}`);
        paths.push(`${anchorXPath}/following-sibling::*[self::${tagName}]`);
        break;
        
      case 'following-sibling':
        paths.push(`${anchorXPath}/preceding-sibling::${tagName}`);
        paths.push(`${anchorXPath}/preceding-sibling::*[self::${tagName}]`);
        break;
        
      case 'ancestor':
        paths.push(`${anchorXPath}//${tagName}`);
        paths.push(`${anchorXPath}/descendant::${tagName}`);
        break;
        
      case 'descendant':
        paths.push(`${anchorXPath}/parent::*//${tagName}`);
        paths.push(`${anchorXPath}/..//${tagName}`);
        break;
    }
    
    // 添加文本过滤
    const text = Utils.getVisibleText(element);
    if (text) {
      const escapedText = Utils.escapeXPath(text);
      const textPaths = paths.map(path => `${path}[text()=${escapedText}]`);
      paths.push(...textPaths);
    }
    
    return paths;
  }

  getScore(element, context) {
    let score = this.priority;
    
    const anchors = this.findAnchorElements(element);
    if (anchors.length > 0) {
      score += Math.min(anchors.length * 5, 25);
      score += Math.min(anchors[0].score / 2, 25); // 最佳锚点的分数
    }
    
    return score;
  }
}