/**
 * 元素分析器
 * 分析DOM元素的特征和上下文
 */
class ElementAnalyzer {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5000; // 5秒缓存
  }

  /**
   * 分析元素
   * @param {Element} element - 要分析的元素
   * @returns {Object} 分析结果
   */
  analyze(element) {
    if (!element || !element.tagName) {
      throw new Error('无效的元素');
    }

    const cacheKey = this.generateCacheKey(element);
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    const analysis = this.performAnalysis(element);
    
    // 缓存结果
    this.cache.set(cacheKey, {
      data: analysis,
      timestamp: Date.now()
    });

    // 清理过期缓存
    this.cleanupCache();

    return analysis;
  }

  performAnalysis(element) {
    return {
      basic: this.analyzeBasicInfo(element),
      attributes: this.analyzeAttributes(element),
      text: this.analyzeText(element),
      position: this.analyzePosition(element),
      context: this.analyzeContext(element),
      accessibility: this.analyzeAccessibility(element),
      framework: this.analyzeFramework(element),
      uniqueness: this.analyzeUniqueness(element)
    };
  }

  analyzeBasicInfo(element) {
    return {
      tagName: element.tagName.toLowerCase(),
      id: element.id || null,
      className: element.className || null,
      type: element.type || null,
      role: element.getAttribute('role') || null,
      isVisible: this.isElementVisible(element),
      isInteractive: this.isElementInteractive(element),
      // 新增SVG相关分析
      isSVG: element.tagName.toLowerCase() === 'svg' || element.closest('svg') !== null,
      svgInfo: this.analyzeSVGElement(element)
    };
  }

  analyzeAttributes(element) {
    const attributes = {};
    const priorityAttrs = [];
    const dataAttrs = [];
    const ariaAttrs = [];
    const frameworkAttrs = [];
    const stableAttrs = Utils.getStableAttributes(element);
    
    for (const attr of element.attributes) {
      const name = attr.name;
      const value = attr.value;
      
      attributes[name] = value;
      
      // 检查是否为框架属性（包括随机值检查）
      if (Utils.isFrameworkAttribute(name, value)) {
        frameworkAttrs.push({ name, value });
        continue;
      }
      
      // 分类稳定属性
      if (['id', 'name', 'title', 'alt', 'role', 'type'].includes(name)) {
        priorityAttrs.push({ name, value });
      } else if (name.startsWith('data-') && Utils.isStableDataAttribute(name, value)) {
        dataAttrs.push({ name, value });
      } else if (name.startsWith('aria-') && !Utils.isRandomGeneratedValue(value)) {
        // 只有当 aria 属性值不是随机生成时才添加
        ariaAttrs.push({ name, value });
      }
    }
    
    return {
      all: attributes,
      priority: priorityAttrs,
      data: dataAttrs,
      aria: ariaAttrs,
      framework: frameworkAttrs,
      stable: stableAttrs,
      count: element.attributes.length,
      stableCount: stableAttrs.length
    };
  }

  analyzeText(element) {
    const directText = Utils.getVisibleText(element);
    const fullText = element.textContent?.trim() || '';
    const innerText = element.innerText?.trim() || '';
    
    return {
      direct: directText,
      full: fullText,
      inner: innerText,
      hasText: directText.length > 0,
      textLength: directText.length,
      isTextOnly: directText === fullText,
      words: directText.split(/\s+/).filter(word => word.length > 0)
    };
  }

  analyzePosition(element) {
    const rect = element.getBoundingClientRect();
    const parent = element.parentElement;
    
    let siblingIndex = 0;
    let sameTagIndex = 0;
    
    if (parent) {
      const siblings = Array.from(parent.children);
      siblingIndex = siblings.indexOf(element);
      
      const sameTagSiblings = siblings.filter(el => el.tagName === element.tagName);
      sameTagIndex = sameTagSiblings.indexOf(element);
    }
    
    return {
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      },
      siblingIndex: siblingIndex,
      sameTagIndex: sameTagIndex,
      depth: this.getElementDepth(element),
      hasParent: !!parent,
      hasSiblings: parent ? parent.children.length > 1 : false
    };
  }

  analyzeContext(element) {
    const parent = element.parentElement;
    const children = Array.from(element.children);
    
    return {
      parent: parent ? {
        tagName: parent.tagName.toLowerCase(),
        id: parent.id || null,
        className: parent.className || null
      } : null,
      children: children.map(child => ({
        tagName: child.tagName.toLowerCase(),
        id: child.id || null,
        className: child.className || null
      })),
      childCount: children.length,
      isInForm: this.isInForm(element),
      isInTable: this.isInTable(element),
      isInList: this.isInList(element),
      isInShadowDOM: Utils.isInShadowDOM(element)
    };
  }

  analyzeAccessibility(element) {
    return {
      hasAriaLabel: !!element.getAttribute('aria-label'),
      hasAriaDescribedBy: !!element.getAttribute('aria-describedby'),
      hasTitle: !!element.title,
      hasAlt: !!element.alt,
      role: element.getAttribute('role'),
      tabIndex: element.tabIndex,
      isLabelledBy: this.hasAssociatedLabel(element)
    };
  }

  analyzeFramework(element) {
    const framework = Utils.getFrameworkType(element);
    const frameworkAttrs = [];
    
    for (const attr of element.attributes) {
      if (Utils.isFrameworkAttribute(attr.name, framework)) {
        frameworkAttrs.push(attr.name);
      }
    }
    
    return {
      type: framework,
      attributes: frameworkAttrs,
      hasFrameworkData: frameworkAttrs.length > 0
    };
  }

  analyzeUniqueness(element) {
    const uniqueAttrs = [];
    
    // 检查ID唯一性 - 只检查有效的ID
    if (element.id && Utils.isValidId(element.id)) {
      const sameId = document.querySelectorAll(`#${CSS.escape(element.id)}`);
      if (sameId.length === 1) {
        uniqueAttrs.push('id');
      }
    }
    
    // 检查其他属性的唯一性 - 过滤框架属性
    for (const attr of element.attributes) {
      if (attr.name === 'id') continue;
      
      // 跳过框架生成的动态属性
      if (Utils.isFrameworkAttribute(attr.name, attr.value)) {
        continue;
      }
      
      try {
        const selector = `[${attr.name}="${CSS.escape(attr.value)}"]`;
        const elements = document.querySelectorAll(selector);
        if (elements.length === 1) {
          uniqueAttrs.push(attr.name);
        }
      } catch (e) {
        // 忽略无效的选择器
      }
    }
    
    return {
      uniqueAttributes: uniqueAttrs,
      hasUniqueId: uniqueAttrs.includes('id'),
      uniquenessScore: uniqueAttrs.length
    };
  }

  // 辅助方法
  generateCacheKey(element) {
    // 生成基于元素位置和属性的缓存键
    const path = this.getElementPath(element);
    const attrHash = this.hashAttributes(element);
    return `${path}_${attrHash}`;
  }

  getElementPath(element) {
    const path = [];
    let current = element;
    
    while (current && current !== document.body) {
      const index = Array.from(current.parentElement?.children || []).indexOf(current);
      path.unshift(`${current.tagName.toLowerCase()}[${index}]`);
      current = current.parentElement;
    }
    
    return path.join('>');
  }

  hashAttributes(element) {
    const attrs = Array.from(element.attributes)
      .map(attr => `${attr.name}=${attr.value}`)
      .sort()
      .join('|');
    
    // 简单的字符串哈希
    let hash = 0;
    for (let i = 0; i < attrs.length; i++) {
      const char = attrs.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    
    return hash.toString(36);
  }

  getElementDepth(element) {
    let depth = 0;
    let current = element;
    
    while (current && current !== document.body) {
      depth++;
      current = current.parentElement;
    }
    
    return depth;
  }

  isElementVisible(element) {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           element.offsetWidth > 0 && 
           element.offsetHeight > 0;
  }

  isElementInteractive(element) {
    const tagName = element.tagName.toLowerCase();
    const interactiveTags = ['a', 'button', 'input', 'select', 'textarea'];
    const role = element.getAttribute('role');
    const interactiveRoles = ['button', 'link', 'tab', 'menuitem'];
    
    return interactiveTags.includes(tagName) || 
           interactiveRoles.includes(role) ||
           element.onclick !== null ||
           element.tabIndex >= 0;
  }

  isInForm(element) {
    let current = element;
    while (current) {
      if (current.tagName?.toLowerCase() === 'form') {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }

  isInTable(element) {
    let current = element;
    while (current) {
      if (current.tagName?.toLowerCase() === 'table') {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }

  isInList(element) {
    let current = element;
    while (current) {
      const tagName = current.tagName?.toLowerCase();
      if (['ul', 'ol', 'dl'].includes(tagName)) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }

  hasAssociatedLabel(element) {
    // 检查是否有关联的label元素
    if (element.id) {
      const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (label) return true;
    }
    
    // 检查是否被label包围
    let current = element.parentElement;
    while (current) {
      if (current.tagName?.toLowerCase() === 'label') {
        return true;
      }
      current = current.parentElement;
    }
    
    return false;
  }

  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 分析SVG元素的特征
   * @param {Element} element - 要分析的元素
   * @returns {Object} SVG分析结果
   */
  analyzeSVGElement(element) {
    const svgRoot = element.closest('svg');
    if (!svgRoot && element.tagName.toLowerCase() !== 'svg') {
      return null;
    }

    const targetSvg = element.tagName.toLowerCase() === 'svg' ? element : svgRoot;
    
    return {
      isRoot: element.tagName.toLowerCase() === 'svg',
      svgElement: targetSvg,
      viewBox: targetSvg.getAttribute('viewBox'),
      width: targetSvg.getAttribute('width'),
      height: targetSvg.getAttribute('height'),
      hasTitle: !!targetSvg.querySelector('title'),
      hasDesc: !!targetSvg.querySelector('desc'),
      titleText: targetSvg.querySelector('title')?.textContent?.trim() || '',
      descText: targetSvg.querySelector('desc')?.textContent?.trim() || '',
      pathCount: targetSvg.querySelectorAll('path').length,
      useElements: targetSvg.querySelectorAll('use').length,
      hasAriaLabel: !!targetSvg.getAttribute('aria-label'),
      ariaLabelText: targetSvg.getAttribute('aria-label') || ''
    };
  }

  clearCache() {
    this.cache.clear();
  }
}