/**
 * AI配置选项页面脚本
 */

class AIOptionsManager {
    constructor() {
        this.init();
    }

    async init() {
        await this.loadConfig();
        this.bindEvents();
    }

    /**
     * 加载已保存的配置
     */
    async loadConfig() {
        try {
            const result = await chrome.storage.sync.get([
                'aiApiKey',
                'aiBaseUrl', 
                'aiModel',
                'aiTemperature'
            ]);

            document.getElementById('apiKey').value = result.aiApiKey || '';
            document.getElementById('baseUrl').value = result.aiBaseUrl || 'https://api.openai.com/v1';
            document.getElementById('model').value = result.aiModel || 'gpt-4o';
            document.getElementById('temperature').value = result.aiTemperature || 0.5;

            // 更新模型按钮选中状态
            this.updateModelSelection(result.aiModel || 'gpt-4o');
        } catch (error) {
            console.error('加载配置失败:', error);
            this.showStatus('加载配置失败', 'error');
        }
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 表单提交
        document.getElementById('aiConfigForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveConfig();
        });

        // 测试连接按钮
        document.getElementById('testBtn').addEventListener('click', () => {
            this.testConnection();
        });

        // 重置配置按钮
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetConfig();
        });

        // 模型选择按钮
        document.querySelectorAll('.model-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const model = e.target.dataset.model;
                document.getElementById('model').value = model;
                this.updateModelSelection(model);
            });
        });

        // 实时验证
        document.getElementById('apiKey').addEventListener('input', () => {
            this.validateForm();
        });
    }

    /**
     * 更新模型选择按钮状态
     */
    updateModelSelection(selectedModel) {
        document.querySelectorAll('.model-btn').forEach(btn => {
            btn.classList.remove('selected');
            if (btn.dataset.model === selectedModel) {
                btn.classList.add('selected');
            }
        });
    }

    /**
     * 保存配置
     */
    async saveConfig() {
        try {
            const config = {
                aiApiKey: document.getElementById('apiKey').value.trim(),
                aiBaseUrl: document.getElementById('baseUrl').value.trim() || 'https://api.openai.com/v1',
                aiModel: document.getElementById('model').value.trim() || 'gpt-4o',
                aiTemperature: parseFloat(document.getElementById('temperature').value) || 0.1
            };

            // 验证必填项
            if (!config.aiApiKey) {
                this.showStatus('请输入API Key', 'error');
                return;
            }

            // 验证URL格式
            try {
                new URL(config.aiBaseUrl);
            } catch {
                this.showStatus('请输入有效的Base URL', 'error');
                return;
            }

            // 验证Temperature范围
            if (config.aiTemperature < 0 || config.aiTemperature > 2) {
                this.showStatus('Temperature必须在0-2之间', 'error');
                return;
            }

            await chrome.storage.sync.set(config);
            this.showStatus('配置保存成功！', 'success');
            
            console.log('AI配置已保存:', {
                ...config,
                aiApiKey: '***masked***'
            });
        } catch (error) {
            console.error('保存配置失败:', error);
            this.showStatus('保存配置失败: ' + error.message, 'error');
        }
    }

    /**
     * 测试API连接
     */
    async testConnection() {
        const testBtn = document.getElementById('testBtn');
        const originalText = testBtn.textContent;
        
        try {
            testBtn.textContent = '测试中...';
            testBtn.disabled = true;

            const config = {
                apiKey: document.getElementById('apiKey').value.trim(),
                baseUrl: document.getElementById('baseUrl').value.trim() || 'https://api.openai.com/v1',
                model: document.getElementById('model').value.trim() || 'gpt-4o',
                temperature: parseFloat(document.getElementById('temperature').value) || 0.1
            };

            if (!config.apiKey) {
                this.showStatus('请先输入API Key', 'error');
                return;
            }

            // 发送测试请求
            const response = await fetch(`${config.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify({
                    model: config.model,
                    messages: [
                        {
                            role: 'user',
                            content: 'Hello, this is a test message.'
                        }
                    ],
                    max_tokens: 10,
                    temperature: config.temperature
                })
            });

            if (response.ok) {
                this.showStatus('✅ API连接测试成功！', 'success');
            } else {
                const errorData = await response.json().catch(() => ({}));
                this.showStatus(`❌ API连接失败: ${response.status} ${errorData.error?.message || response.statusText}`, 'error');
            }
        } catch (error) {
            console.error('测试连接失败:', error);
            this.showStatus(`❌ 连接测试失败: ${error.message}`, 'error');
        } finally {
            testBtn.textContent = originalText;
            testBtn.disabled = false;
        }
    }

    /**
     * 重置配置
     */
    async resetConfig() {
        if (confirm('确定要重置所有AI配置吗？此操作无法撤销。')) {
            try {
                await chrome.storage.sync.remove([
                    'aiApiKey',
                    'aiBaseUrl',
                    'aiModel', 
                    'aiTemperature'
                ]);

                // 重置表单
                document.getElementById('apiKey').value = '';
                document.getElementById('baseUrl').value = 'https://api.openai.com/v1';
                document.getElementById('model').value = 'gpt-4o';
                document.getElementById('temperature').value = '0.1';
                
                this.updateModelSelection('gpt-4o');
                this.showStatus('配置已重置', 'success');
            } catch (error) {
                console.error('重置配置失败:', error);
                this.showStatus('重置配置失败', 'error');
            }
        }
    }

    /**
     * 表单验证
     */
    validateForm() {
        const apiKey = document.getElementById('apiKey').value.trim();
        const submitBtn = document.querySelector('button[type="submit"]');
        
        if (apiKey) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
        } else {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.6';
        }
    }

    /**
     * 显示状态消息
     */
    showStatus(message, type = 'success') {
        const statusEl = document.getElementById('status');
        statusEl.textContent = message;
        statusEl.className = `status ${type}`;
        statusEl.style.display = 'block';
        
        // 3秒后自动隐藏
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 3000);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new AIOptionsManager();
});