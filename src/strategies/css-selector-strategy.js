/**
 * CSS Selector策略
 * 作为XPath的回退方案，生成CSS选择器
 */
class CSSStrategy extends BaseStrategy {
  constructor() {
    super('css-selector', 30); // 较低优先级，作为回退方案
  }

  isApplicable(element, context) {
    // 作为回退策略，始终适用
    return true;
  }

  generate(element, context) {
    const selectors = [];
    
    // 1. 基于ID的选择器（最高优先级）
    if (element.id && Utils.isValidId(element.id)) {
      selectors.push(`#${CSS.escape(element.id)}`);
    }
    
    // 2. 基于唯一属性的选择器
    const uniqueAttrs = this.getUniqueAttributes(element);
    for (const attr of uniqueAttrs.slice(0, 2)) {
      if (attr.name === 'id') continue; // ID已经处理过了
      selectors.push(`[${attr.name}="${CSS.escape(attr.value)}"]`);
      selectors.push(`${element.tagName.toLowerCase()}[${attr.name}="${CSS.escape(attr.value)}"]`);
    }
    
    // 3. 基于类名的选择器
    if (element.className) {
      const filteredClasses = Utils.getFilteredClasses(element.className);
      if (filteredClasses.length > 0) {
        // 单个类名
        for (const cls of filteredClasses.slice(0, 2)) {
          selectors.push(`.${CSS.escape(cls)}`);
          selectors.push(`${element.tagName.toLowerCase()}.${CSS.escape(cls)}`);
        }
        
        // 组合类名
        if (filteredClasses.length > 1) {
          const combinedClasses = filteredClasses.slice(0, 2).map(cls => `.${CSS.escape(cls)}`).join('');
          selectors.push(combinedClasses);
          selectors.push(`${element.tagName.toLowerCase()}${combinedClasses}`);
        }
      }
    }
    
    // 4. 基于文本内容的选择器（适用于特定标签）
    const textSelectors = this.generateTextBasedSelectors(element);
    selectors.push(...textSelectors);
    
    // 5. 基于父元素的选择器
    const parentSelectors = this.generateParentBasedSelectors(element);
    selectors.push(...parentSelectors);
    
    // 6. 基于属性组合的选择器
    const attrSelectors = this.generateAttributeSelectors(element);
    selectors.push(...attrSelectors);
    
    // 7. 基于nth-child的选择器（最后备选）
    const nthSelectors = this.generateNthChildSelectors(element);
    selectors.push(...nthSelectors);
    
    // 测试每个选择器
    for (const selector of selectors) {
      if (this.validateSelector(selector, element)) {
        return selector;
      }
    }
    
    // 如果所有策略都失败，返回基于标签名和索引的选择器
    return this.generateFallbackSelector(element);
  }
  
  /**
   * 生成基于文本内容的选择器
   */
  generateTextBasedSelectors(element) {
    const selectors = [];
    const text = Utils.getVisibleText(element);
    
    if (text && text.length <= 50) {
      const tagName = element.tagName.toLowerCase();
      
      // 对于支持:contains的特殊情况，这里我们使用属性选择器
      if (['a', 'button', 'span', 'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        // 虽然CSS没有原生的:contains，但我们可以生成用于querySelector的选择器
        // 注意：这需要特殊处理，因为标准CSS不支持文本内容选择
        selectors.push(`${tagName}[title="${CSS.escape(text)}"]`);
        
        // 如果元素有aria-label等属性包含文本
        if (element.getAttribute('aria-label') === text) {
          selectors.push(`${tagName}[aria-label="${CSS.escape(text)}"]`);
        }
        
        if (element.getAttribute('title') === text) {
          selectors.push(`${tagName}[title="${CSS.escape(text)}"]`);
        }
      }
    }
    
    return selectors;
  }
  
  /**
   * 生成基于父元素的选择器
   */
  generateParentBasedSelectors(element) {
    const selectors = [];
    const tagName = element.tagName.toLowerCase();
    let current = element.parentElement;
    let depth = 0;
    
    while (current && depth < 3) {
      const parentTag = current.tagName.toLowerCase();
      
      // 基于父元素ID
      if (current.id && Utils.isValidId(current.id)) {
        selectors.push(`#${CSS.escape(current.id)} ${tagName}`);
        selectors.push(`#${CSS.escape(current.id)} > ${tagName}`);
      }
      
      // 基于父元素类名
      if (current.className) {
        const filteredClasses = Utils.getFilteredClasses(current.className);
        for (const cls of filteredClasses.slice(0, 1)) {
          selectors.push(`.${CSS.escape(cls)} ${tagName}`);
          selectors.push(`.${CSS.escape(cls)} > ${tagName}`);
        }
      }
      
      // 基于父元素的唯一属性
      const parentAttrs = this.getUniqueAttributes(current);
      for (const attr of parentAttrs.slice(0, 1)) {
        selectors.push(`${parentTag}[${attr.name}="${CSS.escape(attr.value)}"] ${tagName}`);
      }
      
      current = current.parentElement;
      depth++;
    }
    
    return selectors;
  }
  
  /**
   * 生成基于属性组合的选择器
   */
  generateAttributeSelectors(element) {
    const selectors = [];
    const tagName = element.tagName.toLowerCase();
    const stableAttrs = Utils.getStableAttributes(element);
    
    // 组合多个属性
    if (stableAttrs.length >= 2) {
      const attrPairs = [];
      for (let i = 0; i < Math.min(stableAttrs.length, 3); i++) {
        const attr = stableAttrs[i];
        attrPairs.push(`[${attr.name}="${CSS.escape(attr.value)}"]`);
      }
      
      // 两个属性组合
      if (attrPairs.length >= 2) {
        selectors.push(`${tagName}${attrPairs[0]}${attrPairs[1]}`);
        selectors.push(`${attrPairs[0]}${attrPairs[1]}`);
      }
      
      // 三个属性组合
      if (attrPairs.length >= 3) {
        selectors.push(`${tagName}${attrPairs[0]}${attrPairs[1]}${attrPairs[2]}`);
      }
    }
    
    return selectors;
  }
  
  /**
   * 生成基于nth-child的选择器
   */
  generateNthChildSelectors(element) {
    const selectors = [];
    const tagName = element.tagName.toLowerCase();
    
    if (element.parentElement) {
      const siblings = Array.from(element.parentElement.children);
      const index = siblings.indexOf(element) + 1;
      
      selectors.push(`${tagName}:nth-child(${index})`);
      
      // 如果父元素有标识符，组合使用
      const parent = element.parentElement;
      if (parent.id && Utils.isValidId(parent.id)) {
        selectors.push(`#${CSS.escape(parent.id)} > ${tagName}:nth-child(${index})`);
      }
      
      if (parent.className) {
        const filteredClasses = Utils.getFilteredClasses(parent.className);
        if (filteredClasses.length > 0) {
          selectors.push(`.${CSS.escape(filteredClasses[0])} > ${tagName}:nth-child(${index})`);
        }
      }
    }
    
    return selectors;
  }
  
  /**
   * 生成后备选择器
   */
  generateFallbackSelector(element) {
    const tagName = element.tagName.toLowerCase();
    
    if (element.parentElement) {
      const siblings = Array.from(element.parentElement.children).filter(el => el.tagName === element.tagName);
      const index = siblings.indexOf(element) + 1;
      return `${tagName}:nth-of-type(${index})`;
    }
    
    return tagName;
  }
  
  /**
   * 获取元素的唯一属性
   */
  getUniqueAttributes(element) {
    const uniqueAttrs = [];
    const skipAttrs = ['style', 'class'];
    
    for (const attr of element.attributes) {
      if (skipAttrs.includes(attr.name) || !attr.value) continue;
      
      // 跳过框架生成的属性
      if (Utils.isFrameworkAttribute(attr.name, attr.value)) continue;
      
      // 检查属性值是否唯一
      try {
        const selector = `[${attr.name}="${CSS.escape(attr.value)}"]`;
        const elements = document.querySelectorAll(selector);
        if (elements.length === 1) {
          uniqueAttrs.push({ name: attr.name, value: attr.value });
        }
      } catch (e) {
        continue;
      }
    }
    
    return uniqueAttrs;
  }
  
  /**
   * 验证CSS选择器
   */
  validateSelector(selector, targetElement) {
    try {
      const elements = document.querySelectorAll(selector);
      return elements.length === 1 && elements[0] === targetElement;
    } catch (error) {
      return false;
    }
  }
  
  getScore(element, context) {
    let score = this.priority;
    
    // ID选择器得分最高
    if (element.id && Utils.isValidId(element.id)) {
      score += 40;
    }
    
    // 唯一属性加分
    const uniqueAttrs = this.getUniqueAttributes(element);
    score += Math.min(uniqueAttrs.length * 10, 30);
    
    // 稳定类名加分
    if (element.className) {
      const filteredClasses = Utils.getFilteredClasses(element.className);
      score += Math.min(filteredClasses.length * 5, 20);
    }
    
    return score;
  }
}