/**
 * 属性定位策略
 * 基于元素属性生成XPath
 */
class AttributeStrategy extends BaseStrategy {
  constructor() {
    super('attribute', 100); // 提高到最高优先级
  }

  isApplicable(element, context) {
    // 直接检查是否有稳定属性
    const stableAttrs = Utils.getStableAttributes(element);
    
    // 调试日志
    if (console && console.log) {
      console.log('稳定属性:', stableAttrs);
    }
    
    return stableAttrs.length > 0;
  }

  generate(element, context) {
    const framework = context.framework || 'vanilla';
    
    // 获取稳定属性
    const stableAttrs = Utils.getStableAttributes(element);
    const strategies = [];
    
    // 按优先级处理属性
    const highPriorityAttrs = stableAttrs.filter(attr => attr.priority === 'high');
    const mediumPriorityAttrs = stableAttrs.filter(attr => attr.priority === 'medium');
    const lowPriorityAttrs = stableAttrs.filter(attr => attr.priority === 'low');
    
    // ID属性（最高优先级）
    const idAttr = highPriorityAttrs.find(attr => attr.name === 'id');
    if (idAttr && Utils.isValidId(idAttr.value)) {
      strategies.push(`//*[@id='${idAttr.value}']`);
      strategies.push(`//${element.tagName.toLowerCase()}[@id='${idAttr.value}']`);
    }
    
    // name属性
    const nameAttr = highPriorityAttrs.find(attr => attr.name === 'name');
    if (nameAttr) {
      strategies.push(`//*[@name='${nameAttr.value}']`);
      strategies.push(`//${element.tagName.toLowerCase()}[@name='${nameAttr.value}']`);
    }
    
    // 其他高优先级属性
    for (const attr of highPriorityAttrs) {
      if (attr.name !== 'id' && attr.name !== 'name') {
        strategies.push(`//*[@${attr.name}='${attr.value}']`);
        strategies.push(`//${element.tagName.toLowerCase()}[@${attr.name}='${attr.value}']`);
      }
    }
    
    // 中优先级属性（aria-*, placeholder等）
    for (const attr of mediumPriorityAttrs.slice(0, 2)) {
      strategies.push(`//*[@${attr.name}='${attr.value}']`);
    }
    
    // 类名策略（过滤框架特定类名）
    if (element.className) {
      const classes = Utils.getFilteredClasses(element.className);
      if (classes.length > 0) {
        // 单个稳定类名
        for (const cls of classes.slice(0, 2)) {
          strategies.push(`//*[@class='${cls}']`);
          strategies.push(`//*[contains(@class, '${cls}')]`);
        }
        
        // 多个类名组合
        if (classes.length > 1) {
          const combinedClasses = classes.slice(0, 2).join(' ');
          strategies.push(`//*[@class='${combinedClasses}']`);
        }
      }
    }
    
    // 稳定的data属性
    const stableDataAttrs = lowPriorityAttrs.filter(attr => 
      attr.name.startsWith('data-') && Utils.isStableDataAttribute(attr.name, attr.value)
    );
    
    for (const dataAttr of stableDataAttrs.slice(0, 2)) {
      strategies.push(`//*[@${dataAttr.name}='${dataAttr.value}']`);
    }
    
    // 测试每个策略
    for (const xpath of strategies) {
      if (this.validateXPath(xpath, element)) {
        return xpath;
      }
    }
    
    return null;
  }
  
  isValidId(id) {
    return Utils.isValidId(id);
  }
  
  getFilteredClasses(className, framework) {
    return Utils.getFilteredClasses(className);
  }
  
  getScore(element, context) {
    let score = this.priority;
    
    // ID属性加分
    if (element.id && this.isValidId(element.id)) {
      score += 50;
    }
    
    // name属性加分
    if (element.name) {
      score += 30;
    }
    
    // 稳定类名加分
    const classes = this.getFilteredClasses(element.className, context.framework);
    if (classes.length > 0) {
      score += Math.min(classes.length * 10, 30);
    }
    
    return score;
  }
}