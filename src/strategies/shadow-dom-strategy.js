/**
 * Shadow DOM策略
 * 处理Shadow DOM中的元素
 */
class ShadowDOMStrategy extends BaseStrategy {
  constructor() {
    super('shadow-dom', 90);
  }

  isApplicable(element, context) {
    return Utils.isInShadowDOM(element);
  }

  generate(element, context) {
    try {
      // 获取Shadow DOM路径
      const shadowPath = this.getShadowDOMPath(element);
      if (!shadowPath) return null;
      
      // 在Shadow DOM内部生成XPath
      const shadowRoot = this.findShadowRoot(element);
      if (!shadowRoot) return null;
      
      // 在Shadow DOM内部使用其他策略
      const internalStrategies = [
        this.generateByText(element),
        this.generateByAttributes(element),
        this.generateByPosition(element)
      ].filter(xpath => xpath);
      
      // 验证每个策略
      for (const xpath of internalStrategies) {
        if (this.validateInShadowDOM(xpath, element, shadowRoot)) {
          return `${shadowPath}${xpath}`;
        }
      }
      
      return null;
    } catch (error) {
      console.warn('Shadow DOM策略执行失败:', error);
      return null;
    }
  }
  
  getShadowDOMPath(element) {
    const path = [];
    let current = element;
    
    while (current) {
      const root = current.getRootNode();
      
      if (root instanceof ShadowRoot) {
        // 找到Shadow Host
        const host = root.host;
        if (host) {
          // 生成到Shadow Host的路径
          const hostPath = this.generatePathToHost(host);
          if (hostPath) {
            path.unshift(hostPath);
          }
          current = host;
        } else {
          break;
        }
      } else {
        break;
      }
    }
    
    return path.length > 0 ? path.join('') : '';
  }
  
  generatePathToHost(host) {
    // 为Shadow Host生成XPath
    if (host.id && Utils.isValidId(host.id)) {
      return `//*[@id='${host.id}']//`;
    }
    
    if (host.className) {
      const filteredClasses = Utils.getFilteredClasses(host.className);
      if (filteredClasses.length > 0) {
        return `//*[contains(@class, '${filteredClasses[0]}')]//`;
      }
    }
    
    // 使用标签名和位置
    const index = Utils.getElementIndex(host);
    return `//${host.tagName.toLowerCase()}[${index}]//`;
  }
  
  findShadowRoot(element) {
    let current = element;
    while (current) {
      const root = current.getRootNode();
      if (root instanceof ShadowRoot) {
        return root;
      }
      current = current.parentElement;
    }
    return null;
  }
  
  generateByText(element) {
    const text = Utils.getVisibleText(element);
    if (!text || text.length > 50) return null;
    
    const escapedText = Utils.escapeXPath(text);
    const tagName = element.tagName.toLowerCase();
    
    return `//${tagName}[text()=${escapedText}]`;
  }
  
  generateByAttributes(element) {
    if (element.id && Utils.isValidId(element.id)) {
      return `//*[@id='${element.id}']`;
    }
    
    if (element.name) {
      return `//*[@name='${element.name}']`;
    }
    
    if (element.className) {
      const filteredClasses = Utils.getFilteredClasses(element.className);
      if (filteredClasses.length > 0) {
        return `//*[contains(@class, '${filteredClasses[0]}')]`;
      }
    }
    
    return null;
  }
  
  generateByPosition(element) {
    const tagName = element.tagName.toLowerCase();
    const index = Utils.getElementIndex(element);
    return `//${tagName}[${index}]`;
  }
  
  validateInShadowDOM(xpath, targetElement, shadowRoot) {
    try {
      const result = shadowRoot.evaluate(
        xpath,
        shadowRoot,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      return result.singleNodeValue === targetElement;
    } catch (error) {
      return false;
    }
  }
  
  getScore(element, context) {
    let score = this.priority;
    
    // Shadow DOM中的元素需要特殊处理，给予较高分数
    score += 20;
    
    // 如果有稳定的标识符，增加分数 - 只对有效ID计分
    if (Utils.isValidId(element.id)) score += 30;
    if (element.name) score += 20;
    
    const text = Utils.getVisibleText(element);
    if (text && text.length <= 20) score += 15;
    
    return score;
  }
}