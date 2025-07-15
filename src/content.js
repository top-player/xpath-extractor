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
      });
  
      console.log('XPath获取器已加载');
    }
  
    async handleMessage(request, sender, sendResponse) {
      try {
        if (request.action === 'generateXPath') {
          await this.generateAndCopyXPath(request.data);
          sendResponse({ success: true });
        }
      } catch (error) {
        console.error('处理消息失败:', error);
        // 不再显示错误通知，因为已在generateAndCopyXPath中处理
        sendResponse({ success: false, error: error.message });
      }
    }
  
    async generateAndCopyXPath(data) {
      let targetElement = this.lastClickedElement;
      
      // 如果没有记录的元素，尝试根据坐标查找
      if (!targetElement && data.x !== undefined && data.y !== undefined) {
        targetElement = document.elementFromPoint(data.x, data.y);
      }
  
      if (!targetElement) {
        this.notificationSystem.showXPathError('未找到目标元素');
        return;
      }
  
      // 生成XPath
      const result = await this.generator.generateXPath(targetElement);
      
      if (!result.success) {
        // 显示友好的错误提示而不是抛出错误
        this.notificationSystem.showXPathError(result.error || '未能提取有效的XPath');
        
        // 发送错误消息到背景脚本
        chrome.runtime.sendMessage({
          action: 'xpathError',
          data: {
            error: result.error || '未能提取有效的XPath',
            element: result.element
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
          this.notificationSystem.showXPathCopied(xpath, {
            strategy: result.primary.strategy,
            score: result.primary.score
          });
          
          // 发送成功消息到背景脚本
          chrome.runtime.sendMessage({
            action: 'xpathGenerated',
            data: {
              xpath: xpath,
              strategy: result.primary.strategy,
              element: result.element
            }
          });
          
          console.log('XPath已生成并复制:', {
            xpath: xpath,
            strategy: result.primary.strategy,
            alternatives: result.alternatives.length
          });
        } else {
          this.notificationSystem.showXPathError('复制到剪贴板失败');
        }
      } catch (error) {
        console.error('复制XPath时出错:', error);
        this.notificationSystem.showXPathError('复制到剪贴板失败');
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