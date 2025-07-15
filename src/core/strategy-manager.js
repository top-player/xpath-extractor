/**
 * 策略管理器
 * 管理所有XPath生成策略
 */
class StrategyManager {
  constructor() {
    this.strategies = [];
    this.initializeStrategies();
  }

  initializeStrategies() {
    // 按新的优先级顺序注册策略
    // 1. 优先使用文本定位策略（最稳定）
    this.registerStrategy(new TextStrategy());
    
    // 2. 其次使用单元素定位法（属性策略）
    this.registerStrategy(new AttributeStrategy());
    
    // 3. 相邻元素锚定策略
    this.registerStrategy(new AnchorStrategy());
    
    // 4. 容器范围限定策略
    this.registerStrategy(new ContainerContextStrategy());
    
    // 其他策略保持原有顺序
    this.registerStrategy(new ShadowDOMStrategy());
    this.registerStrategy(new SVGStrategy());
    this.registerStrategy(new RelativeStrategy());
  }

  registerStrategy(strategy) {
    if (!(strategy instanceof BaseStrategy)) {
      throw new Error('策略必须继承自BaseStrategy');
    }
    this.strategies.push(strategy);
    // 按优先级排序
    this.strategies.sort((a, b) => b.priority - a.priority);
  }

  unregisterStrategy(strategyName) {
    this.strategies = this.strategies.filter(s => s.name !== strategyName);
  }

  /**
   * 为元素生成XPath
   * @param {Element} element - 目标元素
   * @param {Object} options - 选项
   * @returns {Object} 生成结果
   */
  generateXPath(element, options = {}) {
    const context = this.buildContext(element, options);
    const results = [];
    
    // 检查是否包含随机类名，如果是则降低属性策略优先级
    const hasRandomClasses = this.hasRandomClasses(element);
    
    // 尝试每个适用的策略
    for (const strategy of this.strategies) {
      try {
        if (strategy.isApplicable(element, context)) {
          const xpath = strategy.generate(element, context);
          if (xpath) {
            let score = strategy.getScore(element, context);
            
            // 如果检测到随机类名，降低属性策略分数
            if (hasRandomClasses && strategy.name === 'attribute') {
              score -= 50;
            }
            
            results.push({
              strategy: strategy.name,
              xpath: xpath,
              score: score,
              priority: strategy.priority
            });
          }
        }
      } catch (error) {
        console.warn(`策略 ${strategy.name} 执行失败:`, error);
      }
    }
    
    // 按分数排序
    results.sort((a, b) => b.score - a.score);
    
    return {
      success: results.length > 0,
      primary: results[0] || null,
      alternatives: results.slice(1, 3),
      context: context
    };
  }
  
  hasRandomClasses(element) {
    if (!element.className) return false;
    
    const classes = element.className.split(/\s+/);
    const randomPatterns = [
      /^__[a-z]+-[a-z0-9-]+$/i,
      /^[a-z]+-[a-f0-9]{5,}$/i,
      /^_[a-f0-9]{5,}$/i
    ];
    
    return classes.some(cls => 
      randomPatterns.some(pattern => pattern.test(cls))
    );
  }

  buildContext(element, options) {
    return {
      framework: Utils.getFrameworkType(element),
      isInShadowDOM: Utils.isInShadowDOM(element),
      elementType: this.getElementType(element),
      ...options
    };
  }

  getElementType(element) {
    const tagName = element.tagName.toLowerCase();
    const type = element.type;
    const role = element.getAttribute('role');
    
    // 表单元素
    if (['input', 'select', 'textarea', 'button'].includes(tagName)) {
      return `form-${tagName}`;
    }
    
    // 交互元素
    if (tagName === 'a' && element.href) {
      return 'link';
    }
    
    if (role) {
      return `role-${role}`;
    }
    
    // 容器元素
    if (['div', 'span', 'section', 'article', 'header', 'footer', 'nav'].includes(tagName)) {
      return 'container';
    }
    
    // 文本元素
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'label'].includes(tagName)) {
      return 'text';
    }
    
    return 'other';
  }

  /**
   * 获取策略统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      totalStrategies: this.strategies.length,
      strategies: this.strategies.map(s => ({
        name: s.name,
        priority: s.priority
      }))
    };
  }
}