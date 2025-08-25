/**
 * XPath缓存调试助手
 * 在浏览器控制台中使用此工具监控和管理缓存状态
 */
if (typeof XPathCacheDebugger === 'undefined') {
  class XPathCacheDebugger {
    constructor() {
      this.extension = null;
      this.autoRefreshInterval = null;
      this.init();
    }

    init() {
      // 等待扩展加载
      setTimeout(() => {
        if (typeof XPathExtension !== 'undefined') {
          // 查找已有实例或创建新实例
          this.extension = window.xpathExtension || new XPathExtension();
          window.xpathExtension = this.extension;
          console.log('🔧 XPath缓存调试器已初始化');
          this.showHelp();
        } else {
          console.warn('⚠️ XPath扩展未加载，请确保扩展已正确安装');
        }
      }, 1000);
    }

    /**
     * 显示帮助信息
     */
    showHelp() {
      console.log(`
🔧 XPath缓存调试助手
==================

可用命令：
- debugger.stats()          - 显示缓存统计信息
- debugger.details()        - 显示详细缓存内容
- debugger.clear()          - 清空所有缓存
- debugger.clearAI()        - 清空AI模式缓存
- debugger.clearTraditional() - 清空传统模式缓存
- debugger.test(element)    - 测试指定元素的缓存行为
- debugger.startMonitor()   - 开始实时监控缓存
- debugger.stopMonitor()    - 停止实时监控
- debugger.help()           - 显示此帮助信息

使用示例：
debugger.test(document.querySelector('#my-button'));
      `);
    }

    /**
     * 获取缓存统计信息
     */
    stats() {
      if (!this.extension?.generator) {
        console.error('❌ 扩展未加载');
        return;
      }

      const stats = this.extension.generator.getCacheStats();
      console.table({
        '总缓存数': stats.total,
        '传统模式': stats.traditional,
        'AI模式': stats.ai,
        '过期缓存': stats.expired,
        'XPath缓存': stats.xpath?.total || 0,
        '分析器缓存': stats.analyzer?.total || 0
      });
      
      return stats;
    }

    /**
     * 显示详细缓存内容
     */
    details() {
      if (!this.extension?.generator) {
        console.error('❌ 扩展未加载');
        return;
      }

      const cache = this.extension.generator.cache;
      const analyzerCache = this.extension.generator.elementAnalyzer.cache;
      
      console.group('🗂️ XPath生成器缓存详情');
      for (const [key, value] of cache.entries()) {
        const age = ((Date.now() - value.timestamp) / 1000).toFixed(1);
        console.log(`${value.mode?.toUpperCase() || '未知'} | ${age}s前 | ${value.data?.primary?.strategy || '无策略'} | ${key.substring(0, 50)}...`);
      }
      console.groupEnd();

      console.group('🔍 元素分析器缓存详情');
      for (const [key, value] of analyzerCache.entries()) {
        const age = ((Date.now() - value.timestamp) / 1000).toFixed(1);
        console.log(`${value.mode?.toUpperCase() || '未知'} | ${age}s前 | ${key.substring(0, 50)}...`);
      }
      console.groupEnd();
    }

    /**
     * 清空所有缓存
     */
    clear() {
      if (!this.extension?.generator) {
        console.error('❌ 扩展未加载');
        return;
      }

      this.extension.generator.clearCache();
      console.log('✅ 所有缓存已清空');
    }

    /**
     * 清空AI模式缓存
     */
    clearAI() {
      if (!this.extension?.generator) {
        console.error('❌ 扩展未加载');
        return;
      }

      this.extension.generator.clearCacheByMode('ai');
      console.log('✅ AI模式缓存已清空');
    }

    /**
     * 清空传统模式缓存
     */
    clearTraditional() {
      if (!this.extension?.generator) {
        console.error('❌ 扩展未加载');
        return;
      }

      this.extension.generator.clearCacheByMode('traditional');
      console.log('✅ 传统模式缓存已清空');
    }

    /**
     * 测试指定元素的缓存行为
     */
    async test(element) {
      if (!element) {
        console.error('❌ 请提供一个DOM元素');
        return;
      }

      if (!this.extension?.generator) {
        console.error('❌ 扩展未加载');
        return;
      }

      console.log('🧪 开始缓存测试...');
      console.log('元素:', element);

      // 清空缓存
      this.clear();

      // 测试传统模式
      console.log('🔄 测试传统模式...');
      const traditionalResult = await this.extension.generator.generateXPath(element);
      console.log('传统模式结果:', traditionalResult);

      // 测试AI模式
      console.log('🤖 测试AI模式...');
      const aiResult = await this.extension.generator.generateXPathWithAI(element);
      console.log('AI模式结果:', aiResult);

      // 再次测试传统模式（应该命中缓存）
      console.log('🔄 再次测试传统模式（应该命中缓存）...');
      const traditionalResult2 = await this.extension.generator.generateXPath(element);
      console.log('传统模式结果2:', traditionalResult2);

      // 再次测试AI模式（应该命中缓存）
      console.log('🤖 再次测试AI模式（应该命中缓存）...');
      const aiResult2 = await this.extension.generator.generateXPathWithAI(element);
      console.log('AI模式结果2:', aiResult2);

      // 显示最终统计
      console.log('📊 最终缓存统计:');
      this.stats();
    }

    /**
     * 开始实时监控缓存
     */
    startMonitor(interval = 3000) {
      if (this.autoRefreshInterval) {
        console.log('⚠️ 监控已在运行');
        return;
      }

      console.log('🔍 开始实时监控缓存变化...');
      this.autoRefreshInterval = setInterval(() => {
        const stats = this.stats();
        if (stats.total > 0) {
          console.log(`📊 [${new Date().toLocaleTimeString()}] 总缓存: ${stats.total}, 传统: ${stats.traditional}, AI: ${stats.ai}`);
        }
      }, interval);
    }

    /**
     * 停止实时监控
     */
    stopMonitor() {
      if (this.autoRefreshInterval) {
        clearInterval(this.autoRefreshInterval);
        this.autoRefreshInterval = null;
        console.log('⏹️ 缓存监控已停止');
      }
    }

    /**
     * 显示帮助信息
     */
    help() {
      this.showHelp();
    }
  }

  // 创建全局调试器实例
  window.debugger = new XPathCacheDebugger();
  
  console.log('🎯 XPath缓存调试器已加载！在控制台中输入 debugger.help() 查看帮助');
}