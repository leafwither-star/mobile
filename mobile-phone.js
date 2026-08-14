/**
 * 手机前端框架
 * 可爱的iOS风格手机界面
 */

class MobilePhone {
    static showToast(message) {
        let screen = document.querySelector('.mobile-phone-screen');
        if (!screen) return;

        let toast = document.getElementById('mobile-phone-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'mobile-phone-toast';
            toast.className = 'mobile-toast'; // 对应你的 CSS 样式
            screen.appendChild(toast);
        }
        
        toast.textContent = message;
        toast.classList.add('active');
        
        // 2秒后自动消失
        setTimeout(() => {
            toast.classList.remove('active');
        }, 2000);
    }
    constructor() {
        this.isVisible = false;
        this.currentApp = null;
        this.apps = {};
        this.appStack = []; 
        this.currentAppState = null; 
        this.dragHelper = null; 
        this.frameDragHelper = null; 

        // 防抖相关标记
        this._openingApp = null;
        this._goingHome = false;
        this._returningToApp = null;
        this._lastAppIconClick = 0;
        this._lastBackButtonClick = 0;

        // 应用加载状态管理
        this._loadingApps = new Set(); 
        this._userNavigationIntent = null; 
        this._loadingStartTime = {}; 
        this._appLoadPromises = new Map();

        // 消息指纹记录，用于弹窗去重
        this._lastMsgFingerprint = "";

        // GitHub 只保留容器。所有已上线 App 都从手机服务器按需加载。
        this.APP_ROUTING = {
            'messages': { js: ['http://43.165.171.111:8091/message-app.js'], css: [] },
            'api': { js: ['http://43.165.171.111:8091/setting-app.js'], css: [] },
            'theme': { js: ['http://43.165.171.111:8091/style-app.js'], css: [] }
        };

        this.init();
    }

    init() {
        this.loadDragHelper();
        this.clearPositionCache(); // 清理位置缓存
        this.createPhoneButton();
        this.createPhoneContainer();
        this.registerApps();
        this.startClock();
        this.startSystemNotificationRadar();
        this.startGenerationStatusTracker();

        // 初始化文字颜色设置
        setTimeout(() => {
            this.initTextColor();
        }, 1000); // 延迟初始化，确保页面加载完成
    }

    // === [系统服务] 后台消息雷达 ===
    startBackgroundRadar() {
        console.log("🛰️ [系统服务] 微信后台消息监听已启动...");
    }

    async fetchJsonWithTimeout(url, timeout = 8000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, {
                mode: 'cors',
                cache: 'no-store',
                signal: controller.signal
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } finally {
            clearTimeout(timer);
        }
    }

    // 持续轮询 8091 端口
    // MobilePhone.js 
startSystemNotificationRadar() {
    if (this._systemRadarRunning) return;
    this._systemRadarRunning = true;
    this._friendRadarTimestamps = this._friendRadarTimestamps || {};
    this._systemRadarBootstrapped = false;

    const poll = async () => {
        let delay = 5000;
        // 标签页不在前台时没人看得见弹窗，没必要每 3 秒拉一次全量好友状态。
        // 放慢到 20 秒，回到前台后 visibilitychange 会立刻补一次。
        if (document.hidden) {
            this._systemRadarTimer = setTimeout(poll, 20000);
            return;
        }
        try {
            const data = await this.fetchJsonWithTimeout('http://43.165.171.111:8091/api/chat/sync-init');
            this._systemRadarErrorCount = 0;

            if (data.status === "success" && data.friends) {
                const trigger = document.getElementById('mobile-phone-trigger');
                if (trigger) trigger.setAttribute('data-radar-state', 'ready');
                // 遍历所有好友，看谁有新动静
                data.friends.forEach(f => {
                    const lastTimestamp = Number(f.lastTimestamp || 0);
                    if (!f.id || f.id === "李至中" || !lastTimestamp) return;

                    if (!this._systemRadarBootstrapped) {
                        this._friendRadarTimestamps[f.id] = Math.max(Number(this._friendRadarTimestamps[f.id] || 0), lastTimestamp);
                        return;
                    }

                    // 1. 机主发的消息不弹窗
                    // 2. 消息内容不能为空
                    // 3. 时间戳必须比这个联系人的上一次记录大（证明是新消息）
                    if (f.lastMsg && lastTimestamp > (this._friendRadarTimestamps[f.id] || 0)) {
                        
                        const finger = f.id + f.lastMsg;
                        // 指纹双重去重
                        if (this._lastMsgFingerprint !== finger) {
                            console.log(`📡 [雷达] 捕捉到新动态: ${f.id} 说 ${f.lastMsg}`);
                            this.showNotification(f.id, f.lastMsg);
                            
                            // 更新记录
                            this._lastMsgFingerprint = finger;
                        }
                        this._friendRadarTimestamps[f.id] = lastTimestamp;
                    }
                });
                this._systemRadarBootstrapped = true;
            }
        } catch (e) {
            // 跨域或网络错误，静默重试，同时在入口上留下轻量状态，方便排查。
            this._systemRadarErrorCount = (this._systemRadarErrorCount || 0) + 1;
            delay = Math.min(30000, 3000 * (2 ** Math.min(this._systemRadarErrorCount, 4)));
            const trigger = document.getElementById('mobile-phone-trigger');
            if (trigger) trigger.setAttribute('data-radar-state', this._systemRadarErrorCount > 2 ? 'error' : 'retrying');
        }
        this._systemRadarTimer = setTimeout(poll, delay);
    };

    // 回到前台立刻补一次，别让人等满一个慢周期
    document.addEventListener('visibilitychange', () => {
        if (document.hidden || !this._systemRadarRunning) return;
        clearTimeout(this._systemRadarTimer);
        poll();
    });

    poll();
}

    // === 【系统服务】主/副 API 生成进度追踪 ===
startGenerationStatusTracker() {
    if (this._generationStatusTrackerRunning) return;
    this._generationStatusTrackerRunning = true;

    const updateProgressUi = (data) => {
        const trigger = document.getElementById('mobile-phone-trigger');
        if (!trigger) return;

        const main = data?.main || { state: 'idle', progress: 0, label: '' };
        const sub = data?.sub || { state: 'idle', progress: 0, label: '' };
        const activeMain = ['running', 'done', 'error'].includes(main.state);
        const activeSub = ['running', 'done', 'error'].includes(sub.state);
        const activeChannel = activeSub ? sub : main;
        const activeProgress = Math.max(0, Math.min(100, activeChannel.progress || 0));
        const activeState = activeSub ? sub.state : main.state;

        trigger.classList.toggle('mobile-phone-trigger-busy', activeMain || activeSub);
        trigger.classList.toggle('mobile-phone-trigger-sub', activeSub);
        trigger.style.setProperty('--mobile-generation-progress', `${activeProgress}%`);
        trigger.setAttribute('data-main-state', main.state || 'idle');
        trigger.setAttribute('data-sub-state', sub.state || 'idle');
        trigger.setAttribute('data-generation-state', activeState || 'idle');

        const label = [main.label, sub.label].filter(Boolean).join(' / ');
        if (label) trigger.title = label;
    };

    // 【按需变频】原来是雷打不动每秒一次，一天下来 8 万多个请求，
    // 而其中绝大多数时间生成器都是 idle、返回的内容一模一样。
    // 生成中才需要 1 秒级的进度反馈；空闲时 4 秒足够，后台标签页 15 秒。
    const poll = async () => {
        let delay = 4000;
        if (document.hidden) {
            delay = 15000;
        } else {
            try {
                const data = await this.fetchJsonWithTimeout('http://43.165.171.111:8091/api/generation-status');
                updateProgressUi(data);
                const busy = data?.main?.state === 'running' || data?.sub?.state === 'running';
                delay = busy ? 1000 : 4000;
            } catch (e) {
                // 后端不可达时保持静默，避免影响酒馆页面。退避到 8 秒，别把控制台刷爆。
                delay = 8000;
            }
        }
        this._generationStatusTimer = setTimeout(poll, delay);
    };

    // 刚开始生成时用户往往正盯着按钮看，回到前台立刻取一次最新进度
    document.addEventListener('visibilitychange', () => {
        if (document.hidden || !this._generationStatusTrackerRunning) return;
        clearTimeout(this._generationStatusTimer);
        poll();
    });

    poll();
}

    // === 【新增接口】供微信应用注入成功后调用 ===
triggerNotificationFromApp(sender, message) {
    const finger = sender + message;

    // 1. 如果是你自己发的，不弹窗
    if (sender === "李至中") return;

    // 2. 指纹去重，防止瞬间多次触发同一个弹窗
    if (this._lastMsgFingerprint === finger) return;

    console.log(`🔔 [系统雷达] 接收到 App 指令，弹出通知: [${sender}]`);
    
    // 3. 执行你原本就写好的弹窗逻辑
    this.showNotification(sender, message);
    
    // 4. 更新指纹
    this._lastMsgFingerprint = finger;
}
    // 在酒馆主页面绘制弹窗
    showNotification(sender, content) {
        // 1. 播放“叮”的声音
    const playDing = () => {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); 
            oscillator.frequency.exponentialRampToValueAtTime(880.00, audioCtx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.05);
            gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.3);
        } catch(e) { console.log("声音播放受限，需点击页面激活"); }
    };
    playDing();
        // 1. 注入 CSS 样式
        if (!document.getElementById('mobile-notify-style')) {
            const style = document.createElement('style');
            style.id = 'mobile-notify-style';
            style.innerHTML = `
                .wechat-notify {
                    position: fixed; top: -100px; left: 50%; transform: translateX(-50%);
                    width: 320px; background: rgba(255,255,255,0.95); backdrop-filter: blur(10px);
                    border-radius: 14px; padding: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.15);
                    display: flex; align-items: center; transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1); 
                    z-index: 2000000; border: 1px solid rgba(255,255,255,0.2); cursor: pointer;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                }
                .wechat-notify.show { top: 30px; }
                .wechat-notify-avatar { width: 42px; height: 42px; border-radius: 8px; margin-right: 12px; }
                .wechat-notify-body { flex: 1; overflow: hidden; }
                .wechat-notify-title { font-weight: 600; font-size: 14px; color: #000; display: flex; justify-content: space-between; margin-bottom: 2px; }
                .wechat-notify-text { font-size: 13px; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            `;
            document.head.appendChild(style);
        }

        const div = document.createElement('div');
        div.className = 'wechat-notify';
        div.innerHTML = `
            <img class="wechat-notify-avatar" src="https://pic1.imgdb.cn/item/69b99162df27f3bc58093bcc.png">
            <div class="wechat-notify-body">
                <div class="wechat-notify-title"><span>${sender}</span><span style="font-weight:normal;color:#888;font-size:10px;">现在</span></div>
                <div class="wechat-notify-text">${content}</div>
            </div>
        `;
        document.body.appendChild(div);

        // 动画控制
        setTimeout(() => div.classList.add('show'), 100);

        let hideTimer = setTimeout(() => {
            div.classList.remove('show');
            setTimeout(() => div.remove(), 600);
        }, 6000);

        // 交互逻辑
        div.onmouseenter = () => clearTimeout(hideTimer);
        div.onmouseleave = () => {
            hideTimer = setTimeout(() => {
                div.classList.remove('show');
                setTimeout(() => div.remove(), 600);
            }, 2000);
        };

        div.onclick = () => {
            console.log("👆 点击了通知，正在唤起微信...");
            
            // 1. 如果手机界面没打开，先把它弹出来
            if (!this.isVisible) {
                this.createPhoneContainer(); // 确保容器存在
                const container = document.querySelector('.mobile-phone-container');
                if (container) container.style.display = 'block';
                this.isVisible = true;
            }

            // 2. 调用加载微信的逻辑
            // 确保你类中存在 openApp 方法。按照你之前的逻辑，它会去查 APP_ROUTING
            if (typeof this.openApp === 'function') {
                this.openApp('messages');
            } else {
                // 如果没有 openApp，回退到你原本的点击图标逻辑
                const wechatIcon = document.querySelector('.app-icon[data-app="messages"]');
                if (wechatIcon) wechatIcon.click();
            }

            div.remove();
        };
    }
    // === 核心翻页逻辑：带探针版 ===
   initPageSwipe() {
        const self = this;
        this.currentPageIndex = 0;
        this.totalPages = 2;
        this.isDragging = false;
        
        // 【核心修复】将监听器移至全局 window，绕过中间层的拦截
        const startHandler = (e) => self.handleStart(e);
        const moveHandler = (e) => self.handleMove(e);
        const endHandler = (e) => self.handleEnd(e);

        // PC 端：直接在全局捕获 mousedown
        window.addEventListener('mousedown', startHandler, { capture: true, passive: false });
        window.addEventListener('mousemove', moveHandler, { passive: false });
        window.addEventListener('mouseup', endHandler, { capture: true });

        // 移动端保持现状
        window.addEventListener('touchstart', startHandler, { passive: false });
        window.addEventListener('touchmove', moveHandler, { passive: false });
        window.addEventListener('touchend', endHandler);

        // 样式初始化
        setTimeout(() => {
            const wrapper = document.getElementById('app-pages-wrapper');
            if (wrapper) {
                wrapper.style.cursor = 'grab';
                wrapper.style.userSelect = 'none';
                // 彻底禁止图片拖拽干扰
                wrapper.querySelectorAll('img').forEach(img => img.draggable = false);
            }
        }, 500);
    }

    handleStart(e) {
    // 1. 识别目标
    const trigger = e.target.closest('#mobile-phone-trigger');
    const phone = e.target.closest('.mobile-phone-frame') || e.target.closest('#app-pages-wrapper');

    if (!trigger && !phone) return;

    // --- 【核心修复逻辑】 ---
    // 如果点击的是输入框 (input, textarea) 或者 按钮/勾选框，直接退出，不触发拖拽
    const isInput = e.target.tagName === 'INPUT' || 
                    e.target.tagName === 'TEXTAREA' || 
                    e.target.tagName === 'BUTTON' ||
                    e.target.closest('.set-btn'); // 兼容你的自定义按钮类名
    
    if (isInput) return; 

    // 判断是否在 App 内部页面。
    //
    // 【原来判错了对象】原判据是 #full-page-root 是否 display:block，
    // 而那个节点只在微信"打开了某个聊天窗口"时才显示。结果是：
    // 停在微信会话列表 / 通讯录 / 朋友圈时，isInApp 为 false，
    // 于是在 App 里上下滑动列表只要带一点横向分量，就会拖着桌面 wrapper 一起平移，
    // 松手时横移超过 15% 宽度还会真的翻页——回到桌面才发现自己在第二屏。
    // 正确判据是"应用层是否正显示"，也就是 #app-screen。
    const appScreen = document.getElementById('app-screen');
    const isInApp = !!appScreen && appScreen.style.display !== 'none' && appScreen.offsetParent !== null;

    // 如果在 App 内部，且不是在拖拽悬浮球，则禁止翻页逻辑
    if (isInApp && !trigger) {
        return;
    }
    // --- 【修复结束】 ---

    this.isDragging = true;
    this.startX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
    this.startY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
    this.currentX = this.startX;

    if (trigger) {
        this.dragMode = 'trigger';
        this.dragTarget = trigger;
        const rect = trigger.getBoundingClientRect();
        this.initialTriggerX = rect.left;
        this.initialTriggerY = rect.top;
        trigger.style.transition = 'none';
    } else if (phone) {
        this.dragMode = 'page';
        const wrapper = document.getElementById('app-pages-wrapper');
        if (wrapper) {
            wrapper.style.transition = 'none';
            wrapper.style.cursor = 'grabbing';
        }
    }
}
    handleMove(e) {
        if (!this.isDragging) return;
        
        const x = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
        const y = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;
        const deltaX = x - this.startX;
        const deltaY = y - this.startY;
        this.currentX = x;

        if (this.dragMode === 'trigger' && this.dragTarget) {
            // 强行改变悬浮球位置 (PC/手机通用)
            const newX = this.initialTriggerX + deltaX;
            const newY = this.initialTriggerY + deltaY;
            this.dragTarget.style.left = `${newX}px`;
            this.dragTarget.style.top = `${newY}px`;
            this.dragTarget.style.right = 'auto'; // 清除右对齐干扰
            this.dragTarget.style.bottom = 'auto';
        } else if (this.dragMode === 'page') {
            // 原有的翻页逻辑
            const wrapper = document.getElementById('app-pages-wrapper');
            if (!wrapper) return;
            const movePercent = (deltaX / (wrapper.offsetWidth || 320)) * 100;
            const translateX = -(this.currentPageIndex * 100) + movePercent;
            wrapper.style.setProperty('transform', `translateX(${translateX}%)`, 'important');
        }
    }

    handleEnd(e) {
        if (!this.isDragging) return;
        
        const wrapper = document.getElementById('app-pages-wrapper');

        if (this.dragMode === 'page' && wrapper) {
            // --- 翻页结算逻辑开始 ---
            wrapper.style.cursor = 'grab';
            wrapper.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';

            const deltaX = this.currentX - this.startX;
            const phoneWidth = wrapper.offsetWidth || 320;

            // 划过 15% 宽度就翻页
            if (Math.abs(deltaX) > (phoneWidth * 0.15)) {
                if (deltaX < 0 && this.currentPageIndex < this.totalPages - 1) {
                    this.currentPageIndex++;
                } else if (deltaX > 0 && this.currentPageIndex > 0) {
                    this.currentPageIndex--;
                }
            }
            
            // 执行翻页动画
            wrapper.style.transform = `translateX(-${this.currentPageIndex * 100}%)`;
            this.updateIndicators(); 
            // --- 翻页结算逻辑结束 ---
            
        } else if (this.dragMode === 'trigger') {
            // 悬浮球松手逻辑
            if (this.dragTarget) {
                this.dragTarget.style.transition = 'all 0.3s ease';
            }
        }

        // 核心：无论如何都要释放拖拽状态
        this.isDragging = false;
        this.dragMode = null;
        console.log('[Mobile Phone] 拖拽结束，状态已重置');
    }

    goToPage(pageIndex) {
        if (pageIndex < 0 || pageIndex >= this.totalPages) return;
        this.currentPageIndex = pageIndex;
        const wrapper = document.getElementById('app-pages-wrapper');
        if (wrapper) wrapper.style.transform = `translateX(-${pageIndex * 100}%)`;
        this.updateIndicators();
    }

    updateIndicators() {
        const indicators = document.querySelectorAll('.indicator');
        indicators.forEach((indicator, index) => {
            indicator.classList.toggle('active', index === this.currentPageIndex);
        });
    }

    loadDragHelper() {
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = '/scripts/extensions/third-party/mobile/drag-helper.css';
        document.head.appendChild(cssLink);

        if (typeof DragHelper === 'undefined') {
            const script = document.createElement('script');
            script.src = '/scripts/extensions/third-party/mobile/drag-helper.js';
            script.onload = () => console.log('[Mobile Phone] 拖拽插件加载成功');
            document.head.appendChild(script);
        }
    }

    createPhoneButton() {
        try {
            const existingButton = document.getElementById('mobile-phone-trigger');
            if (existingButton) existingButton.remove();

            const button = document.createElement('button');
            button.id = 'mobile-phone-trigger';
            button.className = 'mobile-phone-trigger';
            button.innerHTML = `
                <span class="mobile-trigger-icon">📱</span>
                <span class="mobile-trigger-progress"></span>
            `;
            // 【关键】强制提升悬浮球层级，防止被主题 App 遮挡
            button.style.zIndex = "99999";
            button.style.position = "fixed";
            
            button.addEventListener('click', () => this.togglePhone());
            if (!document.body) {
                setTimeout(() => this.createPhoneButton(), 100);
                return;
            }
            document.body.appendChild(button);
            this.initDragForButton(button);
        } catch (error) {
            console.error('[Mobile Phone] 创建按钮错误:', error);
        }
    }

    initDragForButton(button) {
        const tryInitDrag = () => {
            if (typeof DragHelper !== 'undefined') {
                if (this.dragHelper) this.dragHelper.destroy();
                this.dragHelper = new DragHelper(button, {
                    boundary: document.body,
                    clickThreshold: 8,
                    dragClass: 'mobile-phone-trigger-dragging',
                    savePosition: false,
                });
            } else {
                setTimeout(tryInitDrag, 100);
            }
        };
        tryInitDrag();
    }

    clearPositionCache() {
        localStorage.removeItem('mobile-phone-trigger-position');
        localStorage.removeItem('mobile-phone-frame-position');
    }

    initFrameDrag() {
        const tryInitFrameDrag = () => {
            if (typeof DragHelper !== 'undefined') {
                const phoneFrame = document.querySelector('.mobile-phone-frame');
                if (phoneFrame) {
                    if (this.frameDragHelper) this.frameDragHelper.destroy();
                    this.frameDragHelper = new DragHelper(phoneFrame, {
                        boundary: document.body,
                        clickThreshold: 10,
                        dragHandle: '.mobile-status-bar',
                        savePosition: false,
                    });
                }
            } else {
                setTimeout(tryInitFrameDrag, 100);
            }
        };
        tryInitFrameDrag();
    }
    
    // 创建手机容器
    createPhoneContainer() {
        try {
            // 检查是否已经存在容器
            const existingContainer = document.getElementById('mobile-phone-container');
            if (existingContainer) {
                console.log('[Mobile Phone] 容器已存在，移除旧容器');
                existingContainer.remove();
            }

            const container = document.createElement('div');
            container.id = 'mobile-phone-container';
            container.className = 'mobile-phone-container';
            container.style.display = 'none';

            container.innerHTML = `
                <div class="mobile-phone-overlay"></div>
                <div class="mobile-phone-frame">
                    <div class="mobile-phone-screen">
                        <!-- 状态栏 -->
                        <div class="mobile-status-bar">
                            <div class="status-left">
                                <span class="time" id="mobile-time">08:08</span>
                            </div>
                            <div class="status-center">
                                <div class="dynamic-island"></div>
                            </div>
                            <div class="status-right">
                                <span class="battery">
                                    <span class="battery-icon">🔋</span>
                                    <span class="battery-text">100%</span>
                                </span>
                            </div>
                        </div>

                        <!-- 主内容区域 -->
                        <div class="mobile-content" id="mobile-content">
                            <!-- 主界面 -->
                            <div class="home-screen" id="home-screen">
                                <!-- 时间天气卡片 -->
                                <div class="weather-card">
                                    <div class="weather-time">
                                        <span class="current-time" id="home-time">08:08</span>
                                        <span class="current-date" id="home-date">08/21</span>
                                    </div>
                                    <div class="weather-info">
                                        <span class="weather-desc">多云转小雨</span>
                                    </div>
                                </div>


                                <!-- 仅保留已迁移到服务器的应用入口 -->
                                <div class="app-pages-container">
                                    <div class="app-pages-wrapper" id="app-pages-wrapper">
                                        <div class="app-page">
                                            <div class="app-grid">
                                                <div class="app-row">
                                                    <div class="app-icon" data-app="messages">
                                                        <div class="app-icon-bg pink">💬</div>
                                                        <span class="app-label">微信</span>
                                                    </div>
                                                    <div class="app-icon" data-app="api">
                                                        <div class="app-icon-bg orange">⚙️</div>
                                                        <span class="app-label">设置</span>
                                                    </div>
                                                    <div class="app-icon" data-app="theme">
                                                        <div class="app-icon-bg purple">🎨</div>
                                                        <span class="app-label">主题</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                </div>

                            </div>

                            <!-- 应用界面容器 -->
                            <div class="app-screen" id="app-screen" style="display: none;">
                                <div class="app-header" id="app-header">
                                    <button class="back-button" id="back-button">
                                        <span class="back-icon">←</span>
                                    </button>
                                    <h1 class="app-title" id="app-title">应用</h1>
                                    <div class="app-header-right" id="app-header-right">
                                        <!-- 动态功能按钮将在这里添加 -->
                                    </div>
                                </div>
                                <div class="app-content" id="app-content">
                                    <!-- 应用内容将在这里动态加载 -->
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // 确保body存在
            if (!document.body) {
                console.error('[Mobile Phone] document.body 不存在，延迟创建容器');
                setTimeout(() => this.createPhoneContainer(), 100);
                return;
            }

            document.body.appendChild(container);
            this.bindEvents();

            // 为手机框架添加拖拽功能
            this.initFrameDrag();

            console.log('[Mobile Phone] 手机容器创建成功');
        } catch (error) {
            console.error('[Mobile Phone] 创建容器时发生错误:', error);
        }
    }

    /**
     * 1. 核心事件绑定：仅处理手机壳层面的交互
     */
    bindEvents() {
        // 点击遮罩层关闭手机（保持手机壳物理逻辑）
        document.querySelector('.mobile-phone-overlay').addEventListener('click', () => {
            const isCompatibilityMode =
                window.MobileContextPlugin?.getSettings?.().tavernCompatibilityMode;

            if (!isCompatibilityMode) {
                this.hidePhone();
            }
        });

        // 物理返回按钮逻辑
        document.getElementById('back-button').addEventListener('click', () => {
            // 防抖：300ms内仅触发一次
            if (this._lastBackButtonClick && Date.now() - this._lastBackButtonClick < 300) return;
            this._lastBackButtonClick = Date.now();

            this.handleBackButton();
        });

        // 桌面应用图标点击
        document.querySelectorAll('.app-icon').forEach(icon => {
            icon.addEventListener('click', e => {
                const appName = e.currentTarget.getAttribute('data-app');
                
                // 防抖
                if (this._lastAppIconClick && Date.now() - this._lastAppIconClick < 300) return;
                this._lastAppIconClick = Date.now();

                // 统一入口：打开App（具体逻辑由openApp处理）
                this.openApp(appName);
            });
        });
    }

    /**
     * 2. 物理返回逻辑：仅负责层级判断，不干涉App内部业务
     */
    handleBackButton() {
        console.log('[Mobile Phone] 按下物理返回键');
        this._userNavigationIntent = null; // 清除自动导航意图

        if (!this.currentAppState) {
            this.goHome();
            return;
        }

        const currentApp = this.currentAppState.app;
        
        // 调用各模块提供的根路径判断逻辑 (isCurrentlyAtAppRoot 在各App模块中实现)
        // 如果模块没提供，则默认使用 state.view === 'main' 判断
        const atRoot = this.isCurrentlyAtAppRoot 
            ? this.isCurrentlyAtAppRoot(currentApp, this.currentAppState)
            : (this.currentAppState.view === 'main' || !this.currentAppState.view);

        if (!atRoot) {
            // 非根页面：通知对应App模块执行“返回主界面”动作
            console.log(`[Mobile Phone] ${currentApp} 正在从二级页面返回...`);
            // returnToAppMain 从来没有被定义过——一旦真有 App 用 pushAppState 登记过
            // 二级页面，这里会直接抛 TypeError，把返回键卡死在二级页。
            // 优先让 App 自己处理返回，处理不了就退回桌面，总之不能崩。
            if (typeof this.returnToAppMain === 'function') {
                this.returnToAppMain(currentApp);
            } else {
                const instance = this.resolveAppInstance(currentApp);
                if (instance && typeof instance.returnToMain === 'function') {
                    instance.returnToMain();
                } else {
                    console.warn(`[Mobile Phone] ${currentApp} 未提供返回主界面的入口，直接回桌面`);
                    this.goHome();
                }
            }
        } else {
            // 已经在App首页：直接退回手机桌面
            this.goHome();
        }
    }

    /**
     * 3. 应用头部渲染：彻底去除 App 内部判断，改为【数据注入】
     * 只要 state 里定义了 buttons，这里就负责渲染出来
     */
    updateAppHeader(state) {
        const titleElement = document.getElementById('app-title');
        const headerRight = document.getElementById('app-header-right');
        const appScreen = document.getElementById('app-screen');

        if (!state) {
            titleElement.textContent = '应用';
            headerRight.innerHTML = '';
            return;
        }

        // A. 更新标题
        titleElement.textContent = state.title || this.apps[state.app]?.name || '应用';

        // B. 数据注入：更新 DOM 状态机标记（CSS 会用到这些 data-app 属性）
        if (appScreen) {
            appScreen.setAttribute('data-app', state.app || '');
            appScreen.setAttribute('data-view', state.view || 'main');
            
            // 自动标记是否是根页面，用于 CSS 隐藏/显示物理返回键
            const isRoot = (state.view === 'main' || !state.view);
            appScreen.classList.toggle('is-app-root', isRoot);
        }

        // C. 清理并动态注入功能按钮
        headerRight.innerHTML = '';

        // 如果 state 中携带了按钮定义，则循环创建
        // 格式示例: buttons: [{ icon: 'fas fa-sync', action: () => {...}, title: '刷新' }]
        if (state.buttons && Array.isArray(state.buttons)) {
            state.buttons.forEach(btnConfig => {
                const btn = document.createElement('button');
                btn.className = `app-header-btn ${btnConfig.className || ''}`;
                
                // 支持图标(HTML)或纯文字
                btn.innerHTML = btnConfig.icon ? `<i class="${btnConfig.icon}"></i>` : (btnConfig.text || '');
                if (btnConfig.title) btn.title = btnConfig.title;
                
                // 绑定点击事件
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (typeof btnConfig.action === 'function') {
                        btnConfig.action();
                    }
                });
                
                headerRight.appendChild(btn);
            });
        }
    }

   // 1. 通用的状态推送（删除具体业务字段对比）
pushAppState(state) {
    if (!state || !state.app) return;

    // 只要当前状态和新状态的字符串表现一致，就跳过
    if (this.currentAppState && JSON.stringify(this.currentAppState) === JSON.stringify(state)) {
        return;
    }

    this.appStack.push(state);
    this.currentAppState = state;
    this.updateAppHeader(state);
}

// 2. 彻底删除所有 refreshMessages, showMessageList, generateFriendsCircleContent 等具体方法
// 因为这些现在都通过 state.buttons 的 action 动态执行了。

// 极简应用注册表：内容全部由服务器脚本注入。
registerApps() {
        this.apps = {
            'messages': { name: '微信', isCustomApp: true },
            'api':      { name: '设置', isCustomApp: true },
            'theme':    { name: '主题', isCustomApp: true }
        };
    }

   /**
 * 极简重构版：手机生命周期与导航管理器
 */
    // --- 1. 显示控制 (生命周期) ---
    
    togglePhone() {
        this.isVisible ? this.hidePhone() : this.showPhone();
    }

    showPhone() {
        const container = document.getElementById('mobile-phone-container');
        container.style.display = 'flex';
        // 强制重绘后添加 active 类触发 CSS 动画
        void container.offsetWidth; 
        container.classList.add('active');
        
        this.isVisible = true;

        // 如果上次有打开的应用，直接恢复
        if (this.currentAppState) {
            this.restoreAppState(this.currentAppState);
        }
    }

    hidePhone() {
        const container = document.getElementById('mobile-phone-container');
        container.classList.remove('active');
        // 等待 CSS 过渡动画结束后隐藏
        setTimeout(() => {
            if (!this.isVisible) container.style.display = 'none';
        }, 300);
        this.isVisible = false;
    }

    // --- 2. 应用导航 (核心引擎) ---
    /**
 * 打开应用：热更新与 UI 切换引擎
 */
async openApp(appName) {
    const app = this.apps[appName];
    if (!app) return;

    const container = document.getElementById('app-content');
    const homeScreen = document.getElementById('home-screen'); // 手机主页 ID
    const appScreen = document.getElementById('app-screen');   // 容器页面 ID

    // 1. 【热更新】如果是路由表里的应用，强制拉取内存副本
    //    注意：loadRemoteApp 的 script.onload 里已经完成了实例激活（init），
    //    所以这里**不能**再补一次。原来那句"双保险"会让每次开 App 都初始化两遍：
    //    两份 fetch、两轮渲染，界面开场就闪一下。
    let remoteHandled = false;
    if (this.APP_ROUTING[appName]) {
        console.log(`[Mobile] 正在热更新应用源码: ${appName}`);
        // 先把容器清空，避免新旧内容重叠
        if (container) container.innerHTML = '<div style="padding:20px;color:#999;text-align:center;">正在加载最新配置...</div>';

        remoteHandled = await this.loadRemoteApp(appName);
    }

    // 2. 【UI 切换】隐藏主页，显示应用容器
    if (homeScreen) homeScreen.style.display = 'none';
    if (appScreen) appScreen.style.display = 'block';

    // 3. 【实例激活】只负责本地应用，以及远程激活失败时的兜底
    if (container && !remoteHandled) {
        const instance = this.resolveAppInstance(appName);
        if (instance && typeof instance.init === 'function') {
            instance.init(container);
        } else {
            console.warn(`⚠️ [Mobile] 找不到应用实例或 init 方法: ${appName}`);
        }
    }

    this.currentApp = appName;
    console.log(`✨ [Mobile] ${appName} 已成功进入`);
}

/**
 * 把裸地址换成「带真实版本号」的地址，兼顾缓存与热更新。
 *
 * 【为什么不能再用 Date.now()】那样每次都是新 URL，浏览器缓存 100% 落空，
 * 705KB 的 message-app.js 每进一次微信就重下一次。
 *
 * 【为什么也不能直接用裸地址】服务端发的是 Cache-Control: public, max-age=0，
 * 按规范浏览器每次都该回源复验（拿 304）。但 Chrome 的内存缓存在同一次页面
 * 会话里可能跳过复验直接复用——那样你在服务器上传了新脚本，退出再进来却看不到
 * 变化，热更新会**偶发失灵**。构建期最怕的就是这种偶发。
 *
 * 【所以先探一次 HEAD】拿服务端文件的 Last-Modified 当版本号：
 *   · 文件没变 → 版本号不变 → URL 不变 → 走缓存（705KB 变成一个 304，几百字节）
 *   · 文件变了 → 版本号跟着变 → URL 变 → 强制取新的，热更新照旧生效
 * HEAD 请求本身只有几百字节，而且 Last-Modified 属于 CORS 安全清单里的响应头，
 * 跨域可以直接读，服务端一行都不用改。
 * （下面的 etag 只是个兜底位：ETag 不在安全清单里，跨域其实读不到，
 *   读不到就退回裸地址，行为不受影响。）
 */
async resolveVersionedUrl(baseUrl) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
        const res = await fetch(baseUrl, {
            method: 'HEAD',
            cache: 'no-store',
            mode: 'cors',
            signal: controller.signal
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const stamp = res.headers.get('last-modified') || res.headers.get('etag') || '';
        const token = stamp ? String(Date.parse(stamp) || stamp).replace(/[^a-zA-Z0-9]/g, '') : '';
        if (!token) return baseUrl;
        return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}v=${token}`;
    } catch (e) {
        console.warn(`[Mobile] 版本探测失败，回退裸地址: ${baseUrl}`, e && e.message);
        return baseUrl;
    } finally {
        clearTimeout(timeout);
    }
}

    /** 路由名 → 全局实例。openApp 与 loadRemoteApp 用同一份映射，避免两处各写一遍走岔。 */
resolveAppInstance(appName) {
    if (appName === 'api') return window.MobileSettingApp;
    if (appName === 'theme') return window.MobileThemeApp;
    if (appName === 'messages') return window.MobileMessageApp;
    return window['Mobile' + appName.charAt(0).toUpperCase() + appName.slice(1) + 'App'];
}

/** 远程脚本加载器：缓存友好、并发去重、超时重试，并保留可用旧实例。 */
async loadRemoteApp(appName) {
    const route = this.APP_ROUTING[appName];
    if (!route || !route.js) return false;
    if (this._appLoadPromises.has(appName)) return this._appLoadPromises.get(appName);

    const task = (async () => {
        const previousInstance = this.resolveAppInstance(appName);
        const baseUrl = await this.resolveVersionedUrl(route.js[0]);
        const maxAttempts = 3;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            const attemptUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}retry=${attempt}`;
            const loaded = await new Promise(resolve => {
                const script = document.createElement('script');
                const id = `remote-script-${appName}`;
                const oldScript = document.getElementById(id);
                if (oldScript) oldScript.remove();

                script.id = id;
                script.src = attemptUrl;
                script.async = true;

                const timer = setTimeout(() => {
                    script.remove();
                    resolve(false);
                }, 60000);

                script.onload = () => {
                    clearTimeout(timer);
                    resolve(true);
                };
                script.onerror = () => {
                    clearTimeout(timer);
                    script.remove();
                    resolve(false);
                };
                document.head.appendChild(script);
            });

            const instance = this.resolveAppInstance(appName);
            if (loaded && instance && instance !== previousInstance && typeof instance.init === 'function') {
                instance.init(document.getElementById('app-content'));
                console.log(`[Mobile] ${appName} 远程模块加载成功（第 ${attempt} 次）`);
                return true;
            }

            if (attempt < maxAttempts) {
                const delay = 1000 * (2 ** (attempt - 1)) + Math.floor(Math.random() * 400);
                console.warn(`[Mobile] ${appName} 加载未完成，${delay}ms 后重试`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        // 热更新失败时不要销毁已经可用的旧实例。
        if (previousInstance && typeof previousInstance.init === 'function') {
            previousInstance.init(document.getElementById('app-content'));
            console.warn(`[Mobile] ${appName} 网络加载失败，已回退到当前会话缓存`);
            return true;
        }

        const container = document.getElementById('app-content');
        if (container) {
            container.innerHTML = `<div class="mobile-load-error">
                <p>应用加载失败，请检查网络后重试。</p>
                <button type="button" onclick="window.mobilePhone.openApp('${appName}')">重新加载</button>
            </div>`;
        }
        return false;
    })().finally(() => this._appLoadPromises.delete(appName));

    this._appLoadPromises.set(appName, task);
    return task;
}
    
    /**
     * 渲染应用界面 - 丝滑平移优化版
     */
    renderAppState(app, state) {
        this.updateAppHeader(state);
        
        const homeScreen = document.getElementById('home-screen');
        const appScreen = document.getElementById('app-screen');
        const appContent = document.getElementById('app-content');

        homeScreen.style.display = 'none';
        appScreen.style.display = 'block';
        
        // 关键：在填充新内容前，先把旧的彻底清掉，防止两个App的内容重叠导致弹跳
        appContent.innerHTML = ''; 

        if (app.isCustomApp && app.customHandler) {
            app.customHandler(state);
        } else {
            appContent.innerHTML = app.content || '';
        }

        // 暂时注释掉动画，或者只用最简单的渐现
        appScreen.classList.add('slide-in'); 
        setTimeout(() => appScreen.classList.remove('slide-in'), 300);
    }
    
    // --- 3. 状态管理 (返回键逻辑) ---

    pushAppState(state) {
        if (!state || !state.app) return;
        
        // 简单的重复性检查
        const top = this.appStack[this.appStack.length - 1];
        if (top && JSON.stringify(top) === JSON.stringify(state)) return;

        this.appStack.push(state);
        this.currentAppState = state;
        this.updateAppHeader(state);
    }

    goBack() {
        if (this.appStack.length <= 1) {
            this.backToHome();
            return;
        }

        this.appStack.pop(); // 弹出当前
        const prevState = this.appStack[this.appStack.length - 1];
        this.currentAppState = prevState;
        
        // 重新渲染上一级界面
        const app = this.apps[prevState.app];
        this.renderAppState(app, prevState);
    }

    backToHome() {
        this.currentApp = null;
        this.currentAppState = null;
        this.appStack = [];
        
        document.getElementById('app-screen').style.display = 'none';
        document.getElementById('home-screen').style.display = 'block';
    }

   // --- 以下是补全的导航与生命周期逻辑 ---

    stopStateSyncLoop() {
        if (this._syncTimer) {
            clearInterval(this._syncTimer);
            this._syncTimer = null;
            console.log('[Mobile] 后台同步已停止');
        }
    }

    goHome() {
        if (this._goingHome) return;
        if (!this.currentApp && !this.currentAppState && this.appStack.length === 0) return;

        this._goingHome = true;
        try {
            console.log('[Mobile Phone] 返回主界面');
            this.currentApp = null;
            this.currentAppState = null;
            this.appStack = []; 

            const homeScreen = document.getElementById('home-screen');
            const appScreen = document.getElementById('app-screen');
            if (homeScreen) homeScreen.style.display = 'block';
            if (appScreen) appScreen.style.display = 'none';

            this.stopStateSyncLoop();
        } finally {
            setTimeout(() => { this._goingHome = false; }, 300);
        }
    }

    startClock() {
        const updateTime = () => {
            const now = new Date();
            const timeString = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
            const dateString = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
            const mobileTime = document.getElementById('mobile-time');
            const homeTime = document.getElementById('home-time');
            const homeDate = document.getElementById('home-date');
            if (mobileTime) mobileTime.textContent = timeString;
            if (homeTime) homeTime.textContent = timeString;
            if (homeDate) homeDate.textContent = dateString;
        };
        updateTime();
        setInterval(updateTime, 1000);
    }

    initTextColor() {
        if (window.styleConfigManager && window.styleConfigManager.getConfig) {
            const config = window.styleConfigManager.getConfig();
            this.applyTextColor(config.messageTextColor || 'black');
        } else {
            const savedColor = localStorage.getItem('messageTextColor') || 'black';
            this.applyTextColor(savedColor);
        }
    }

    applyTextColor(color) {
        document.body.classList.remove('text-color-white', 'text-color-black');
        document.body.classList.add(`text-color-${color}`);
        document.documentElement.style.setProperty('--message-text-color', color === 'white' ? '#fff' : '#000');
    }
} // <--- 类到此为止完全结束

// --- 修复后的外部初始化逻辑 ---
function initMobilePhone() {
    if (!window.mobilePhone) {
        // 1. 正常执行手机类实例化
        window.mobilePhone = new MobilePhone();
        window.mobilePhone.showToast = MobilePhone.showToast.bind(MobilePhone);
        window.MobilePhone = window.mobilePhone;
        window.MobilePhoneClass = MobilePhone;
        console.log('[Mobile Phone] 手机界面初始化完成');

        // 2. 重新绑定原有的全局工具（确保悬浮窗和 Toast 正常）
        window.showMobileToast = MobilePhone.showToast ? MobilePhone.showToast.bind(MobilePhone) : null;

        // 3. 核心：云端主题静默激活
        const savedTheme = localStorage.getItem('last-theme-name');
        if (savedTheme && savedTheme !== 'default') {
            console.log(`[Theme] 检测到持久化主题: ${savedTheme}，正在强制同步...`);
            // 主题服务在另一台机器上（云酒馆 43.133.165.233:8001），跟手机后端 8091 不是同一个进程。
            // 它挂掉时开机路径不该跟着一起等：给 6 秒硬上限，超时就用默认外观继续启动。
            const themeAbort = new AbortController();
            const themeTimeout = setTimeout(() => themeAbort.abort(), 6000);
            fetch(`http://43.133.165.233:8001/api/theme/get?name=${encodeURIComponent(savedTheme)}`, { signal: themeAbort.signal })
            .then(res => { clearTimeout(themeTimeout); return res.json(); })
            .then(config => {
                window.themeState = config; // 同步给设置 App 使用
                
                // A. 注入全局 CSS 强力样式表
                let bruteStyle = document.getElementById('brute-force-theme');
                if (!bruteStyle) {
                    bruteStyle = document.createElement('style');
                    bruteStyle.id = 'brute-force-theme';
                    document.head.appendChild(bruteStyle);
                }
                
                const hex = config.wtrBg || "#ffffff";
                const r = parseInt(hex.slice(1,3), 16), g = parseInt(hex.slice(3,5), 16), b = parseInt(hex.slice(5,7), 16);
                
                bruteStyle.innerHTML = `
                    #home-screen { background-image: url('${config.bgUrl || ''}') !important; background-position: ${config.bgX || 50}% ${config.bgY || 50}% !important; background-size: cover !important; }
                    #home-time { color: ${config.timeClr || '#fff'} !important; font-size: ${config.timeSize || 48}px !important; }
                    #home-date { color: ${config.dateClr || '#fff'} !important; font-size: ${config.dateSize || 16}px !important; }
                    .weather-info { background-color: rgba(${r},${g},${b},${config.wtrOp || 0.3}) !important; }
                    .weather-desc, .weather-temp, .weather-icon { color: ${config.wtrTxt || '#fff'} !important; }
                `;

                // B. 注入图标替换
                if (config.icons) {
                    Object.keys(config.icons).forEach(id => {
                        let iconStyleId = `icon-style-${id}`;
                        let iconStyle = document.getElementById(iconStyleId);
                        if (!iconStyle) {
                            iconStyle = document.createElement('style');
                            iconStyle.id = iconStyleId;
                            document.head.appendChild(iconStyle);
                        }
                        iconStyle.innerHTML = `.app-icon[data-app='${id}'] .app-icon-bg { background-image: url('${config.icons[id]}') !important; background-color: transparent !important; }`;
                    });
                }
            })
            .catch(e => console.error("[Theme] 开机同步失败:", e));
        }
    }
}
// 【脚本末尾 - 单例启动】
// 只允许创建一个手机实例，避免刷新或重复加载时按钮/容器互相覆盖。
const startMobilePhoneOnce = () => {
    initMobilePhone();
    if (window.mobilePhone) {
        window.mobilePhone.showToast = MobilePhone.showToast.bind(MobilePhone);
        window.MobilePhone = window.mobilePhone;
        window.MobilePhoneClass = MobilePhone;
        window.showMobileToast = MobilePhone.showToast.bind(MobilePhone);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startMobilePhoneOnce, { once: true });
} else {
    startMobilePhoneOnce();
}
