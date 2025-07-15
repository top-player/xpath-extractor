/**
 * 背景脚本
 * 处理右键菜单和扩展生命周期
 */

// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'copyXPath',
    title: '复制相对XPath',
    contexts: ['all']
  });
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'copyXPath') {
    try {
      // 首先检查内容脚本是否已加载
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      
      // 如果有响应，说明内容脚本已加载
      if (response && response.loaded) {
        // 直接发送生成XPath的消息
        await chrome.tabs.sendMessage(tab.id, {
          action: 'generateXPath',
          data: {
            x: info.x || 0,
            y: info.y || 0
          }
        });
        return;
      }
    } catch (error) {
      // 内容脚本未加载，继续执行注入逻辑
      console.log('内容脚本未加载，正在注入...');
    }
    
    // 注入内容脚本
    try {
      // 先检查是否已经有Utils类存在
      const checkResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          return typeof window.Utils !== 'undefined';
        }
      });
      
      const utilsExists = checkResult[0]?.result;
      
      if (!utilsExists) {
        // 只有当Utils不存在时才注入所有脚本
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [
            'src/utils/utils.js',
            'src/strategies/base-strategy.js',
            'src/strategies/text-strategy.js',
            'src/strategies/container-context-strategy.js',
            'src/strategies/anchor-strategy.js',
            'src/strategies/attribute-strategy.js',
            'src/strategies/relative-strategy.js',
            'src/strategies/shadow-dom-strategy.js',
            'src/strategies/svg-strategy.js',
            'src/core/strategy-manager.js',
            'src/core/element-analyzer.js',
            'src/core/xpath-generator.js',
            'src/core/notification-system.js',
            'src/content.js'
          ]
        });
      } else {
        // 如果Utils已存在，只注入content.js来重新初始化
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['src/content.js']
        });
      }
      
      // 等待脚本加载完成后重新发送消息
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'generateXPath',
            data: {
              x: info.x || 0,
              y: info.y || 0
            }
          });
        } catch (retryError) {
          console.error('重试发送消息失败:', retryError);
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              alert('XPath插件加载失败，请刷新页面后重试');
            }
          });
        }
      }, 200);
    } catch (injectError) {
      console.error('注入脚本失败:', injectError);
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          alert('XPath插件无法在此页面使用，请检查页面权限');
        }
      });
    }
  }
});

// 处理来自内容脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'xpathGenerated') {
    // 可以在这里添加统计或日志记录
    console.log('XPath生成成功:', request.data);
  } else if (request.action === 'xpathError') {
    console.error('XPath生成失败:', request.data);
  }
  
  sendResponse({ success: true });
});