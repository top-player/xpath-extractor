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
    // 0. AI策略（最高优先级，但需要配置）
    this.registerStrategy(new AIStrategy());
    
    // 1. 优先使用文本定位策略（最稳定）
    this.registerStrategy(new TextStrategy());
    
    // 2. 其次使用单元素定位法（属性策略）
    this.registerStrategy(new AttributeStrategy());
    
    // 3. 相邻元素锚定策略
    this.registerStrategy(new AnchorStrategy());
    
    // 4. 容器范围限定策略
    this.registerStrategy(new ContainerContextStrategy());
    
    // 5. SVG元素策略
    this.registerStrategy(new SVGStrategy());
    
    // 6. Shadow DOM策略
    this.registerStrategy(new ShadowDOMStrategy());
    
    // 7. 相对位置策略
    this.registerStrategy(new RelativeStrategy());
    
    // 8. CSS Selector策略（作为回退方案）
    this.registerStrategy(new CSSStrategy());
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
   * 为元素生成XPath（传统模式）
   * @param {Element} element - 目标元素
   * @param {Object} options - 选项
   * @returns {Object} 生成结果
   */
  generateXPath(element, options = {}) {
    return this.internalGenerateXPath(element, options, false);
  }

  /**
   * 为元素生成XPath（AI辅助模式）
   * @param {Element} element - 目标元素
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 生成结果
   */
  async generateXPathWithAI(element, options = {}) {
    return this.internalGenerateXPath(element, options, true);
  }

  /**
   * 内部XPath生成方法
   * @param {Element} element - 目标元素
   * @param {Object} options - 选项
   * @param {boolean} preferAI - 是否优先使用AI
   * @returns {Promise<Object>|Object} 生成结果
   */
  async internalGenerateXPath(element, options = {}, preferAI = false) {
    const context = this.buildContext(element, options);
    const results = [];
    
    // 检查是否包含随机类名，如果是则降低属性策略优先级
    const hasRandomClasses = this.hasRandomClasses(element);
    
    // 如果需要AI优先，先尝试AI策略
    if (preferAI) {
      console.log('开始尝试AI策略...');
      const aiStrategy = this.strategies.find(s => s.name === 'ai');
      
      if (aiStrategy) {
        console.log('AI策略找到，检查适用性:', aiStrategy.isApplicable(element, context));
        
        if (aiStrategy.isApplicable(element, context)) {
          try {
            const aiResult = await aiStrategy.generate(element, context);
            console.log('AI策略返回结果:', aiResult);
            
            if (aiResult.success) {
              return {
                success: true,
                primary: {
                  strategy: aiResult.strategy,
                  xpath: aiResult.xpath,
                  score: aiResult.score,
                  metadata: aiResult.metadata
                },
                alternatives: [],
                context: context
              };
            } else {
              // AI策略失败，返回错误信息
              return {
                success: false,
                error: aiResult.error,
                needsConfiguration: aiResult.needsConfiguration || false,
                element: element
              };
            }
          } catch (error) {
            console.warn('AI策略执行失败:', error);
            // 如果AI失败，返回错误信息
            return {
              success: false,
              error: error.message,
              needsConfiguration: false,
              element: element
            };
          }
        } else {
          console.log('AI策略不适用于当前元素');
        }
      } else {
        console.log('未找到AI策略');
      }
    }
    
    // 检查是否为SVG元素，如果是则优先使用SVG策略以避免冲突
    const isSVGElement = context.analysis?.basic?.isSVG;
    if (isSVGElement && !preferAI) {
      console.log('检测到SVG元素，优先使用SVG策略...');
      const svgStrategy = this.strategies.find(s => s.name === 'svg');
      
      if (svgStrategy && svgStrategy.isApplicable(element, context)) {
        try {
          const xpath = svgStrategy.generate(element, context);
          if (xpath) {
            const result = {
              success: true,
              xpath: xpath,
              score: svgStrategy.getScore(element, context),
              strategy: svgStrategy.name
            };
            
            return {
              success: true,
              primary: {
                strategy: result.strategy,
                xpath: result.xpath,
                score: result.score,
                priority: svgStrategy.priority
              },
              alternatives: [],
              context: context
            };
          }
        } catch (error) {
          console.warn('SVG策略执行失败:', error);
          // SVG策略失败，继续尝试其他策略
        }
      }
    }
    
    // 尝试每个适用的策略（除了AI策略和SVG策略）
    for (const strategy of this.strategies) {
      // 如果是AI策略且不是优先模式，则跳过
      if (strategy.name === 'ai' && !preferAI) {
        continue;
      }
      
      // 如果是SVG元素且已经尝试过SVG策略，跳过其他策略以避免冲突
      if (isSVGElement && strategy.name !== 'svg' && !preferAI) {
        continue;
      }
      
      try {
        if (strategy.isApplicable(element, context)) {
          let result;
          if (strategy.name === 'ai') {
            result = await strategy.generate(element, context);
          } else {
            const xpath = strategy.generate(element, context);
            if (xpath) {
              result = {
                success: true,
                xpath: xpath,
                score: strategy.getScore(element, context),
                strategy: strategy.name
              };
            }
          }
          
          if (result && result.success) {
            let score = result.score;
            
            // 如果检测到随机类名，降低属性策略分数
            if (hasRandomClasses && strategy.name === 'attribute') {
              score -= 50;
            }
            
            results.push({
              strategy: result.strategy,
              xpath: result.xpath,
              score: score,
              priority: strategy.priority,
              metadata: result.metadata || {}
            });
            
            // 对于高优先级策略，如果分数足够高，直接返回
            if (strategy.priority >= 80 && score >= 80) {
              break;
            }
          }
        }
      } catch (error) {
        console.warn(`策略 ${strategy.name} 执行失败:`, error);
        continue;
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
    
    // 处理不同类型的className（字符串或SVGAnimatedString等）
    let classNameStr;
    if (typeof element.className === 'string') {
      classNameStr = element.className;
    } else if (element.className.baseVal !== undefined) {
      // SVG元素的className是SVGAnimatedString类型
      classNameStr = element.className.baseVal;
    } else if (element.className.toString) {
      classNameStr = element.className.toString();
    } else {
      return false;
    }
    
    if (!classNameStr || typeof classNameStr !== 'string') {
      return false;
    }
    
    const classes = classNameStr.split(/\s+/).filter(cls => cls.length > 0);
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