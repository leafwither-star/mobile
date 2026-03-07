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

    // 初始化页面拖拽功能
    initPageSwipe() {
        this.currentPageIndex = 0;
        this.totalPages = 2;
        this.isDragging = false;
        this.startX = 0;
        this.currentX = 0;
        this.threshold = 50; // 拖拽阈值

        // 等待DOM元素加载完成
        setTimeout(() => {
            const wrapper = document.getElementById('app-pages-wrapper');
            const indicators = document.getElementById('page-indicators');

            if (!wrapper || !indicators) {
                console.log('[Mobile Phone] 页面元素未找到，延迟初始化拖拽功能');
                setTimeout(() => this.initPageSwipe(), 100);
                return;
            }

            // 鼠标事件 (PC端)
            wrapper.addEventListener('mousedown', this.handleStart.bind(this));
            wrapper.addEventListener('mousemove', this.handleMove.bind(this));
            wrapper.addEventListener('mouseup', this.handleEnd.bind(this));
            wrapper.addEventListener('mouseleave', this.handleEnd.bind(this));

            // 触摸事件 (移动端)
            wrapper.addEventListener('touchstart', this.handleStart.bind(this), { passive: false });
            wrapper.addEventListener('touchmove', this.handleMove.bind(this), { passive: false });
            wrapper.addEventListener('touchend', this.handleEnd.bind(this));

            // 指示器点击事件
            const indicatorElements = indicators.querySelectorAll('.indicator');
            indicatorElements.forEach((indicator, index) => {
                indicator.addEventListener('click', () => {
                    this.goToPage(index);
                });
            });

            console.log('[Mobile Phone] 页面拖拽功能初始化完成');
        }, 100);
    }

    // 处理拖拽开始
    handleStart(e) {
        this.isDragging = true;
        this.startX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
        this.currentX = this.startX;

        const wrapper = document.getElementById('app-pages-wrapper');
        wrapper.style.transition = 'none';
    }

    // 处理拖拽移动
    handleMove(e) {
        if (!this.isDragging) return;

        e.preventDefault();
        this.currentX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
        const deltaX = this.currentX - this.startX;

        const wrapper = document.getElementById('app-pages-wrapper');
        const translateX = -this.currentPageIndex * 100 + (deltaX / wrapper.offsetWidth) * 100;
        wrapper.style.transform = `translateX(${translateX}%)`;
    }

    // 处理拖拽结束
    handleEnd(e) {
        if (!this.isDragging) return;

        this.isDragging = false;
        const deltaX = this.currentX - this.startX;
        const wrapper = document.getElementById('app-pages-wrapper');

        // 恢复过渡效果
        wrapper.style.transition = 'transform 0.3s ease-out';

        // 判断是否需要切换页面
        if (Math.abs(deltaX) > this.threshold) {
            if (deltaX > 0 && this.currentPageIndex > 0) {
                // 向右滑动，切换到上一页
                this.goToPage(this.currentPageIndex - 1);
            } else if (deltaX < 0 && this.currentPageIndex < this.totalPages - 1) {
                // 向左滑动，切换到下一页
                this.goToPage(this.currentPageIndex + 1);
            } else {
                // 回到当前页
                this.goToPage(this.currentPageIndex);
            }
        } else {
            // 回到当前页
            this.goToPage(this.currentPageIndex);
        }
    }

    // 跳转到指定页面
    goToPage(pageIndex) {
        if (pageIndex < 0 || pageIndex >= this.totalPages) return;

        this.currentPageIndex = pageIndex;
        const wrapper = document.getElementById('app-pages-wrapper');
        wrapper.style.transform = `translateX(-${pageIndex * 100}%)`;

        // 更新指示器
        this.updateIndicators();
    }

    // 更新页面指示器
    updateIndicators() {
        const indicators = document.querySelectorAll('.indicator');
        indicators.forEach((indicator, index) => {
            if (index === this.currentPageIndex) {
                indicator.classList.add('active');
            } else {
                indicator.classList.remove('active');
            }
        });
    }

    // 加载拖拽辅助插件
    loadDragHelper() {
        // 加载CSS样式
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = '/scripts/extensions/third-party/mobile/drag-helper.css';
        document.head.appendChild(cssLink);

        // 加载JS插件
        if (typeof DragHelper === 'undefined') {
            const script = document.createElement('script');
            script.src = '/scripts/extensions/third-party/mobile/drag-helper.js';
            script.onload = () => {
                console.log('[Mobile Phone] 拖拽插件加载成功');
            };
            script.onerror = () => {
                console.error('[Mobile Phone] 拖拽插件加载失败');
            };
            document.head.appendChild(script);
        }
    }

    // 创建弹出按钮
    createPhoneButton() {
        try {
            // 检查是否已经存在按钮
            const existingButton = document.getElementById('mobile-phone-trigger');
            if (existingButton) {
                console.log('[Mobile Phone] 按钮已存在，移除旧按钮');
                existingButton.remove();
            }

            const button = document.createElement('button');
            button.id = 'mobile-phone-trigger';
            button.className = 'mobile-phone-trigger';
            button.innerHTML = '📱';
            button.title = '打开手机界面';
            button.addEventListener('click', () => this.togglePhone());

            // 确保body存在
            if (!document.body) {
                console.error('[Mobile Phone] document.body 不存在，延迟创建按钮');
                setTimeout(() => this.createPhoneButton(), 100);
                return;
            }

            document.body.appendChild(button);

            // 初始化拖拽功能
            this.initDragForButton(button);

            console.log('[Mobile Phone] 手机按钮创建成功');
        } catch (error) {
            console.error('[Mobile Phone] 创建按钮时发生错误:', error);
        }
    }

    // 为按钮初始化拖拽功能
    initDragForButton(button) {
        // 延迟初始化以确保DragHelper已加载
        const tryInitDrag = () => {
            if (typeof DragHelper !== 'undefined') {
                // 销毁旧的拖拽实例
                if (this.dragHelper) {
                    this.dragHelper.destroy();
                }

                // 创建新的拖拽实例
                this.dragHelper = new DragHelper(button, {
                    boundary: document.body,
                    clickThreshold: 8, // 稍微增加点击阈值确保点击功能正常
                    dragClass: 'mobile-phone-trigger-dragging',
                    savePosition: false, // 不保存位置
                    storageKey: 'mobile-phone-trigger-position',
                });

                console.log('[Mobile Phone] 拖拽功能初始化成功');
            } else {
                // 如果DragHelper还未加载，继续等待
                setTimeout(tryInitDrag, 100);
            }
        };

        tryInitDrag();
    }

    // 清理位置缓存
    clearPositionCache() {
        try {
            // 清理按钮位置缓存
            localStorage.removeItem('mobile-phone-trigger-position');
            // 清理框架位置缓存
            localStorage.removeItem('mobile-phone-frame-position');
            console.log('[Mobile Phone] 位置缓存已清理');
        } catch (error) {
            console.warn('[Mobile Phone] 清理位置缓存时发生错误:', error);
        }
    }

    // 为手机框架初始化拖拽功能
    initFrameDrag() {
        // 延迟初始化以确保DragHelper已加载
        const tryInitFrameDrag = () => {
            if (typeof DragHelper !== 'undefined') {
                const phoneFrame = document.querySelector('.mobile-phone-frame');
                if (phoneFrame) {
                    // 销毁旧的框架拖拽实例
                    if (this.frameDragHelper) {
                        this.frameDragHelper.destroy();
                    }

                    // 创建新的拖拽实例
                    this.frameDragHelper = new DragHelper(phoneFrame, {
                        boundary: document.body,
                        clickThreshold: 10, // 增加阈值避免误触
                        dragClass: 'mobile-phone-frame-dragging',
                        savePosition: false, // 不保存位置
                        storageKey: 'mobile-phone-frame-position',
                        touchTimeout: 300, // 增加触摸超时时间
                        dragHandle: '.mobile-status-bar', // 指定拖拽手柄为状态栏
                    });

                    console.log('[Mobile Phone] 框架拖拽功能初始化成功');
                }
            } else {
                // 如果DragHelper还未加载，继续等待
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
        
        <div class="app-page">
            <div class="app-grid">
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

    </div> </div> ```

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
