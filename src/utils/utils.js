/**
 * 工具函数集
 * 提供通用的辅助函数
 */
if (typeof Utils === 'undefined') {
  class Utils {
    /**
     * 转义XPath中的特殊字符
     * @param {string} text - 需要转义的文本
     * @returns {string} 转义后的文本
     */
    static escapeXPath(text) {
      if (!text) return "''";
      
      // 如果包含单引号但不包含双引号，使用双引号包围
      if (text.includes("'") && !text.includes('"')) {
        return `"${text}"`;
      }
      
      // 如果包含双引号但不包含单引号，使用单引号包围
      if (text.includes('"') && !text.includes("'")) {
        return `'${text}'`;
      }
      
      // 如果同时包含单引号和双引号，使用concat函数
      if (text.includes("'") && text.includes('"')) {
        const parts = text.split("'").map(part => `'${part}'`);
        return `concat(${parts.join(", \"'\" , ")})`;
      }
      
      // 默认使用单引号包围
      return `'${text}'`;
    }
  
    /**
     * 获取元素的可见文本
     * @param {Element} element - DOM元素
     * @returns {string} 可见文本
     */
    static getVisibleText(element) {
      if (!element) return '';
      
      // 检查元素是否可见
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return '';
      }
      
      // 获取直接文本内容（不包括子元素）
      const textNodes = [];
      for (const node of element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          textNodes.push(node.textContent.trim());
        }
      }
      
      return textNodes.join(' ').trim();
    }
  
    /**
     * 检查元素是否在Shadow DOM中
     * @param {Element} element - DOM元素
     * @returns {boolean} 是否在Shadow DOM中
     */
    static isInShadowDOM(element) {
      let current = element;
      while (current) {
        if (current.getRootNode && current.getRootNode() instanceof ShadowRoot) {
          return true;
        }
        current = current.parentElement;
      }
      return false;
    }
  
    /**
     * 获取元素的框架类型
     * @param {Element} element - DOM元素
     * @returns {string} 框架类型
     */
    static getFrameworkType(element) {
      // React检测
      if (element._reactInternalFiber || element._reactInternalInstance || 
          Object.keys(element).some(key => key.startsWith('__reactInternalInstance'))) {
        return 'react';
      }
      
      // Vue检测
      if (element.__vue__ || element._vnode) {
        return 'vue';
      }
      
      // Angular检测
      if (element.ng || element.ngModel || 
          element.getAttribute && element.getAttribute('ng-app')) {
        return 'angular';
      }
      
      return 'vanilla';
    }
  
    /**
     * 获取元素在同级中的位置
     * @param {Element} element - DOM元素
     * @returns {number} 位置索引（从1开始）
     */
    static getElementIndex(element) {
      if (!element.parentElement) return 1;
      
      const siblings = Array.from(element.parentElement.children)
        .filter(sibling => sibling.tagName === element.tagName);
      
      return siblings.indexOf(element) + 1;
    }
  
    /**
     * 检查属性是否为框架特定属性
     * @param {string} attrName - 属性名
     * @param {string} attrValue - 属性值
     * @param {string} framework - 框架类型
     * @returns {boolean} 是否为框架特定属性
     */
    static isFrameworkAttribute(attrName, attrValue = '', framework = 'unknown') {
      // Vue scoped CSS 属性
      if (/^data-v-[a-f0-9]{8}$/i.test(attrName)) {
        return true;
      }
      
      // React 相关属性
      if (/^data-react/i.test(attrName)) {
        return true;
      }
      
      // Angular 相关属性
      if (/^_ng(content|host)-[a-z0-9-]+$/i.test(attrName)) {
        return true;
      }
      
      // 检查属性值是否为随机生成的ID（新增）
      if (this.isRandomGeneratedValue(attrValue)) {
        // 对于某些语义属性，如果值是随机的，也应该被过滤
        const semanticAttrsWithRandomValues = [
          'aria-labelledby',
          'aria-describedby', 
          'aria-controls',
          'aria-owns',
          'for',
          'form',
          'list',
          'headers'
        ];
        
        if (semanticAttrsWithRandomValues.includes(attrName)) {
          // 调试日志
          if (console && console.log) {
            console.log(`过滤随机属性: ${attrName}=${attrValue}`);
          }
          return true;
        }
      }
      
      // 其他框架动态属性模式
      const dynamicAttrPatterns = [
        /^data-[a-z]+-[a-f0-9]{6,}$/i,        // data-前缀+哈希
        /^[a-z]+-[a-f0-9]{8}$/i,              // 前缀+8位哈希
        /^data-styled-[a-z0-9]+$/i,           // styled-components
        /^data-emotion-[a-z0-9]+$/i,          // emotion
        /^data-css-[a-z0-9]+$/i,              // CSS-in-JS
      ];
      
      return dynamicAttrPatterns.some(pattern => pattern.test(attrName));
    }

    /**
     * 检查属性值是否为随机生成的（新增方法）
     * @param {string} value - 属性值
     * @returns {boolean} 是否为随机生成的值
     */
    static isRandomGeneratedValue(value) {
      if (!value || typeof value !== 'string') return false;
      
      // 先去除前后空格
      value = value.trim();
      
      const randomValuePatterns = [
        /^[a-f0-9]{8}$/i,                     // 8位纯十六进制（如 8c4fed8e）
        /^[a-f0-9]{6,}$/i,                    // 6位以上十六进制哈希
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, // UUID格式
        /^[a-z][0-9a-f]{7}$/i,                // 单字母+7位十六进制（如f520f9b8）
        /^[a-z]{2}[0-9a-f]{6}$/i,             // 双字母+6位十六进制
        /^[a-z0-9]{8,12}$/i,                  // 8-12位字母数字混合（可能是随机ID）
        /^[a-z]+-[a-f0-9]{5,}$/i,             // 前缀+长哈希
        /^_[a-f0-9]{5,}$/i,                   // 下划线开头的哈希
        /^react-[a-z0-9-]+$/i,                // React生成的ID
        /^vue-[a-z0-9-]+$/i,                  // Vue生成的ID
        /^ng-[a-z0-9-]+$/i,                   // Angular生成的ID
        /^component-[a-z0-9-]+$/i,            // 组件生成的ID
        /^auto-[a-z0-9-]+$/i,                 // 自动生成的ID
        /^gen-[a-z0-9-]+$/i,                  // 生成的ID
      ];
      
      const isRandom = randomValuePatterns.some(pattern => pattern.test(value));
      
      // 调试日志（可以在开发时启用）
      if (isRandom && console && console.log) {
        console.log(`检测到随机值: ${value}`);
      }
      
      return isRandom;
    }

    /**
     * 获取元素的稳定属性（排除框架生成的动态属性）
     * @param {Element} element - DOM元素
     * @returns {Array} 稳定属性列表
     */
    static getStableAttributes(element) {
      const stableAttrs = [];
      const framework = this.getFrameworkType(element);
      
      for (const attr of element.attributes) {
        const name = attr.name;
        const value = attr.value;
        
        // 跳过框架生成的动态属性（现在包括随机值检查）
        if (this.isFrameworkAttribute(name, value, framework)) {
          continue;
        }
        
        // 跳过空值属性（除了某些特殊情况）
        if (!value && !['checked', 'selected', 'disabled', 'readonly'].includes(name)) {
          continue;
        }
        
        // 优先级属性
        if (['id', 'name', 'title', 'alt', 'role', 'type'].includes(name)) {
          stableAttrs.unshift({ name, value, priority: 'high' });
        }
        // 语义属性（但要确保值不是随机的）
        else if ((name.startsWith('aria-') || ['placeholder', 'value'].includes(name)) && 
                 !this.isRandomGeneratedValue(value)) {
          stableAttrs.push({ name, value, priority: 'medium' });
        }
        // 其他稳定属性
        else if (!name.startsWith('data-') || this.isStableDataAttribute(name, value)) {
          stableAttrs.push({ name, value, priority: 'low' });
        }
      }
      
      return stableAttrs;
    }
    
    /**
     * 检查data属性是否稳定（非动态生成）
     * @param {string} attrName - 属性名
     * @param {string} attrValue - 属性值
     * @returns {boolean} 是否稳定
     */
    static isStableDataAttribute(attrName, attrValue) {
      if (!attrName.startsWith('data-')) return false;
      
      // 常见的稳定data属性
      const stableDataAttrs = [
        'data-testid',
        'data-test',
        'data-cy',           // Cypress测试
        'data-qa',           // QA测试
        'data-automation',   // 自动化测试
        'data-role',
        'data-action',
        'data-target',
        'data-toggle',
        'data-dismiss',
        'data-placement',
        'data-content',
        'data-original-title'
      ];
      
      // 检查是否为已知的稳定属性
      if (stableDataAttrs.includes(attrName)) {
        return true;
      }
      
      // 检查值是否看起来像是稳定的（非哈希值）
      const hashPatterns = [
        /^[a-f0-9]{6,}$/i,                    // 纯哈希
        /^[a-z0-9]+-[a-f0-9]{5,}$/i,          // 前缀+哈希
        /^\d+$/,                              // 纯数字（可能是动态ID）
      ];
      
      const looksLikeHash = hashPatterns.some(pattern => pattern.test(attrValue));
      return !looksLikeHash && attrValue.length > 0;
    }
  
    /**
     * 复制文本到剪贴板
     * @param {string} text - 要复制的文本
     * @returns {Promise<boolean>} 复制是否成功
     */
    static async copyToClipboard(text) {
      try {
        // 先尝试获取文档焦点
        if (document.hasFocus && !document.hasFocus()) {
          try {
            // 尝试聚焦窗口
            window.focus();
            // 等待短暂时间让焦点生效
            await new Promise(resolve => setTimeout(resolve, 50));
          } catch (focusError) {
            console.warn('无法获取窗口焦点:', focusError);
          }
        }

        // 现代浏览器API
        if (navigator.clipboard && window.isSecureContext) {
          try {
            await navigator.clipboard.writeText(text);
            console.log('使用Clipboard API复制成功');
            return true;
          } catch (clipboardError) {
            console.warn('Clipboard API失败，尝试降级方案:', clipboardError.message);
            // 继续尝试降级方案
          }
        }
        
        // 降级方案：使用传统的document.execCommand
        return await this.fallbackCopyToClipboard(text);
        
      } catch (error) {
        console.error('复制失败:', error);
        
        // 最后的降级方案：显示文本供用户手动复制
        this.showManualCopyDialog(text);
        return false;
      }
    }
    
    /**
     * 降级复制方案
     * @param {string} text - 要复制的文本
     * @returns {Promise<boolean>} 复制是否成功
     */
    static async fallbackCopyToClipboard(text) {
      return new Promise((resolve) => {
        try {
          const textArea = document.createElement('textarea');
          textArea.value = text;
          
          // 设置样式使其不可见但仍能获取焦点
          textArea.style.position = 'fixed';
          textArea.style.left = '-9999px';
          textArea.style.top = '-9999px';
          textArea.style.opacity = '0';
          textArea.style.pointerEvents = 'none';
          textArea.setAttribute('readonly', '');
          textArea.setAttribute('contenteditable', 'true');
          
          document.body.appendChild(textArea);
          
          // 尝试选中文本
          textArea.select();
          textArea.setSelectionRange(0, text.length);
          
          // 等待一个微任务周期让DOM更新
          setTimeout(() => {
            try {
              const success = document.execCommand('copy');
              document.body.removeChild(textArea);
              
              if (success) {
                console.log('使用execCommand复制成功');
                resolve(true);
              } else {
                console.warn('execCommand复制失败');
                resolve(false);
              }
            } catch (execError) {
              console.error('execCommand抛出异常:', execError);
              document.body.removeChild(textArea);
              resolve(false);
            }
          }, 10);
          
        } catch (error) {
          console.error('降级复制方案失败:', error);
          resolve(false);
        }
      });
    }
    
    /**
     * 显示手动复制对话框
     * @param {string} text - 要复制的文本
     */
    static showManualCopyDialog(text) {
      // 创建一个模态对话框显示XPath供用户手动复制
      const dialog = document.createElement('div');
      dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 80%;
        font-family: Arial, sans-serif;
      `;
      
      dialog.innerHTML = `
        <div style="margin-bottom: 15px; font-weight: bold; color: #333;">
          ⚠️ 自动复制失败，请手动复制XPath：
        </div>
        <div style="margin-bottom: 15px;">
          <textarea readonly style="width: 100%; height: 60px; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-family: monospace; resize: none;">${text}</textarea>
        </div>
        <div style="text-align: center;">
          <button style="background: #2196F3; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 10px;">选中全部</button>
          <button style="background: #666; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">关闭</button>
        </div>
      `;
      
      // 绑定事件
      const textarea = dialog.querySelector('textarea');
      const selectBtn = dialog.querySelector('button:first-of-type');
      const closeBtn = dialog.querySelector('button:last-of-type');
      
      selectBtn.onclick = () => {
        textarea.select();
        textarea.setSelectionRange(0, text.length);
      };
      
      closeBtn.onclick = () => {
        document.body.removeChild(dialog);
      };
      
      // 5秒后自动关闭
      setTimeout(() => {
        if (document.body.contains(dialog)) {
          document.body.removeChild(dialog);
        }
      }, 15000);
      
      document.body.appendChild(dialog);
      
      // 自动选中文本
      setTimeout(() => {
        textarea.select();
        textarea.setSelectionRange(0, text.length);
      }, 100);
    }
  
    /**
     * 防抖函数
     * @param {Function} func - 要防抖的函数
     * @param {number} wait - 等待时间
     * @returns {Function} 防抖后的函数
     */
    static debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }
  
    /**
     * 过滤框架随机生成的类名和ID
     * @param {Array<string>} names - 类名或ID数组
     * @param {string} type - 类型：'class' 或 'id'
     * @returns {Array<string>} 过滤后的数组
     */
    static filterFrameworkGeneratedNames(names, type = 'class') {
      if (!Array.isArray(names)) return [];
      
      const dynamicPatterns = [
        // 通用随机模式
        /^[a-f0-9]{6,}$/i,                    // 6位以上十六进制哈希
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, // UUID格式
        /^\d+$/,                              // 纯数字
        /^[a-z0-9]+-[a-f0-9]{5,}$/i,          // 前缀+长哈希
        /^[a-z]+_[a-f0-9]{5,}$/i,             // 前缀_哈希
        /^_[a-f0-9]{5,}$/i,                   // 下划线开头的哈希
        /^[a-f0-9]{4,8}-[a-f0-9]{4,8}$/i,     // 短哈希组合
        /^[a-z]{1,3}[0-9a-f]{6,}$/i,          // 短前缀+长哈希
        
        // CSS-in-JS 框架
        /^css-[a-z0-9]+$/i,                   // CSS-in-JS生成的类名
        /^sc-[a-z0-9]+$/i,                    // styled-components
        /^jsx-[a-z0-9]+$/i,                   // JSX生成的类名
        /emotion-[a-z0-9]+$/i,                // Emotion CSS-in-JS
        /^__[a-z0-9-]+$/i,                    // 双下划线开头的随机类名
        
        // React 相关
        /^react-[a-z0-9-]+$/i,                // React生成的类名
        /^[a-z]+-[0-9a-z]{6,}-[0-9a-z]{6,}$/i, // React多段哈希组合
        
        // Vue 相关
        /^data-v-[a-f0-9]{8}$/i,              // Vue scoped CSS
        /^vue-[a-z0-9-]+$/i,                  // Vue生成的类名
        
        // Angular 相关
        /^ng-[a-z0-9-]+$/i,                   // Angular生成的类名
        /^_ngcontent-[a-z0-9-]+$/i,           // Angular内容投影
        /^_nghost-[a-z0-9-]+$/i,              // Angular宿主
        
        // Material-UI
        /^MuiBox-root-\d+$/,                  // Material-UI动态类名
        /^makeStyles-[a-z]+-\d+$/,            // Material-UI makeStyles
        /^jss\d+$/i,                          // JSS生成的类名
        
        // Ant Design
        /^ant-[a-z]+-[a-f0-9]{6,}$/i,         // Ant Design动态类名
        
        // Tailwind CSS (某些动态生成的)
        /^[a-z]+-\[[a-f0-9#%]+\]$/i,          // Tailwind动态值
        
        // 其他常见模式
        /^[A-Z][a-z]*__[a-z0-9-]+$/i,         // BEM风格但包含哈希
        /^[a-z]+[A-Z][a-z]*_[a-f0-9]{5,}$/i, // 驼峰+下划线+哈希
        /^[a-z]+-[a-z]+-[a-f0-9]{5,}$/i,      // 多段连字符+哈希
        
        // 新增：更严格的随机ID模式
        /^[a-z][0-9a-f]{7}$/i,                // 单字母+7位十六进制（如a304c4ac）
        /^[a-z]{2}[0-9a-f]{6}$/i,             // 双字母+6位十六进制
        /^[0-9a-f]{8}$/i,                     // 8位纯十六进制
        /^[a-z0-9]{8,12}$/i,                  // 8-12位字母数字混合
      ];
      
      return names.filter(name => {
        if (!name || name.length < 2) return false;
        
        // 检查是否匹配任何动态模式
        const isDynamic = dynamicPatterns.some(pattern => pattern.test(name));
        
        // 对于ID，额外检查一些特殊模式
        if (type === 'id') {
          const idPatterns = [
            /^react-/i,                         // React生成的ID
            /^vue-/i,                           // Vue生成的ID
            /^ng-/i,                            // Angular生成的ID
            /^root-\d+$/i,                      // 根元素动态ID
            /^app-[a-z0-9-]+$/i,                // 应用生成的ID
            /^component-[a-z0-9-]+$/i,          // 组件生成的ID
          ];
          const isFrameworkId = idPatterns.some(pattern => pattern.test(name));
          return !isDynamic && !isFrameworkId;
        }
        
        return !isDynamic;
      });
    }
  
    /**
     * 过滤类名
     * @param {string|Array<string>} className - 类名字符串或数组
     * @returns {Array<string>} 过滤后的类名数组
     */
    static getFilteredClasses(className) {
      if (!className) return [];
      
      let classes;
      if (Array.isArray(className)) {
        classes = className;
      } else if (typeof className === 'string') {
        classes = className.split(/\s+/).filter(cls => cls.length > 0);
      } else if (className.baseVal !== undefined) {
        // SVG元素的className是SVGAnimatedString类型
        classes = className.baseVal.split(/\s+/).filter(cls => cls.length > 0);
      } else if (className.toString) {
        classes = className.toString().split(/\s+/).filter(cls => cls.length > 0);
      } else {
        return [];
      }
      
      return this.filterFrameworkGeneratedNames(classes, 'class');
    }
  
    /**
     * 获取有效的ID（过滤框架生成的随机ID）
     * @param {string} id - ID值
     * @returns {string|null} 有效的ID，如果无效则返回null
     */
    static getValidId(id) {
      if (!id) return null;
      const filtered = this.filterFrameworkGeneratedNames([id], 'id');
      return filtered.length > 0 ? id : null;
    }
  
    /**
     * 检查ID是否有效（非框架生成）
     * @param {string} id - ID值
     * @returns {boolean} 是否有效
     */
    static isValidId(id) {
      return this.getValidId(id) !== null;
    }
  }
  
  // 将Utils添加到全局作用域
  window.Utils = Utils;
}
