/**
 * 内容脚本
 * 处理页面交互和XPath生成
 */

if (typeof XPathExtension === 'undefined') {
  class XPathExtension {
    constructor() {
      this.generator = new XPathGenerator();
      this.notificationSystem = new NotificationSystem();
      this.lastClickedElement = null;
      this.isEnabled = true;
      this.isGenerating = false; // 添加生成状态标志
      
      this.init();
    }
  
    init() {
      // 监听右键点击事件
      document.addEventListener('contextmenu', (event) => {
        this.lastClickedElement = event.target;
      }, true);
  
      // 监听来自背景脚本的消息
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        this.handleMessage(request, sender, sendResponse);
        return true; // 支持异步响应
      });
  
      console.log('XPath获取器已加载');
    }
  
    async handleMessage(request, sender, sendResponse) {
      try {
        if (request.action === 'ping') {
          sendResponse({ loaded: true });
          return;
        }
        
        if (request.action === 'generateXPath') {
          await this.generateAndCopyXPath(request.data, false);
          sendResponse({ success: true });
        } else if (request.action === 'generateXPathWithAI') {
          await this.generateAndCopyXPath(request.data, true);
          sendResponse({ success: true });
        }
      } catch (error) {
        console.error('处理消息失败:', error);
        sendResponse({ success: false, error: error.message });
      }
    }
  
    async generateAndCopyXPath(data, useAI = false) {
      // 防止同时执行多个生成操作
      if (this.isGenerating) {
        console.log('正在生成XPath，忽略新请求');
        this.notificationSystem.warning('正在处理中，请稍后再试', { duration: 2000 });
        return;
      }
      
      // 设置生成状态
      this.isGenerating = true;
      
      try {
        let targetElement = this.lastClickedElement;
        
        console.log('generateAndCopyXPath 被调用:', { useAI, targetElement: !!targetElement });
        
        // 如果没有记录的元素，尝试根据坐标查找
        if (!targetElement && data.x !== undefined && data.y !== undefined) {
          targetElement = document.elementFromPoint(data.x, data.y);
          console.log('根据坐标查找元素:', { x: data.x, y: data.y, found: !!targetElement });
        }
    
        if (!targetElement) {
          this.notificationSystem.showXPathError('未找到目标元素');
          return;
        }
        
        // 在开始新的生成操作前，清理所有存在的通知
        this.clearAllNotifications();
    
        // 根据模式生成XPath
        console.log('开始生成XPath:', { useAI, targetElement: targetElement.tagName });
        
        // 如果使用AI，显示加载提示
        let loadingId = null;
        if (useAI) {
          loadingId = this.notificationSystem.showAILoading('🤖 AI正在分析元素，请稍候...');
        }
        
        const result = useAI ? 
          await this.generator.generateXPathWithAI(targetElement) :
          await this.generator.generateXPath(targetElement);
        
        // 隐藏AI加载提示
        if (loadingId) {
          this.notificationSystem.hideAILoading(loadingId);
        }
          
        console.log('XPath生成结果:', { success: result.success, strategy: result.primary?.strategy, error: result.error });
        
        if (!result.success) {
          // 显示友好的错误提示
          let errorMsg;
          
          if (useAI && result.needsConfiguration) {
            errorMsg = '请先在扩展选项中配置AI参数';
          } else if (result.error && result.error.includes('超时')) {
            errorMsg = 'AI请求超时，请检查网络或尝试传统模式';
          } else if (result.error && result.error.includes('网络')) {
            errorMsg = '网络连接失败，请检查Base URL和网络连接';
          } else if (result.error && result.error.includes('401')) {
            errorMsg = 'API Key错误，请检查配置';
          } else if (result.error && result.error.includes('429')) {
            errorMsg = '请求过于频繁，请稍后重试';
          } else {
            errorMsg = result.error || '未能提取有效的XPath';
          }
            
          this.notificationSystem.showXPathError(errorMsg);
          
          // 如果是AI配置问题，提示用户打开设置
          if (useAI && result.needsConfiguration) {
            setTimeout(() => {
              if (confirm('需要配置AI参数才能使用AI辅助功能，是否现在打开设置页面？')) {
                chrome.runtime.sendMessage({ action: 'openOptions' });
              }
            }, 1000);
          }
          
          // 发送错误消息到背景脚本
          chrome.runtime.sendMessage({
            action: 'xpathError',
            data: {
              error: errorMsg,
              element: result.element,
              useAI: useAI
            }
          });
          return;
        }
    
        if (!result.primary) {
          this.notificationSystem.showXPathError('未能生成有效的XPath表达式');
          return;
        }
    
        const xpath = result.primary.xpath;
        
        try {
          // 复制到剪贴板
          const copySuccess = await Utils.copyToClipboard(xpath);
          
          if (copySuccess) {
            // 显示成功通知
            const mode = useAI ? '🤖 AI辅助' : '传统模式';
            this.notificationSystem.showXPathCopied(xpath, {
              strategy: result.primary.strategy,
              score: result.primary.score,
              mode: mode,
              selectorType: result.primary.metadata?.selectorType || 'xpath',
              fallbackUsed: result.primary.metadata?.fallbackUsed || false
            });
            
            // 发送成功消息到背景脚本
            chrome.runtime.sendMessage({
              action: 'xpathGenerated',
              data: {
                xpath: xpath,
                strategy: result.primary.strategy,
                element: result.element,
                useAI: useAI,
                aiGenerated: result.primary.metadata?.aiGenerated || false
              }
            });
            
            console.log('XPath已生成并复制:', {
              xpath: xpath,
              strategy: result.primary.strategy,
              alternatives: result.alternatives.length,
              useAI: useAI,
              aiGenerated: result.primary.metadata?.aiGenerated || false
            });
          } else {
            // 复制失败时的友好提示
            const mode = useAI ? 'AI辅助' : '传统模式';
            this.notificationSystem.showXPathError(`${mode}生成成功，但剪贴板复制失败。XPath已显示在对话框中。`);
            
            // 仍然记录成功生成的信息
            chrome.runtime.sendMessage({
              action: 'xpathGenerated',
              data: {
                xpath: xpath,
                strategy: result.primary.strategy,
                element: result.element,
                useAI: useAI,
                aiGenerated: result.primary.metadata?.aiGenerated || false,
                copyFailed: true
              }
            });
            
            console.log('XPath已生成但复制失败:', {
              xpath: xpath,
              strategy: result.primary.strategy,
              useAI: useAI,
              reason: '剪贴板权限限制'
            });
          }
        } catch (error) {
          console.error('复制XPath时出错:', error);
          this.notificationSystem.showXPathError('复制到剪贴板失败');
        }
      } finally {
        // 确保始终释放生成状态
        this.isGenerating = false;
      }
    }
  
    /**
     * 清理所有通知
     */
    clearAllNotifications() {
      if (this.notificationSystem) {
        this.notificationSystem.clear();
      }
    }

    /**
     * 启用/禁用扩展
     * @param {boolean} enabled - 是否启用
     */
    setEnabled(enabled) {
      this.isEnabled = enabled;
      console.log(`XPath获取器${enabled ? '已启用' : '已禁用'}`);
    }
  
    /**
     * 获取扩展状态
     * @returns {Object} 状态信息
     */
    getStatus() {
      return {
        enabled: this.isEnabled,
        stats: this.generator.getStats(),
        lastElement: this.lastClickedElement ? {
          tagName: this.lastClickedElement.tagName,
          id: this.lastClickedElement.id,
          className: this.lastClickedElement.className
        } : null
      };
    }
  }
  window.XPathExtension = XPathExtension;
}

// 初始化扩展
if (typeof window !== 'undefined' && window.document) {
  // 确保DOM加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (!window.xpathExtension) {
        window.xpathExtension = new XPathExtension();
      }
    });
  } else {
    if (!window.xpathExtension) {
      window.xpathExtension = new XPathExtension();
    }
  }
}