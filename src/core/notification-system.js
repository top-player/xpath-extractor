/**
 * 通知系统
 * 管理用户通知和反馈
 */
class NotificationSystem {
  constructor() {
    this.notifications = [];
    this.container = null;
    this.maxNotifications = 5;
    this.defaultDuration = 3000;
    this.init();
  }

  init() {
    // 创建通知容器
    this.container = document.createElement('div');
    this.container.id = 'xpath-notifications';
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    document.body.appendChild(this.container);
  }

  /**
   * 显示AI加载提示
   * @param {string} message - 加载消息
   * @returns {string} 通知ID，用于后续隐藏
   */
  showAILoading(message = '🤖 AI正在分析元素，请稍候...') {
    const loadingMessage = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        "></div>
        <div>${message}</div>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    
    const id = this.info(loadingMessage, {
      duration: 0 // 不自动隐藏，需要手动隐藏
    });
    
    return id;
  }

  /**
   * 隐藏加载提示
   * @param {string} loadingId - 加载提示ID
   */
  hideAILoading(loadingId) {
    if (loadingId) {
      this.hide(loadingId);
    }
  }

  /**
   * 显示成功通知
   * @param {string} message - 通知消息
   * @param {Object} options - 选项
   * @returns {string} 通知ID
   */
  success(message, options = {}) {
    return this.show(message, 'success', options);
  }

  /**
   * 显示错误通知
   * @param {string} message - 通知消息
   * @param {Object} options - 选项
   * @returns {string} 通知ID
   */
  error(message, options = {}) {
    return this.show(message, 'error', options);
  }

  /**
   * 显示警告通知
   * @param {string} message - 通知消息
   * @param {Object} options - 选项
   * @returns {string} 通知ID
   */
  warning(message, options = {}) {
    return this.show(message, 'warning', options);
  }

  /**
   * 显示信息通知
   * @param {string} message - 通知消息
   * @param {Object} options - 选项
   * @returns {string} 通知ID
   */
  info(message, options = {}) {
    return this.show(message, 'info', options);
  }

  /**
   * 显示通知
   * @param {string} message - 通知消息
   * @param {string} type - 通知类型
   * @param {Object} options - 选项
   */
  show(message, type = 'info', options = {}) {
    const notification = this.createNotification(message, type, options);
    
    // 限制通知数量
    if (this.notifications.length >= this.maxNotifications) {
      this.removeOldest();
    }

    this.notifications.push(notification);
    this.container.appendChild(notification.element);

    // 动画显示
    requestAnimationFrame(() => {
      notification.element.style.transform = 'translateX(0)';
      notification.element.style.opacity = '1';
    });

    // 自动隐藏
    const duration = options.duration !== undefined ? options.duration : this.defaultDuration;
    if (duration > 0) {
      notification.timer = setTimeout(() => {
        this.hide(notification.id);
      }, duration);
    }

    return notification.id;
  }

  /**
   * 创建通知元素
   * @param {string} message - 通知消息
   * @param {string} type - 通知类型
   * @param {Object} options - 选项
   * @returns {Object} 通知对象
   */
  createNotification(message, type, options) {
    const id = Date.now() + Math.random();
    const element = document.createElement('div');
    
    const colors = {
      success: { bg: '#10B981', border: '#059669' },
      error: { bg: '#EF4444', border: '#DC2626' },
      warning: { bg: '#F59E0B', border: '#D97706' },
      info: { bg: '#06B6D4', border: '#0891B2' } // 蓝绿色，更适合AI加载提示
    };

    const color = colors[type] || colors.info;
    
    element.style.cssText = `
      background: ${color.bg};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      border-left: 4px solid ${color.border};
      margin-bottom: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transform: translateX(100%);
      opacity: 0;
      transition: all 0.3s ease;
      pointer-events: auto;
      cursor: pointer;
      max-width: 350px;
      word-wrap: break-word;
      font-size: 14px;
      line-height: 1.4;
    `;

    // 添加图标
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    element.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 8px;">
        <span style="font-weight: bold; font-size: 16px; margin-top: 2px; flex-shrink: 0;">${icons[type] || icons.info}</span>
        <div style="flex: 1;">${message}</div>
      </div>
    `;

    // 点击关闭
    element.addEventListener('click', () => {
      this.hide(id);
    });

    return {
      id,
      element,
      type,
      message,
      timer: null,
      timestamp: Date.now()
    };
  }

  /**
   * 隐藏通知
   * @param {string} id - 通知ID
   */
  hide(id) {
    const index = this.notifications.findIndex(n => n.id === id);
    if (index === -1) {
      return;
    }

    const notification = this.notifications[index];
    
    // 清除定时器
    if (notification.timer) {
      clearTimeout(notification.timer);
    }

    // 动画隐藏
    notification.element.style.transform = 'translateX(100%)';
    notification.element.style.opacity = '0';

    setTimeout(() => {
      if (notification.element.parentNode) {
        notification.element.parentNode.removeChild(notification.element);
      }
      this.notifications.splice(index, 1);
    }, 300);
  }

  /**
   * 移除最旧的通知
   */
  removeOldest() {
    if (this.notifications.length > 0) {
      this.hide(this.notifications[0].id);
    }
  }

  /**
   * 清除所有通知
   */
  clear() {
    // 停止所有定时器
    this.notifications.forEach(notification => {
      if (notification.timer) {
        clearTimeout(notification.timer);
      }
    });
    
    // 快速移除所有通知元素
    this.notifications.forEach(notification => {
      if (notification.element && notification.element.parentNode) {
        notification.element.parentNode.removeChild(notification.element);
      }
    });
    
    // 清空通知列表
    this.notifications = [];
  }

  /**
   * 显示XPath复制成功通知
   * @param {string} xpath - 复制的XPath或CSS selector
   * @param {Object} details - 详细信息
   */
  showXPathCopied(xpath, details = {}) {
    const strategy = details.strategy || '未知策略';
    const score = details.score || 0;
    const mode = details.mode || '默认';
    const selectorType = details.selectorType || 'xpath';
    const fallbackUsed = details.fallbackUsed || false;
    
    // 截断过长的XPath用于显示
    const displayXPath = xpath.length > 60 ? xpath.substring(0, 57) + '...' : xpath;
    
    // 根据选择器类型设置标题
    let title = 'XPath已复制';
    let typeIndicator = '';
    
    if (selectorType === 'css') {
      title = 'CSS Selector已复制';
      typeIndicator = fallbackUsed ? ' (🔄 AI回退)' : '';
    } else if (fallbackUsed) {
      typeIndicator = ' (🔄 优化后)';
    }
    
    const message = `
      <div style="margin-bottom: 8px;">
        <strong>${title}</strong> (${strategy}${typeIndicator})
      </div>
      <div style="
        background: rgba(255, 255, 255, 0.2);
        padding: 8px;
        border-radius: 4px;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 12px;
        word-break: break-all;
        line-height: 1.3;
      ">
        ${this.escapeHtml(displayXPath)}
      </div>
      ${score > 0 ? `<div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">评分: ${score} | 模式: ${mode}</div>` : ''}
    `;
    
    this.success(message, {
      duration: 4000 // 延长显示时间以便用户查看XPath
    });
  }

  /**
   * 转义HTML特殊字符
   * @param {string} text - 要转义的文本
   * @returns {string} 转义后的文本
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 显示XPath生成失败通知
   * @param {string} reason - 失败原因
   */
  showXPathError(reason = '未能提取有效的XPath') {
    const message = `
      <div style="margin-bottom: 8px;">
        <strong>XPath提取失败</strong>
      </div>
      <div style="font-size: 13px; line-height: 1.4;">
        ${reason}
      </div>
      <div style="font-size: 11px; opacity: 0.8; margin-top: 8px;">
        建议：尝试选择具有唯一ID或class的元素
      </div>
    `;
    
    this.error(message, {
      duration: 5000
    });
  }
}