/**
 * AI XPath生成策略
 * 使用AI模型生成优化的XPath表达式
 */

if (typeof AIStrategy === 'undefined') {
  class AIStrategy extends BaseStrategy {
    constructor() {
      super('ai', 10); // 最高优先级
      this.aiConfig = new AIConfig();
      this.domSimplifier = new DOMSimplifier();
      this.requestTimeout = 60000; // 60秒超时，更合理的超时时间
      this.maxRetries = 1; // 最大重试次数
    }

    /**
     * 检查策略是否可用
     * @param {Element} element - 目标元素
     * @returns {boolean} 是否可用
     */
    isApplicable(element) {
      // AI策略始终可用，在generate方法中检查配置
      return element && element.nodeType === Node.ELEMENT_NODE;
    }

    /**
     * 生成XPath
     * @param {Element} element - 目标元素
     * @returns {Promise<Object>} 生成结果
     */
    async generate(element) {
      try {
        console.log('AI策略开始生成XPath...');
        
        // 加载AI配置
        await this.aiConfig.loadConfig();
        
        console.log('AI配置加载结果:', this.aiConfig.getStatus());
        
        if (!this.aiConfig.isConfigured()) {
          console.log('AI配置未完成');
          return {
            success: false,
            error: 'AI配置未完成，请在扩展选项中配置API信息',
            strategy: this.name,
            needsConfiguration: true
          };
        }

        console.log('开始简化DOM树...');
        // 简化DOM树
        const simplifiedDOM = this.domSimplifier.generateSimplifiedDOM(element);
        
        console.log('DOM树简化完成:', simplifiedDOM);
        
        // 验证DOM树大小
        const validation = this.domSimplifier.validateSimplifiedDOM(simplifiedDOM);
        if (!validation.isValid) {
          console.warn('DOM树验证警告:', validation.issues);
        }

        console.log('开始调用AI生成XPath...');
        // 生成AI请求
        const xpath = await this.generateXPathWithAI(simplifiedDOM);
        
        console.log('AI返回的XPath:', xpath);
        
        if (!xpath) {
          throw new Error('AI未能生成有效的XPath');
        }

        console.log('开始验证XPath...');
        // 验证生成的XPath
        const validationResult = this.validateXPath(xpath, element);
        
        console.log('XPath验证结果:', validationResult);
        
        // 如果AI生成的XPath质量不高，考虑使用CSS selector作为回退
        let finalSelector = xpath;
        let selectorType = 'xpath';
        let score = validationResult.isValid ? 10 : 5;
        
        // 检查XPath质量，如果不理想则回退到CSS selector
        if (!validationResult.isValid || this.isLowQualityXPath(xpath)) {
          console.log('AI生成的XPath质量不高，尝试CSS selector回退...');
          const cssSelector = this.generateCSSFallback(element);
          
          if (cssSelector) {
            const cssValidation = this.validateCSSSelector(cssSelector, element);
            if (cssValidation.isValid) {
              console.log('使用CSS selector作为回退方案:', cssSelector);
              finalSelector = cssSelector;
              selectorType = 'css';
              score = cssValidation.isUnique ? 8 : 6;
            }
          }
        }
        
        return {
          success: true,
          xpath: finalSelector,
          score: score,
          strategy: this.name,
          metadata: {
            aiGenerated: true,
            selectorType: selectorType,
            domNodeCount: validation.nodeCount,
            isValid: selectorType === 'xpath' ? validationResult.isValid : true,
            aiModel: this.aiConfig.getConfig().model,
            fallbackUsed: selectorType === 'css'
          }
        };
        
      } catch (error) {
        console.error('AI策略生成失败:', error);
        return {
          success: false,
          error: error.message,
          strategy: this.name,
          needsConfiguration: error.message.includes('配置未完成')
        };
      }
    }

    /**
     * 使用AI生成XPath
     * @param {Object} simplifiedDOM - 简化的DOM树
     * @returns {Promise<string>} 生成的XPath
     */
    async generateXPathWithAI(simplifiedDOM) {
      let lastError = null;
      
      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            console.log(`AI请求重试第 ${attempt} 次...`);
            // 重试时等待一个短暂的时间
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // 构建请求消息
          const messages = [
            this.aiConfig.createXPathSystemPrompt(),
            this.aiConfig.createUserMessage(simplifiedDOM.tree, simplifiedDOM.targetElementId)
          ];

          // 构建请求选项
          const requestOptions = this.aiConfig.buildRequestOptions(messages, {
            maxTokens: 100,  // 减少token数量，鼓励简洁输出
            temperature: 0.4 // 降低随机性，获得更一致的简洁结果
          });

          // 发送AI请求
          const response = await this.sendAIRequest(requestOptions);
          
          if (!response.choices || response.choices.length === 0) {
            throw new Error('AI响应格式错误：缺少choices');
          }

          const xpath = response.choices[0].message?.content?.trim();
          if (!xpath) {
            throw new Error('AI未返回有效的XPath内容');
          }

          // 后处理优化XPath
          const optimizedXPath = this.optimizeXPath(xpath);
          console.log('AI生成的XPath:', xpath);
          if (optimizedXPath !== xpath) {
            console.log('优化后的XPath:', optimizedXPath);
          }
          return optimizedXPath;

        } catch (error) {
          lastError = error;
          console.error(`AI请求尝试 ${attempt + 1} 失败:`, error.message);
          
          // 如果是配置错误或验证错误，不重试
          if (error.message.includes('401') || error.message.includes('403') || 
              error.message.includes('配置') || error.message.includes('格式错误')) {
            break;
          }
          
          // 如果是最后一次尝试，抛出错误
          if (attempt === this.maxRetries) {
            break;
          }
        }
      }
      
      // 所有重试都失败，抛出最后一个错误
      throw new Error(`AI请求失败 (尝试${this.maxRetries + 1}次): ${lastError.message}`);
    }

    /**
     * 发送AI请求
     * @param {Object} requestOptions - 请求选项
     * @returns {Promise<Object>} AI响应
     */
    async sendAIRequest(requestOptions) {
      console.log('开始发送AI请求...');
      
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const timeoutId = setTimeout(() => {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.error(`AI请求超时: ${elapsed}秒`);
          reject(new Error(`AI请求超时（${elapsed}秒）。请检查网络连接或尝试更换API地址。`));
        }, this.requestTimeout);

        fetch(requestOptions.url, {
          method: requestOptions.method,
          headers: requestOptions.headers,
          body: requestOptions.body
        })
        .then(async (response) => {
          clearTimeout(timeoutId);
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`AI请求完成: ${elapsed}秒, 状态: ${response.status}`);
          
          if (!response.ok) {
            const errorText = await response.text().catch(() => '未知错误');
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            
            try {
              const errorData = JSON.parse(errorText);
              if (errorData.error?.message) {
                errorMessage = errorData.error.message;
              }
            } catch (e) {
              // 解析失败，使用原始错误信息
            }
            
            // 根据不同的HTTP状态码提供不同的建议
            if (response.status === 401) {
              errorMessage += ' - 请检查API Key是否正确';
            } else if (response.status === 403) {
              errorMessage += ' - API Key没有权限或额度不足';
            } else if (response.status === 429) {
              errorMessage += ' - 请求过于频繁，请稍后重试';
            } else if (response.status >= 500) {
              errorMessage += ' - AI服务器错误，请稍后重试';
            }
            
            reject(new Error(errorMessage));
            return;
          }

          const data = await response.json();
          console.log('AI响应数据获取成功');
          resolve(data);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          
          if (error.name === 'AbortError') {
            reject(new Error(`请求被取消（${elapsed}秒）`));
          } else if (error.message.includes('Failed to fetch')) {
            reject(new Error(`网络连接失败，请检查网络或Base URL是否正确（${elapsed}秒）`));
          } else {
            reject(new Error(`网络请求失败: ${error.message}（${elapsed}秒）`));
          }
        });
      });
    }

    /**
     * 验证生成的XPath
     * @param {string} xpath - 生成的XPath
     * @param {Element} targetElement - 目标元素
     * @returns {Object} 验证结果
     */
    validateXPath(xpath, targetElement) {
      try {
        if (!xpath || typeof xpath !== 'string') {
          return { isValid: false, error: 'XPath为空或格式错误' };
        }

        // 清理XPath（移除可能的代码块标记）
        const cleanXPath = this.cleanGeneratedXPath(xpath);
        
        // 执行XPath查询
        const result = document.evaluate(
          cleanXPath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );

        if (!result.singleNodeValue) {
          return { isValid: false, error: 'XPath未找到任何元素' };
        }

        // 检查是否匹配目标元素
        const isMatch = result.singleNodeValue === targetElement;
        
        return {
          isValid: isMatch,
          error: isMatch ? null : 'XPath匹配的元素与目标元素不一致',
          foundElement: result.singleNodeValue,
          cleanXPath: cleanXPath
        };

      } catch (error) {
        return {
          isValid: false,
          error: `XPath语法错误: ${error.message}`
        };
      }
    }

    /**
     * 优化XPath表达式
     * @param {string} xpath - 原始XPath
     * @returns {string} 优化后的XPath
     */
    optimizeXPath(xpath) {
      let optimized = xpath.trim();
      
      // 1. 移除不必要的绝对路径前缀
      optimized = optimized.replace(/^\/+/, '//');
      
      // 2. 简化连续的相同标签路径
      // 例如：//div//div[@class='item'] -> //div[@class='item']
      optimized = optimized.replace(/\/\/([a-zA-Z]+)\/\/\1(?=\[)/g, '//$1');
      
      // 3. 移除凗余的位置选择器
      // 如果已经有其他唯一标识，移除[1]、[last()]等
      if (optimized.includes('@') || optimized.includes('text()')) {
        optimized = optimized.replace(/\[1\]/g, '').replace(/\[last\(\)\]/g, '');
      }
      
      // 4. 简化class选择器，如果只有一个class且看起来独特，移除contains
      optimized = optimized.replace(/contains\(@class,\s*['"]([^'"\s]+)['"]\)/g, (match, className) => {
        // 如果类名看起来很独特（超过5个字符且不是常见单词）
        const commonWords = ['nav', 'menu', 'item', 'list', 'btn', 'link', 'content', 'main', 'header', 'footer'];
        if (className.length > 5 && !commonWords.includes(className.toLowerCase())) {
          return `@class='${className}'`;
        }
        return match;
      });
      
      // 5. 简化嵌套的相同属性选择器
      // 例如：//div[@class='nav']//div[@class='nav'] -> //div[@class='nav']
      const attrPattern = /\/\/([a-zA-Z]+)\[@([^\]]+)\]\/\/\1\[@\2\]/g;
      optimized = optimized.replace(attrPattern, '//$1[@$2]');
      
      return optimized;
    }

    /**
     * 清理AI生成的XPath
     * @param {string} rawXPath - 原始XPath
     * @returns {string} 清理后的XPath
     */
    cleanGeneratedXPath(rawXPath) {
      let cleaned = rawXPath.trim();
      
      // 移除代码块标记
      cleaned = cleaned.replace(/^```(?:xpath)?\s*/, '');
      cleaned = cleaned.replace(/\s*```$/, '');
      
      // 移除多余的引号
      cleaned = cleaned.replace(/^["']|["']$/g, '');
      
      // 移除换行符和多余空格
      cleaned = cleaned.replace(/\s+/g, ' ').trim();
      
      return cleaned;
    }

    /**
     * 获取策略状态
     * @returns {Object} 状态信息
     */
    getStatus() {
      const aiStatus = this.aiConfig.getStatus();
      return {
        name: this.name,
        isAvailable: this.aiConfig.isConfigured(),
        aiConfig: aiStatus,
        domSimplifier: this.domSimplifier.getConfig()
      };
    }

    /**
     * 处理配置错误的情况
     * @returns {Object} 错误结果
     */
    handleConfigurationError() {
      return {
        success: false,
        error: 'AI配置未完成，请在扩展选项中配置API信息',
        strategy: this.name,
        needsConfiguration: true
      };
    }

    /**
     * 快速检查是否需要打开设置
     * @returns {boolean} 是否需要设置
     */
    needsConfiguration() {
      return this.aiConfig.shouldOpenSettings();
    }

    /**
     * 打开配置页面
     */
    openConfiguration() {
      this.aiConfig.openSettings();
    }
    
    /**
     * 检查XPath是否为低质量（过于复杂或不稳定）
     * @param {string} xpath - 生成的XPath
     * @returns {boolean} 是否为低质量XPath
     */
    isLowQualityXPath(xpath) {
      if (!xpath) return true;
      
      // 检查过于复杂的特征
      const qualityChecks = [
        xpath.length > 200, // 过长
        (xpath.match(/\[\d+\]/g) || []).length > 3, // 过多的位置选择器
        (xpath.match(/\/\//g) || []).length > 5, // 过多的全局搜索
        xpath.includes('descendant::'), // 使用了复杂轴
        xpath.includes('ancestor::'),
        xpath.includes('following-sibling::') && xpath.includes('preceding-sibling::'), // 同时使用多个轴
        /\/\*\[\d+\]\/\*\[\d+\]\/\*\[\d+\]/.test(xpath), // 连续多个位置选择器
      ];
      
      // 如果满足多个低质量条件，认为是低质量的
      const lowQualityCount = qualityChecks.filter(check => check).length;
      return lowQualityCount >= 2;
    }
    
    /**
     * 生成CSS selector作为回退方案
     * @param {Element} element - 目标元素
     * @returns {string|null} CSS selector
     */
    generateCSSFallback(element) {
      const selectors = [];
      
      try {
        // 1. 基于ID的选择器
        if (element.id && Utils.isValidId(element.id)) {
          selectors.push(`#${CSS.escape(element.id)}`);
        }
        
        // 2. 基于唯一属性的选择器
        for (const attr of element.attributes) {
          if (attr.name === 'id' || attr.name === 'class' || attr.name === 'style') continue;
          if (Utils.isFrameworkAttribute(attr.name, attr.value)) continue;
          
          try {
            const selector = `[${attr.name}="${CSS.escape(attr.value)}"]`;
            const elements = document.querySelectorAll(selector);
            if (elements.length === 1) {
              selectors.push(selector);
              selectors.push(`${element.tagName.toLowerCase()}${selector}`);
            }
          } catch (e) {
            continue;
          }
        }
        
        // 3. 基于类名的选择器
        if (element.className) {
          const filteredClasses = Utils.getFilteredClasses(element.className);
          for (const cls of filteredClasses.slice(0, 2)) {
            selectors.push(`.${CSS.escape(cls)}`);
            selectors.push(`${element.tagName.toLowerCase()}.${CSS.escape(cls)}`);
          }
        }
        
        // 4. 基于父元素的选择器
        if (element.parentElement && element.parentElement.id && Utils.isValidId(element.parentElement.id)) {
          selectors.push(`#${CSS.escape(element.parentElement.id)} > ${element.tagName.toLowerCase()}`);
        }
        
        // 5. nth-child选择器
        if (element.parentElement) {
          const siblings = Array.from(element.parentElement.children);
          const index = siblings.indexOf(element) + 1;
          selectors.push(`${element.tagName.toLowerCase()}:nth-child(${index})`);
        }
        
        // 测试每个选择器
        for (const selector of selectors) {
          const validation = this.validateCSSSelector(selector, element);
          if (validation.isValid && validation.isUnique) {
            return selector;
          }
        }
        
        // 如果没有找到合适的，返回第一个有效的
        for (const selector of selectors) {
          const validation = this.validateCSSSelector(selector, element);
          if (validation.isValid) {
            return selector;
          }
        }
        
      } catch (error) {
        console.error('CSS回退生成失败:', error);
      }
      
      return null;
    }
    
    /**
     * 验证CSS选择器
     * @param {string} selector - CSS选择器
     * @param {Element} targetElement - 目标元素
     * @returns {Object} 验证结果
     */
    validateCSSSelector(selector, targetElement) {
      try {
        const elements = document.querySelectorAll(selector);
        const isValid = elements.length > 0 && Array.from(elements).includes(targetElement);
        const isUnique = elements.length === 1;
        
        return {
          isValid: isValid,
          isUnique: isUnique,
          matchCount: elements.length
        };
      } catch (error) {
        return {
          isValid: false,
          isUnique: false,
          matchCount: 0,
          error: error.message
        };
      }
    }
  }

  window.AIStrategy = AIStrategy;
}