/**
 * 文本定位策略
 * 基于元素的文本内容生成XPath
 */
class TextStrategy extends BaseStrategy {
  constructor() {
    super('text', 110); // 提高优先级，确保高于属性策略的100
  }

  isApplicable(element, context) {
    const text = Utils.getVisibleText(element);
    return text.length > 0 && text.length <= 50; // 文本长度合理
  }

  generate(element, context) {
    const text = Utils.getVisibleText(element).trim();
    if (!text) return null;

    // 检测重复文本
    const duplicateInfo = this.detectDuplicateText(text, element);
    if (duplicateInfo.hasDuplicates) {
      return this.generateContextAwareXPath(element, text, duplicateInfo, context);
    }

    const tagName = element.tagName.toLowerCase();
    const escapedText = Utils.escapeXPath(text);

    // 针对按钮元素，优先使用更稳定的定位策略
    const strategies = [];
    
    // 对于按钮类元素，优先使用父级button的文本定位
    if (tagName === 'span' && element.closest('button')) {
      const buttonElement = element.closest('button');
      const buttonText = Utils.getVisibleText(buttonElement).trim();
      if (buttonText === text) {
        strategies.push(
          `//button[text()=${escapedText}]`,
          `//button[contains(text(), ${escapedText})]`,
          `//button[normalize-space(text())=${Utils.escapeXPath(text.replace(/\s+/g, ' '))}]`
        );
      }
    }
    
    // 标准文本定位策略
    strategies.push(
      // 精确文本匹配
      `//${tagName}[text()=${escapedText}]`,
      // 包含文本匹配
      `//${tagName}[contains(text(), ${escapedText})]`,
      // 标准化空格后匹配
      `//${tagName}[normalize-space(text())=${Utils.escapeXPath(text.replace(/\s+/g, ' '))}]`,
      // 任意元素文本匹配
      `//*[text()=${escapedText}]`,
      `//*[contains(text(), ${escapedText})]`
    );

    // 特殊元素处理
    if (this.isButtonLikeElement(element)) {
      strategies.unshift(
        `//button[text()=${escapedText}]`,
        `//input[@type='button' and @value=${escapedText}]`,
        `//input[@type='submit' and @value=${escapedText}]`,
        `//*[@role='button' and text()=${escapedText}]`
      );
    }

    // 测试每个策略
    for (const xpath of strategies) {
      if (this.validateXPath(xpath, element)) {
        return xpath;
      }
    }

    return null;
  }

  isButtonLikeElement(element) {
    const tagName = element.tagName.toLowerCase();
    const type = element.type;
    const role = element.getAttribute('role');
    
    return tagName === 'button' || 
           (tagName === 'input' && ['button', 'submit', 'reset'].includes(type)) ||
           role === 'button' ||
           element.classList.contains('btn') ||
           element.classList.contains('button');
  }

  isLinkElement(element) {
    return element.tagName.toLowerCase() === 'a' && element.href;
  }

  getScore(element, context) {
    let score = this.priority + 100; // 基础分数大幅提高
    const text = Utils.getVisibleText(element);
    
    // 文本越短越精确，分数越高
    if (text.length <= 10) score += 50; // 增加奖励分数
    else if (text.length <= 20) score += 30;
    else if (text.length <= 30) score += 5;
    
    // 按钮类元素优先级更高
    if (this.isButtonLikeElement(element)) score += 50;
    
    // 链接元素优先级较高
    if (this.isLinkElement(element)) score += 30;
    
    // 如果文本唯一且简洁，给予额外高分
    if (text.length <= 15 && !this.detectDuplicateText(text, element).hasDuplicates) {
      score += 100;
    }
    
    return score;
  }

  /**
   * 检测页面中的重复文本
   * @param {string} text - 目标文本
   * @param {Element} targetElement - 目标元素
   * @returns {Object} 重复信息
   */
  detectDuplicateText(text, targetElement) {
    const escapedText = Utils.escapeXPath(text);
    const xpath = `//*[text()=${escapedText} or contains(text(), ${escapedText})]`;
    
    try {
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );
      
      const duplicates = [];
      for (let i = 0; i < result.snapshotLength; i++) {
        const element = result.snapshotItem(i);
        if (element !== targetElement) {
          duplicates.push(element);
        }
      }
      
      return {
        hasDuplicates: duplicates.length > 0,
        count: duplicates.length + 1,
        elements: duplicates,
        targetIndex: this.getElementIndexInDuplicates(targetElement, duplicates)
      };
    } catch (error) {
      return { hasDuplicates: false, count: 1, elements: [], targetIndex: 0 };
    }
  }

  /**
   * 生成上下文感知的XPath
   * @param {Element} element - 目标元素
   * @param {string} text - 文本内容
   * @param {Object} duplicateInfo - 重复信息
   * @param {Object} context - 上下文
   * @returns {string|null} XPath表达式
   */
  generateContextAwareXPath(element, text, duplicateInfo, context) {
    const escapedText = Utils.escapeXPath(text);
    const tagName = element.tagName.toLowerCase();
    
    // 策略1: 容器范围限定
    const containerXPath = this.generateContainerBasedXPath(element, text, escapedText, tagName);
    if (containerXPath && this.validateXPath(containerXPath, element)) {
      return containerXPath;
    }
    
    // 策略2: 相邻元素锚定
    const anchorXPath = this.generateAnchorBasedXPath(element, text, escapedText, tagName);
    if (anchorXPath && this.validateXPath(anchorXPath, element)) {
      return anchorXPath;
    }
    
    // 策略3: 位置索引
    const indexXPath = this.generateIndexBasedXPath(element, text, escapedText, tagName, duplicateInfo);
    if (indexXPath && this.validateXPath(indexXPath, element)) {
      return indexXPath;
    }
    
    return null;
  }
}