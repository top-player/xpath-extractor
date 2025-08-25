/**
 * AI配置管理器
 * 负责管理AI相关的配置和验证
 */

if (typeof AIConfig === 'undefined') {
  class AIConfig {
    constructor() {
      this.config = {
        apiKey: '',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-3.5-turbo',
        temperature: 0.1
      };
      this.isLoaded = false;
    }

    /**
     * 异步加载配置
     */
    async loadConfig() {
      try {
        console.log('开始加载AI配置...');
        
        const result = await chrome.storage.sync.get([
          'aiApiKey',
          'aiBaseUrl',
          'aiModel', 
          'aiTemperature'
        ]);

        console.log('原始配置数据:', {
          hasApiKey: !!result.aiApiKey,
          baseUrl: result.aiBaseUrl,
          model: result.aiModel,
          temperature: result.aiTemperature
        });

        this.config = {
          apiKey: result.aiApiKey || '',
          baseUrl: result.aiBaseUrl || 'https://api.openai.com/v1',
          model: result.aiModel || 'gpt-3.5-turbo',
          temperature: result.aiTemperature || 0.1
        };

        this.isLoaded = true;
        
        console.log('AI配置加载完成:', {
          ...this.config,
          apiKey: this.config.apiKey ? '***masked***' : ''
        });
        
        console.log('配置状态:', this.getStatus());

        return this.config;
      } catch (error) {
        console.error('加载AI配置失败:', error);
        this.isLoaded = false;
        throw new Error('AI配置加载失败');
      }
    }

    /**
     * 获取当前配置
     */
    getConfig() {
      return { ...this.config };
    }

    /**
     * 检查配置是否完整
     */
    isConfigured() {
      return this.isLoaded && 
             !!this.config.apiKey && 
             !!this.config.baseUrl && 
             !!this.config.model;
    }

    /**
     * 验证配置有效性
     */
    validateConfig() {
      const errors = [];

      if (!this.config.apiKey) {
        errors.push('API Key 未配置');
      }

      if (!this.config.baseUrl) {
        errors.push('Base URL 未配置');
      } else {
        try {
          new URL(this.config.baseUrl);
        } catch {
          errors.push('Base URL 格式无效');
        }
      }

      if (!this.config.model) {
        errors.push('模型名称未配置');
      }

      if (this.config.temperature < 0 || this.config.temperature > 2) {
        errors.push('Temperature 必须在 0-2 之间');
      }

      return {
        isValid: errors.length === 0,
        errors: errors
      };
    }

    /**
     * 获取配置状态信息
     */
    getStatus() {
      const validation = this.validateConfig();
      return {
        isLoaded: this.isLoaded,
        isConfigured: this.isConfigured(),
        isValid: validation.isValid,
        errors: validation.errors,
        hasApiKey: !!this.config.apiKey,
        model: this.config.model,
        baseUrl: this.config.baseUrl
      };
    }

    /**
     * 检查是否需要打开配置页面
     */
    shouldOpenSettings() {
      return !this.isConfigured() || !this.validateConfig().isValid;
    }

    /**
     * 打开配置页面
     */
    openSettings() {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL('options.html'));
      }
    }

    /**
     * 构建AI请求参数
     */
    buildRequestOptions(messages, options = {}) {
      if (!this.isConfigured()) {
        throw new Error('AI配置未完成，请先在设置中配置API信息');
      }

      const validation = this.validateConfig();
      if (!validation.isValid) {
        throw new Error('AI配置无效: ' + validation.errors.join(', '));
      }

      return {
        url: `${this.config.baseUrl}/chat/completions`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: messages,
          temperature: this.config.temperature,
          max_tokens: options.maxTokens || 150,
          ...options
        })
      };
    }

    /**
     * 创建用于XPath生成的系统提示
     */
    createXPathSystemPrompt() {
      return {
        role: 'system',
        content: `你是一个专业的网页元素定位专家，专门生成简洁高效的XPath表达式。

任务：基于提供的DOM结构，为目标元素生成最简洁、最稳定的相对XPath路径。

生成原则（按优先级排序）：
1. **最高优先级 - 独特文本内容**：
   - 如果元素有独特文本，直接使用：//tag[text()='文本']
   - 或者使用contains：//tag[contains(text(), '关键词')]

2. **次高优先级 - 独特ID属性**：
   - 如果有稳定的id：//tag[@id='value']

3. **中等优先级 - 独特语义属性**：
   - name: //tag[@name='value']
   - data-*: //tag[@data-testid='value']
   - role: //tag[@role='value']

4. **较低优先级 - 稳定的class**：
   - 只使用语义化、非动态的class
   - 避免使用哈希值、随机生成的class

5. **最后手段 - 最小必要路径**：
   - 只在必要时才使用父级路径来消除歧义

重要约束：
- **绝对优先简洁性**：能用//a[text()='文本']就不用复杂路径
- **避免冗余层级**：不要包含不必要的父级元素
- **避免位置选择器**：不使用[1]、[last()]等位置索引
- **优先属性选择**：属性选择器比路径导航更稳定

输出格式：
直接返回XPath表达式，不需要其他说明文字。

优秀示例：
//a[text()='首页']
//button[@data-action='submit']
//input[@name='username']
//div[@role='dialog']//button[text()='确定']`
      };
    }

    /**
     * 创建用户消息
     */
    createUserMessage(domTree, targetElementId) {
      return {
        role: 'user',
        content: `请为以下DOM结构中的目标元素生成最简洁的XPath表达式：

目标元素ID: ${targetElementId}

DOM结构：
${JSON.stringify(domTree, null, 2)}

重要要求：
1. 优先考虑使用目标元素的text()内容进行定位
2. 如果文本内容独特，直接使用//tag[text()='内容']形式
3. 只在必要时才添加父级路径来消除歧义
4. 避免使用位置索引如[1]、[last()]等
5. 生成的XPath应该尽可能简短且稳定

请生成最优的简洁XPath表达式。`
      };
    }
  }

  window.AIConfig = AIConfig;
}