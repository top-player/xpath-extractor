/**
 * DOM树简化工具
 * 按照指定规则简化DOM结构，用于AI分析
 */

if (typeof DOMSimplifier === 'undefined') {
  class DOMSimplifier {
    constructor() {
      // 白名单属性
      this.allowedAttrs = new Set([
        'id', 'name', 'class', 'role', 'href', 'src', 'type'
      ]);
      
      // 数据属性前缀
      this.dataAttrPrefix = 'data-';
      
      // 配置参数
      this.config = {
        maxAncestorLevels: 3,    // 最多向上查找3层祖先
        maxDescendantLevels: 2,  // 最多向下查找2层子孙
        maxSiblings: 3,          // 每个祖先层最多前后各3个兄弟节点
        totalSiblings: 5         // 或总共5个同级样本
      };
    }

    /**
     * 为目标元素生成简化的DOM树
     * @param {Element} targetElement - 目标元素
     * @returns {Object} 简化的DOM树结构
     */
    generateSimplifiedDOM(targetElement) {
      if (!targetElement) {
        throw new Error('目标元素不能为空');
      }

      // 生成唯一ID
      const targetId = this.generateElementId();
      
      // 构建简化的DOM树
      const simplifiedDOM = {
        targetElementId: targetId,
        tree: this.buildSimplifiedTree(targetElement, targetId)
      };

      console.log('DOM树简化完成:', {
        targetElementId: targetId,
        nodeCount: this.countNodes(simplifiedDOM.tree)
      });

      return simplifiedDOM;
    }

    /**
     * 构建简化的DOM树
     * @param {Element} targetElement - 目标元素
     * @param {string} targetId - 目标元素ID
     * @returns {Object} 简化的树结构
     */
    buildSimplifiedTree(targetElement, targetId) {
      // 找到所有祖先元素（最多3层）
      const ancestors = this.getAncestors(targetElement, this.config.maxAncestorLevels);
      
      // 从最顶层祖先开始构建树
      if (ancestors.length === 0) {
        // 没有祖先，直接处理目标元素
        return this.buildElementNode(targetElement, targetId, true);
      }

      // 从最高祖先开始构建
      const rootAncestor = ancestors[ancestors.length - 1];
      const rootNode = this.buildElementNode(rootAncestor);
      
      // 递归构建到目标元素的路径
      this.buildPathToTarget(rootNode, ancestors, targetElement, targetId, ancestors.length - 1);
      
      return rootNode;
    }

    /**
     * 构建到目标元素的路径
     * @param {Object} currentNode - 当前节点
     * @param {Array} ancestors - 祖先元素数组
     * @param {Element} targetElement - 目标元素
     * @param {string} targetId - 目标元素ID
     * @param {number} ancestorIndex - 当前祖先索引
     */
    buildPathToTarget(currentNode, ancestors, targetElement, targetId, ancestorIndex) {
      const currentElement = ancestors[ancestorIndex];
      
      // 添加兄弟节点（采样）
      this.addSiblingNodes(currentNode, currentElement);
      
      if (ancestorIndex === 0) {
        // 到达目标元素的直接父级
        const targetNode = this.buildElementNode(targetElement, targetId, true);
        
        // 添加目标元素的子代（最多2层）
        this.addDescendants(targetNode, targetElement, this.config.maxDescendantLevels);
        
        currentNode.children = currentNode.children || [];
        currentNode.children.push(targetNode);
      } else {
        // 继续向下一级
        const nextElement = ancestors[ancestorIndex - 1];
        const nextNode = this.buildElementNode(nextElement);
        
        currentNode.children = currentNode.children || [];
        currentNode.children.push(nextNode);
        
        this.buildPathToTarget(nextNode, ancestors, targetElement, targetId, ancestorIndex - 1);
      }
    }

    /**
     * 添加兄弟节点
     * @param {Object} parentNode - 父节点
     * @param {Element} currentElement - 当前元素
     */
    addSiblingNodes(parentNode, currentElement) {
      const parent = currentElement.parentElement;
      if (!parent) return;

      const siblings = Array.from(parent.children);
      const currentIndex = siblings.indexOf(currentElement);
      
      if (currentIndex === -1) return;

      // 获取前后兄弟节点
      const maxSiblings = this.config.maxSiblings;
      const startIndex = Math.max(0, currentIndex - maxSiblings);
      const endIndex = Math.min(siblings.length - 1, currentIndex + maxSiblings);
      
      // 确保总数不超过限制
      let selectedSiblings = siblings.slice(startIndex, endIndex + 1);
      if (selectedSiblings.length > this.config.totalSiblings) {
        // 优先保留目标元素周围的节点
        const targetIndex = selectedSiblings.indexOf(currentElement);
        const beforeCount = Math.floor((this.config.totalSiblings - 1) / 2);
        const afterCount = this.config.totalSiblings - 1 - beforeCount;
        
        const newStart = Math.max(0, targetIndex - beforeCount);
        const newEnd = Math.min(selectedSiblings.length - 1, targetIndex + afterCount);
        selectedSiblings = selectedSiblings.slice(newStart, newEnd + 1);
      }

      parentNode.children = selectedSiblings
        .filter(sibling => sibling !== currentElement)
        .map(sibling => this.buildElementNode(sibling));
    }

    /**
     * 添加子代节点
     * @param {Object} parentNode - 父节点
     * @param {Element} parentElement - 父元素
     * @param {number} levels - 剩余层数
     */
    addDescendants(parentNode, parentElement, levels) {
      if (levels <= 0 || !parentElement.children.length) return;

      parentNode.children = parentNode.children || [];
      
      Array.from(parentElement.children).forEach(child => {
        const childNode = this.buildElementNode(child);
        parentNode.children.push(childNode);
        
        // 递归添加下一层
        if (levels > 1) {
          this.addDescendants(childNode, child, levels - 1);
        }
      });
    }

    /**
     * 获取祖先元素
     * @param {Element} element - 起始元素
     * @param {number} maxLevels - 最大层数
     * @returns {Array} 祖先元素数组（从近到远）
     */
    getAncestors(element, maxLevels) {
      const ancestors = [];
      let current = element.parentElement;
      let level = 0;

      while (current && level < maxLevels && current !== document.body && current !== document.documentElement) {
        ancestors.push(current);
        current = current.parentElement;
        level++;
      }

      return ancestors;
    }

    /**
     * 构建元素节点
     * @param {Element} element - DOM元素
     * @param {string} uid - 唯一标识符
     * @param {boolean} isTarget - 是否为目标元素
     * @returns {Object} 简化的节点对象
     */
    buildElementNode(element, uid = null, isTarget = false) {
      const node = {
        uid: uid || this.generateElementId(),
        tag: element.tagName.toLowerCase(),
        attrs: this.extractAllowedAttributes(element),
        text_trim: this.extractTrimmedText(element)
      };

      if (isTarget) {
        node.isTarget = true;
      }

      return node;
    }

    /**
     * 提取允许的属性
     * @param {Element} element - DOM元素
     * @returns {Object} 过滤后的属性对象
     */
    extractAllowedAttributes(element) {
      const attrs = {};
      
      // 遍历所有属性
      for (const attr of element.attributes) {
        const name = attr.name.toLowerCase();
        const value = attr.value;

        // 检查是否在白名单中
        if (this.allowedAttrs.has(name)) {
          attrs[name] = value;
        }
        // 检查是否为data-属性
        else if (name.startsWith(this.dataAttrPrefix)) {
          attrs[name] = value;
        }
      }

      return attrs;
    }

    /**
     * 提取修剪后的文本内容
     * @param {Element} element - DOM元素
     * @returns {string} 修剪后的文本
     */
    extractTrimmedText(element) {
      // 只获取直接文本节点，不包括子元素的文本
      let text = '';
      for (const node of element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          text += node.textContent;
        }
      }
      
      return text.trim().replace(/\s+/g, ' ').substring(0, 100); // 限制长度
    }

    /**
     * 生成唯一元素ID
     * @returns {string} 唯一ID
     */
    generateElementId() {
      return 'elem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 计算树中的节点数量
     * @param {Object} node - 树节点
     * @returns {number} 节点数量
     */
    countNodes(node) {
      let count = 1;
      if (node.children) {
        for (const child of node.children) {
          count += this.countNodes(child);
        }
      }
      return count;
    }

    /**
     * 验证简化后的DOM树
     * @param {Object} simplifiedDOM - 简化的DOM树
     * @returns {Object} 验证结果
     */
    validateSimplifiedDOM(simplifiedDOM) {
      const issues = [];
      
      if (!simplifiedDOM.targetElementId) {
        issues.push('缺少目标元素ID');
      }
      
      if (!simplifiedDOM.tree) {
        issues.push('缺少DOM树结构');
      }
      
      const nodeCount = this.countNodes(simplifiedDOM.tree);
      if (nodeCount > 50) {
        issues.push(`节点数量过多: ${nodeCount}，建议减少层级或兄弟节点数量`);
      }
      
      return {
        isValid: issues.length === 0,
        issues: issues,
        nodeCount: nodeCount
      };
    }

    /**
     * 获取配置信息
     * @returns {Object} 当前配置
     */
    getConfig() {
      return { ...this.config };
    }

    /**
     * 更新配置
     * @param {Object} newConfig - 新配置
     */
    updateConfig(newConfig) {
      this.config = { ...this.config, ...newConfig };
    }
  }

  window.DOMSimplifier = DOMSimplifier;
}