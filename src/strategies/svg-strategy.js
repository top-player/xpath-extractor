/**
 * SVG元素定位策略
 * 专门处理SVG图标和元素的XPath生成
 */
class SVGStrategy extends BaseStrategy {
  constructor() {
    super('svg', 85); // 高优先级，仅次于文本策略
  }

  isApplicable(element, context) {
    const analysis = context.analysis || {};
    return analysis.basic && analysis.basic.isSVG;
  }

  generate(element, context) {
    const analysis = context.analysis || {};
    const svgInfo = analysis.basic?.svgInfo;
    
    if (!svgInfo) return null;

    const strategies = [];
    const svgElement = svgInfo.svgElement;
    
    // 1. 基于aria-label的定位
    if (svgInfo.hasAriaLabel && svgInfo.ariaLabelText) {
      const escapedLabel = Utils.escapeXPath(svgInfo.ariaLabelText);
      strategies.push(`//svg[@aria-label=${escapedLabel}]`);
      strategies.push(`//*[name()='svg'][@aria-label=${escapedLabel}]`);
    }
    
    // 2. 基于title元素的定位
    if (svgInfo.hasTitle && svgInfo.titleText) {
      const escapedTitle = Utils.escapeXPath(svgInfo.titleText);
      strategies.push(`//svg[title[text()=${escapedTitle}]]`);
      strategies.push(`//*[name()='svg'][*[name()='title'][text()=${escapedTitle}]]`);
    }
    
    // 3. 基于desc元素的定位
    if (svgInfo.hasDesc && svgInfo.descText) {
      const escapedDesc = Utils.escapeXPath(svgInfo.descText);
      strategies.push(`//svg[desc[text()=${escapedDesc}]]`);
      strategies.push(`//*[name()='svg'][*[name()='desc'][text()=${escapedDesc}]]`);
    }
    
    // 4. 基于父元素的aria-label或title属性
    const parentWithLabel = this.findParentWithLabel(svgElement);
    if (parentWithLabel) {
      const { element: parent, attribute, value } = parentWithLabel;
      const escapedValue = Utils.escapeXPath(value);
      const parentTag = parent.tagName.toLowerCase();
      strategies.push(`//${parentTag}[@${attribute}=${escapedValue}]//svg`);
      strategies.push(`//${parentTag}[@${attribute}=${escapedValue}]//*[name()='svg']`);
    }
    
    // 5. 基于class属性的定位（使用过滤后的类名）
    if (svgElement.className && svgElement.className.baseVal) {
      const filteredClasses = Utils.getFilteredClasses(svgElement.className.baseVal);
      if (filteredClasses.length > 0) {
        for (const cls of filteredClasses.slice(0, 2)) {
          strategies.push(`//svg[contains(@class, '${cls}')]`);
          strategies.push(`//*[name()='svg'][contains(@class, '${cls}')]`);
        }
      }
    }
    
    // 6. 基于viewBox的定位（对于特定的图标很有用）
    if (svgInfo.viewBox) {
      strategies.push(`//svg[@viewBox='${svgInfo.viewBox}']`);
      strategies.push(`//*[name()='svg'][@viewBox='${svgInfo.viewBox}']`);
    }
    
    // 7. 基于path数量的定位（结合其他属性）
    if (svgInfo.pathCount > 0) {
      strategies.push(`//svg[count(.//path)=${svgInfo.pathCount}]`);
      strategies.push(`//*[name()='svg'][count(.//*[name()='path'])=${svgInfo.pathCount}]`);
    }
    
    // 8. 基于use元素的href属性
    if (svgInfo.useElements > 0) {
      const useElement = svgElement.querySelector('use');
      if (useElement && useElement.getAttribute('href')) {
        const href = useElement.getAttribute('href');
        strategies.push(`//svg[.//use[@href='${href}']]`);
        strategies.push(`//*[name()='svg'][.//*[name()='use'][@href='${href}']]`);
      }
    }
    
    // 测试每个策略
    for (const xpath of strategies) {
      if (this.validateXPath(xpath, svgElement)) {
        return xpath;
      }
    }
    
    // 如果所有策略都失败，返回基于位置的定位
    return this.generatePositionalXPath(svgElement);
  }
  
  findParentWithLabel(svgElement) {
    let current = svgElement.parentElement;
    let depth = 0;
    
    while (current && depth < 3) { // 最多向上查找3层
      // 检查aria-label
      const ariaLabel = current.getAttribute('aria-label');
      if (ariaLabel && ariaLabel.trim()) {
        return { element: current, attribute: 'aria-label', value: ariaLabel.trim() };
      }
      
      // 检查title属性
      const title = current.getAttribute('title');
      if (title && title.trim()) {
        return { element: current, attribute: 'title', value: title.trim() };
      }
      
      // 检查data-*属性中可能包含的描述信息
      for (const attr of current.attributes) {
        if (attr.name.startsWith('data-') && 
            (attr.name.includes('label') || attr.name.includes('title') || attr.name.includes('tooltip')) &&
            attr.value.trim()) {
          return { element: current, attribute: attr.name, value: attr.value.trim() };
        }
      }
      
      current = current.parentElement;
      depth++;
    }
    
    return null;
  }
  
  generatePositionalXPath(svgElement) {
    const index = Utils.getElementIndex(svgElement);
    return `//svg[${index}]`;
  }
  
  getScore(element, context) {
    let score = this.priority;
    const analysis = context.analysis || {};
    const svgInfo = analysis.basic?.svgInfo;
    
    if (!svgInfo) return 0;
    
    // 有aria-label的SVG得分最高
    if (svgInfo.hasAriaLabel) score += 40;
    
    // 有title或desc的SVG得分较高
    if (svgInfo.hasTitle) score += 30;
    if (svgInfo.hasDesc) score += 25;
    
    // 父元素有标签的SVG得分中等
    const parentWithLabel = this.findParentWithLabel(svgInfo.svgElement);
    if (parentWithLabel) score += 20;
    
    // 有特定viewBox的SVG得分中等
    if (svgInfo.viewBox) score += 15;
    
    // 有class的SVG得分较低
    if (svgInfo.svgElement.className && svgInfo.svgElement.className.baseVal) {
      score += 10;
    }
    
    return score;
  }
}