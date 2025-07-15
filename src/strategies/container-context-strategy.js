/**
 * 容器范围限定策略
 * 通过限定容器范围来解决重复文本定位问题
 */
if (typeof ContainerContextStrategy === 'undefined') {
  class ContainerContextStrategy extends BaseStrategy {
    constructor() {
      super('container-context', 90); // 第三优先级
    }

    isApplicable(element, context) {
      const text = Utils.getVisibleText(element);
      return text.length > 0 && this.hasUniqueContainer(element);
    }

    generate(element, context) {
      const text = Utils.getVisibleText(element).trim();
      if (!text) return null;

      const escapedText = Utils.escapeXPath(text);
      const tagName = element.tagName.toLowerCase();
      
      // 查找最近的唯一容器
      const containers = this.findUniqueContainers(element);
      
      for (const container of containers) {
        const containerXPath = this.getContainerXPath(container);
        if (containerXPath) {
          const strategies = [
            `${containerXPath}//${tagName}[text()=${escapedText}]`,
            `${containerXPath}//*[text()=${escapedText}]`,
            `${containerXPath}//${tagName}[contains(text(), ${escapedText})]`,
            `${containerXPath}//*[contains(text(), ${escapedText})]`
          ];
          
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
     * 查找唯一容器
     * @param {Element} element - 目标元素
     * @returns {Array<Element>} 唯一容器列表
     */
    findUniqueContainers(element) {
      const containers = [];
      let current = element.parentElement;
      
      while (current && current !== document.body) {
        // 检查是否有唯一标识
        if (this.hasUniqueIdentifier(current)) {
          containers.push(current);
        }
        
        // 检查是否为语义容器
        if (this.isSemanticContainer(current)) {
          containers.push(current);
        }
        
        current = current.parentElement;
      }
      
      return containers;
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
     * 检查元素是否有唯一标识
     * @param {Element} element - 元素
     * @returns {boolean} 是否有唯一标识
     */
    hasUniqueIdentifier(element) {
      // ID属性 - 只检查有效的ID
      const validId = Utils.getValidId(element.id);
      if (validId) {
        const xpath = `//*[@id=${Utils.escapeXPath(validId)}]`;
        try {
          const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          if (result.snapshotLength === 1) return true;
        } catch (e) {}
      }
      
      // 唯一class组合（过滤随机类名）
      if (element.className && typeof element.className === 'string') {
        const classes = element.className.split(/\s+/).filter(cls => cls);
        const filteredClasses = this.getFilteredClasses(classes);
        
        for (const cls of filteredClasses) {
          const xpath = `//*[contains(@class, ${Utils.escapeXPath(cls)})]`;
          try {
            const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            if (result.snapshotLength === 1) return true;
          } catch (e) {}
        }
      }
      
      // 其他唯一属性
      for (const attr of element.attributes) {
        if (['style', 'class', 'id'].includes(attr.name)) continue;
        const xpath = `//*[@${attr.name}=${Utils.escapeXPath(attr.value)}]`;
        try {
          const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          if (result.snapshotLength === 1) return true;
        } catch (e) {}
      }
      
      return false;
    }

    /**
     * 获取容器的XPath
     * @param {Element} container - 容器元素
     * @returns {string|null} 容器XPath
     */
    getContainerXPath(container) {
      const tagName = container.tagName.toLowerCase();
      
      // 优先使用有效的ID
      const validId = Utils.getValidId(container.id);
      if (validId) {
        return `//*[@id=${Utils.escapeXPath(validId)}]`;
      }
      
      // 使用唯一class（过滤随机类名）
      if (container.className && typeof container.className === 'string') {
        const classes = container.className.split(/\s+/).filter(cls => cls);
        const filteredClasses = this.getFilteredClasses(classes);
        
        for (const cls of filteredClasses) {
          const xpath = `//${tagName}[contains(@class, ${Utils.escapeXPath(cls)})]`;
          try {
            const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            if (result.snapshotLength === 1) return xpath;
          } catch (e) {}
        }
      }
      
      // 使用其他唯一属性
      for (const attr of container.attributes) {
        if (['style', 'class', 'id'].includes(attr.name)) continue;
        const xpath = `//${tagName}[@${attr.name}=${Utils.escapeXPath(attr.value)}]`;
        try {
          const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          if (result.snapshotLength === 1) return xpath;
        } catch (e) {}
      }
      
      return null;
    }

    hasUniqueContainer(element) {
      return this.findUniqueContainers(element).length > 0;
    }

    getScore(element, context) {
      let score = this.priority;
      
      const containers = this.findUniqueContainers(element);
      if (containers.length > 0) {
        score += containers.length * 10;
        
        // ID容器加分更多
        if (containers.some(c => c.id)) {
          score += 20;
        }
      }
      
      return score;
    }

    /**
     * 检查元素是否为语义容器
     * @param {Element} element - 元素
     * @returns {boolean} 是否为语义容器
     */
    isSemanticContainer(element) {
      const tagName = element.tagName.toLowerCase();
      
      // 语义化HTML5容器元素
      const semanticContainers = [
        'main', 'section', 'article', 'aside', 'nav', 'header', 'footer',
        'form', 'fieldset', 'table', 'tbody', 'thead', 'tfoot',
        'ul', 'ol', 'dl', 'figure', 'blockquote', 'details'
      ];
      
      if (semanticContainers.includes(tagName)) {
        return true;
      }
      
      // 检查是否有语义化的role属性
      const role = element.getAttribute('role');
      const semanticRoles = [
        'main', 'navigation', 'banner', 'contentinfo', 'complementary',
        'region', 'article', 'section', 'form', 'search', 'dialog',
        'tabpanel', 'group', 'list', 'listbox', 'menu', 'menubar'
      ];
      
      if (role && semanticRoles.includes(role)) {
        return true;
      }
      
      // 检查是否有明确的容器类名
      if (element.className && typeof element.className === 'string') {
        const classes = element.className.toLowerCase();
        const containerKeywords = [
          'container', 'wrapper', 'content', 'main', 'section',
          'panel', 'card', 'box', 'widget', 'module', 'component'
        ];
        
        if (containerKeywords.some(keyword => classes.includes(keyword))) {
          return true;
        }
      }
      
      return false;
    }
  }
  
  window.ContainerContextStrategy = ContainerContextStrategy;
}