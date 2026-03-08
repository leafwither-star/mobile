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

        // === 【新增】中央应用路由映射表 ===
        // 在这里统一管理所有 App 的脚本路径，改这里就行！ [cite: 2026-02-26]
        this.APP_ROUTING = {
            'messages': { js: ['/scripts/extensions/third-party/mobile/app/message-app.js'], css: ['/scripts/extensions/third-party/mobile/app/message-app.css'] },
            'shop':     { js: ['/scripts/extensions/third-party/mobile/app/shopping-app.js'], css: ['/scripts/extensions/third-party/mobile/app/shopping-app.css'] },
            'task':     { js: ['/scripts/extensions/third-party/mobile/app/profile-app.js'],  css: ['/scripts/extensions/third-party/mobile/app/profile-app.css'] }, // 健康 [cite: 2026-02-26]
            'forum':    { js: ['/scripts/extensions/third-party/mobile/app/forum-app.js'],    css: ['/scripts/extensions/third-party/mobile/app/forum-app.css'] },
            'weibo':    { js: ['/scripts/extensions/third-party/mobile/app/storage-app.js'],  css: ['/scripts/extensions/third-party/mobile/app/storage-app.css'] }, // 收纳 [cite: 2026-02-24]
            'live':     { js: ['/scripts/extensions/third-party/mobile/app/live-app.js'],     css: ['/scripts/extensions/third-party/mobile/app/live-app.css'] },
            'backpack': { js: ['/scripts/extensions/third-party/mobile/app/backpack-app.js'], css: ['/scripts/extensions/third-party/mobile/app/backpack-app.css'] },
            'api':      { js: ['/scripts/extensions/third-party/mobile/app/app/style-config-manager.js'], css: ['/scripts/extensions/third-party/mobile/app/style-config-manager.css'] }, // 设置
            'profile':  { js: ['/scripts/extensions/third-party/mobile/app/diary-app.js'],    css: ['/scripts/extensions/third-party/mobile/app/diary-app.css'] }, // 档案 [cite: 2026-02-26]
            'travel':   { js: ['/scripts/extensions/third-party/mobile/app/travel-app.js'],   css: ['/scripts/extensions/third-party/mobile/app/travel-app.css'] },
            'email':    { js: ['/scripts/extensions/third-party/mobile/app/email-app.js'],    css: ['/scripts/extensions/third-party/mobile/app/email-app.css'] },
            'bill':     { js: ['/scripts/extensions/third-party/mobile/app/bill-app.js'],     css: ['/scripts/extensions/third-party/mobile/app/bill-app.css'] }, // 账单 [cite: 2026-02-24]
            'gemini':   { js: ['/scripts/extensions/third-party/mobile/app/gemini-app.js'],   css: ['/scripts/extensions/third-party/mobile/app/gemini-app.css'] },
            'fanfic':   { js: ['/scripts/extensions/third-party/mobile/app/watch-live.js'],   css: ['/scripts/extensions/third-party/mobile/app/watch-live.css'] } // AO3 [cite: 2026-02-26]
       'theme':    { 
        js: ['http://43.165.171.111/style-app.js'], 
        css: [] // 如果以后有远程 CSS 也可以填在这里 [cite: 2026-02-26]
    }
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
        this.initPageSwipe(); // 初始化页面拖拽功能

        // 初始化文字颜色设置
        setTimeout(() => {
            this.initTextColor();
        }, 1000); // 延迟初始化，确保页面加载完成
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

        this.isDragging = true;
        // 记录起始点
        this.startX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
        this.startY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
        this.currentX = this.startX;

        if (trigger) {
            // === 模式 A：拖拽悬浮球 ===
            this.dragMode = 'trigger';
            this.dragTarget = trigger;
            // 记录按钮当前的初始位置
            const rect = trigger.getBoundingClientRect();
            this.initialTriggerX = rect.left;
            this.initialTriggerY = rect.top;
            trigger.style.transition = 'none'; // 拖动时禁止动画
        } else if (phone) {
            // === 模式 B：内部翻页 ===
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
        'messages': { name: '微信', isCustomApp: true },  // 对应 李律师的核心功能
        'shop':     { name: '购物', isCustomApp: true },
        'task':     { name: '健康', isCustomApp: true },  // 解决了 Task 报错问题
        'forum':    { name: '论坛', isCustomApp: true }, // 法律人/本地论坛
        'weibo':    { name: '收纳', isCustomApp: true },  // 强制把名字改成“收纳”！
        'live':     { name: '直播', isCustomApp: true },
        'backpack': { name: '背包', isCustomApp: true },
        'api':      { name: '设置', isCustomApp: true },
        'profile':  { name: '档案', isCustomApp: true },
        'travel':   { name: '出行', isCustomApp: true },
        'email':    { name: '邮箱', isCustomApp: true },
        'bill':     { name: '账单', isCustomApp: true },  // 独立的 App
        'gemini':   { name: 'AI', isCustomApp: true },
        'fanfic':   { name: 'AO3', isCustomApp: true }
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
     * 打开应用：秒开逻辑，删除了虚假的进度条
     */
    openApp(appName) {
        const app = this.apps[appName];
        if (!app) return console.warn(`[Mobile] 应用 ${appName} 不存在`);

        // 防止重复打开同一个 App 的根界面
        if (this.currentApp === appName && this.appStack.length === 1) return;

        console.log(`[Mobile] 正在进入: ${app.name}`);
        this.currentApp = appName;

        // 构建初始状态
        const appState = {
            app: appName,
            title: app.name,
            view: 'main'
        };

        // 重置栈并推送新状态
        this.appStack = [appState];
        this.currentAppState = appState;

        // UI 切换
        this.renderAppState(app, appState);
    }

    /**
     * 渲染应用界面
     */
    renderAppState(app, state) {
        // 1. 更新顶部标题栏
        this.updateAppHeader(state);

        // 2. 切换容器显示
        document.getElementById('home-screen').style.display = 'none';
        const appScreen = document.getElementById('app-screen');
        appScreen.style.display = 'block';
        
        // 3. 填充内容：如果是自定义处理器则执行，否则填充 HTML
        if (app.isCustomApp && app.customHandler) {
            app.customHandler(state);
        } else {
            document.getElementById('app-content').innerHTML = app.content || '';
        }

        // 4. 执行入场动画
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

// --- 外部初始化逻辑 ---
function initMobilePhone() {
    if (!window.mobilePhone) {
        window.mobilePhone = new MobilePhone();
        console.log('[Mobile Phone] 手机界面初始化完成');
    }
}
initMobilePhone();
window.showMobileToast = MobilePhone.showToast.bind(MobilePhone);
