/**
 * XPath生成策略基类
 * 定义所有策略的通用接口
 */
if (typeof BaseStrategy === 'undefined') {
  class BaseStrategy {
    constructor(name, priority = 0) {
      this.name = name;
      this.priority = priority; // 优先级，数值越高优先级越高
    }

    /**
     * 检查策略是否适用于给定元素
     * @param {Element} element - DOM元素
     * @param {Object} context - 上下文信息
     * @returns {boolean} 是否适用
     */
    isApplicable(element, context) {
      throw new Error('子类必须实现 isApplicable 方法');
    }

    /**
     * 生成XPath
     * @param {Element} element - DOM元素
     * @param {Object} context - 上下文信息
     * @returns {string|null} 生成的XPath或null
     */
    generate(element, context) {
      throw new Error('子类必须实现 generate 方法');
    }

    /**
     * 验证生成的XPath是否唯一
     * @param {string} xpath - XPath表达式
     * @param {Element} targetElement - 目标元素
     * @returns {boolean} 是否唯一
     */
    validateXPath(xpath, targetElement) {
      try {
        const result = document.evaluate(
          xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        return result.singleNodeValue === targetElement;
      } catch (error) {
        console.warn(`XPath验证失败: ${xpath}`, error);
        return false;
      }
    }

    /**
     * 获取策略的权重分数
     * @param {Element} element - DOM元素
     * @param {Object} context - 上下文信息
     * @returns {number} 权重分数
     */
    getScore(element, context) {
      return this.priority;
    }
  }
  
  window.BaseStrategy = BaseStrategy;
}