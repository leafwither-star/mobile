/**
 * 手机前端框架
 * 可爱的iOS风格手机界面
 */

class MobilePhone {
    constructor() {
        this.isVisible = false;
        this.currentApp = null;
        this.apps = {};
        this.appStack = []; // 添加应用栈来管理页面导航
        this.currentAppState = null; // 当前应用状态
        this.dragHelper = null; // 拖拽辅助器（按钮）
        this.frameDragHelper = null; // 框架拖拽辅助器

        // 防抖相关标记
        this._openingApp = null;
        this._goingHome = false;
        this._returningToApp = null;
        this._lastAppIconClick = 0;
        this._lastBackButtonClick = 0;

        // 应用加载状态管理
        this._loadingApps = new Set(); // 正在加载的应用
        this._userNavigationIntent = null; // 用户导航意图
        this._loadingStartTime = {}; // 应用加载开始时间

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
                                                <!-- 第一行：相册，邮件，音乐 -->
                                                <div class="app-row">
                                                    <div class="app-icon" data-app="settings">
                                                        <div class="app-icon-bg purple">⚙️</div>
                                                        <span class="app-label">设置</span>
                                                    </div>
                                                    <div class="app-icon" data-app="status">
                                                        <div class="app-icon-bg blue">👤</div>
                                                        <span class="app-label">状态</span>
                                                    </div>
                                                    <div class="app-icon" data-app="diary">
                                                        <div class="app-icon-bg orange">📔</div>
                                                        <span class="app-label">日记</span>
                                                    </div>
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

    // 绑定事件
    bindEvents() {
        // 点击遮罩层关闭（仅在非兼容模式下生效）
        document.querySelector('.mobile-phone-overlay').addEventListener('click', () => {
            // 检查是否启用了兼容模式
            const isCompatibilityMode =
                window.MobileContextPlugin &&
                window.MobileContextPlugin.getSettings &&
                window.MobileContextPlugin.getSettings().tavernCompatibilityMode;

            // 只有在非兼容模式下才允许点击外部关闭
            if (!isCompatibilityMode) {
                this.hidePhone();
            }
        });

        // 返回按钮
        document.getElementById('back-button').addEventListener('click', () => {
            // 防抖：避免快速连续点击返回按钮
            if (this._lastBackButtonClick && Date.now() - this._lastBackButtonClick < 300) {
                console.log('[Mobile Phone] 防抖：返回按钮点击过快，跳过');
                return;
            }
            this._lastBackButtonClick = Date.now();

            this.handleBackButton();
        });

        // 应用图标点击事件
        document.querySelectorAll('.app-icon').forEach(icon => {
            icon.addEventListener('click', e => {
                const appName = e.currentTarget.getAttribute('data-app');

                // 防抖：避免快速连续点击
                if (this._lastAppIconClick && Date.now() - this._lastAppIconClick < 300) {
                    console.log('[Mobile Phone] 防抖：应用图标点击过快，跳过:', appName);
                    return;
                }
                this._lastAppIconClick = Date.now();

                this.openApp(appName);
            });
        });
    }

    // 处理返回按钮
    handleBackButton() {
        console.log('=== [Mobile Phone] 返回按钮处理开始 ===');

        // 清除用户导航意图（用户主动返回）
        this._userNavigationIntent = null;
        console.log('[Mobile Phone] 已清除用户导航意图');

        console.log('[Mobile Phone] 当前应用栈长度:', this.appStack.length);
        console.log('[Mobile Phone] 当前应用栈:', JSON.stringify(this.appStack, null, 2));
        console.log('[Mobile Phone] 当前应用状态:', JSON.stringify(this.currentAppState, null, 2));
        console.log('[Mobile Phone] 当前应用:', this.currentApp);

        // 没有当前应用状态，直接返回主界面
        if (!this.currentAppState) {
            console.log('[Mobile Phone] 当前无应用状态，返回主界面');
            this.goHome();
            return;
        }

        const currentApp = this.currentAppState.app;
        console.log('[Mobile Phone] 从状态获取的应用:', currentApp);

        // 优先根据各应用自身的运行态判断是否在根页面
        const atRoot = this.isCurrentlyAtAppRoot(currentApp, this.currentAppState);
        console.log('[Mobile Phone] 当前应用:', currentApp, '是否在根页面(模块检测):', atRoot);

        // 安全检查：确保当前应用状态与应用一致
        if (this.currentApp && this.currentApp !== currentApp) {
            console.warn(
                '[Mobile Phone] ⚠️ 应用状态不一致! currentApp:',
                this.currentApp,
                'vs currentAppState.app:',
                currentApp,
            );
            // 强制同步
            this.currentApp = currentApp;
        }

        if (!atRoot) {
            // 二级（或更深）页面：统一返回当前应用主界面
            console.log('[Mobile Phone] 非根页面，返回当前应用主界面:', currentApp);
            console.log('[Mobile Phone] 调用 returnToAppMain 前状态检查:');
            console.log('  - currentApp:', this.currentApp);
            console.log('  - currentAppState.app:', this.currentAppState.app);
            console.log('  - appStack 最后一项:', this.appStack[this.appStack.length - 1]);

            this.returnToAppMain(currentApp);

            console.log('[Mobile Phone] returnToAppMain 调用后状态:');
            console.log('  - currentApp:', this.currentApp);
            console.log('  - currentAppState.app:', this.currentAppState.app);
            console.log('  - appStack 最后一项:', this.appStack[this.appStack.length - 1]);
            return;
        }

        // 根页面：返回手机主界面
        console.log('[Mobile Phone] 已在应用根页面，返回主界面');
        this.goHome();
        console.log('=== [Mobile Phone] 返回按钮处理结束 ===');
    }

    // 返回到论坛主列表
    returnToForumMainList() {
        console.log('[Mobile Phone] 返回到论坛主列表');
        console.log('[Mobile Phone] 返回前应用栈:', JSON.stringify(this.appStack, null, 2));

        // 创建论坛主列表状态
        const forumMainState = {
            app: 'forum',
            title: '论坛',
            view: 'main',
        };

        // 完全清理应用栈，只保留论坛主列表状态
        // 这样可以避免其他应用状态的污染
        this.appStack = [forumMainState];
        this.currentAppState = forumMainState;
        this.currentApp = 'forum';
        this.updateAppHeader(forumMainState);

        console.log('[Mobile Phone] 返回后应用栈:', JSON.stringify(this.appStack, null, 2));

        // 重新加载整个论坛应用界面，而不是只更新forum-content
        if (window.getForumAppContent && window.bindForumEvents) {
            console.log('[Mobile Phone] 重新加载论坛主界面');

            // 获取完整的论坛应用HTML
            const forumContent = window.getForumAppContent();
            if (forumContent) {
                // 设置到应用内容区域
                document.getElementById('app-content').innerHTML = forumContent;

                // 绑定事件
                window.bindForumEvents();

                // 确保论坛UI状态完全重置
                if (window.forumUI) {
                    window.forumUI.currentThreadId = null;
                    window.forumUI.currentView = 'main';
                    // 清除任何可能的状态缓存
                    if (window.forumUI.resetState) {
                        window.forumUI.resetState();
                    }
                }

                console.log('[Mobile Phone] ✅ 论坛主界面重新加载完成，状态已重置');
            } else {
                console.error('[Mobile Phone] 获取论坛内容失败');
                this.handleForumApp();
            }
        } else {
            // 如果论坛模块不存在，重新加载论坛应用
            console.warn('[Mobile Phone] 论坛模块不存在，重新加载论坛应用');
            this.handleForumApp();
        }
    }

    // 返回到消息列表
    returnToMessageList() {
        console.log('[Mobile Phone] 返回到消息列表');
        console.log('[Mobile Phone] 返回前应用栈:', JSON.stringify(this.appStack, null, 2));

        // 创建消息列表状态
        const messageListState = {
            app: 'messages',
            title: '信息',
            view: 'messageList',
        };

        // 完全清理应用栈，只保留消息列表状态
        // 这样可以避免其他应用状态的污染
        this.appStack = [messageListState];
        this.currentAppState = messageListState;
        this.updateAppHeader(messageListState);

        console.log('[Mobile Phone] 返回后应用栈:', JSON.stringify(this.appStack, null, 2));

        // 调用消息应用显示列表
        if (window.messageApp && window.messageApp.showMessageList) {
            // 确保消息应用状态完全重置
            window.messageApp.currentView = 'messageList';
            window.messageApp.currentFriendId = null;
            window.messageApp.currentFriendName = null;

            window.messageApp.showMessageList();
            console.log('[Mobile Phone] ✅ 消息列表显示完成，状态已重置');
        } else {
            console.error('[Mobile Phone] messageApp实例不存在或showMessageList方法不可用');
        }
    }

    // 判断是否在应用的根页面
    isAppRootPage(state) {
        if (!state) return false;

        // 消息应用的根页面只有消息列表
        if (state.app === 'messages') {
            return state.view === 'messageList' || state.view === 'main' || state.view === 'list';
            // addFriend、messageDetail等都不是根页面，应该可以返回到消息列表
        }

        // 论坛应用的根页面是main视图或没有view属性（主列表）
        if (state.app === 'forum') {
            return state.view === 'main' || !state.view || state.view === 'list';
        }

        // 其他应用的根页面是main视图
        return state.view === 'main';
    }

    // 恢复应用状态
    restoreAppState(state) {
        console.log('[Mobile Phone] 恢复应用状态:', JSON.stringify(state, null, 2));
        this.currentAppState = state;
        this.updateAppHeader(state);

        // 如果是消息应用的特殊状态
        if (state.app === 'messages') {
            if (state.view === 'messageList' || state.view === 'list') {
                // 直接调用messageApp的内部方法，不触发状态推送
                if (window.messageApp) {
                    window.messageApp.currentView = 'list';
                    window.messageApp.currentFriendId = null;
                    window.messageApp.currentFriendName = null;
                    window.messageApp.updateAppContent();
                }
            } else if (state.view === 'messageDetail') {
                // 直接调用messageApp的内部方法，不触发状态推送
                if (window.messageApp) {
                    window.messageApp.currentView = 'messageDetail';
                    window.messageApp.currentFriendId = state.friendId;
                    window.messageApp.currentFriendName = state.friendName;
                    window.messageApp.updateAppContent();
                }
            } else if (state.view === 'addFriend') {
                // 直接调用messageApp的内部方法，不触发状态推送
                if (window.messageApp) {
                    window.messageApp.currentView = 'addFriend';
                    window.messageApp.currentTab = 'add';
                    window.messageApp.updateAppContent();
                }
            } else if (state.view === 'friendsCircle') {
                // 恢复朋友圈状态
                console.log('[Mobile Phone] 恢复朋友圈状态...');
                if (window.messageApp) {
                    // 设置messageApp状态
                    window.messageApp.currentMainTab = 'circle';
                    window.messageApp.currentView = 'list';

                    // 确保朋友圈已初始化并激活
                    if (window.messageApp.friendsCircle) {
                        console.log('[Mobile Phone] 激活现有朋友圈实例');
                        window.messageApp.friendsCircle.activate();
                    } else {
                        console.log('[Mobile Phone] 朋友圈未初始化，立即初始化并激活');
                        window.messageApp.initFriendsCircle();
                        // 等待初始化完成后激活
                        setTimeout(() => {
                            if (window.messageApp.friendsCircle) {
                                window.messageApp.friendsCircle.activate();
                            }
                        }, 100);
                    }

                    // 更新界面内容
                    window.messageApp.updateAppContent();

                    // 延迟确保header正确更新
                    setTimeout(() => {
                        console.log('[Mobile Phone] 延迟更新朋友圈header...');
                        const circleState = {
                            app: 'messages',
                            view: 'friendsCircle',
                            title: '朋友圈',
                            showBackButton: false,
                            showAddButton: true,
                            addButtonIcon: 'fas fa-camera',
                            addButtonAction: () => {
                                if (window.friendsCircle) {
                                    window.friendsCircle.showPublishModal();
                                }
                            },
                        };
                        this.currentAppState = circleState;
                        this.updateAppHeader(circleState);
                    }, 200);
                }
            }
        } else if (state.app === 'forum') {
            // 如果是论坛应用的特殊状态
            if (state.view === 'threadDetail' && state.threadId) {
                // 恢复论坛帖子详情视图
                if (window.forumUI) {
                    window.forumUI.currentThreadId = state.threadId;
                    const forumContent = document.getElementById('forum-content');
                    if (forumContent) {
                        forumContent.innerHTML = window.forumUI.getThreadDetailHTML(state.threadId);
                        window.forumUI.bindReplyEvents();
                    }
                }
            } else if (state.view === 'forumControl') {
                // 恢复论坛控制界面
                this.handleForumApp();
            } else {
                // 默认显示主列表 (view === 'main' 或其他)
                if (window.forumUI) {
                    window.forumUI.currentThreadId = null;
                    const forumContent = document.getElementById('forum-content');
                    if (forumContent) {
                        forumContent.innerHTML = window.forumUI.getThreadListHTML();
                        // 重新绑定主列表事件
                        if (window.bindForumEvents) {
                            window.bindForumEvents();
                        }
                    }
                } else {
                    // 如果forumUI不存在，重新加载论坛应用
                    console.warn('[Mobile Phone] forumUI不存在，重新加载论坛应用');
                    this.handleForumApp();
                }
            }
        }
    }

    // 更新应用头部
    updateAppHeader(state) {
        const titleElement = document.getElementById('app-title');
        const headerRight = document.getElementById('app-header-right');

        if (!state) {
            titleElement.textContent = '应用';
            headerRight.innerHTML = '';
            return;
        }

        // 设置标题
        titleElement.textContent = state.title || this.apps[state.app]?.name || '应用';

        // 标记当前app与view，便于样式与导航判断
        const appScreen = document.getElementById('app-screen');
        const appContent = document.getElementById('app-content');
        const appHeader = document.getElementById('app-header');
        if (appScreen) {
            appScreen.setAttribute('data-app', state.app || '');
            appScreen.setAttribute('data-view', state.view || 'main');
            // 清理旧的 app-root-* 标记
            Array.from(appScreen.classList).forEach(c => {
                if (c.startsWith('app-root-')) appScreen.classList.remove(c);
            });
            if (this.isAppRootPage(state)) {
                appScreen.classList.add(`app-root-${state.app}`);
            }
        }
        if (appContent) {
            appContent.setAttribute('data-app', state.app || '');
            appContent.setAttribute('data-view', state.view || 'main');
        }
        if (appHeader) {
            appHeader.setAttribute('data-app', state.app || '');
            appHeader.setAttribute('data-view', state.view || 'main');
        }

        // 清除旧的功能按钮
        headerRight.innerHTML = '';

        // 根据应用状态添加功能按钮
        if (state.app === 'messages') {
            if (state.view === 'messageList' || state.view === 'list') {
                // 消息列表页面：添加文字颜色切换按钮
                const textColorBtn = document.createElement('button');
                textColorBtn.className = 'app-header-btn text-color-toggle';
                // 显示将要切换到的颜色（与当前颜色相反）
                textColorBtn.innerHTML = this.getCurrentTextColor() === 'white' ? '黑' : '白';
                textColorBtn.title = '切换文字颜色';
                textColorBtn.addEventListener('click', () => this.toggleTextColor());
                headerRight.appendChild(textColorBtn);

                // 消息列表页面：添加图片设置按钮
                const imageConfigBtn = document.createElement('button');
                imageConfigBtn.className = 'app-header-btn';
                imageConfigBtn.innerHTML = '<i class="fas fa-image"></i>';
                imageConfigBtn.title = '图片设置';
                imageConfigBtn.addEventListener('click', () => this.showImageConfigModal());
                headerRight.appendChild(imageConfigBtn);

                // 消息列表页面：添加好友按钮
                const addFriendBtn = document.createElement('button');
                addFriendBtn.className = 'app-header-btn';
                addFriendBtn.innerHTML = '➕';
                addFriendBtn.title = '添加好友';
                addFriendBtn.addEventListener('click', () => this.showAddFriend());
                headerRight.appendChild(addFriendBtn);
            } else if (state.view === 'messageDetail') {
                // 消息详情页面：添加相片按钮（仅好友，不包括群聊）
                if (state.friendId && !this.isGroupChat(state.friendId)) {
                    const photoBtn = document.createElement('button');
                    photoBtn.className = 'app-header-btn';
                    photoBtn.innerHTML = '<i class="fas fa-image"></i>';
                    photoBtn.title = '相片设置';
                    photoBtn.addEventListener('click', () => this.showFriendImageConfigModal(state.friendId, state.friendName));
                    headerRight.appendChild(photoBtn);
                }

                // 消息详情页面：添加刷新按钮
                const refreshBtn = document.createElement('button');
                refreshBtn.className = 'app-header-btn';
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
                refreshBtn.title = '刷新消息';
                refreshBtn.addEventListener('click', () => this.refreshMessageDetail());
                headerRight.appendChild(refreshBtn);
            } else if (state.view === 'addFriend') {
                // 添加好友页面：可以添加保存按钮或其他功能
                const saveBtn = document.createElement('button');
                saveBtn.className = 'app-header-btn';
                saveBtn.innerHTML = '✅';
                saveBtn.title = '保存';
                saveBtn.addEventListener('click', () => this.saveAddFriend());
                headerRight.appendChild(saveBtn);
            } else if (state.view === 'friendsCircle') {
                // 朋友圈页面：添加生成朋友圈按钮
                const generateBtn = document.createElement('button');
                generateBtn.className = 'app-header-btn';
                generateBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
                generateBtn.title = '生成朋友圈';
                generateBtn.addEventListener('click', () => {
                    this.generateFriendsCircleContent();
                });
                headerRight.appendChild(generateBtn);

                // 朋友圈页面：添加相机发布按钮
                const cameraBtn = document.createElement('button');
                cameraBtn.className = 'app-header-btn';
                cameraBtn.innerHTML = '<i class="fas fa-camera"></i>';
                cameraBtn.title = '发布朋友圈';
                cameraBtn.addEventListener('click', () => {
                    if (window.friendsCircle) {
                        window.friendsCircle.showPublishModal();
                    }
                });
                headerRight.appendChild(cameraBtn);
            }
        } else if (state.app === 'gallery') {
            // 相册应用：添加选择按钮
            const selectBtn = document.createElement('button');
            selectBtn.className = 'app-header-btn';
            selectBtn.innerHTML = '✓';
            selectBtn.title = '选择';
            selectBtn.addEventListener('click', () => this.toggleGallerySelect());
            headerRight.appendChild(selectBtn);
        } else if (state.app === 'forum') {
            // 论坛应用：根据不同视图添加不同按钮
            if (state.view === 'threadDetail') {
                // 帖子详情页面：添加刷新按钮
                const refreshBtn = document.createElement('button');
                refreshBtn.className = 'app-header-btn';
                refreshBtn.innerHTML = '刷新';
                refreshBtn.title = '刷新';
                refreshBtn.style.background = '#e5c9c7';
                refreshBtn.style.color = 'white';
                refreshBtn.addEventListener('click', () => {
                    if (window.forumUI) {
                        window.forumUI.refreshForum();
                    }
                });
                headerRight.appendChild(refreshBtn);
            } else {
                // 论坛主页：添加生成、发帖和刷新按钮
                const generateBtn = document.createElement('button');
                generateBtn.className = 'app-header-btn';
                generateBtn.innerHTML = '生成';
                generateBtn.title = '立即生成论坛';
                generateBtn.style.background = '#e5c9c7';
                generateBtn.style.color = 'white';
                generateBtn.addEventListener('click', () => {
                    if (window.forumManager) {
                        console.log('[Mobile Phone] 🔘 头部生成按钮被点击');

                        // 显示生成状态提示
                        if (window.showMobileToast) {
                            window.showMobileToast('🚀 正在生成论坛内容...', 'info');
                        }

                        // 调用生成方法
                        window.forumManager
                            .generateForumContent(true) // 强制生成，不检查消息增量
                            .then(() => {
                                if (window.showMobileToast) {
                                    window.showMobileToast('✅ 论坛内容生成完成', 'success');
                                }
                            })
                            .catch(error => {
                                console.error('[Mobile Phone] 生成论坛内容失败:', error);
                                if (window.showMobileToast) {
                                    window.showMobileToast('❌ 生成失败: ' + error.message, 'error');
                                }
                            });
                    }
                });
                headerRight.appendChild(generateBtn);

                const postBtn = document.createElement('button');
                postBtn.className = 'app-header-btn';
                postBtn.innerHTML = '发帖';
                postBtn.title = '发帖';
                postBtn.style.background = '#e5c9c7';
                postBtn.style.color = 'white';
                postBtn.addEventListener('click', () => {
                    if (window.forumUI) {
                        window.forumUI.showPostDialog();
                    }
                });
                headerRight.appendChild(postBtn);

                const styleBtn = document.createElement('button');
                styleBtn.className = 'app-header-btn';
                styleBtn.innerHTML = '风格';
                styleBtn.title = '论坛风格设置';
                styleBtn.style.background = '#e5c9c7';
                styleBtn.style.color = 'white';
                styleBtn.addEventListener('click', () => {
                    console.log('[Mobile Phone] 🎨 风格按钮被点击，跳转到论坛风格设置');
                    // 切换到API设置应用的论坛风格标签页
                    window.mobilePhone.openApp('api');
                    // 延迟一下确保页面切换完成，然后激活论坛风格标签
                    setTimeout(() => {
                        const forumStylesTab = document.querySelector('[data-tab="forum-styles"]');
                        if (forumStylesTab) {
                            forumStylesTab.click();
                            console.log('[Mobile Phone] 已切换到论坛风格设置页面');
                        } else {
                            console.warn('[Mobile Phone] 未找到论坛风格设置标签页');
                        }
                    }, 300);
                });
                headerRight.appendChild(styleBtn);

                const refreshBtn = document.createElement('button');
                refreshBtn.className = 'app-header-btn';
                refreshBtn.innerHTML = '刷新';
                refreshBtn.title = '刷新';
                refreshBtn.style.background = '#e5c9c7';
                refreshBtn.style.color = 'white';
                refreshBtn.addEventListener('click', () => {
                    if (window.forumUI) {
                        window.forumUI.refreshForum();
                    }
                });
                headerRight.appendChild(refreshBtn);
            }
        } else if (state.app === 'weibo') {
            // 微博应用：添加生成、刷新、发博、切小号按钮
            const generateBtn = document.createElement('button');
            generateBtn.className = 'app-header-btn';
            generateBtn.innerHTML = '生成';
            generateBtn.title = '立即生成微博';
            generateBtn.style.background = '#ff8500';
            generateBtn.style.color = 'white';
            generateBtn.addEventListener('click', async () => {
                if (window.weiboManager) {
                    console.log('[Mobile Phone] 触发立即生成微博');

                    // 显示处理中提示
                    MobilePhone.showToast('🔄 开始生成微博内容...', 'processing');

                    try {
                        const result = await window.weiboManager.generateWeiboContent(true);
                        if (result) {
                            MobilePhone.showToast('✅ 微博内容生成成功！已插入到第1楼层', 'success');
                        } else {
                            MobilePhone.showToast('⚠️ 微博内容生成失败或被跳过', 'warning');
                        }
                    } catch (error) {
                        console.error('[Mobile Phone] 生成微博内容出错:', error);
                        MobilePhone.showToast(`❌ 生成失败: ${error.message}`, 'error');
                    }
                } else {
                    console.error('[Mobile Phone] 微博管理器未找到');
                }
            });
            headerRight.appendChild(generateBtn);

            const refreshBtn = document.createElement('button');
            refreshBtn.className = 'app-header-btn';
            refreshBtn.innerHTML = '刷新';
            refreshBtn.title = '刷新';
            refreshBtn.style.background = '#ff8500';
            refreshBtn.style.color = 'white';
            refreshBtn.addEventListener('click', () => {
                if (window.weiboUI && window.weiboUI.refreshWeiboList) {
                    window.weiboUI.refreshWeiboList();
                } else {
                    console.error('[Mobile Phone] 微博UI未找到');
                }
            });
            headerRight.appendChild(refreshBtn);

            // 发博按钮
            const postBtn = document.createElement('button');
            postBtn.className = 'app-header-btn';
            postBtn.innerHTML = '发博';
            postBtn.title = '发博';
            postBtn.style.background = '#ff8500';
            postBtn.style.color = 'white';
            postBtn.addEventListener('click', () => {
                if (window.weiboControlApp && window.weiboControlApp.showPostDialog) {
                    window.weiboControlApp.showPostDialog();
                } else {
                    console.error('[Mobile Phone] 微博控制应用未就绪');
                }
            });
            headerRight.appendChild(postBtn);

            // 切小号按钮
            const switchAccountBtn = document.createElement('button');
            switchAccountBtn.className = 'app-header-btn';
            const isMainAccount = window.weiboManager ? window.weiboManager.currentAccount.isMainAccount : true;
            switchAccountBtn.innerHTML = isMainAccount ? '切小号' : '切大号';
            switchAccountBtn.title = isMainAccount ? '切换到小号' : '切换到大号';
            switchAccountBtn.style.background = '#ff8500';
            switchAccountBtn.style.color = 'white';
            switchAccountBtn.addEventListener('click', () => {
                if (window.weiboManager && window.weiboManager.switchAccount) {
                    const newIsMainAccount = window.weiboManager.switchAccount();

                    // 更新按钮文本
                    switchAccountBtn.innerHTML = newIsMainAccount ? '切小号' : '切大号';
                    switchAccountBtn.title = newIsMainAccount ? '切换到小号' : '切换到大号';

                    // 立即更新用户名显示
                    if (window.weiboUI && window.weiboUI.updateUsernameDisplay) {
                        window.weiboUI.updateUsernameDisplay();
                    }

                    // 刷新当前页面
                    if (window.weiboUI) {
                        window.weiboUI.refreshWeiboList();
                    }

                    MobilePhone.showToast(`✅ 已切换到${newIsMainAccount ? '大号' : '小号'}`, 'success');
                    console.log('[Mobile Phone] 账户已切换:', newIsMainAccount ? '大号' : '小号');
                } else {
                    console.error('[Mobile Phone] 微博管理器未就绪');
                }
            });
            headerRight.appendChild(switchAccountBtn);
        } else if (state.app === 'settings') {
            // 设置应用：添加搜索按钮
            const searchBtn = document.createElement('button');
            searchBtn.className = 'app-header-btn';
            searchBtn.innerHTML = '🔍';
            searchBtn.title = '搜索';
            searchBtn.addEventListener('click', () => this.showSettingsSearch());
            headerRight.appendChild(searchBtn);
        } else if (state.app === 'shop') {
            // 购物应用：查看 + 分类（橙色主题），移除购物车按钮
            const viewBtn = document.createElement('button');
            viewBtn.className = 'app-header-btn shop-accent-btn';
            viewBtn.innerHTML = '查看';
            viewBtn.title = '查看商品';
            viewBtn.addEventListener('click', () => {
                if (window.shopAppSendViewMessage) {
                    window.shopAppSendViewMessage();
                }
            });
            headerRight.appendChild(viewBtn);

            // 分类按钮
            const categoryBtn = document.createElement('button');
            categoryBtn.className = 'app-header-btn shop-accent-btn';
            categoryBtn.innerHTML = '分类';
            categoryBtn.title = '展开分类';
            categoryBtn.addEventListener('click', () => {
                if (window.shopAppToggleCategories) {
                    window.shopAppToggleCategories();
                } else if (window.shopAppShowCategories) {
                    // 兼容旧命名
                    window.shopAppShowCategories();
                }
            });
            headerRight.appendChild(categoryBtn);
        } else if (state.app === 'task') {
            // 任务应用：添加查看任务按钮
            const viewBtn = document.createElement('button');
            viewBtn.className = 'app-header-btn';
            viewBtn.innerHTML = '查看';
            viewBtn.title = '查看任务';
            viewBtn.addEventListener('click', () => {
                if (window.taskAppSendViewMessage) {
                    window.taskAppSendViewMessage();
                }
            });
            headerRight.appendChild(viewBtn);
        } else if (state.app === 'backpack') {
            // 背包应用：添加分类、搜索和刷新按钮

            // 分类按钮
            const categoryBtn = document.createElement('button');
            categoryBtn.className = 'app-header-btn';
            categoryBtn.innerHTML = '分类';
            categoryBtn.title = '展开分类';
            categoryBtn.addEventListener('click', () => {
                if (window.backpackAppToggleCategories) {
                    window.backpackAppToggleCategories();
                }
            });
            headerRight.appendChild(categoryBtn);

            // 搜索按钮
            const searchBtn = document.createElement('button');
            searchBtn.className = 'app-header-btn';
            searchBtn.innerHTML = '🔍';
            searchBtn.title = '搜索物品';
            searchBtn.addEventListener('click', () => {
                if (window.backpackAppToggleSearch) {
                    window.backpackAppToggleSearch();
                }
            });
            headerRight.appendChild(searchBtn);

            // 刷新按钮
            const refreshBtn = document.createElement('button');
            refreshBtn.className = 'app-header-btn';
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
            refreshBtn.title = '刷新背包';
            refreshBtn.addEventListener('click', () => {
                if (window.backpackAppRefresh) {
                    window.backpackAppRefresh();
                }
            });
            headerRight.appendChild(refreshBtn);
        } else if (state.app === 'live') {
            // 直播应用：右侧显示 观看人数、礼物列表、结束直播
            // 观看人数徽标
            const viewerBadge = document.createElement('div');
            viewerBadge.className = 'viewer-count';
            viewerBadge.title = '本场人数';
            viewerBadge.innerHTML = `<i class="fas fa-user-friends"></i><span class="viewer-count-num">${state.viewerCount || '-'
                }</span>`;
            headerRight.appendChild(viewerBadge);

            // 礼物列表按钮
            const giftBtn = document.createElement('button');
            giftBtn.className = 'app-header-btn gift-log-btn';
            giftBtn.title = '礼物流水';
            giftBtn.innerHTML = '🎁';
            giftBtn.addEventListener('click', () => {
                if (window.liveAppShowModal) {
                    window.liveAppShowModal('gift-modal');
                }
            });
            headerRight.appendChild(giftBtn);

            // 结束直播按钮
            const endBtn = document.createElement('button');
            endBtn.className = 'app-header-btn end-stream-btn';
            endBtn.title = '结束直播';
            endBtn.innerHTML = '⏻';
            endBtn.addEventListener('click', () => {
                if (window.liveAppEndLive) {
                    window.liveAppEndLive();
                }
            });
            headerRight.appendChild(endBtn);
        } else if (state.app === 'watch-live') {
            // 观看直播应用：右侧显示 观看人数、退出直播间
            // 观看人数徽标
            const viewerBadge = document.createElement('div');
            viewerBadge.className = 'viewer-count';
            viewerBadge.title = '本场人数';
            viewerBadge.innerHTML = `<i class="fas fa-user-friends"></i><span class="viewer-count-num">${state.viewerCount || '-'
                }</span>`;
            headerRight.appendChild(viewerBadge);

            // 退出直播间按钮
            const exitBtn = document.createElement('button');
            exitBtn.className = 'app-header-btn end-stream-btn';
            exitBtn.title = '退出直播间';
            exitBtn.innerHTML = '⏻';
            exitBtn.addEventListener('click', () => {
                if (window.watchLiveAppEndLive) {
                    window.watchLiveAppEndLive();
                }
            });
            headerRight.appendChild(exitBtn);
        }
    }

    // 添加应用状态到栈
    pushAppState(state) {
        if (!state || !state.app) {
            console.warn('[Mobile Phone] 推送状态无效，跳过:', state);
            return;
        }

        // 检查是否与当前状态相同，避免重复推送
        const currentState = this.currentAppState;
        if (currentState && this.isSameAppState(currentState, state)) {
            console.log('[Mobile Phone] 状态相同，跳过重复推送:', JSON.stringify(state, null, 2));
            return;
        }

        // 检查是否与栈顶状态相同
        const topState = this.appStack[this.appStack.length - 1];
        if (topState && this.isSameAppState(topState, state)) {
            console.log('[Mobile Phone] 与栈顶状态相同，跳过重复推送:', JSON.stringify(state, null, 2));
            return;
        }

        console.log('[Mobile Phone] 推送应用状态:', JSON.stringify(state, null, 2));
        this.appStack.push(state);
        this.currentAppState = state;
        this.currentApp = state.app; // 确保同步
        this.updateAppHeader(state);
        console.log('[Mobile Phone] 推送后应用栈长度:', this.appStack.length);
    }

    // 比较两个应用状态是否相同
    isSameAppState(state1, state2) {
        if (!state1 || !state2) return false;

        return state1.app === state2.app &&
            state1.view === state2.view &&
            state1.friendId === state2.friendId &&
            state1.threadId === state2.threadId &&
            state1.title === state2.title;
    }

    // 刷新消息列表
    refreshMessages() {
        if (window.messageApp && window.messageApp.refreshMessageList) {
            window.messageApp.refreshMessageList();
        }
    }

    // 刷新消息详情
    refreshMessageDetail() {
        if (window.messageApp && window.messageApp.refreshMessageDetail) {
            window.messageApp.refreshMessageDetail();
        }
    }

    // 显示消息列表
    showMessageList() {
        console.log('[Mobile Phone] 显示消息列表');
        if (window.messageApp && window.messageApp.showMessageList) {
            window.messageApp.showMessageList();
        } else {
            console.error('[Mobile Phone] messageApp实例不存在或showMessageList方法不可用');
        }
    }

    // 显示消息详情
    showMessageDetail(friendId, friendName) {
        console.log('[Mobile Phone] 显示消息详情:', friendId, friendName);
        if (window.messageApp && window.messageApp.showMessageDetail) {
            window.messageApp.showMessageDetail(friendId, friendName);
        } else {
            console.error('[Mobile Phone] messageApp实例不存在或showMessageDetail方法不可用');
        }
    }

    // 切换相册选择模式
    toggleGallerySelect() {
        console.log('[Mobile Phone] 切换相册选择模式');
        // 这里可以添加相册选择模式的实现
    }

    // 显示设置搜索
    showSettingsSearch() {
        console.log('[Mobile Phone] 显示设置搜索');
        // 这里可以添加设置搜索的实现
    }

    // 显示添加好友界面
    showAddFriend() {
        console.log('[Mobile Phone] 显示添加好友界面');
        if (window.messageApp && window.messageApp.showAddFriend) {
            window.messageApp.showAddFriend();
        } else {
            console.error('[Mobile Phone] messageApp实例不存在或showAddFriend方法不可用');
        }
    }

    // 生成朋友圈内容
    async generateFriendsCircleContent() {
        try {
            console.log('[Mobile Phone] 🎭 生成朋友圈按钮被点击');

            // 显示生成状态提示
            if (window.showMobileToast) {
                window.showMobileToast('🎭 正在生成朋友圈内容...', 'info');
            }

            // 构建发送给AI的消息
            const message =
                '用户正在查看朋友圈，请根据朋友圈规则系统，生成3-5个正确的朋友圈格式，根据角色间的关系为每条朋友圈生成0-5条回复。回复请使用与原楼层相同id。请使用正确的三位数楼层id,楼层id不能与历史楼层id重复。请正确使用前缀w。严禁代替用户回复。禁止发表情包或颜文字，可以使用emoji。';

            // 发送消息给AI
            if (window.friendsCircle && window.friendsCircle.sendToAI) {
                await window.friendsCircle.sendToAI(message);

                if (window.showMobileToast) {
                    window.showMobileToast('✅ 朋友圈内容生成完成', 'success');
                }
            } else {
                console.error('[Mobile Phone] 朋友圈功能未就绪');
                if (window.showMobileToast) {
                    window.showMobileToast('❌ 朋友圈功能未就绪', 'error');
                }
            }
        } catch (error) {
            console.error('[Mobile Phone] 生成朋友圈内容失败:', error);
            if (window.showMobileToast) {
                window.showMobileToast('❌ 生成失败: ' + error.message, 'error');
            }
        }
    }

    // 保存添加好友
    saveAddFriend() {
        console.log('[Mobile Phone] 保存添加好友');
        if (window.messageApp && window.messageApp.addFriend) {
            window.messageApp.addFriend();
        } else {
            console.error('[Mobile Phone] messageApp实例不存在或addFriend方法不可用');
        }
    }

    // 注册应用
    registerApps() {
        this.apps = {
            messages: {
                name: '信息',
                content: null, // 将由message-app动态生成
                isCustomApp: true,
                customHandler: this.handleMessagesApp.bind(this),
            },
            gallery: {
                name: '相册',
                content: `
                    <div class="gallery-app">
                        <div class="photo-grid">
                            <div class="photo-item">🖼️</div>
                            <div class="photo-item">🌸</div>
                            <div class="photo-item">🌙</div>
                            <div class="photo-item">⭐</div>
                            <div class="photo-item">🎀</div>
                            <div class="photo-item">💐</div>
                        </div>
                    </div>
                `,
            },
            settings: {
                name: '设置',
                content: null, // 将由样式配置管理器动态生成
                isCustomApp: true,
                customHandler: this.handleSettingsApp.bind(this),
            },
            forum: {
                name: '论坛',
                content: null, // 将由论坛UI动态生成
                isCustomApp: true,
                customHandler: this.handleForumApp.bind(this),
            },
            weibo: {
                name: '微博',
                content: null, // 将由微博UI动态生成
                isCustomApp: true,
                customHandler: this.handleWeiboApp.bind(this),
            },
            api: {
                name: 'API设置',
                content: null, // 将由统一API设置面板动态生成
                isCustomApp: true,
                customHandler: this.handleApiApp.bind(this),
            },
            diary: {
                name: '日记',
                content: `
                    <div class="diary-app">
                        <div class="diary-header">
                            <h3>我的日记 📝</h3>
                        </div>
                        <div class="diary-content">
                            <div class="diary-entry">
                                <div class="entry-date">今天</div>
                                <div class="entry-text">今天天气很好，心情也很棒！在SillyTavern里遇到了很多有趣的角色～</div>
                            </div>
                            <div class="diary-entry">
                                <div class="entry-date">昨天</div>
                                <div class="entry-text">学习了新的前端技术，感觉很有成就感。</div>
                            </div>
                        </div>
                    </div>
                `,
            },
            mail: {
                name: '邮件',
                content: `
                    <div class="mail-app">
                        <div class="mail-list">
                            <div class="mail-item unread">
                                <div class="mail-sender">SillyTavern</div>
                                <div class="mail-subject">欢迎使用手机界面</div>
                                <div class="mail-preview">这是一个可爱的手机界面框架...</div>
                                <div class="mail-time">1小时前</div>
                            </div>
                            <div class="mail-item">
                                <div class="mail-sender">系统通知</div>
                                <div class="mail-subject">插件更新提醒</div>
                                <div class="mail-preview">Mobile Context插件已更新...</div>
                                <div class="mail-time">2小时前</div>
                            </div>
                        </div>
                    </div>
                `,
            },
            status: {
                name: '状态',
                content: null, // 将由status-app动态生成
                isCustomApp: true,
                customHandler: this.handleStatusApp.bind(this),
            },
            diary: {
                name: '日记',
                content: null, // 将由diary-app动态生成
                isCustomApp: true,
                customHandler: this.handleDiaryApp.bind(this),
            },
            shop: {
                name: '购物',
                content: null, // 将由shop-app动态生成
                isCustomApp: true,
                customHandler: this.handleShopApp.bind(this),
            },
            backpack: {
                name: '背包',
                content: null, // 将由backpack-app动态生成
                isCustomApp: true,
                customHandler: this.handleBackpackApp.bind(this),
            },
            task: {
                name: '任务',
                content: null, // 将由task-app动态生成
                isCustomApp: true,
                customHandler: this.handleTaskApp.bind(this),
            },
            live: {
                name: '直播',
                content: null, // 将由live-app动态生成
                isCustomApp: true,
                customHandler: this.handleLiveApp.bind(this),
            },
            'watch-live': {
                name: '观看直播',
                content: null, // 将由watch-live动态生成
                isCustomApp: true,
                customHandler: this.handleWatchLiveApp.bind(this),
            },
            'parallel-events': {
                name: '平行事件',
                content: null, // 将由parallel-events-app动态生成
                isCustomApp: true,
                customHandler: this.handleParallelEventsApp.bind(this),
            },
            'profile': {
                name: '档案',
                content: null, // 将由profile-app动态生成
                isCustomApp: true,
                customHandler: this.handleProfileApp.bind(this),
            },
        };
    }

    // 显示/隐藏手机界面
    togglePhone() {
        if (this.isVisible) {
            this.hidePhone();
        } else {
            this.showPhone();
        }
    }

    showPhone() {
        const container = document.getElementById('mobile-phone-container');
        container.style.display = 'flex';
        setTimeout(() => {
            container.classList.add('active');
        }, 10);
        this.isVisible = true;
        this.isPhoneActive = true;

        // 初始化样式配置管理器（如果还没有初始化）
        this.initStyleConfigManager();

        // 如果有当前应用状态，恢复应用界面
        if (this.currentAppState) {
            console.log('[Mobile Phone] 恢复应用界面状态:', this.currentAppState);
            // 显示应用界面，隐藏主界面
            document.getElementById('home-screen').style.display = 'none';
            document.getElementById('app-screen').style.display = 'block';

            // 恢复应用状态
            this.restoreAppState(this.currentAppState);
        }

        // 启动应用状态同步轮询
        this.startStateSyncLoop();

        // 应用pointer-events设置
        if (window.MobileContextPlugin && window.MobileContextPlugin.updatePointerEventsSettings) {
            window.MobileContextPlugin.updatePointerEventsSettings();
        }
    }

    hidePhone() {
        const container = document.getElementById('mobile-phone-container');
        container.classList.remove('active');
        setTimeout(() => {
            container.style.display = 'none';
        }, 300);
        this.isVisible = false;
        this.isPhoneActive = false;

        // 停止应用状态同步轮询
        this.stopStateSyncLoop();
    }

    // 初始化样式配置管理器
    initStyleConfigManager() {
        // 检查是否已经初始化
        if (
            window.styleConfigManager &&
            window.styleConfigManager.isConfigReady &&
            window.styleConfigManager.isConfigReady()
        ) {
            console.log('[Mobile Phone] 样式配置管理器已经初始化并准备就绪');
            return;
        }

        if (window.StyleConfigManager && !window.styleConfigManager) {
            console.log('[Mobile Phone] 创建样式配置管理器实例');
            try {
                window.styleConfigManager = new window.StyleConfigManager();
                console.log('[Mobile Phone] ✅ 样式配置管理器实例创建成功');
            } catch (error) {
                console.error('[Mobile Phone] ❌ 创建样式配置管理器实例失败:', error);
            }
        } else if (!window.StyleConfigManager) {
            // 如果 StyleConfigManager 类还未加载，尝试加载
            console.log('[Mobile Phone] StyleConfigManager 类尚未加载，尝试动态加载');
            this.loadStyleConfigManager();
        } else {
            console.log('[Mobile Phone] 样式配置管理器实例已存在');
        }
    }

    // 动态加载样式配置管理器
    async loadStyleConfigManager() {
        try {
            console.log('[Mobile Phone] 🔄 开始动态加载样式配置管理器...');

            // 检查脚本是否已经存在
            const existingScript = document.querySelector('script[src*="style-config-manager.js"]');
            if (existingScript) {
                console.log('[Mobile Phone] 样式配置管理器脚本已存在，等待加载完成');
                // 等待一段时间让脚本完成加载
                setTimeout(() => {
                    if (window.StyleConfigManager && !window.styleConfigManager) {
                        window.styleConfigManager = new window.StyleConfigManager();
                        console.log('[Mobile Phone] ✅ 延迟创建样式配置管理器实例成功');
                    }
                }, 1000);
                return;
            }

            // 创建脚本元素
            const script = document.createElement('script');
            script.src = '/scripts/extensions/third-party/mobile/app/style-config-manager.js';
            script.type = 'text/javascript';

            // 设置加载完成回调
            script.onload = () => {
                console.log('[Mobile Phone] ✅ 样式配置管理器脚本加载完成');

                // 等待一小段时间确保脚本完全执行
                setTimeout(() => {
                    if (window.StyleConfigManager && !window.styleConfigManager) {
                        try {
                            window.styleConfigManager = new window.StyleConfigManager();
                            console.log('[Mobile Phone] ✅ 样式配置管理器实例创建成功');
                        } catch (error) {
                            console.error('[Mobile Phone] ❌ 创建样式配置管理器实例失败:', error);
                        }
                    } else if (window.styleConfigManager) {
                        console.log('[Mobile Phone] 样式配置管理器实例已存在');
                    } else {
                        console.warn('[Mobile Phone] ⚠️ StyleConfigManager 类未正确加载');
                    }
                }, 500);
            };

            // 设置加载失败回调
            script.onerror = error => {
                console.error('[Mobile Phone] ❌ 样式配置管理器脚本加载失败:', error);
            };

            // 添加到页面
            document.head.appendChild(script);
            console.log('[Mobile Phone] 样式配置管理器脚本已添加到页面');
        } catch (error) {
            console.error('[Mobile Phone] ❌ 动态加载样式配置管理器失败:', error);
        }
    }

    // 打开应用
    openApp(appName) {
        // 防抖检查：如果正在处理相同应用的打开操作，直接返回
        if (this._openingApp === appName) {
            console.log('[Mobile Phone] 防抖：正在打开相同应用，跳过重复操作:', appName);
            return;
        }

        const app = this.apps[appName];
        if (!app) {
            console.warn('[Mobile Phone] 应用不存在:', appName);
            return;
        }

        // 检查是否已经在目标应用的主界面
        if (this.currentApp === appName &&
            this.currentAppState &&
            this.currentAppState.app === appName &&
            this.isAppRootPage(this.currentAppState)) {
            console.log('[Mobile Phone] 已在目标应用主界面，跳过重复打开:', appName);
            return;
        }

        // 记录用户导航意图
        this._userNavigationIntent = {
            targetApp: appName,
            timestamp: Date.now(),
            fromApp: this.currentApp
        };

        // 设置防抖标记
        this._openingApp = appName;

        try {
            console.log('[Mobile Phone] 打开应用:', appName);

            // 检查是否是需要异步加载的应用
            const needsAsyncLoading = ['forum', 'weibo', 'api'].includes(appName);

            if (needsAsyncLoading) {
                // 显示加载状态
                this.showAppLoadingState(appName, app.name);
                // 标记应用正在加载
                this._loadingApps.add(appName);
                this._loadingStartTime[appName] = Date.now();
            }

            this.currentApp = appName;

            // 创建应用状态
            const appState = {
                app: appName,
                title: app.name,
                view: appName === 'messages' ? 'messageList' : 'main', // 消息应用直接设为messageList
            };

            // 清空应用栈并添加新状态
            this.appStack = [appState];
            this.currentAppState = appState;
            this.updateAppHeader(appState);

            // 处理自定义应用
            if (app.isCustomApp && app.customHandler) {
                app.customHandler();
            } else {
                document.getElementById('app-content').innerHTML = app.content;
            }

            // 显示应用界面，隐藏主界面
            document.getElementById('home-screen').style.display = 'none';
            document.getElementById('app-screen').style.display = 'block';

            // 添加动画效果
            document.getElementById('app-screen').classList.add('slide-in');
            setTimeout(() => {
                document.getElementById('app-screen').classList.remove('slide-in');
            }, 300);

        } finally {
            // 清除防抖标记
            setTimeout(() => {
                this._openingApp = null;
            }, 500); // 500ms后清除防抖标记
        }
    }

    // 显示应用加载状态
    showAppLoadingState(appName, appTitle) {
        console.log('[Mobile Phone] 显示应用加载状态:', appName);

        const loadingContent = `
      <div class="app-loading-container">
        <div class="loading-spinner">
          <div class="spinner-ring"></div>
        </div>
        <div class="loading-text">正在加载 ${appTitle}...</div>
        <div class="loading-tip">首次加载可能需要几秒钟</div>
        <div class="loading-progress">
          <div class="progress-bar">
            <div class="progress-fill" id="loading-progress-${appName}"></div>
          </div>
        </div>
      </div>
    `;

        document.getElementById('app-content').innerHTML = loadingContent;

        // 模拟加载进度
        this.simulateLoadingProgress(appName);
    }

    // 模拟加载进度
    simulateLoadingProgress(appName) {
        const progressBar = document.getElementById(`loading-progress-${appName}`);
        if (!progressBar) return;

        let progress = 0;
        const interval = setInterval(() => {
            // 如果应用已经加载完成或用户已经切换到其他应用，停止进度条
            if (!this._loadingApps.has(appName) || this._userNavigationIntent?.targetApp !== appName) {
                clearInterval(interval);
                return;
            }

            progress += Math.random() * 15 + 5; // 随机增加5-20%
            if (progress > 90) progress = 90; // 最多到90%，等待实际加载完成

            progressBar.style.width = `${progress}%`;
        }, 200);

        // 10秒后强制停止进度条（防止卡住）
        setTimeout(() => {
            clearInterval(interval);
        }, 10000);
    }

    // 检查用户导航意图是否仍然有效
    isUserNavigationIntentValid(appName) {
        if (!this._userNavigationIntent) return false;

        const intent = this._userNavigationIntent;
        const now = Date.now();

        // 检查意图是否过期（超过30秒）
        if (now - intent.timestamp > 30000) {
            console.log('[Mobile Phone] 用户导航意图已过期:', intent);
            return false;
        }

        // 检查目标应用是否匹配
        if (intent.targetApp !== appName) {
            console.log('[Mobile Phone] 用户导航意图已改变:', intent.targetApp, '->', appName);
            return false;
        }

        // 检查用户是否已经切换到其他应用
        if (this.currentApp !== appName) {
            console.log('[Mobile Phone] 用户已切换到其他应用:', this.currentApp, '!==', appName);
            return false;
        }

        return true;
    }

    // 完成应用加载
    completeAppLoading(appName) {
        console.log('[Mobile Phone] 完成应用加载:', appName);

        // 移除加载状态
        this._loadingApps.delete(appName);

        // 记录加载时间
        if (this._loadingStartTime[appName]) {
            const loadTime = Date.now() - this._loadingStartTime[appName];
            console.log(`[Mobile Phone] ${appName} 加载耗时: ${loadTime}ms`);
            delete this._loadingStartTime[appName];
        }

        // 检查用户导航意图是否仍然有效
        if (!this.isUserNavigationIntentValid(appName)) {
            console.log('[Mobile Phone] 用户导航意图无效，取消强制跳转:', appName);
            return false; // 不执行跳转
        }

        // 完成进度条
        const progressBar = document.getElementById(`loading-progress-${appName}`);
        if (progressBar) {
            progressBar.style.width = '100%';
        }

        console.log('[Mobile Phone] 应用加载完成，用户导航意图有效:', appName);
        return true; // 可以执行跳转
    }

    // 处理论坛应用
    async handleForumApp() {
        try {
            console.log('[Mobile Phone] 开始处理论坛应用...');

            // 显示加载状态
            document.getElementById('app-content').innerHTML = `
                <div class="loading-placeholder">
                    <div class="loading-icon">⏳</div>
                    <div class="loading-text">正在加载论坛...</div>
                </div>
            `;

            // 确保论坛UI模块已加载，添加超时和重试机制
            console.log('[Mobile Phone] 加载论坛UI模块...');

            const loadWithTimeout = (promise, timeout = 15000) => {
                return Promise.race([
                    promise,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('论坛模块加载超时')), timeout)),
                ]);
            };

            try {
                await loadWithTimeout(this.loadForumApp());
            } catch (error) {
                console.error('[Mobile Phone] 论坛模块加载失败，尝试重新加载:', error);
                // 清理失败的加载状态
                window._forumAppLoading = null;
                await loadWithTimeout(this.loadForumApp());
            }

            // 检查用户导航意图是否仍然有效
            if (!this.completeAppLoading('forum')) {
                console.log('[Mobile Phone] 论坛应用加载完成，但用户已切换到其他应用，取消渲染');
                return;
            }

            // 获取当前应用状态，如果已经在论坛应用中，不重复推送状态
            let currentState = this.appStack[this.appStack.length - 1];

            // 只有当前不在论坛应用中时才推送初始状态
            if (!currentState || currentState.app !== 'forum') {
                const initialState = {
                    app: 'forum',
                    title: '论坛',
                    view: 'main',
                };
                this.pushAppState(initialState);
                currentState = initialState;
            }

            const view = currentState.view || 'main';

            console.log('[Mobile Phone] 当前论坛视图:', view);

            let content = '';

            if (view === 'forumControl') {
                // 显示论坛控制界面
                if (!window.getForumControlAppContent) {
                    throw new Error('getForumControlAppContent 函数未找到');
                }
                console.log('[Mobile Phone] 获取论坛控制内容...');
                content = window.getForumControlAppContent();
            } else {
                // 显示主论坛界面
                if (!window.getForumAppContent) {
                    throw new Error('getForumAppContent 函数未找到');
                }
                console.log('[Mobile Phone] 获取论坛主界面内容...');
                content = window.getForumAppContent();
            }

            if (!content || content.trim() === '') {
                throw new Error(`论坛${view === 'forumControl' ? '控制' : '主界面'}内容为空`);
            }

            document.getElementById('app-content').innerHTML = content;

            // 绑定相应的事件
            console.log('[Mobile Phone] 绑定论坛事件...');
            if (view === 'forumControl') {
                // 绑定论坛控制事件
                if (window.bindForumControlEvents) {
                    window.bindForumControlEvents();
                    console.log('[Mobile Phone] 论坛控制事件绑定完成');
                }
            } else {
                // 绑定主论坛事件
                if (window.bindForumEvents) {
                    window.bindForumEvents();
                    console.log('[Mobile Phone] 论坛主界面事件绑定完成');
                }
            }

            // 确保风格选择器被正确初始化
            setTimeout(() => {
                const forumStyleSelect = document.getElementById('forum-style-select');
                if (forumStyleSelect) {
                    this.initializeForumStyleSelector(forumStyleSelect);
                    console.log('[Mobile Phone] 论坛风格选择器初始化完成');
                }
            }, 500);

            console.log('[Mobile Phone] ✅ 论坛应用加载完成');
        } catch (error) {
            console.error('[Mobile Phone] 处理论坛应用失败:', error);

            // 移除加载状态
            this._loadingApps.delete('forum');

            document.getElementById('app-content').innerHTML = `
                <div class="error-placeholder">
                    <div class="error-icon">❌</div>
                    <div class="error-text">论坛加载失败</div>
                    <div class="error-detail">${error.message}</div>
                    <button onclick="window.mobilePhone.handleForumApp()" class="retry-button">重试</button>
                </div>
            `;
        }
    }

    // 处理微博应用
    async handleWeiboApp() {
        try {
            console.log('[Mobile Phone] 开始处理微博应用...');

            // 显示加载状态
            document.getElementById('app-content').innerHTML = `
                <div class="loading-placeholder">
                    <div class="loading-icon">⏳</div>
                    <div class="loading-text">正在加载微博...</div>
                </div>
            `;

            // 确保微博UI模块已加载，添加超时和重试机制
            console.log('[Mobile Phone] 加载微博UI模块...');

            const loadWithTimeout = (promise, timeout = 15000) => {
                return Promise.race([
                    promise,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('微博模块加载超时')), timeout)),
                ]);
            };

            try {
                await loadWithTimeout(this.loadWeiboApp());
            } catch (error) {
                console.error('[Mobile Phone] 微博模块加载失败，尝试重新加载:', error);
                // 清理失败的加载状态
                window._weiboAppLoading = null;
                await loadWithTimeout(this.loadWeiboApp());
            }

            // 检查用户导航意图是否仍然有效
            if (!this.completeAppLoading('weibo')) {
                console.log('[Mobile Phone] 微博应用加载完成，但用户已切换到其他应用，取消渲染');
                return;
            }

            // 获取当前应用状态
            const currentState = this.appStack[this.appStack.length - 1] || { view: 'main' };
            const view = currentState.view || 'main';

            console.log('[Mobile Phone] 当前微博视图:', view);

            let content = '';

            if (view === 'weiboControl') {
                // 显示微博控制界面
                if (!window.getWeiboControlAppContent) {
                    throw new Error('getWeiboControlAppContent 函数未找到');
                }
                console.log('[Mobile Phone] 获取微博控制内容...');
                content = window.getWeiboControlAppContent();
            } else {
                // 显示主微博界面
                if (!window.getWeiboAppContent) {
                    throw new Error('getWeiboAppContent 函数未找到');
                }
                console.log('[Mobile Phone] 获取微博主界面内容...');
                content = window.getWeiboAppContent();
            }

            if (!content || content.trim() === '') {
                throw new Error(`微博${view === 'weiboControl' ? '控制' : '主界面'}内容为空`);
            }

            document.getElementById('app-content').innerHTML = content;

            // 绑定相应的事件
            console.log('[Mobile Phone] 绑定微博事件...');
            if (view === 'weiboControl') {
                // 绑定微博控制事件
                if (window.bindWeiboControlEvents) {
                    window.bindWeiboControlEvents();
                    console.log('[Mobile Phone] 微博控制事件绑定完成');
                }
            } else {
                // 绑定主微博事件
                if (window.bindWeiboEvents) {
                    window.bindWeiboEvents();
                    console.log('[Mobile Phone] 微博主界面事件绑定完成');
                }
            }

            console.log('[Mobile Phone] ✅ 微博应用加载完成');
        } catch (error) {
            console.error('[Mobile Phone] 处理微博应用失败:', error);

            // 移除加载状态
            this._loadingApps.delete('weibo');

            document.getElementById('app-content').innerHTML = `
                <div class="error-placeholder">
                    <div class="error-icon">❌</div>
                    <div class="error-text">微博加载失败</div>
                    <div class="error-detail">${error.message}</div>
                    <button onclick="window.mobilePhone.handleWeiboApp()" class="retry-button">重试</button>
                </div>
            `;
        }
    }

    // 处理设置应用
    async handleSettingsApp() {
        try {
            console.log('[Mobile Phone] 开始处理设置应用...');

            // 显示加载状态
            document.getElementById('app-content').innerHTML = `
                <div class="loading-placeholder">
                    <div class="loading-icon">⏳</div>
                    <div class="loading-text">正在加载样式设置...</div>
                </div>
            `;

            // 确保样式配置管理器已加载
            console.log('[Mobile Phone] 加载样式配置管理器模块...');
            await this.loadStyleConfigApp();

            // 直接使用全局函数获取内容
            if (!window.getStyleConfigAppContent) {
                throw new Error('getStyleConfigAppContent 函数未找到');
            }

            // 获取样式配置应用内容
            console.log('[Mobile Phone] 获取样式配置内容...');
            const content = window.getStyleConfigAppContent();

            if (!content || content.trim() === '') {
                throw new Error('样式配置应用内容为空');
            }

            document.getElementById('app-content').innerHTML = content;

            // 绑定样式配置应用事件
            console.log('[Mobile Phone] 绑定样式配置事件...');
            if (window.bindStyleConfigEvents) {
                // bindStyleConfigEvents 现在会自动等待管理器准备就绪
                window.bindStyleConfigEvents();
            }

            // 如果样式配置管理器还没有准备就绪，显示加载状态
            if (window.styleConfigManager && !window.styleConfigManager.isConfigReady()) {
                console.log('[Mobile Phone] 等待样式配置管理器准备就绪...');

                // 添加加载提示
                const loadingHint = document.createElement('div');
                loadingHint.className = 'config-loading-hint';
                loadingHint.innerHTML = `
                    <div style="
                        position: fixed;
                        top: 20px;
                        left: 50%;
                        transform: translateX(-50%);
                        background: #2196F3;
                        color: white;
                        padding: 10px 20px;
                        border-radius: 20px;
                        font-size: 14px;
                        z-index: 10000;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                    ">
                        ⏳ 正在初始化样式配置管理器...
                    </div>
                `;
                document.body.appendChild(loadingHint);

                // 等待准备就绪后移除提示
                window.styleConfigManager
                    .waitForReady()
                    .then(() => {
                        console.log('[Mobile Phone] 样式配置管理器已准备就绪');
                        if (loadingHint.parentNode) {
                            loadingHint.remove();
                        }
                    })
                    .catch(error => {
                        console.error('[Mobile Phone] 等待样式配置管理器失败:', error);
                        if (loadingHint.parentNode) {
                            loadingHint.innerHTML = `
                            <div style="
                                position: fixed;
                                top: 20px;
                                left: 50%;
                                transform: translateX(-50%);
                                background: #ff4444;
                                color: white;
                                padding: 10px 20px;
                                border-radius: 20px;
                                font-size: 14px;
                                z-index: 10000;
                                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                            ">
                                ❌ 样式配置管理器初始化失败
                            </div>
                        `;
                            setTimeout(() => loadingHint.remove(), 3000);
                        }
                    });
            }

            console.log('[Mobile Phone] ✅ 设置应用加载完成');
        } catch (error) {
            console.error('[Mobile Phone] 处理设置应用失败:', error);
            document.getElementById('app-content').innerHTML = `
                <div class="error-state">
                    <div class="error-icon">⚠️</div>
                    <div class="error-title">设置应用加载失败</div>
                    <div class="error-message">${error.message}</div>
                    <button onclick="window.mobilePhone.handleSettingsApp()" class="retry-button">重试</button>
                </div>
            `;
        }
    }

    // 处理消息应用
    async handleMessagesApp() {
        try {
            console.log('[Mobile Phone] 开始处理消息应用...');

            // 显示加载状态
            document.getElementById('app-content').innerHTML = `
                <div class="loading-placeholder">
                    <div class="loading-icon">⏳</div>
                    <div class="loading-text">正在加载消息应用...</div>
                </div>
            `;

            // 确保message-app已加载
            console.log('[Mobile Phone] 加载消息应用模块...');
            await this.loadMessageApp();

            // 直接使用全局函数获取内容
            if (!window.getMessageAppContent) {
                throw new Error('getMessageAppContent 函数未找到');
            }

            // 获取消息应用内容
            console.log('[Mobile Phone] 获取应用内容...');
            const content = window.getMessageAppContent();

            if (!content || content.trim() === '') {
                throw new Error('消息应用内容为空');
            }

            document.getElementById('app-content').innerHTML = content;

            // 绑定消息应用事件
            console.log('[Mobile Phone] 绑定事件...');
            if (window.bindMessageAppEvents) {
                window.bindMessageAppEvents();
            }

            // 确保应用状态正确（不重新创建，使用已有状态）
            if (!this.currentAppState || this.currentAppState.app !== 'messages') {
                const messageState = {
                    app: 'messages',
                    title: '信息',
                    view: 'messageList',
                };
                this.currentAppState = messageState;
                this.appStack = [messageState];
                this.updateAppHeader(messageState);
            }

            console.log('[Mobile Phone] 消息应用加载完成');
        } catch (error) {
            console.error('[Mobile Phone] 加载消息应用失败:', error);

            // 显示友好的错误信息
            document.getElementById('app-content').innerHTML = `
                <div class="error-message">
                    <div class="error-icon">⚠️</div>
                    <div class="error-title">加载失败</div>
                    <div class="error-details">${error.message}</div>
                    <button class="retry-button" onclick="window.MobilePhone.openApp('messages')">
                        重试
                    </button>
                </div>
            `;
        }
    }

    // 处理状态应用
    async handleStatusApp() {
        try {
            console.log('[Mobile Phone] 开始处理状态应用...');

            // 显示加载状态
            document.getElementById('app-content').innerHTML = `
                <div class="loading-placeholder">
                    <div class="loading-icon">⏳</div>
                    <div class="loading-text">正在加载状态应用...</div>
                </div>
            `;

            // 确保status-app已加载
            console.log('[Mobile Phone] 加载状态应用模块...');
            await this.loadStatusApp();

            // 直接使用全局函数获取内容
            if (!window.getStatusAppContent) {
                throw new Error('getStatusAppContent 函数未找到');
            }

            // 获取状态应用内容
            console.log('[Mobile Phone] 获取状态应用内容...');
            const content = window.getStatusAppContent();

            if (!content || content.trim() === '') {
                throw new Error('状态应用内容为空');
            }

            document.getElementById('app-content').innerHTML = content;

            // 绑定事件
            console.log('[Mobile Phone] 绑定状态应用事件..');
            if (window.bindStatusAppEvents) {
                window.bindStatusAppEvents();
            }

            console.log('[Mobile Phone] ✅ 状态应用加载完成');
        } catch (error) {
            console.error('[Mobile Phone] ❌ 处理状态应用失败:', error);
            document.getElementById('app-content').innerHTML = `
                <div class="error-message">
                    <div class="error-icon">⚠️</div>
                    <div class="error-text">状态应用加载失败</div>
                    <div class="error-details">${error.message}</div>
                    <button onclick="window.mobilePhone.handleStatusApp()" class="retry-button">重试</button>
                </div>
            `;
        }
    }

    // 处理日记应用
    async handleDiaryApp() {
        try {
            console.log('[Mobile Phone] 开始处理日记应用...');

            // 显示加载状态
            document.getElementById('app-content').innerHTML = `
                <div class="loading-placeholder">
                    <div class="loading-icon">⏳</div>
                    <div class="loading-text">正在加载日记应用...</div>
                </div>
            `;

            // 确保diary-app已加载
            console.log('[Mobile Phone] 加载日记应用模块...');
            await this.loadDiaryApp();

            // 直接使用全局函数获取内容
            if (!window.getDiaryAppContent) {
                throw new Error('getDiaryAppContent 函数未找到');
            }

            // 获取日记应用内容
            console.log('[Mobile Phone] 获取日记应用内容...');
            const content = window.getDiaryAppContent();

            if (!content || content.trim() === '') {
                throw new Error('日记应用内容为空');
            }

            document.getElementById('app-content').innerHTML = content;

            // 绑定事件
            console.log('[Mobile Phone] 绑定日记应用事件...');
            if (window.bindDiaryAppEvents) {
                window.bindDiaryAppEvents();
            }

            console.log('[Mobile Phone] ✅ 日记应用加载完成');
        } catch (error) {
            console.error('[Mobile Phone] ❌ 处理日记应用失败:', error);
            document.getElementById('app-content').innerHTML = `
                <div class="error-message">
                    <div class="error-icon">⚠️</div>
                    <div class="error-text">日记应用加载失败</div>
                    <div class="error-details">${error.message}</div>
                    <button onclick="window.mobilePhone.handleDiaryApp()" class="retry-button">重试</button>
                </div>
            `;
        }
    }

    // 处理购物应用
    async handleShopApp() {
        try {
            console.log('[Mobile Phone] 开始处理购物应用...');

            // 显示加载状态
            document.getElementById('app-content').innerHTML = `
                <div class="loading-placeholder">
                    <div class="loading-icon">⏳</div>
                    <div class="loading-text">正在加载购物应用...</div>
                </div>
            `;

            // 确保shop-app已加载
            console.log('[Mobile Phone] 加载购物应用模块...');
            await this.loadShopApp();

            // 直接使用全局函数获取内容
            if (!window.getShopAppContent) {
                throw new Error('getShopAppContent 函数未找到');
            }

            // 获取购物应用内容
            console.log('[Mobile Phone] 获取购物应用内容...');
            const content = window.getShopAppContent();

            if (!content || content.trim() === '') {
                throw new Error('购物应用内容为空');
            }

            document.getElementById('app-content').innerHTML = content;

            // 绑定购物应用事件
            console.log('[Mobile Phone] 绑定购物应用事件...');
            if (window.bindShopAppEvents) {
                window.bindShopAppEvents();
            }

            console.log('[Mobile Phone] ✅ 购物应用加载完成');
        } catch (error) {
            console.error('[Mobile Phone] 处理购物应用失败:', error);
            document.getElementById('app-content').innerHTML = `
                <div class="error-placeholder">
                    <div class="error-icon">❌</div>
                    <div class="error-text">购物应用加载失败</div>
                    <div class="error-detail">${error.message}</div>
                    <button onclick="window.mobilePhone.handleShopApp()" class="retry-button">重试</button>
                </div>
            `;
        }
    }

    // 处理背包应用
    async handleBackpackApp() {
        try {
            console.log('[Mobile Phone] 开始处理背包应用...');

            // 显示加载状态
            document.getElementById('app-content').innerHTML = `
                <div class="loading-placeholder">
                    <div class="loading-icon">⏳</div>
                    <div class="loading-text">正在加载背包应用...</div>
                </div>
            `;

            // 确保backpack-app已加载
            console.log('[Mobile Phone] 加载背包应用模块...');
            await this.loadBackpackApp();

            // 直接使用全局函数获取内容
            if (!window.getBackpackAppContent) {
                throw new Error('getBackpackAppContent 函数未找到');
            }

            // 获取背包应用内容
            console.log('[Mobile Phone] 获取背包应用内容...');
            const content = window.getBackpackAppContent();

            if (!content || content.trim() === '') {
                throw new Error('背包应用内容为空');
            }

            document.getElementById('app-content').innerHTML = content;

            // 绑定背包应用事件
            console.log('[Mobile Phone] 绑定背包应用事件...');
            if (window.bindBackpackAppEvents) {
                window.bindBackpackAppEvents();
            }

            console.log('[Mobile Phone] ✅ 背包应用加载完成');
        } catch (error) {
            console.error('[Mobile Phone] 处理背包应用失败:', error);
            document.getElementById('app-content').innerHTML = `
                <div class="error-placeholder">
                    <div class="error-icon">❌</div>
                    <div class="error-text">背包应用加载失败</div>
                    <div class="error-detail">${error.message}</div>
                    <button onclick="window.mobilePhone.handleBackpackApp()" class="retry-button">重试</button>
                </div>
            `;
        }
    }

    // 处理任务应用
    async handleTaskApp() {
        try {
            console.log('[Mobile Phone] 开始处理任务应用...');

            // 显示加载状态
            document.getElementById('app-content').innerHTML = `
                <div class="loading-placeholder">
                    <div class="loading-icon">⏳</div>
                    <div class="loading-text">正在加载任务应用...</div>
                </div>
            `;

            // 确保task-app已加载
            console.log('[Mobile Phone] 加载任务应用模块...');
            await this.loadTaskApp();

            // 直接使用全局函数获取内容
            if (!window.getTaskAppContent) {
                throw new Error('getTaskAppContent 函数未找到');
            }

            // 获取任务应用内容
            console.log('[Mobile Phone] 获取任务应用内容...');
            const content = window.getTaskAppContent();

            if (!content || content.trim() === '') {
                throw new Error('任务应用内容为空');
            }

            document.getElementById('app-content').innerHTML = content;

            // 绑定任务应用事件
            console.log('[Mobile Phone] 绑定任务应用事件...');
            if (window.bindTaskAppEvents) {
                window.bindTaskAppEvents();
            }

            console.log('[Mobile Phone] ✅ 任务应用加载完成');
        } catch (error) {
            console.error('[Mobile Phone] 处理任务应用失败:', error);
            document.getElementById('app-content').innerHTML = `
                <div class="error-placeholder">
                    <div class="error-icon">❌</div>
                    <div class="error-text">任务应用加载失败</div>
                    <div class="error-detail">${error.message}</div>
                    <button onclick="window.mobilePhone.handleTaskApp()" class="retry-button">重试</button>
                </div>
            `;
        }
    }

    // 处理直播应用
    async handleLiveApp() {
        try {
            console.log('[Mobile Phone] 开始处理直播应用...');

            // 显示加载状态
            document.getElementById('app-content').innerHTML = `
                <div class="loading-placeholder">
                    <div class="loading-icon">⏳</div>
                    <div class="loading-text">正在加载直播应用...</div>
                </div>
            `;

            // 确保live-app已加载
            console.log('[Mobile Phone] 加载直播应用模块...');
            await this.loadLiveApp();

            // 直接使用全局函数获取内容
            if (!window.getLiveAppContent) {
                throw new Error('getLiveAppContent 函数未找到');
            }

            // 获取直播应用内容
            console.log('[Mobile Phone] 获取直播应用内容...');
            const content = window.getLiveAppContent();

            if (!content || content.trim() === '') {
                throw new Error('直播应用内容为空');
            }

            document.getElementById('app-content').innerHTML = content;

            // 绑定直播应用事件
            console.log('[Mobile Phone] 绑定直播应用事件...');
            if (window.bindLiveAppEvents) {
                window.bindLiveAppEvents();
            }

            console.log('[Mobile Phone] ✅ 直播应用加载完成');
        } catch (error) {
            console.error('[Mobile Phone] 处理直播应用失败:', error);
            document.getElementById('app-content').innerHTML = `
                <div class="error-placeholder">
                    <div class="error-icon">❌</div>
                    <div class="error-text">直播应用加载失败</div>
                    <div class="error-detail">${error.message}</div>
                    <button onclick="window.mobilePhone.handleLiveApp()" class="retry-button">重试</button>
                </div>
            `;
        }
    }

    // 处理观看直播应用
    async handleWatchLiveApp() {
        try {
            console.log('[Mobile Phone] 开始处理观看直播应用...');

            // 显示加载状态
            document.getElementById('app-content').innerHTML = `
                <div class="loading-placeholder">
                    <div class="loading-icon">⏳</div>
                    <div class="loading-text">正在加载观看直播应用...</div>
                </div>
            `;

            // 确保watch-live已加载
            console.log('[Mobile Phone] 加载观看直播应用模块...');
            await this.loadWatchLiveApp();

            // 直接使用全局函数获取内容
            if (!window.getWatchLiveAppContent) {
                throw new Error('getWatchLiveAppContent 函数未找到');
            }

            // 获取观看直播应用内容
            console.log('[Mobile Phone] 获取观看直播应用内容...');
            const content = window.getWatchLiveAppContent();

            if (!content || content.trim() === '') {
                throw new Error('观看直播应用内容为空');
            }

            document.getElementById('app-content').innerHTML = content;

            // 绑定观看直播应用事件
            console.log('[Mobile Phone] 绑定观看直播应用事件...');
            if (window.bindWatchLiveAppEvents) {
                window.bindWatchLiveAppEvents();
            }

            console.log('[Mobile Phone] ✅ 观看直播应用加载完成');
        } catch (error) {
            console.error('[Mobile Phone] 处理观看直播应用失败:', error);
            document.getElementById('app-content').innerHTML = `
                <div class="error-placeholder">
                    <div class="error-icon">❌</div>
                    <div class="error-text">观看直播应用加载失败</div>
                    <div class="error-detail">${error.message}</div>
                    <button onclick="window.mobilePhone.handleWatchLiveApp()" class="retry-button">重试</button>
                </div>
            `;
        }
    }

    // 处理平行事件应用
    async handleParallelEventsApp() {
        try {
            console.log('[Mobile Phone] 开始处理平行事件应用...');

            // 显示加载状态
            document.getElementById('app-content').innerHTML = `
                <div class="loading-placeholder">
                    <div class="loading-icon">⏳</div>
                    <div class="loading-text">正在加载平行事件应用...</div>
                </div>
            `;

            // 确保parallel-events-app已加载
            console.log('[Mobile Phone] 加载平行事件应用模块...');

            // 如果全局变量不存在，尝试简单加载
            if (!window.ParallelEventsApp || !window.getParallelEventsAppContent ||
                !window.bindParallelEventsAppEvents || !window.parallelEventsStyles) {
                console.log('[Mobile Phone] 平行事件应用模块未加载，尝试简单加载...');
                await this.simpleLoadParallelEventsApp();
            } else {
                console.log('[Mobile Phone] 平行事件应用模块已存在');
            }

            // 检查必要的全局变量
            console.log('[Mobile Phone] 检查全局变量状态:');
            console.log('  - ParallelEventsApp:', typeof window.ParallelEventsApp);
            console.log('  - getParallelEventsAppContent:', typeof window.getParallelEventsAppContent);
            console.log('  - bindParallelEventsAppEvents:', typeof window.bindParallelEventsAppEvents);
            console.log('  - parallelEventsStyles:', typeof window.parallelEventsStyles);
            console.log('  - parallelEventsManager:', typeof window.parallelEventsManager);

            if (!window.getParallelEventsAppContent) {
                throw new Error('getParallelEventsAppContent 函数未找到');
            }

            if (!window.bindParallelEventsAppEvents) {
                throw new Error('bindParallelEventsAppEvents 函数未找到');
            }

            // 获取平行事件应用内容
            console.log('[Mobile Phone] 获取平行事件应用内容...');
            const content = window.getParallelEventsAppContent();

            if (!content || content.trim() === '') {
                throw new Error('平行事件应用内容为空');
            }

            document.getElementById('app-content').innerHTML = content;

            // 绑定平行事件应用事件
            console.log('[Mobile Phone] 绑定平行事件应用事件...');
            if (window.bindParallelEventsAppEvents) {
                await window.bindParallelEventsAppEvents();
            }

            console.log('[Mobile Phone] 平行事件管理器状态:', {
                manager: !!window.parallelEventsManager,
                isListening: window.parallelEventsManager?.isListening,
                settings: window.parallelEventsManager?.currentSettings
            });

            console.log('[Mobile Phone] ✅ 平行事件应用加载完成');
        } catch (error) {
            console.error('[Mobile Phone] 处理平行事件应用失败:', error);
            document.getElementById('app-content').innerHTML = `
                <div class="error-placeholder">
                    <div class="error-icon">❌</div>
                    <div class="error-text">平行事件应用加载失败</div>
                    <div class="error-detail">${error.message}</div>
                    <button onclick="window.mobilePhone.handleParallelEventsApp()" class="retry-button">重试</button>
                </div>
            `;
        }
    }

    // 处理档案管理应用
    async handleProfileApp() {
        try {
            console.log('[Mobile Phone] 开始处理档案管理应用...');

            // 显示加载状态
            document.getElementById('app-content').innerHTML = `
                <div class="loading-placeholder">
                    <div class="loading-icon">⏳</div>
                    <div class="loading-text">正在加载档案管理...</div>
                </div>
            `;

            // 确保档案应用已加载
            console.log('[Mobile Phone] 加载档案应用模块...');
            await this.loadProfileApp();

            // 检查档案应用是否就绪
            if (!window.profileApp) {
                throw new Error('档案应用未就绪');
            }

            // 获取档案应用内容
            console.log('[Mobile Phone] 获取档案应用内容...');
            const content = window.profileApp.getAppContent();

            if (!content || content.trim() === '') {
                throw new Error('档案应用内容为空');
            }

            document.getElementById('app-content').innerHTML = content;

            console.log('[Mobile Phone] ✅ 档案应用加载完成');
        } catch (error) {
            console.error('[Mobile Phone] ❌ 档案应用加载失败:', error);
            document.getElementById('app-content').innerHTML = `
                <div class="error-placeholder">
                    <div class="error-icon">❌</div>
                    <div class="error-text">档案应用加载失败</div>
                    <div class="error-detail">${error.message}</div>
                    <button onclick="window.mobilePhone.handleProfileApp()" class="retry-button">重试</button>
                </div>
            `;
        }
    }

    // 处理统一API设置应用
    async handleApiApp() {
        try {
            console.log('[Mobile Phone] 开始处理统一API设置应用...');

            // 显示加载状态
            document.getElementById('app-content').innerHTML = `
                <div class="loading-placeholder">
                    <div class="loading-icon">⏳</div>
                    <div class="loading-text">正在加载API设置...</div>
                </div>
            `;

            // 确保必要的模块已加载，添加超时控制
            console.log('[Mobile Phone] 确保论坛、微博和平行事件模块已加载...');

            const loadWithTimeout = (promise, timeout = 10000, name = '') => {
                return Promise.race([
                    promise,
                    new Promise((_, reject) => setTimeout(() => reject(new Error(`${name}加载超时`)), timeout)),
                ]);
            };

            await Promise.all([
                loadWithTimeout(this.loadForumApp(), 10000, '论坛模块').catch(e =>
                    console.warn('[Mobile Phone] 论坛模块加载失败:', e),
                ),
                loadWithTimeout(this.loadWeiboApp(), 10000, '微博模块').catch(e =>
                    console.warn('[Mobile Phone] 微博模块加载失败:', e),
                ),
                loadWithTimeout(this.simpleLoadParallelEventsApp(), 10000, '平行事件模块').catch(e =>
                    console.warn('[Mobile Phone] 平行事件模块加载失败:', e),
                ),
            ]);

            // 检查用户导航意图是否仍然有效
            if (!this.completeAppLoading('api')) {
                console.log('[Mobile Phone] API设置应用加载完成，但用户已切换到其他应用，取消渲染');
                return;
            }

            // 生成统一的API设置面板HTML
            const content = this.getUnifiedApiSettingsHTML();

            document.getElementById('app-content').innerHTML = content;

            // 绑定统一API设置事件
            console.log('[Mobile Phone] 绑定统一API设置事件...');
            this.bindUnifiedApiEvents();

            // 确保风格选择器被正确初始化
            setTimeout(() => {
                const forumStyleSelect = document.getElementById('forum-style-select');
                if (forumStyleSelect) {
                    this.initializeForumStyleSelector(forumStyleSelect);
                    console.log('[Mobile Phone] API设置页面风格选择器初始化完成');
                }

                // 初始化平行事件设置（现在HTML已经包含正确的值，只需要绑定事件）
                console.log('[Mobile Phone] 平行事件设置已通过HTML正确初始化');
            }, 500);

            console.log('[Mobile Phone] ✅ 统一API设置应用加载完成');
        } catch (error) {
            console.error('[Mobile Phone] 处理统一API设置应用失败:', error);

            // 移除加载状态
            this._loadingApps.delete('api');

            document.getElementById('app-content').innerHTML = `
                <div class="error-placeholder">
                    <div class="error-icon">❌</div>
                    <div class="error-text">API设置加载失败</div>
                    <div class="error-detail">${error.message}</div>
                    <button onclick="window.mobilePhone.handleApiApp()" class="retry-button">重试</button>
                </div>
            `;
        }
    }

    // 生成统一的API设置面板HTML
    getUnifiedApiSettingsHTML() {
        // 获取当前设置
        const forumSettings = window.forumManager
            ? window.forumManager.currentSettings
            : {
                selectedStyle: '贴吧老哥',
                autoUpdate: true,
                threshold: 10,
            };

        const weiboSettings = window.weiboManager
            ? window.weiboManager.currentSettings
            : {
                autoUpdate: true,
                threshold: 10,
            };

        // 获取平行事件设置
        let parallelEventsSettings = {
            threshold: 10,
            enabled: false,
            selectedStyle: '平行事件',
            customPrefix: ''
        };

        try {
            const saved = localStorage.getItem('parallelEventsSettings');
            if (saved) {
                parallelEventsSettings = { ...parallelEventsSettings, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.warn('[Mobile Phone] 获取平行事件设置失败:', error);
        }

        return `
            <div class="unified-api-settings">


                <div class="settings-tabs">
                    <div class="tab-buttons">
                        <button class="tab-btn active" data-tab="forum">论坛</button>
                        <button class="tab-btn" data-tab="forum-styles">论坛风格</button>
                        <button class="tab-btn" data-tab="parallel-events">平行事件</button>
                        <button class="tab-btn" data-tab="weibo">微博</button>
                        <button class="tab-btn" data-tab="api">API</button>
                    </div>

                    <div class="m-tab-content" id="forum-tab" style="display: block;">
                        <div class="setting-group">
                            <label>论坛风格:</label>
                            <select id="forum-style-select">
                                <option value="贴吧老哥" ${forumSettings.selectedStyle === '贴吧老哥' ? 'selected' : ''
            }>贴吧老哥</option>
                                <option value="知乎精英" ${forumSettings.selectedStyle === '知乎精英' ? 'selected' : ''
            }>知乎精英</option>
                                <option value="小红书种草" ${forumSettings.selectedStyle === '小红书种草' ? 'selected' : ''
            }>小红书种草</option>
                                <option value="抖音达人" ${forumSettings.selectedStyle === '抖音达人' ? 'selected' : ''
            }>抖音达人</option>
                                <option value="B站UP主" ${forumSettings.selectedStyle === 'B站UP主' ? 'selected' : ''
            }>B站UP主</option>
                                <option value="海角老司机" ${forumSettings.selectedStyle === '海角老司机' ? 'selected' : ''
            }>海角老司机</option>
                                <option value="八卦小报记者" ${forumSettings.selectedStyle === '八卦小报记者' ? 'selected' : ''
            }>八卦小报记者</option>
                                <option value="天涯老涯友" ${forumSettings.selectedStyle === '天涯老涯友' ? 'selected' : ''
            }>天涯老涯友</option>
                                <option value="校园论坛" ${forumSettings.selectedStyle === '校园论坛' ? 'selected' : ''
            }>校园论坛</option>
                                <option value="微博" ${forumSettings.selectedStyle === '微博' ? 'selected' : ''
            }>微博</option>
                            </select>
                        </div>

                        <div class="setting-group">
                            <label>自定义前缀:</label>
                            <textarea id="forum-custom-prefix" placeholder="论坛生成的自定义提示词...">${window.forumStyles ? window.forumStyles.getCustomPrefix() : ''
            }</textarea>
                        </div>

                        <div class="setting-group">
                            <label>消息阈值:</label>
                            <input type="number" id="forum-threshold" value="${forumSettings.threshold
            }" min="1" max="100">
                        </div>

                        <div class="setting-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="forum-auto-update" ${forumSettings.autoUpdate ? 'checked' : ''
            }>
                                自动生成论坛内容
                            </label>
                        </div>

                        <div class="action-buttons">
                            <button id="generate-forum-now" class="btn-primary">🚀 立即生成论坛</button>
                            <button id="clear-forum-content" class="btn-danger">🗑️ 清除论坛内容</button>
                        </div>
                    </div>

                    <div class="m-tab-content" id="forum-styles-tab" style="display: none;">
                        <div class="forum-styles-container">
                            <div class="styles-header">
                                <h3>🎨 论坛风格管理</h3>
                                <p>创建和管理你的自定义论坛风格</p>
                            </div>

                            <div class="styles-actions">
                                <button id="create-custom-style-btn" class="btn-primary">
                                    <i class="fas fa-plus"></i> 创建自定义风格
                                </button>
                                <div class="import-export-actions">
                                    <button id="export-styles-btn" class="btn-secondary">
                                        <i class="fas fa-download"></i> 导出风格
                                    </button>
                                    <button id="import-styles-btn" class="btn-secondary">
                                        <i class="fas fa-upload"></i> 导入风格
                                    </button>
                                    <input type="file" id="import-styles-input" accept=".json" style="display: none;">
                                </div>
                            </div>

                            <div class="custom-styles-list">
                                <h4>自定义风格列表111</h4>
                                <div id="custom-styles-container">
                                    <div class="no-styles-placeholder">
                                        <div class="placeholder-icon">🎭</div>
                                        <div class="placeholder-text">还没有自定义风格</div>
                                        <div class="placeholder-hint">点击上方按钮创建你的第一个风格</div>
                                    </div>
                                </div>
                            </div>

                            <div class="styles-info">
                                <h4>使用说明</h4>
                                <ul>
                                    <li>自定义风格会出现在论坛风格选择器中</li>
                                    <li>可以导出风格文件在其他设备上使用</li>
                                    <li>编辑风格时请保持格式的完整性</li>
                                    <li>风格内容支持所有论坛功能和格式</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div class="m-tab-content" id="parallel-events-tab" style="display: none;">
                        <div class="parallel-events-container">
                            <div class="settings-header">
                                <h3>🌀 平行事件设置</h3>
                                <p>配置平行事件的生成风格和自定义前缀</p>
                            </div>

                            <div class="setting-group">
                                <label>事件风格:</label>
                                <select id="parallel-events-style-select">
                                    <option value="被ntr" ${parallelEventsSettings.selectedStyle === '被ntr' ? 'selected' : ''}>被ntr</option>
                                    <option value="主人的任务" ${parallelEventsSettings.selectedStyle === '主人的任务' ? 'selected' : ''}>主人的任务</option>
                                    <option value="主动消息" ${parallelEventsSettings.selectedStyle === '主动消息' ? 'selected' : ''}>主动消息</option>
                                    <option value="平行事件" ${parallelEventsSettings.selectedStyle === '平行事件' ? 'selected' : ''}>平行事件</option>
                                    <option value="魅魔之体" ${parallelEventsSettings.selectedStyle === '魅魔之体' ? 'selected' : ''}>魅魔之体</option>
                                    <option value="随机新闻" ${parallelEventsSettings.selectedStyle === '随机新闻' ? 'selected' : ''}>随机新闻</option>
                                    <option value="自定义" ${parallelEventsSettings.selectedStyle === '自定义' ? 'selected' : ''}>自定义</option>
                                </select>
                            </div>

                            <div class="setting-group">
                                <label>自定义前缀:</label>
                                <textarea id="parallel-events-custom-prefix" placeholder="当选择'自定义'风格时，请在此输入具体的风格要求和生成指导...">${parallelEventsSettings.customPrefix || ''}</textarea>
                                <small>提示：选择"自定义"风格时，此前缀将作为主要的风格指导</small>
                            </div>

                            <div class="setting-group">
                                <label>监听阈值:</label>
                                <input type="number" id="parallel-events-threshold" value="${parallelEventsSettings.threshold}" min="3" max="99">
                                <small>楼层变化达到此数量时触发平行事件生成</small>
                            </div>

                            <div class="setting-group">
                                <label>启用监听:</label>
                                <div class="toggle-switch2">
                                    <input type="checkbox" id="parallel-events-enabled" ${parallelEventsSettings.enabled ? 'checked' : ''}>

                                </div>
                                <small>开启后将持续监听楼层变化，无论手机界面是否打开</small>
                            </div>

                            <div class="setting-group">
                                <button id="test-parallel-events" class="btn-primary">🧪 测试生成</button>
                            </div>

                            <div class="parallel-events-info">
                                <h4>使用说明</h4>
                                <ul>
                                    <li>平行事件会根据最近5层楼的对话内容生成相关的背景事件</li>
                                    <li>生成的内容会自动插入到最新楼层</li>
                                    <li>选择"自定义"风格可以完全自定义生成要求</li>
                                    <li>自定义前缀可以进一步细化任何风格的生成方向</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div class="m-tab-content" id="weibo-tab" style="display: none;">


                        <div class="setting-group">
                            <label>自定义前缀:</label>
                            <textarea id="weibo-custom-prefix" placeholder="微博生成的自定义提示词...">${window.weiboStyles ? window.weiboStyles.getCustomPrefix() : ''
            }</textarea>
                        </div>

                        <div class="setting-group">
                            <label>消息阈值:</label>
                            <input type="number" id="weibo-threshold" value="${weiboSettings.threshold
            }" min="1" max="100">
                        </div>

                        <div class="setting-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="weibo-auto-update" ${weiboSettings.autoUpdate ? 'checked' : ''
            }>
                                自动生成微博内容
                            </label>
                        </div>

                        <div class="action-buttons">
                            <button id="generate-weibo-now" class="btn-primary">🚀 立即生成微博</button>
                            <button id="clear-weibo-content" class="btn-danger">🗑️ 清除微博内容</button>
                        </div>
                    </div>

                    <div class="m-tab-content" id="api-tab" style="display: none;">
                        <div class="setting-group">
                            <label>API配置:</label>
                            <button id="open-api-config" class="btn-secondary">🔧 打开API配置面板</button>
                            <p class="setting-description">配置用于生成论坛和微博内容的API设置</p>
                        </div>

                        <div class="setting-group">
                            <label>状态监控:</label>
                            <div class="status-display">
                                <div class="status-item">
                                    <span class="status-label">论坛管理器:</span>
                                    <span id="forum-status" class="status-value">检查中...</span>
                                </div>
                                <div class="status-item">
                                    <span class="status-label">微博管理器:</span>
                                    <span id="weibo-status" class="status-value">检查中...</span>
                                </div>
                                <div class="status-item">
                                    <span class="status-label">平行事件管理器:</span>
                                    <span id="parallel-events-status" class="status-value">检查中...</span>
                                </div>
                                <div class="status-item">
                                    <span class="status-label">API配置:</span>
                                    <span id="api-config-status" class="status-value">检查中...</span>
                                </div>
                            </div>
                        </div>

                        <div class="action-buttons">
                            <button id="refresh-status" class="btn-secondary">🔄 刷新状态</button>
                            <button id="reset-all-settings" class="btn-warning">⚠️ 重置所有设置</button>
                        </div>
                    </div>
                </div>

                <style>
                    .unified-api-settings {
                        padding: 20px 0;
                        max-width: 100%;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    }



                    .settings-tabs {
                        background: white;
                        border-radius: 10px;
                        overflow: hidden;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }

                    .tab-buttons {
                        display: flex;
                        background: #f5f5f5;
                        border-bottom: 1px solid #e0e0e0;
                    }

                    .tab-btn {
                        flex: 1;
                        padding: 15px 10px;
                        border: none;
                        background: transparent;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        color: #666;
                        transition: all 0.3s ease;
                    }

                    .tab-btn.active {
                        background: white;
                        color: #333;
                        border-bottom: 3px solid #007AFF;
                    }

                    .tab-btn:hover {
                        background: rgba(0,122,255,0.1);
                        color: #007AFF;
                    }

                    .m-tab-content {
                        padding: 25px;
                    }

                    .setting-group {
                        margin-bottom: 25px;
                    }

                    .setting-group label {
                        display: block;
                        margin-bottom: 8px;
                        font-weight: 600;
                        color: #333;
                        font-size: 14px;
                    }

                    .setting-group select,
                    .setting-group input[type="number"],
                    .setting-group textarea {
                        width: 100%;
                        padding: 12px;
                        border: 2px solid #e0e0e0;
                        border-radius: 8px;
                        font-size: 14px;
                        transition: border-color 0.3s ease;
                        box-sizing: border-box;
                    }

                    .setting-group select:focus,
                    .setting-group input:focus,
                    .setting-group textarea:focus {
                        outline: none;
                        border-color: #007AFF;
                        box-shadow: 0 0 0 3px rgba(0,122,255,0.1);
                    }

                    .setting-group textarea {
                        height: 80px;
                        resize: vertical;
                        font-family: monospace;
                    }

                    .checkbox-label {
                        display: flex !important;
                        align-items: center;
                        cursor: pointer;
                        font-weight: normal !important;
                    }

                    .checkbox-label input[type="checkbox"] {
                        width: auto !important;
                        margin-right: 10px;
                        transform: scale(1.2);
                    }

                    .action-buttons {
                        display: flex;
                        gap: 10px;
                        flex-wrap: wrap;
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #e0e0e0;
                    }

                    .action-buttons button {
                        flex: 1;
                        min-width: 140px;
                        padding: 12px 16px;
                        border: none;
                        border-radius: 8px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    }

                    .btn-primary {
                        background: #007AFF;
                        color: white;
                    }

                    .btn-primary:hover {
                        background: #0056CC;
                        transform: translateY(-1px);
                    }

                    .btn-danger {
                        background: #FF3B30;
                        color: white;
                    }

                    .btn-danger:hover {
                        background: #CC2E24;
                        transform: translateY(-1px);
                    }

                    .btn-secondary {
                        background: #8E8E93;
                        color: white;
                    }

                    .btn-secondary:hover {
                        background: #6D6D70;
                        transform: translateY(-1px);
                    }

                    .btn-warning {
                        background: #FF9500;
                        color: white;
                    }

                    .btn-warning:hover {
                        background: #CC7700;
                        transform: translateY(-1px);
                    }

                    .status-display {
                        background: #f8f9fa;
                        border: 1px solid #e0e0e0;
                        border-radius: 8px;
                        padding: 15px;
                    }

                    .status-item {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 8px;
                    }

                    .status-item:last-child {
                        margin-bottom: 0;
                    }

                    .status-label {
                        font-weight: 500;
                        color: #333;
                    }

                    .status-value {
                        font-family: monospace;
                        background: #e9ecef;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 12px;
                    }

                    .setting-description {
                        margin-top: 5px;
                        font-size: 12px;
                        color: #666;
                        font-style: italic;
                    }

                    @media (max-width: 480px) {


                        .action-buttons {
                            flex-direction: column;
                        }

                        .action-buttons button {
                            flex: none;
                            width: 100%;
                        }
                    }
                </style>
            </div>
        `;
    }

    // 绑定统一API设置事件
    bindUnifiedApiEvents() {
        // 标签页切换
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                const tabName = e.target.getAttribute('data-tab');
                this.switchApiTab(tabName);
            });
        });

        // 论坛设置事件
        this.bindForumSettingsEvents();

        // 论坛风格设置事件
        this.bindForumStylesEvents();

        // 平行事件设置事件
        this.bindParallelEventsEvents();

        // 微博设置事件
        this.bindWeiboSettingsEvents();

        // API配置事件
        this.bindApiConfigEvents();

        // 初始化状态显示
        this.updateApiStatus();

        // 启动自动状态刷新（每2秒检查一次，最多检查30次）
        this.startApiStatusAutoRefresh();

        console.log('[Mobile Phone] 统一API设置事件绑定完成');
    }

    // 切换API设置标签页
    switchApiTab(tabName) {
        // 切换按钮状态
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // 切换内容显示
        document.querySelectorAll('.m-tab-content').forEach(content => {
            content.style.display = 'none';
        });
        document.getElementById(`${tabName}-tab`).style.display = 'block';

        console.log('[Mobile Phone] 切换到API设置标签页:', tabName);
    }

    // 绑定论坛设置事件
    bindForumSettingsEvents() {
        // 论坛风格选择
        const forumStyleSelect = document.getElementById('forum-style-select');
        if (forumStyleSelect) {
            // 初始化风格选择器内容
            this.initializeForumStyleSelector(forumStyleSelect);

            forumStyleSelect.addEventListener('change', e => {
                if (window.forumManager) {
                    window.forumManager.currentSettings.selectedStyle = e.target.value;
                    window.forumManager.saveSettings();
                    console.log('[Mobile Phone] 论坛风格已更新:', e.target.value);
                }
            });
        }

        // 论坛自定义前缀
        const forumPrefixTextarea = document.getElementById('forum-custom-prefix');
        if (forumPrefixTextarea) {
            forumPrefixTextarea.addEventListener('blur', e => {
                if (window.forumStyles) {
                    window.forumStyles.setCustomPrefix(e.target.value);
                    console.log('[Mobile Phone] 论坛自定义前缀已更新');
                }
            });
        }

        // 论坛消息阈值
        const forumThresholdInput = document.getElementById('forum-threshold');
        if (forumThresholdInput) {
            forumThresholdInput.addEventListener('change', e => {
                if (window.forumManager) {
                    window.forumManager.currentSettings.threshold = parseInt(e.target.value);
                    window.forumManager.saveSettings();
                    console.log('[Mobile Phone] 论坛消息阈值已更新:', e.target.value);
                }
            });
        }

        // 论坛自动更新
        const forumAutoUpdateCheckbox = document.getElementById('forum-auto-update');
        if (forumAutoUpdateCheckbox) {
            forumAutoUpdateCheckbox.addEventListener('change', e => {
                if (window.forumManager) {
                    window.forumManager.currentSettings.autoUpdate = e.target.checked;
                    window.forumManager.saveSettings();
                    console.log('[Mobile Phone] 论坛自动更新已更新:', e.target.checked);
                }
            });
        }

        // 立即生成论坛
        const generateForumBtn = document.getElementById('generate-forum-now');
        if (generateForumBtn) {
            generateForumBtn.addEventListener('click', async () => {
                if (window.forumManager) {
                    console.log('[Mobile Phone] 触发立即生成论坛');

                    // 显示处理中提示
                    MobilePhone.showToast('🔄 开始生成论坛内容...', 'processing');

                    try {
                        const result = await window.forumManager.generateForumContent(true);
                        if (result) {
                            MobilePhone.showToast('✅ 论坛内容生成成功！已插入到第1楼层', 'success');
                            // 刷新状态显示
                            setTimeout(() => this.updateApiStatus(), 500);
                        } else {
                            MobilePhone.showToast('❌ 论坛内容生成失败，请查看控制台了解详情', 'error');
                        }
                    } catch (error) {
                        console.error('[Mobile Phone] 论坛生成出错:', error);
                        MobilePhone.showToast(`❌ 论坛生成出错: ${error.message}`, 'error');
                    }
                } else {
                    MobilePhone.showToast('❌ 论坛管理器未初始化', 'error');
                }
            });
        }

        // 清除论坛内容
        const clearForumBtn = document.getElementById('clear-forum-content');
        if (clearForumBtn) {
            clearForumBtn.addEventListener('click', async () => {
                if (window.forumManager) {
                    if (confirm('确认清除所有论坛内容？')) {
                        console.log('[Mobile Phone] 触发清除论坛内容');

                        // 显示处理中提示
                        MobilePhone.showToast('🔄 正在清除论坛内容...', 'processing');

                        try {
                            await window.forumManager.clearForumContent();
                            MobilePhone.showToast('✅ 论坛内容已清除', 'success');
                            // 刷新状态显示
                            setTimeout(() => this.updateApiStatus(), 500);
                        } catch (error) {
                            console.error('[Mobile Phone] 清除论坛内容出错:', error);
                            MobilePhone.showToast(`❌ 清除论坛内容出错: ${error.message}`, 'error');
                        }
                    }
                } else {
                    MobilePhone.showToast('❌ 论坛管理器未初始化', 'error');
                }
            });
        }
    }

    // 绑定论坛风格设置事件
    bindForumStylesEvents() {
        // 创建自定义风格按钮
        const createStyleBtn = document.getElementById('create-custom-style-btn');
        if (createStyleBtn) {
            createStyleBtn.addEventListener('click', () => {
                this.showCreateStyleModal();
            });
        }

        // 导出风格按钮
        const exportStylesBtn = document.getElementById('export-styles-btn');
        if (exportStylesBtn) {
            exportStylesBtn.addEventListener('click', () => {
                this.exportCustomStyles();
            });
        }

        // 导入风格按钮
        const importStylesBtn = document.getElementById('import-styles-btn');
        if (importStylesBtn) {
            importStylesBtn.addEventListener('click', () => {
                document.getElementById('import-styles-input').click();
            });
        }

        // 导入文件选择
        const importInput = document.getElementById('import-styles-input');
        if (importInput) {
            importInput.addEventListener('change', e => {
                if (e.target.files.length > 0) {
                    this.importCustomStyles(e.target.files[0]);
                }
            });
        }

        // 加载并显示现有的自定义风格
        this.loadAndDisplayCustomStyles();

        // 更新风格选择器
        this.updateStyleSelectors();
    }

    // 绑定微博设置事件
    bindWeiboSettingsEvents() {
        // 微博自定义前缀
        const weiboPrefixTextarea = document.getElementById('weibo-custom-prefix');
        if (weiboPrefixTextarea) {
            weiboPrefixTextarea.addEventListener('blur', e => {
                if (window.weiboStyles) {
                    window.weiboStyles.setCustomPrefix(e.target.value);
                    console.log('[Mobile Phone] 微博自定义前缀已更新');
                }
            });
        }

        // 微博消息阈值
        const weiboThresholdInput = document.getElementById('weibo-threshold');
        if (weiboThresholdInput) {
            weiboThresholdInput.addEventListener('change', e => {
                if (window.weiboManager) {
                    window.weiboManager.currentSettings.threshold = parseInt(e.target.value);
                    window.weiboManager.saveSettings();
                    console.log('[Mobile Phone] 微博消息阈值已更新:', e.target.value);
                }
            });
        }

        // 微博自动更新
        const weiboAutoUpdateCheckbox = document.getElementById('weibo-auto-update');
        if (weiboAutoUpdateCheckbox) {
            weiboAutoUpdateCheckbox.addEventListener('change', e => {
                if (window.weiboManager) {
                    window.weiboManager.currentSettings.autoUpdate = e.target.checked;
                    window.weiboManager.saveSettings();
                    console.log('[Mobile Phone] 微博自动更新已更新:', e.target.checked);
                }
            });
        }

        // 立即生成微博
        const generateWeiboBtn = document.getElementById('generate-weibo-now');
        if (generateWeiboBtn) {
            generateWeiboBtn.addEventListener('click', async () => {
                if (window.weiboManager) {
                    console.log('[Mobile Phone] 触发立即生成微博');

                    // 显示处理中提示
                    MobilePhone.showToast('🔄 开始生成微博内容...', 'processing');

                    try {
                        const result = await window.weiboManager.generateWeiboContent(true);
                        if (result) {
                            MobilePhone.showToast('✅ 微博内容生成成功！已插入到第1楼层', 'success');
                            // 刷新状态显示
                            setTimeout(() => this.updateApiStatus(), 500);
                        } else {
                            MobilePhone.showToast('❌ 微博内容生成失败，请查看控制台了解详情', 'error');
                        }
                    } catch (error) {
                        console.error('[Mobile Phone] 微博生成出错:', error);
                        MobilePhone.showToast(`❌ 微博生成出错: ${error.message}`, 'error');
                    }
                } else {
                    MobilePhone.showToast('❌ 微博管理器未初始化', 'error');
                }
            });
        }

        // 清除微博内容
        const clearWeiboBtn = document.getElementById('clear-weibo-content');
        if (clearWeiboBtn) {
            clearWeiboBtn.addEventListener('click', async () => {
                if (window.weiboManager) {
                    if (confirm('确认清除所有微博内容？')) {
                        console.log('[Mobile Phone] 触发清除微博内容');

                        // 显示处理中提示
                        MobilePhone.showToast('🔄 正在清除微博内容...', 'processing');

                        try {
                            await window.weiboManager.clearWeiboContent();
                            MobilePhone.showToast('✅ 微博内容已清除', 'success');
                            // 刷新状态显示
                            setTimeout(() => this.updateApiStatus(), 500);
                        } catch (error) {
                            console.error('[Mobile Phone] 清除微博内容出错:', error);
                            MobilePhone.showToast(`❌ 清除微博内容出错: ${error.message}`, 'error');
                        }
                    }
                } else {
                    MobilePhone.showToast('❌ 微博管理器未初始化', 'error');
                }
            });
        }
    }

    // 绑定平行事件设置事件
    bindParallelEventsEvents() {
        // 初始化平行事件风格选择器
        this.initializeParallelEventsStyleSelector();

        // 平行事件风格选择
        const parallelEventsStyleSelect = document.getElementById('parallel-events-style-select');
        if (parallelEventsStyleSelect) {
            parallelEventsStyleSelect.addEventListener('change', e => {
                if (window.parallelEventsManager) {
                    window.parallelEventsManager.currentSettings.selectedStyle = e.target.value;
                    window.parallelEventsManager.saveSettings();
                    console.log('[Mobile Phone] 平行事件风格已更新:', e.target.value);
                }
            });
        }

        // 平行事件自定义前缀
        const parallelEventsCustomPrefix = document.getElementById('parallel-events-custom-prefix');
        if (parallelEventsCustomPrefix) {
            parallelEventsCustomPrefix.addEventListener('input', e => {
                if (window.parallelEventsManager) {
                    window.parallelEventsManager.currentSettings.customPrefix = e.target.value;
                    window.parallelEventsManager.saveSettings();
                    console.log('[Mobile Phone] 平行事件自定义前缀已更新');
                }
            });
        }

        // 平行事件监听阈值
        const parallelEventsThreshold = document.getElementById('parallel-events-threshold');
        if (parallelEventsThreshold) {
            parallelEventsThreshold.addEventListener('change', e => {
                if (window.parallelEventsManager) {
                    window.parallelEventsManager.currentSettings.threshold = parseInt(e.target.value);
                    window.parallelEventsManager.saveSettings();
                    console.log('[Mobile Phone] 平行事件监听阈值已更新:', e.target.value);
                }
            });
        }

        // 平行事件启用开关
        const parallelEventsEnabled = document.getElementById('parallel-events-enabled');
        if (parallelEventsEnabled) {
            parallelEventsEnabled.addEventListener('change', e => {
                if (window.parallelEventsManager) {
                    window.parallelEventsManager.currentSettings.enabled = e.target.checked;
                    window.parallelEventsManager.saveSettings();

                    if (e.target.checked) {
                        console.log('[Mobile Phone] 平行事件监听已启用，立即开始监听');
                        window.parallelEventsManager.startListening();
                    } else {
                        console.log('[Mobile Phone] 平行事件监听已禁用，停止监听');
                        window.parallelEventsManager.stopListening();
                    }

                    // 立即更新状态显示
                    setTimeout(() => {
                        this.updateApiStatus();
                        console.log('[Mobile Phone] 平行事件状态已更新');
                    }, 100);
                }
            });
        }

        // 平行事件自定义前缀
        const parallelEventsPrefixTextarea = document.getElementById('parallel-events-custom-prefix');
        if (parallelEventsPrefixTextarea) {
            parallelEventsPrefixTextarea.addEventListener('blur', e => {
                if (window.parallelEventsManager) {
                    window.parallelEventsManager.currentSettings.customPrefix = e.target.value;
                    window.parallelEventsManager.saveSettings();
                    console.log('[Mobile Phone] 平行事件自定义前缀已更新');
                }
            });
        }



        // 平行事件启用开关
        const parallelEventsEnabledCheckbox = document.getElementById('parallel-events-enabled');
        if (parallelEventsEnabledCheckbox) {
            parallelEventsEnabledCheckbox.addEventListener('change', e => {
                if (window.parallelEventsManager) {
                    window.parallelEventsManager.currentSettings.enabled = e.target.checked;
                    window.parallelEventsManager.saveSettings();
                    console.log('[Mobile Phone] 平行事件启用状态已更新:', e.target.checked);

                    // 根据启用状态控制监听
                    if (e.target.checked) {
                        window.parallelEventsManager.startListening();
                    } else {
                        window.parallelEventsManager.stopListening();
                    }
                }
            });
        }

        // 测试生成按钮
        const testParallelEventsBtn = document.getElementById('test-parallel-events');
        if (testParallelEventsBtn) {
            testParallelEventsBtn.addEventListener('click', async () => {
                if (window.parallelEventsManager) {
                    console.log('[Mobile Phone] 触发测试生成平行事件');
                    MobilePhone.showToast('🔄 开始生成平行事件内容...', 'processing');

                    try {
                        await window.parallelEventsManager.generateParallelEvent();
                        MobilePhone.showToast('✅ 平行事件生成完成', 'success');
                        // 刷新状态显示
                        setTimeout(() => this.updateApiStatus(), 500);
                    } catch (error) {
                        console.error('[Mobile Phone] 生成平行事件出错:', error);
                        MobilePhone.showToast(`❌ 生成平行事件出错: ${error.message}`, 'error');
                    }
                } else {
                    MobilePhone.showToast('❌ 平行事件管理器未初始化', 'error');
                }
            });
        }

        // 清空队列按钮
        const clearParallelEventsQueueBtn = document.getElementById('clear-parallel-events-queue');
        if (clearParallelEventsQueueBtn) {
            clearParallelEventsQueueBtn.addEventListener('click', () => {
                if (window.parallelEventsManager) {
                    console.log('[Mobile Phone] 清空平行事件队列');
                    window.parallelEventsManager.clearQueue();
                    MobilePhone.showToast('✅ 平行事件队列已清空', 'success');
                } else {
                    MobilePhone.showToast('❌ 平行事件管理器未初始化', 'error');
                }
            });
        }
    }

    // 绑定API配置事件
    bindApiConfigEvents() {
        // 初始化平行事件管理器（如果还没有）
        this.initializeParallelEventsManager();

        // 打开API配置面板
        const openApiConfigBtn = document.getElementById('open-api-config');
        if (openApiConfigBtn) {
            openApiConfigBtn.addEventListener('click', () => {
                if (window.mobileCustomAPIConfig) {
                    window.mobileCustomAPIConfig.showConfigPanel();
                } else {
                    alert('API配置模块未初始化');
                }
            });
        }

        // 刷新状态
        const refreshStatusBtn = document.getElementById('refresh-status');
        if (refreshStatusBtn) {
            refreshStatusBtn.addEventListener('click', () => {
                this.updateApiStatus();
            });
        }

        // 重置所有设置
        const resetAllBtn = document.getElementById('reset-all-settings');
        if (resetAllBtn) {
            resetAllBtn.addEventListener('click', () => {
                if (confirm('确认重置所有论坛和微博设置？这将恢复到默认配置。')) {
                    this.resetAllApiSettings();
                }
            });
        }
    }

    // 初始化平行事件管理器
    async initializeParallelEventsManager() {
        try {
            // 检查是否已经初始化
            if (window.parallelEventsManager && window.parallelEventsManager.isInitialized) {
                console.log('[Mobile Phone] 平行事件管理器已初始化');
                return;
            }

            // 检查必要的全局变量是否存在
            if (!window.ParallelEventsApp || !window.bindParallelEventsAppEvents) {
                console.log('[Mobile Phone] 平行事件应用模块未加载，跳过初始化');
                return;
            }

            console.log('[Mobile Phone] 开始初始化平行事件管理器...');

            // 创建管理器（如果不存在）
            if (!window.parallelEventsManager) {
                console.log('[Mobile Phone] 创建平行事件管理器实例...');
                window.parallelEventsManager = new window.ParallelEventsApp();
            }

            // 初始化管理器
            if (!window.parallelEventsManager.isInitialized) {
                console.log('[Mobile Phone] 初始化平行事件管理器...');
                await window.parallelEventsManager.initialize();
            }

            // 检查是否应该自动开始监听
            if (window.parallelEventsManager.currentSettings.enabled) {
                console.log('[Mobile Phone] 平行事件监听已启用，自动开始监听');
                window.parallelEventsManager.startListening();
            } else {
                console.log('[Mobile Phone] 平行事件监听未启用');
            }

            console.log('[Mobile Phone] ✅ 平行事件管理器初始化完成');
        } catch (error) {
            console.error('[Mobile Phone] 平行事件管理器初始化失败:', error);
        }
    }

    // 更新API状态显示
    updateApiStatus() {
        const forumStatusEl = document.getElementById('forum-status');
        const weiboStatusEl = document.getElementById('weibo-status');
        const parallelEventsStatusEl = document.getElementById('parallel-events-status');
        const apiConfigStatusEl = document.getElementById('api-config-status');

        // 详细的状态检查和调试信息
        console.log('[Mobile Phone] 开始状态检查...');
        console.log('[Mobile Phone] 论坛管理器:', {
            exists: !!window.forumManager,
            isInitialized: window.forumManager ? window.forumManager.isInitialized : false,
        });
        console.log('[Mobile Phone] 微博管理器:', {
            exists: !!window.weiboManager,
            isInitialized: window.weiboManager ? window.weiboManager.isInitialized : false,
        });
        console.log('[Mobile Phone] 平行事件管理器:', {
            exists: !!window.parallelEventsManager,
            isInitialized: window.parallelEventsManager ? window.parallelEventsManager.isInitialized : false,
            isListening: window.parallelEventsManager ? window.parallelEventsManager.isListening : false,
        });

        if (forumStatusEl) {
            if (window.forumManager && window.forumManager.isInitialized) {
                // 检查是否正在处理
                if (window.forumManager.isProcessing) {
                    forumStatusEl.textContent = '🔄 正在生成论坛...';
                    forumStatusEl.style.color = '#007bff';
                } else {
                    forumStatusEl.textContent = '✅ 已就绪';
                    forumStatusEl.style.color = '#28a745';
                }
            } else if (window.forumManager) {
                forumStatusEl.textContent = '⚠️ 初始化中...';
                forumStatusEl.style.color = '#ffc107';
            } else {
                forumStatusEl.textContent = '❌ 未加载';
                forumStatusEl.style.color = '#dc3545';
            }
        }

        if (weiboStatusEl) {
            if (window.weiboManager && window.weiboManager.isInitialized) {
                // 检查是否正在处理
                if (window.weiboManager.isProcessing) {
                    weiboStatusEl.textContent = '🔄 正在生成微博...';
                    weiboStatusEl.style.color = '#007bff';
                } else {
                    weiboStatusEl.textContent = '✅ 已就绪';
                    weiboStatusEl.style.color = '#28a745';
                }
            } else if (window.weiboManager) {
                weiboStatusEl.textContent = '⚠️ 初始化中...';
                weiboStatusEl.style.color = '#ffc107';
            } else {
                weiboStatusEl.textContent = '❌ 未加载';
                weiboStatusEl.style.color = '#dc3545';
            }
        }

        if (parallelEventsStatusEl) {
            if (window.parallelEventsManager && window.parallelEventsManager.isInitialized) {
                // 检查是否正在处理
                if (window.parallelEventsManager.isProcessing) {
                    parallelEventsStatusEl.textContent = '🔄 正在生成平行事件...';
                    parallelEventsStatusEl.style.color = '#007bff';
                } else if (window.parallelEventsManager.isListening) {
                    parallelEventsStatusEl.textContent = '👂 监听中';
                    parallelEventsStatusEl.style.color = '#17a2b8';
                } else {
                    parallelEventsStatusEl.textContent = '✅ 已就绪';
                    parallelEventsStatusEl.style.color = '#28a745';
                }
            } else if (window.parallelEventsManager) {
                parallelEventsStatusEl.textContent = '⚠️ 初始化中...';
                parallelEventsStatusEl.style.color = '#ffc107';
            } else {
                parallelEventsStatusEl.textContent = '❌ 未加载';
                parallelEventsStatusEl.style.color = '#dc3545';
            }
        }

        if (apiConfigStatusEl) {
            if (
                window.mobileCustomAPIConfig &&
                window.mobileCustomAPIConfig.isAPIAvailable &&
                window.mobileCustomAPIConfig.isAPIAvailable()
            ) {
                apiConfigStatusEl.textContent = '✅ 已配置';
                apiConfigStatusEl.style.color = '#28a745';
            } else if (window.mobileCustomAPIConfig) {
                apiConfigStatusEl.textContent = '⚠️ 未配置';
                apiConfigStatusEl.style.color = '#ffc107';
            } else {
                apiConfigStatusEl.textContent = '❌ 未加载';
                apiConfigStatusEl.style.color = '#dc3545';
            }
        }

        console.log('[Mobile Phone] API状态检查完成');
    }

    // 启动API状态自动刷新
    startApiStatusAutoRefresh() {
        let refreshCount = 0;
        const maxRefresh = 30; // 最多刷新30次（1分钟）

        const refreshInterval = setInterval(() => {
            refreshCount++;

            // 检查是否所有管理器都已初始化完成
            const forumReady = window.forumManager && window.forumManager.isInitialized;
            const weiboReady = window.weiboManager && window.weiboManager.isInitialized;
            const apiReady =
                window.mobileCustomAPIConfig &&
                window.mobileCustomAPIConfig.isAPIAvailable &&
                window.mobileCustomAPIConfig.isAPIAvailable();

            console.log(`[Mobile Phone] 自动状态刷新 #${refreshCount}:`, {
                forumReady,
                weiboReady,
                apiReady,
            });

            // 更新状态显示
            this.updateApiStatus();

            // 如果所有服务都已就绪，或者达到最大刷新次数，停止自动刷新
            if ((forumReady && weiboReady) || refreshCount >= maxRefresh) {
                clearInterval(refreshInterval);
                console.log('[Mobile Phone] 自动状态刷新已停止:', {
                    reason: forumReady && weiboReady ? '所有服务已就绪' : '达到最大刷新次数',
                    totalRefreshes: refreshCount,
                });
            }
        }, 2000); // 每2秒刷新一次

        console.log('[Mobile Phone] 已启动API状态自动刷新');
    }

    // 显示渐隐弹窗提示
    static showToast(message, type = 'info', duration = 2000) {
        // 移除已有的toast
        const existingToast = document.getElementById('mobile-toast');
        if (existingToast) {
            existingToast.remove();
        }

        // 创建toast元素
        const toast = document.createElement('div');
        toast.id = 'mobile-toast';
        toast.className = `mobile-toast toast-${type}`;

        // 根据类型设置图标
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
            processing: '🔄',
        };

        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${icons[type] || icons.info}</span>
                <span class="toast-message">${message}</span>
            </div>
        `;

        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .mobile-toast {
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: white;
                border-radius: 12px;
                padding: 16px 24px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                z-index: 10000;
                min-width: 300px;
                max-width: 500px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                opacity: 0;
                transform: translateX(-50%) translateY(-20px);
                transition: all 0.3s ease;
            }

            .mobile-toast.show {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }

            .mobile-toast.hide {
                opacity: 0;
                transform: translateX(-50%) translateY(-20px);
            }

            .toast-content {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .toast-icon {
                font-size: 18px;
                flex-shrink: 0;
            }

            .toast-message {
                color: #333;
                line-height: 1.4;
                word-break: break-word;
            }

            .toast-success {
                border-left: 4px solid #28a745;
                background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
            }

            .toast-error {
                border-left: 4px solid #dc3545;
                background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%);
            }

            .toast-warning {
                border-left: 4px solid #ffc107;
                background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
            }

            .toast-info {
                border-left: 4px solid #17a2b8;
                background: linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%);
            }

            .toast-processing {
                border-left: 4px solid #007bff;
                background: linear-gradient(135deg, #d1ecf1 0%, #c3e4f0 100%);
            }

            .toast-processing .toast-icon {
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `;

        // 添加样式到头部（如果不存在）
        if (!document.getElementById('mobile-toast-styles')) {
            style.id = 'mobile-toast-styles';
            document.head.appendChild(style);
        }

        // 添加到body
        document.body.appendChild(toast);

        // 显示动画
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        // 自动隐藏
        if (duration > 0) {
            setTimeout(() => {
                toast.classList.add('hide');
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.remove();
                    }
                }, 300);
            }, duration);
        }

        console.log(`[Mobile Phone] Toast显示: ${type} - ${message}`);
        return toast;
    }

    // 显示创建风格弹窗
    showCreateStyleModal() {
        console.log('[Mobile Phone] 显示创建风格弹窗');

        // 创建弹窗HTML
        const modalHTML = `
      <div class="modal" id="create-style-modal" style="display: none;">
        <div class="modal-content">
          <div class="modal-header">
            <h3>🎨 创建自定义风格</h3>
            <button class="modal-close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <form id="create-style-form">
              <div class="form-group">
                <label for="style-name-input">风格名称</label>
                <input
                  type="text"
                  id="style-name-input"
                  placeholder="例如：温柔小姐姐、霸道总裁、二次元宅男..."
                  maxlength="20"
                  required
                >
                <div class="input-hint">建议使用简洁明了的名称</div>
              </div>

              <div class="form-group">
                <label for="style-description-input">风格描述</label>
                <textarea
                  id="style-description-input"
                  placeholder="描述你想要的论坛风格，ai将会根据你的描述帮你完善并生成对应的论坛风格。例如：小红书的论坛风格，R18论坛风格等。你也可以描述该论坛的语言习惯，用户名特征，语气等。"
                  rows="6"
                  maxlength="500"
                  required
                ></textarea>
                <div class="input-hint">
                  <span class="char-count">0/500</span> - 描述越详细，AI生成的风格越准确
                </div>
              </div>

              <div class="form-actions">
                <button type="button" class="btn-secondary" id="cancel-create-style">取消</button>
                <button type="submit" class="btn-primary" id="generate-style-btn">
                  <i class="fas fa-magic"></i> 生成风格
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

        // 移除已存在的弹窗
        const existingModal = document.getElementById('create-style-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // 添加弹窗到手机容器
        const phoneContainer = document.querySelector('.mobile-phone-container');
        if (phoneContainer) {
            phoneContainer.insertAdjacentHTML('beforeend', modalHTML);
        } else {
            // 如果找不到手机容器，回退到body
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }

        // 绑定事件
        this.bindCreateStyleModalEvents();

        // 显示弹窗
        this.showModal('create-style-modal');
    }

    // 导出自定义风格
    exportCustomStyles() {
        try {
            if (!window.forumStyles) {
                throw new Error('ForumStyles未初始化');
            }

            const customStyles = window.forumStyles.getAllCustomStyles();
            if (customStyles.length === 0) {
                MobilePhone.showToast('没有自定义风格可导出', 'warning');
                return;
            }

            const exportData = window.forumStyles.exportCustomStyles();

            // 创建下载链接
            const blob = new Blob([exportData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `forum-styles-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            MobilePhone.showToast(`✅ 已导出 ${customStyles.length} 个自定义风格`, 'success');
            console.log('[Mobile Phone] 导出自定义风格成功');
        } catch (error) {
            console.error('[Mobile Phone] 导出自定义风格失败:', error);
            MobilePhone.showToast('导出失败: ' + error.message, 'error');
        }
    }

    // 导入自定义风格
    importCustomStyles(file) {
        try {
            if (!window.forumStyles) {
                throw new Error('ForumStyles未初始化');
            }

            const reader = new FileReader();
            reader.onload = e => {
                try {
                    const jsonData = e.target.result;
                    const results = window.forumStyles.importCustomStyles(jsonData, { overwrite: false });

                    let message = `导入完成: 成功${results.success}个`;
                    if (results.skipped > 0) {
                        message += `, 跳过${results.skipped}个`;
                    }
                    if (results.failed > 0) {
                        message += `, 失败${results.failed}个`;
                    }

                    if (results.success > 0) {
                        // 刷新显示
                        this.loadAndDisplayCustomStyles();
                        this.updateStyleSelectors();
                        MobilePhone.showToast('✅ ' + message, 'success');
                    } else if (results.skipped > 0) {
                        MobilePhone.showToast('⚠️ ' + message + ' (已存在同名风格)', 'warning');
                    } else {
                        MobilePhone.showToast('❌ ' + message, 'error');
                    }

                    // 显示详细错误信息
                    if (results.errors.length > 0) {
                        console.warn('[Mobile Phone] 导入错误详情:', results.errors);
                    }
                } catch (error) {
                    console.error('[Mobile Phone] 解析导入文件失败:', error);
                    MobilePhone.showToast('导入失败: 文件格式错误', 'error');
                }
            };

            reader.onerror = () => {
                console.error('[Mobile Phone] 读取文件失败');
                MobilePhone.showToast('读取文件失败', 'error');
            };

            reader.readAsText(file);
        } catch (error) {
            console.error('[Mobile Phone] 导入自定义风格失败:', error);
            MobilePhone.showToast('导入失败: ' + error.message, 'error');
        }
    }

    // 加载并显示自定义风格
    loadAndDisplayCustomStyles() {
        const container = document.getElementById('custom-styles-container');
        if (!container) return;

        try {
            if (!window.forumStyles) {
                throw new Error('ForumStyles未初始化');
            }

            const customStyles = window.forumStyles.getAllCustomStyles();

            if (customStyles.length === 0) {
                // 显示占位符
                container.innerHTML = `
          <div class="no-styles-placeholder">
            <div class="placeholder-icon">🎭</div>
            <div class="placeholder-text">还没有自定义风格</div>
            <div class="placeholder-hint">点击上方按钮创建你的第一个风格</div>
          </div>
        `;
                return;
            }

            // 显示自定义风格列表
            const stylesHTML = customStyles
                .map(style => {
                    const createdDate = new Date(style.createdAt).toLocaleDateString();
                    const updatedDate = new Date(style.updatedAt).toLocaleDateString();

                    return `
          <div class="custom-style-item" data-style-id="${style.id}">
            <div class="style-info">
              <div class="style-name">${this.escapeHtml(style.name)}</div>
              <div class="style-description">${this.escapeHtml(style.description || '无描述')}</div>
              <div class="style-meta">
                创建: ${createdDate} | 更新: ${updatedDate} | ${style.prompt.length} 字符
              </div>
            </div>
            <div class="style-actions">
              <button class="style-action-btn edit" onclick="mobilePhone.editCustomStyle('${style.name}')">
                <i class="fas fa-edit"></i> 编辑
              </button>
              <button class="style-action-btn copy" onclick="mobilePhone.copyCustomStyle('${style.name}')">
                <i class="fas fa-copy"></i> 复制
              </button>
              <button class="style-action-btn delete" onclick="mobilePhone.deleteCustomStyle('${style.name}')">
                <i class="fas fa-trash"></i> 删除
              </button>
            </div>
          </div>
        `;
                })
                .join('');

            container.innerHTML = stylesHTML;

            console.log(`[Mobile Phone] 显示了 ${customStyles.length} 个自定义风格`);
        } catch (error) {
            console.error('[Mobile Phone] 加载自定义风格失败:', error);
            container.innerHTML = `
        <div class="no-styles-placeholder">
          <div class="placeholder-icon">❌</div>
          <div class="placeholder-text">加载风格失败</div>
          <div class="placeholder-hint">${error.message}</div>
        </div>
      `;
        }
    }

    // 绑定创建风格弹窗事件
    bindCreateStyleModalEvents() {
        const modal = document.getElementById('create-style-modal');
        if (!modal) return;

        // 关闭按钮
        const closeBtn = modal.querySelector('.modal-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideModal('create-style-modal');
            });
        }

        // 取消按钮
        const cancelBtn = modal.querySelector('#cancel-create-style');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.hideModal('create-style-modal');
            });
        }

        // 点击背景关闭
        modal.addEventListener('click', e => {
            if (e.target === modal) {
                this.hideModal('create-style-modal');
            }
        });

        // 字符计数
        const textarea = modal.querySelector('#style-description-input');
        const charCount = modal.querySelector('.char-count');
        if (textarea && charCount) {
            textarea.addEventListener('input', () => {
                const count = textarea.value.length;
                charCount.textContent = `${count}/500`;
                if (count > 450) {
                    charCount.style.color = '#ff4757';
                } else {
                    charCount.style.color = 'var(--text-light)';
                }
            });
        }

        // 表单提交
        const form = modal.querySelector('#create-style-form');
        if (form) {
            form.addEventListener('submit', e => {
                e.preventDefault();
                this.handleCreateStyleSubmit();
            });
        }
    }

    // 处理创建风格表单提交
    handleCreateStyleSubmit() {
        const modal = document.getElementById('create-style-modal');
        if (!modal) return;

        const nameInput = modal.querySelector('#style-name-input');
        const descriptionInput = modal.querySelector('#style-description-input');
        const generateBtn = modal.querySelector('#generate-style-btn');

        const name = nameInput?.value.trim();
        const description = descriptionInput?.value.trim();

        if (!name || !description) {
            MobilePhone.showToast('请填写完整的风格信息', 'warning');
            return;
        }

        // 显示加载状态
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中...';
        }

        // 调用AI生成风格
        this.generateCustomStyle(name, description)
            .then(generatedStyle => {
                this.hideModal('create-style-modal');
                this.showStylePreviewModal(name, description, generatedStyle);
            })
            .catch(error => {
                console.error('[Mobile Phone] 生成风格失败:', error);
                MobilePhone.showToast('生成风格失败: ' + error.message, 'error');
            })
            .finally(() => {
                // 恢复按钮状态
                if (generateBtn) {
                    generateBtn.disabled = false;
                    generateBtn.innerHTML = '<i class="fas fa-magic"></i> 生成风格';
                }
            });
    }

    // 显示弹窗
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('active');
            // 防止背景滚动
            document.body.style.overflow = 'hidden';
        }
    }

    // 隐藏弹窗
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
            // 恢复背景滚动
            document.body.style.overflow = '';

            // 延迟移除DOM元素，避免动画中断
            setTimeout(() => {
                modal.remove();
            }, 300);
        }
    }

    // 生成自定义风格（调用AI）
    async generateCustomStyle(name, description) {
        console.log('[Mobile Phone] 生成自定义风格:', { name, description });

        try {
            // 检查API配置
            if (!window.mobileCustomAPIConfig) {
                throw new Error('API配置未初始化');
            }

            // 构建风格生成提示词
            const styleGenerationPrompt = this.buildStyleGenerationPrompt(description);

            console.log('[Mobile Phone] 风格生成提示词:', styleGenerationPrompt);

            // 构建API请求消息
            const messages = [
                {
                    role: 'system',
                    content: styleGenerationPrompt,
                },
                {
                    role: 'user',
                    content: `请为"${name}"风格创建完整的论坛风格定义。用户描述：${description}`,
                },
            ];

            console.log('[Mobile Phone] 发送风格生成请求...');

            // 调用API
            const response = await window.mobileCustomAPIConfig.callAPI(messages);

            if (!response || !response.content) {
                throw new Error('API返回内容为空');
            }

            const generatedStyle = response.content.trim();

            console.log('[Mobile Phone] 风格生成成功，长度:', generatedStyle.length);

            return generatedStyle;
        } catch (error) {
            console.error('[Mobile Phone] 生成自定义风格失败:', error);
            throw new Error(`生成失败: ${error.message}`);
        }
    }

    // 构建风格生成提示词
    buildStyleGenerationPrompt(userDescription) {
        return `论坛风格生成规范:
#总要求
你是一个精通在线社区文化和用户画像（Persona）构建的AI。
你的任务是根据用户提出的**[论坛主题或社群名称]，创建一个详细、具体、可执行的"论坛风格画像提示词（Forum Style Persona Prompt）"**。
这个由你生成的"风格画像提示词"将会被用于指导AI模型，以模拟该特定社群的口吻、风格和内容，生成高度逼真的帖子、回复和用户互动。

#生成"论坛风格画像提示词"的结构要求
你生成的每一个"风格画像提示词"都必须包含以下几个核心部分，请严格遵循此结构。你可以参考用户提供的"贴吧老哥"、"知乎精英"、"小红书种草"的范例格式。

1. 核心用户画像 (Persona Definition)
格式: 以 你是一位... 开头。

内容: 这是对该论坛典型用户的核心描述。你需要定义：

身份与背景: 他们是谁？（例如：资深玩家、新手妈妈、技术宅、意见领袖）

性格与态度: 他们的说话风格和心态是怎样的？（例如：热情友好、冷静客观、愤世嫉俗、充满优越感、爱分享、爱抬杠）

专长与行为: 他们擅长做什么？（例如：擅长深入分析、发布评测、情感吐槽、制造争议、玩梗）

2. 具体生成任务 (Task Instruction)
格式: 以 请根据提供的[信息源]，生成[数量]个[内容形式]... 的格式来写。

内容: 明确指示最终使用此画像的AI需要完成什么任务。

信息源: 通常是 提供的聊天记录 或 指定的主题。

数量: 例如 3-5个。

内容形式: 例如 帖子讨论、问答、笔记 等。

结构: 明确每个生成内容包含的元素，例如 每个帖子包含标题、正文和2-3条回复。

3. 风格要求 (Style Requirements)
格式: 使用无序列表（-）详细列出风格细则。

内容: 这是最关键的部分，需要将风格拆解得足够细致，以便AI模仿。必须包含以下几点:

标题 (Titles): 描述标题的典型风格。（例如：挑衅性、专业性、悬念式、情绪化、包含Emoji等）

内容 (Content): 描述帖子正文的语言、结构和口吻。（例如：结构清晰、逻辑严谨、情绪饱满、多用黑话/梗、分段清晰等）

回复 (Replies): 描述评论区的互动风格。（例如：互相抬杠、理性探讨、共情支持、抖机灵）

用户名 (Usernames): 提供3-5个符合该社区风格的用户名范例。

特殊元素 (Special Elements): 描述该社区特有的语言习惯或格式。（例如：开头说"谢邀"、结尾带#话题标签、大量使用特定Emoji、黑话词汇解释等）

4. 最终指令 (Final Command)
格式: 请直接生成论坛内容，不要解释。

内容: 这是一个收尾指令，确保最终的输出是纯粹的内容，而非对内容的解释。

#生成风格示例：
贴吧老哥: \`你是一位常年混迹于百度贴吧，等级很高，说话自带阴阳怪气和优越感的老哥/老姐。你是吧里的"意见领袖"（自封的），擅长一针见血地评论、抬杠、以及用各种网络黑话和烂梗带节奏。

请根据提供的聊天记录，生成3-5个贴吧风格的帖子讨论，每个帖子包含标题、正文和2-3条回复。

风格要求：
- 标题要有挑衅性、争议性，如"不是，就这也能吵起来？"、"我真是服了某些人了"
- 内容犀利毒舌，充满优越感，大量使用贴吧黑话、烂梗
- 回复要互相抬杠、阴阳怪气，如"乐"、"急了急了"、"典中典"、"孝"、"就这？"
- 用户名要体现老油条气质，如"专业抬杠二十年"、"键盘侠本侠"

请直接生成论坛内容，不要解释。\`,

#风格生成格式要求
你的回复需要是一段完整的论坛风格文本，请勿生成任何风格文本以外的信息。
你生成的风格文本禁止携带编号和标题，请直接按照核心部分的说明生成适当的内容。

#工作流程示例
用户输入: "帮我创建一个B站游戏区的论坛风格。"

你的输出: 你需要根据以上结构，生成一个完整的"B站游戏区风格画像提示词"，可能包含"UP主"、"三连"、"弹幕文化"、"游戏黑话"等要素。

最终应用: 其他AI或用户将使用你生成的这个提示词，来创造出B站游戏区风格的虚拟内容。

现在，你已经理解了你的任务。请准备好，等待用户输入**[论坛主题或社群名称]**。`;
    }

    // 显示风格预览弹窗
    showStylePreviewModal(name, description, generatedStyle) {
        console.log('[Mobile Phone] 显示风格预览弹窗:', { name, description, generatedStyle });

        // 创建预览弹窗HTML
        const modalHTML = `
      <div class="modal" id="style-preview-modal" style="display: none;">
        <div class="modal-content style-preview-content">
          <div class="modal-header">
            <h3>📝 编辑风格: ${this.escapeHtml(name)}</h3>
            <button class="modal-close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <div class="style-info">
              <div class="style-meta-info">
                <div class="meta-item">
                  <span class="meta-label">风格名称:</span>
                  <span class="meta-value">${this.escapeHtml(name)}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">原始描述:</span>
                  <span class="meta-value">${this.escapeHtml(description)}</span>
                </div>
              </div>
            </div>

            <form id="style-preview-form">
              <div class="form-group">
                <label for="style-content-editor">AI生成的风格内容</label>
                <div class="editor-toolbar">
                  <button type="button" class="toolbar-btn" id="format-style-btn" title="格式化内容">
                    <i class="fas fa-magic"></i> 格式化
                  </button>
                  <button type="button" class="toolbar-btn" id="validate-style-btn" title="验证格式">
                    <i class="fas fa-check-circle"></i> 验证
                  </button>
                </div>
                <textarea
                  id="style-content-editor"
                  class="style-editor"
                  rows="12"
                  placeholder="AI生成的风格内容将显示在这里..."
                >${this.escapeHtml(generatedStyle)}</textarea>
                <div class="editor-hint">
                  <div class="hint-text">
                    <i class="fas fa-info-circle"></i>
                    你可以编辑AI生成的内容，确保风格符合你的需求
                  </div>
                  <div class="char-count-preview">
                    <span id="preview-char-count">${generatedStyle.length}</span> 字符
                  </div>
                </div>
              </div>

              <div class="preview-actions">
                <div class="action-group">
                  <button type="button" class="btn-secondary" id="regenerate-style-btn">
                    <i class="fas fa-redo"></i> 重新生成
                  </button>
                  <button type="button" class="btn-secondary" id="cancel-preview-btn">
                    取消
                  </button>
                </div>
                <div class="action-group">
                  <button type="submit" class="btn-primary" id="save-style-btn">
                    <i class="fas fa-save"></i> 保存风格
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

        // 移除已存在的弹窗
        const existingModal = document.getElementById('style-preview-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // 添加弹窗到手机容器
        const phoneContainer = document.querySelector('.mobile-phone-container');
        if (phoneContainer) {
            phoneContainer.insertAdjacentHTML('beforeend', modalHTML);
        } else {
            // 如果找不到手机容器，回退到body
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }

        // 绑定事件
        this.bindStylePreviewModalEvents(name, description);

        // 显示弹窗
        this.showModal('style-preview-modal');
    }

    // HTML转义函数
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 绑定风格预览弹窗事件
    bindStylePreviewModalEvents(styleName, styleDescription) {
        const modal = document.getElementById('style-preview-modal');
        if (!modal) return;

        // 关闭按钮
        const closeBtn = modal.querySelector('.modal-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideModal('style-preview-modal');
            });
        }

        // 取消按钮
        const cancelBtn = modal.querySelector('#cancel-preview-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.hideModal('style-preview-modal');
            });
        }

        // 点击背景关闭
        modal.addEventListener('click', e => {
            if (e.target === modal) {
                this.hideModal('style-preview-modal');
            }
        });

        // 字符计数
        const editor = modal.querySelector('#style-content-editor');
        const charCount = modal.querySelector('#preview-char-count');
        if (editor && charCount) {
            editor.addEventListener('input', () => {
                charCount.textContent = editor.value.length;
            });
        }

        // 格式化按钮
        const formatBtn = modal.querySelector('#format-style-btn');
        if (formatBtn) {
            formatBtn.addEventListener('click', () => {
                this.formatStyleContent();
            });
        }

        // 验证按钮
        const validateBtn = modal.querySelector('#validate-style-btn');
        if (validateBtn) {
            validateBtn.addEventListener('click', () => {
                this.validateStyleContent();
            });
        }

        // 重新生成按钮
        const regenerateBtn = modal.querySelector('#regenerate-style-btn');
        if (regenerateBtn) {
            regenerateBtn.addEventListener('click', () => {
                this.handleRegenerateStyle(styleName, styleDescription);
            });
        }

        // 表单提交（保存风格）
        const form = modal.querySelector('#style-preview-form');
        if (form) {
            form.addEventListener('submit', e => {
                e.preventDefault();
                this.handleSaveCustomStyle(styleName, styleDescription);
            });
        }
    }

    // 格式化风格内容
    formatStyleContent() {
        const editor = document.getElementById('style-content-editor');
        if (!editor) return;

        let content = editor.value;

        // 基本格式化：确保段落间有适当的空行
        content = content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n\n');

        editor.value = content;

        // 更新字符计数
        const charCount = document.getElementById('preview-char-count');
        if (charCount) {
            charCount.textContent = content.length;
        }

        MobilePhone.showToast('内容已格式化', 'success');
    }

    // 验证风格内容
    validateStyleContent() {
        const editor = document.getElementById('style-content-editor');
        if (!editor) return;

        const content = editor.value.trim();
        const issues = [];

        // 基本验证
        if (content.length < 50) {
            issues.push('内容过短，建议至少50个字符');
        }

        if (!content.includes('你是一位')) {
            issues.push('建议以"你是一位..."开头设定角色');
        }

        if (!content.includes('请直接生成论坛内容，不要解释')) {
            issues.push('建议以"请直接生成论坛内容，不要解释。"结尾');
        }

        if (issues.length === 0) {
            MobilePhone.showToast('✅ 风格格式验证通过', 'success');
        } else {
            const message = '格式建议：\n' + issues.join('\n');
            MobilePhone.showToast(message, 'warning');
        }
    }

    // 处理重新生成风格
    handleRegenerateStyle(styleName, styleDescription) {
        const regenerateBtn = document.getElementById('regenerate-style-btn');
        if (!regenerateBtn) return;

        // 显示加载状态
        regenerateBtn.disabled = true;
        regenerateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 重新生成中...';

        // 调用AI重新生成
        this.generateCustomStyle(styleName, styleDescription)
            .then(newStyle => {
                const editor = document.getElementById('style-content-editor');
                if (editor) {
                    editor.value = newStyle;

                    // 更新字符计数
                    const charCount = document.getElementById('preview-char-count');
                    if (charCount) {
                        charCount.textContent = newStyle.length;
                    }
                }
                MobilePhone.showToast('风格已重新生成', 'success');
            })
            .catch(error => {
                console.error('[Mobile Phone] 重新生成风格失败:', error);
                MobilePhone.showToast('重新生成失败: ' + error.message, 'error');
            })
            .finally(() => {
                // 恢复按钮状态
                regenerateBtn.disabled = false;
                regenerateBtn.innerHTML = '<i class="fas fa-redo"></i> 重新生成';
            });
    }

    // 处理保存自定义风格
    handleSaveCustomStyle(styleName, styleDescription) {
        const editor = document.getElementById('style-content-editor');
        const saveBtn = document.getElementById('save-style-btn');

        if (!editor) return;

        const content = editor.value.trim();
        if (!content) {
            MobilePhone.showToast('风格内容不能为空', 'warning');
            return;
        }

        // 显示保存状态
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
        }

        try {
            // 创建风格数据
            const styleData = {
                id: 'custom_' + Date.now(),
                name: styleName,
                description: styleDescription,
                prompt: content,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isCustom: true,
            };

            // 保存到localStorage（这个方法将在后续任务中实现）
            this.saveCustomStyleToStorage(styleData);

            // 隐藏弹窗
            this.hideModal('style-preview-modal');

            // 刷新风格列表
            this.loadAndDisplayCustomStyles();

            // 更新风格选择器（这个方法将在后续任务中实现）
            this.updateStyleSelectors();

            MobilePhone.showToast('✅ 风格保存成功', 'success');
        } catch (error) {
            console.error('[Mobile Phone] 保存风格失败:', error);
            MobilePhone.showToast('保存失败: ' + error.message, 'error');
        } finally {
            // 恢复按钮状态
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> 保存风格';
            }
        }
    }

    // 保存自定义风格到存储
    saveCustomStyleToStorage(styleData) {
        try {
            if (window.forumStyles) {
                return window.forumStyles.saveCustomStyle(styleData);
            } else {
                throw new Error('ForumStyles未初始化');
            }
        } catch (error) {
            console.error('[Mobile Phone] 保存风格到存储失败:', error);
            throw error;
        }
    }

    // 更新风格选择器
    updateStyleSelectors() {
        try {
            // 更新论坛控制面板的风格选择器
            if (window.forumControlApp && window.forumControlApp.refreshStyleSelector) {
                window.forumControlApp.refreshStyleSelector();
            }

            // 更新论坛控制面板的风格选择器（备用方法）
            const forumStyleSelect = document.getElementById('forum-style-select');
            if (forumStyleSelect && window.forumStyles) {
                this.updateSingleStyleSelector(forumStyleSelect);
            }

            // 更新其他可能的风格选择器
            const allStyleSelects = document.querySelectorAll('select[id*="style"]');
            allStyleSelects.forEach(select => {
                if (select.id.includes('forum') || select.id.includes('style')) {
                    this.updateSingleStyleSelector(select);
                }
            });

            console.log('[Mobile Phone] 风格选择器已更新');
        } catch (error) {
            console.error('[Mobile Phone] 更新风格选择器失败:', error);
        }
    }

    // 初始化论坛风格选择器
    initializeForumStyleSelector(selectElement) {
        if (!selectElement) {
            console.warn('[Mobile Phone] 风格选择器元素不存在');
            return;
        }

        console.log('[Mobile Phone] 开始初始化论坛风格选择器...');

        // 等待ForumStyles初始化完成
        const initializeSelector = () => {
            if (!window.forumStyles) {
                console.log('[Mobile Phone] 等待ForumStyles初始化...');
                // 如果ForumStyles还没有初始化，等待一下再试
                setTimeout(initializeSelector, 100);
                return;
            }

            console.log('[Mobile Phone] ForumStyles已初始化，开始更新选择器');

            // 获取当前选中的风格
            let currentStyle = '贴吧老哥'; // 默认风格
            if (window.forumManager && window.forumManager.currentSettings) {
                currentStyle = window.forumManager.currentSettings.selectedStyle || '贴吧老哥';
                console.log('[Mobile Phone] 从ForumManager获取当前风格:', currentStyle);
            }

            // 获取自定义风格数量
            const customStyles = window.forumStyles.getAllCustomStyles();
            console.log('[Mobile Phone] 发现自定义风格数量:', customStyles.length);

            // 更新选择器内容
            this.updateSingleStyleSelector(selectElement);

            // 设置当前选中的风格
            if (selectElement.querySelector(`option[value="${currentStyle}"]`)) {
                selectElement.value = currentStyle;
                console.log('[Mobile Phone] 成功设置当前风格:', currentStyle);
            } else {
                // 如果当前风格不存在，回退到默认风格
                console.warn('[Mobile Phone] 当前风格不存在，回退到默认风格:', currentStyle);
                selectElement.value = '贴吧老哥';
                if (window.forumManager) {
                    window.forumManager.currentSettings.selectedStyle = '贴吧老哥';
                    window.forumManager.saveSettings();
                }
            }

            console.log('[Mobile Phone] 论坛风格选择器初始化完成，当前风格:', selectElement.value);
            console.log('[Mobile Phone] 选择器选项数量:', selectElement.options.length);
        };

        initializeSelector();
    }

    // 初始化平行事件风格选择器
    initializeParallelEventsStyleSelector() {
        const selectElement = document.getElementById('parallel-events-style-select');
        if (!selectElement) {
            console.warn('[Mobile Phone] 平行事件风格选择器元素不存在');
            return;
        }

        console.log('[Mobile Phone] 开始初始化平行事件风格选择器...');

        // 等待平行事件样式管理器初始化完成
        const initializeSelector = () => {
            if (!window.parallelEventsStyles) {
                console.log('[Mobile Phone] 等待平行事件样式管理器初始化...');
                setTimeout(initializeSelector, 100);
                return;
            }

            console.log('[Mobile Phone] 平行事件样式管理器已初始化，开始更新选择器');

            // 获取当前选中的风格，优先从localStorage读取
            let currentStyle = '平行事件'; // 默认风格

            try {
                const saved = localStorage.getItem('parallelEventsSettings');
                if (saved) {
                    const settings = JSON.parse(saved);
                    if (settings.selectedStyle) {
                        currentStyle = settings.selectedStyle;
                        console.log('[Mobile Phone] 从localStorage获取当前风格:', currentStyle);
                    }
                }
            } catch (error) {
                console.warn('[Mobile Phone] 读取localStorage风格设置失败:', error);
            }

            // 如果localStorage中没有，再从管理器获取
            if (currentStyle === '平行事件' && window.parallelEventsManager && window.parallelEventsManager.currentSettings) {
                currentStyle = window.parallelEventsManager.currentSettings.selectedStyle || '平行事件';
                console.log('[Mobile Phone] 从平行事件管理器获取当前风格:', currentStyle);
            }

            // 检查是否已经有选项（HTML中已经设置了基本选项）
            if (selectElement.options.length === 0) {
                console.log('[Mobile Phone] 选择器为空，重新构建选项');

                // 获取平行事件的可用风格
                const availableStyles = window.parallelEventsStyles.getAvailableStyles();
                console.log('[Mobile Phone] 平行事件可用风格:', availableStyles);

                // 添加预设风格
                const presetGroup = document.createElement('optgroup');
                presetGroup.label = '预设风格';

                availableStyles.forEach(styleName => {
                    const option = document.createElement('option');
                    option.value = styleName;
                    option.textContent = styleName;
                    presetGroup.appendChild(option);
                });

                selectElement.appendChild(presetGroup);
            } else {
                console.log('[Mobile Phone] 选择器已有选项，跳过重新构建');
            }

            // 设置当前选中的风格
            if (selectElement.querySelector(`option[value="${currentStyle}"]`)) {
                selectElement.value = currentStyle;
                console.log('[Mobile Phone] 成功设置平行事件当前风格:', currentStyle);
            } else {
                // 如果当前风格不存在，回退到默认风格
                console.warn('[Mobile Phone] 平行事件当前风格不存在，回退到默认风格:', currentStyle);
                selectElement.value = '平行事件';
                if (window.parallelEventsManager) {
                    window.parallelEventsManager.currentSettings.selectedStyle = '平行事件';
                    window.parallelEventsManager.saveSettings();
                }
            }

            console.log('[Mobile Phone] 平行事件风格选择器初始化完成，当前风格:', selectElement.value);
            console.log('[Mobile Phone] 选择器选项数量:', selectElement.options.length);

            // 同时初始化其他平行事件设置
            this.initializeParallelEventsSettings();
        };

        initializeSelector();
    }

    // 初始化平行事件设置
    initializeParallelEventsSettings() {
        if (!window.parallelEventsManager) {
            return;
        }

        console.log('[Mobile Phone] 开始同步平行事件设置...');

        // 从界面元素读取当前值，并同步到管理器
        const thresholdInput = document.getElementById('parallel-events-threshold');
        const customPrefixInput = document.getElementById('parallel-events-custom-prefix');
        const enabledCheckbox = document.getElementById('parallel-events-enabled');

        let needsSave = false;

        // 同步阈值：优先使用界面值
        if (thresholdInput) {
            const htmlValue = parseInt(thresholdInput.value);
            const managerValue = window.parallelEventsManager.currentSettings.threshold;

            if (htmlValue !== managerValue) {
                console.log(`[Mobile Phone] 阈值不同步 - HTML: ${htmlValue}, 管理器: ${managerValue}, 使用HTML值`);
                window.parallelEventsManager.currentSettings.threshold = htmlValue;
                needsSave = true;
            }
        }

        // 同步自定义前缀
        if (customPrefixInput) {
            const htmlValue = customPrefixInput.value;
            const managerValue = window.parallelEventsManager.currentSettings.customPrefix;

            if (htmlValue !== managerValue && htmlValue) {
                console.log('[Mobile Phone] 自定义前缀不同步，使用HTML值');
                window.parallelEventsManager.currentSettings.customPrefix = htmlValue;
                needsSave = true;
            } else if (!htmlValue && managerValue) {
                // 如果HTML为空但管理器有值，更新HTML
                customPrefixInput.value = managerValue;
            }
        }

        // 同步启用状态
        if (enabledCheckbox) {
            const htmlValue = enabledCheckbox.checked;
            const managerValue = window.parallelEventsManager.currentSettings.enabled;

            if (htmlValue !== managerValue) {
                console.log(`[Mobile Phone] 启用状态不同步 - HTML: ${htmlValue}, 管理器: ${managerValue}, 使用HTML值`);
                window.parallelEventsManager.currentSettings.enabled = htmlValue;
                needsSave = true;
            }
        }

        // 如果有变化，保存设置
        if (needsSave) {
            window.parallelEventsManager.saveSettings();
            console.log('[Mobile Phone] 平行事件设置已同步并保存:', window.parallelEventsManager.currentSettings);
        } else {
            console.log('[Mobile Phone] 平行事件设置已同步，无需保存');
        }
    }

    // 从localStorage同步平行事件UI显示
    syncParallelEventsUIFromStorage() {
        try {
            const saved = localStorage.getItem('parallelEventsSettings');
            if (!saved) {
                console.log('[Mobile Phone] 没有保存的平行事件设置，跳过UI同步');
                return;
            }

            const settings = JSON.parse(saved);
            console.log('[Mobile Phone] 开始同步平行事件UI显示:', settings);

            // 同步阈值
            const thresholdInput = document.getElementById('parallel-events-threshold');
            if (thresholdInput && settings.threshold !== undefined) {
                thresholdInput.value = settings.threshold;
                console.log('[Mobile Phone] UI阈值已同步:', settings.threshold);
            } else if (!thresholdInput) {
                console.warn('[Mobile Phone] 阈值输入框未找到，可能DOM还未加载完成');
            }

            // 同步自定义前缀
            const customPrefixInput = document.getElementById('parallel-events-custom-prefix');
            if (customPrefixInput && settings.customPrefix !== undefined) {
                customPrefixInput.value = settings.customPrefix;
                console.log('[Mobile Phone] UI自定义前缀已同步');
            } else if (!customPrefixInput) {
                console.warn('[Mobile Phone] 自定义前缀输入框未找到，可能DOM还未加载完成');
            }

            // 同步启用状态
            const enabledCheckbox = document.getElementById('parallel-events-enabled');
            if (enabledCheckbox && settings.enabled !== undefined) {
                enabledCheckbox.checked = settings.enabled;
                console.log('[Mobile Phone] UI启用状态已同步:', settings.enabled);
            } else if (!enabledCheckbox) {
                console.warn('[Mobile Phone] 启用状态复选框未找到，可能DOM还未加载完成');
            }

            // 同步风格选择
            const styleSelect = document.getElementById('parallel-events-style-select');
            if (styleSelect && settings.selectedStyle) {
                // 先检查选项是否存在
                let optionExists = false;
                for (let i = 0; i < styleSelect.options.length; i++) {
                    if (styleSelect.options[i].value === settings.selectedStyle) {
                        optionExists = true;
                        break;
                    }
                }

                if (optionExists) {
                    styleSelect.value = settings.selectedStyle;
                    console.log('[Mobile Phone] UI风格选择已同步:', settings.selectedStyle);
                } else {
                    console.warn('[Mobile Phone] 风格选项不存在:', settings.selectedStyle);
                    console.log('[Mobile Phone] 可用选项:', Array.from(styleSelect.options).map(opt => opt.value));
                }
            }

            console.log('[Mobile Phone] ✅ 平行事件UI同步完成');
        } catch (error) {
            console.error('[Mobile Phone] 平行事件UI同步失败:', error);
        }
    }



    // 更新单个风格选择器
    updateSingleStyleSelector(selectElement) {
        if (!selectElement || !window.forumStyles) return;

        // 获取当前实际应用的风格
        let currentValue = selectElement.value;
        if (window.forumManager && window.forumManager.currentSettings) {
            currentValue = window.forumManager.currentSettings.selectedStyle || currentValue;
        }



        // 添加自定义风格
        const customStyles = window.forumStyles.getAllCustomStyles();
        if (customStyles.length > 0) {
            const customGroup = document.createElement('optgroup');
            customGroup.label = '自定义风格';

            customStyles.forEach(style => {
                const option = document.createElement('option');
                option.value = style.name;
                option.textContent = `${style.name} (自定义)`;
                customGroup.appendChild(option);
            });

            selectElement.appendChild(customGroup);
        }

        // 设置当前选中的风格
        if (currentValue && selectElement.querySelector(`option[value="${currentValue}"]`)) {
            selectElement.value = currentValue;
            console.log('[Mobile Phone] 风格选择器已设置为:', currentValue);
        } else {
            // 如果当前风格不存在，回退到默认风格
            selectElement.value = '贴吧老哥';
            console.log('[Mobile Phone] 风格选择器回退到默认风格: 贴吧老哥');
        }
    }

    // 编辑自定义风格
    editCustomStyle(styleName) {
        try {
            if (!window.forumStyles) {
                throw new Error('ForumStyles未初始化');
            }

            const style = window.forumStyles.getCustomStyle(styleName);
            if (!style) {
                throw new Error('风格不存在');
            }

            // 显示编辑弹窗
            this.showStylePreviewModal(style.name, style.description, style.prompt);
        } catch (error) {
            console.error('[Mobile Phone] 编辑自定义风格失败:', error);
            MobilePhone.showToast('编辑失败: ' + error.message, 'error');
        }
    }

    // 复制自定义风格
    copyCustomStyle(styleName) {
        try {
            if (!window.forumStyles) {
                throw new Error('ForumStyles未初始化');
            }

            const style = window.forumStyles.getCustomStyle(styleName);
            if (!style) {
                throw new Error('风格不存在');
            }

            // 创建副本
            const copyName = `${style.name} - 副本`;
            const copyData = {
                name: copyName,
                description: style.description,
                prompt: style.prompt,
            };

            // 检查副本名称是否已存在
            let counter = 1;
            let finalName = copyName;
            while (window.forumStyles.getCustomStyle(finalName) || window.forumStyles.styles[finalName]) {
                finalName = `${copyName} (${counter})`;
                counter++;
            }
            copyData.name = finalName;

            // 保存副本
            window.forumStyles.saveCustomStyle(copyData);

            // 刷新显示
            this.loadAndDisplayCustomStyles();
            this.updateStyleSelectors();

            MobilePhone.showToast(`✅ 已复制为 "${finalName}"`, 'success');
        } catch (error) {
            console.error('[Mobile Phone] 复制自定义风格失败:', error);
            MobilePhone.showToast('复制失败: ' + error.message, 'error');
        }
    }

    // 删除自定义风格
    deleteCustomStyle(styleName) {
        try {
            if (!window.forumStyles) {
                throw new Error('ForumStyles未初始化');
            }

            const style = window.forumStyles.getCustomStyle(styleName);
            if (!style) {
                throw new Error('风格不存在');
            }

            // 确认删除
            const confirmed = confirm(`确定要删除风格 "${styleName}" 吗？\n\n此操作不可撤销。`);
            if (!confirmed) {
                return;
            }

            // 删除风格
            window.forumStyles.deleteCustomStyle(styleName);

            // 刷新显示
            this.loadAndDisplayCustomStyles();
            this.updateStyleSelectors();

            MobilePhone.showToast(`✅ 已删除风格 "${styleName}"`, 'success');
        } catch (error) {
            console.error('[Mobile Phone] 删除自定义风格失败:', error);
            MobilePhone.showToast('删除失败: ' + error.message, 'error');
        }
    }

    // 重置所有API设置
    resetAllApiSettings() {
        try {
            // 重置论坛设置
            if (window.forumManager) {
                window.forumManager.currentSettings = {
                    enabled: true,
                    selectedStyle: '贴吧老哥',
                    autoUpdate: true,
                    threshold: 10,
                    apiConfig: {
                        url: '',
                        apiKey: '',
                        model: '',
                    },
                };
                window.forumManager.saveSettings();
                console.log('[Mobile Phone] 论坛设置已重置');
            }

            // 重置微博设置
            if (window.weiboManager) {
                window.weiboManager.currentSettings = {
                    enabled: true,
                    autoUpdate: true,
                    threshold: 10,
                    apiConfig: {
                        url: '',
                        apiKey: '',
                        model: '',
                    },
                };
                window.weiboManager.saveSettings();
                console.log('[Mobile Phone] 微博设置已重置');
            }

            // 重置自定义前缀
            if (window.forumStyles) {
                window.forumStyles.setCustomPrefix('');
            }
            if (window.weiboStyles) {
                window.weiboStyles.setCustomPrefix('');
            }

            // 刷新界面
            this.handleApiApp();

            alert('所有设置已重置为默认值');
            console.log('[Mobile Phone] 所有API设置已重置');
        } catch (error) {
            console.error('[Mobile Phone] 重置设置时出错:', error);
            alert('重置设置时出错，请查看控制台');
        }
    }

    // 加载样式配置应用
    async loadStyleConfigApp() {
        console.log('[Mobile Phone] 开始加载样式配置管理器模块...');

        // 检查是否已加载
        if (window.getStyleConfigAppContent && window.bindStyleConfigEvents) {
            console.log('[Mobile Phone] Style Config 模块已存在，跳过加载');
            return Promise.resolve();
        }

        // 检查是否正在加载
        if (window._styleConfigLoading) {
            console.log('[Mobile Phone] Style Config 正在加载中，等待完成');
            return window._styleConfigLoading;
        }

        // 标记正在加载
        window._styleConfigLoading = new Promise((resolve, reject) => {
            let loadedCount = 0;
            const totalFiles = 2; // style-config-manager.css + style-config-manager.js

            const checkComplete = () => {
                loadedCount++;
                console.log(`[Mobile Phone] 已加载 ${loadedCount}/${totalFiles} 个样式配置文件`);
                if (loadedCount === totalFiles) {
                    console.log('[Mobile Phone] 所有样式配置文件加载完成，等待模块初始化...');

                    // 等待模块完全初始化
                    setTimeout(() => {
                        if (window.getStyleConfigAppContent && window.bindStyleConfigEvents) {
                            console.log('[Mobile Phone] ✅ Style Config 模块加载并初始化完成');
                            window._styleConfigLoading = null;
                            resolve();
                        } else {
                            console.error('[Mobile Phone] ❌ 样式配置模块加载完成但全局变量未正确设置');
                            console.log('[Mobile Phone] 检查结果:', {
                                getStyleConfigAppContent: !!window.getStyleConfigAppContent,
                                bindStyleConfigEvents: !!window.bindStyleConfigEvents,
                            });
                            window._styleConfigLoading = null;
                            reject(new Error('样式配置模块初始化失败'));
                        }
                    }, 500); // 等待0.5秒让模块完成初始化
                }
            };

            const handleError = name => {
                console.error(`[Mobile Phone] ${name} 加载失败`);
                window._styleConfigLoading = null;
                reject(new Error(`${name} 加载失败`));
            };

            // 检查并移除已存在的样式配置标签
            const removeExistingTags = () => {
                const existingCss = document.querySelector('link[href*="style-config-manager.css"]');
                if (existingCss) {
                    console.log('[Mobile Phone] 移除已存在的 style-config-manager.css');
                    existingCss.remove();
                }

                const existingScript = document.querySelector('script[src*="style-config-manager.js"]');
                if (existingScript) {
                    console.log('[Mobile Phone] 移除已存在的 style-config-manager.js');
                    existingScript.remove();
                }
            };

            removeExistingTags();

            // 加载CSS文件
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = '/scripts/extensions/third-party/mobile/app/style-config-manager.css';
            cssLink.onload = () => {
                console.log('[Mobile Phone] style-config-manager.css 加载完成');
                checkComplete();
            };
            cssLink.onerror = () => handleError('style-config-manager.css');
            document.head.appendChild(cssLink);

            // 加载JS文件
            const jsScript = document.createElement('script');
            jsScript.src = '/scripts/extensions/third-party/mobile/app/style-config-manager.js';
            jsScript.onload = () => {
                console.log('[Mobile Phone] style-config-manager.js 加载完成');
                checkComplete();
            };
            jsScript.onerror = () => handleError('style-config-manager.js');
            document.head.appendChild(jsScript);
        });

        return window._styleConfigLoading;
    }

    // 加载论坛应用
    async loadForumApp() {
        console.log('[Mobile Phone] 开始加载论坛应用模块...');

        // 检查是否已加载 - 只检查必要的全局变量
        if (
            window.forumUI &&
            window.getForumAppContent &&
            window.bindForumEvents &&
            window.forumControlApp &&
            window.ForumAutoListener &&
            window.forumManager &&
            window.forumStyles
        ) {
            console.log('[Mobile Phone] Forum App 模块已存在，跳过加载');
            return Promise.resolve();
        }

        // 检查是否正在加载
        if (window._forumAppLoading) {
            console.log('[Mobile Phone] Forum App 正在加载中，等待完成');
            return window._forumAppLoading;
        }

        // 标记正在加载
        window._forumAppLoading = new Promise((resolve, reject) => {
            let loadedCount = 0;
            const totalFiles = 8; // Font Awesome + forum-ui.css + forum-control-app.css + forum-manager.js + forum-styles.js + forum-ui.js + forum-control-app.js + forum-auto-listener.js

            const checkComplete = () => {
                loadedCount++;
                console.log(`[Mobile Phone] 已加载 ${loadedCount}/${totalFiles} 个论坛文件`);
                if (loadedCount === totalFiles) {
                    console.log('[Mobile Phone] 所有论坛文件加载完成，等待模块初始化...');

                    // 等待论坛模块完全初始化，增加重试机制
                    let retryCount = 0;
                    const maxRetries = 5;
                    const checkInitialization = () => {
                        retryCount++;
                        if (
                            window.forumUI &&
                            window.getForumAppContent &&
                            window.bindForumEvents &&
                            window.forumControlApp &&
                            window.ForumAutoListener &&
                            window.forumManager &&
                            window.forumStyles
                        ) {
                            console.log('[Mobile Phone] ✅ Forum App 模块加载并初始化完成');
                            window._forumAppLoading = null;
                            resolve();
                        } else if (retryCount < maxRetries) {
                            console.log(`[Mobile Phone] 论坛模块正在初始化中... (${retryCount}/${maxRetries})`);
                            setTimeout(checkInitialization, 500); // 每500ms检查一次
                        } else {
                            console.error('[Mobile Phone] ❌ 论坛模块加载完成但全局变量未正确设置');
                            console.log('[Mobile Phone] 检查结果:', {
                                forumUI: !!window.forumUI,
                                getForumAppContent: !!window.getForumAppContent,
                                bindForumEvents: !!window.bindForumEvents,
                                forumControlApp: !!window.forumControlApp,
                                ForumAutoListener: !!window.ForumAutoListener,
                                forumManager: !!window.forumManager,
                                forumStyles: !!window.forumStyles,
                            });
                            window._forumAppLoading = null;
                            reject(new Error('论坛模块初始化失败'));
                        }
                    };
                    setTimeout(checkInitialization, 500); // 首次等待500ms
                }
            };

            const handleError = name => {
                console.error(`[Mobile Phone] ${name} 加载失败`);
                loadedCount++; // 即使失败也要计数，避免永远等待
                // 检查是否所有文件都已尝试加载（成功或失败）
                if (loadedCount === totalFiles) {
                    console.error('[Mobile Phone] ❌ 论坛模块加载失败，某些文件无法加载');
                    window._forumAppLoading = null;
                    reject(new Error(`论坛模块加载失败: ${name} 加载失败`));
                }
            };

            // 首先加载 Font Awesome（如果还没有加载）
            if (!document.querySelector('link[href*="font-awesome"]')) {
                const fontAwesomeLink = document.createElement('link');
                fontAwesomeLink.rel = 'stylesheet';
                fontAwesomeLink.href = '';
                fontAwesomeLink.onload = () => {
                    console.log('[Mobile Phone] Font Awesome 加载完成（论坛应用）');
                    checkComplete();
                };
                fontAwesomeLink.onerror = () => handleError('Font Awesome');
                document.head.appendChild(fontAwesomeLink);
            } else {
                // 如果已经加载了，直接计数
                console.log('[Mobile Phone] Font Awesome 已存在，跳过加载（论坛应用）');
                checkComplete();
            }

            // 加载CSS文件
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = './scripts/extensions/third-party/mobile/app/forum-app/forum-ui.css';
            cssLink.onload = () => {
                console.log('[Mobile Phone] forum-ui.css 加载完成');
                checkComplete();
            };
            cssLink.onerror = () => handleError('forum-ui.css');
            document.head.appendChild(cssLink);

            // 加载控制应用CSS文件
            const controlCssLink = document.createElement('link');
            controlCssLink.rel = 'stylesheet';
            controlCssLink.href = './scripts/extensions/third-party/mobile/app/forum-app/forum-control-app.css';
            controlCssLink.onload = () => {
                console.log('[Mobile Phone] forum-control-app.css 加载完成');
                checkComplete();
            };
            controlCssLink.onerror = () => handleError('forum-control-app.css');
            document.head.appendChild(controlCssLink);

            // 加载论坛管理器 JS文件
            const managerScript = document.createElement('script');
            managerScript.src = './scripts/extensions/third-party/mobile/app/forum-app/forum-manager.js';
            managerScript.onload = () => {
                console.log('[Mobile Phone] forum-manager.js 加载完成');
                checkComplete();
            };
            managerScript.onerror = () => handleError('forum-manager.js');
            document.head.appendChild(managerScript);

            // 加载论坛样式管理器 JS文件
            const stylesScript = document.createElement('script');
            stylesScript.src = './scripts/extensions/third-party/mobile/app/forum-app/forum-styles.js';
            stylesScript.onload = () => {
                console.log('[Mobile Phone] forum-styles.js 加载完成');
                checkComplete();
            };
            stylesScript.onerror = () => handleError('forum-styles.js');
            document.head.appendChild(stylesScript);

            // 加载主UI JS文件
            const jsScript = document.createElement('script');
            jsScript.src = './scripts/extensions/third-party/mobile/app/forum-app/forum-ui.js';
            jsScript.onload = () => {
                console.log('[Mobile Phone] forum-ui.js 加载完成');
                checkComplete();
            };
            jsScript.onerror = () => handleError('forum-ui.js');
            document.head.appendChild(jsScript);

            // 加载论坛控制应用 JS文件
            const controlScript = document.createElement('script');
            controlScript.src = './scripts/extensions/third-party/mobile/app/forum-app/forum-control-app.js';
            controlScript.onload = () => {
                console.log('[Mobile Phone] forum-control-app.js 加载完成');
                checkComplete();
            };
            controlScript.onerror = () => handleError('forum-control-app.js');
            document.head.appendChild(controlScript);

            // 加载论坛自动监听器 JS文件
            const autoListenerScript = document.createElement('script');
            autoListenerScript.src = './scripts/extensions/third-party/mobile/app/forum-app/forum-auto-listener.js';
            autoListenerScript.onload = () => {
                console.log('[Mobile Phone] forum-auto-listener.js 加载完成');
                checkComplete();
            };
            autoListenerScript.onerror = () => handleError('forum-auto-listener.js');
            document.head.appendChild(autoListenerScript);
        });

        return window._forumAppLoading;
    }

    // 加载微博应用
    async loadWeiboApp() {
        console.log('[Mobile Phone] 开始加载微博应用模块...');

        // 检查是否已加载 - 只检查必要的全局变量
        if (
            window.weiboUI &&
            window.getWeiboAppContent &&
            window.bindWeiboEvents &&
            window.weiboControlApp &&
            window.WeiboAutoListener &&
            window.weiboManager &&
            window.weiboStyles
        ) {
            console.log('[Mobile Phone] Weibo App 模块已存在，跳过加载');
            return Promise.resolve();
        }

        // 检查是否正在加载
        if (window._weiboAppLoading) {
            console.log('[Mobile Phone] Weibo App 正在加载中，等待完成');
            return window._weiboAppLoading;
        }

        // 标记正在加载
        window._weiboAppLoading = new Promise((resolve, reject) => {
            let loadedCount = 0;
            const totalFiles = 9; // Font Awesome + weibo-ui.css + weibo-control-app.css + weibo-manager.js + weibo-styles.js + weibo-styles-fix.js + weibo-ui.js + weibo-control-app.js + weibo-auto-listener.js

            const checkComplete = () => {
                loadedCount++;
                console.log(`[Mobile Phone] 已加载 ${loadedCount}/${totalFiles} 个微博文件`);
                if (loadedCount === totalFiles) {
                    console.log('[Mobile Phone] 所有微博文件加载完成，等待模块初始化...');

                    // 等待微博模块完全初始化，增加重试机制
                    let retryCount = 0;
                    const maxRetries = 5;
                    const checkInitialization = () => {
                        retryCount++;
                        if (
                            window.weiboUI &&
                            window.getWeiboAppContent &&
                            window.bindWeiboEvents &&
                            window.weiboControlApp &&
                            window.WeiboAutoListener &&
                            window.weiboManager &&
                            window.weiboStyles
                        ) {
                            console.log('[Mobile Phone] ✅ Weibo App 模块加载并初始化完成');
                            window._weiboAppLoading = null;
                            resolve();
                        } else if (retryCount < maxRetries) {
                            console.log(`[Mobile Phone] 微博模块正在初始化中... (${retryCount}/${maxRetries})`);
                            setTimeout(checkInitialization, 500); // 每500ms检查一次
                        } else {
                            console.error('[Mobile Phone] ❌ 微博模块加载完成但全局变量未正确设置');
                            console.log('[Mobile Phone] 检查结果:', {
                                weiboUI: !!window.weiboUI,
                                getWeiboAppContent: !!window.getWeiboAppContent,
                                bindWeiboEvents: !!window.bindWeiboEvents,
                                weiboControlApp: !!window.weiboControlApp,
                                WeiboAutoListener: !!window.WeiboAutoListener,
                                weiboManager: !!window.weiboManager,
                                weiboStyles: !!window.weiboStyles,
                            });
                            window._weiboAppLoading = null;
                            reject(new Error('微博模块初始化失败'));
                        }
                    };
                    setTimeout(checkInitialization, 500); // 首次等待500ms
                }
            };

            const handleError = name => {
                console.error(`[Mobile Phone] ${name} 加载失败`);
                loadedCount++; // 即使失败也要计数，避免永远等待
                // 检查是否所有文件都已尝试加载（成功或失败）
                if (loadedCount === totalFiles) {
                    console.error('[Mobile Phone] ❌ 微博模块加载失败，某些文件无法加载');
                    window._weiboAppLoading = null;
                    reject(new Error(`微博模块加载失败: ${name} 加载失败`));
                }
            };

            // 首先加载 Font Awesome（如果还没有加载）
            if (!document.querySelector('link[href*="font-awesome"]')) {
                const fontAwesomeLink = document.createElement('link');
                fontAwesomeLink.rel = 'stylesheet';
                fontAwesomeLink.href = '';
                fontAwesomeLink.onload = () => {
                    console.log('[Mobile Phone] Font Awesome 加载完成');
                    checkComplete();
                };
                fontAwesomeLink.onerror = () => handleError('Font Awesome');
                document.head.appendChild(fontAwesomeLink);
            } else {
                // 如果已经加载了，直接计数
                console.log('[Mobile Phone] Font Awesome 已存在，跳过加载');
                checkComplete();
            }

            // 加载CSS文件
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = './scripts/extensions/third-party/mobile/app/weibo-app/weibo-ui.css';
            cssLink.onload = () => {
                console.log('[Mobile Phone] weibo-ui.css 加载完成');
                checkComplete();
            };
            cssLink.onerror = () => handleError('weibo-ui.css');
            document.head.appendChild(cssLink);

            // 加载控制应用CSS文件
            const controlCssLink = document.createElement('link');
            controlCssLink.rel = 'stylesheet';
            controlCssLink.href = './scripts/extensions/third-party/mobile/app/weibo-app/weibo-control-app.css';
            controlCssLink.onload = () => {
                console.log('[Mobile Phone] weibo-control-app.css 加载完成');
                checkComplete();
            };
            controlCssLink.onerror = () => handleError('weibo-control-app.css');
            document.head.appendChild(controlCssLink);

            // 加载微博管理器 JS文件
            const managerScript = document.createElement('script');
            managerScript.src = './scripts/extensions/third-party/mobile/app/weibo-app/weibo-manager.js';
            managerScript.onload = () => {
                console.log('[Mobile Phone] weibo-manager.js 加载完成');
                checkComplete();
            };
            managerScript.onerror = () => handleError('weibo-manager.js');
            document.head.appendChild(managerScript);

            // 加载微博样式管理器 JS文件
            const stylesScript = document.createElement('script');
            stylesScript.src = './scripts/extensions/third-party/mobile/app/weibo-app/weibo-styles.js';
            stylesScript.onload = () => {
                console.log('[Mobile Phone] weibo-styles.js 加载完成');
                // 验证是否正确创建了全局变量
                if (typeof window.WeiboStyles !== 'undefined' && typeof window.weiboStyles !== 'undefined') {
                    console.log('[Mobile Phone] ✅ WeiboStyles 类和实例已正确创建');
                } else {
                    console.warn('[Mobile Phone] ⚠️ weibo-styles.js 加载完成但全局变量未创建');
                    console.log('[Mobile Phone] WeiboStyles 类型:', typeof window.WeiboStyles);
                    console.log('[Mobile Phone] weiboStyles 类型:', typeof window.weiboStyles);
                }
                checkComplete();
            };
            stylesScript.onerror = error => {
                console.error('[Mobile Phone] weibo-styles.js 加载失败:', error);
                handleError('weibo-styles.js');
            };
            console.log('[Mobile Phone] 开始加载 weibo-styles.js:', stylesScript.src);
            document.head.appendChild(stylesScript);

            // 加载微博样式修复脚本（确保 weiboStyles 可用）
            const fixScript = document.createElement('script');
            fixScript.src = './scripts/extensions/third-party/mobile/weibo-styles-fix.js';
            fixScript.onload = () => {
                console.log('[Mobile Phone] weibo-styles-fix.js 加载完成');
                checkComplete();
            };
            fixScript.onerror = () => {
                console.warn('[Mobile Phone] weibo-styles-fix.js 加载失败，但不影响主要功能');
                checkComplete();
            };
            document.head.appendChild(fixScript);

            // 加载主UI JS文件
            const jsScript = document.createElement('script');
            jsScript.src = './scripts/extensions/third-party/mobile/app/weibo-app/weibo-ui.js';
            jsScript.onload = () => {
                console.log('[Mobile Phone] weibo-ui.js 加载完成');
                checkComplete();
            };
            jsScript.onerror = () => handleError('weibo-ui.js');
            document.head.appendChild(jsScript);

            // 加载微博控制应用 JS文件
            const controlScript = document.createElement('script');
            controlScript.src = './scripts/extensions/third-party/mobile/app/weibo-app/weibo-control-app.js';
            controlScript.onload = () => {
                console.log('[Mobile Phone] weibo-control-app.js 加载完成');
                checkComplete();
            };
            controlScript.onerror = () => handleError('weibo-control-app.js');
            document.head.appendChild(controlScript);

            // 加载微博自动监听器 JS文件
            const autoListenerScript = document.createElement('script');
            autoListenerScript.src = './scripts/extensions/third-party/mobile/app/weibo-app/weibo-auto-listener.js';
            autoListenerScript.onload = () => {
                console.log('[Mobile Phone] weibo-auto-listener.js 加载完成');
                checkComplete();
            };
            autoListenerScript.onerror = () => handleError('weibo-auto-listener.js');
            document.head.appendChild(autoListenerScript);
        });

        return window._weiboAppLoading;
    }

    // 加载消息应用
    async loadMessageApp() {
        console.log('[Mobile Phone] 开始加载消息应用模块...');

        // 检查是否已加载 - 只检查必要的全局变量
        if (window.MessageApp && window.getMessageAppContent && window.bindMessageAppEvents) {
            console.log('[Mobile Phone] Message App 模块已存在，跳过加载');
            return Promise.resolve();
        }

        // 检查是否正在加载
        if (window._messageAppLoading) {
            console.log('[Mobile Phone] Message App 正在加载中，等待完成');
            return window._messageAppLoading;
        }

        // 标记正在加载
        window._messageAppLoading = new Promise((resolve, reject) => {
            let loadedCount = 0;
            const totalFiles = 8; // message-app.css + message-renderer.css + friends-circle.css + friend-renderer.js + message-renderer.js + message-sender.js + friends-circle.js + message-app.js

            const checkComplete = () => {
                loadedCount++;
                console.log(`[Mobile Phone] 已加载 ${loadedCount}/${totalFiles} 个文件`);
                if (loadedCount === totalFiles) {
                    console.log('[Mobile Phone] 所有文件加载完成，等待模块初始化...');

                    // 等待所有模块完全初始化
                    setTimeout(() => {
                        if (window.MessageApp && window.getMessageAppContent && window.bindMessageAppEvents) {
                            console.log('[Mobile Phone] ✅ Message App 模块加载并初始化完成');
                            window._messageAppLoading = null;
                            resolve();
                        } else {
                            console.error('[Mobile Phone] ❌ 模块加载完成但全局变量未正确设置');
                            console.log('[Mobile Phone] 检查结果:', {
                                MessageApp: !!window.MessageApp,
                                getMessageAppContent: !!window.getMessageAppContent,
                                bindMessageAppEvents: !!window.bindMessageAppEvents,
                            });
                            window._messageAppLoading = null;
                            reject(new Error('模块初始化失败'));
                        }
                    }, 1000); // 等待1秒让所有模块完成初始化
                }
            };

            const handleError = name => {
                console.error(`[Mobile Phone] ${name} 加载失败`);
                window._messageAppLoading = null;
                reject(new Error(`${name} 加载失败`));
            };

            // 检查并移除已存在的标签
            const removeExistingTags = () => {
                const existingCss = document.querySelector('link[href*="message-app.css"]');
                if (existingCss) {
                    console.log('[Mobile Phone] 移除已存在的 message-app.css');
                    existingCss.remove();
                }

                const existingRendererCss = document.querySelector('link[href*="message-renderer.css"]');
                if (existingRendererCss) {
                    console.log('[Mobile Phone] 移除已存在的 message-renderer.css');
                    existingRendererCss.remove();
                }

                const existingFriendsCircleCss = document.querySelector('link[href*="friends-circle.css"]');
                if (existingFriendsCircleCss) {
                    console.log('[Mobile Phone] 移除已存在的 friends-circle.css');
                    existingFriendsCircleCss.remove();
                }

                const existingScripts = document.querySelectorAll('script[src*="mobile/app/"]');
                if (existingScripts.length > 0) {
                    console.log(`[Mobile Phone] 移除 ${existingScripts.length} 个已存在的脚本`);
                    existingScripts.forEach(script => script.remove());
                }
            };

            removeExistingTags();

            // 加载CSS文件
            const cssFiles = [
                '/scripts/extensions/third-party/mobile/app/message-app.css',
                '/scripts/extensions/third-party/mobile/app/message-renderer.css',
                '/scripts/extensions/third-party/mobile/app/friends-circle.css',
            ];

            cssFiles.forEach(href => {
                const cssLink = document.createElement('link');
                cssLink.rel = 'stylesheet';
                cssLink.href = href;
                cssLink.onload = () => {
                    console.log(`[Mobile Phone] CSS 加载完成: ${href}`);
                    checkComplete();
                };
                cssLink.onerror = () => handleError(`CSS: ${href}`);
                document.head.appendChild(cssLink);
            });

            // 加载JavaScript文件 - 按正确顺序
            const jsFiles = [
                '/scripts/extensions/third-party/mobile/app/friend-renderer.js',
                '/scripts/extensions/third-party/mobile/app/message-renderer.js',
                '/scripts/extensions/third-party/mobile/app/message-sender.js',
                '/scripts/extensions/third-party/mobile/app/friends-circle.js',
                '/scripts/extensions/third-party/mobile/app/message-app.js',
            ];

            jsFiles.forEach(src => {
                const script = document.createElement('script');
                script.src = src;
                script.onload = () => {
                    console.log(`[Mobile Phone] JS 加载完成: ${src}`);
                    checkComplete();
                };
                script.onerror = () => handleError(`JS: ${src}`);
                document.head.appendChild(script);
            });
        });

        return window._messageAppLoading;
    }

    // 加载状态应用
    async loadStatusApp() {
        console.log('[Mobile Phone] 开始加载状态应用模块...');

        // 检查是否已加载
        if (window.StatusApp && window.getStatusAppContent && window.bindStatusAppEvents) {
            console.log('[Mobile Phone] Status App 模块已存在，跳过加载');
            return Promise.resolve();
        }

        // 检查是否正在加载
        if (window._statusAppLoading) {
            console.log('[Mobile Phone] Status App 正在加载中，等待完成');
            return window._statusAppLoading;
        }

        // 标记正在加载
        window._statusAppLoading = new Promise((resolve, reject) => {
            let loadedCount = 0;
            const totalFiles = 2; // status-app.css + status-app.js

            const checkComplete = () => {
                loadedCount++;
                console.log(`[Mobile Phone] 已加载 ${loadedCount}/${totalFiles} 个状态应用文件`);
                if (loadedCount === totalFiles) {
                    console.log('[Mobile Phone] 所有状态应用文件加载完成，等待模块初始化...');

                    setTimeout(() => {
                        if (window.StatusApp && window.getStatusAppContent && window.bindStatusAppEvents) {
                            console.log('[Mobile Phone] ✅ Status App 模块加载并初始化完成');
                            window._statusAppLoading = null;
                            resolve();
                        } else {
                            console.error('[Mobile Phone] ❌ 状态应用模块加载完成但全局变量未正确设置');
                            window._statusAppLoading = null;
                            reject(new Error('状态应用模块初始化失败'));
                        }
                    }, 500);
                }
            };

            const handleError = name => {
                console.error(`[Mobile Phone] ${name} 加载失败`);
                window._statusAppLoading = null;
                reject(new Error(`${name} 加载失败`));
            };

            // 检查并移除已存在的标签
            const removeExistingTags = () => {
                const existingCss = document.querySelector('link[href*="status-app.css"]');
                if (existingCss) {
                    console.log('[Mobile Phone] 移除已存在的 status-app.css');
                    existingCss.remove();
                }

                const existingScript = document.querySelector('script[src*="status-app.js"]');
                if (existingScript) {
                    console.log('[Mobile Phone] 移除已存在的 status-app.js');
                    existingScript.remove();
                }
            };

            removeExistingTags();

            // 加载CSS文件
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = '/scripts/extensions/third-party/mobile/app/status-app.css';
            cssLink.onload = () => {
                console.log('[Mobile Phone] status-app.css 加载完成');
                checkComplete();
            };
            cssLink.onerror = () => handleError('status-app.css');
            document.head.appendChild(cssLink);

            // 加载JS文件
            const jsScript = document.createElement('script');
            jsScript.src = '/scripts/extensions/third-party/mobile/app/status-app.js';
            jsScript.onload = () => {
                console.log('[Mobile Phone] status-app.js 加载完成');
                checkComplete();
            };
            jsScript.onerror = () => handleError('status-app.js');
            document.head.appendChild(jsScript);
        });

        return window._statusAppLoading;
    }

    // 加载日记应用
    async loadDiaryApp() {
        console.log('[Mobile Phone] 开始加载日记应用模块...');

        // 检查是否已加载
        if (window.DiaryApp && window.getDiaryAppContent && window.bindDiaryAppEvents) {
            console.log('[Mobile Phone] Diary App 模块已存在，跳过加载');
            return Promise.resolve();
        }

        // 检查是否正在加载
        if (window._diaryAppLoading) {
            console.log('[Mobile Phone] Diary App 正在加载中，等待完成');
            return window._diaryAppLoading;
        }

        // 标记正在加载
        window._diaryAppLoading = new Promise((resolve, reject) => {
            let loadedCount = 0;
            const totalFiles = 2; // diary-app.css + diary-app.js

            const checkComplete = () => {
                loadedCount++;
                console.log(`[Mobile Phone] 已加载 ${loadedCount}/${totalFiles} 个日记应用文件`);
                if (loadedCount === totalFiles) {
                    console.log('[Mobile Phone] 所有日记应用文件加载完成，等待模块初始化...');

                    setTimeout(() => {
                        if (window.DiaryApp && window.getDiaryAppContent && window.bindDiaryAppEvents) {
                            console.log('[Mobile Phone] ✅ Diary App 模块加载并初始化完成');
                            window._diaryAppLoading = null;
                            resolve();
                        } else {
                            console.error('[Mobile Phone] ❌ 日记应用模块加载完成但全局变量未正确设置');
                            window._diaryAppLoading = null;
                            reject(new Error('日记应用模块初始化失败'));
                        }
                    }, 500);
                }
            };

            const handleError = name => {
                console.error(`[Mobile Phone] ${name} 加载失败`);
                window._diaryAppLoading = null;
                reject(new Error(`${name} 加载失败`));
            };

            // 检查并移除已存在的标签
            const removeExistingTags = () => {
                const existingCss = document.querySelector('link[href*="diary-app.css"]');
                if (existingCss) {
                    console.log('[Mobile Phone] 移除已存在的 diary-app.css');
                    existingCss.remove();
                }

                const existingScript = document.querySelector('script[src*="diary-app.js"]');
                if (existingScript) {
                    console.log('[Mobile Phone] 移除已存在的 diary-app.js');
                    existingScript.remove();
                }
            };

            removeExistingTags();

            // 加载CSS文件
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = '/scripts/extensions/third-party/mobile/app/diary-app.css';
            cssLink.onload = () => {
                console.log('[Mobile Phone] diary-app.css 加载完成');
                checkComplete();
            };
            cssLink.onerror = () => handleError('diary-app.css');
            document.head.appendChild(cssLink);

            // 加载JS文件
            const jsScript = document.createElement('script');
            jsScript.src = '/scripts/extensions/third-party/mobile/app/diary-app.js';
            jsScript.onload = () => {
                console.log('[Mobile Phone] diary-app.js 加载完成');
                checkComplete();
            };
            jsScript.onerror = () => handleError('diary-app.js');
            document.head.appendChild(jsScript);
        });

        return window._diaryAppLoading;
    }

    // 加载购物应用
    async loadShopApp() {
        console.log('[Mobile Phone] 开始加载购物应用模块...');

        // 检查是否已加载
        if (window.ShopApp && window.getShopAppContent && window.bindShopAppEvents) {
            console.log('[Mobile Phone] Shop App 模块已存在，跳过加载');
            return Promise.resolve();
        }

        // 检查是否正在加载
        if (window._shopAppLoading) {
            console.log('[Mobile Phone] Shop App 正在加载中，等待完成');
            return window._shopAppLoading;
        }

        // 标记正在加载
        window._shopAppLoading = new Promise((resolve, reject) => {
            let loadedCount = 0;
            const totalFiles = 2; // shop-app.css + shop-app.js

            const checkComplete = () => {
                loadedCount++;
                console.log(`[Mobile Phone] 已加载 ${loadedCount}/${totalFiles} 个购物应用文件`);
                if (loadedCount === totalFiles) {
                    console.log('[Mobile Phone] 所有购物应用文件加载完成，等待模块初始化...');

                    // 等待模块完全初始化
                    setTimeout(() => {
                        if (window.ShopApp && window.getShopAppContent && window.bindShopAppEvents) {
                            console.log('[Mobile Phone] ✅ Shop App 模块加载并初始化完成');
                            window._shopAppLoading = null;
                            resolve();
                        } else {
                            console.error('[Mobile Phone] ❌ 购物应用模块加载完成但全局变量未正确设置');
                            console.log('[Mobile Phone] 检查结果:', {
                                ShopApp: !!window.ShopApp,
                                getShopAppContent: !!window.getShopAppContent,
                                bindShopAppEvents: !!window.bindShopAppEvents,
                            });
                            window._shopAppLoading = null;
                            reject(new Error('购物应用模块初始化失败'));
                        }
                    }, 500); // 等待0.5秒让模块完成初始化
                }
            };

            const handleError = name => {
                console.error(`[Mobile Phone] ${name} 加载失败`);
                window._shopAppLoading = null;
                reject(new Error(`${name} 加载失败`));
            };

            // 检查并移除已存在的标签
            const removeExistingTags = () => {
                const existingCss = document.querySelector('link[href*="shop-app.css"]');
                if (existingCss) {
                    console.log('[Mobile Phone] 移除已存在的 shop-app.css');
                    existingCss.remove();
                }

                const existingScript = document.querySelector('script[src*="shop-app.js"]');
                if (existingScript) {
                    console.log('[Mobile Phone] 移除已存在的 shop-app.js');
                    existingScript.remove();
                }
            };

            removeExistingTags();

            // 加载CSS文件
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = '/scripts/extensions/third-party/mobile/app/shop-app.css';
            cssLink.onload = () => {
                console.log('[Mobile Phone] shop-app.css 加载完成');
                checkComplete();
            };
            cssLink.onerror = () => handleError('shop-app.css');
            document.head.appendChild(cssLink);

            // 加载JS文件
            const jsScript = document.createElement('script');
            jsScript.src = '/scripts/extensions/third-party/mobile/app/shop-app.js';
            jsScript.onload = () => {
                console.log('[Mobile Phone] shop-app.js 加载完成');
                checkComplete();
            };
            jsScript.onerror = () => handleError('shop-app.js');
            document.head.appendChild(jsScript);
        });

        return window._shopAppLoading;
    }

    // 加载背包应用
    async loadBackpackApp() {
        console.log('[Mobile Phone] 开始加载背包应用模块...');

        // 检查是否已加载
        if (window.BackpackApp && window.getBackpackAppContent && window.bindBackpackAppEvents) {
            console.log('[Mobile Phone] Backpack App 模块已存在，跳过加载');
            return Promise.resolve();
        }

        // 检查是否正在加载
        if (window._backpackAppLoading) {
            console.log('[Mobile Phone] Backpack App 正在加载中，等待完成');
            return window._backpackAppLoading;
        }

        // 标记正在加载
        window._backpackAppLoading = new Promise((resolve, reject) => {
            let loadedCount = 0;
            const totalFiles = 2; // backpack-app.css + backpack-app.js

            const checkComplete = () => {
                loadedCount++;
                console.log(`[Mobile Phone] 已加载 ${loadedCount}/${totalFiles} 个背包应用文件`);
                if (loadedCount === totalFiles) {
                    console.log('[Mobile Phone] 所有背包应用文件加载完成，等待模块初始化...');

                    // 等待模块完全初始化
                    setTimeout(() => {
                        if (window.BackpackApp && window.getBackpackAppContent && window.bindBackpackAppEvents) {
                            console.log('[Mobile Phone] ✅ Backpack App 模块加载并初始化完成');
                            window._backpackAppLoading = null;
                            resolve();
                        } else {
                            console.error('[Mobile Phone] ❌ 背包应用模块加载完成但全局变量未正确设置');
                            console.log('[Mobile Phone] 检查结果:', {
                                BackpackApp: !!window.BackpackApp,
                                getBackpackAppContent: !!window.getBackpackAppContent,
                                bindBackpackAppEvents: !!window.bindBackpackAppEvents,
                            });
                            window._backpackAppLoading = null;
                            reject(new Error('背包应用模块初始化失败'));
                        }
                    }, 500); // 等待0.5秒让模块完成初始化
                }
            };

            const handleError = name => {
                console.error(`[Mobile Phone] ${name} 加载失败`);
                window._backpackAppLoading = null;
                reject(new Error(`${name} 加载失败`));
            };

            // 检查并移除已存在的标签
            const removeExistingTags = () => {
                const existingCss = document.querySelector('link[href*="backpack-app.css"]');
                if (existingCss) {
                    console.log('[Mobile Phone] 移除已存在的 backpack-app.css');
                    existingCss.remove();
                }

                const existingScript = document.querySelector('script[src*="backpack-app.js"]');
                if (existingScript) {
                    console.log('[Mobile Phone] 移除已存在的 backpack-app.js');
                    existingScript.remove();
                }
            };

            removeExistingTags();

            // 加载CSS文件
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = '/scripts/extensions/third-party/mobile/app/backpack-app.css';
            cssLink.onload = () => {
                console.log('[Mobile Phone] backpack-app.css 加载完成');
                checkComplete();
            };
            cssLink.onerror = () => handleError('backpack-app.css');
            document.head.appendChild(cssLink);

            // 加载JS文件
            const jsScript = document.createElement('script');
            jsScript.src = '/scripts/extensions/third-party/mobile/app/backpack-app.js';
            jsScript.onload = () => {
                console.log('[Mobile Phone] backpack-app.js 加载完成');
                checkComplete();
            };
            jsScript.onerror = () => handleError('backpack-app.js');
            document.head.appendChild(jsScript);
        });

        return window._backpackAppLoading;
    }

    // 加载任务应用
    async loadTaskApp() {
        console.log('[Mobile Phone] 开始加载任务应用模块...');

        // 检查是否已加载
        if (window.TaskApp && window.getTaskAppContent && window.bindTaskAppEvents) {
            console.log('[Mobile Phone] Task App 模块已存在，跳过加载');
            return Promise.resolve();
        }

        // 检查是否正在加载
        if (window._taskAppLoading) {
            console.log('[Mobile Phone] Task App 正在加载中，等待完成');
            return window._taskAppLoading;
        }

        // 标记正在加载
        window._taskAppLoading = new Promise((resolve, reject) => {
            let loadedCount = 0;
            const totalFiles = 2; // task-app.css + task-app.js

            const checkComplete = () => {
                loadedCount++;
                console.log(`[Mobile Phone] 已加载 ${loadedCount}/${totalFiles} 个任务应用文件`);
                if (loadedCount === totalFiles) {
                    console.log('[Mobile Phone] 所有任务应用文件加载完成，等待模块初始化...');

                    // 等待模块完全初始化
                    setTimeout(() => {
                        if (window.TaskApp && window.getTaskAppContent && window.bindTaskAppEvents) {
                            console.log('[Mobile Phone] ✅ Task App 模块加载并初始化完成');
                            window._taskAppLoading = null;
                            resolve();
                        } else {
                            console.error('[Mobile Phone] ❌ 任务应用模块加载完成但全局变量未正确设置');
                            console.log('[Mobile Phone] 检查结果:', {
                                TaskApp: !!window.TaskApp,
                                getTaskAppContent: !!window.getTaskAppContent,
                                bindTaskAppEvents: !!window.bindTaskAppEvents,
                            });
                            window._taskAppLoading = null;
                            reject(new Error('任务应用模块初始化失败'));
                        }
                    }, 500); // 等待0.5秒让模块完成初始化
                }
            };

            const handleError = name => {
                console.error(`[Mobile Phone] ${name} 加载失败`);
                window._taskAppLoading = null;
                reject(new Error(`${name} 加载失败`));
            };

            // 检查并移除已存在的标签
            const removeExistingTags = () => {
                const existingCss = document.querySelector('link[href*="task-app.css"]');
                if (existingCss) {
                    console.log('[Mobile Phone] 移除已存在的 task-app.css');
                    existingCss.remove();
                }

                const existingScript = document.querySelector('script[src*="task-app.js"]');
                if (existingScript) {
                    console.log('[Mobile Phone] 移除已存在的 task-app.js');
                    existingScript.remove();
                }
            };

            removeExistingTags();

            // 加载CSS文件
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = '/scripts/extensions/third-party/mobile/app/task-app.css';
            cssLink.onload = () => {
                console.log('[Mobile Phone] task-app.css 加载完成');
                checkComplete();
            };
            cssLink.onerror = () => handleError('task-app.css');
            document.head.appendChild(cssLink);

            // 加载JS文件
            const jsScript = document.createElement('script');
            jsScript.src = '/scripts/extensions/third-party/mobile/app/task-app.js';
            jsScript.onload = () => {
                console.log('[Mobile Phone] task-app.js 加载完成');
                checkComplete();
            };
            jsScript.onerror = () => handleError('task-app.js');
            document.head.appendChild(jsScript);
        });

        return window._taskAppLoading;
    }

    // 加载直播应用
    async loadLiveApp() {
        console.log('[Mobile Phone] 开始加载直播应用模块...');

        // 检查是否已加载
        if (window.LiveApp && window.getLiveAppContent && window.bindLiveAppEvents) {
            console.log('[Mobile Phone] Live App 模块已存在，跳过加载');
            return Promise.resolve();
        }

        // 检查是否正在加载
        if (window._liveAppLoading) {
            console.log('[Mobile Phone] Live App 正在加载中，等待完成');
            return window._liveAppLoading;
        }

        // 标记正在加载
        window._liveAppLoading = new Promise((resolve, reject) => {
            let loadedCount = 0;
            const totalFiles = 2; // live-app.css + live-app.js

            const checkComplete = () => {
                loadedCount++;
                console.log(`[Mobile Phone] 已加载 ${loadedCount}/${totalFiles} 个直播应用文件`);
                if (loadedCount === totalFiles) {
                    console.log('[Mobile Phone] 所有直播应用文件加载完成，等待模块初始化...');

                    // 等待模块完全初始化
                    setTimeout(() => {
                        if (window.LiveApp && window.getLiveAppContent && window.bindLiveAppEvents) {
                            console.log('[Mobile Phone] ✅ Live App 模块加载并初始化完成');
                            window._liveAppLoading = null;
                            resolve();
                        } else {
                            console.error('[Mobile Phone] ❌ 直播应用模块加载完成但全局变量未正确设置');
                            console.log('[Mobile Phone] 检查结果:', {
                                LiveApp: !!window.LiveApp,
                                getLiveAppContent: !!window.getLiveAppContent,
                                bindLiveAppEvents: !!window.bindLiveAppEvents,
                            });
                            window._liveAppLoading = null;
                            reject(new Error('直播应用模块初始化失败'));
                        }
                    }, 500); // 等待0.5秒让模块完成初始化
                }
            };

            const handleError = name => {
                console.error(`[Mobile Phone] ${name} 加载失败`);
                window._liveAppLoading = null;
                reject(new Error(`${name} 加载失败`));
            };

            // 检查并移除已存在的标签
            const removeExistingTags = () => {
                const existingCss = document.querySelector('link[href*="live-app.css"]');
                if (existingCss) {
                    console.log('[Mobile Phone] 移除已存在的 live-app.css');
                    existingCss.remove();
                }

                const existingScript = document.querySelector('script[src*="live-app.js"]');
                if (existingScript) {
                    console.log('[Mobile Phone] 移除已存在的 live-app.js');
                    existingScript.remove();
                }
            };

            removeExistingTags();

            // 加载CSS文件
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = '/scripts/extensions/third-party/mobile/app/live-app.css';
            cssLink.onload = () => {
                console.log('[Mobile Phone] live-app.css 加载完成');
                checkComplete();
            };
            cssLink.onerror = () => handleError('live-app.css');
            document.head.appendChild(cssLink);

            // 加载JS文件
            const jsScript = document.createElement('script');
            jsScript.src = '/scripts/extensions/third-party/mobile/app/live-app.js';
            jsScript.onload = () => {
                console.log('[Mobile Phone] live-app.js 加载完成');
                checkComplete();
            };
            jsScript.onerror = () => handleError('live-app.js');
            document.head.appendChild(jsScript);
        });

        return window._liveAppLoading;
    }

    // 加载观看直播应用
    async loadWatchLiveApp() {
        console.log('[Mobile Phone] 开始加载观看直播应用模块...');

        // 检查是否已加载
        if (window.WatchLiveApp && window.getWatchLiveAppContent && window.bindWatchLiveAppEvents) {
            console.log('[Mobile Phone] Watch Live App 模块已存在，跳过加载');
            return Promise.resolve();
        }

        // 检查是否正在加载
        if (window._watchLiveAppLoading) {
            console.log('[Mobile Phone] Watch Live App 正在加载中，等待完成');
            return window._watchLiveAppLoading;
        }

        // 标记正在加载
        window._watchLiveAppLoading = new Promise((resolve, reject) => {
            let loadedCount = 0;
            const totalFiles = 2; // watch-live.css + watch-live.js

            const checkComplete = () => {
                loadedCount++;
                console.log(`[Mobile Phone] 已加载 ${loadedCount}/${totalFiles} 个观看直播应用文件`);
                if (loadedCount === totalFiles) {
                    console.log('[Mobile Phone] 所有观看直播应用文件加载完成，等待模块初始化...');

                    // 等待模块完全初始化
                    setTimeout(() => {
                        if (window.WatchLiveApp && window.getWatchLiveAppContent && window.bindWatchLiveAppEvents) {
                            console.log('[Mobile Phone] ✅ Watch Live App 模块加载并初始化完成');
                            window._watchLiveAppLoading = null;
                            resolve();
                        } else {
                            console.error('[Mobile Phone] ❌ 观看直播应用模块加载完成但全局变量未正确设置');
                            console.log('[Mobile Phone] 检查结果:', {
                                WatchLiveApp: !!window.WatchLiveApp,
                                getWatchLiveAppContent: !!window.getWatchLiveAppContent,
                                bindWatchLiveAppEvents: !!window.bindWatchLiveAppEvents,
                            });
                            window._watchLiveAppLoading = null;
                            reject(new Error('观看直播应用模块初始化失败'));
                        }
                    }, 500); // 等待0.5秒让模块完成初始化
                }
            };

            const handleError = name => {
                console.error(`[Mobile Phone] ${name} 加载失败`);
                window._watchLiveAppLoading = null;
                reject(new Error(`${name} 加载失败`));
            };

            // 检查并移除已存在的标签
            const removeExistingTags = () => {
                const existingCss = document.querySelector('link[href*="watch-live.css"]');
                if (existingCss) {
                    console.log('[Mobile Phone] 移除已存在的 watch-live.css');
                    existingCss.remove();
                }

                const existingScript = document.querySelector('script[src*="watch-live.js"]');
                if (existingScript) {
                    console.log('[Mobile Phone] 移除已存在的 watch-live.js');
                    existingScript.remove();
                }
            };

            removeExistingTags();

            // 加载CSS文件
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = '/scripts/extensions/third-party/mobile/app/watch-live.css';
            cssLink.onload = () => {
                console.log('[Mobile Phone] watch-live.css 加载完成');
                checkComplete();
            };
            cssLink.onerror = () => handleError('watch-live.css');
            document.head.appendChild(cssLink);

            // 加载JS文件
            const jsScript = document.createElement('script');
            jsScript.src = '/scripts/extensions/third-party/mobile/app/watch-live.js';
            jsScript.onload = () => {
                console.log('[Mobile Phone] watch-live.js 加载完成');
                checkComplete();
            };
            jsScript.onerror = () => handleError('watch-live.js');
            document.head.appendChild(jsScript);
        });

        return window._watchLiveAppLoading;
    }

    // 加载平行事件应用
    async loadParallelEventsApp() {
        console.log('[Mobile Phone] 开始加载平行事件应用模块...');

        // 检查是否已加载 - 只检查必要的全局变量
        if (window.ParallelEventsApp && window.getParallelEventsAppContent &&
            window.bindParallelEventsAppEvents && window.parallelEventsStyles) {
            console.log('[Mobile Phone] Parallel Events App 模块已存在，跳过加载');
            return Promise.resolve();
        }

        // 检查是否正在加载
        if (window._parallelEventsAppLoading) {
            console.log('[Mobile Phone] Parallel Events App 正在加载中，等待完成');
            return window._parallelEventsAppLoading;
        }

        // 标记正在加载
        window._parallelEventsAppLoading = new Promise((resolve, reject) => {
            let loadedCount = 0;
            const totalFiles = 3; // parallel-events-app.css + parallel-events-styles.js + parallel-events-app.js

            const checkComplete = () => {
                loadedCount++;
                console.log(`[Mobile Phone] 已加载 ${loadedCount}/${totalFiles} 个平行事件应用文件`);
                if (loadedCount === totalFiles) {
                    console.log('[Mobile Phone] 所有平行事件应用文件加载完成，等待模块初始化...');

                    // 等待模块完全初始化
                    const checkInitialization = (attempt = 1, maxAttempts = 10) => {
                        setTimeout(() => {
                            const hasClass = !!window.ParallelEventsApp;
                            const hasContent = !!window.getParallelEventsAppContent;
                            const hasEvents = !!window.bindParallelEventsAppEvents;
                            const hasStyles = !!window.parallelEventsStyles;
                            const hasManager = !!window.parallelEventsManager;

                            console.log(`[Mobile Phone] 初始化检查 ${attempt}/${maxAttempts}:`, {
                                ParallelEventsApp: hasClass,
                                getParallelEventsAppContent: hasContent,
                                bindParallelEventsAppEvents: hasEvents,
                                parallelEventsStyles: hasStyles,
                                parallelEventsManager: hasManager,
                            });

                            // 只检查必要的模块，管理器会在后续异步创建
                            if (hasClass && hasContent && hasEvents && hasStyles) {
                                console.log('[Mobile Phone] ✅ Parallel Events App 模块加载并初始化完成');
                                window._parallelEventsAppLoading = null;
                                resolve();
                            } else if (attempt < maxAttempts) {
                                console.log(`[Mobile Phone] 等待初始化完成... (${attempt}/${maxAttempts})`);
                                checkInitialization(attempt + 1, maxAttempts);
                            } else {
                                console.error('[Mobile Phone] ❌ 平行事件应用模块初始化超时');
                                window._parallelEventsAppLoading = null;
                                reject(new Error('平行事件应用模块初始化超时'));
                            }
                        }, 500); // 每0.5秒检查一次
                    };

                    checkInitialization();
                }
            };

            const handleError = name => {
                console.error(`[Mobile Phone] ${name} 加载失败`);
                window._parallelEventsAppLoading = null;
                reject(new Error(`${name} 加载失败`));
            };

            // 加载CSS文件
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = './scripts/extensions/third-party/mobile/app/parallel-events-app/parallel-events-app.css';
            cssLink.onload = () => {
                console.log('[Mobile Phone] parallel-events-app.css 加载完成');
                checkComplete();
            };
            cssLink.onerror = () => handleError('parallel-events-app.css');
            document.head.appendChild(cssLink);

            // 加载风格管理器JS文件
            const stylesScript = document.createElement('script');
            stylesScript.src = './scripts/extensions/third-party/mobile/app/parallel-events-app/parallel-events-styles.js';
            stylesScript.onload = () => {
                console.log('[Mobile Phone] parallel-events-styles.js 加载完成');
                console.log('[Mobile Phone] parallelEventsStyles 状态:', typeof window.parallelEventsStyles);
                checkComplete();
            };
            stylesScript.onerror = () => handleError('parallel-events-styles.js');
            document.head.appendChild(stylesScript);

            // 加载主JS文件
            const jsScript = document.createElement('script');
            jsScript.src = './scripts/extensions/third-party/mobile/app/parallel-events-app/parallel-events-app.js';
            jsScript.onload = () => {
                console.log('[Mobile Phone] parallel-events-app.js 加载完成');
                console.log('[Mobile Phone] 全局变量状态:', {
                    ParallelEventsApp: typeof window.ParallelEventsApp,
                    getParallelEventsAppContent: typeof window.getParallelEventsAppContent,
                    bindParallelEventsAppEvents: typeof window.bindParallelEventsAppEvents,
                    debugParallelEventsApp: typeof window.debugParallelEventsApp
                });
                checkComplete();
            };
            jsScript.onerror = () => handleError('parallel-events-app.js');
            document.head.appendChild(jsScript);
        });

        return window._parallelEventsAppLoading;
    }

    // 简化的平行事件应用加载方法
    async simpleLoadParallelEventsApp() {
        console.log('[Mobile Phone] 使用简化方法加载平行事件应用...');

        return new Promise((resolve, reject) => {
            let loadedCount = 0;
            const totalFiles = 3;

            const checkComplete = () => {
                loadedCount++;
                console.log(`[Mobile Phone] 简化加载: ${loadedCount}/${totalFiles} 完成`);
                if (loadedCount === totalFiles) {
                    // 等待一下让模块初始化
                    setTimeout(() => {
                        if (window.ParallelEventsApp && window.getParallelEventsAppContent &&
                            window.bindParallelEventsAppEvents && window.parallelEventsStyles) {
                            console.log('[Mobile Phone] ✅ 简化加载成功');
                            resolve();
                        } else {
                            console.error('[Mobile Phone] ❌ 简化加载失败，全局变量未设置');
                            reject(new Error('简化加载失败'));
                        }
                    }, 1000);
                }
            };

            // 加载CSS
            const css = document.createElement('link');
            css.rel = 'stylesheet';
            css.href = './scripts/extensions/third-party/mobile/app/parallel-events-app/parallel-events-app.css';
            css.onload = checkComplete;
            css.onerror = () => reject(new Error('CSS加载失败'));
            document.head.appendChild(css);

            // 加载样式JS
            const stylesJs = document.createElement('script');
            stylesJs.src = './scripts/extensions/third-party/mobile/app/parallel-events-app/parallel-events-styles.js';
            stylesJs.onload = checkComplete;
            stylesJs.onerror = () => reject(new Error('样式JS加载失败'));
            document.head.appendChild(stylesJs);

            // 加载主JS
            const mainJs = document.createElement('script');
            mainJs.src = './scripts/extensions/third-party/mobile/app/parallel-events-app/parallel-events-app.js';
            mainJs.onload = checkComplete;
            mainJs.onerror = () => reject(new Error('主JS加载失败'));
            document.head.appendChild(mainJs);
        });
    }

    // 加载档案管理应用
    async loadProfileApp() {
        console.log('[Mobile Phone] 开始加载档案管理应用模块...');

        // 检查是否已加载
        if (window.ProfileApp && window.profileApp) {
            console.log('[Mobile Phone] Profile App 模块已存在，跳过加载');
            return Promise.resolve();
        }

        // 检查是否正在加载
        if (window._profileAppLoading) {
            console.log('[Mobile Phone] Profile App 正在加载中，等待完成');
            return window._profileAppLoading;
        }

        // 标记正在加载
        window._profileAppLoading = new Promise((resolve, reject) => {
            let loadedCount = 0;
            const totalFiles = 2; // profile-app.css + profile-app.js

            const checkComplete = () => {
                loadedCount++;
                console.log(`[Mobile Phone] 已加载 ${loadedCount}/${totalFiles} 个档案应用文件`);
                if (loadedCount === totalFiles) {
                    console.log('[Mobile Phone] 所有档案应用文件加载完成，等待模块初始化...');

                    // 等待模块完全初始化
                    const checkInitialization = (attempt = 1, maxAttempts = 10) => {
                        setTimeout(() => {
                            const hasClass = !!window.ProfileApp;
                            const hasInstance = !!window.profileApp;

                            console.log(`[Mobile Phone] 初始化检查 ${attempt}/${maxAttempts}:`, {
                                ProfileApp: hasClass,
                                profileApp: hasInstance,
                            });

                            if (hasClass && hasInstance) {
                                console.log('[Mobile Phone] ✅ Profile App 模块加载并初始化完成');
                                window._profileAppLoading = null;
                                resolve();
                            } else if (attempt < maxAttempts) {
                                console.log(`[Mobile Phone] 等待初始化完成... (${attempt}/${maxAttempts})`);
                                checkInitialization(attempt + 1, maxAttempts);
                            } else {
                                console.error('[Mobile Phone] ❌ 档案应用模块初始化超时');
                                window._profileAppLoading = null;
                                reject(new Error('档案应用模块初始化超时'));
                            }
                        }, 500); // 每0.5秒检查一次
                    };

                    checkInitialization();
                }
            };

            const handleError = name => {
                console.error(`[Mobile Phone] ${name} 加载失败`);
                window._profileAppLoading = null;
                reject(new Error(`${name} 加载失败`));
            };

            // 加载CSS文件
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = './scripts/extensions/third-party/mobile/app/profile-app.css';
            cssLink.onload = () => {
                console.log('[Mobile Phone] profile-app.css 加载完成');
                checkComplete();
            };
            cssLink.onerror = () => handleError('profile-app.css');
            document.head.appendChild(cssLink);

            // 加载JS文件
            const jsScript = document.createElement('script');
            jsScript.src = './scripts/extensions/third-party/mobile/app/profile-app.js';
            jsScript.onload = () => {
                console.log('[Mobile Phone] profile-app.js 加载完成');
                console.log('[Mobile Phone] 全局变量状态:', {
                    ProfileApp: typeof window.ProfileApp,
                    profileApp: typeof window.profileApp,
                });
                checkComplete();
            };
            jsScript.onerror = () => handleError('profile-app.js');
            document.head.appendChild(jsScript);
        });

        return window._profileAppLoading;
    }

    // 返回主界面
    goHome() {
        // 防抖检查：如果正在返回主界面，直接返回
        if (this._goingHome) {
            console.log('[Mobile Phone] 防抖：正在返回主界面，跳过重复操作');
            return;
        }

        // 如果已经在主界面，直接返回
        if (!this.currentApp && !this.currentAppState && this.appStack.length === 0) {
            console.log('[Mobile Phone] 已在主界面，跳过重复操作');
            return;
        }

        // 设置防抖标记
        this._goingHome = true;

        try {
            console.log('[Mobile Phone] 返回主界面');

            // 清除用户导航意图
            this._userNavigationIntent = null;

            this.currentApp = null;
            this.currentAppState = null;
            this.appStack = []; // 清空应用栈
            document.getElementById('home-screen').style.display = 'block';
            document.getElementById('app-screen').style.display = 'none';

            // 停止状态同步，避免无谓轮询
            this.stopStateSyncLoop();
        } finally {
            // 清除防抖标记
            setTimeout(() => {
                this._goingHome = false;
            }, 300);
        }
    }

    // 开始时钟
    startClock() {
        const updateTime = () => {
            const now = new Date();
            const timeString = now.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            });
            const dateString = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

            // 更新状态栏时间
            const mobileTime = document.getElementById('mobile-time');
            if (mobileTime) {
                mobileTime.textContent = timeString;
            }

            // 更新主界面时间
            const homeTime = document.getElementById('home-time');
            const homeDate = document.getElementById('home-date');
            if (homeTime) {
                homeTime.textContent = timeString;
            }
            if (homeDate) {
                homeDate.textContent = dateString;
            }
        };

        updateTime();
        setInterval(updateTime, 1000);
    }

    // 获取应用主界面视图标识
    getAppRootView(appName) {
        switch (appName) {
            case 'messages':
                return 'messageList';
            default:
                return 'main';
        }
    }

    // 返回到指定应用主界面（通用）
    returnToAppMain(appName) {
        // 防抖检查：如果正在返回相同应用主界面，直接返回
        if (this._returningToApp === appName) {
            console.log('[Mobile Phone] 防抖：正在返回相同应用主界面，跳过重复操作:', appName);
            return;
        }

        // 检查是否已经在目标应用的主界面
        if (this.currentApp === appName &&
            this.currentAppState &&
            this.currentAppState.app === appName &&
            this.isAppRootPage(this.currentAppState)) {
            console.log('[Mobile Phone] 已在目标应用主界面，跳过重复操作:', appName);
            return;
        }

        console.log('=== [Mobile Phone] returnToAppMain 开始 ===');
        console.log('[Mobile Phone] 目标应用:', appName);
        console.log('[Mobile Phone] 调用前状态:');
        console.log('  - currentApp:', this.currentApp);
        console.log('  - currentAppState:', JSON.stringify(this.currentAppState, null, 2));

        // 设置防抖标记
        this._returningToApp = appName;

        try {
            // 优先使用已有的专用方法以确保内部状态被完全重置
            if (appName === 'forum') {
                console.log('[Mobile Phone] 使用专用方法 returnToForumMainList');
                this.returnToForumMainList();
                return;
            }
            if (appName === 'messages') {
                console.log('[Mobile Phone] 使用专用方法 returnToMessageList');
                this.returnToMessageList();
                return;
            }

            const app = this.apps[appName];
            if (!app) {
                console.warn('[Mobile Phone] 未找到应用，返回主界面:', appName);
                this.goHome();
                return;
            }

            const rootView = this.getAppRootView(appName);
            const state = {
                app: appName,
                title: app.name,
                view: rootView,
            };

            console.log('[Mobile Phone] 创建新状态:', JSON.stringify(state, null, 2));

            // 重置应用栈为该应用的主界面
            this.appStack = [state];
            this.currentAppState = state;
            this.currentApp = appName; // 确保当前应用设置正确
            this.updateAppHeader(state);

            console.log('[Mobile Phone] 状态更新后:');
            console.log('  - currentApp:', this.currentApp);
            console.log('  - currentAppState:', JSON.stringify(this.currentAppState, null, 2));

            // 渲染主界面
            if (app.isCustomApp && app.customHandler) {
                console.log('[Mobile Phone] 调用自定义处理器');
                app.customHandler();
            } else if (app.content) {
                console.log('[Mobile Phone] 使用静态内容');
                const contentContainer = document.getElementById('app-content');
                if (contentContainer) contentContainer.innerHTML = app.content;
            }

            // 确保显示应用界面
            const homeEl = document.getElementById('home-screen');
            const appEl = document.getElementById('app-screen');
            if (homeEl && appEl) {
                homeEl.style.display = 'none';
                appEl.style.display = 'block';
            }

            console.log(`[Mobile Phone] 已返回 ${appName} 主界面`);
            console.log('=== [Mobile Phone] returnToAppMain 结束 ===');
        } catch (error) {
            console.error('[Mobile Phone] 返回应用主界面失败:', error);
            this.goHome();
        } finally {
            // 清除防抖标记
            setTimeout(() => {
                this._returningToApp = null;
            }, 500);
        }
    }

    // 根据应用模块实际运行状态判断是否在根页面（优先使用模块状态，其次回退到state判断）
    isCurrentlyAtAppRoot(appName, state) {
        try {
            if (appName === 'messages') {
                const view = window.messageApp?.currentView;
                if (view) {
                    return view === 'list' || view === 'messageList';
                }
                return this.isAppRootPage(state);
            }
            if (appName === 'forum') {
                // DOM优先：如果存在帖子详情结构，则非根
                const detailEl = document.querySelector('#forum-content .thread-detail');
                if (detailEl) return false;

                // 其次使用模块状态
                const currentThreadId = window.forumUI?.currentThreadId;
                const view = window.forumUI?.currentView;
                if (typeof currentThreadId !== 'undefined' || typeof view !== 'undefined') {
                    if (currentThreadId) return false;
                    return !view || view === 'main' || view === 'list';
                }

                // 最后回退到state判断
                return this.isAppRootPage(state);
            }
            // 其他应用暂以本地state为准
            return this.isAppRootPage(state);
        } catch (e) {
            console.warn('[Mobile Phone] isCurrentlyAtAppRoot 检测异常，回退到state判断:', e);
            return this.isAppRootPage(state);
        }
    }

    // 启动应用状态同步轮询（将各模块的实际视图同步到 currentAppState）
    startStateSyncLoop() {
        if (this._stateSyncTimer) return; // 已在运行

        let lastSignature = '';
        let syncCount = 0;
        const maxSyncCount = 10; // 最多同步10次后降低频率

        const syncOnce = () => {
            try {
                if (!this.currentAppState || !this.isVisible) return;

                // 如果正在进行应用切换操作，跳过同步避免冲突
                if (this._openingApp || this._goingHome) {
                    return;
                }

                const app = this.currentAppState.app;
                let nextView = this.currentAppState.view || 'main';
                let extra = {};

                if (app === 'messages' && window.messageApp) {
                    const view = window.messageApp.currentView;
                    if (view === 'messageDetail') {
                        nextView = 'messageDetail';
                        extra.friendId = window.messageApp.currentFriendId || null;
                        extra.friendName = window.messageApp.currentFriendName || null;
                    } else if (view === 'addFriend') {
                        nextView = 'addFriend';
                    } else if (view === 'list' || view === 'messageList') {
                        nextView = 'messageList';
                    }
                } else if (app === 'forum' && window.forumUI) {
                    const threadId = window.forumUI.currentThreadId;
                    const view = window.forumUI.currentView;
                    if (threadId) {
                        nextView = 'threadDetail';
                        extra.threadId = threadId;
                    } else if (!view || view === 'main' || view === 'list') {
                        nextView = 'main';
                    }
                }

                const signature = `${app}|${nextView}|${extra.friendId || ''}|${extra.threadId || ''}`;
                if (signature !== lastSignature) {
                    lastSignature = signature;

                    // 创建新的状态对象
                    const newState = {
                        ...this.currentAppState,
                        view: nextView,
                        ...extra,
                    };

                    // 只有状态真正发生变化时才更新
                    if (!this.isSameAppState(this.currentAppState, newState)) {
                        this.currentAppState = newState;
                        this.updateAppHeader(this.currentAppState);
                        syncCount++;
                        console.log('[Mobile Phone] 同步模块视图到状态:', this.currentAppState);
                    }
                }
            } catch (e) {
                console.warn('[Mobile Phone] 同步模块视图失败:', e);
            }
        };

        // 立即执行一次，然后进入轮询
        syncOnce();

        // 动态调整轮询频率：前10次同步使用500ms间隔，之后使用1000ms间隔
        const getInterval = () => syncCount < maxSyncCount ? 500 : 1000;

        this._stateSyncTimer = setInterval(() => {
            syncOnce();
            // 如果同步次数达到阈值，重新设置定时器以降低频率
            if (syncCount === maxSyncCount) {
                clearInterval(this._stateSyncTimer);
                this._stateSyncTimer = setInterval(syncOnce, getInterval());
                console.log('[Mobile Phone] 状态同步频率已降低到1000ms');
            }
        }, getInterval());

        console.log('[Mobile Phone] 已启动状态同步轮询，初始间隔:', getInterval(), 'ms');
    }

    stopStateSyncLoop() {
        if (this._stateSyncTimer) {
            clearInterval(this._stateSyncTimer);
            this._stateSyncTimer = null;
            console.log('[Mobile Phone] 已停止状态同步轮询');
        }
    }

    // 获取当前文字颜色设置
    getCurrentTextColor() {
        // 从全局CSS配置的Data Bank中获取
        if (window.styleConfigManager && window.styleConfigManager.getConfig) {
            const config = window.styleConfigManager.getConfig();
            return config.messageTextColor || 'black';
        }

        // 从localStorage获取（备用方案）
        return localStorage.getItem('messageTextColor') || 'black';
    }

    // 切换文字颜色
    toggleTextColor() {
        // 直接从DOM获取当前状态，更可靠
        const body = document.body;
        const isCurrentlyWhite = body.classList.contains('text-color-white');
        const newColor = isCurrentlyWhite ? 'black' : 'white';

        console.log(`[Mobile Phone] 切换文字颜色: ${isCurrentlyWhite ? 'white' : 'black'} -> ${newColor}`);

        // 保存到全局CSS配置的Data Bank
        if (window.styleConfigManager && window.styleConfigManager.updateConfig) {
            window.styleConfigManager.updateConfig({
                messageTextColor: newColor,
            });
        } else {
            // 备用方案：保存到localStorage
            localStorage.setItem('messageTextColor', newColor);
        }

        // 应用颜色到页面
        this.applyTextColor(newColor);

        // 更新按钮文字
        this.updateTextColorButton(newColor);

        // 显示提示
        MobilePhone.showToast(`文字颜色已切换为${newColor === 'white' ? '白色' : '黑色'}`);
    }

    // 应用文字颜色到页面
    applyTextColor(color) {
        const root = document.documentElement;
        const body = document.body;

        // 移除之前的颜色类
        body.classList.remove('text-color-white', 'text-color-black');

        // 添加新的颜色类
        body.classList.add(`text-color-${color}`);

        // 设置CSS变量
        root.style.setProperty('--message-text-color', color === 'white' ? '#fff' : '#000');

        console.log(`[Mobile Phone] 已应用文字颜色: ${color}`);
    }

    // 更新文字颜色按钮显示
    updateTextColorButton(color) {
        const button = document.querySelector('.text-color-toggle');
        if (button) {
            // 显示将要切换到的颜色（与当前颜色相反）
            button.innerHTML = color === 'white' ? '黑' : '白';
            button.title = `当前: ${color === 'white' ? '白色' : '黑色'}文字，点击切换为${color === 'white' ? '黑色' : '白色'
                }`;
        }
    }

    // 初始化文字颜色设置
    initTextColor() {
        const savedColor = this.getCurrentTextColor();
        this.applyTextColor(savedColor);
        console.log(`[Mobile Phone] 初始化文字颜色: ${savedColor}`);
    }

    // 显示图片配置弹窗
    showImageConfigModal() {
        console.log('[Mobile Phone] 显示图片配置弹窗');

        // 确保ImageConfigModal已加载
        if (!window.ImageConfigModal) {
            console.error('[Mobile Phone] ImageConfigModal未加载');
            MobilePhone.showToast('图片配置功能未就绪', 'error');
            return;
        }

        // 显示弹窗
        window.ImageConfigModal.show();
    }

    // 显示好友图片配置弹窗
    showFriendImageConfigModal(friendId, friendName) {
        console.log('[Mobile Phone] 显示好友图片配置弹窗:', friendId, friendName);

        // 确保FriendImageConfigModal已加载
        if (!window.FriendImageConfigModal) {
            console.error('[Mobile Phone] FriendImageConfigModal未加载');
            console.log('[Mobile Phone] 当前全局对象状态:', {
                ImageConfigModal: typeof window.ImageConfigModal,
                FriendImageConfigModal: typeof window.FriendImageConfigModal,
                styleConfigManager: typeof window.styleConfigManager,
            });

            // 尝试延迟重试
            setTimeout(() => {
                if (window.FriendImageConfigModal) {
                    console.log('[Mobile Phone] 延迟重试成功，显示好友弹窗');
                    window.FriendImageConfigModal.show(friendId, friendName);
                } else {
                    MobilePhone.showToast('好友图片配置功能未就绪，请刷新页面重试', 'error');
                }
            }, 500);
            return;
        }

        // 显示弹窗
        window.FriendImageConfigModal.show(friendId, friendName);
    }

    // 判断是否为群聊
    isGroupChat(friendId) {
        // 群聊ID通常以特定前缀开头或有特定格式
        // 这里可以根据实际的群聊ID格式进行判断
        if (!friendId) return false;

        // 示例判断逻辑：群聊ID可能包含特定字符或格式
        // 可以根据实际情况调整
        return friendId.includes('group') || friendId.includes('群') || friendId.length > 10;
    }
}

// 初始化手机界面
function initMobilePhone() {
    if (document.readyState === 'loading') {
        // 如果文档还在加载，等待DOMContentLoaded
        document.addEventListener('DOMContentLoaded', () => {
            window.mobilePhone = new MobilePhone();
            console.log('[Mobile Phone] 手机界面初始化完成');
        });
    } else {
        // 如果文档已经加载完成，直接初始化
        window.mobilePhone = new MobilePhone();
        console.log('[Mobile Phone] 手机界面初始化完成');
    }
}

// 立即执行初始化
initMobilePhone();

// 创建全局的showToast函数供其他模块使用
window.showMobileToast = MobilePhone.showToast.bind(MobilePhone);
