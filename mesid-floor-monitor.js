/**【施工标记】需大改：
 *现状：机械监听 DOM 楼层增减。
 *目标：重构为“消息定稿监听器”。
 *核心任务：兼容“重roll”机制，只有当消息流结束（Streaming End）时才向手机大脑发送信号。
 *托管模式逻辑：监听 -> 关键词过滤 -> 异步调用 Gemini -> 注入手机数据。
 */
    
/**
 * MesID楼层监听器
 * 专门用于监听 mesid="1" 元素的变化（楼层增减）
 * 版本：1.0.0
 * 作者：Assistant
 */

(function() {
    'use strict';

    // 全局变量
    let observer = null;
    let isMonitoring = false;
    let currentFloorCount = 0;
    let lastFloorCount = 0;
    let callbacks = {
        onFloorAdded: [],
        onFloorRemoved: [],
        onFloorChanged: []
    };

    // 配置选项
    const config = {
        targetSelector: '[mesid="1"]',
        childSelector: '.message', // 假设楼层是 .message 元素
        observerOptions: {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['mesid']
        },
        debounceDelay: 100 // 防抖延迟（毫秒）
    };

    // 防抖函数
    function debounce(func, wait) {
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
     * 楼层监听器类
     */
    class MesIDFloorMonitor {
        constructor() {
            this.initialize();
        }

        initialize() {
            console.log('[MesID楼层监听器] 初始化中...');
            this.setupObserver();
            this.updateFloorCount();
        }

        /**
         * 设置 MutationObserver
         */
        setupObserver() {
            if (observer) {
                observer.disconnect();
            }

            observer = new MutationObserver(debounce((mutations) => {
                this.handleMutations(mutations);
            }, config.debounceDelay));

            console.log('[MesID楼层监听器] Observer 已设置');
        }

        /**
         * 处理 DOM 变化
         */
        handleMutations(mutations) {
            let hasRelevantChange = false;

            for (const mutation of mutations) {
                // 检查是否与 mesid="1" 相关
                if (this.isRelevantMutation(mutation)) {
                    hasRelevantChange = true;
                    break;
                }
            }

            if (hasRelevantChange) {
                this.checkFloorChanges();
            }
        }

        /**
         * 判断是否为相关的变化
         */
        isRelevantMutation(mutation) {
            // 检查目标元素或其子元素是否包含 mesid="1"
            const target = mutation.target;

            // 检查是否直接是 mesid="1" 元素
            if (target.getAttribute && target.getAttribute('mesid') === '1') {
                return true;
            }

            // 检查是否是 mesid="1" 元素的子元素
            const mesidElement = target.closest ? target.closest('[mesid="1"]') : null;
            if (mesidElement) {
                return true;
            }

            // 检查添加或删除的节点
            if (mutation.type === 'childList') {
                // 检查添加的节点
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.getAttribute && node.getAttribute('mesid') === '1') {
                            return true;
                        }
                        if (node.querySelector && node.querySelector('[mesid="1"]')) {
                            return true;
                        }
                    }
                }

                // 检查删除的节点
                for (const node of mutation.removedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.getAttribute && node.getAttribute('mesid') === '1') {
                            return true;
                        }
                        if (node.querySelector && node.querySelector('[mesid="1"]')) {
                            return true;
                        }
                    }
                }
            }

            return false;
        }

        /**
         * 检查楼层变化
         */
        checkFloorChanges() {
            const newFloorCount = this.countFloors();
            const change = newFloorCount - currentFloorCount;

            if (change !== 0) {
                lastFloorCount = currentFloorCount;
                currentFloorCount = newFloorCount;

                const changeInfo = {
                    oldCount: lastFloorCount,
                    newCount: currentFloorCount,
                    change: change,
                    timestamp: new Date().toISOString(),
                    mesidElement: this.getMesidElement()
                };

                console.log('[MesID楼层监听器] 楼层变化:', changeInfo);

                // 触发回调
                if (change > 0) {
                    this.triggerCallbacks('onFloorAdded', changeInfo);
                } else {
                    this.triggerCallbacks('onFloorRemoved', changeInfo);
                }

                this.triggerCallbacks('onFloorChanged', changeInfo);
            }
        }

        /**
         * 统计楼层数量
         */
        countFloors() {
            const mesidElement = this.getMesidElement();
            if (!mesidElement) {
                return 0;
            }

            // 根据实际情况调整选择器
            const floors = mesidElement.querySelectorAll(config.childSelector);
            return floors.length;
        }

        /**
         * 获取 mesid="1" 元素
         */
        getMesidElement() {
            return document.querySelector(config.targetSelector);
        }

        /**
         * 更新楼层计数
         */
        updateFloorCount() {
            currentFloorCount = this.countFloors();
            console.log('[MesID楼层监听器] 当前楼层数:', currentFloorCount);
        }

        /**
         * 触发回调函数
         */
        triggerCallbacks(eventType, data) {
            const callbackList = callbacks[eventType] || [];
            callbackList.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[MesID楼层监听器] 回调执行错误 (${eventType}):`, error);
                }
            });
        }

        /**
         * 开始监听
         */
        start() {
            if (isMonitoring) {
                console.log('[MesID楼层监听器] 已经在监听中');
                return;
            }

            const targetElement = document.body; // 监听整个文档
            if (!targetElement) {
                console.error('[MesID楼层监听器] 目标元素未找到');
                return;
            }

            observer.observe(targetElement, config.observerOptions);
            isMonitoring = true;
            this.updateFloorCount();

            console.log('[MesID楼层监听器] 开始监听楼层变化');
        }

        /**
         * 停止监听
         */
        stop() {
            if (!isMonitoring) {
                console.log('[MesID楼层监听器] 未在监听中');
                return;
            }

            if (observer) {
                observer.disconnect();
            }
            isMonitoring = false;

            console.log('[MesID楼层监听器] 停止监听楼层变化');
        }

        /**
         * 添加回调函数
         */
        addEventListener(eventType, callback) {
            if (!callbacks[eventType]) {
                console.error(`[MesID楼层监听器] 无效的事件类型: ${eventType}`);
                return false;
            }

            if (typeof callback !== 'function') {
                console.error('[MesID楼层监听器] 回调必须是函数');
                return false;
            }

            callbacks[eventType].push(callback);
            console.log(`[MesID楼层监听器] 已添加 ${eventType} 回调`);
            return true;
        }

        /**
         * 移除回调函数
         */
        removeEventListener(eventType, callback) {
            if (!callbacks[eventType]) {
                console.error(`[MesID楼层监听器] 无效的事件类型: ${eventType}`);
                return false;
            }

            const index = callbacks[eventType].indexOf(callback);
            if (index > -1) {
                callbacks[eventType].splice(index, 1);
                console.log(`[MesID楼层监听器] 已移除 ${eventType} 回调`);
                return true;
            }

            return false;
        }

        /**
         * 获取当前状态
         */
        getStatus() {
            return {
                isMonitoring: isMonitoring,
                currentFloorCount: currentFloorCount,
                lastFloorCount: lastFloorCount,
                mesidElement: this.getMesidElement(),
                callbacks: {
                    onFloorAdded: callbacks.onFloorAdded.length,
                    onFloorRemoved: callbacks.onFloorRemoved.length,
                    onFloorChanged: callbacks.onFloorChanged.length
                }
            };
        }

        /**
         * 获取调试信息
         */
        getDebugInfo() {
            const mesidElement = this.getMesidElement();
            return {
                config: config,
                status: this.getStatus(),
                mesidElement: {
                    exists: !!mesidElement,
                    innerHTML: mesidElement ? mesidElement.innerHTML.slice(0, 200) + '...' : null,
                    childCount: mesidElement ? mesidElement.children.length : 0
                },
                observer: {
                    exists: !!observer,
                    isConnected: observer ? true : false
                }
            };
        }

        /**
         * 强制检查楼层变化（用于测试）
         */
        forceCheck() {
            console.log('[MesID楼层监听器] 强制检查楼层变化...');
            this.checkFloorChanges();
        }

        /**
         * 手动设置楼层选择器
         */
        setFloorSelector(selector) {
            config.childSelector = selector;
            console.log(`[MesID楼层监听器] 楼层选择器已更新为: ${selector}`);
            this.updateFloorCount();
        }
    }

    // 创建全局实例
    window.mesidFloorMonitor = new MesIDFloorMonitor();

    // 导出到全局
    window.MesIDFloorMonitor = MesIDFloorMonitor;

    console.log('[MesID楼层监听器] 模块已加载');

    // 如果页面已加载，立即开始监听
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.mesidFloorMonitor.start();
        });
    } else {
        // 延迟启动，确保其他脚本已加载
        setTimeout(() => {
            window.mesidFloorMonitor.start();
        }, 1000);
    }

})();
