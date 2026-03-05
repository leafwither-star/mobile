// 【施工标记】神经元：保留数据接口，用于异步感知聊天内容。
/**
 * Context Monitor Integration - 上下文监控器集成
 * 帮助其他组件正确使用ContextMonitor
 */

// 确保其他组件能够正确获取和使用ContextMonitor
class ContextMonitorIntegration {
    constructor() {
        this.isReady = false;
        this.contextMonitor = null;
        this.readyPromise = null;

        console.log('[Context Monitor Integration] 集成助手已创建');
        this.init();
    }

    async init() {
        console.log('[Context Monitor Integration] 开始初始化...');

        // 等待ContextMonitor准备就绪
        this.readyPromise = this.waitForContextMonitor();

        try {
            this.contextMonitor = await this.readyPromise;
            this.isReady = true;
            console.log('[Context Monitor Integration] ✅ ContextMonitor已准备就绪');

            // 通知其他组件
            this.notifyComponents();
        } catch (error) {
            console.error('[Context Monitor Integration] ❌ ContextMonitor初始化失败:', error);
        }
    }

    // 等待ContextMonitor准备就绪
    async waitForContextMonitor() {
        // 如果已经有真正的ContextMonitor实例
        if (window.contextMonitor && !window.contextMonitor.isTemporary) {
            return window.contextMonitor;
        }

        // 等待contextMonitorReady事件
        return new Promise((resolve, reject) => {
            const handleReady = (event) => {
                window.removeEventListener('contextMonitorReady', handleReady);
                resolve(event.detail.contextMonitor);
            };

            window.addEventListener('contextMonitorReady', handleReady);

            // 设置超时
            setTimeout(() => {
                window.removeEventListener('contextMonitorReady', handleReady);
                reject(new Error('ContextMonitor等待超时'));
            }, 15000);

            // 定期检查是否已经可用
            const checkInterval = setInterval(() => {
                if (window.contextMonitor && !window.contextMonitor.isTemporary) {
                    clearInterval(checkInterval);
                    window.removeEventListener('contextMonitorReady', handleReady);
                    resolve(window.contextMonitor);
                }
            }, 500);
        });
    }

    // 通知其他组件ContextMonitor已准备就绪
    notifyComponents() {
        console.log('[Context Monitor Integration] 通知其他组件...');

        // 更新MessageRenderer
        if (window.messageRenderer) {
            try {
                window.messageRenderer.contextMonitor = this.contextMonitor;
                console.log('[Context Monitor Integration] MessageRenderer的contextMonitor已更新');
            } catch (error) {
                console.error('[Context Monitor Integration] 更新MessageRenderer失败:', error);
            }
        }

        // 更新其他可能使用contextMonitor的组件
        this.updateGlobalReferences();

        // 发送自定义事件
        window.dispatchEvent(new CustomEvent('contextMonitorIntegrationReady', {
            detail: {
                contextMonitor: this.contextMonitor,
                integration: this
            }
        }));
    }

    // 更新全局引用
    updateGlobalReferences() {
        // 确保所有可能的全局引用都指向真正的ContextMonitor
        window.contextMonitor = this.contextMonitor;
        window.globalContextMonitor = this.contextMonitor;
        window.mobileContextMonitor = this.contextMonitor;

        console.log('[Context Monitor Integration] 全局引用已更新');
    }

    // 为其他组件提供安全的ContextMonitor访问
    async getContextMonitor() {
        if (this.isReady && this.contextMonitor) {
            return this.contextMonitor;
        }

        // 等待准备就绪
        await this.readyPromise;
        return this.contextMonitor;
    }

    // 检查ContextMonitor是否可用
    isContextMonitorReady() {
        return this.isReady && this.contextMonitor && !this.contextMonitor.isTemporary;
    }

    // 安全调用ContextMonitor方法
    async safeCall(methodName, ...args) {
        try {
            const monitor = await this.getContextMonitor();
            if (monitor && typeof monitor[methodName] === 'function') {
                return await monitor[methodName](...args);
            } else {
                console.warn(`[Context Monitor Integration] 方法 ${methodName} 不存在`);
                return null;
            }
        } catch (error) {
            console.error(`[Context Monitor Integration] 调用 ${methodName} 失败:`, error);
            return null;
        }
    }

    // 便捷方法：提取当前聊天数据
    async extractFromCurrentChat() {
        return await this.safeCall('extractFromCurrentChat');
    }

    // 便捷方法：获取当前聊天消息
    async getCurrentChatMessages() {
        return await this.safeCall('getCurrentChatMessages');
    }

    // 便捷方法：提取好友消息
    async extractMessagesForFriend(friendId, friendName) {
        return await this.safeCall('extractMessagesForFriend', friendId, friendName);
    }

    // 便捷方法：解析消息格式
    parseMessageFormat(messageContent) {
        if (this.isReady && this.contextMonitor) {
            return this.contextMonitor.parseMessageFormat(messageContent);
        }
        return null;
    }
}

// 创建全局集成实例
window.contextMonitorIntegration = new ContextMonitorIntegration();

// 为其他组件提供便捷的API
window.getContextMonitorSafe = async function() {
    return await window.contextMonitorIntegration.getContextMonitor();
};

window.isContextMonitorAvailable = function() {
    return window.contextMonitorIntegration.isContextMonitorReady();
};

// 为旧代码提供兼容性支持
window.ensureContextMonitor = async function() {
    try {
        return await window.contextMonitorIntegration.getContextMonitor();
    } catch (error) {
        console.error('[Context Monitor Integration] 确保ContextMonitor可用失败:', error);
        return null;
    }
};

// 监听页面加载完成后的初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[Context Monitor Integration] DOM加载完成，集成助手准备就绪');
    });
} else {
    console.log('[Context Monitor Integration] 集成助手准备就绪');
}

console.log('[Context Monitor Integration] 上下文监控器集成模块已加载');
