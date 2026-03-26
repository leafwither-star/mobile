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

        // 消息指纹记录，用于弹窗去重
        this._lastMsgFingerprint = "";
        this.startBackgroundRadar();   // 必须在这里点火，雷达才会启动

        // === 【新增】中央应用路由映射表 ===
        // 在这里统一管理所有 App 的脚本路径，改这里就行！ [cite: 2026-02-26]
        this.APP_ROUTING = {
            'messages': { js: ['http://43.165.171.111:8091/message-app.js?v=' + Date.now()], css: [] },
            'shop':     { js: ['/scripts/extensions/third-party/mobile/app/shopping-app.js'], css: ['/scripts/extensions/third-party/mobile/app/shopping-app.css'] },
            'task':     { js: ['/scripts/extensions/third-party/mobile/app/profile-app.js'],  css: ['/scripts/extensions/third-party/mobile/app/profile-app.css'] }, // 健康 [cite: 2026-02-26]
            'forum':    { js: ['/scripts/extensions/third-party/mobile/app/forum-app.js'],    css: ['/scripts/extensions/third-party/mobile/app/forum-app.css'] },
            'weibo':    { js: ['/scripts/extensions/third-party/mobile/app/storage-app.js'],  css: ['/scripts/extensions/third-party/mobile/app/storage-app.css'] }, // 收纳 [cite: 2026-02-24]
            'live':     { js: ['/scripts/extensions/third-party/mobile/app/live-app.js'],     css: ['/scripts/extensions/third-party/mobile/app/live-app.css'] },
            'backpack': { js: ['/scripts/extensions/third-party/mobile/app/backpack-app.js'], css: ['/scripts/extensions/third-party/mobile/app/backpack-app.css'] },
            'api':   { js: ['http://43.165.171.111:8091/setting-app.js?v=' + Date.now()], css: [] }, // <-- 加 :8091
            'profile':  { js: ['/scripts/extensions/third-party/mobile/app/diary-app.js'],    css: ['/scripts/extensions/third-party/mobile/app/diary-app.css'] }, // 档案 [cite: 2026-02-26]
            'travel':   { js: ['/scripts/extensions/third-party/mobile/app/travel-app.js'],   css: ['/scripts/extensions/third-party/mobile/app/travel-app.css'] },
            'email':    { js: ['/scripts/extensions/third-party/mobile/app/email-app.js'],    css: ['/scripts/extensions/third-party/mobile/app/email-app.css'] },
            'bill':     { js: ['/scripts/extensions/third-party/mobile/app/bill-app.js'],     css: ['/scripts/extensions/third-party/mobile/app/bill-app.css'] }, // 账单 [cite: 2026-02-24]
            'gemini':   { js: ['/scripts/extensions/third-party/mobile/app/gemini-app.js'],   css: ['/scripts/extensions/third-party/mobile/app/gemini-app.css'] },
            'fanfic':   { js: ['/scripts/extensions/third-party/mobile/app/watch-live.js'],   css: ['/scripts/extensions/third-party/mobile/app/watch-live.css'] }, // <--- 注意这里的逗号！[cite: 2026-02-26]
            'theme': { js: ['http://43.165.171.111:8091/style-app.js?v=' + Date.now()], css: [] }   // <-- 加 :8091
        };

        this.init();
        this.startBackgroundRadar();
    }

    init() {
        this.loadDragHelper();
        this.clearPositionCache(); // 清理位置缓存
        this.createPhoneButton();
        this.createPhoneContainer();
        this.registerApps();
        this.startClock();
        this.initPageSwipe(); // 初始化页面拖拽功能

        // 初始化文字颜色设置
        setTimeout(() => {
            this.initTextColor();
        }, 1000); // 延迟初始化，确保页面加载完成
    }

    // === [系统服务] 后台消息雷达 ===
    startBackgroundRadar() {
        console.log("🛰️ [系统服务] 微信后台消息监听已启动...");
        this.startGlobalPolling('messages');
    }

    // 持续轮询 8091 端口
    // MobilePhone.js 
startGlobalPolling(appId) {
    // 使用独立的锁名，不要跟微信 App 冲突
    if (this._systemRadarRunning) return; 
    this._systemRadarRunning = true;

    const poll = async () => {
        try {
            // 注意：系统雷达只负责“看”，不负责“清空”
            const res = await fetch(`http://43.165.171.111:8091/api/get-result?appId=${appId}&source=system`);
            const data = await res.json();
            
            if (data && data.content) {
                const allBlocks = data.content.match(/\{[\s\S]*?\}/g);
                if (allBlocks) {
                    const lastBlock = allBlocks[allBlocks.length - 1];
                    const fromMatch = lastBlock.match(/FROM:\s*([^|]*)/);
                    const dataMatch = lastBlock.match(/DATA:\s*([^}]*)/);
                    
                    if (fromMatch && dataMatch) {
                        const sender = fromMatch[1].trim();
                        const message = dataMatch[1].trim();
                        const finger = sender + message;

                        // 只有非本人发送，且指纹变了，才弹窗
                        if (sender !== "李至中" && this._lastMsgFingerprint !== finger) {
                            this.showNotification(sender, message);
                            this._lastMsgFingerprint = finger; 
                        }
                    }
                }
            }
        } catch (e) { }
        setTimeout(poll, 3000); // 系统雷达 3 秒一次
    };
    poll();
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

    // 判断是否在 App 内部页面 (通常你的 App 内容会渲染在某个容器里，比如 #full-page-root)
    const appContent = document.getElementById('full-page-root');
    const isInApp = appContent && appContent.style.display === 'block';

    // 如果在 App 内部，且不是在拖拽悬浮球，则禁止翻页逻辑
    if (isInApp && !trigger) {
        console.log('[Mobile Phone] 检测到已进入 App，禁用桌面翻页干扰');
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
            button.innerHTML = '📱';
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


                                <!-- 应用页面容器 -->
                                <div class="app-pages-container">
                                    <div class="app-pages-wrapper" id="app-pages-wrapper">
                                        <!-- 第一页 -->
                                        <div class="app-page">
                                            <div class="app-grid">
                                                <!-- 第一行：信息，购物，任务 -->
                                                <div class="app-row">
                                                    <div class="app-icon" data-app="messages">
                                                        <div class="app-icon-bg pink">💬</div>
                                                        <span class="app-label">微信</span>
                                                    </div>
                                                    <div class="app-icon" data-app="shop">
                                                        <div class="app-icon-bg purple">购</div>
                                                        <span class="app-label">购物</span>
                                                    </div>
                                                    <div class="app-icon" data-app="task">
                                                        <div class="app-icon-bg purple">📰</div>
                                                        <span class="app-label">健康</span>
                                                    </div>
                                                </div>
                                                <!-- 第二行：论坛，微博，直播 -->
                                                <div class="app-row">
                                                    <div class="app-icon" data-app="forum">
                                                        <div class="app-icon-bg red">📰</div>
                                                        <span class="app-label">论坛</span>
                                                    </div>
                                                    <div class="app-icon" data-app="weibo">
                                                        <div class="app-icon-bg orange" style="font-size: 22px;color:rgba(0,0,0,0.4)">微</div>
                                                        <span class="app-label">收纳</span>
                                                    </div>
                                                    <div class="app-icon" data-app="live">
                                                        <div class="app-icon-bg red">🎬</div>
                                                        <span class="app-label">直播</span>
                                                    </div>
                                                </div>
                                                <!-- 第三行：背包，API，设置 -->
                                                <div class="app-row">
                                                    <div class="app-icon" data-app="backpack">
                                                        <div class="app-icon-bg orange">🎒</div>
                                                        <span class="app-label">背包</span>
                                                    </div>
                                                    <div class="app-icon" data-app="api">
                                                        <div class="app-icon-bg orange" style="font-size: 22px;color:rgba(0,0,0,0.4)">AI</div>
                                                        <span class="app-label">设置</span>
                                                    </div>
                                                    <div class="app-icon" data-app="profile">
                                                        <div class="app-icon-bg green">📋</div>
                                                        <span class="app-label">档案</span>
                                                    </div>
                                                </div>

                                            </div>
                                        </div>

                                        <!-- 第二页 -->
                                       <div class="app-page">
    <div class="app-grid">
        <div class="app-row">
            <div class="app-icon" data-app="travel">
                <div class="app-icon-bg">✈️</div>
                <span class="app-label">出行</span>
            </div>
            <div class="app-icon" data-app="email">
                <div class="app-icon-bg">📧</div>
                <span class="app-label">邮箱</span>
            </div>
            <div class="app-icon" data-app="bill">
                <div class="app-icon-bg">💰</div>
                <span class="app-label">账单</span>
            </div>
        </div>

        <div class="app-row">
            <div class="app-icon" data-app="gemini">
                <div class="app-icon-bg">✨</div>
                <span class="app-label">AI</span>
            </div>
            <div class="app-icon" data-app="fanfic">
                <div class="app-icon-bg">📚</div>
                <span class="app-label">AO3</span>
            </div>
            <div class="app-icon" data-app="theme">
                <div class="app-icon-bg">🎨</div>
                <span class="app-label">主题</span>
            </div>
        </div>
    </div>
</div>

                                    <!-- 页面指示器 -->
                                    <div class="page-indicators" id="page-indicators">
                                        <div class="indicator active"></div>
                                        <div class="indicator"></div>
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
            this.returnToAppMain(currentApp); 
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

// 3. 极简的应用注册表（只定义名称，内容由 App 自己注入）
registerApps() {
        this.apps = {
            'messages': { name: '微信', isCustomApp: true }, // [cite: 2026-02-26]
            'shop':     { name: '购物', isCustomApp: true }, // [cite: 2026-02-24]
            'task':     { name: '健康', isCustomApp: true }, // [cite: 2026-02-26]
            'forum':    { name: '论坛', isCustomApp: true }, // [cite: 2026-02-26]
            'weibo':    { name: '收纳', isCustomApp: true }, // [cite: 2026-02-24]
            'live':     { name: '直播', isCustomApp: true }, // [cite: 2026-02-26]
            'backpack': { name: '背包', isCustomApp: true }, // [cite: 2026-02-24]
            'api':      { name: '设置', isCustomApp: true },
            'profile':  { name: '档案', isCustomApp: true }, // [cite: 2026-02-26]
            'travel':   { name: '出行', isCustomApp: true },
            'email':    { name: '邮箱', isCustomApp: true }, // [cite: 2026-02-26]
            'bill':     { name: '账单', isCustomApp: true }, // [cite: 2026-02-24]
            'gemini':   { name: 'AI', isCustomApp: true },
            'fanfic':   { name: 'AO3', isCustomApp: true }, // [cite: 2026-02-26]
            'theme':    { name: '主题', isCustomApp: true }  // [cite: 2026-02-26]
        }; // <-- 这一行必须存在，用来闭合 this.apps
    } // <-- 这一行必须存在，用来闭合 registerApps 函数

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
        
        // 确保样式管理器就绪 (不再使用复杂的异步注入，假定已加载)
        if (window.StyleConfigManager && !window.styleConfigManager) {
            window.styleConfigManager = new window.StyleConfigManager();
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
    if (this.APP_ROUTING[appName]) {
        console.log(`[Mobile] 正在热更新应用源码: ${appName}`);
        // 先把容器清空，避免新旧内容重叠
        if (container) container.innerHTML = '<div style="padding:20px;color:#999;text-align:center;">正在加载最新配置...</div>';
        
        await this.loadRemoteApp(appName);
    }

    // 2. 【UI 切换】隐藏主页，显示应用容器
    if (homeScreen) homeScreen.style.display = 'none';
    if (appScreen) appScreen.style.display = 'block';

    // 3. 【实例激活】确保脚本加载后立即执行 init
    // 即使 loadRemoteApp 内部有 activateApp，这里手动调用一次双保险
    if (container) {
    // 自动寻找匹配的实例：appName 是 'messages'，就去找 window.MobileMessageApp
    const instanceName = 'Mobile' + appName.charAt(0).toUpperCase() + appName.slice(1) + 'App';
    // 特殊情况处理：如果你的 api 对应的是 MobileSettingApp，我们就保持兼容
    let instance = window[instanceName];
    
    if (appName === 'api') instance = window.MobileSettingApp;
    if (appName === 'theme') instance = window.MobileThemeApp;
    if (appName === 'messages') instance = window.MobileMessageApp; // <--- 关键！

    if (instance && typeof instance.init === 'function') {
        instance.init(container);
    } else {
        console.warn(`⚠️ [Mobile] 找不到应用实例或 init 方法: ${instanceName}`);
    }
}
    
    this.currentApp = appName;
    console.log(`✨ [Mobile] ${appName} 已成功进入`);
}

    /**
 * 远程脚本加载器 (增强热更新版)
 * 逻辑：fetch源码 -> 清理旧实例 -> 重新执行注入 -> 初始化UI
 */
async loadRemoteApp(appName) {
    const route = this.APP_ROUTING[appName];
    if (!route || !route.js) return;

    // 1. 【关键】清理内存中的旧实例，防止类定义冲突
    if (appName === 'api') window.MobileSettingApp = null;
    if (appName === 'theme') window.MobileThemeApp = null;
    if (appName === 'messages') window.MobileMessageApp = null; // <--- 补充这一行，确保热重载时旧微信实例被释放

    // 2. 移除旧的脚本标签
    const oldScript = document.getElementById(`remote-script-${appName}`);
    if (oldScript) oldScript.remove();

    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.id = `remote-script-${appName}`;
        const remoteUrl = route.js[0];
        
        // 3. 使用双重随机参数（v 和 t）彻底击穿浏览器缓存 [cite: 2026-03-09]
        script.src = `${remoteUrl}${remoteUrl.includes('?') ? '&' : '?'}v=${Date.now()}&t=${Date.now()}`;
        
        script.onload = () => {
            console.log(`🚀 [HotReload] ${appName} 已重载`);
            const container = document.getElementById('app-content');
            
            // 4. 尝试激活新实例
            const activate = () => {
    // 逻辑同上
    let instance = null;
    if (appName === 'api') instance = window.MobileSettingApp;
    else if (appName === 'theme') instance = window.MobileThemeApp;
    else if (appName === 'messages') instance = window.MobileMessageApp; // <--- 关键！
    else {
        const instanceName = 'Mobile' + appName.charAt(0).toUpperCase() + appName.slice(1) + 'App';
        instance = window[instanceName];
    }

    if (instance && typeof instance.init === 'function') {
        instance.init(container);
        return true;
    }
    return false;
};

            if (!activate()) setTimeout(activate, 50); // 给脚本执行留一点喘息时间
            resolve();
        };

        script.onerror = () => {
            console.error(`❌ 加载失败: ${remoteUrl}`);
            resolve();
        };

        document.head.appendChild(script);
    });
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
        console.log('[Mobile Phone] 手机界面初始化完成');

        // 2. 重新绑定原有的全局工具（确保悬浮窗和 Toast 正常）
        window.showMobileToast = MobilePhone.showToast ? MobilePhone.showToast.bind(MobilePhone) : null;

        // 3. 核心：云端主题静默激活
        const savedTheme = localStorage.getItem('last-theme-name');
        if (savedTheme && savedTheme !== 'default') {
            console.log(`[Theme] 检测到持久化主题: ${savedTheme}，正在强制同步...`);
            fetch(`http://43.133.165.233:8001/api/theme/get?name=${encodeURIComponent(savedTheme)}`)
            .then(res => res.json())
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
// 立即执行初始化
initMobilePhone();
window.showMobileToast = MobilePhone.showToast.bind(MobilePhone);
