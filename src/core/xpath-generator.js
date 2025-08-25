/**
 * XPath生成器
 * 协调策略管理器和元素分析器生成最优XPath
 */
class XPathGenerator {
  constructor() {
    this.strategyManager = new StrategyManager();
    this.elementAnalyzer = new ElementAnalyzer();
    this.cache = new Map();
    this.cacheTimeout = 10000; // 10秒缓存
  }

  /**
   * 为元素生成XPath（传统模式）
   * @param {Element} element - 目标元素
   * @param {Object} options - 生成选项
   * @returns {Object} 生成结果
   */
  async generateXPath(element, options = {}) {
    return this.internalGenerateXPath(element, options, false);
  }

  /**
   * 为元素生成XPath（AI辅助模式）
   * @param {Element} element - 目标元素
   * @param {Object} options - 生成选项
   * @returns {Promise<Object>} 生成结果
   */
  async generateXPathWithAI(element, options = {}) {
    return this.internalGenerateXPath(element, options, true);
  }

  /**
   * 内部XPath生成方法
   * @param {Element} element - 目标元素
   * @param {Object} options - 生成选项
   * @param {boolean} useAI - 是否使用AI模式
   * @returns {Promise<Object>} 生成结果
   */
  async internalGenerateXPath(element, options = {}, useAI = false) {
    if (!element || !element.tagName) {
      return {
        success: false,
        error: '无效的元素',
        primary: null,
        alternatives: [],
        element: null,
        timestamp: Date.now()
      };
    }

    // 检查缓存
    const cacheKey = this.generateCacheKey(element, useAI);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log(`缓存命中: ${useAI ? 'AI模式' : '传统模式'} | 键: ${cacheKey.substring(0, 50)}...`);
      console.log(`缓存统计:`, this.getCacheStats());
      return cached.data;
    }

    try {
      // 分析元素，传递useAI参数以确保缓存分离
      const analysis = this.elementAnalyzer.analyze(element, { useAI });
      
      // 生成XPath，传递分析结果
      let result;
      if (useAI) {
        result = await this.strategyManager.generateXPathWithAI(element, {
          ...options,
          analysis: analysis
        });
      } else {
        result = await this.strategyManager.generateXPath(element, {
          ...options,
          analysis: analysis
        });
      }
      
      if (result.success) {
        // 增强结果信息
        const enhancedResult = {
          ...result,
          element: {
            tagName: element.tagName.toLowerCase(),
            text: Utils.getVisibleText(element),
            id: element.id,
            className: element.className
          },
          analysis: analysis,
          timestamp: Date.now()
        };

        // 缓存结果，使用包含模式信息的缓存键
        this.cache.set(cacheKey, {
          data: enhancedResult,
          timestamp: Date.now(),
          mode: useAI ? 'ai' : 'traditional'
        });
        
        console.log(`缓存存储: ${useAI ? 'AI模式' : '传统模式'} | 策略: ${result.primary?.strategy} | 键: ${cacheKey.substring(0, 50)}...`);
        console.log(`缓存统计:`, this.getCacheStats());

        // 清理过期缓存
        this.cleanupCache();

        return enhancedResult;
      } else {
        // 尝试降级策略：生成基本的位置XPath
        try {
          const fallbackXPath = this.generateFallbackXPath(element);
          if (fallbackXPath) {
            return {
              success: true,
              primary: {
                strategy: 'fallback',
                xpath: fallbackXPath,
                score: 1,
                priority: 0
              },
              alternatives: [],
              element: {
                tagName: element.tagName.toLowerCase(),
                text: Utils.getVisibleText(element),
                id: element.id,
                className: element.className
              },
              analysis: analysis,
              timestamp: Date.now()
            };
          }
        } catch (fallbackError) {
          console.warn('降级策略也失败了:', fallbackError);
        }
        
        // 所有策略都失败，返回失败结果而不是抛出错误
        return {
          success: false,
          error: '未能提取有效的XPath，该元素可能缺乏唯一标识符',
          primary: null,
          alternatives: [],
          element: {
            tagName: element.tagName.toLowerCase(),
            text: Utils.getVisibleText(element),
            id: element.id,
            className: element.className
          },
          analysis: analysis,
          timestamp: Date.now()
        };
      }
    } catch (error) {
      console.error('XPath生成过程中出现错误:', error);
      return {
        success: false,
        error: `XPath提取失败: ${error.message}`,
        primary: null,
        alternatives: [],
        element: {
          tagName: element.tagName.toLowerCase(),
          text: Utils.getVisibleText(element),
          id: element.id,
          className: element.className
        },
        timestamp: Date.now()
      };
    }
  }

  /**
   * 生成降级XPath（基于位置）
   * @param {Element} element - 目标元素
   * @returns {string} XPath表达式
   */
  generateFallbackXPath(element) {
    const path = [];
    let current = element;

    while (current && current !== document.body) {
      const tagName = current.tagName.toLowerCase();
      const index = Utils.getElementIndex(current);
      
      if (current.id) {
        path.unshift(`//${tagName}[@id='${current.id}']`);
        break;
      } else {
        path.unshift(`${tagName}[${index}]`);
      }
      
      current = current.parentElement;
    }

    return path.length > 0 ? '/' + path.join('/') : `//${element.tagName.toLowerCase()}`;
  }

  /**
   * 验证XPath的有效性和唯一性
   * @param {string} xpath - XPath表达式
   * @param {Element} targetElement - 目标元素
   * @returns {Object} 验证结果
   */
  validateXPath(xpath, targetElement) {
    try {
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );

      const matchCount = result.snapshotLength;
      const isUnique = matchCount === 1;
      const isCorrect = matchCount > 0 && result.snapshotItem(0) === targetElement;

      return {
        valid: true,
        unique: isUnique,
        correct: isCorrect,
        matchCount: matchCount,
        message: isCorrect ? '验证成功' : 'XPath不匹配目标元素'
      };
    } catch (error) {
      return {
        valid: false,
        unique: false,
        correct: false,
        matchCount: 0,
        message: `XPath语法错误: ${error.message}`
      };
    }
  }

  /**
   * 生成缓存键
   * @param {Element} element - DOM元素
   * @param {boolean} useAI - 是否使用AI模式
   * @returns {string} 缓存键
   */
  generateCacheKey(element, useAI = false) {
    const path = this.elementAnalyzer.getElementPath(element);
    const attrHash = this.elementAnalyzer.hashAttributes(element);
    const mode = useAI ? 'ai' : 'traditional';
    return `${mode}_${path}_${attrHash}`;
  }

  /**
   * 清理过期缓存
   */
  cleanupCache() {
    const now = Date.now();
    let cleanedCount = 0;
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }
    if (cleanedCount > 0) {
      console.log(`清理了 ${cleanedCount} 个过期缓存项`);
    }
  }

  /**
   * 清空缓存
   */
  clearCache() {
    const size = this.cache.size;
    this.cache.clear();
    
    // 同时清理元素分析器的缓存
    this.elementAnalyzer.clearCache();
    
    console.log(`XPath生成器清空了 ${size} 个缓存项`);
  }
  
  /**
   * 清理指定模式的缓存
   * @param {string} mode - 模式: 'ai' 或 'traditional'
   */
  clearCacheByMode(mode) {
    let cleanedCount = 0;
    for (const [key] of this.cache.entries()) {
      if (key.startsWith(`${mode}_`)) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }
    
    // 同时清理元素分析器的缓存
    this.elementAnalyzer.clearCacheByMode(mode);
    
    console.log(`XPath生成器清理了 ${cleanedCount} 个 ${mode === 'ai' ? 'AI模式' : '传统模式'}缓存项`);
  }
  
  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计
   */
  getCacheStats() {
    const xpathStats = {
      total: this.cache.size,
      traditional: 0,
      ai: 0,
      expired: 0
    };
    
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        xpathStats.expired++;
      } else if (key.startsWith('ai_')) {
        xpathStats.ai++;
      } else if (key.startsWith('traditional_')) {
        xpathStats.traditional++;
      }
    }
    
    // 合并元素分析器的缓存统计
    const analyzerStats = this.elementAnalyzer.getCacheStats();
    
    return {
      xpath: xpathStats,
      analyzer: analyzerStats,
      total: xpathStats.total + analyzerStats.total,
      traditional: xpathStats.traditional + analyzerStats.traditional,
      ai: xpathStats.ai + analyzerStats.ai,
      expired: xpathStats.expired + analyzerStats.expired
    };
  }

  /**
   * 获取生成器统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      cache: this.getCacheStats(),
      strategy: this.strategyManager.getStats()
    };
  }
}