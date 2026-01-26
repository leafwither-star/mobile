/**
 * Message App - 信息应用
 * 为mobile-phone.js提供消息功能
 */

// 延迟加载SillyTavern的事件系统
let eventSource, event_types, chat, characters, this_chid, name1, name2;
let sillyTavernImportAttempted = false;

// 尝试导入SillyTavern的核心模块
async function importSillyTavernModules() {
  if (sillyTavernImportAttempted) {
    return;
  }
  sillyTavernImportAttempted = true;

  // 简化日志：只在调试模式下输出详细信息
  if (window.DEBUG_MESSAGE_APP) {
    console.log('[Message App] 🔍 开始导入SillyTavern模块...');
    console.log('[Message App] 🔍 检查全局对象中的变量:');
    console.log('  - window.eventSource:', typeof window['eventSource'], !!window['eventSource']);
    console.log('  - window.event_types:', typeof window['event_types'], !!window['event_types']);
    console.log('  - window.chat:', typeof window['chat'], !!window['chat']);
  }

  try {
    // 首先尝试从全局对象获取
    eventSource = window['eventSource'];
    event_types = window['event_types'];
    chat = window['chat'];
    characters = window['characters'];
    this_chid = window['this_chid'];
    name1 = window['name1'];
    name2 = window['name2'];

    if (window.DEBUG_MESSAGE_APP) {
      console.log('[Message App] 🔍 从全局对象获取结果:');
      console.log('  - eventSource:', !!eventSource, typeof eventSource);
      console.log('  - event_types:', !!event_types, typeof event_types);
    }

    if (eventSource && event_types) {
      if (window.DEBUG_MESSAGE_APP) {
        console.log('[Message App] ✅ 成功从全局对象获取SillyTavern模块');
      }
      return;
    }
  } catch (error) {
    console.warn('[Message App] 无法从全局对象获取SillyTavern模块:', error);
  }

  try {
    // @ts-ignore - 动态导入可能失败，这里进行安全处理
    const scriptModule = await import('../../../script.js').catch(() => null);
    if (scriptModule) {
      if (window.DEBUG_MESSAGE_APP) {
        console.log('[Message App] 🔍 动态导入模块内容:', Object.keys(scriptModule));
      }
      ({ eventSource, event_types, chat, characters, this_chid, name1, name2 } = scriptModule);
      if (window.DEBUG_MESSAGE_APP) {
        console.log('[Message App] ✅ 成功通过动态导入获取SillyTavern模块');
      }
    }
  } catch (error) {
    console.warn('[Message App] 无法通过动态导入获取SillyTavern模块:', error);
  }

  // 最终状态检查
  console.log('[Message App] 🔍 最终导入状态:');
  console.log('  - eventSource:', !!eventSource, eventSource?.constructor?.name);
  console.log('  - event_types:', !!event_types, event_types ? Object.keys(event_types).length + ' events' : 'null');
}

// 避免重复定义
if (typeof window.MessageApp === 'undefined') {
  class MessageApp {
    constructor() {
      this.currentView = 'list'; // 'list', 'addFriend', 'messageDetail', 'friendsCircle'
      this.currentTab = 'add'; // 'add', 'delete', 'createGroup', 'deleteGroup'
      this.currentMainTab = 'friends'; // 'friends', 'circle' - 主要页面切换
      this.friendRenderer = null;
      this.currentFriendId = null;
      this.currentFriendName = null;
      this.currentIsGroup = null; // 当前聊天是否为群聊
      this.currentSelectedFriend = null; // 当前选中的好友，用于发送消息

      // 朋友圈相关
      this.friendsCircle = null;
      this.friendsCircleInitialized = false;

      // 实时监控相关
      this.realtimeMonitor = null;
      this.lastMessageCount = 0;
      this.lastMessageId = null;
      this.isAutoRenderEnabled = true;
      this.lastRenderTime = 0;
      this.renderCooldown = 1000; // 渲染冷却时间，避免过于频繁

      // 实时同步器集成
      this.realTimeSync = null;
      this.syncEnabled = true;

      // 增量渲染相关
      this.incrementalRenderer = null;
      this.useIncrementalRender = true; // 默认启用增量渲染
      this.fullRenderMode = false; // 是否使用全量渲染模式

      // 延迟渲染相关
      this.delayedRenderTimer = null; // 延迟渲染定时器
      this.delayedRenderDelay = 2000; // 延迟2秒

      this.init();
    }

    init() {
      console.log('[Message App] 信息应用初始化开始');

      // 立即绑定事件（包括返回按钮）
      this.bindEvents();

      // 使用异步初始化，避免阻塞界面渲染
      setTimeout(() => {
        this.loadFriendRenderer();
      }, 50);

      setTimeout(() => {
        this.setupIncrementalRenderer();
      }, 100);

      setTimeout(() => {
        this.setupRealtimeMonitor();
      }, 5000); // 修复：增加延迟时间到5秒，给SillyTavern更多加载时间

      console.log('[Message App] 信息应用初始化完成');

      // 延迟集成实时同步器
      setTimeout(() => {
        this.integrateRealTimeSync();
      }, 2000);

      // 延迟初始化朋友圈功能
      setTimeout(() => {
        this.initFriendsCircle();
      }, 1000);

      // 延迟加载附件发送器（静默加载，不显示面板）
      setTimeout(() => {
        this.loadAttachmentSenderSilently();
      }, 1500);
    }

    // 设置增量渲染器
    setupIncrementalRenderer() {
      console.log('[Message App] 设置增量渲染器...');

      // 延迟创建增量渲染器，确保依赖已加载
      setTimeout(() => {
        this.createIncrementalRenderer();
      }, 500);
    }

    // 创建增量渲染器
    createIncrementalRenderer() {
      try {
        // @ts-ignore - 使用类型断言访问全局对象
        if (window['IncrementalRenderer']) {
          // @ts-ignore - 使用类型断言创建实例
          this.incrementalRenderer = new window['IncrementalRenderer']();

          // 监听增量更新事件
          window.addEventListener('incrementalRenderUpdate', event => {
            // @ts-ignore - 事件类型断言
            this.handleIncrementalUpdate(event.detail);
          });

          console.log('[Message App] ✅ 增量渲染器已创建');
        } else {
          console.log('[Message App] IncrementalRenderer 暂不可用，将稍后重试');
          this.useIncrementalRender = false;
        }
      } catch (error) {
        console.warn('[Message App] 创建增量渲染器失败:', error);
        this.useIncrementalRender = false;
      }
    }

    // 处理增量更新
    handleIncrementalUpdate(detail) {
      if (window.DEBUG_MESSAGE_APP) {
        console.log('[Message App] 收到增量更新:', detail);
      }

      if (!this.useIncrementalRender) {
        return;
      }

      // 支持两种数据格式：旧的detail格式和新的SillyTavern事件格式
      if (detail.eventType && detail.chatData) {
        // 新格式：来自SillyTavern事件
        console.log('[Message App] 处理SillyTavern事件格式的增量更新');

        // 如果有增量渲染器，让它处理新消息
        if (this.incrementalRenderer && detail.chatData.messages) {
          try {
            // 将SillyTavern的消息格式传递给增量渲染器
            this.incrementalRenderer.processNewMessages(detail.chatData.messages);
          } catch (error) {
            console.error('[Message App] 增量渲染器处理失败:', error);
          }
        }

        // 更新界面
        this.updateMessageListIncrementally();
      } else {
        // 旧格式：兼容性处理
        console.log('[Message App] 处理传统格式的增量更新');
        this.updateMessageListIncrementally();
      }
    }

    // 增量更新消息列表
    updateMessageListIncrementally() {
      try {
        console.log('[Message App] 🔄 开始增量更新消息列表...');

        // 如果当前不在消息列表页面，跳过更新
        if (this.currentView !== 'list') {
          console.log('[Message App] 当前不在消息列表页面，跳过更新');
          return;
        }

        // 获取消息列表容器
        const messageListContainer = document.querySelector('.message-list');
        if (!messageListContainer) {
          console.warn('[Message App] 找不到消息列表容器');
          return;
        }

        // 重新渲染整个好友列表
        this.refreshFriendListUI();

        console.log('[Message App] ✅ 消息列表已增量更新');
      } catch (error) {
        console.error('[Message App] 增量更新消息列表失败:', error);
      }
    }

    // 刷新好友列表UI
    refreshFriendListUI() {
      try {
        if (window.DEBUG_MESSAGE_APP) {
          console.log('[Message App] 🔄 刷新好友列表UI...');
        }

        // 获取消息列表容器
        const messageListContainer = document.querySelector('.message-list');
        if (!messageListContainer) {
          console.warn('[Message App] 找不到消息列表容器');
          return;
        }

        // 检查好友渲染器是否可用
        if (typeof window.renderFriendsFromContext !== 'function') {
          console.warn('[Message App] 好友渲染器不可用，尝试重新加载...');
          this.loadFriendRenderer();
          return;
        }

        // 重新渲染好友列表
        const friendsHTML = window.renderFriendsFromContext();
        messageListContainer.innerHTML = friendsHTML;

        // 重新绑定事件
        this.bindMessageListEvents();

        console.log('[Message App] ✅ 好友列表UI已刷新');
      } catch (error) {
        console.error('[Message App] 刷新好友列表UI失败:', error);
      }
    }

    // 更新项目未读计数
    updateItemUnreadCount(item) {
      try {
        const unreadElement = item.querySelector('.unread-count');
        if (unreadElement) {
          // 这里可以添加实际的未读计数逻辑
          // 暂时保持现有显示
        }
      } catch (error) {
        console.error('[Message App] 更新未读计数失败:', error);
      }
    }

    // 更新项目时间显示
    updateItemTimeDisplay(item) {
      try {
        const timeElement = item.querySelector('.time');
        if (timeElement) {
          // 更新为当前时间
          timeElement.textContent = new Date().toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          });
        }
      } catch (error) {
        console.error('[Message App] 更新时间显示失败:', error);
      }
    }

    // 设置实时监控
    setupRealtimeMonitor() {
      console.log('[Message App] 设置SillyTavern原生事件监控...');

      // 使用SillyTavern的原生事件系统
      this.setupSillyTavernEventListeners();
    }

    // 集成实时同步器
    integrateRealTimeSync() {
      try {
        console.log('[Message App] 🔗 集成实时同步器...');

        // 初始化重试计数器
        if (!this.syncRetryCount) {
          this.syncRetryCount = 0;
        }

        // 检查实时同步器是否可用
        if (!window.realTimeSync) {
          this.syncRetryCount++;

          if (this.syncRetryCount <= 3) {
            // 最多重试3次
            console.warn(`[Message App] 实时同步器不可用，第${this.syncRetryCount}次重试...`);

            // 尝试动态加载实时同步器
            this.loadRealTimeSyncModule();

            setTimeout(() => {
              this.integrateRealTimeSync();
            }, 3000);
          } else {
            console.error('[Message App] ❌ 实时同步器加载失败，已达到最大重试次数');
            this.setupFallbackSync(); // 启用备用同步机制
          }
          return;
        }

        // 重置重试计数器
        this.syncRetryCount = 0;

        // @ts-ignore - 实时同步器类型声明
        this.realTimeSync = window.realTimeSync;

        // 监听实时同步事件
        window.addEventListener('realTimeSyncUpdate', event => {
          // @ts-ignore - 事件类型声明
          this.handleRealTimeSyncUpdate(event.detail);
        });

        console.log('[Message App] ✅ 实时同步器集成完成');
      } catch (error) {
        console.error('[Message App] 集成实时同步器失败:', error);
      }
    }

    // 动态加载实时同步器模块
    loadRealTimeSyncModule() {
      try {
        console.log('[Message App] 🔄 尝试动态加载实时同步器...');

        // 检查脚本是否已经存在
        const existingScript = document.querySelector('script[src*="real-time-sync.js"]');
        if (existingScript) {
          console.log('[Message App] 实时同步器脚本已存在');
          return;
        }

        // 创建脚本标签
        const script = document.createElement('script');
        script.src = 'scripts/extensions/third-party/mobile/app/real-time-sync.js';
        script.onload = () => {
          console.log('[Message App] ✅ 实时同步器脚本加载完成');
        };
        script.onerror = error => {
          console.error('[Message App] ❌ 实时同步器脚本加载失败:', error);
        };

        document.head.appendChild(script);
      } catch (error) {
        console.error('[Message App] 动态加载实时同步器失败:', error);
      }
    }

    // 设置备用同步机制
    setupFallbackSync() {
      try {
        console.log('[Message App] 🔄 启动备用同步机制...');

        // 使用简单的轮询机制
        if (this.fallbackSyncTimer) {
          clearInterval(this.fallbackSyncTimer);
        }

        this.fallbackSyncTimer = setInterval(() => {
          this.performFallbackSync();
        }, 5000); // 5秒轮询

        console.log('[Message App] ✅ 备用同步机制已启动');
      } catch (error) {
        console.error('[Message App] 备用同步机制启动失败:', error);
      }
    }

    // 执行备用同步
    async performFallbackSync() {
      try {
        // 只在消息列表页面执行同步
        if (this.currentView !== 'list') {
          return;
        }

        // 检查上下文是否有变化
        if (window.contextMonitor) {
          // @ts-ignore - 上下文监控器类型声明
          const chatData = await window.contextMonitor.getCurrentChatMessages();
          if (chatData && chatData.totalMessages !== this.lastMessageCount) {
            console.log('[Message App] 🔄 备用同步检测到消息变化，刷新列表');
            this.updateMessageListIncrementally();
            this.lastMessageCount = chatData.totalMessages;
          }
        }
      } catch (error) {
        console.error('[Message App] 备用同步执行失败:', error);
      }
    }

    // 处理实时同步更新
    handleRealTimeSyncUpdate(detail) {
      try {
        if (window.DEBUG_MESSAGE_APP) {
          console.log('[Message App] 📡 收到实时同步更新:', detail);
        }

        if (!this.syncEnabled) {
          return;
        }

        // 根据当前视图决定如何处理更新
        if (this.currentView === 'list') {
          // 在消息列表视图中，更新好友列表
          this.handleFriendListUpdate(detail);
        } else if (this.currentView === 'messageDetail') {
          // 在消息详情视图中，更新消息内容
          this.handleMessageDetailUpdate(detail);
        }
      } catch (error) {
        console.error('[Message App] 处理实时同步更新失败:', error);
      }
    }

    // 处理好友列表更新
    handleFriendListUpdate(detail) {
      try {
        console.log('[Message App] 👥 处理好友列表更新:', detail);

        // 检查是否有新的好友或消息
        if (detail.hasNewFriends || detail.hasNewMessages) {
          console.log('[Message App] 🔄 检测到新好友或消息，刷新好友列表');

          // 强制刷新好友列表UI
          this.refreshFriendListUI();
        } else {
          console.log('[Message App] 🔄 执行轻量级更新');

          // 只更新时间和计数等轻量级信息
          this.updateExistingItemsOnly();
        }
      } catch (error) {
        console.error('[Message App] 处理好友列表更新失败:', error);
      }
    }

    // 只更新现有项目的信息
    updateExistingItemsOnly() {
      try {
        const messageItems = document.querySelectorAll('.message-item');

        messageItems.forEach(item => {
          // 更新未读计数显示
          this.updateItemUnreadCount(item);

          // 更新时间显示
          this.updateItemTimeDisplay(item);
        });

        console.log('[Message App] ✅ 现有项目已更新');
      } catch (error) {
        console.error('[Message App] 更新现有项目失败:', error);
      }
    }

    // 处理消息详情更新
    handleMessageDetailUpdate(detail) {
      try {
        if (detail.hasNewMessages) {
          if (window.DEBUG_MESSAGE_APP) {
            console.log('[Message App] 💬 更新消息详情');
          }

          // 刷新消息详情页面
          this.refreshMessageDetail();
        }
      } catch (error) {
        console.error('[Message App] 处理消息详情更新失败:', error);
      }
    }

    // 启用/禁用实时同步
    setSyncEnabled(enabled) {
      this.syncEnabled = enabled;
      console.log(`[Message App] 实时同步 ${enabled ? '启用' : '禁用'}`);
    }

    // 获取实时同步状态
    getRealTimeSyncStatus() {
      return {
        syncEnabled: this.syncEnabled,
        hasRealTimeSync: !!this.realTimeSync,
        realTimeSyncStatus: this.realTimeSync ? this.realTimeSync.getSyncStatus() : null,
      };
    }

    // 设置SillyTavern事件监听器（使用Live App的成功模式）
    async setupSillyTavernEventListeners() {
      try {
        console.log('[Message App] 设置SillyTavern事件监听器...');

        // 使用新的智能检测系统
        const detectionResult = this.smartDetectEventSystem();
        if (detectionResult.found) {
          console.log('[Message App] ✅ 智能检测找到事件系统:', detectionResult);

          const eventSource = detectionResult.eventSource;
          const event_types = detectionResult.event_types;

          // 绑定消息接收事件
          if (event_types.MESSAGE_RECEIVED) {
            eventSource.on(event_types.MESSAGE_RECEIVED, this.onMessageReceived.bind(this));
            console.log('[Message App] ✅ 成功监听 MESSAGE_RECEIVED 事件');

            // 保存事件系统引用用于清理
            this.eventSource = eventSource;
            this.event_types = event_types;
            this.isEventListening = true;

            // 初始化消息计数
            this.updateMessageCount();
            return;
          }
        }

        // 修复：改进重试机制，增加重试次数和延迟时间
        if (!this.retryCount) this.retryCount = 0;
        this.retryCount++;

        if (this.retryCount <= 10) {
          // 从5次增加到10次
          console.log(`[Message App] 重试次数: ${this.retryCount}/10`);
          setTimeout(() => {
            this.setupSillyTavernEventListeners();
          }, 2000 + this.retryCount * 1000); // 增加延迟时间：2秒基础 + 递增1秒
        } else {
          console.warn('[Message App] 达到最大重试次数，但继续尝试事件监听...');
          // 修复：不立即回退到轮询，而是继续尝试事件监听
          setTimeout(() => {
            this.retryCount = 0; // 重置重试计数
            this.setupSillyTavernEventListeners();
          }, 10000); // 10秒后重新开始尝试
        }
        return;
      } catch (error) {
        console.error('[Message App] 设置SillyTavern事件监听器失败:', error);
        this.fallbackToPolling();
      }
    }

    // 智能检测事件系统（使用Live App的成功模式）
    smartDetectEventSystem() {
      console.log('[Message App] 🧠 开始智能检测事件系统...');

      const detectionMethods = [
        // 方法1: 使用SillyTavern.getContext().eventSource（推荐，Live App验证成功）
        () => {
          if (
            typeof window !== 'undefined' &&
            window.SillyTavern &&
            typeof window.SillyTavern.getContext === 'function'
          ) {
            const context = window.SillyTavern.getContext();
            if (context && context.eventSource && typeof context.eventSource.on === 'function' && context.event_types) {
              return {
                eventSource: context.eventSource,
                event_types: context.event_types,
                foundIn: 'SillyTavern.getContext()',
              };
            }
          }
          return null;
        },

        // 方法2: 使用全局 eventOn 函数（Live App验证成功）
        () => {
          if (typeof eventOn === 'function' && typeof tavern_events !== 'undefined' && tavern_events.MESSAGE_RECEIVED) {
            return {
              eventSource: { on: eventOn, off: eventOff || (() => {}) },
              event_types: tavern_events,
              foundIn: 'global eventOn',
            };
          }
          return null;
        },

        // 方法3: 使用父窗口 eventSource（Live App验证成功）
        () => {
          if (
            typeof window !== 'undefined' &&
            window.parent &&
            window.parent.eventSource &&
            typeof window.parent.eventSource.on === 'function'
          ) {
            if (window.parent.event_types && window.parent.event_types.MESSAGE_RECEIVED) {
              return {
                eventSource: window.parent.eventSource,
                event_types: window.parent.event_types,
                foundIn: 'parent.eventSource',
              };
            }
          }
          return null;
        },
      ];

      for (let i = 0; i < detectionMethods.length; i++) {
        try {
          const result = detectionMethods[i]();
          if (result && result.eventSource && result.event_types) {
            console.log(`[Message App] ✅ 方法${i + 1}检测成功:`, result);
            return {
              found: true,
              method: i + 1,
              ...result,
            };
          }
        } catch (error) {
          console.warn(`[Message App] 方法${i + 1}检测失败:`, error);
        }
      }

      console.warn('[Message App] ❌ 所有检测方法都失败了');
      return { found: false };
    }

    /**
     * 获取当前消息数量（使用正确的API）
     */
    getCurrentMessageCount() {
      try {
        // 方法1: 使用SillyTavern.getContext().chat（正确的接口）
        if (
          typeof window !== 'undefined' &&
          window.SillyTavern &&
          typeof window.SillyTavern.getContext === 'function'
        ) {
          const context = window.SillyTavern.getContext();
          if (context && context.chat && Array.isArray(context.chat)) {
            const count = context.chat.length;
            return count;
          }
        }

        // 方法2: 使用mobileContextEditor作为备用
        const mobileContextEditor = window['mobileContextEditor'];
        if (mobileContextEditor && typeof mobileContextEditor.getCurrentChatData === 'function') {
          const chatData = mobileContextEditor.getCurrentChatData();
          if (chatData && chatData.messages && Array.isArray(chatData.messages)) {
            return chatData.messages.length;
          }
        }

        // 方法3: 尝试从父窗口获取chat变量
        if (typeof window !== 'undefined' && window.parent && window.parent.chat && Array.isArray(window.parent.chat)) {
          const count = window.parent.chat.length;
          return count;
        }

        return 0;
      } catch (error) {
        console.warn('[Message App] 获取消息数量失败:', error);
        return 0;
      }
    }

    /**
     * 更新消息计数
     */
    updateMessageCount() {
      this.lastMessageCount = this.getCurrentMessageCount();
      console.log(`[Message App] 初始化消息计数: ${this.lastMessageCount}`);
    }

    /**
     * 处理消息接收事件
     */
    async onMessageReceived(messageId) {
      try {
        if (window.DEBUG_MESSAGE_APP) {
          console.log(`[Message App] 🎯 接收到消息事件，ID: ${messageId}`);
        }

        // 检查消息数量变化
        const currentMessageCount = this.getCurrentMessageCount();

        if (currentMessageCount <= this.lastMessageCount) {
          return;
        }

        console.log(`[Message App] ✅ 新消息: ${this.lastMessageCount} → ${currentMessageCount}`);
        this.lastMessageCount = currentMessageCount;

        // 延迟2秒后触发渲染
        this.scheduleDelayedRender('接收到消息');
      } catch (error) {
        console.error('[Message App] 处理消息接收事件失败:', error);
      }
    }

    // 处理SillyTavern消息事件
    handleSillyTavernMessage(eventType, messageId) {
      if (!this.isAutoRenderEnabled) {
        return;
      }

      // 防抖处理 - 对群聊消息使用更短的冷却时间
      const now = Date.now();
      const cooldownTime = this.isGroupMessageEvent(eventType, messageId)
        ? Math.min(this.renderCooldown, 500)
        : this.renderCooldown;

      if (now - this.lastRenderTime < cooldownTime) {
        return;
      }

      this.lastRenderTime = now;

      console.log(`[Message App] 处理SillyTavern消息事件: ${eventType}, messageId: ${messageId}`);

      // 获取最新的聊天数据
      const chatData = this.getSillyTavernChatData();
      if (!chatData) {
        console.warn('[Message App] 无法获取SillyTavern聊天数据');
        return;
      }

      // 检查是否包含群聊消息
      const hasGroupMessage = this.checkForGroupMessagesInChatData(chatData);
      if (hasGroupMessage) {
        console.log('[Message App] 🔄 检测到群聊消息，强制触发实时渲染');
        // 对群聊消息使用强制全量渲染，确保实时更新
        this.forceGroupChatRender();
      }

      // 更新内部状态
      this.lastMessageCount = chatData.messages.length;
      this.lastMessageId = chatData.lastMessageId;

      // 根据渲染模式选择处理方式
      if (this.useIncrementalRender && this.incrementalRenderer && !hasGroupMessage) {
        console.log('[Message App] 使用增量渲染处理SillyTavern事件');
        this.handleIncrementalUpdate({
          eventType,
          messageId,
          chatData,
          timestamp: now,
        });
      } else {
        console.log('[Message App] 使用全量渲染处理SillyTavern事件');
        this.triggerAutoRender();
      }

      // 发送自定义事件
      this.dispatchSillyTavernSyncEvent(eventType, messageId, chatData);
    }

    // 检查是否为群聊消息事件
    isGroupMessageEvent(eventType, messageId) {
      try {
        const chatData = this.getSillyTavernChatData();
        if (!chatData || !chatData.messages || chatData.messages.length === 0) {
          return false;
        }

        // 检查最近的消息是否包含群聊格式
        const recentMessages = chatData.messages.slice(-3); // 检查最近3条消息
        return recentMessages.some(message => {
          if (message.mes && typeof message.mes === 'string') {
            return message.mes.includes('[群聊消息|') || message.mes.includes('[我方群聊消息|');
          }
          return false;
        });
      } catch (error) {
        console.error('[Message App] 检查群聊消息事件失败:', error);
        return false;
      }
    }

    // 检查聊天数据中是否包含群聊消息
    checkForGroupMessagesInChatData(chatData) {
      try {
        if (!chatData || !chatData.messages || chatData.messages.length === 0) {
          return false;
        }

        // 检查最新的几条消息
        const recentMessages = chatData.messages.slice(-5);
        const hasGroupMessages = recentMessages.some(message => {
          if (message.mes && typeof message.mes === 'string') {
            // 检查各种群聊消息格式
            const groupPatterns = [
              /\[群聊消息\|[^|]+\|[^|]+\|[^|]+\|[^\]]+\]/,
              /\[我方群聊消息\|我\|[^|]+\|[^|]+\|[^\]]+\]/,
              /\[群聊\|[^|]+\|[^|]+\|[^\]]+\]/,
            ];

            return groupPatterns.some(pattern => pattern.test(message.mes));
          }
          return false;
        });

        if (hasGroupMessages) {
          console.log('[Message App] 📱 在聊天数据中检测到群聊消息');
        }

        return hasGroupMessages;
      } catch (error) {
        console.error('[Message App] 检查聊天数据中的群聊消息失败:', error);
        return false;
      }
    }

    // 强制群聊渲染
    forceGroupChatRender() {
      try {
        console.log('[Message App] 🔄 执行强制群聊渲染...');

        // 1. 清除任何缓存
        if (this.incrementalRenderer) {
          this.incrementalRenderer.clearCache();
        }

        // 2. 强制刷新好友渲染器
        if (window.friendRenderer && typeof window.friendRenderer.refresh === 'function') {
          window.friendRenderer.refresh();
        }

        // 3. 根据当前视图执行对应的强制渲染
        if (this.currentView === 'list') {
          // 强制刷新消息列表
          setTimeout(() => {
            this.forceRefreshMessageList();
          }, 100);
        } else if (this.currentView === 'messageDetail' && this.currentFriendId) {
          // 强制刷新消息详情
          setTimeout(() => {
            this.forceRefreshMessageDetail();
          }, 100);
        }

        // 4. 重置冷却时间，允许快速更新
        this.lastRenderTime = Date.now() - this.renderCooldown;

        console.log('[Message App] ✅ 强制群聊渲染完成');
      } catch (error) {
        console.error('[Message App] 强制群聊渲染失败:', error);
      }
    }

    // 强制刷新消息列表
    forceRefreshMessageList() {
      try {
        console.log('[Message App] 🔄 强制刷新消息列表...');

        const messageList = document.getElementById('message-list');
        if (messageList && window.renderFriendsFromContext) {
          // 添加加载提示
          const loadingDiv = document.createElement('div');
          loadingDiv.className = 'group-loading-hint';
          loadingDiv.innerHTML = '🔄 更新群聊消息...';
          loadingDiv.style.cssText = `
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: #2196F3;
                    color: white;
                    padding: 8px 12px;
                    border-radius: 15px;
                    font-size: 12px;
                    z-index: 1000;
                    animation: pulse 0.5s ease-in-out;
                `;
          messageList.appendChild(loadingDiv);

          // 获取新的HTML内容
          const newFriendsHtml = window.renderFriendsFromContext();
          messageList.innerHTML = newFriendsHtml;

          // 重新绑定事件
          this.bindMessageListEvents();

          // 移除加载提示
          setTimeout(() => {
            if (loadingDiv.parentNode) {
              loadingDiv.remove();
            }
          }, 1000);

          console.log('[Message App] ✅ 消息列表强制刷新完成');
        }
      } catch (error) {
        console.error('[Message App] 强制刷新消息列表失败:', error);
      }
    }

    // 强制刷新消息详情
    forceRefreshMessageDetail() {
      try {
        console.log('[Message App] 🔄 强制刷新消息详情...');

        if (this.currentView === 'messageDetail' && this.currentFriendId) {
          // 重新加载消息详情
          this.loadMessageDetailAsync();
          console.log('[Message App] ✅ 消息详情强制刷新完成');
        }
      } catch (error) {
        console.error('[Message App] 强制刷新消息详情失败:', error);
      }
    }

    // 处理聊天切换事件
    handleChatChanged(chatId) {
      console.log('[Message App] 聊天已切换:', chatId);

      // 重置状态
      this.lastMessageCount = 0;
      this.lastMessageId = null;

      // 如果使用增量渲染，清除缓存
      if (this.incrementalRenderer) {
        this.incrementalRenderer.clearCache();
      }

      // 触发界面更新
      if (this.currentView === 'list') {
        this.triggerAutoRender();
      }
    }

    // 获取SillyTavern聊天数据（使用正确的API）
    getSillyTavernChatData() {
      try {
        // 优先使用SillyTavern.getContext().chat
        if (
          typeof window !== 'undefined' &&
          window.SillyTavern &&
          typeof window.SillyTavern.getContext === 'function'
        ) {
          const context = window.SillyTavern.getContext();
          if (context && context.chat && Array.isArray(context.chat)) {
            const messages = context.chat;
            const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

            return {
              messages: messages,
              messageCount: messages.length,
              lastMessageId: lastMessage ? lastMessage.send_date || lastMessage.id || messages.length - 1 : null,
              currentCharacter:
                context.characters && context.this_chid !== undefined ? context.characters[context.this_chid] : null,
              userName: context.name1 || 'User',
              characterName: context.name2 || 'Assistant',
            };
          }
        }

        // 尝试从全局变量获取（备用方案）
        const chat = window['chat'];
        if (chat && Array.isArray(chat)) {
          const messages = chat;
          const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

          return {
            messages: messages,
            messageCount: messages.length,
            lastMessageId: lastMessage ? lastMessage.send_date || lastMessage.id || messages.length - 1 : null,
            currentCharacter:
              window['characters'] && window['this_chid'] !== undefined
                ? window['characters'][window['this_chid']]
                : null,
            userName: window['name1'] || 'User',
            characterName: window['name2'] || 'Assistant',
          };
        }

        return null;
      } catch (error) {
        console.error('[Message App] 获取SillyTavern聊天数据失败:', error);
        return null;
      }
    }

    // 发送SillyTavern同步事件
    dispatchSillyTavernSyncEvent(eventType, messageId, chatData) {
      try {
        const event = new CustomEvent('messageAppSillyTavernSync', {
          detail: {
            eventType,
            messageId,
            chatData,
            timestamp: Date.now(),
            view: this.currentView,
            renderMode: this.useIncrementalRender ? 'incremental' : 'full',
          },
        });
        window.dispatchEvent(event);
      } catch (error) {
        console.error('[Message App] 发送SillyTavern同步事件失败:', error);
      }
    }

    // 修复：延迟回退到轮询模式，给事件监听更多机会
    fallbackToPolling() {
      console.warn('[Message App] 事件监听失败，延迟启动轮询备选方案...');

      // 延迟启动轮询，给事件系统更多时间初始化
      setTimeout(() => {
        // 再次尝试事件监听
        this.retryCount = 0;
        this.setupSillyTavernEventListeners();
      }, 15000); // 15秒后再次尝试事件监听

      // 如果确实需要轮询，也要延迟启动
      setTimeout(() => {
        if (!this.isEventListening) {
          console.warn('[Message App] 最终启动轮询备选方案');
          this.startSimplePolling();
        }
      }, 30000); // 30秒后如果事件监听仍未成功，才启动轮询
    }

    // 启动实时监控
    startRealtimeMonitor() {
      // 这个方法现在由setupSillyTavernEventListeners处理
      console.log('[Message App] startRealtimeMonitor已被setupSillyTavernEventListeners替代');
    }

    // 简单轮询备选方案
    startSimplePolling() {
      console.log('[Message App] 启动简单轮询监控（备选方案）...');

      setInterval(() => {
        this.checkForNewMessages();
      }, 2000); // 降低轮询频率，因为这只是备选方案
    }

    // 检查新消息（轮询方式）
    checkForNewMessages() {
      try {
        const chatData = this.getSillyTavernChatData();
        if (!chatData) {
          return;
        }

        // 检查是否有新消息
        if (
          chatData.messageCount > this.lastMessageCount ||
          (chatData.lastMessageId && chatData.lastMessageId !== this.lastMessageId)
        ) {
          console.log('[Message App] 轮询检测到新消息:', {
            oldCount: this.lastMessageCount,
            newCount: chatData.messageCount,
            oldId: this.lastMessageId,
            newId: chatData.lastMessageId,
          });

          // 更新记录
          this.lastMessageCount = chatData.messageCount;
          this.lastMessageId = chatData.lastMessageId;

          // 触发处理
          this.handleSillyTavernMessage('polling_detected', chatData.messageCount - 1);
        }
      } catch (error) {
        console.error('[Message App] 轮询检查新消息失败:', error);
      }
    }

    // 获取当前消息数量
    getCurrentMessageCount() {
      try {
        if (chat && Array.isArray(chat)) {
          return chat.length;
        }

        // 尝试从SillyTavern上下文获取
        const sillyTavern = window['SillyTavern'];
        if (sillyTavern && typeof sillyTavern.getContext === 'function') {
          const context = sillyTavern.getContext();
          if (context && context.chat) {
            return context.chat.length;
          }
        }

        return 0;
      } catch (error) {
        console.error('[Message App] 获取消息数量失败:', error);
        return 0;
      }
    }

    // 获取最后一条消息ID
    getCurrentLastMessageId() {
      try {
        if (chat && Array.isArray(chat) && chat.length > 0) {
          const lastMessage = chat[chat.length - 1];
          return lastMessage.send_date || lastMessage.id || JSON.stringify(lastMessage).substring(0, 50);
        }

        // 尝试从SillyTavern上下文获取
        const sillyTavern = window['SillyTavern'];
        if (sillyTavern && typeof sillyTavern.getContext === 'function') {
          const context = sillyTavern.getContext();
          if (context && context.chat && context.chat.length > 0) {
            const lastMessage = context.chat[context.chat.length - 1];
            return lastMessage.send_date || lastMessage.id || JSON.stringify(lastMessage).substring(0, 50);
          }
        }

        return null;
      } catch (error) {
        console.error('[Message App] 获取最后消息ID失败:', error);
        return null;
      }
    }

    // 处理上下文变化
    handleContextChange() {
      if (!this.isAutoRenderEnabled) {
        return;
      }

      const now = Date.now();

      // 检查渲染冷却时间
      if (now - this.lastRenderTime < this.renderCooldown) {
        return;
      }

      this.lastRenderTime = now;

      console.log('[Message App] 上下文变化，触发自动渲染...');

      // 根据渲染模式选择不同的处理方式
      if (this.useIncrementalRender && this.incrementalRenderer) {
        // 使用增量渲染（不会造成界面跳动）
        console.log('[Message App] 使用增量渲染模式');
        // 增量渲染器会自动处理新消息，这里只需要轻量级的界面更新
        this.triggerLightweightUpdate();
      } else {
        // 使用传统全量渲染
        console.log('[Message App] 使用全量渲染模式');
        this.triggerAutoRender();
      }
    }

    // 触发轻量级更新（不重新渲染，只更新状态）
    triggerLightweightUpdate() {
      try {
        console.log('[Message App] 执行轻量级更新...');

        // 1. 更新消息计数（不重新渲染列表）
        if (this.currentView === 'list') {
          this.updateMessageCountsOnly();
        }

        // 2. 如果在消息详情页面，检查是否有新消息需要追加
        if (this.currentView === 'messageDetail' && this.currentFriendId) {
          this.checkForNewMessagesInCurrentChat();
        }

        // 3. 触发轻量级事件通知
        this.dispatchLightweightRenderEvent();

        console.log('[Message App] ✅ 轻量级更新完成');
      } catch (error) {
        console.error('[Message App] 轻量级更新失败:', error);
      }
    }

    // 仅更新消息计数
    updateMessageCountsOnly() {
      try {
        const messageItems = document.querySelectorAll('.message-item');

        messageItems.forEach(item => {
          // 更新未读计数样式
          const unreadCount = item.querySelector('.unread-count');
          if (unreadCount) {
            // 添加"有新消息"的视觉提示
            unreadCount.classList.add('has-new-message');

            // 3秒后移除提示
            setTimeout(() => {
              unreadCount.classList.remove('has-new-message');
            }, 3000);
          }

          // 更新时间显示为"刚刚"
          const timeElement = item.querySelector('.time');
          if (timeElement) {
            timeElement.textContent = '刚刚';
            timeElement.classList.add('just-updated');

            // 5秒后恢复正常时间显示
            setTimeout(() => {
              timeElement.classList.remove('just-updated');
              timeElement.textContent = new Date().toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
              });
            }, 5000);
          }
        });

        console.log('[Message App] ✅ 消息计数已更新');
      } catch (error) {
        console.error('[Message App] 更新消息计数失败:', error);
      }
    }

    // 检查当前聊天的新消息
    checkForNewMessagesInCurrentChat() {
      try {
        // 这里可以添加检查当前聊天是否有新消息的逻辑
        // 如果有新消息，可以在聊天界面底部显示提示
        const messageContainer = document.querySelector('.message-detail-content');
        if (messageContainer) {
          // 添加新消息提示
          const newMessageHint = document.createElement('div');
          newMessageHint.className = 'new-message-hint';
          newMessageHint.innerHTML = '💬 有新消息';
          newMessageHint.style.cssText = `
                    position: absolute;
                    bottom: 20px;
                    right: 20px;
                    background: #2196F3;
                    color: white;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-size: 12px;
                    animation: fadeInOut 3s ease-in-out;
                `;

          messageContainer.appendChild(newMessageHint);

          // 3秒后自动移除
          setTimeout(() => {
            if (newMessageHint.parentNode) {
              newMessageHint.parentNode.removeChild(newMessageHint);
            }
          }, 3000);
        }
      } catch (error) {
        console.error('[Message App] 检查新消息失败:', error);
      }
    }

    // 派发轻量级渲染事件
    dispatchLightweightRenderEvent() {
      try {
        const event = new CustomEvent('messageAppLightweightRender', {
          detail: {
            timestamp: Date.now(),
            view: this.currentView,
            mode: 'incremental',
            friendId: this.currentFriendId,
            selectedFriend: this.currentSelectedFriend,
          },
        });
        window.dispatchEvent(event);
      } catch (error) {
        console.error('[Message App] 派发轻量级渲染事件失败:', error);
      }
    }

    // 触发自动渲染
    async triggerAutoRender() {
      try {
        // 1. 更新好友列表渲染
        await this.updateFriendListRender();

        // 2. 如果当前在消息列表页面，刷新列表
        if (this.currentView === 'list') {
          this.refreshMessageList();
        }

        // 3. 如果当前在消息详情页面，刷新详情
        if (this.currentView === 'messageDetail' && this.currentFriendId) {
          this.refreshMessageDetail();
        }

        // 4. 触发自定义事件，通知其他组件
        this.dispatchRenderEvent();

        console.log('[Message App] ✅ 自动渲染完成');
      } catch (error) {
        console.error('[Message App] 自动渲染失败:', error);
      }
    }

    // 更新好友列表渲染
    async updateFriendListRender() {
      try {
        if (window.renderFriendsFromContext) {
          // 更新好友渲染器的数据
          if (this.friendRenderer && typeof this.friendRenderer.refresh === 'function') {
            await this.friendRenderer.refresh();
          }
        }
      } catch (error) {
        console.error('[Message App] 更新好友列表渲染失败:', error);
      }
    }

    // 刷新消息列表
    refreshMessageList() {
      try {
        if (this.currentView === 'list') {
          const messageList = document.getElementById('message-list');
          if (messageList && window.renderFriendsFromContext) {
            const newFriendsHtml = window.renderFriendsFromContext();
            messageList.innerHTML = newFriendsHtml;

            // 重新绑定事件
            this.bindMessageListEvents();
          }
        }
      } catch (error) {
        console.error('[Message App] 刷新消息列表失败:', error);
      }
    }

    // 刷新消息详情
    refreshMessageDetail() {
      try {
        if (this.currentView === 'messageDetail' && this.currentFriendId) {
          // 重新加载消息详情
          this.loadMessageDetailAsync();
        }
      } catch (error) {
        console.error('[Message App] 刷新消息详情失败:', error);
      }
    }

    // 绑定消息列表事件
    bindMessageListEvents() {
      const messageItems = document.querySelectorAll('.message-item');
      messageItems.forEach(item => {
        item.addEventListener('click', e => {
          const target = e.currentTarget;
          const friendId = target && target.getAttribute ? target.getAttribute('data-friend-id') : null;
          if (friendId) {
            this.selectFriend(friendId);
          }
        });
      });
    }

    // 派发渲染事件
    dispatchRenderEvent() {
      try {
        const event = new CustomEvent('messageAppRender', {
          detail: {
            timestamp: Date.now(),
            view: this.currentView,
            friendId: this.currentFriendId,
            selectedFriend: this.currentSelectedFriend,
          },
        });
        window.dispatchEvent(event);
      } catch (error) {
        console.error('[Message App] 派发渲染事件失败:', error);
      }
    }

    // 启用/禁用自动渲染
    setAutoRenderEnabled(enabled) {
      this.isAutoRenderEnabled = enabled;
      console.log(`[Message App] 自动渲染 ${enabled ? '启用' : '禁用'}`);
    }

    // 设置渲染冷却时间
    setRenderCooldown(ms) {
      this.renderCooldown = ms;
      console.log(`[Message App] 渲染冷却时间设置为 ${ms}ms`);
    }

    // 停止实时监控
    stopRealtimeMonitor() {
      if (this.realtimeMonitor && typeof this.realtimeMonitor.stop === 'function') {
        this.realtimeMonitor.stop();
        console.log('[Message App] 实时监控已停止');
      }
    }

    // 获取监控状态
    getMonitorStatus() {
      return {
        isEnabled: this.isAutoRenderEnabled,
        hasMonitor: !!this.realtimeMonitor,
        isRunning: this.realtimeMonitor?.isRunning || false,
        lastMessageCount: this.lastMessageCount,
        lastMessageId: this.lastMessageId,
        lastRenderTime: this.lastRenderTime,
        renderCooldown: this.renderCooldown,
        // 增量渲染状态
        useIncrementalRender: this.useIncrementalRender,
        hasIncrementalRenderer: !!this.incrementalRenderer,
        incrementalStatus: this.incrementalRenderer?.getStatus() || null,
        fullRenderMode: this.fullRenderMode,
      };
    }

    // 切换渲染模式
    toggleRenderMode() {
      this.useIncrementalRender = !this.useIncrementalRender;
      this.fullRenderMode = !this.useIncrementalRender;

      if (this.useIncrementalRender) {
        console.log('[Message App] 🔄 已切换到增量渲染模式（防跳动）');
        this.renderCooldown = 3000; // 增加冷却时间
      } else {
        console.log('[Message App] 🔄 已切换到全量渲染模式（实时更新）');
        this.renderCooldown = 1000; // 恢复原来的冷却时间
      }

      return this.useIncrementalRender;
    }

    // 启用增量渲染
    enableIncrementalRender() {
      this.useIncrementalRender = true;
      this.fullRenderMode = false;
      this.renderCooldown = 3000;

      if (this.incrementalRenderer) {
        this.incrementalRenderer.setEnabled(true);
      }

      console.log('[Message App] ✅ 增量渲染已启用');
    }

    // 禁用增量渲染
    disableIncrementalRender() {
      this.useIncrementalRender = false;
      this.fullRenderMode = true;
      this.renderCooldown = 1000;

      if (this.incrementalRenderer) {
        this.incrementalRenderer.setEnabled(false);
      }

      console.log('[Message App] ⚠️ 增量渲染已禁用，使用全量渲染');
    }

    // 强制全量渲染
    forceFullRender() {
      console.log('[Message App] 🔄 执行强制全量渲染...');

      // 临时禁用增量渲染
      const originalMode = this.useIncrementalRender;
      this.useIncrementalRender = false;

      // 执行全量渲染
      this.triggerAutoRender();

      // 恢复原来的模式
      setTimeout(() => {
        this.useIncrementalRender = originalMode;
      }, 1000);
    }

    // 清除增量渲染缓存
    clearIncrementalCache() {
      if (this.incrementalRenderer) {
        this.incrementalRenderer.clearCache();
        console.log('[Message App] 🗑️ 增量渲染缓存已清除');
      }
    }

    // 获取渲染性能统计
    getRenderPerformanceStats() {
      const stats = {
        renderMode: this.useIncrementalRender ? 'incremental' : 'full',
        renderCooldown: this.renderCooldown,
        lastRenderTime: this.lastRenderTime,
        renderCount: 0, // 可以添加计数器
        incrementalStats: null,
      };

      if (this.incrementalRenderer) {
        stats.incrementalStats = this.incrementalRenderer.getStatus();
      }

      return stats;
    }

    /**
     * 延迟触发渲染（2秒后）
     * 用于消息发送和接收后的自动刷新
     */
    scheduleDelayedRender(reason = '未知原因') {
      // 清除之前的定时器
      if (this.delayedRenderTimer) {
        clearTimeout(this.delayedRenderTimer);
      }

      console.log(`[Message App] ⏰ 计划在${this.delayedRenderDelay / 1000}秒后渲染 (原因: ${reason})`);

      // 设置新的延迟渲染定时器
      this.delayedRenderTimer = setTimeout(async () => {
        console.log(`[Message App] 🎯 执行延迟渲染 (原因: ${reason})`);
        await this.triggerAutoRender();
        this.delayedRenderTimer = null;
      }, this.delayedRenderDelay);
    }

    /**
     * 取消延迟渲染
     */
    cancelDelayedRender() {
      if (this.delayedRenderTimer) {
        clearTimeout(this.delayedRenderTimer);
        this.delayedRenderTimer = null;
        console.log('[Message App] ❌ 取消延迟渲染');
      }
    }

    // 加载好友渲染器
    async loadFriendRenderer() {
      if (window.friendRenderer) {
        this.friendRenderer = window.friendRenderer;
        console.log('[Message App] 好友渲染器已加载');
        return;
      }

      // 如果还没有加载，等待一下
      setTimeout(() => {
        // @ts-ignore - 好友渲染器类型声明
        if (window.friendRenderer) {
          // @ts-ignore - 好友渲染器类型声明
          this.friendRenderer = window.friendRenderer;
          console.log('[Message App] 好友渲染器延迟加载完成');
        } else {
          console.log('[Message App] 好友渲染器暂不可用');
        }
      }, 100);
    }

    // 初始化朋友圈功能
    initFriendsCircle() {
      try {
        console.log('[Message App] 初始化朋友圈功能...');

        // 如果已经初始化过，直接返回
        if (this.friendsCircle && this.friendsCircleInitialized) {
          console.log('[Message App] 朋友圈已初始化，跳过重复初始化');
          return;
        }

        // 检查是否已有全局朋友圈实例
        if (window.friendsCircle && !this.friendsCircle) {
          console.log('[Message App] 使用现有的全局朋友圈实例');
          this.friendsCircle = window.friendsCircle;
          this.friendsCircleInitialized = true;
          return;
        }

        // 检查朋友圈类是否已加载
        if (typeof window.FriendsCircle === 'undefined') {
          console.warn('[Message App] 朋友圈模块未加载，延迟初始化');
          setTimeout(() => {
            this.initFriendsCircle();
          }, 1000);
          return;
        }

        // 只有在没有实例时才创建新实例
        if (!this.friendsCircle) {
          console.log('[Message App] 创建新的朋友圈实例');
          this.friendsCircle = new window.FriendsCircle();
          this.friendsCircleInitialized = true;

          // 导出到全局，供其他组件使用
          window.friendsCircle = this.friendsCircle;

          // 监听朋友圈更新事件（只绑定一次）
          if (!this.friendsCircleEventBound) {
            window.addEventListener('friendsCircleUpdate', event => {
              this.handleFriendsCircleUpdate(event.detail);
            });
            this.friendsCircleEventBound = true;
          }
        }

        console.log('[Message App] 朋友圈功能初始化完成');
      } catch (error) {
        console.error('[Message App] 朋友圈功能初始化失败:', error);
      }
    }

    // 处理朋友圈更新事件
    handleFriendsCircleUpdate(detail) {
      try {
        if (this.currentMainTab === 'circle' && this.currentView === 'list') {
          // 如果当前在朋友圈页面，刷新界面
          this.updateAppContent();
        }
      } catch (error) {
        console.error('[Message App] 处理朋友圈更新失败:', error);
      }
    }

    // 切换主要页面标签
    async switchMainTab(tabName) {
      console.log(`[Message App] 切换主要标签页: ${tabName}`);
      this.currentMainTab = tabName;

      if (tabName === 'circle') {
        // 切换到朋友圈
        await this.showFriendsCircle();
      } else {
        // 切换到好友列表
        this.showMessageList();
      }
    }

    // 显示好友列表页面
    showMessageList() {
      console.log('[Message App] 显示好友列表页面');
      this.currentMainTab = 'friends';
      this.currentView = 'list';

      // 停用朋友圈功能
      if (this.friendsCircle) {
        this.friendsCircle.deactivate();
      }

      // 更新界面
      this.updateAppContent();

      // 通知主框架更新应用状态
      if (window.mobilePhone) {
        const messageState = {
          app: 'messages',
          view: 'messageList',
          title: '信息',
          showBackButton: false,
          showAddButton: true,
          addButtonIcon: 'fas fa-plus',
          addButtonAction: () => {
            if (window.messageApp) {
              window.messageApp.showAddFriend();
            }
          },
        };
        window.mobilePhone.currentAppState = messageState;
        window.mobilePhone.updateAppHeader(messageState);
      }
    }

    // 显示朋友圈页面
    async showFriendsCircle() {
      console.log('[Message App] 显示朋友圈页面');
      this.currentMainTab = 'circle';
      this.currentView = 'list';

      // 确保朋友圈已初始化
      if (!this.friendsCircle) {
        console.log('[Message App] 朋友圈未初始化，尝试初始化...');

        // 首先检查是否有全局实例
        if (window.friendsCircle) {
          console.log('[Message App] 使用现有的全局朋友圈实例');
          this.friendsCircle = window.friendsCircle;
        } else {
          // 如果没有全局实例，才创建新的
          this.initFriendsCircle();

          // 等待朋友圈初始化完成
          let retryCount = 0;
          while (!this.friendsCircle && retryCount < 10) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retryCount++;
          }

          if (!this.friendsCircle) {
            console.error('[Message App] 朋友圈初始化失败');
            this.updateAppContent();
            return;
          }
        }
      }

      // 激活朋友圈功能
      this.friendsCircle.activate();

      // 等待朋友圈数据加载完成
      try {
        await this.friendsCircle.refreshFriendsCircle();
      } catch (error) {
        console.error('[Message App] 朋友圈数据加载失败:', error);
      }

      // 更新界面
      this.updateAppContent();

      // 通知主框架更新应用状态
      if (window.mobilePhone) {
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
        window.mobilePhone.currentAppState = circleState;
        window.mobilePhone.updateAppHeader(circleState);
      }
    }

    // 获取应用内容
    getAppContent() {
      switch (this.currentView) {
        case 'list':
          if (this.currentMainTab === 'circle') {
            return this.renderFriendsCircle();
          } else {
            return this.renderMessageList();
          }
        case 'addFriend':
          return this.renderAddFriend();
        case 'messageDetail':
          return this.renderMessageDetail();
        default:
          return this.renderMessageList();
      }
    }

    // 渲染朋友圈页面
    renderFriendsCircle() {
      if (!this.friendsCircle || !this.friendsCircle.renderer) {
        return `
          <div class="friends-circle-loading">
            <div class="loading-spinner">
              <i class="fas fa-spinner fa-spin"></i>
            </div>
            <div class="loading-text">朋友圈加载中...</div>
          </div>
          ${this.renderTabSwitcher()}
        `;
      }

      const circleContent = this.friendsCircle.renderer.renderFriendsCirclePage();
      return `
        <div class="messages-app">
          ${circleContent}
          ${this.renderTabSwitcher()}
        </div>
      `;
    }

    // 渲染底部切换栏
    renderTabSwitcher() {
      return `
        <div class="message-tab-switcher">
          <button class="tab-btn ${this.currentMainTab === 'friends' ? 'active' : ''}"
                  onclick="window.messageApp?.switchMainTab('friends')">
            <i class="fas fa-user-friends"></i>
            <span>好友</span>
          </button>
          <button class="tab-btn ${this.currentMainTab === 'circle' ? 'active' : ''}"
                  onclick="window.messageApp?.switchMainTab('circle')">
            <i class="fas fa-globe"></i>
            <span>朋友圈</span>
          </button>
        </div>
      `;
    }

    // 渲染消息列表
    renderMessageList() {
      // 使用好友渲染器从上下文中提取好友信息
      let friendsHtml = '';

      // @ts-ignore - 好友渲染器类型声明
      if (window.renderFriendsFromContext) {
        // @ts-ignore - 好友渲染器类型声明
        friendsHtml = window.renderFriendsFromContext();
      } else {
        friendsHtml = `
                <div class="empty-state">
                    <div class="empty-icon">💬</div>
                    <div class="empty-text">暂无好友</div>
                    <div class="empty-hint">点击右上角"添加"按钮添加好友</div>
                </div>
            `;
      }

      setTimeout(() => this.applyModernLayout(), 50);
      
      return `
            <div class="messages-app">
                <div class="message-list" id="message-list">
                    ${friendsHtml}
                </div>
                ${this.renderTabSwitcher()}
            </div>
        `;
    }

applyModernLayout() {
    const listContainer = document.getElementById('message-list');
    if (!listContainer) return;

    const timeMap = {};
    const orderMap = {};
    
    // --- 核心修复 1：定义数据来源 ---
    // 尝试获取永久联系人（从你注入的系统里取，如果没有就给个空对象）
    const permanentContacts = (typeof PERMANENT_CONTACTS !== 'undefined') ? PERMANENT_CONTACTS : {};
    
    // 尝试获取抓取到的好友数据
    const extractedFriends = (window.friendRenderer && typeof window.friendRenderer.extractFriendsFromContext === 'function') 
                            ? window.friendRenderer.extractFriendsFromContext() : [];
    
    // 将抓取到的数据存入一个 Map 方便查找，同时处理报错隐患
    const friendsDataMap = new Map(extractedFriends.map(f => [f.number, f]));
    
    // 1. 获取数据并建立初始权重
    extractedFriends.forEach(f => {
        orderMap[f.number] = f.messageIndex || 0;
        if (f.lastMessageTime) {
            timeMap[f.number] = f.lastMessageTime;
        } else if (f.addTime) {
            const d = new Date(f.addTime);
            timeMap[f.number] = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        } else {
            timeMap[f.number] = "08:00";
        }
    });

    // 2. 扫描 DOM 校准权重（这部分保留，用于实时更新排序）
    const mesBlocks = document.querySelectorAll('.mes');
    mesBlocks.forEach(block => {
        const text = block.innerText;
        const mesId = parseInt(block.getAttribute('mesid') || 0); 
        const timeMatch = text.match(/\[时间\|(\d{1,2}:\d{2})\]/);
        const idMatch = text.match(/\|(\d+)\|/);
        
        if (idMatch) {
            const id = idMatch[1];
            if (timeMatch) timeMap[id] = timeMatch[1];
            const isPeer = text.includes('[对方消息|');
            const newWeight = isPeer ? (100000 + mesId) : mesId;
            if (!orderMap[id] || newWeight > orderMap[id]) {
                orderMap[id] = newWeight;
            }
        }
    });

    window.latestOrderMap = orderMap;

    // 3. 执行排序
    const items = Array.from(listContainer.querySelectorAll('.message-item'));
    items.sort((a, b) => {
        const weightA = orderMap[a.getAttribute('data-friend-id')] || 0;
        const weightB = orderMap[b.getAttribute('data-friend-id')] || 0;
        return weightB - weightA;
    });
    
    items.forEach(item => listContainer.appendChild(item));

    // 4. 渲染时间戳和红点
    items.forEach(item => {
        const id = item.getAttribute('data-friend-id');
        
        // --- 核心修复 2：安全地获取数据 ---
        // 依次从 抓取数据、永久联系人 中寻找配置
        const dataFromContext = friendsDataMap.get(id);
        const dataFromPermanent = permanentContacts[id];
        
        // 如果两个地方都找不到，给一个默认对象防止报错
        const data = dataFromContext || dataFromPermanent || { number: id, name: "未知好友" };

        const time = data.lastMessageTime || timeMap[id] || "08:00";
        const latestOrder = data.messageIndex || orderMap[id] || 0;
        const lastReadOrder = parseInt(localStorage.getItem(`lastRead_${id}`) || 0);

        // --- 时间显示 ---
        let timeSpan = item.querySelector('.custom-timestamp');
        if (time) {
            if (!timeSpan) {
                timeSpan = document.createElement('span');
                timeSpan.className = 'custom-timestamp';
                item.appendChild(timeSpan);
            }
            timeSpan.innerText = time;
        }

        // --- 红点逻辑 ---
        item.querySelectorAll('.unread-dot, .unread-dot-custom').forEach(d => d.remove());
        
        // 只要有新消息权重（latestOrder > lastReadOrder）就显示红点
        if (latestOrder > lastReadOrder) {
            let dot = document.createElement('div');
            dot.className = 'unread-dot'; 
            item.appendChild(dot);
        }

        // --- 绑定点击已读逻辑 ---
        if (!item.dataset.layoutListener) {
            item.dataset.layoutListener = "true";
            item.addEventListener('click', () => {
                localStorage.setItem(`lastRead_${id}`, latestOrder);
                const d = item.querySelector('.unread-dot');
                if (d) d.remove();
                console.log(`[Message App] 已将好友 ${id} 标记为已读，权重: ${latestOrder}`);
            });
        }
    });
}
    
    // 渲染添加好友界面
    renderAddFriend() {
      return `
            <div class="add-friend-app">
                <!-- Tab导航 -->
                <div class="tab-navigation">
                    <button class="tab-btn ${this.currentTab === 'add' ? 'active' : ''}" data-tab="add">
                        <span class="tab-icon"></span>
                        <span>添加</span>
                    </button>
                    <button class="tab-btn ${this.currentTab === 'delete' ? 'active' : ''}" data-tab="delete">
                        <span class="tab-icon"></span>
                        <span>删除</span>
                    </button>
                    <button class="tab-btn ${this.currentTab === 'createGroup' ? 'active' : ''}" data-tab="createGroup">
                        <span class="tab-icon"></span>
                        <span>创群</span>
                    </button>
                    <button class="tab-btn ${this.currentTab === 'deleteGroup' ? 'active' : ''}" data-tab="deleteGroup">
                        <span class="tab-icon"></span>
                        <span>删群</span>
                    </button>
                </div>

                <!-- Tab内容 -->
                <div class="m-tab-content">
                    ${this.renderCurrentTabContent()}
                </div>
            </div>
        `;
    }

    // 渲染当前tab内容
    renderCurrentTabContent() {
      switch (this.currentTab) {
        case 'add':
          return this.renderAddFriendTab();
        case 'delete':
          return this.renderDeleteFriendTab();
        case 'createGroup':
          return this.renderCreateGroupTab();
        case 'deleteGroup':
          return this.renderDeleteGroupTab();
        default:
          return this.renderAddFriendTab();
      }
    }

    // 渲染添加好友tab
renderAddFriendTab() {
      // 先从保险箱拿名单
      let savedFriends = [];
      try {
        savedFriends = JSON.parse(localStorage.getItem('permanent_friends') || "[]");
      } catch(e) {}

      // 生成管理列表的HTML（如果没有好友就不显示）
      let managementHtml = '';
      if (savedFriends.length > 0) {
        managementHtml = `
          <div class="permanent-management" style="margin-top: 15px; border-top: 1px dashed #ccc; padding-top: 10px;">
            <div style="font-size: 12px; font-weight: bold; color: #666; margin-bottom: 8px;">永久名单管理 (删除后需刷新页面)</div>
            ${savedFriends.map((f, index) => {
              const match = f.match(/\[好友id\|([^|]*)\|(\d+)\]/);
              const name = match ? match[1] : '未知';
              return `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; background: rgba(0,0,0,0.03); padding: 4px 8px; border-radius: 4px;">
                  <span style="font-size: 12px;">👤 ${name}</span>
                  <button class="delete-permanent-btn" data-index="${index}" style="background: #ff4d4f; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-size: 10px;">删除</button>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }

      return `
            <div class="add-friend-form">
                <div class="form-group">
                    <label for="friend-name">好友名称</label>
                    <input type="text" id="friend-name" class="form-input" placeholder="请输入好友名称">
                </div>
                <div class="form-group">
                    <label for="friend-number">数字ID</label>
                    <input type="number" id="friend-number" class="form-input" placeholder="请输入数字ID">
                </div>
                
                <div class="form-group" style="display: flex; align-items: center; gap: 8px; margin: 5px 0 15px 0; padding: 5px; background: rgba(0,0,0,0.05); border-radius: 4px;">
                    <input type="checkbox" id="make-permanent-checkbox" style="width: 18px; height: 18px; cursor: pointer; accent-color: #007bff; -webkit-appearance: checkbox !important; appearance: checkbox !important;">
                    <label for="make-permanent-checkbox" style="cursor: pointer; font-size: 13px; color: #555; margin-bottom: 0;">同步到永久通讯录</label>
                </div>

                <button class="add-friend-submit" id="add-friend-submit">
                    <span class="submit-icon">✅</span>
                    <span>添加好友</span>
                </button>
                
                ${managementHtml}
            </div>
            <div class="add-friend-tips">
                <div class="tip-item">
                    <span class="tip-icon">💡</span>
                    <span>添加后，即使删除消息记录好友也会留下</span>
                </div>
            </div>
        `;
    }
    
    // 渲染删除好友tab
    renderDeleteFriendTab() {
      return `
            <div class="delete-friend-content">
                <div class="delete-friend-header">
                    <div class="delete-info">
                        <span class="delete-icon">⚠️</span>
                        <span>选择要删除的好友</span>
                    </div>
                    <button class="refresh-friend-list" id="refresh-friend-list">
                        <span class="refresh-icon">🔄</span>
                        <span>刷新</span>
                    </button>
                </div>
                <div class="delete-friend-list" id="delete-friend-list">
                    ${this.renderDeleteFriendList()}
                </div>
                <div class="delete-friend-tips">
                    <div class="tip-item">
                        <span class="tip-icon">⚠️</span>
                        <span>删除好友会移除所有相关消息记录</span>
                    </div>
                    <div class="tip-item">
                        <span class="tip-icon">🔍</span>
                        <span>从上下文中查找并删除所有匹配的好友信息</span>
                    </div>
                </div>
            </div>
        `;
    }

    // 渲染删除好友列表
    renderDeleteFriendList() {
      if (!window.friendRenderer) {
        return `
                <div class="loading-state">
                    <div class="loading-icon">⏳</div>
                    <div class="loading-text">正在加载好友列表...</div>
                </div>
            `;
      }

      try {
        const allContacts = window.friendRenderer.extractFriendsFromContext();
        // 只筛选出好友，过滤掉群聊
        const friends = allContacts.filter(contact => !contact.isGroup);

        if (friends.length === 0) {
          return `
                    <div class="empty-state">
                        <div class="empty-icon">👥</div>
                        <div class="empty-text">暂无好友</div>
                        <div class="empty-hint">请先添加好友</div>
                    </div>
                `;
        }

        const friendsHTML = friends
          .map(friend => {
            const avatar = this.getRandomAvatar();
            const timeStr = this.formatTime(friend.addTime);

            return `
                    <div class="delete-friend-item">
                        <div class="friend-info">
                            <div class="friend-avatar">${avatar}</div>
                            <div class="friend-details">
                                <div class="friend-name">${friend.name}</div>
                                <div class="friend-id">ID: ${friend.number}</div>
                                <div class="friend-time">添加时间: ${timeStr}</div>
                            </div>
                        </div>
                        <button class="delete-friend-btn" data-friend-id="${friend.number}" data-friend-name="${friend.name}">
                            <span class="delete-icon">❌</span>
                            <span>删除</span>
                        </button>
                    </div>
                `;
          })
          .join('');

        return friendsHTML;
      } catch (error) {
        console.error('[Message App] 渲染删除好友列表失败:', error);
        return `
                <div class="error-state">
                    <div class="error-icon">⚠️</div>
                    <div class="error-text">加载好友列表失败</div>
                    <div class="error-details">${error.message}</div>
                </div>
            `;
      }
    }

    // 渲染创建群聊tab
    renderCreateGroupTab() {
      return `
            <div class="create-group-form">
                <div class="form-group">
                    <label for="group-name">群聊名称</label>
                    <input type="text" id="group-name" class="form-input" placeholder="请输入群聊名称">
                </div>
                <div class="form-group">
                    <label for="group-id">群聊ID</label>
                    <input type="number" id="group-id" class="form-input" placeholder="请输入群聊ID">
                </div>
                <div class="form-group">
                    <label>选择群成员</label>
                    <div class="friends-selection-container">
                        <div class="friends-selection-header">
                            <span>可选好友 (点击选择)</span>
                            <button class="select-all-friends" id="select-all-friends">全选</button>
                        </div>
                        <div class="friends-selection-list" id="friends-selection-list">
                            ${this.renderFriendsSelection()}
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label>已选成员</label>
                    <div class="selected-members" id="selected-members">
                        <div class="selected-member default-member">
                            <span class="member-name">我</span>
                            <span class="member-type">(群主)</span>
                        </div>
                    </div>
                </div>
                <button class="create-group-submit" id="create-group-submit">
                    <span class="submit-icon">✅</span>
                    <span>创建群聊</span>
                </button>
            </div>
            <div class="create-group-tips">
                <div class="tip-item">
                    <span class="tip-icon">💡</span>
                    <span>创建群聊后，信息会自动编辑到最新楼层</span>
                </div>
                <div class="tip-item">
                    <span class="tip-icon">📝</span>
                    <span>格式：[群聊|群名|群ID|群成员]</span>
                </div>
            </div>
        `;
    }

    // 渲染删除群聊tab
    renderDeleteGroupTab() {
      return `
            <div class="delete-group-content">
                <div class="delete-group-header">
                    <div class="delete-info">
                        <span class="delete-icon">⚠️</span>
                        <span>选择要删除的群聊</span>
                    </div>
                    <button class="refresh-group-list" id="refresh-group-list">
                        <span class="refresh-icon">🔄</span>
                        <span>刷新</span>
                    </button>
                </div>
                <div class="delete-group-list" id="delete-group-list">
                    ${this.renderDeleteGroupList()}
                </div>
                <div class="delete-group-tips">
                    <div class="tip-item">
                        <span class="tip-icon">⚠️</span>
                        <span>删除群聊会移除所有相关消息记录</span>
                    </div>
                    <div class="tip-item">
                        <span class="tip-icon">🔍</span>
                        <span>从上下文中查找并删除所有匹配的群聊信息</span>
                    </div>
                </div>
            </div>
        `;
    }

    // 渲染好友选择列表
    renderFriendsSelection() {
      try {
        if (!window.friendRenderer) {
          console.warn('[Message App] friendRenderer未加载，显示占位符');
          return `
                    <div class="loading-state">
                        <div class="loading-icon">⏳</div>
                        <div class="loading-text">正在加载好友列表...</div>
                    </div>
                `;
        }

        const friends = window.friendRenderer.extractFriendsFromContext();

        if (!friends || friends.length === 0) {
          return `
                    <div class="empty-state">
                        <div class="empty-icon">👥</div>
                        <div class="empty-text">暂无好友</div>
                        <div class="empty-hint">请先添加好友</div>
                    </div>
                `;
        }

        const friendsHTML = friends
          .map(friend => {
            try {
              const avatar = this.getRandomAvatar();
              const friendName = friend.name || '未知好友';
              const friendNumber = friend.number || '未知';

              return `
                        <div class="friend-selection-item" data-friend-id="${friendNumber}" data-friend-name="${friendName}">
                            <div class="friend-checkbox">
                                <input type="checkbox" id="friend-${friendNumber}" class="friend-checkbox-input">
                                <label for="friend-${friendNumber}" class="friend-checkbox-label"></label>
                            </div>
                            <div class="friend-info">
                                <div class="friend-avatar">${avatar}</div>
                                <div class="friend-details">
                                    <div class="friend-name">${friendName}</div>
                                    <div class="friend-id">ID: ${friendNumber}</div>
                                </div>
                            </div>
                        </div>
                    `;
            } catch (itemError) {
              console.error('[Message App] 渲染单个好友项失败:', itemError, friend);
              return ''; // 跳过有问题的好友项
            }
          })
          .filter(html => html)
          .join(''); // 过滤掉空的html

        return (
          friendsHTML ||
          `
                <div class="error-state">
                    <div class="error-icon">⚠️</div>
                    <div class="error-text">好友列表渲染失败</div>
                    <div class="error-hint">请刷新重试</div>
                </div>
            `
        );
      } catch (error) {
        console.error('[Message App] 渲染好友选择列表失败:', error);
        return `
                <div class="error-state">
                    <div class="error-icon">⚠️</div>
                    <div class="error-text">加载好友列表失败</div>
                    <div class="error-details">${error.message}</div>
                </div>
            `;
      }
    }

    // 渲染删除群聊列表
    renderDeleteGroupList() {
      // 返回加载占位符，然后异步加载群聊数据
      setTimeout(async () => {
        await this.loadDeleteGroupListAsync();
      }, 100);

      return `
            <div class="loading-state">
                <div class="loading-icon">⏳</div>
                <div class="loading-text">正在加载群聊列表...</div>
            </div>
        `;
    }

    // 异步加载删除群聊列表
    async loadDeleteGroupListAsync() {
      try {
        // 获取群聊列表（从上下文中提取）
        const groups = await this.extractGroupsFromContext();

        const deleteGroupListContainer = document.querySelector('#delete-group-list');
        if (!deleteGroupListContainer) {
          return;
        }

        if (groups.length === 0) {
          deleteGroupListContainer.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">👥</div>
                        <div class="empty-text">暂无群聊</div>
                        <div class="empty-hint">请先创建群聊</div>
                    </div>
                `;
          return;
        }

        const groupsHTML = groups
          .map(group => {
            const avatar = '👥';
            const timeStr = this.formatTime(group.addTime);

            return `
                    <div class="delete-group-item">
                        <div class="group-info">
                            <div class="group-avatar">${avatar}</div>
                            <div class="group-details">
                                <div class="group-name">${group.name}</div>
                                <div class="group-id">群ID: ${group.id}</div>
                                <div class="group-members">成员: ${group.members}</div>
                                <div class="group-time">创建时间: ${timeStr}</div>
                            </div>
                        </div>
                        <button class="delete-group-btn" data-group-id="${group.id}" data-group-name="${group.name}">
                            <span class="delete-icon">❌</span>
                            <span>删除</span>
                        </button>
                    </div>
                `;
          })
          .join('');

        deleteGroupListContainer.innerHTML = groupsHTML;

        // 重新绑定删除群聊事件
        this.bindDeleteGroupEvents(document);
      } catch (error) {
        console.error('[Message App] 加载删除群聊列表失败:', error);
        const deleteGroupListContainer = document.querySelector('#delete-group-list');
        if (deleteGroupListContainer) {
          deleteGroupListContainer.innerHTML = `
                    <div class="error-state">
                        <div class="error-icon">⚠️</div>
                        <div class="error-text">加载群聊列表失败</div>
                        <div class="error-details">${error.message}</div>
                    </div>
                `;
        }
      }
    }

    // 从上下文提取群聊信息
    async extractGroupsFromContext() {
      try {
        if (!window.contextMonitor) {
          console.warn('[Message App] 上下文监控器不可用');
          return [];
        }

        // 获取聊天消息
        const chatData = await window.contextMonitor.getCurrentChatMessages();
        if (!chatData || !chatData.messages) {
          console.warn('[Message App] 无法获取聊天消息');
          return [];
        }

        const groups = [];
        const groupRegex = /\[群聊\|([^|]+)\|([^|]+)\|([^\]]+)\]/g;

        // 遍历所有消息，查找群聊信息
        chatData.messages.forEach((message, messageIndex) => {
          if (message.mes && typeof message.mes === 'string') {
            let match;
            while ((match = groupRegex.exec(message.mes)) !== null) {
              const [fullMatch, groupName, groupId, members] = match;

              // 检查是否已存在（避免重复）
              if (!groups.find(g => g.id === groupId)) {
                groups.push({
                  name: groupName,
                  id: groupId,
                  members: members,
                  addTime: message.send_date || Date.now(),
                  messageIndex: messageIndex,
                });
              }
            }
            // 重置正则表达式
            groupRegex.lastIndex = 0;
          }
        });

        console.log(`[Message App] 找到 ${groups.length} 个群聊`);
        return groups;
      } catch (error) {
        console.error('[Message App] 提取群聊信息失败:', error);
        return [];
      }
    }

    // 格式化时间
    formatTime(timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) {
        return '刚刚';
      } else if (diffMins < 60) {
        return `${diffMins}分钟前`;
      } else if (diffHours < 24) {
        return `${diffHours}小时前`;
      } else if (diffDays < 7) {
        return `${diffDays}天前`;
      } else {
        return date.toLocaleDateString('zh-CN', {
          month: 'short',
          day: 'numeric',
        });
      }
    }

// 绑定事件
  bindEvents() {
    const appContent = document.getElementById('app-content');
    if (!appContent) return;

    // 绑定返回按钮事件
    const backButton = document.getElementById('back-button');
    if (backButton) {
      backButton.removeEventListener('click', this.handleBackButtonClick);
      this.handleBackButtonClick = () => {
        const currentApp = window.mobilePhone?.currentAppState?.app;
        if (currentApp !== 'messages') {
          console.log('[Message App] 当前不在消息应用中，跳过返回按钮处理');
          return;
        }
        console.log('[Message App] 返回按钮被点击');
        this.showMessageList();
      };
      backButton.addEventListener('click', this.handleBackButtonClick);
    }

    // 添加好友按钮 (进入添加界面)
    const addFriendBtn = appContent.querySelector('#add-friend-btn');
    if (addFriendBtn) {
      addFriendBtn.addEventListener('click', () => {
        this.showAddFriend();
      });
    }

    // Tab切换按钮
    const tabBtns = appContent.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        const tabName = e.currentTarget.getAttribute('data-tab');
        if (tabName) {
          console.log(`[Message App] Tab切换: ${tabName}`);
          this.switchTab(tabName);
        }
      });
    });

    // ==========================================
    // ✨ 新增：永久通讯录逻辑 (提交与删除)
    // ==========================================
    const submitBtn = appContent.querySelector('#add-friend-submit');
    const permanentCheckbox = appContent.querySelector('#make-permanent-checkbox');

    if (permanentCheckbox) {
      permanentCheckbox.onchange = () => {
        console.log('🔘 永久同步勾选状态:', permanentCheckbox.checked);
      };
    }

    if (submitBtn) {
      submitBtn.onclick = () => {
        if (permanentCheckbox && permanentCheckbox.checked) {
          const fName = appContent.querySelector('#friend-name')?.value;
          const fId = appContent.querySelector('#friend-number')?.value;
          if (fName && fId) {
            try {
              const friendInfo = `[好友id|${fName}|${fId}]`;
              let friends = JSON.parse(localStorage.getItem('permanent_friends') || "[]");
              if (!friends.includes(friendInfo)) {
                friends.push(friendInfo);
                localStorage.setItem('permanent_friends', JSON.stringify(friends));
                console.log('%c✨ 写入永久通讯录成功!', 'color: #00ff00; font-weight: bold;');
              }
            } catch (e) {
              console.error('写入保险箱失败:', e);
            }
          }
        }
        // 执行原有的添加逻辑
        this.addFriend();
      };
    }

    const deletePermBtns = appContent.querySelectorAll('.delete-permanent-btn');
    deletePermBtns.forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const index = btn.getAttribute('data-index');
        try {
          let friends = JSON.parse(localStorage.getItem('permanent_friends') || "[]");
          friends.splice(index, 1);
          localStorage.setItem('permanent_friends', JSON.stringify(friends));
          alert('已移除该永久好友！');
          const addTabBtn = document.querySelector('.tab-item[data-tab="add"]');
          if (addTabBtn) addTabBtn.click();
        } catch (err) {
          console.error('删除永久好友出错:', err);
        }
      };
    });
    // ==========================================

    // 刷新好友列表按钮
    const refreshBtn = appContent.querySelector('#refresh-friend-list');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.refreshDeleteFriendList();
      });
    }

    // 删除好友按钮 (原生逻辑)
    const deleteFriendBtns = appContent.querySelectorAll('.delete-friend-btn');
    deleteFriendBtns.forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget;
        const friendId = target.getAttribute('data-friend-id');
        const friendName = target.getAttribute('data-friend-name');
        if (friendId && friendName) {
          this.deleteFriend(friendId, friendName);
        }
      });
    });

    // 创建群聊相关事件
    this.bindCreateGroupEvents(appContent);

    // 删除群聊相关事件
    this.bindDeleteGroupEvents(appContent);

    // 好友列表点击事件
    const messageItems = appContent.querySelectorAll('.message-item');
    messageItems.forEach(item => {
      item.addEventListener('click', e => {
        const target = e.currentTarget;
        const friendId = target && target.getAttribute ? target.getAttribute('data-friend-id') : null;
        if (friendId) {
          this.selectFriend(friendId);
        }
      });
    });

    // 绑定发送相关事件
    this.bindSendEvents();

    // 绑定消息详情页面的发送事件
    this.bindDetailSendEvents();
  }

    // 绑定发送相关事件
    bindSendEvents() {
      if (this.currentView !== 'list') return;

      const appContent = document.getElementById('app-content');
      if (!appContent) return;

      // 获取发送相关元素
      const sendInput = appContent.querySelector('#message-send-input');
      const sendButton = appContent.querySelector('#send-message-btn');
      const emojiBtn = appContent.querySelector('#send-emoji-btn');
      const stickerBtn = appContent.querySelector('#send-sticker-btn');
      const voiceBtn = appContent.querySelector('#send-voice-btn');
      const redpackBtn = appContent.querySelector('#send-redpack-btn');

      // 确保MessageSender已加载
      if (!window.messageSender) {
        console.warn('[Message App] MessageSender未加载，延迟绑定事件');
        setTimeout(() => this.bindSendEvents(), 1000);
        return;
      }

      // 输入框事件
      if (sendInput) {
        // 自动调整高度
        sendInput.addEventListener('input', () => {
          window.messageSender.adjustTextareaHeight(sendInput);
          this.updateCharCount(sendInput);
        });

        // 回车发送
        sendInput.addEventListener('keydown', e => {
          window.messageSender.handleEnterSend(e, sendInput);
        });
      }

      // 发送按钮事件
      if (sendButton) {
        sendButton.addEventListener('click', async () => {
          if (sendInput && this.currentSelectedFriend) {
            const message = sendInput.value.trim();
            if (message) {
              const success = await window.messageSender.sendMessage(message);
              if (success) {
                sendInput.value = '';
                window.messageSender.adjustTextareaHeight(sendInput);
                this.updateCharCount(sendInput);

                // 发送成功后延迟2秒触发渲染
                this.scheduleDelayedRender('发送消息');
              }
            }
          }
        });
      }

      // 特殊功能按钮事件
      if (emojiBtn) {
        emojiBtn.addEventListener('click', () => {
          this.showEmojiPanel();
        });
      }

      if (stickerBtn) {
        stickerBtn.addEventListener('click', () => {
          this.showStickerPanel();
        });
      }

      if (voiceBtn) {
        voiceBtn.addEventListener('click', () => {
          this.showVoicePanel();
        });
      }

      if (redpackBtn) {
        redpackBtn.addEventListener('click', () => {
          this.showRedpackPanel();
        });
      }
    }

    // 绑定消息详情页面的发送事件
    bindDetailSendEvents() {
      if (this.currentView !== 'messageDetail') return;

      const appContent = document.getElementById('app-content');
      if (!appContent) return;

      // 获取消息详情页面的发送相关元素
      const detailInput = appContent.querySelector('#message-detail-input');
      const detailSendBtn = appContent.querySelector('#detail-send-btn');
      const detailToolToggleBtn = appContent.querySelector('#detail-tool-toggle-btn');
      const detailEmojiBtn = appContent.querySelector('#detail-emoji-btn');
      const detailStickerBtn = appContent.querySelector('#detail-sticker-btn');
      const detailVoiceBtn = appContent.querySelector('#detail-voice-btn');
      const detailRedpackBtn = appContent.querySelector('#detail-redpack-btn');
      const detailAttachmentBtn = appContent.querySelector('#detail-attachment-btn');

      // 确保MessageSender已加载
      if (!window.messageSender) {
        console.warn('[Message App] MessageSender未加载，延迟绑定详情页面事件');
        setTimeout(() => this.bindDetailSendEvents(), 1000);
        return;
      }

      // 设置当前聊天对象
      if (this.currentFriendId) {
        // 根据currentSelectedFriend或从DOM判断是否为群聊
        const isGroup = this.isCurrentChatGroup();
        window.messageSender.setCurrentChat(this.currentFriendId, this.currentFriendName, isGroup);
      }

      // 输入框事件
      if (detailInput) {
        // 自动调整高度
        detailInput.addEventListener('input', () => {
          window.messageSender.adjustTextareaHeight(detailInput);
          this.updateCharCount(detailInput);
        });

        // 回车发送
        detailInput.addEventListener('keydown', e => {
          window.messageSender.handleEnterSend(e, detailInput);
        });
      }

      // 发送按钮事件
      if (detailSendBtn) {
        detailSendBtn.addEventListener('click', async () => {
          if (detailInput && this.currentFriendId) {
            const message = detailInput.value.trim();
            if (message) {
              const success = await window.messageSender.sendMessage(message);
              if (success) {
                detailInput.value = '';
                window.messageSender.adjustTextareaHeight(detailInput);
                this.updateCharCount(detailInput);

                // 发送成功后延迟2秒触发渲染
                this.scheduleDelayedRender('发送消息（详情页）');
              }
            }
          }
        });
      }

      // 工具切换按钮事件
      if (detailToolToggleBtn) {
        detailToolToggleBtn.addEventListener('click', () => {
          this.toggleToolsFloatingPanel();
        });
      }

      // 特殊功能按钮事件
      if (detailEmojiBtn) {
        detailEmojiBtn.addEventListener('click', () => {
          this.showEmojiPanel();
        });
      }

      if (detailStickerBtn) {
        detailStickerBtn.addEventListener('click', () => {
          this.showStickerPanel();
        });
      }

      if (detailVoiceBtn) {
        detailVoiceBtn.addEventListener('click', () => {
          this.showVoicePanel();
        });
      }

      if (detailRedpackBtn) {
        detailRedpackBtn.addEventListener('click', () => {
          this.showRedpackPanel();
        });
      }

      if (detailAttachmentBtn) {
        detailAttachmentBtn.addEventListener('click', () => {
          console.log('[Message App] 🔍 附件按钮被点击');
          this.showAttachmentPanel();
        });
      }
    }

    // 选择好友
    selectFriend(friendId) {
      try {
        // 获取好友信息
        let friendName = null;
        let isGroup = false;

        if (window.friendRenderer) {
          const friend = window.friendRenderer.getFriendById(friendId);
          friendName = friend ? friend.name : `好友 ${friendId}`;
          isGroup = friend ? friend.isGroup : false;
        } else {
          friendName = `好友 ${friendId}`;
        }

        // 保存群聊状态
        this.currentIsGroup = isGroup;

        // 直接进入聊天详情页面
        this.showMessageDetail(friendId, friendName);
      } catch (error) {
        console.error('[Message App] 选择好友失败:', error);
      }
    }

    // 判断当前聊天是否为群聊
    isCurrentChatGroup() {
      // 优先使用保存的状态
      if (this.currentIsGroup !== undefined) {
        return this.currentIsGroup;
      }

      // 从DOM元素判断
      const messageItem = document.querySelector(`[data-friend-id="${this.currentFriendId}"]`);
      if (messageItem) {
        const isGroupAttr = messageItem.getAttribute('data-is-group');
        return isGroupAttr === 'true';
      }

      // 从friend renderer判断
      if (window.friendRenderer) {
        const friend = window.friendRenderer.getFriendById(this.currentFriendId);
        return friend ? friend.isGroup : false;
      }

      return false;
    }

    // 更新字数统计
    updateCharCount(inputElement) {
      const appContent = document.getElementById('app-content');
      if (!appContent) return;

      let charCountElement = appContent.querySelector('.char-count');
      if (!charCountElement) {
        // 创建字数统计元素
        charCountElement = document.createElement('div');
        charCountElement.className = 'char-count';
        const sendArea = appContent.querySelector('.message-send-area');
        if (sendArea) {
          sendArea.appendChild(charCountElement);
        }
      }

      const currentLength = inputElement.value.length;
      const maxLength = inputElement.maxLength || 1000;

      charCountElement.textContent = `${currentLength}/${maxLength}`;

      // 根据字数设置样式
      if (currentLength > maxLength * 0.9) {
        charCountElement.className = 'char-count error';
      } else if (currentLength > maxLength * 0.7) {
        charCountElement.className = 'char-count warning';
      } else {
        charCountElement.className = 'char-count';
      }
    }

    // 显示表情面板
    showEmojiPanel() {
      const emojis = [
        '😀',
        '😃',
        '😄',
        '😁',
        '😆',
        '😅',
        '😂',
        '🤣',
        '😊',
        '😇',
        '🙂',
        '🙃',
        '😉',
        '😌',
        '😍',
        '🥰',
        '😘',
        '😗',
        '😙',
        '😚',
        '😋',
        '😛',
        '😝',
        '😜',
        '🤪',
        '🤨',
        '🧐',
        '🤓',
        '😎',
        '🤩',
        '🥳',
        '😏',
        '😒',
        '😞',
        '😔',
        '😟',
        '😕',
        '🙁',
        '☹️',
        '😣',
        '😖',
        '😫',
        '😩',
        '🥺',
        '😢',
        '😭',
        '😤',
        '😠',
        '😡',
        '🤬',
        '🤯',
        '😳',
        '🥵',
        '🥶',
        '😱',
        '😨',
        '😰',
        '😥',
        '😓',
        '🤗',
        '🤔',
        '🤭',
        '🤫',
        '🤥',
        '😶',
        '😐',
        '😑',
        '😬',
        '🙄',
        '😯',
        '😦',
        '😧',
        '😮',
        '😲',
        '🥱',
        '😴',
        '🤤',
        '😪',
        '😵',
        '🤐',
        '🥴',
        '🤢',
        '🤮',
        '🤧',
        '😷',
        '🤒',
        '🤕',
        '🤑',
        '🤠',
        '😈',
        '👿',
        '👹',
        '👺',
        '🤡',
        '💩',
        '👻',
        '💀',
        '☠️',
        '👽',
        '👾',
      ];

      const panel = document.createElement('div');
      panel.className = 'special-panel';
      panel.innerHTML = `
            <div class="special-panel-content">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3>选择表情</h3>
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background: none; border: none; font-size: 18px; cursor: pointer;">✕</button>
                </div>
                <div style="display: grid; grid-template-columns: repeat(10, 1fr); gap: 10px; max-height: 200px; overflow-y: auto;">
                    ${emojis
                      .map(
                        emoji => `
                        <button onclick="window.messageSender.insertSpecialFormat('emoji', {emoji: '${emoji}'}); this.parentElement.parentElement.parentElement.remove();"
                                style="background: none; border: 1px solid #ddd; border-radius: 8px; padding: 8px; cursor: pointer; font-size: 20px;">
                            ${emoji}
                        </button>
                    `,
                      )
                      .join('')}
                </div>
            </div>
        `;

      document.body.appendChild(panel);

      // 🔥 新增：记录表情包面板显示事件，用于调试
      console.log(`[Message App] 表情包面板已显示，包含 ${stickerImages.length} 个表情包`);
      if (stickerImages.length > 0 && stickerImages[0].fullPath) {
        console.log('[Message App] 使用世界书配置的表情包路径');
      } else {
        console.log('[Message App] 使用默认表情包配置');
      }
    }

    /**
     * 🔥 新增：从世界书读取表情包详情
     * 查找名为"表情包详情"的世界书条目，解析前缀和后缀，生成完整的图片路径
     */
    async getStickerImagesFromWorldInfo() {
      console.log('[Message App] 开始从世界书读取表情包详情');

      try {
        // 获取所有世界书条目（包括角色绑定的和全局的）
        const allEntries = await this.getAllWorldInfoEntries();

        // 🔥 修复：查找所有包含"表情包详情"的条目
        const stickerDetailEntries = [];

        // 🔥 优先级1：查找注释包含"表情包详情"的条目
        const commentEntries = allEntries.filter(entry => {
          return entry.comment && entry.comment.includes('表情包详情');
        });
        stickerDetailEntries.push(...commentEntries);

        // 🔥 优先级2：查找关键词包含"表情包详情"的条目（排除已添加的）
        const keywordEntries = allEntries.filter(entry => {
          if (stickerDetailEntries.includes(entry)) return false; // 避免重复
          if (entry.key && Array.isArray(entry.key)) {
            return entry.key.some(k => k.includes('表情包详情'));
          }
          return false;
        });
        stickerDetailEntries.push(...keywordEntries);

        // 🔥 优先级3：查找内容以"表情包详情"开头的条目（排除已添加的）
        const contentEntries = allEntries.filter(entry => {
          if (stickerDetailEntries.includes(entry)) return false; // 避免重复
          return entry.content && entry.content.trim().startsWith('表情包详情');
        });
        stickerDetailEntries.push(...contentEntries);

        console.log(`[Message App] 找到 ${stickerDetailEntries.length} 个表情包详情条目:`);
        stickerDetailEntries.forEach((entry, index) => {
          console.log(`${index + 1}. "${entry.comment}" (来源: ${entry.world})`);
        });

        if (stickerDetailEntries.length === 0) {
          console.warn('[Message App] 未找到"表情包详情"世界书条目，使用默认表情包列表');
          console.log('[Message App] 搜索的条目总数:', allEntries.length);
          console.log('[Message App] 条目示例:', allEntries.slice(0, 3).map(e => ({
            comment: e.comment,
            key: e.key,
            content: e.content ? e.content.substring(0, 50) + '...' : ''
          })));
          return this.getDefaultStickerImages();
        }

        // 🔥 修改：解析所有表情包详情条目
        const allStickerImages = [];

        for (let i = 0; i < stickerDetailEntries.length; i++) {
          const entry = stickerDetailEntries[i];
          console.log(`[Message App] 解析第 ${i + 1} 个表情包详情条目: "${entry.comment}" (来源: ${entry.world})`);

          try {
            const stickerImages = this.parseStickerDetails(entry.content);
            if (stickerImages.length > 0) {
              // 为每个表情包添加来源信息
              const imagesWithSource = stickerImages.map(img => ({
                ...img,
                source: entry.comment,
                world: entry.world
              }));
              allStickerImages.push(...imagesWithSource);
              console.log(`[Message App] 从"${entry.comment}"解析到 ${stickerImages.length} 个表情包`);
            } else {
              console.warn(`[Message App] 条目"${entry.comment}"解析失败，内容可能格式不正确`);
            }
          } catch (error) {
            console.error(`[Message App] 解析条目"${entry.comment}"时出错:`, error);
          }
        }

        if (allStickerImages.length === 0) {
          console.warn('[Message App] 所有表情包详情条目解析失败，使用默认表情包列表');
          return this.getDefaultStickerImages();
        }

        console.log(`[Message App] 成功从 ${stickerDetailEntries.length} 个条目解析到总共 ${allStickerImages.length} 个表情包`);
        return allStickerImages;

      } catch (error) {
        console.error('[Message App] 读取世界书表情包详情时出错:', error);
        return this.getDefaultStickerImages();
      }
    }

    /**
     * 🔥 新增：获取所有世界书条目
     */
    async getAllWorldInfoEntries() {
      const allEntries = [];

      try {
        // 🔥 修复：使用正确的SillyTavern世界书API
        // 1. 尝试使用SillyTavern的getSortedEntries函数（最佳方法）
        if (typeof window.getSortedEntries === 'function') {
          try {
            const entries = await window.getSortedEntries();
            allEntries.push(...entries);
            console.log(`[Message App] 通过getSortedEntries获取到 ${entries.length} 个世界书条目`);
            return allEntries; // 如果成功，直接返回
          } catch (error) {
            console.warn('[Message App] getSortedEntries调用失败:', error);
          }
        }

        // 2. 备用方法：手动获取全局和角色世界书
        console.log('[Message App] 使用备用方法获取世界书条目');

        // 🔥 修复：获取全局世界书 - 从DOM元素读取
        console.log('[Message App] 尝试获取全局世界书...');
        console.log('[Message App] window.selected_world_info:', window.selected_world_info);
        console.log('[Message App] window.world_names:', window.world_names);

        // 🔥 新增：方法1 - 从DOM元素获取选中的世界书
        const worldInfoSelect = document.getElementById('world_info');
        if (worldInfoSelect) {
          console.log('[Message App] 找到世界书选择器元素');

          // 获取所有选中的选项
          const selectedOptions = Array.from(worldInfoSelect.selectedOptions);
          console.log(`[Message App] 找到 ${selectedOptions.length} 个选中的世界书选项:`, selectedOptions.map(opt => opt.text));

          for (const option of selectedOptions) {
            const worldName = option.text;
            const worldIndex = option.value;

            try {
              console.log(`[Message App] 正在加载全局世界书: ${worldName} (索引: ${worldIndex})`);
              const worldData = await this.loadWorldInfoByName(worldName);
              if (worldData && worldData.entries) {
                const entries = Object.values(worldData.entries).map(entry => ({
                  ...entry,
                  world: worldName
                }));
                allEntries.push(...entries);
                console.log(`[Message App] 从全局世界书"${worldName}"获取到 ${entries.length} 个条目`);
              } else {
                console.warn(`[Message App] 全局世界书"${worldName}"没有条目或加载失败`);
              }
            } catch (error) {
              console.warn(`[Message App] 加载全局世界书"${worldName}"失败:`, error);
            }
          }
        } else {
          console.log('[Message App] 未找到世界书选择器元素 #world_info');
        }

        // 方法2：从 selected_world_info 变量获取（备用）
        if (allEntries.length === 0 && typeof window.selected_world_info !== 'undefined' && Array.isArray(window.selected_world_info) && window.selected_world_info.length > 0) {
          console.log(`[Message App] 备用方法：从变量获取 ${window.selected_world_info.length} 个全局世界书:`, window.selected_world_info);

          for (const worldName of window.selected_world_info) {
            try {
              console.log(`[Message App] 正在加载全局世界书: ${worldName}`);
              const worldData = await this.loadWorldInfoByName(worldName);
              if (worldData && worldData.entries) {
                const entries = Object.values(worldData.entries).map(entry => ({
                  ...entry,
                  world: worldName
                }));
                allEntries.push(...entries);
                console.log(`[Message App] 从全局世界书"${worldName}"获取到 ${entries.length} 个条目`);
              }
            } catch (error) {
              console.warn(`[Message App] 加载全局世界书"${worldName}"失败:`, error);
            }
          }
        }

        // 方法3：从 world_info.globalSelect 获取（备用）
        if (allEntries.length === 0 && typeof window.world_info !== 'undefined' && window.world_info.globalSelect) {
          console.log('[Message App] 备用方法：从 world_info.globalSelect 获取:', window.world_info.globalSelect);

          for (const worldName of window.world_info.globalSelect) {
            try {
              const worldData = await this.loadWorldInfoByName(worldName);
              if (worldData && worldData.entries) {
                const entries = Object.values(worldData.entries).map(entry => ({
                  ...entry,
                  world: worldName
                }));
                allEntries.push(...entries);
                console.log(`[Message App] 从world_info.globalSelect世界书"${worldName}"获取到 ${entries.length} 个条目`);
              }
            } catch (error) {
              console.warn(`[Message App] 从world_info.globalSelect加载世界书"${worldName}"失败:`, error);
            }
          }
        }

        // 获取角色绑定的世界书
        try {
          const characterEntries = await this.getCharacterWorldInfoEntries();
          allEntries.push(...characterEntries);
        } catch (error) {
          console.warn('[Message App] 获取角色世界书失败:', error);
        }

      } catch (error) {
        console.error('[Message App] 获取世界书条目时出错:', error);
      }

      console.log(`[Message App] 总共获取到 ${allEntries.length} 个世界书条目`);

      // 🔥 新增：为调试提供详细信息
      if (allEntries.length > 0) {
        console.log('[Message App] 世界书条目预览:', allEntries.slice(0, 3).map(entry => ({
          comment: entry.comment,
          key: Array.isArray(entry.key) ? entry.key.join(', ') : entry.key,
          contentPreview: entry.content ? entry.content.substring(0, 50) + '...' : '无内容',
          world: entry.world || '未知来源'
        })));
      }

      return allEntries;
    }

    /**
     * 🔥 新增：通过名称加载世界书数据
     */
    async loadWorldInfoByName(worldName) {
      try {
        // 🔥 修复：优先使用SillyTavern的loadWorldInfo函数
        if (typeof window.loadWorldInfo === 'function') {
          console.log(`[Message App] 使用loadWorldInfo函数加载世界书: ${worldName}`);
          return await window.loadWorldInfo(worldName);
        }

        // 备用方法：直接调用API（需要正确的请求头）
        console.log(`[Message App] 使用API加载世界书: ${worldName}`);

        // 获取正确的请求头
        const headers = {
          'Content-Type': 'application/json',
        };

        // 如果有getRequestHeaders函数，使用它
        if (typeof window.getRequestHeaders === 'function') {
          Object.assign(headers, window.getRequestHeaders());
        }

        const response = await fetch('/api/worldinfo/get', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ name: worldName }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`[Message App] 成功加载世界书 "${worldName}":`, data);
          return data;
        } else {
          console.error(`[Message App] 加载世界书 "${worldName}" 失败: ${response.status} ${response.statusText}`);
        }

      } catch (error) {
        console.error(`[Message App] 加载世界书 "${worldName}" 时出错:`, error);
      }

      return null;
    }

    /**
     * 🔥 新增：获取角色绑定的世界书条目
     */
    async getCharacterWorldInfoEntries() {
      const entries = [];

      try {
        // 🔥 修复：使用正确的SillyTavern全局变量获取角色信息
        let character = null;
        let characterId = null;

        // 方法1：通过SillyTavern.getContext()获取
        if (window.SillyTavern && typeof window.SillyTavern.getContext === 'function') {
          const context = window.SillyTavern.getContext();
          if (context && context.characters && context.characterId !== undefined) {
            character = context.characters[context.characterId];
            characterId = context.characterId;
          }
        }

        // 方法2：通过全局变量获取
        if (!character && typeof window.characters !== 'undefined' && typeof window.this_chid !== 'undefined') {
          character = window.characters[window.this_chid];
          characterId = window.this_chid;
        }

        if (!character) {
          console.log('[Message App] 无法获取当前角色信息');
          return entries;
        }

        console.log(`[Message App] 找到当前角色: ${character.name} (ID: ${characterId})`);

        // 获取角色绑定的主要世界书
        const worldName = character.data?.extensions?.world;
        if (worldName) {
          console.log(`[Message App] 角色绑定的主要世界书: ${worldName}`);
          const worldData = await this.loadWorldInfoByName(worldName);
          if (worldData && worldData.entries) {
            const worldEntries = Object.values(worldData.entries).map(entry => ({
              ...entry,
              world: worldName
            }));
            entries.push(...worldEntries);
            console.log(`[Message App] 从角色主要世界书获取到 ${worldEntries.length} 个条目`);
          }
        }

        // 🔥 新增：获取角色的额外世界书
        if (typeof window.world_info !== 'undefined' && window.world_info.charLore) {
          // 获取角色文件名
          const fileName = character.avatar || `${character.name}.png`;
          const extraCharLore = window.world_info.charLore.find(e => e.name === fileName);

          if (extraCharLore && Array.isArray(extraCharLore.extraBooks)) {
            console.log(`[Message App] 角色额外世界书: ${extraCharLore.extraBooks.join(', ')}`);

            for (const extraWorldName of extraCharLore.extraBooks) {
              try {
                const worldData = await this.loadWorldInfoByName(extraWorldName);
                if (worldData && worldData.entries) {
                  const worldEntries = Object.values(worldData.entries).map(entry => ({
                    ...entry,
                    world: extraWorldName
                  }));
                  entries.push(...worldEntries);
                  console.log(`[Message App] 从角色额外世界书"${extraWorldName}"获取到 ${worldEntries.length} 个条目`);
                }
              } catch (error) {
                console.warn(`[Message App] 加载角色额外世界书"${extraWorldName}"失败:`, error);
              }
            }
          }
        }

      } catch (error) {
        console.error('[Message App] 获取角色世界书条目时出错:', error);
      }

      return entries;
    }

    /**
     * 🔥 新增：解析表情包详情内容
     * 支持多种格式：
     * 1. 前缀|后缀|文件名1,文件名2,文件名3
     * 2. JSON格式：{"prefix": "前缀", "suffix": "后缀", "files": ["文件名1", "文件名2"]}
     * 3. 简单列表：文件名1,文件名2,文件名3（使用默认前缀后缀）
     */
    parseStickerDetails(content) {
      const stickerImages = [];

      try {
        console.log('[Message App] 解析表情包详情内容:', content);

        // 尝试JSON格式解析
        if (content.trim().startsWith('{')) {
          const jsonData = JSON.parse(content);
          const prefix = jsonData.prefix || '';
          const suffix = jsonData.suffix || '';
          const files = jsonData.files || [];

          for (const filename of files) {
            const fullPath = prefix + filename + suffix;
            // 🔥 修复：生成正确的备用路径
            const fallbackPath = `/scripts/extensions/third-party/mobile/images/${filename}`;

            stickerImages.push({
              filename: filename,
              fullPath: fullPath,
              displayName: filename,
              fallbackPath: fallbackPath,
              prefix: prefix,
              suffix: suffix
            });
          }

          console.log(`[Message App] JSON格式解析成功，获取到 ${stickerImages.length} 个表情包`);
          return stickerImages;
        }

        // 尝试管道分隔格式：前缀|后缀|文件名1,文件名2,文件名3
        if (content.includes('|')) {
          const parts = content.split('|');
          if (parts.length >= 3) {
            const prefix = parts[0].trim();
            const suffix = parts[1].trim();
            const filesStr = parts[2].trim();

            const files = filesStr.split(',').map(f => f.trim()).filter(f => f);

            for (const filename of files) {
              const fullPath = prefix + filename + suffix;
              // 🔥 修复：生成正确的备用路径
              const fallbackPath = `/scripts/extensions/third-party/mobile/images/${filename}`;

              stickerImages.push({
                filename: filename,
                fullPath: fullPath,
                displayName: filename,
                fallbackPath: fallbackPath,
                prefix: prefix,
                suffix: suffix
              });
            }

            console.log(`[Message App] 管道格式解析成功，前缀: "${prefix}", 后缀: "${suffix}", 获取到 ${stickerImages.length} 个表情包`);
            return stickerImages;
          }
        }

        // 尝试简单逗号分隔格式
        if (content.includes(',')) {
          const files = content.split(',').map(f => f.trim()).filter(f => f);
          const defaultPrefix = '/scripts/extensions/third-party/mobile/images/';
          const defaultSuffix = '';

          for (const filename of files) {
            const fullPath = defaultPrefix + filename + defaultSuffix;
            stickerImages.push({
              filename: filename,
              fullPath: fullPath,
              displayName: filename
            });
          }

          console.log(`[Message App] 简单格式解析成功，使用默认前缀，获取到 ${stickerImages.length} 个表情包`);
          return stickerImages;
        }

        // 尝试单行格式（每行一个文件名）
        const lines = content.split('\n').map(line => line.trim()).filter(line => line);
        if (lines.length > 0) {
          const defaultPrefix = '/scripts/extensions/third-party/mobile/images/';
          const defaultSuffix = '';

          for (const filename of lines) {
            const fullPath = defaultPrefix + filename + defaultSuffix;
            stickerImages.push({
              filename: filename,
              fullPath: fullPath,
              displayName: filename
            });
          }

          console.log(`[Message App] 行分隔格式解析成功，获取到 ${stickerImages.length} 个表情包`);
          return stickerImages;
        }

      } catch (error) {
        console.error('[Message App] 解析表情包详情时出错:', error);
      }

      console.warn('[Message App] 无法解析表情包详情内容，返回空列表');
      return stickerImages;
    }

    /**
     * 🔥 新增：获取默认表情包列表
     */
    getDefaultStickerImages() {
      const defaultFiles = [
        'zjlr8e.jpg',
        'emzckz.jpg',
        'ivtswg.jpg',
        'lgply8.jpg',
        'au4ay5.jpg',
        'qasebg.jpg',
        '5kqdkh.jpg',
        '8kvr4u.jpg',
        'aotnxp.jpg',
        'xigzwa.jpg',
        'y7px4h.jpg',
        'z2sxmv.jpg',
        's10h5m.jpg',
        'hoghwb.jpg',
        'kin0oj.jpg',
        'l9nqv0.jpg',
        'kv2ubl.gif',
        '6eyt6n.jpg',
      ];

      const defaultPrefix = '/scripts/extensions/third-party/mobile/images/';
      const defaultSuffix = '';

      return defaultFiles.map(filename => ({
        filename: filename,
        fullPath: defaultPrefix + filename + defaultSuffix,
        displayName: filename
      }));
    }

    /**
     * 🔥 新增：测试表情包配置功能
     * 可以在浏览器控制台调用 window.messageApp.testStickerConfig() 来测试
     */
    async testStickerConfig() {
      console.log('=== Message App 表情包配置测试开始 ===');

      try {
        // 测试获取世界书条目
        const allEntries = await this.getAllWorldInfoEntries();
        console.log(`✓ 成功获取 ${allEntries.length} 个世界书条目`);

        // 测试查找表情包详情条目
        const stickerDetailEntry = allEntries.find(entry => {
          if (entry.comment && entry.comment.includes('表情包详情')) return true;
          if (entry.key && Array.isArray(entry.key)) {
            if (entry.key.some(k => k.includes('表情包详情'))) return true;
          }
          if (entry.content && entry.content.trim().startsWith('表情包详情')) return true;
          return false;
        });

        if (stickerDetailEntry) {
          console.log('✓ 找到表情包详情条目:', {
            comment: stickerDetailEntry.comment,
            key: stickerDetailEntry.key,
            world: stickerDetailEntry.world
          });

          // 测试解析表情包详情
          const stickerImages = this.parseStickerDetails(stickerDetailEntry.content);
          console.log(`✓ 成功解析 ${stickerImages.length} 个表情包:`);
          stickerImages.forEach((sticker, index) => {
            console.log(`  ${index + 1}. ${sticker.displayName} -> ${sticker.fullPath}`);
          });

          if (stickerImages.length > 0) {
            console.log('✅ Message App 表情包配置测试通过！');
            return { success: true, count: stickerImages.length, stickers: stickerImages };
          } else {
            console.log('❌ 表情包解析失败，内容格式可能不正确');
            return { success: false, error: '解析失败' };
          }
        } else {
          console.log('❌ 未找到表情包详情条目');
          console.log('💡 请确保世界书中有一个条目的注释包含"表情包详情"或关键词包含"sticker"');
          return { success: false, error: '未找到配置条目' };
        }

      } catch (error) {
        console.error('❌ Message App 表情包配置测试失败:', error);
        return { success: false, error: error.message };
      } finally {
        console.log('=== Message App 表情包配置测试结束 ===');
      }
    }

    // 显示表情包面板
    async showStickerPanel() {
      console.log('[Message App] 显示表情包面板');

      // 检查是否已存在表情包面板
      const existingPanel = document.getElementById('sticker-input-panel');
      if (existingPanel) {
        existingPanel.remove();
      }

      // 🔥 修改：优先从缓存读取，不立即读取世界书
      const stickerImages = this.getCachedStickerImages();

      // 创建表情包输入面板
      const panel = document.createElement('div');
      panel.id = 'sticker-input-panel';
      panel.className = 'special-panel';

      // 🔥 修改：使用缓存的表情包数据生成网格
      const stickerGrid = this.generateStickerGrid(stickerImages);

      panel.innerHTML = `
            <div class="special-panel-content" style="max-width: 500px; width: 90%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #eee;">
                    <h3 style="margin: 0; color: #333; font-size: 18px;">😄 选择表情包</h3>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <button id="refresh-sticker-btn" onclick="window.messageApp.refreshStickerConfig()"
                                style="background: #667eea; color: white; border: none; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 4px;"
                                title="从世界书重新加载表情包配置">
                            <i class="fas fa-sync-alt"></i> 刷新
                        </button>
                        <button onclick="this.parentElement.parentElement.parentElement.parentElement.remove()"
                                style="background: none; border: none; font-size: 20px; cursor: pointer; color: #999; padding: 5px;">✕</button>
                    </div>
                </div>

                <div class="sticker-grid-container" style="display: flex; flex-wrap: wrap;  gap: 0; max-height: 300px; overflow-y: auto; padding: 10px; background: #f8f9fa; border-radius: 12px;">
                    ${stickerGrid}
                </div>

                <div style="margin-top: 15px; text-align: center; font-size: 12px; color: #666;">
                    点击表情包插入到消息中
                    <br><span class="sticker-status">
                        ${stickerImages.length > 0 && stickerImages[0].fullPath && stickerImages[0].fullPath !== stickerImages[0].filename ?
                          '<small style="color: #999;">✓ 使用世界书配置</small>' :
                          '<small style="color: #999;">使用默认配置</small>'}
                    </span>
                </div>
            </div>
        `;

      document.body.appendChild(panel);

      // 点击外部关闭
      panel.addEventListener('click', e => {
        if (e.target === panel) {
          panel.remove();
        }
      });
    }

    // 显示语音面板
    showVoicePanel() {
      // 检查是否已存在语音面板
      const existingPanel = document.getElementById('voice-input-panel');
      if (existingPanel) {
        existingPanel.remove();
      }

      // 创建语音输入面板
      const panel = document.createElement('div');
      panel.id = 'voice-input-panel';
      panel.className = 'special-panel';
      panel.innerHTML = `
            <div class="special-panel-content" style="max-width: 400px; width: 90%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #eee;">
                    <h3 style="margin: 0; color: #333; font-size: 18px;">🎤 语音消息</h3>
                    <button onclick="this.parentElement.parentElement.parentElement.remove()"
                            style="background: none; border: none; font-size: 20px; cursor: pointer; color: #999; padding: 5px;">✕</button>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; color: #555; font-weight: 500;">请输入语音内容：</label>
                    <textarea id="voice-content-input"
                             placeholder="请输入要发送的语音内容，例如：我叫个外卖"
                             style="width: 100%; min-height: 80px; max-height: 150px; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 14px; resize: vertical; font-family: inherit; line-height: 1.4; outline: none; transition: border-color 0.3s ease;"
                             maxlength="200"></textarea>
                    <div style="text-align: right; margin-top: 5px; font-size: 12px; color: #999;">
                        <span id="voice-char-count">0</span>/200 字符
                    </div>
                </div>

                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="this.parentElement.parentElement.parentElement.remove()"
                            style="padding: 10px 20px; border: 1px solid #ddd; border-radius: 6px; background: #f8f9fa; color: #333; cursor: pointer; font-size: 14px; transition: all 0.3s ease;">
                        取消
                    </button>
                    <button id="voice-send-confirm-btn"
                            style="padding: 10px 20px; border: none; border-radius: 6px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.3s ease;">
                        发送语音
                    </button>
                </div>
            </div>
        `;

      document.body.appendChild(panel);

      // 绑定事件
      const input = document.getElementById('voice-content-input');
      const charCount = document.getElementById('voice-char-count');
      const sendBtn = document.getElementById('voice-send-confirm-btn');

      // 字数统计
      if (input && charCount) {
        input.addEventListener('input', () => {
          const count = input.value.length;
          charCount.textContent = count;

          // 样式变化
          if (count > 180) {
            charCount.style.color = '#dc3545';
          } else if (count > 140) {
            charCount.style.color = '#ffc107';
          } else {
            charCount.style.color = '#999';
          }
        });

        // 回车发送（Ctrl+Enter或Shift+Enter换行）
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
            e.preventDefault();
            sendBtn.click();
          }
        });
      }

      // 发送按钮事件
      if (sendBtn) {
        sendBtn.addEventListener('click', () => {
          this.insertVoiceMessage();
        });
      }

      // 聚焦到输入框
      setTimeout(() => {
        if (input) {
          input.focus();
        }
      }, 100);

      // 点击外部关闭
      panel.addEventListener('click', e => {
        if (e.target === panel) {
          panel.remove();
        }
      });
    }

    /**
     * 插入语音消息到输入框
     */
    insertVoiceMessage() {
      const input = document.getElementById('voice-content-input');
      const panel = document.getElementById('voice-input-panel');

      if (!input) {
        console.error('找不到语音输入框');
        return;
      }

      const voiceContent = input.value.trim();
      if (!voiceContent) {
        // 输入框变红提示
        input.style.borderColor = '#dc3545';
        input.placeholder = '请输入语音内容';
        setTimeout(() => {
          input.style.borderColor = '#ddd';
          input.placeholder = '请输入要发送的语音内容，例如：我叫个外卖';
        }, 2000);
        return;
      }

      // 获取当前的输入框
      const appContent = document.getElementById('app-content');
      let targetInput = null;

      if (appContent) {
        // 优先查找消息详情页面的输入框
        targetInput =
          appContent.querySelector('#message-detail-input') || appContent.querySelector('#message-send-input');
      }

      if (!targetInput) {
        console.error('找不到目标输入框');
        this.showToast('未找到输入框，请先打开聊天窗口', 'error');
        return;
      }

      // 生成语音消息格式 [我方消息|我|好友ID|语音|内容]
      // 获取当前聊天对象的ID和群聊状态
      let targetId = null;
      let isGroup = false;

      // 尝试从当前应用状态获取好友ID和群聊状态
      if (this.currentFriendId) {
        targetId = this.currentFriendId;
        isGroup = this.isGroup || false;
      }

      // 如果没有获取到，尝试从 MessageSender 获取
      if (!targetId && window.messageSender && window.messageSender.currentFriendId) {
        targetId = window.messageSender.currentFriendId;
        isGroup = window.messageSender.isGroup || false;
      }

      // 如果还是没有，使用默认值
      if (!targetId) {
        targetId = '223456'; // 默认好友ID
        console.warn('[Message App] 未能获取当前好友ID，使用默认值:', targetId);
      }

      // 生成语音消息格式 - 区分群聊和私聊
      let voiceMessage;
      if (isGroup) {
        voiceMessage = `[群聊消息|${targetId}|我|语音|${voiceContent}]`;
      } else {
        voiceMessage = `[我方消息|我|${targetId}|语音|${voiceContent}]`;
      }

      // 插入到输入框
      const currentValue = targetInput.value || '';
      const separator = currentValue ? '\n' : '';
      targetInput.value = currentValue + separator + voiceMessage;

      // 触发输入事件，更新字数统计等
      const inputEvent = new Event('input', { bubbles: true });
      targetInput.dispatchEvent(inputEvent);

      // 聚焦到输入框
      targetInput.focus();

      // 关闭面板
      if (panel) {
        panel.remove();
      }

      // 显示成功提示
      this.showToast('语音消息已插入到输入框', 'success');

      console.log('语音消息已插入:', voiceMessage);
    }

    /**
     * 🔥 修改：插入表情包消息到输入框 - 直接使用完整路径
     */
    insertStickerMessage(filename, fullPath = null) {
      if (!filename) {
        console.error('表情包文件名不能为空');
        return;
      }

      // 🔥 修改：优先使用传入的完整路径，避免重复查找
      if (!fullPath) {
        // 如果没有传入完整路径，尝试从缓存查找
        try {
          const stickerImages = this.getCachedStickerImages();
          const stickerData = stickerImages.find(sticker =>
            (sticker.filename === filename) ||
            (typeof sticker === 'string' && sticker === filename)
          );

          if (stickerData && stickerData.fullPath) {
            fullPath = stickerData.fullPath;
            console.log(`[Message App] 从缓存获取表情包路径: ${filename} -> ${fullPath}`);
          } else {
            fullPath = filename;
            console.log(`[Message App] 未找到表情包配置，使用原文件名: ${filename}`);
          }
        } catch (error) {
          console.warn('[Message App] 获取表情包完整路径失败，使用原文件名:', error);
          fullPath = filename;
        }
      } else {
        console.log(`[Message App] 使用传入的完整路径: ${filename} -> ${fullPath}`);
      }

      // 获取当前的输入框
      const appContent = document.getElementById('app-content');
      let targetInput = null;

      if (appContent) {
        // 优先查找消息详情页面的输入框
        targetInput =
          appContent.querySelector('#message-detail-input') || appContent.querySelector('#message-send-input');
      }

      if (!targetInput) {
        console.error('找不到目标输入框');
        this.showToast('未找到输入框，请先打开聊天窗口', 'error');
        return;
      }

      // 获取当前聊天对象的ID和群聊状态
      let targetId = null;
      let isGroup = false;

      // 尝试从当前应用状态获取好友ID和群聊状态
      if (this.currentFriendId) {
        targetId = this.currentFriendId;
        isGroup = this.isGroup || false;
      }

      // 如果没有获取到，尝试从 MessageSender 获取
      if (!targetId && window.messageSender && window.messageSender.currentFriendId) {
        targetId = window.messageSender.currentFriendId;
        isGroup = window.messageSender.isGroup || false;
      }

      // 如果还是没有，使用默认值
      if (!targetId) {
        targetId = '223456'; // 默认好友ID
        console.warn('[Message App] 未能获取当前好友ID，使用默认值:', targetId);
      }

      // 🔥 修改：生成表情包消息格式 - 使用完整路径
      let stickerMessage;
      if (isGroup) {
        stickerMessage = `[群聊消息|${targetId}|我|表情包|${fullPath}]`;
      } else {
        stickerMessage = `[我方消息|我|${targetId}|表情包|${fullPath}]`;
      }

      console.log(`[Message App] 生成表情包消息: ${filename} -> ${fullPath}`);

      // 插入到输入框
      const currentValue = targetInput.value || '';
      const separator = currentValue ? '\n' : '';
      targetInput.value = currentValue + separator + stickerMessage;

      // 触发输入事件，更新字数统计等
      const inputEvent = new Event('input', { bubbles: true });
      targetInput.dispatchEvent(inputEvent);

      // 聚焦到输入框
      targetInput.focus();

      // 关闭面板
      const panel = document.getElementById('sticker-input-panel');
      if (panel) {
        panel.remove();
      }

      // 显示成功提示
      this.showToast('表情包已插入到输入框', 'success');

      console.log('表情包消息已插入:', stickerMessage);
    }

    /**
     * 🔥 新增：获取缓存的表情包配置
     */
    getCachedStickerImages() {
      try {
        // 从localStorage读取缓存
        const cached = localStorage.getItem('stickerConfig_cache');
        if (cached) {
          const cacheData = JSON.parse(cached);
          const now = Date.now();

          // 检查缓存是否过期（默认30分钟）
          if (cacheData.timestamp && (now - cacheData.timestamp) < 30 * 60 * 1000) {
            console.log(`[Message App] 使用缓存的表情包配置，包含 ${cacheData.data.length} 个表情包`);
            return cacheData.data;
          } else {
            console.log('[Message App] 表情包缓存已过期');
            localStorage.removeItem('stickerConfig_cache');
          }
        }
      } catch (error) {
        console.warn('[Message App] 读取表情包缓存失败:', error);
        localStorage.removeItem('stickerConfig_cache');
      }

      // 没有有效缓存，返回默认配置
      console.log('[Message App] 没有缓存，使用默认表情包配置');
      return this.getDefaultStickerImages();
    }

    /**
     * 🔥 新增：缓存表情包配置到localStorage
     */
    cacheStickerImages(stickerImages) {
      try {
        const cacheData = {
          data: stickerImages,
          timestamp: Date.now()
        };
        localStorage.setItem('stickerConfig_cache', JSON.stringify(cacheData));
        console.log(`[Message App] 表情包配置已缓存，包含 ${stickerImages.length} 个表情包`);
      } catch (error) {
        console.warn('[Message App] 缓存表情包配置失败:', error);
      }
    }

    /**
     * 🔥 新增：刷新表情包配置（从世界书重新读取）
     */
    async refreshStickerConfig() {
      console.log('[Message App] 开始刷新表情包配置...');

      // 显示加载状态
      const refreshBtn = document.getElementById('refresh-sticker-btn');
      const originalText = refreshBtn ? refreshBtn.innerHTML : '';
      if (refreshBtn) {
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 加载中...';
        refreshBtn.disabled = true;
      }

      try {
        // 清除缓存
        localStorage.removeItem('stickerConfig_cache');

        // 从世界书重新读取
        const stickerImages = await this.getStickerImagesFromWorldInfo();

        // 缓存新配置
        this.cacheStickerImages(stickerImages);

        // 更新面板内容
        this.updateStickerPanel(stickerImages);

        // 显示成功提示
        this.showToast('表情包配置已刷新', 'success');

      } catch (error) {
        console.error('[Message App] 刷新表情包配置失败:', error);
        this.showToast('刷新失败，请检查世界书配置', 'error');
      } finally {
        // 恢复按钮状态
        if (refreshBtn) {
          refreshBtn.innerHTML = originalText;
          refreshBtn.disabled = false;
        }
      }
    }

    /**
     * 🔥 新增：更新表情包面板内容
     */
    updateStickerPanel(stickerImages) {
      const panel = document.getElementById('sticker-input-panel');
      if (!panel) return;

      // 生成新的表情包网格
      const stickerGrid = this.generateStickerGrid(stickerImages);

      // 更新网格容器
      const gridContainer = panel.querySelector('.sticker-grid-container');
      if (gridContainer) {
        gridContainer.innerHTML = stickerGrid;
      }

      // 更新状态提示
      const statusElement = panel.querySelector('.sticker-status');
      if (statusElement) {
        const statusText = stickerImages.length > 0 && stickerImages[0].fullPath && stickerImages[0].fullPath !== stickerImages[0].filename ?
          '✓ 使用世界书配置' : '使用默认配置';
        statusElement.innerHTML = `<small style="color: #999;">${statusText}</small>`;
      }

      console.log(`[Message App] 表情包面板已更新，包含 ${stickerImages.length} 个表情包`);
    }

    /**
     * 🔥 新增：生成表情包网格HTML
     */
    generateStickerGrid(stickerImages) {
      return stickerImages
        .map(
          stickerData => {
            // 🔥 修复：为备用路径使用世界书配置的前缀，而不是硬编码路径
            let fallbackPath;
            if (stickerData.fallbackPath) {
              // 如果已经有备用路径，直接使用
              fallbackPath = stickerData.fallbackPath;
            } else if (stickerData.prefix && stickerData.suffix !== undefined) {
              // 如果有世界书配置的前缀和后缀，使用它们构建备用路径
              fallbackPath = stickerData.prefix + (stickerData.filename || stickerData) + stickerData.suffix;
            } else {
              // 最后才使用默认路径
              fallbackPath = `/scripts/extensions/third-party/mobile/images/${stickerData.filename || stickerData}`;
            }

            return `
            <div class="sticker-item" onclick="window.messageApp.insertStickerMessage('${stickerData.filename || stickerData}', '${stickerData.fullPath || stickerData}')"
                 style="cursor: pointer; padding: 4px; border: 2px solid transparent; border-radius: 8px; transition: all 0.3s ease;width:calc(25%);box-sizing:border-box"
                 onmouseover="this.style.borderColor='#667eea'; this.style.transform='scale(1.1)'"
                 onmouseout="this.style.borderColor='transparent'; this.style.transform='scale(1)'"
                 title="${stickerData.displayName || stickerData}">
                <img src="${stickerData.fullPath || stickerData}"
                     alt="${stickerData.displayName || stickerData}"
                     style="object-fit: cover; border-radius: 4px; display: block;"
                     loading="lazy"
                     >
            </div>
        `;
          }
        )
        .join('');
    }

    // 显示红包面板
    showRedpackPanel() {
      // 检查是否已存在红包面板
      const existingPanel = document.getElementById('redpack-input-panel');
      if (existingPanel) {
        existingPanel.remove();
      }

      // 创建红包输入面板
      const panel = document.createElement('div');
      panel.id = 'redpack-input-panel';
      panel.className = 'special-panel';
      panel.innerHTML = `
            <div class="special-panel-content" style="max-width: 400px; width: 90%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #eee;">
                    <h3 style="margin: 0; color: #333; font-size: 18px;">🧧 发红包</h3>
                    <button onclick="this.parentElement.parentElement.parentElement.remove()"
                            style="background: none; border: none; font-size: 20px; cursor: pointer; color: #999; padding: 5px;">✕</button>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; color: #555; font-weight: 500;">请输入红包金额：</label>
                    <input type="number" id="redpack-amount-input"
                           placeholder="请输入金额，例如：88.88"
                           step="0.01" min="0.01" max="9999999"
                           style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 14px; font-family: inherit; outline: none; transition: border-color 0.3s ease;" />
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px; font-size: 12px; color: #999;">
                        <span>金额范围：0.01 - 9999999.00 元</span>
                        <span id="redpack-amount-display">￥0.00</span>
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; color: #555; font-weight: 500;">红包祝福语（可选）：</label>
                    <input type="text" id="redpack-message-input"
                           placeholder="恭喜发财，大吉大利"
                           maxlength="20"
                           style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 14px; font-family: inherit; outline: none; transition: border-color 0.3s ease;" />
                    <div style="text-align: right; margin-top: 5px; font-size: 12px; color: #999;">
                        <span id="redpack-message-count">0</span>/20 字符
                    </div>
                </div>

                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="this.parentElement.parentElement.parentElement.remove()"
                            style="padding: 10px 20px; border: 1px solid #ddd; border-radius: 6px; background: #f8f9fa; color: #333; cursor: pointer; font-size: 14px; transition: all 0.3s ease;">
                        取消
                    </button>
                    <button id="redpack-send-confirm-btn"
                            style="padding: 10px 20px; border: none; border-radius: 6px; background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.3s ease;">
                        发红包
                    </button>
                </div>
            </div>
        `;

      document.body.appendChild(panel);

      // 绑定事件
      const amountInput = document.getElementById('redpack-amount-input');
      const messageInput = document.getElementById('redpack-message-input');
      const amountDisplay = document.getElementById('redpack-amount-display');
      const messageCount = document.getElementById('redpack-message-count');
      const sendBtn = document.getElementById('redpack-send-confirm-btn');

      // 金额实时显示
      if (amountInput && amountDisplay) {
        amountInput.addEventListener('input', () => {
          const amount = parseFloat(amountInput.value) || 0;
          amountDisplay.textContent = `￥${amount.toFixed(2)}`;

          // 样式变化
          if (amount > 9999999) {
            amountInput.style.borderColor = '#dc3545';
            amountDisplay.style.color = '#dc3545';
          } else if (amount < 0.01 && amount > 0) {
            amountInput.style.borderColor = '#ffc107';
            amountDisplay.style.color = '#ffc107';
          } else {
            amountInput.style.borderColor = '#ddd';
            amountDisplay.style.color = '#28a745';
          }
        });
      }

      // 祝福语字数统计
      if (messageInput && messageCount) {
        messageInput.addEventListener('input', () => {
          const count = messageInput.value.length;
          messageCount.textContent = count;

          if (count > 18) {
            messageCount.style.color = '#dc3545';
          } else if (count > 15) {
            messageCount.style.color = '#ffc107';
          } else {
            messageCount.style.color = '#999';
          }
        });
      }

      // 回车发送
      if (amountInput) {
        amountInput.addEventListener('keydown', e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            sendBtn.click();
          }
        });
      }

      if (messageInput) {
        messageInput.addEventListener('keydown', e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            sendBtn.click();
          }
        });
      }

      // 发送按钮事件
      if (sendBtn) {
        sendBtn.addEventListener('click', () => {
          this.insertRedpackMessage();
        });
      }

      // 聚焦到金额输入框
      setTimeout(() => {
        if (amountInput) {
          amountInput.focus();
        }
      }, 100);

      // 点击外部关闭
      panel.addEventListener('click', e => {
        if (e.target === panel) {
          panel.remove();
        }
      });
    }

    /**
     * 插入红包消息到输入框
     */
    insertRedpackMessage() {
      const amountInput = document.getElementById('redpack-amount-input');
      const messageInput = document.getElementById('redpack-message-input');
      const panel = document.getElementById('redpack-input-panel');

      if (!amountInput) {
        console.error('找不到红包金额输入框');
        return;
      }

      const amount = parseFloat(amountInput.value);
      if (!amount || amount < 0.01 || amount > 9999999) {
        // 输入框变红提示
        amountInput.style.borderColor = '#dc3545';
        amountInput.placeholder = '请输入0.01-9999999.00之间的金额';
        setTimeout(() => {
          amountInput.style.borderColor = '#ddd';
          amountInput.placeholder = '请输入金额，例如：88.88';
        }, 2000);
        return;
      }

      const message = messageInput ? messageInput.value.trim() : '';
      const blessing = message || '恭喜发财，大吉大利';

      // 获取当前的输入框
      const appContent = document.getElementById('app-content');
      let targetInput = null;

      if (appContent) {
        // 优先查找消息详情页面的输入框
        targetInput =
          appContent.querySelector('#message-detail-input') || appContent.querySelector('#message-send-input');
      }

      if (!targetInput) {
        console.error('找不到目标输入框');
        this.showToast('未找到输入框，请先打开聊天窗口', 'error');
        return;
      }

      // 获取当前聊天对象的ID和群聊状态
      let targetId = null;
      let isGroup = false;

      // 尝试从当前应用状态获取好友ID和群聊状态
      if (this.currentFriendId) {
        targetId = this.currentFriendId;
        isGroup = this.isGroup || false;
      }

      // 如果没有获取到，尝试从 MessageSender 获取
      if (!targetId && window.messageSender && window.messageSender.currentFriendId) {
        targetId = window.messageSender.currentFriendId;
        isGroup = window.messageSender.isGroup || false;
      }

      // 如果还是没有，使用默认值
      if (!targetId) {
        targetId = '223456'; // 默认好友ID
        console.warn('[Message App] 未能获取当前好友ID，使用默认值:', targetId);
      }

      // 生成红包消息格式 - 区分群聊和私聊
      let redpackMessage;
      if (isGroup) {
        redpackMessage = `[群聊消息|${targetId}|我|红包|${amount.toFixed(2)}]`;
      } else {
        redpackMessage = `[我方消息|我|${targetId}|红包|${amount.toFixed(2)}]`;
      }

      // 插入到输入框
      const currentValue = targetInput.value || '';
      const separator = currentValue ? '\n' : '';
      targetInput.value = currentValue + separator + redpackMessage;

      // 触发输入事件，更新字数统计等
      const inputEvent = new Event('input', { bubbles: true });
      targetInput.dispatchEvent(inputEvent);

      // 聚焦到输入框
      targetInput.focus();

      // 关闭面板
      if (panel) {
        panel.remove();
      }

      // 显示成功提示
      this.showToast(`红包已插入到输入框：￥${amount.toFixed(2)}`, 'success');

      console.log('红包消息已插入:', redpackMessage);
    }

    // 显示附件面板
    showAttachmentPanel() {
      console.log('[Message App] 🔍 开始显示附件面板');

      // 检查是否已存在附件面板
      const existingPanel = document.getElementById('attachment-input-panel');
      if (existingPanel) {
        console.log('[Message App] 🔍 移除已存在的附件面板');
        existingPanel.remove();
      }

      // 确保AttachmentSender已加载
      console.log('[Message App] 🔍 检查AttachmentSender状态:', !!window.attachmentSender);
      if (!window.attachmentSender) {
        console.warn('[Message App] AttachmentSender未加载，尝试加载...');
        this.loadAttachmentSender();
        // 显示加载提示
        this.showToast('正在加载附件功能...', 'info');
        return;
      }

      // 设置当前聊天对象
      console.log('[Message App] 🔍 当前聊天对象:', {
        friendId: this.currentFriendId,
        friendName: this.currentFriendName,
        isGroup: this.isCurrentChatGroup(),
      });

      if (this.currentFriendId) {
        const isGroup = this.isCurrentChatGroup();
        window.attachmentSender.setCurrentChat(this.currentFriendId, this.currentFriendName, isGroup);
        console.log('[Message App] 🔍 已设置AttachmentSender聊天对象');
      } else {
        console.warn('[Message App] ⚠️ 当前没有选择聊天对象');
      }

      // 创建附件输入面板
      const panel = document.createElement('div');
      panel.id = 'attachment-input-panel';
      panel.className = 'special-panel';
      panel.innerHTML = `
            <div class="special-panel-content" style="max-width: 500px; width: 90%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #eee;">
                    <h3 style="margin: 0; color: #333; font-size: 18px;">📁 发送附件</h3>
                    <button onclick="this.parentElement.parentElement.parentElement.remove()"
                            style="background: none; border: none; font-size: 20px; cursor: pointer; color: #999; padding: 5px;">✕</button>
                </div>

                <div style="margin-bottom: 20px;">
                    <div class="file-drop-zone" style="
                        border: 2px dashed #ddd;
                        border-radius: 8px;
                        padding: 40px 20px;
                        text-align: center;
                        background: #fafafa;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    ">
                        <div style="font-size: 48px; margin-bottom: 10px;">📎</div>
                        <div style="font-size: 16px; color: #666; margin-bottom: 10px;">点击选择文件或拖拽文件到此处</div>
                        <div style="font-size: 12px; color: #999;">
                            支持图片、文档、压缩包等文件类型<br>
                            最大文件大小：10MB
                        </div>
                        <input type="file" id="attachment-file-input" multiple
                               accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.7z"
                               style="display: none;">
                    </div>
                </div>

                <div id="attachment-preview-area" style="margin-bottom: 20px; display: none;">
                    <h4 style="margin: 0 0 10px 0; color: #555; font-size: 14px;">选中的文件：</h4>
                    <div id="attachment-file-list" style="max-height: 200px; overflow-y: auto;"></div>
                </div>

                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 10px 0; color: #555; font-size: 14px;">附加消息（可选）：</h4>
                    <textarea id="attachment-message-input" placeholder="输入要一起发送的消息内容，支持换行发送多条消息..."
                              style="width: 100%; min-height: 80px; padding: 10px; border: 1px solid #ddd; border-radius: 6px; resize: vertical; font-size: 14px; font-family: inherit; box-sizing: border-box;"
                              maxlength="1000"></textarea>
                    <div style="font-size: 12px; color: #999; margin-top: 5px;">
                        提示：每行内容将作为单独的消息发送，最多1000字符
                    </div>
                </div>

                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="this.parentElement.parentElement.parentElement.remove()"
                            style="padding: 10px 20px; border: 1px solid #ddd; border-radius: 6px; background: #f8f9fa; color: #333; cursor: pointer; font-size: 14px; transition: all 0.3s ease;">
                        取消
                    </button>
                    <button id="attachment-send-confirm-btn" disabled
                            style="padding: 10px 20px; border: none; border-radius: 6px; background: #6c757d; color: white; cursor: not-allowed; font-size: 14px; font-weight: 500; transition: all 0.3s ease;">
                        发送附件
                    </button>
                </div>
            </div>
        `;

      document.body.appendChild(panel);

      // 绑定事件
      this.bindAttachmentPanelEvents(panel);
    }

    // 绑定附件面板事件
    bindAttachmentPanelEvents(panel) {
      const fileInput = panel.querySelector('#attachment-file-input');
      const dropZone = panel.querySelector('.file-drop-zone');
      const previewArea = panel.querySelector('#attachment-preview-area');
      const fileList = panel.querySelector('#attachment-file-list');
      const sendBtn = panel.querySelector('#attachment-send-confirm-btn');

      let selectedFiles = [];

      // 文件选择事件
      if (fileInput) {
        fileInput.addEventListener('change', e => {
          this.handleFileSelection(e.target.files, selectedFiles, fileList, previewArea, sendBtn);
        });
      }

      // 拖拽区域事件
      if (dropZone) {
        dropZone.addEventListener('click', () => {
          fileInput.click();
        });

        dropZone.addEventListener('dragover', e => {
          e.preventDefault();
          dropZone.style.borderColor = '#007bff';
          dropZone.style.backgroundColor = '#f0f8ff';
        });

        dropZone.addEventListener('dragleave', e => {
          e.preventDefault();
          dropZone.style.borderColor = '#ddd';
          dropZone.style.backgroundColor = '#fafafa';
        });

        dropZone.addEventListener('drop', e => {
          e.preventDefault();
          dropZone.style.borderColor = '#ddd';
          dropZone.style.backgroundColor = '#fafafa';

          const files = e.dataTransfer.files;
          this.handleFileSelection(files, selectedFiles, fileList, previewArea, sendBtn);
        });
      }

      // 发送按钮事件
      if (sendBtn) {
        sendBtn.addEventListener('click', async () => {
          console.log('[Message App] 🔍 发送附件按钮被点击');
          console.log('[Message App] 🔍 选中文件数量:', selectedFiles.length);

          if (selectedFiles.length === 0) {
            console.warn('[Message App] ⚠️ 没有选中的文件');
            return;
          }

          // 获取附加消息内容
          const messageInput = panel.querySelector('#attachment-message-input');
          const additionalMessages = messageInput ? messageInput.value.trim() : '';
          console.log('[Message App] 🔍 附加消息内容:', additionalMessages);

          sendBtn.disabled = true;
          sendBtn.textContent = '发送中...';
          sendBtn.style.background = '#6c757d';

          try {
            console.log('[Message App] 🔍 开始处理文件选择...');
            // 将附加消息传递给attachmentSender
            const results = await window.attachmentSender.handleFileSelection(selectedFiles, additionalMessages);
            console.log('[Message App] 🔍 文件处理结果:', results);

            // 检查结果
            const successCount = results.filter(r => r.success).length;
            const failCount = results.length - successCount;

            console.log('[Message App] 🔍 处理统计:', { successCount, failCount });

            if (successCount > 0) {
              this.showToast(`成功发送 ${successCount} 个附件`, 'success');
            }

            if (failCount > 0) {
              const errors = results
                .filter(r => !r.success)
                .map(r => r.errors.join(', '))
                .join('; ');
              console.error('[Message App] ❌ 发送失败的错误:', errors);
              this.showToast(`${failCount} 个附件发送失败: ${errors}`, 'error');
            }

            // 关闭面板
            panel.remove();
          } catch (error) {
            console.error('[Message App] ❌ 发送附件失败:', error);
            this.showToast('发送附件失败: ' + error.message, 'error');

            sendBtn.disabled = false;
            sendBtn.textContent = '发送附件';
            sendBtn.style.background = 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)';
          }
        });
      }
    }

    // 加载附件发送器
    loadAttachmentSender() {
      if (window.attachmentSender) {
        return;
      }

      // 检查脚本是否已经存在
      const existingScript = document.querySelector('script[src*="attachment-sender.js"]');
      if (existingScript) {
        console.log('[Message App] 附件发送器脚本已存在');
        return;
      }

      // 创建脚本标签
      const script = document.createElement('script');
      script.src = 'scripts/extensions/third-party/mobile/app/attachment-sender.js';
      script.onload = () => {
        console.log('[Message App] ✅ 附件发送器脚本加载完成');
        // 不自动显示面板，只在用户点击时显示
      };
      script.onerror = error => {
        console.error('[Message App] ❌ 附件发送器脚本加载失败:', error);
        this.showToast('附件功能加载失败', 'error');
      };

      document.head.appendChild(script);
    }

    // 静默加载附件发送器（不显示面板）
    loadAttachmentSenderSilently() {
      if (window.attachmentSender) {
        return;
      }

      // 检查脚本是否已经存在
      const existingScript = document.querySelector('script[src*="attachment-sender.js"]');
      if (existingScript) {
        console.log('[Message App] 附件发送器脚本已存在');
        return;
      }

      // 创建脚本标签
      const script = document.createElement('script');
      script.src = 'scripts/extensions/third-party/mobile/app/attachment-sender.js';
      script.onload = () => {
        console.log('[Message App] ✅ 附件发送器脚本静默加载完成');
      };
      script.onerror = error => {
        console.error('[Message App] ❌ 附件发送器脚本加载失败:', error);
      };

      document.head.appendChild(script);
    }

    // 处理文件选择
    handleFileSelection(files, selectedFiles, fileList, previewArea, sendBtn) {
      // 清空之前的选择
      selectedFiles.length = 0;

      // 添加新选择的文件
      for (const file of files) {
        selectedFiles.push(file);
      }

      // 更新预览
      this.updateFilePreview(selectedFiles, fileList, previewArea, sendBtn);
    }

    // 更新文件预览
    updateFilePreview(selectedFiles, fileList, previewArea, sendBtn) {
      if (selectedFiles.length === 0) {
        previewArea.style.display = 'none';
        sendBtn.disabled = true;
        sendBtn.style.background = '#6c757d';
        sendBtn.style.cursor = 'not-allowed';
        return;
      }

      // 显示预览区域
      previewArea.style.display = 'block';

      // 清空文件列表
      fileList.innerHTML = '';

      // 为每个文件创建预览项
      selectedFiles.forEach((file, index) => {
        const preview = window.attachmentSender.createFilePreview(file);
        const validation = window.attachmentSender.validateFile(file);

        const fileItem = document.createElement('div');
        fileItem.className = 'file-preview-item';
        fileItem.style.cssText = `
          display: flex;
          align-items: center;
          padding: 10px;
          margin-bottom: 8px;
          border: 1px solid ${validation.isValid ? '#ddd' : '#dc3545'};
          border-radius: 6px;
          background: ${validation.isValid ? '#fff' : '#fff5f5'};
        `;

        fileItem.innerHTML = `
          <div style="font-size: 24px; margin-right: 12px;">${preview.icon}</div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 500; color: #333; margin-bottom: 2px; word-break: break-all;">
              ${preview.fileName}
            </div>
            <div style="font-size: 12px; color: #666;">
              ${preview.fileSize} • ${preview.category}
            </div>
            ${
              !validation.isValid
                ? `
              <div style="font-size: 12px; color: #dc3545; margin-top: 4px;">
                ${validation.errors.join(', ')}
              </div>
            `
                : ''
            }
          </div>
          <button onclick="this.parentElement.remove(); window.messageApp.removeFileFromSelection(${index})"
                  style="background: none; border: none; color: #999; cursor: pointer; padding: 4px; font-size: 16px;">
            ✕
          </button>
        `;

        // 如果是图片，添加预览内容
        if (preview.previewContent) {
          const previewDiv = document.createElement('div');
          previewDiv.innerHTML = preview.previewContent;
          previewDiv.style.marginLeft = '36px';
          fileItem.appendChild(previewDiv);
        }

        fileList.appendChild(fileItem);
      });

      // 检查是否有有效文件
      const hasValidFiles = selectedFiles.some(file => window.attachmentSender.validateFile(file).isValid);

      // 更新发送按钮状态
      if (hasValidFiles) {
        sendBtn.disabled = false;
        sendBtn.style.background = 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)';
        sendBtn.style.cursor = 'pointer';
        sendBtn.textContent = `发送附件 (${selectedFiles.length})`;
      } else {
        sendBtn.disabled = true;
        sendBtn.style.background = '#6c757d';
        sendBtn.style.cursor = 'not-allowed';
        sendBtn.textContent = '无有效文件';
      }
    }

    // 从选择中移除文件
    removeFileFromSelection(index) {
      // 这个方法会在全局作用域中被调用，所以需要通过window.messageApp访问
      // 实际的移除逻辑在updateFilePreview中处理
    }

    // 显示提示
    showToast(message, type = 'info') {
      const toast = document.createElement('div');
      toast.className = `send-status-toast ${type}`;
      toast.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px;">${message}</div>
        `;

      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    }

    // 显示添加好友界面
    showAddFriend() {
      this.currentView = 'addFriend';
      this.currentTab = 'add'; // 默认显示添加tab

      // 通知主框架更新应用状态
      if (window.mobilePhone) {
        const addFriendState = {
          app: 'messages',
          title: '添加好友',
          view: 'addFriend',
        };
        window.mobilePhone.pushAppState(addFriendState);
      }

      this.updateAppContent();
    }

    // 显示消息列表
    showMessageList() {
      console.log('[Message App] 显示消息列表');

      this.currentView = 'list'; // 修复：保持与getAppContent中的case一致
      this.currentFriendId = null;
      this.currentFriendName = null;
      this.currentIsGroup = false; // 重置群聊状态

      // 通知主框架更新应用状态（不推送新状态，而是直接更新当前状态）
      if (window.mobilePhone) {
        const listState = {
          app: 'messages',
          title: '信息',
          view: 'messageList', // 主框架用这个值来区分状态
        };
        // 直接更新当前状态，不推送到栈中
        window.mobilePhone.currentAppState = listState;
        window.mobilePhone.updateAppHeader(listState);
        console.log('[Message App] 更新状态到消息列表:', listState);
      }

      // 更新应用内容
      this.updateAppContent();
    }

    // 切换标签页
    switchTab(tabName) {
      console.log(`[Message App] 切换标签页: ${tabName}`);

      try {
        // 正确的状态管理：currentView保持为'addFriend'，currentTab切换为具体的tab
        this.currentTab = tabName; // 设置当前tab
        // this.currentView保持为'addFriend'，不要修改

        // 通知主框架更新应用状态（如果需要的话）
        if (window.mobilePhone && this.currentView === 'addFriend') {
          let title = '添加好友';
          if (tabName === 'delete') {
            title = '删除好友';
          } else if (tabName === 'createGroup') {
            title = '创建群聊';
          } else if (tabName === 'deleteGroup') {
            title = '删除群聊';
          }

          // 更新当前状态的标题，但不改变view
          if (window.mobilePhone.currentAppState) {
            window.mobilePhone.currentAppState.title = title;
            window.mobilePhone.updateAppHeader(window.mobilePhone.currentAppState);
          }
        }

        // 确保DOM更新完成后再重新绑定事件
        setTimeout(() => {
          this.updateAppContent();
          // 额外确保tab-navigation仍然存在并可见
          this.ensureTabNavigationVisible();
        }, 10);
      } catch (error) {
        console.error('[Message App] 切换标签页时出错:', error);
        // 如果出错，尝试恢复到默认状态
        this.currentTab = 'add';
        this.updateAppContent();
      }
    }

    // 确保tab-navigation可见的辅助方法
    ensureTabNavigationVisible() {
      try {
        const tabNavigation = document.querySelector('.tab-navigation');
        if (tabNavigation) {
          // 确保tab-navigation可见
          tabNavigation.style.display = 'flex';

          // 确保当前tab的active状态正确
          const allTabs = tabNavigation.querySelectorAll('.tab-btn');
          allTabs.forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-tab') === this.currentTab) {
              btn.classList.add('active');
            }
          });

          console.log(`[Message App] Tab导航已确保可见，当前tab: ${this.currentTab}`);
        } else {
          console.warn('[Message App] Tab导航元素未找到，可能需要重新渲染');
          // 如果tab-navigation不存在，强制重新渲染
          setTimeout(() => {
            this.updateAppContent();
          }, 100);
        }
      } catch (error) {
        console.error('[Message App] 确保tab导航可见时出错:', error);
      }
    }

    // 刷新删除好友列表
    refreshDeleteFriendList() {
      if (this.currentView === 'addFriend' && this.currentTab === 'delete') {
        this.updateAppContent();
      }
    }

    // 更新应用内容
    updateAppContent() {
      try {
        const appContent = document.getElementById('app-content');
        if (!appContent) {
          console.error('[Message App] app-content元素不存在');
          return;
        }

        // 保存当前的滚动位置（如果需要的话）
        const currentScrollTop = appContent.scrollTop;

        // 更新内容
        const newContent = this.getAppContent();
        if (!newContent) {
          console.error('[Message App] getAppContent返回空内容');
          return;
        }

        appContent.innerHTML = newContent;

        // 如果是消息详情页面，立即应用好友专属背景
        if (this.currentView === 'messageDetail' && this.currentFriendId) {
          this.applyFriendSpecificBackground(this.currentFriendId);
        }

        // 确保内容更新完成后再绑定事件
        setTimeout(() => {
          try {
            this.bindEvents();
            console.log('[Message App] 事件绑定完成');
          } catch (bindError) {
            console.error('[Message App] 绑定事件时出错:', bindError);
          }
        }, 20);

        // 恢复滚动位置（如果需要的话）
        if (currentScrollTop > 0) {
          setTimeout(() => {
            appContent.scrollTop = currentScrollTop;
          }, 50);
        }
      } catch (error) {
        console.error('[Message App] 更新应用内容时出错:', error);
        // 尝试显示错误状态
        const appContent = document.getElementById('app-content');
        if (appContent) {
          appContent.innerHTML = `
                    <div class="error-state">
                        <div class="error-icon">⚠️</div>
                        <div class="error-text">界面更新失败</div>
                        <div class="error-details">${error.message}</div>
                        <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">重新加载</button>
                    </div>
                `;
        }
      }
    }

    // 渲染消息详情页面
    renderMessageDetail() {
      console.log('[Message App] 渲染消息详情');

      if (!this.currentFriendId) {
        console.error('[Message App] 没有选中的好友');
        return '<div class="error-message">没有选中的好友</div>';
      }

      if (window.renderMessageDetailForFriend) {
        // 返回加载占位符，然后异步加载真实内容
        setTimeout(() => {
          this.loadMessageDetailAsync();
        }, 100);

        // 根据是否为群聊添加对应的CSS class
        const isGroup = this.isCurrentChatGroup();
        const appClass = isGroup ? 'message-detail-app group-chat' : 'message-detail-app';
        const placeholder = isGroup ? '发送群聊消息...' : '发送消息...';

        return `
                <div class="${appClass}">
                    <div class="message-detail-content">
                        <div class="messages-loading">
                            <div class="loading-spinner"></div>
                            <span>正在加载消息...</span>
                        </div>
                    </div>
                    <div class="message-detail-footer">
                        <div class="message-send-area">
                            <div class="send-input-container">
                            <button class="send-tool-toggle-btn" id="detail-tool-toggle-btn" title="工具"><i class="fas fa-wrench"></i></button>
                                <textarea id="message-detail-input" placeholder="${placeholder}" maxlength="1000"></textarea>
                                <div class="send-tools" style="display: none;">
                                    <button class="send-tool-btn" id="detail-emoji-btn" title="表情"><i class="fas fa-smile"></i></button>
                                    <button class="send-tool-btn" id="detail-sticker-btn" title="表情包"><i class="fas fa-image"></i></button>
                                    <button class="send-tool-btn" id="detail-voice-btn" title="语音"><i class="fas fa-microphone"></i></button>
                                    <button class="send-tool-btn" id="detail-redpack-btn" title="红包"><i class="fas fa-gift"></i></button>
                                    <button class="send-tool-btn" id="detail-attachment-btn" title="附件"><i class="fas fa-folder"></i></button>
                                </div>

                                <button class="send-message-btn" id="detail-send-btn"><i class="fas fa-paper-plane"></i></button>
                            </div>

                        </div>
                    </div>
                </div>
            `;
      } else {
        return `
                <div class="message-detail-app">
                    <div class="message-detail-content">
                        <div class="error-messages">
                            <div class="error-icon">⚠️</div>
                            <div class="error-text">消息渲染器未加载</div>
                        </div>
                    </div>
                    <div class="message-detail-footer">
                        <div class="message-send-area">
                            <div class="send-input-container">
                            <button class="send-tool-toggle-btn" id="detail-tool-toggle-btn" title="工具"><i class="fas fa-wrench"></i></button>
                                <textarea id="message-detail-input" placeholder="发送消息..." maxlength="1000"></textarea>
                                <div class="send-tools" style="display: none;">
                                    <button class="send-tool-btn" id="detail-emoji-btn" title="表情"><i class="fas fa-smile"></i></button>
                                    <button class="send-tool-btn" id="detail-sticker-btn" title="表情包"><i class="fas fa-image"></i></button>
                                    <button class="send-tool-btn" id="detail-voice-btn" title="语音"><i class="fas fa-microphone"></i></button>
                                    <button class="send-tool-btn" id="detail-redpack-btn" title="红包"><i class="fas fa-gift"></i></button>
                                    <button class="send-tool-btn" id="detail-attachment-btn" title="附件"><i class="fas fa-folder"></i></button>
                                </div>

                                <button class="send-message-btn" id="detail-send-btn"><i class="fas fa-paper-plane"></i></button>
                            </div>

                        </div>
                    </div>
                </div>
            `;
      }
    }

    // 异步加载消息详情
    async loadMessageDetailAsync() {
      try {
        if (!window.renderMessageDetailForFriend) {
          throw new Error('消息渲染器未加载');
        }

        const content = await window.renderMessageDetailForFriend(this.currentFriendId, this.currentFriendName);

        const appContent = document.getElementById('app-content');
        if (appContent && this.currentView === 'messageDetail') {
          // 创建临时容器来处理内容
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = content;

          // 移除 message-detail-header
          const header = tempDiv.querySelector('.message-detail-header');
          if (header) {
            header.remove();
          }

          // 处理发送区域 - 无论是否存在都要替换
          let finalContent = tempDiv.innerHTML;

          // 创建我们的新发送区域HTML
          const newFooterHTML = `
                    <div class="message-detail-footer">
                        <div class="message-send-area">
                            <div class="send-input-container">
                            <button class="send-tool-toggle-btn" id="detail-tool-toggle-btn" title="工具"><i class="fas fa-wrench"></i></button>
                                <textarea id="message-detail-input" placeholder="发送消息..." maxlength="1000"></textarea>
                                <div class="send-tools" style="display: none;">
                                    <button class="send-tool-btn" id="detail-emoji-btn" title="表情"><i class="fas fa-smile"></i></button>
                                    <button class="send-tool-btn" id="detail-sticker-btn" title="表情包"><i class="fas fa-image"></i></button>
                                    <button class="send-tool-btn" id="detail-voice-btn" title="语音"><i class="fas fa-microphone"></i></button>
                                    <button class="send-tool-btn" id="detail-redpack-btn" title="红包"><i class="fas fa-gift"></i></button>
                                    <button class="send-tool-btn" id="detail-attachment-btn" title="附件"><i class="fas fa-folder"></i></button>
                                </div>

                                <button class="send-message-btn" id="detail-send-btn"><i class="fas fa-paper-plane"></i></button>
                            </div>
                        </div>
                    </div>`;

          // 如果存在旧的发送区域，移除它
          const existingFooter = tempDiv.querySelector('.message-detail-footer');
          if (existingFooter) {
            existingFooter.remove();
            if (window.DEBUG_MESSAGE_APP) {
              console.log('[Message App] 移除了现有的发送区域');
            }
          }

          // 在主容器末尾添加新的发送区域
          const mainContainer = tempDiv.querySelector('.message-detail-app, .message-detail-content');
          if (mainContainer) {
            mainContainer.insertAdjacentHTML('afterend', newFooterHTML);
          } else {
            // 如果没找到主容器，直接在最后添加
            tempDiv.insertAdjacentHTML('beforeend', newFooterHTML);
          }

          finalContent = tempDiv.innerHTML;
          appContent.innerHTML = finalContent;

          if (window.DEBUG_MESSAGE_APP) {
            console.log('[Message App] 已设置新的发送区域结构');
          }

          // 绑定新的事件
          if (window.bindMessageDetailEvents) {
            window.bindMessageDetailEvents();
          }

          // 绑定详情页面的发送事件
          this.bindDetailSendEvents();
        }
      } catch (error) {
        console.error('[Message App] 加载消息详情失败:', error);
        const appContent = document.getElementById('app-content');
        if (appContent && this.currentView === 'messageDetail') {
          appContent.innerHTML = `
                    <div class="message-detail-app">
                        <div class="message-detail-content">
                            <div class="error-messages">
                                <div class="error-icon">⚠️</div>
                                <div class="error-text">加载消息失败</div>
                                <div class="error-details">${error.message}</div>
                            </div>
                        </div>
                        <div class="message-detail-footer">
                            <div class="message-send-area">
                                <div class="send-input-container">
                                <button class="send-tool-toggle-btn" id="detail-tool-toggle-btn" title="工具">🔧</button>
                                    <textarea id="message-detail-input" placeholder="发送消息..." maxlength="1000"></textarea>
                                    <div class="send-tools" style="display: none;">
                                        <button class="send-tool-btn" id="detail-emoji-btn" title="表情">😊</button>
                                        <button class="send-tool-btn" id="detail-sticker-btn" title="表情包">🎭</button>
                                        <button class="send-tool-btn" id="detail-voice-btn" title="语音">🎤</button>
                                        <button class="send-tool-btn" id="detail-redpack-btn" title="红包">🧧</button>
                                        <button class="send-tool-btn" id="detail-attachment-btn" title="附件">📁</button>
                                    </div>

                                    <button class="send-message-btn" id="detail-send-btn">发送</button>
                                </div>

                            </div>
                        </div>
                    </div>
                `;
          this.bindEvents();
          this.bindDetailSendEvents();
        }
      }
    }

    // 添加好友
    async addFriend() {
      const nameInput = document.getElementById('friend-name');
      const numberInput = document.getElementById('friend-number');

      if (!nameInput || !numberInput) {
        this.showMessage('输入框未找到', 'error');
        return;
      }

      const name = nameInput.value.trim();
      const number = numberInput.value.trim();

      if (!name || !number) {
        this.showMessage('请填写所有字段', 'error');
        return;
      }

      // 无需检查重复，因为不再使用本地存储
      // 上下文编辑器会处理重复消息

      // 调用上下文编辑器添加到最新楼层
      try {
        await this.addToContext(name, number);
        this.showMessage('好友添加成功，已编辑到最新楼层！', 'success');

        // 延迟返回列表
        setTimeout(() => {
          this.showMessageList();
        }, 1500);
      } catch (error) {
        console.error('[Message App] 添加到上下文失败:', error);
        this.showMessage('好友添加成功，但编辑到上下文失败', 'warning');
      }
    }

    // 删除好友
    async deleteFriend(friendId, friendName) {
      // 确认删除
      if (
        !confirm(
          `确定要删除好友 "${friendName}" (ID: ${friendId}) 吗？\n\n这会删除消息中的好友格式标记和相关的消息记录。`,
        )
      ) {
        return;
      }

      try {
        // 使用上下文监控器提取相关消息
        if (!window.contextMonitor) {
          throw new Error('上下文监控器未加载');
        }

        this.showMessage('正在查找相关消息...', 'info');

        // 获取聊天消息
        const chatData = await window.contextMonitor.getCurrentChatMessages();
        if (!chatData || !chatData.messages) {
          throw new Error('无法获取聊天消息');
        }

        // 查找包含该好友信息的消息
        const messagesToProcess = [];

        // 使用统一的正则表达式管理器
        const contextMonitor =
          window['contextMonitor'] || (window['ContextMonitor'] ? new window['ContextMonitor']() : null);
        if (!contextMonitor) {
          throw new Error('上下文监控器未初始化');
        }

        // 创建好友相关的匹配器
        const friendMatchers = contextMonitor.createFriendMessageMatchers(friendId);
        const friendNameMatcher = contextMonitor.createFriendNameMatcher(friendName);

        // 创建好友格式标记的正则表达式
        const friendFormatRegex = new RegExp(`\\[好友id\\|${friendName}\\|${friendId}\\]`, 'g');

        chatData.messages.forEach((message, index) => {
          if (message.mes && typeof message.mes === 'string') {
            let messageModified = false;
            let newMessageContent = message.mes;
            let hasMyMessage = false;
            let hasOtherMessage = false;

            // 预处理：移除thinking标签包裹的内容进行检测
            const messageForCheck = this.removeThinkingTags(message.mes);

            // 检查是否包含好友格式标记（在移除thinking标签后的内容中）
            if (friendFormatRegex.test(messageForCheck)) {
              // 只移除不在thinking标签内的好友格式标记
              newMessageContent = this.removePatternOutsideThinkingTags(message.mes, friendFormatRegex);
              messageModified = newMessageContent !== message.mes;
              if (messageModified) {
                console.log(`[Message App] 消息 ${index} 包含好友格式标记，移除后内容: "${newMessageContent}"`);
              }
            }

            // 检查是否包含我方消息或对方消息格式（也要排除thinking标签内的内容）
            const messageForChatCheck = this.removeThinkingTags(message.mes);
            hasMyMessage = friendMatchers.myMessage.test(messageForChatCheck);
            hasOtherMessage = friendMatchers.otherMessage.test(messageForChatCheck);

            console.log(`[Message App] 消息 ${index} 分析结果:`, {
              hasFormatTag: messageModified,
              hasMyMessage,
              hasOtherMessage,
              originalLength: message.mes.length,
              newLength: newMessageContent.length,
              preview: message.mes.substring(0, 50) + '...',
            });

            // 决定处理方式
            if (hasMyMessage || hasOtherMessage) {
              // 如果包含聊天记录格式，删除整条消息
              messagesToProcess.push({
                index: index,
                id: message.id || index,
                action: 'delete',
                reason: '包含聊天记录格式',
                originalContent: message.mes,
                preview: message.mes.length > 50 ? message.mes.substring(0, 50) + '...' : message.mes,
              });
            } else if (messageModified) {
              // 只是移除格式标记，不删除整条消息
              messagesToProcess.push({
                index: index,
                id: message.id || index,
                action: 'modify',
                reason: '只移除好友格式标记',
                originalContent: message.mes,
                newContent: newMessageContent.trim(),
                preview: message.mes.length > 50 ? message.mes.substring(0, 50) + '...' : message.mes,
              });
            }

            // 重置正则表达式
            friendFormatRegex.lastIndex = 0;
            friendMatchers.myMessage.lastIndex = 0;
            friendMatchers.otherMessage.lastIndex = 0;
          }
        });

        if (messagesToProcess.length === 0) {
          this.showMessage('未找到相关消息记录', 'warning');
          return;
        }

        this.showMessage(`找到 ${messagesToProcess.length} 条相关消息，正在处理...`, 'info');

        // 检查移动端上下文编辑器是否可用
        if (!window.mobileContextEditor) {
          throw new Error('移动端上下文编辑器未加载');
        }

        if (!window.mobileContextEditor.isSillyTavernReady()) {
          throw new Error('SillyTavern未准备就绪');
        }

        // 从后往前处理，避免索引变化
        const sortedMessages = messagesToProcess.sort((a, b) => b.index - a.index);
        let processedCount = 0;

        for (const msgInfo of sortedMessages) {
          try {
            console.log(`[Message App] 处理消息 ${msgInfo.index}:`, {
              action: msgInfo.action,
              reason: msgInfo.reason,
              originalContent: msgInfo.originalContent?.substring(0, 100) + '...',
              newContent: msgInfo.newContent?.substring(0, 100) + '...',
            });

            if (msgInfo.action === 'delete') {
              // 删除整条消息（聊天记录）
              console.log(`[Message App] 删除消息 ${msgInfo.index}: ${msgInfo.reason}`);
              await window.mobileContextEditor.deleteMessage(msgInfo.index);
              console.log(`[Message App] ✅ 已删除消息 ${msgInfo.index}`);
            } else if (msgInfo.action === 'modify') {
              // 修改消息内容（移除格式标记）
              console.log(`[Message App] 修改消息 ${msgInfo.index}: ${msgInfo.reason}`);
              if (msgInfo.newContent.length > 0) {
                await window.mobileContextEditor.modifyMessage(msgInfo.index, msgInfo.newContent);
                console.log(`[Message App] ✅ 已修改消息 ${msgInfo.index}, 新内容: "${msgInfo.newContent}"`);
              } else {
                // 如果移除格式标记后消息为空，则删除整条消息
                console.log(`[Message App] 消息 ${msgInfo.index} 修改后为空，删除整条消息`);
                await window.mobileContextEditor.deleteMessage(msgInfo.index);
                console.log(`[Message App] ✅ 已删除空消息 ${msgInfo.index}`);
              }
            }
            processedCount++;
          } catch (error) {
            console.error(`[Message App] ❌ 处理消息 ${msgInfo.index} 失败:`, error);
          }
        }

        if (processedCount > 0) {
          this.showMessage(`成功处理好友 "${friendName}" 相关的 ${processedCount} 条消息`, 'success');

          // 刷新界面
          setTimeout(() => {
            this.refreshDeleteFriendList();
          }, 1000);
        } else {
          this.showMessage('处理失败', 'error');
        }
      } catch (error) {
        console.error('[Message App] 删除好友失败:', error);
        this.showMessage(`删除好友失败: ${error.message}`, 'error');
      }
    }

    // 添加到上下文
    async addToContext(friendName, friendNumber) {
      // 检查移动端上下文编辑器是否可用
      if (!window.mobileContextEditor) {
        throw new Error('移动端上下文编辑器未加载');
      }

      // 检查SillyTavern是否准备就绪
      if (!window.mobileContextEditor.isSillyTavernReady()) {
        throw new Error('SillyTavern未准备就绪');
      }

      // 格式化好友信息 - 使用固定的"好友id"文本
      const friendInfo = `[好友id|${friendName}|${friendNumber}]`;

      // 添加到最新楼层
      try {
        const messageIndex = await window.mobileContextEditor.addMessage(friendInfo, false, '系统');

        console.log(`[Message App] 好友信息已添加到消息 ${messageIndex}: ${friendInfo}`);

        // 自动保存已经在addMessage方法中完成

        return messageIndex;
      } catch (error) {
        console.error('[Message App] 添加消息失败:', error);
        throw error;
      }
    }

    // 获取随机头像
    getRandomAvatar() {
      // 返回空字符串，不显示表情符号，只显示背景图片
      return '';
    }

    // 🌟 新增：格式化文件大小
    formatFileSizeHelper(bytes) {
      if (bytes === 0) return '0 Bytes';

      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));

      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 🌟 新增：处理新的图片消息
    handleNewImageMessage(imageInfo) {
      try {
        console.log('[Message App] 🔍 处理新图片消息:', imageInfo);

        // 检查是否为当前聊天对象的消息
        if (imageInfo.chatTarget !== this.currentFriendId) {
          console.log('[Message App] 🔍 图片消息不属于当前聊天对象，跳过');
          return;
        }

        // 创建图片消息数据 - 明确标记为用户发送
        const imageMessage = {
          type: 'sent', // 用户发送的消息
          subType: 'image', // 图片类型
          isUser: true, // 明确标记为用户消息
          senderType: 'user', // 发送者类型
          friendName: imageInfo.chatName,
          qqNumber: imageInfo.chatTarget,
          content: '[图片]', // 简化内容显示
          imagePath: imageInfo.imagePath,
          fileName: imageInfo.fileName,
          fileSize: imageInfo.fileSize,
          fileType: imageInfo.fileType,
          time: imageInfo.time,
          timestamp: Date.now(),
          isImage: true,
          // 🌟 关键：生成简洁的HTML显示内容
          detailedContent: this.generateSimpleImageHTML(imageInfo.imagePath, imageInfo.fileName),
        };

        console.log('[Message App] 🔍 创建的图片消息数据:', imageMessage);

        // 添加到当前消息列表
        this.addImageMessageToCurrentChat(imageMessage);

        // 直接在界面中显示图片消息
        this.displayImageMessageDirectly(imageInfo);

        // 刷新界面显示
        this.refreshMessageDisplay();
      } catch (error) {
        console.error('[Message App] ❌ 处理新图片消息失败:', error);
      }
    }

    // 🌟 新增：生成图片HTML内容
    generateImageHTML(imagePath, fileName) {
      // 参考data-extractor.js的实现
      return `<img src="${imagePath}" alt="${fileName}"
        class="qq-image-message"
        style="max-width: 200px; max-height: 200px; border-radius: 8px; margin: 4px; cursor: pointer; background: transparent;"
        onclick="this.style.transform='scale(1.5)'; setTimeout(() => this.style.transform='scale(1)', 2000);"
        title="${fileName}">`;
    }

    // 🌟 新增：生成简洁的图片HTML内容 - 用户发送的图片
    generateSimpleImageHTML(imagePath, fileName) {
      return `<img src="${imagePath}" alt="${fileName}"
        class="user-sent-image"
        style="
          max-width: 200px;
          max-height: 300px;
          border-radius: 12px;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          object-fit: cover;
        "
        onclick="this.style.transform='scale(1.2)'; setTimeout(() => this.style.transform='scale(1)', 1500);"
        title="点击放大">`;
    }

    // 🌟 新增：添加图片消息到当前聊天
    addImageMessageToCurrentChat(imageMessage) {
      try {
        console.log('[Message App] 🔍 添加图片消息到聊天，当前好友ID:', this.currentFriendId);
        console.log('[Message App] 🔍 friendsData存在:', !!this.friendsData);
        console.log('[Message App] 🔍 friendsData类型:', typeof this.friendsData);

        // 确保friendsData存在
        if (!this.friendsData) {
          console.warn('[Message App] ⚠️ friendsData不存在，初始化...');
          this.friendsData = {};
        }

        // 确保当前好友数据存在
        if (!this.friendsData[this.currentFriendId]) {
          console.warn('[Message App] ⚠️ 当前好友数据不存在，创建...');
          this.friendsData[this.currentFriendId] = {
            friendId: this.currentFriendId,
            friendName: this.currentFriendName || imageMessage.friendName,
            messages: [],
            lastMessage: '',
            lastTime: '',
          };
        }

        // 添加到消息列表
        if (!this.friendsData[this.currentFriendId].messages) {
          this.friendsData[this.currentFriendId].messages = [];
        }

        this.friendsData[this.currentFriendId].messages.push(imageMessage);

        // 更新最后消息
        this.friendsData[this.currentFriendId].lastMessage = '[图片消息]';
        this.friendsData[this.currentFriendId].lastTime = imageMessage.time;

        console.log('[Message App] ✅ 图片消息已添加到聊天记录');
        console.log('[Message App] 🔍 当前好友消息数量:', this.friendsData[this.currentFriendId].messages.length);
      } catch (error) {
        console.error('[Message App] ❌ 添加图片消息失败:', error);
      }
    }

    // 🌟 新增：刷新消息显示
    refreshMessageDisplay() {
      try {
        console.log('[Message App] 🔍 开始刷新消息显示');
        console.log('[Message App] 🔍 当前好友ID:', this.currentFriendId);
        console.log('[Message App] 🔍 friendsData存在:', !!this.friendsData);

        // 确保friendsData存在
        if (!this.friendsData) {
          console.warn('[Message App] ⚠️ friendsData不存在，无法刷新消息显示');
          return;
        }

        // 刷新当前聊天的消息显示
        if (this.currentFriendId && window.messageRenderer) {
          console.log('[Message App] 🔍 刷新消息显示');

          // 获取当前好友的消息
          const friendData = this.friendsData[this.currentFriendId];
          console.log('[Message App] 🔍 当前好友数据:', friendData);

          if (friendData && friendData.messages) {
            console.log('[Message App] 🔍 当前好友消息数量:', friendData.messages.length);

            // 调用消息渲染器更新显示
            if (typeof window.messageRenderer.renderMessages === 'function') {
              console.log('[Message App] 🔍 使用renderMessages方法');
              window.messageRenderer.renderMessages(friendData.messages);
            } else if (typeof window.messageRenderer.refreshCurrentMessages === 'function') {
              console.log('[Message App] 🔍 使用refreshCurrentMessages方法');
              window.messageRenderer.refreshCurrentMessages();
            } else {
              console.warn('[Message App] ⚠️ 找不到合适的消息渲染方法');
            }
          } else {
            console.warn('[Message App] ⚠️ 当前好友数据或消息列表不存在');
          }
        } else {
          console.warn('[Message App] ⚠️ currentFriendId或messageRenderer不存在');
        }

        // 刷新好友列表（更新最后消息显示）
        console.log('[Message App] 🔍 刷新好友列表UI');
        this.refreshFriendListUI();

        console.log('[Message App] ✅ 消息显示刷新完成');
      } catch (error) {
        console.error('[Message App] ❌ 刷新消息显示失败:', error);
      }
    }

    // 🌟 新增：直接在消息列表中显示图片消息（简化版本）
    displayImageMessageDirectly(imageInfo) {
      try {
        console.log('[Message App] 🔍 直接显示图片消息:', imageInfo);

        // 查找消息列表容器
        const messageContainer =
          document.querySelector('.message-list') ||
          document.querySelector('#message-list') ||
          document.querySelector('.messages-container');

        if (!messageContainer) {
          console.warn('[Message App] ⚠️ 找不到消息列表容器，尝试创建...');
          // 如果找不到容器，尝试在当前页面中创建一个临时显示
          this.createTemporaryImageDisplay(imageInfo);
          return;
        }

        // 创建图片消息HTML - 简洁的右侧显示
        const imageMessageHTML = `
          <div class="message-detail sent image-message" style="
            display: flex;
            justify-content: flex-end;
            margin: 8px 10px;
            padding: 0;
          ">
            <div class="user-image-container" style="
              max-width: 70%;
              display: flex;
              justify-content: flex-end;
            ">
              <img src="${imageInfo.imagePath}"
                   alt="${imageInfo.fileName}"
                   class="user-sent-image"
                   style="
                     max-width: 200px;
                     max-height: 300px;
                     border-radius: 12px;
                     cursor: pointer;
                     box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                     object-fit: cover;
                   "
                   onclick="this.style.transform='scale(1.2)'; setTimeout(() => this.style.transform='scale(1)', 1500);"
                   title="点击放大">
            </div>
          </div>
        `;

        // 添加到消息容器
        messageContainer.insertAdjacentHTML('beforeend', imageMessageHTML);

        // 滚动到底部
        messageContainer.scrollTop = messageContainer.scrollHeight;

        console.log('[Message App] ✅ 图片消息已直接显示在界面中');
      } catch (error) {
        console.error('[Message App] ❌ 直接显示图片消息失败:', error);
      }
    }

    // 🌟 新增：创建临时图片显示
    createTemporaryImageDisplay(imageInfo) {
      try {
        console.log('[Message App] 🔍 创建临时图片显示');

        // 在页面顶部创建一个临时的图片显示区域
        const tempDisplay = document.createElement('div');
        tempDisplay.id = 'temp-image-display';
        tempDisplay.style.cssText = `
          position: fixed;
          top: 10px;
          right: 10px;
          z-index: 9999;
          background: white;
          border: 2px solid #4CAF50;
          border-radius: 8px;
          padding: 10px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
          max-width: 300px;
        `;

        tempDisplay.innerHTML = `
          <div style="margin-bottom: 8px; font-weight: bold; color: #4CAF50;">
            📱 新图片消息
          </div>
          <div style="margin-bottom: 8px;">
            <strong>发送给:</strong> ${imageInfo.chatName}
          </div>
          <div style="margin-bottom: 8px;">
            <img src="${imageInfo.imagePath}"
                 alt="${imageInfo.fileName}"
                 style="max-width: 100%; border-radius: 4px; cursor: pointer;"
                 onclick="this.style.transform='scale(1.2)'; setTimeout(() => this.style.transform='scale(1)', 1000);">
          </div>
          <div style="font-size: 12px; color: #666;">
            ${imageInfo.fileName} | ${this.formatFileSizeHelper(imageInfo.fileSize)}
          </div>
          <button onclick="this.parentElement.remove()"
                  style="margin-top: 8px; padding: 4px 8px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">
            关闭
          </button>
        `;

        // 移除之前的临时显示
        const existingTemp = document.getElementById('temp-image-display');
        if (existingTemp) {
          existingTemp.remove();
        }

        // 添加到页面
        document.body.appendChild(tempDisplay);

        // 5秒后自动移除
        setTimeout(() => {
          if (tempDisplay.parentElement) {
            tempDisplay.remove();
          }
        }, 5000);

        console.log('[Message App] ✅ 临时图片显示已创建');
      } catch (error) {
        console.error('[Message App] ❌ 创建临时图片显示失败:', error);
      }
    }

    // 显示消息
    showMessage(text, type = 'info') {
      // 创建消息提示
      const messageDiv = document.createElement('div');
      messageDiv.className = `message-toast ${type}`;
      messageDiv.textContent = text;
      messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10000;
            padding: 12px 24px;
            border-radius: 25px;
            color: white;
            font-size: 14px;
            max-width: 300px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            background: ${
              type === 'error' ? '#ff4444' : type === 'success' ? '#4CAF50' : type === 'warning' ? '#FF9800' : '#2196F3'
            };
            animation: messageSlideIn 0.3s ease-out;
        `;

      // 添加动画样式
      if (!document.getElementById('message-toast-style')) {
        const style = document.createElement('style');
        style.id = 'message-toast-style';
        style.textContent = `
                @keyframes messageSlideIn {
                    from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
                    to { transform: translateX(-50%) translateY(0); opacity: 1; }
                }
                @keyframes messageSlideOut {
                    from { transform: translateX(-50%) translateY(0); opacity: 1; }
                    to { transform: translateX(-50%) translateY(-100%); opacity: 0; }
                }
            `;
        document.head.appendChild(style);
      }

      document.body.appendChild(messageDiv);

      // 3秒后自动消失
      setTimeout(() => {
        messageDiv.style.animation = 'messageSlideOut 0.3s ease-out';
        setTimeout(() => {
          if (messageDiv.parentNode) {
            messageDiv.parentNode.removeChild(messageDiv);
          }
        }, 300);
      }, 3000);
    }

    // 打开聊天界面
    openChat(friendId) {
      // 使用好友渲染器获取好友信息
      if (window.friendRenderer) {
        const friend = window.friendRenderer.getFriendById(friendId);
        if (friend) {
          this.showMessageDetail(friendId, friend.name);
        } else {
          this.showMessage('好友信息未找到', 'error');
        }
      } else {
        this.showMessageDetail(friendId, null);
      }
    }

    // 显示消息详情页面
    showMessageDetail(friendId, friendName) {
     console.log(`[Message App] 显示消息详情: ${friendId}, ${friendName}`);

    // --- 🔴 新增：点开即标记已读 ---
    if (friendId && window.latestOrderMap) {
      // 拿到这个人目前在酒馆里最新的消息 ID (权重)
      const currentMax = window.latestOrderMap[friendId] || 0;
      // 把它存进“已读名单”
      localStorage.setItem(`lastRead_${friendId}`, currentMax);
      console.log(`[Message App] 已将好友 ${friendId} 标记为已读，权重: ${currentMax}`);
    }
    // ----------------------------

      this.currentView = 'messageDetail';
      this.currentFriendId = friendId;
      this.currentFriendName = friendName;
      // 注意：currentIsGroup 状态在 selectFriend() 方法中已经设置

      // 通知主框架更新应用状态
      if (window.mobilePhone) {
        const detailState = {
          app: 'messages',
          title: friendName || `好友 ${friendId}`,
          view: 'messageDetail',
          friendId: friendId,
          friendName: friendName,
        };
        window.mobilePhone.pushAppState(detailState);
      }

      // 更新应用内容
      this.updateAppContent();
    }

    // 立即应用好友专属背景
    applyFriendSpecificBackground(friendId) {
      try {
        console.log(`[Message App] 立即应用好友专属背景: ${friendId}`);

        // 确保styleConfigManager存在
        if (!window.styleConfigManager) {
          console.warn('[Message App] styleConfigManager未加载，无法应用好友背景');
          return;
        }

        // 获取好友背景配置
        const config = window.styleConfigManager.getConfig();
        if (!config.friendBackgrounds || config.friendBackgrounds.length === 0) {
          console.log('[Message App] 没有好友背景配置');
          return;
        }

        // 查找当前好友的背景配置
        const friendBackground = config.friendBackgrounds.find(bg => bg.friendId === friendId);
        if (!friendBackground) {
          console.log(`[Message App] 好友 ${friendId} 没有专属背景配置`);
          return;
        }

        // 查找消息详情容器
        const messageDetailContent = document.querySelector('.message-detail-content');
        if (!messageDetailContent) {
          console.warn('[Message App] 消息详情容器未找到');
          return;
        }

        // 立即应用背景样式
        const backgroundImage = friendBackground.backgroundImage || friendBackground.backgroundImageUrl;
        if (backgroundImage) {
          const rotation = parseFloat(friendBackground.rotation) || 0;
          const scale = parseFloat(friendBackground.scale) || 1;
          const backgroundPosition = friendBackground.backgroundPosition || 'center center';

          // 直接设置内联样式，确保立即生效
          messageDetailContent.style.backgroundImage = `url(${backgroundImage})`;
          messageDetailContent.style.backgroundSize = 'cover';
          messageDetailContent.style.backgroundPosition = backgroundPosition;
          messageDetailContent.style.backgroundRepeat = 'no-repeat';
          messageDetailContent.style.transform = `rotate(${rotation}deg) scale(${scale})`;
          messageDetailContent.style.transformOrigin = 'center center';

          console.log(`[Message App] ✅ 已立即应用好友 ${friendId} 的专属背景`);
        }
      } catch (error) {
        console.error('[Message App] 应用好友专属背景失败:', error);
      }
    }

    // 调试删除好友功能（不实际删除）
    async debugDeleteFriend(friendId, friendName) {
      console.log(`[Message App] 🔍 调试删除好友功能: ${friendName} (ID: ${friendId})`);

      try {
        // 使用上下文监控器提取相关消息
        if (!window.contextMonitor) {
          throw new Error('上下文监控器未加载');
        }

        // 获取聊天消息
        const chatData = await window.contextMonitor.getCurrentChatMessages();
        if (!chatData || !chatData.messages) {
          throw new Error('无法获取聊天消息');
        }

        console.log(`[Message App] 📊 总共有 ${chatData.messages.length} 条消息`);

        // 创建匹配器
        const contextMonitor =
          window['contextMonitor'] || (window['ContextMonitor'] ? new window['ContextMonitor']() : null);
        const friendMatchers = contextMonitor.createFriendMessageMatchers(friendId);
        const friendFormatRegex = new RegExp(`\\[好友id\\|${friendName}\\|${friendId}\\]`, 'g');

        let foundMessages = [];

        chatData.messages.forEach((message, index) => {
          if (message.mes && typeof message.mes === 'string') {
            let hasFormatTag = friendFormatRegex.test(message.mes);
            let hasMyMessage = friendMatchers.myMessage.test(message.mes);
            let hasOtherMessage = friendMatchers.otherMessage.test(message.mes);

            if (hasFormatTag || hasMyMessage || hasOtherMessage) {
              let newContent = message.mes.replace(friendFormatRegex, '');
              foundMessages.push({
                index,
                hasFormatTag,
                hasMyMessage,
                hasOtherMessage,
                originalContent: message.mes,
                newContent: newContent.trim(),
                wouldDelete: hasMyMessage || hasOtherMessage,
                wouldModify: hasFormatTag && !hasMyMessage && !hasOtherMessage,
                preview: message.mes.substring(0, 100) + (message.mes.length > 100 ? '...' : ''),
              });
            }

            // 重置正则表达式
            friendFormatRegex.lastIndex = 0;
            friendMatchers.myMessage.lastIndex = 0;
            friendMatchers.otherMessage.lastIndex = 0;
          }
        });

        console.log(`[Message App] 📋 找到 ${foundMessages.length} 条相关消息:`);
        foundMessages.forEach(msg => {
          console.log(`[Message App] 消息 ${msg.index}:`, {
            操作类型: msg.wouldDelete ? '🗑️ 删除整条消息' : msg.wouldModify ? '✏️ 修改消息内容' : '❓ 未知',
            包含格式标记: msg.hasFormatTag ? '✅' : '❌',
            包含我方消息: msg.hasMyMessage ? '✅' : '❌',
            包含对方消息: msg.hasOtherMessage ? '✅' : '❌',
            原始内容: msg.preview,
            修改后内容: msg.newContent ? msg.newContent.substring(0, 100) + '...' : '(空)',
          });
        });

        return foundMessages;
      } catch (error) {
        console.error('[Message App] 调试删除好友失败:', error);
        return [];
      }
    }

    // 绑定创建群聊事件
    bindCreateGroupEvents(appContent) {
      if (this.currentTab !== 'createGroup') return;

      // 全选好友按钮
      const selectAllBtn = appContent.querySelector('#select-all-friends');
      if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
          this.toggleSelectAllFriends();
        });
      }

      // 好友选择事件
      const friendItems = appContent.querySelectorAll('.friend-selection-item');
      friendItems.forEach(item => {
        const checkbox = item.querySelector('.friend-checkbox-input');
        if (checkbox) {
          checkbox.addEventListener('change', e => {
            this.handleFriendSelection(e.target, item);
          });
        }
      });

      // 创建群聊提交按钮
      const submitBtn = appContent.querySelector('#create-group-submit');
      if (submitBtn) {
        submitBtn.addEventListener('click', () => {
          this.createGroup();
        });
      }
    }

    // 绑定删除群聊事件
    bindDeleteGroupEvents(appContent) {
      if (this.currentTab !== 'deleteGroup') return;

      // 刷新群聊列表按钮
      const refreshBtn = appContent.querySelector('#refresh-group-list');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
          this.refreshDeleteGroupList();
        });
      }

      // 删除群聊按钮
      const deleteGroupBtns = appContent.querySelectorAll('.delete-group-btn');
      deleteGroupBtns.forEach(btn => {
        btn.addEventListener('click', e => {
          const target = e.currentTarget;
          const groupId = target.getAttribute('data-group-id');
          const groupName = target.getAttribute('data-group-name');
          if (groupId && groupName) {
            this.deleteGroup(groupId, groupName);
          }
        });
      });
    }

    // 切换全选好友
    toggleSelectAllFriends() {
      const checkboxes = document.querySelectorAll('.friend-checkbox-input');
      const allChecked = Array.from(checkboxes).every(cb => cb.checked);

      checkboxes.forEach(cb => {
        cb.checked = !allChecked;
        const item = cb.closest('.friend-selection-item');
        this.handleFriendSelection(cb, item);
      });

      // 更新按钮文本
      const selectAllBtn = document.querySelector('#select-all-friends');
      if (selectAllBtn) {
        selectAllBtn.textContent = allChecked ? '全选' : '取消全选';
      }
    }

    // 处理好友选择
    handleFriendSelection(checkbox, item) {
      const friendId = item.getAttribute('data-friend-id');
      const friendName = item.getAttribute('data-friend-name');
      const selectedMembersContainer = document.querySelector('#selected-members');

      if (checkbox.checked) {
        // 添加到已选成员
        const memberElement = document.createElement('div');
        memberElement.className = 'selected-member';
        memberElement.setAttribute('data-member-id', friendId);
        memberElement.innerHTML = `
                <span class="member-name">${friendName}</span>
                <button class="remove-member-btn" onclick="this.parentElement.remove(); document.querySelector('#friend-${friendId}').checked = false;">✕</button>
            `;
        selectedMembersContainer.appendChild(memberElement);
      } else {
        // 从已选成员中移除
        const memberElement = selectedMembersContainer.querySelector(`[data-member-id="${friendId}"]`);
        if (memberElement) {
          memberElement.remove();
        }
      }
    }

    // 创建群聊
    async createGroup() {
      const groupNameInput = document.getElementById('group-name');
      const groupIdInput = document.getElementById('group-id');

      if (!groupNameInput || !groupIdInput) {
        this.showMessage('输入框未找到', 'error');
        return;
      }

      const groupName = groupNameInput.value.trim();
      const groupId = groupIdInput.value.trim();

      if (!groupName || !groupId) {
        this.showMessage('请填写群聊名称和群聊ID', 'error');
        return;
      }

      // 获取已选成员
      const selectedMembers = this.getSelectedMembers();
      if (selectedMembers.length === 0) {
        this.showMessage('请至少选择一个群成员', 'error');
        return;
      }

      try {
        await this.addGroupToContext(groupName, groupId, selectedMembers);
        this.showMessage('群聊创建成功，已编辑到最新楼层！', 'success');

        // 延迟返回列表
        setTimeout(() => {
          this.showMessageList();
        }, 1500);
      } catch (error) {
        console.error('[Message App] 创建群聊失败:', error);
        this.showMessage('群聊创建失败', 'error');
      }
    }

    // 获取已选成员
    getSelectedMembers() {
      const selectedMembers = ['我']; // 群主默认在群里
      const memberElements = document.querySelectorAll('#selected-members .selected-member:not(.default-member)');

      memberElements.forEach(element => {
        const memberName = element.querySelector('.member-name').textContent;
        selectedMembers.push(memberName);
      });

      return selectedMembers;
    }

    // 将群聊信息添加到上下文
    async addGroupToContext(groupName, groupId, members) {
      // 检查移动端上下文编辑器是否可用
      if (!window.mobileContextEditor) {
        throw new Error('移动端上下文编辑器未加载');
      }

      // 检查SillyTavern是否准备就绪
      if (!window.mobileContextEditor.isSillyTavernReady()) {
        throw new Error('SillyTavern未准备就绪');
      }

      // 格式化群聊信息：[群聊|群名|群ID|群成员]
      const membersStr = members.join('、');
      const groupInfo = `[群聊|${groupName}|${groupId}|${membersStr}]`;

      // 添加到最新楼层
      try {
        const messageIndex = await window.mobileContextEditor.addMessage(groupInfo, false, '系统');
        console.log(`[Message App] 群聊信息已添加到消息 ${messageIndex}: ${groupInfo}`);
        return messageIndex;
      } catch (error) {
        console.error('[Message App] 添加群聊消息失败:', error);
        throw error;
      }
    }

    // 删除群聊
    async deleteGroup(groupId, groupName) {
      // 确认删除
      if (
        !confirm(
          `确定要删除群聊 "${groupName}" (ID: ${groupId}) 吗？\n\n这会删除消息中的群聊格式标记和相关的消息记录。`,
        )
      ) {
        return;
      }

      try {
        // 使用类似删除好友的逻辑
        if (!window.contextMonitor) {
          throw new Error('上下文监控器未加载');
        }

        this.showMessage('正在查找相关群聊消息...', 'info');

        // 获取聊天消息
        const chatData = await window.contextMonitor.getCurrentChatMessages();
        if (!chatData || !chatData.messages) {
          throw new Error('无法获取聊天消息');
        }

        // 查找包含该群聊信息的消息
        const messagesToProcess = [];

        // 创建所有可能包含群聊ID的格式正则表达式
        // 只要[]内任何位置包含目标ID就匹配
        const allGroupFormatsRegex = new RegExp(`\\[[^\\]]*\\|${groupId}\\|[^\\]]*\\]|\\[[^\\]]*\\|${groupId}\\]`, 'g');

        chatData.messages.forEach((message, index) => {
          if (message.mes && typeof message.mes === 'string') {
            let messageModified = false;
            let newMessageContent = message.mes;

            // 预处理：移除thinking标签包裹的内容进行检测
            const messageForCheck = this.removeThinkingTags(message.mes);

            // 检查是否包含群聊格式标记（在移除thinking标签后的内容中）
            if (allGroupFormatsRegex.test(messageForCheck)) {
              // 只移除不在thinking标签内的群聊格式标记
              newMessageContent = this.removePatternOutsideThinkingTags(message.mes, allGroupFormatsRegex);
              messageModified = newMessageContent !== message.mes;
              if (messageModified) {
                console.log(`[Message App] 消息 ${index} 包含群聊格式标记，移除后内容: "${newMessageContent}"`);
              }
            }

            if (messageModified) {
              messagesToProcess.push({
                index: index,
                id: message.id || index,
                action: newMessageContent.trim().length > 0 ? 'modify' : 'delete',
                reason: '移除群聊格式标记',
                originalContent: message.mes,
                newContent: newMessageContent.trim(),
                preview: message.mes.length > 50 ? message.mes.substring(0, 50) + '...' : message.mes,
              });
            }

            // 重置正则表达式
            allGroupFormatsRegex.lastIndex = 0;
          }
        });

        if (messagesToProcess.length === 0) {
          this.showMessage('未找到相关群聊记录', 'warning');
          return;
        }

        this.showMessage(`找到 ${messagesToProcess.length} 条相关消息，正在处理...`, 'info');

        // 检查移动端上下文编辑器是否可用
        if (!window.mobileContextEditor) {
          throw new Error('移动端上下文编辑器未加载');
        }

        if (!window.mobileContextEditor.isSillyTavernReady()) {
          throw new Error('SillyTavern未准备就绪');
        }

        // 从后往前处理，避免索引变化
        const sortedMessages = messagesToProcess.sort((a, b) => b.index - a.index);
        let processedCount = 0;

        for (const msgInfo of sortedMessages) {
          try {
            if (msgInfo.action === 'delete') {
              console.log(`[Message App] 删除消息 ${msgInfo.index}: ${msgInfo.reason}`);
              await window.mobileContextEditor.deleteMessage(msgInfo.index);
              console.log(`[Message App] ✅ 已删除消息 ${msgInfo.index}`);
            } else if (msgInfo.action === 'modify') {
              console.log(`[Message App] 修改消息 ${msgInfo.index}: ${msgInfo.reason}`);
              await window.mobileContextEditor.modifyMessage(msgInfo.index, msgInfo.newContent);
              console.log(`[Message App] ✅ 已修改消息 ${msgInfo.index}, 新内容: "${msgInfo.newContent}"`);
            }
            processedCount++;
          } catch (error) {
            console.error(`[Message App] ❌ 处理消息 ${msgInfo.index} 失败:`, error);
          }
        }

        if (processedCount > 0) {
          this.showMessage(`成功处理群聊 "${groupName}" 相关的 ${processedCount} 条消息`, 'success');

          // 刷新界面
          setTimeout(() => {
            this.refreshDeleteGroupList();
          }, 1000);
        } else {
          this.showMessage('处理失败', 'error');
        }
      } catch (error) {
        console.error('[Message App] 删除群聊失败:', error);
        this.showMessage(`删除群聊失败: ${error.message}`, 'error');
      }
    }

    // 刷新删除群聊列表
    refreshDeleteGroupList() {
      if (this.currentView === 'addFriend' && this.currentTab === 'deleteGroup') {
        this.updateAppContent();
      }
    }

    // 切换工具栏显示状态
    toggleToolsFloatingPanel() {
      const sendTools = document.querySelector('.send-tools');

      if (!sendTools) {
        console.warn('[Message App] 找不到工具栏元素');
        return;
      }

      // 切换显示状态
      if (sendTools.style.display === 'none') {
        // 显示工具栏
        sendTools.style.display = 'flex';
        console.log('[Message App] 工具栏已显示');
      } else {
        // 隐藏工具栏
        sendTools.style.display = 'none';
        console.log('[Message App] 工具栏已隐藏');
      }
    }

    // 调试工具切换按钮
    debugToolToggleButton() {
      console.log('[Message App Debug] 检查工具切换按钮状态:');
      console.log('  - 当前视图:', this.currentView);
      console.log('  - 当前好友ID:', this.currentFriendId);

      const toggleBtn = document.querySelector('#detail-tool-toggle-btn');
      console.log('  - 工具切换按钮存在:', !!toggleBtn);

      if (toggleBtn) {
        console.log('  - 按钮可见:', toggleBtn.style.display !== 'none');
        console.log('  - 按钮文本:', toggleBtn.textContent);
        console.log('  - 按钮位置:', toggleBtn.getBoundingClientRect());
      }

      const sendTools = document.querySelector('.send-tools');
      console.log('  - 发送工具区域存在:', !!sendTools);

      if (sendTools) {
        console.log('  - 发送工具区域可见:', sendTools.style.display !== 'none');
      }

      const sendInputContainer = document.querySelector('.send-input-container');
      console.log('  - 发送输入容器存在:', !!sendInputContainer);

      if (sendInputContainer) {
        console.log('  - 容器内的按钮数量:', sendInputContainer.querySelectorAll('button').length);
        const buttons = sendInputContainer.querySelectorAll('button');
        buttons.forEach((btn, index) => {
          console.log(`    按钮${index + 1}: ${btn.className} - ${btn.textContent}`);
        });
      }
    }

    // 强制刷新消息详情页面
    forceRefreshMessageDetailPage() {
      console.log('[Message App] 🔄 强制刷新消息详情页面...');

      if (this.currentView !== 'messageDetail' || !this.currentFriendId) {
        console.warn('[Message App] 当前不在消息详情页面');
        return;
      }

      // 重新触发消息详情异步加载
      setTimeout(() => {
        this.loadMessageDetailAsync();
      }, 100);

      console.log('[Message App] ✅ 已触发强制刷新');
    }

    /**
     * 清理事件监听器
     */
    cleanup() {
      try {
        if (this.isEventListening && this.eventSource && this.event_types) {
          if (typeof this.eventSource.off === 'function') {
            this.eventSource.off(this.event_types.MESSAGE_RECEIVED, this.onMessageReceived);
            console.log('[Message App] 已清理事件监听器');
          }
        }

        // 清理轮询
        if (this.pollingInterval) {
          clearInterval(this.pollingInterval);
          this.pollingInterval = null;
        }

        // 取消延迟渲染
        this.cancelDelayedRender();

        this.isEventListening = false;
      } catch (error) {
        console.error('[Message App] 清理事件监听器失败:', error);
      }
    }

    // 调试thinking标签功能
    debugThinkingTagsFunction(testText) {
      console.log('[Message App Debug] 🧠 测试thinking标签功能');

      const sampleText =
        testText ||
        `
测试内容1 [好友id|张三|123456]
<thinking>
这里是思考内容，包含一个好友：[好友id|李四|789012]
还有群聊：[群聊|测试群|555|张三、李四]
</thinking>
测试内容2 [群聊|工作群|888|张三、王五]
<think>
另一个思考：[好友id|王五|333444]
</think>
正常内容 [好友id|赵六|666777]
        `;

      console.log('原始文本:', sampleText);
      console.log('');

      // 测试移除thinking标签
      const textWithoutThinking = this.removeThinkingTags(sampleText);
      console.log('移除thinking标签后:', textWithoutThinking);
      console.log('');

      // 测试好友格式检测
      const friendRegex = /\[好友id\|([^|]+)\|([^|]+)\]/g;
      console.log('好友格式匹配（原始文本）:');
      let match;
      friendRegex.lastIndex = 0;
      while ((match = friendRegex.exec(sampleText)) !== null) {
        const start = match.index;
        const end = match.index + match[0].length;
        const isInThinking = this.isPatternInsideThinkingTags(sampleText, start, end);
        console.log(`  - ${match[0]} (位置${start}-${end}) 在thinking内: ${isInThinking}`);
      }
      console.log('');

      // 测试移除thinking外的好友格式
      const cleanedText = this.removePatternOutsideThinkingTags(sampleText, /\[好友id\|([^|]+)\|([^|]+)\]/g);
      console.log('移除thinking外好友格式后:', cleanedText);
      console.log('');

      // 测试群聊格式
      const groupRegex = /\[群聊\|([^|]+)\|([^|]+)\|([^\]]+)\]/g;
      console.log('群聊格式匹配（原始文本）:');
      groupRegex.lastIndex = 0;
      while ((match = groupRegex.exec(sampleText)) !== null) {
        const start = match.index;
        const end = match.index + match[0].length;
        const isInThinking = this.isPatternInsideThinkingTags(sampleText, start, end);
        console.log(`  - ${match[0]} (位置${start}-${end}) 在thinking内: ${isInThinking}`);
      }

      const cleanedText2 = this.removePatternOutsideThinkingTags(cleanedText, /\[群聊\|([^|]+)\|([^|]+)\|([^\]]+)\]/g);
      console.log('移除thinking外群聊格式后:', cleanedText2);

      return {
        original: sampleText,
        withoutThinking: textWithoutThinking,
        afterFriendRemoval: cleanedText,
        afterGroupRemoval: cleanedText2,
      };
    }

    // 调试好友渲染器的thinking标签处理
    debugFriendRendererThinking() {
      console.log('[Message App Debug] 🔍 检查好友渲染器的thinking标签处理');

      // 检查好友渲染器是否存在
      if (!window.friendRenderer) {
        console.warn('❌ 好友渲染器不存在');
        return {
          error: '好友渲染器不存在',
        };
      }

      console.log('✅ 好友渲染器已加载');

      // 检查好友渲染器是否有thinking标签处理方法
      const hasRemoveThinking = typeof window.friendRenderer.removeThinkingTags === 'function';
      const hasPatternOutside = typeof window.friendRenderer.removePatternOutsideThinkingTags === 'function';

      console.log('好友渲染器方法检查:');
      console.log('  - removeThinkingTags方法:', hasRemoveThinking ? '✅ 存在' : '❌ 不存在');
      console.log('  - removePatternOutsideThinkingTags方法:', hasPatternOutside ? '✅ 存在' : '❌ 不存在');

      // 获取当前提取的好友列表
      let extractedFriends = [];
      try {
        if (typeof window.friendRenderer.extractFriendsFromContext === 'function') {
          extractedFriends = window.friendRenderer.extractFriendsFromContext();
          console.log(`当前提取的好友数量: ${extractedFriends.length}`);

          // 显示前5个好友的详情
          extractedFriends.slice(0, 5).forEach((friend, index) => {
            console.log(`好友 ${index + 1}:`, {
              name: friend.name,
              number: friend.number,
              source: friend.source || '未知来源',
            });
          });
        }
      } catch (error) {
        console.error('❌ 提取好友列表失败:', error);
      }

      // 建议修复方案
      if (!hasRemoveThinking || !hasPatternOutside) {
        console.log('');
        console.log('🔧 修复建议:');
        console.log('需要在好友渲染器中添加thinking标签处理方法。');
        console.log('可以将MessageApp中的thinking处理方法复制到好友渲染器中。');

        if (
          window.friendRenderer.addThinkingTagSupport &&
          typeof window.friendRenderer.addThinkingTagSupport === 'function'
        ) {
          console.log('');
          console.log('🚀 尝试自动修复...');
          try {
            // 将MessageApp的thinking方法添加到好友渲染器
            window.friendRenderer.removeThinkingTags = this.removeThinkingTags.bind(this);
            window.friendRenderer.isPatternInsideThinkingTags = this.isPatternInsideThinkingTags.bind(this);
            window.friendRenderer.removePatternOutsideThinkingTags = this.removePatternOutsideThinkingTags.bind(this);

            console.log('✅ 已将thinking处理方法添加到好友渲染器');

            // 触发重新提取
            if (typeof window.friendRenderer.refresh === 'function') {
              window.friendRenderer.refresh();
              console.log('✅ 已触发好友渲染器刷新');
            }
          } catch (error) {
            console.error('❌ 自动修复失败:', error);
          }
        }
      }

      return {
        hasThinkingSupport: hasRemoveThinking && hasPatternOutside,
        friendCount: extractedFriends.length,
        friends: extractedFriends.slice(0, 3), // 返回前3个好友作为示例
        canAutoFix: typeof window.friendRenderer.addThinkingTagSupport === 'function',
      };
    }

    // 移除thinking标签包裹的内容
    removeThinkingTags(text) {
      if (!text || typeof text !== 'string') {
        return text;
      }

      // 移除 <think>...</think> 和 <thinking>...</thinking> 标签及其内容
      const thinkingTagRegex = /<think>[\s\S]*?<\/think>|<thinking>[\s\S]*?<\/thinking>/gi;
      return text.replace(thinkingTagRegex, '');
    }

    // 检查格式标记是否在thinking标签内
    isPatternInsideThinkingTags(text, patternStart, patternEnd) {
      if (!text || typeof text !== 'string') {
        return false;
      }

      const thinkingTagRegex = /<think>[\s\S]*?<\/think>|<thinking>[\s\S]*?<\/thinking>/gi;
      let match;

      while ((match = thinkingTagRegex.exec(text)) !== null) {
        const thinkStart = match.index;
        const thinkEnd = match.index + match[0].length;

        // 检查格式标记是否完全在thinking标签内
        if (patternStart >= thinkStart && patternEnd <= thinkEnd) {
          return true;
        }
      }

      return false;
    }

    // 只移除不在thinking标签内的格式标记
    removePatternOutsideThinkingTags(text, pattern) {
      if (!text || typeof text !== 'string') {
        return text;
      }

      // 创建新的正则表达式实例，避免lastIndex问题
      const newPattern = new RegExp(pattern.source, pattern.flags);
      let result = text;
      const replacements = [];
      let match;

      // 找到所有匹配
      while ((match = newPattern.exec(text)) !== null) {
        const matchStart = match.index;
        const matchEnd = match.index + match[0].length;

        // 检查这个匹配是否在thinking标签内
        if (!this.isPatternInsideThinkingTags(text, matchStart, matchEnd)) {
          replacements.push({
            start: matchStart,
            end: matchEnd,
            text: match[0],
          });
        }
      }

      // 从后往前替换，避免索引问题
      replacements.reverse().forEach(replacement => {
        result = result.substring(0, replacement.start) + result.substring(replacement.end);
      });

      return result;
    }
  }

  // 创建全局实例
  window.MessageApp = MessageApp;

  // 为mobile-phone.js提供的接口
  window.getMessageAppContent = function () {
    console.log('[Message App] 获取应用内容');

    if (!window.messageApp) {
      console.log('[Message App] 创建新实例');
      window.messageApp = new MessageApp();
    }

    // 检查实例是否已经初始化完成
    if (!window.messageApp || window.messageApp.currentView === undefined) {
      console.log('[Message App] 实例未完全初始化，返回加载占位符');
      return `
            <div class="messages-app">
                <div class="loading-placeholder">
                    <div class="loading-icon">⏳</div>
                    <div class="loading-text">正在加载消息应用...</div>
                </div>
            </div>
        `;
    }

    // 确保currentView有效
    if (!['list', 'addFriend', 'messageDetail'].includes(window.messageApp.currentView)) {
      console.log('[Message App] 重置currentView为list');
      window.messageApp.currentView = 'list';
    }

    const content = window.messageApp.getAppContent();
    console.log('[Message App] 返回内容，长度:', content.length, '当前视图:', window.messageApp.currentView);
    return content;
  };

  window.bindMessageAppEvents = function () {
    console.log('[Message App] 绑定应用事件');
    if (window.messageApp) {
      window.messageApp.bindEvents();
      console.log('[Message App] 事件绑定完成');
    } else {
      console.warn('[Message App] 应用实例不存在');
    }
  };

  console.log('[Message App] 信息应用模块加载完成');
} // 结束 if (typeof window.MessageApp === 'undefined') 检查

(function injectTheUltimateSystemV12() {
    /**
     * 【第一部分：永久好友配置区】
     */
    const PERMANENT_CONTACTS = {
        "103": { name: "陈一众", tag: "❤️", isSpecial: true, avatar: "https://github.com/leafwither-star/touxiang2/blob/main/b2de9c82d158ccbfa6be0223686f5030b03541eb.jpeg?raw=true" },
        "102": { name: "曹信", tag: "❤️", isSpecial: true, avatar: "你的Github链接" },
        "104": { name: "张主任", tag: "✨", isSpecial: false },
        "105": { name: "张小满", tag: "✨", isSpecial: false },
        "106": { name: "赵霆", tag: "🎓", isSpecial: false },
        "107": { name: "苏蔓", tag: "🎓", isSpecial: false },
      
       // --- 律所权力金字塔 ---
        "141": { name: "顾远山 (授薪合伙人)", tag: "⚖️", isSpecial: false }, 
        "142": { name: "秦克勤 (管委会)", tag: "⚖️", isSpecial: false }, 
        "143": { name: "行政总监-财务赵姐", tag: "💰", isSpecial: false },
        "144": { name: "高级顾问-郑老", tag: "👴", isSpecial: false }, // 退休的大法官，律所的定海神针

        // --- 同事与友商阵列 (150-170) ---
        "150": { name: "沈冰沁 (Senior)", tag: "💼", isSpecial: false },
        "151": { name: "何一帆 (Junior)", tag: "💼", isSpecial: false },
        "152": { name: "陆子昂 (诉讼组)", tag: "💼", isSpecial: false },
        "153": { name: "周以诺 (Associate)", tag: "💼", isSpecial: false },
        "154": { name: "蒋承泽 (Associate)", tag: "💼", isSpecial: false },
        "155": { name: "方廷皓 (金杜律所-友商)", tag: "💼", isSpecial: false }, 
        "156": { name: "实习生-陈希(北大师弟)", tag: "💼", isSpecial: false },
        "157": { name: "翻译-Katherine", tag: "💼", isSpecial: false },
        "158": { name: "文印/快递-小赵", tag: "💼", isSpecial: false },
        "159": { name: "风控合规-张曼", tag: "💼", isSpecial: false },
        "160": { name: "律所后勤-王阿姨", tag: "💼", isSpecial: false },
        "161": { name: "钟意(内核组)", tag: "💼", isSpecial: false },
        "162": { name: "人力资源-邱总", tag: "💼", isSpecial: false },
        "163": { name: "苏平周律师", tag: "💼", isSpecial: false },
        "164": { name: "档案室-小张", tag: "💼", isSpecial: false },
        "165": { name: "税务咨询-杜若", tag: "💼", isSpecial: false },
        "166": { name: "信管部-何子晴", tag: "💼", isSpecial: false },
        "167": { name: "财务-周静", tag: "💼", isSpecial: false },
        "168": { name: "后勤-陈叔", tag: "💼", isSpecial: false },
        "169": { name: "顾远山秘书-Lily", tag: "💼", isSpecial: false },

        // --- 客户与项目合作方 (170-220) ---
        "170": { name: "星辉创投-黎总", tag: "💎", isSpecial: false },
        "171": { name: "远洋地产-法务总", tag: "💎", isSpecial: false },
        "172": { name: "蓝鲸科技-王董", tag: "💎", isSpecial: false },
        "173": { name: "苏太太 (LP成员)", tag: "💎", isSpecial: false },
        "174": { name: "瑞银 IBD-James", tag: "🏦", isSpecial: false }, // 投行合作方
        "175": { name: "字节并购-刘经理", tag: "💎", isSpecial: false },
        "176": { name: "董秘-林舒(拟上市)", tag: "💎", isSpecial: false },
        "177": { name: "审计师-普华永道老张", tag: "📊", isSpecial: false }, // 四大会计师事务所
        "178": { name: "理财顾问-私人银行", tag: "💰", isSpecial: false },
        "179": { name: "泰康人寿-陈经理", tag: "💎", isSpecial: false },
        "180": { name: "韩总 (投后管理)", tag: "💎", isSpecial: false },

        // --- 公众号矩阵 (100-120) ---
        "100": { name: "服务通知", tag: "📢", isSpecial: false },
        "101": { name: "北京实时", tag: "🗞️", isSpecial: false }, 
        "108": { name: "VOGUE时尚前沿", tag: "👗", isSpecial: false },
        "109": { name: "深夜情感FM", tag: "🌙", isSpecial: false },
        "111": { name: "百夫长黑卡管家", tag: "🛎️", isSpecial: false },
        "112": { name: "最高法判例观察", tag: "📖", isSpecial: false },
        "113": { name: "律政寄信", tag: "📫", isSpecial: false },
        "114": { name: "SKP-S 会员中心", tag: "🛍️", isSpecial: false } // 北京最高端的商场，李至中买衣服的地方
    };

    const CLOUD_IDS = Object.keys(PERMANENT_CONTACTS);

    /**
     * 【第二部分：全套样式注入 (CSS)】
     */
    const styleId = 'ultimate-unified-style-v12';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            /* 列表基础样式 */
            .custom-timestamp { position: absolute !important; top: 10px !important; right: 15px !important; font-size: 11px !important; color: #b0b0b0 !important; z-index: 10 !important; }
            .unread-dot { position: absolute !important; top: 10px !important; left: 56px !important; width: 10px !important; height: 10px !important; background: #ff4d4f !important; border-radius: 50% !important; border: 1.5px solid white !important; z-index: 11 !important; }
            .special-friend-name { color: #333 !important; font-weight: 900 !important; }
            .special-friend-avatar { box-shadow: 0 0 8px rgba(251, 171, 81, 0.6) !important; border: 1.5px solid #fbab51 !important; border-radius: 50%; }
            .force-call-tag { color: #07c160 !important; font-weight: 500 !important; }

            /* 红包基础样式 */
            .beautiful-packet { background: linear-gradient(135deg, #fbab51 0%, #ff7849 100%) !important; color: white !important; border-radius: 12px !important; padding: 12px 16px !important; min-width: 195px !important; max-width: 220px !important; cursor: pointer; display: block !important; box-shadow: 0 4px 12px rgba(250,158,59,0.3) !important; font-size: 14px !important; position: relative; margin-left: 0px !important; }
            
            /* 通话卡片基础容器 (微调版：高度和布局更稳) */
            .call-record-card {
                background: #ffffff !important;
                border: 1px solid #eeeeee !important;
                border-radius: 8px !important;
                width: 195px !important;
                height: 62px !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: center !important;
                padding: 0 14px !important;
                box-sizing: border-box !important;
                cursor: pointer;
                margin: 4px 0 !important;
                position: relative;
                transition: all 0.2s ease;
            }

            .call-row-top { 
                font-size: 15px !important; 
                font-weight: 500 !important; 
                color: #000 !important; 
                display: flex !important; 
                align-items: center !important; 
                gap: 4px !important; 
                line-height: 1.2 !important; 
            }
            
            /* 第二行：改为左右两端对齐，给蓝色图标腾位置 */
            .call-row-bottom { 
                font-size: 11px !important; 
                color: #999999 !important; 
                margin-top: 8px !important; 
                display: flex !important; 
                justify-content: space-between !important; 
                align-items: center !important; 
                line-height: 1 !important;
                padding-left: 2px !important;
            }

            /* 新增：蓝色书本图标按钮 */
            .read-icon-btn {
                color: #007AFF !important; 
                font-size: 14px !important;
                cursor: pointer !important;
                padding: 2px 4px !important;
                font-weight: bold !important;
            }

            /* 新增：通话详情预览区 (圆角 12px，与红包对齐) */
            .call-text-preview {
                width: 195px !important;
                background: #fafafa !important;
                border: 1px solid #eeeeee !important;
                border-top: none !important;
                border-radius: 0 0 12px 12px !important;
                padding: 10px 14px !important;
                font-size: 12px !important;
                color: #777 !important;
                display: none; 
                box-sizing: border-box !important;
                line-height: 1.5 !important;
                white-space: pre-wrap !important;
                margin-top: -6px !important;
                margin-bottom: 8px !important;
            }
            
            /* 动画效果 */
            @keyframes breathe-v16 { 0%, 100% { transform: scale(1); opacity: 0.3; } 50% { transform: scale(1.3); opacity: 0.6; } }
            .soul-bubble-v16 { background: rgba(255,255,255,0.12); backdrop-filter: blur(15px); padding: 12px 18px; border-radius: 20px; font-size: 14px; color: white; max-width: 85%; margin-bottom: 8px; animation: in-v16 0.5s ease forwards; text-align: center; }
            @keyframes in-v16 { from { transform: translateY(15px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

            /* =========================================
               这里是重点：修正红包位置和圆角的 CSS 规则
               必须写在反引号内，作为字符串传给 innerHTML
               ========================================= */
            .message-received .message-text:has(.beautiful-packet) {
                display: block !important;
                text-align: left !important;
                overflow: visible !important;
                padding-top: 8px !important;
                padding-bottom: 8px !important;
                width: 100% !important;
                background: transparent !important;
            }

            .message-received .message-text .beautiful-packet {
                margin-left: 0 !important;
                margin-right: auto !important;
                display: block !important;
                position: relative !important;
                left: 0 !important;
            }
        
       /* --- 天气卡片：极致镇压样式 --- */
.service-card-bubble { 
    background: transparent !important; 
    border: none !important; 
    box-shadow: none !important; 
    padding: 0 !important;
    margin-top: -54px !important; /* 你调好的位移 t */
    margin-left: 0px !important;
    transition: none !important;
    overflow: visible !important;
}
.service-card-bubble:hover { transform: none !important; }
.service-card-text { padding: 0 !important; background: transparent !important; }

/* 天气图标专属浮动动画 */
@keyframes weatherFloat { 
    0%, 100% { transform: translateY(-50%) scale(1); } 
    50% { transform: translateY(-55%) scale(1.05); } 
}
        `; // <--- 确保反引号在这里关闭
        document.head.appendChild(style);
    }

    /**
 * 【第三部分：交互全系统】
 */

// --- 1. 全局配置区（放在所有函数最外面，确保谁都能看见） ---
const GLOBAL_API_KEY = "sk-api-GrT5JQEsxMW3uuOzlx7vsgT8WoLW99MkJd6D-Wq4xlTcqgwOmOuj4V9FlBC6URQyzfp9pORAs2Tc2dXzGFVsvWeKbUCW2ipbWI2xMyspz8JDplgh768efYY"; 
const GLOBAL_GROUP_ID = "2014232095953523532";

/**
 * 终极 TTS 引擎：支持微信语音格式提取 & 通话记录格式提取
 */
window.fetchAndPlayVoice = async function(rawLine) {
    if (!rawLine) return;

    // 内部直接使用外部定义的全局变量
    let voiceId = "Chinese (Mandarin)_Reliable_Executive"; 
    let speakerName = "陈一众"; 
    let cleanText = "";

    // --- 逻辑 A：处理微信语音插件格式 ---
    if (rawLine.includes("对方消息|") || rawLine.includes("消息|")) {
        const nameMatch = rawLine.match(/\|([^|]+)\|103\|/); 
        speakerName = nameMatch ? nameMatch[1] : "陈一众";
        cleanText = rawLine.replace(/\[.*?\]/g, '')
                          .replace(/[▶\d:：语音\s]+/g, '')
                          .trim();
    } 
    // --- 逻辑 B：处理通话记录格式 ---
    else if (rawLine.includes("：") || rawLine.includes(":")) {
        const parts = rawLine.split(/[：:]/);
        speakerName = parts[0].trim();
        cleanText = parts.slice(1).join("：").trim();
    } else {
        cleanText = rawLine.trim();
    }

    // --- 嗓音分配 ---
    if (speakerName.includes("李至中")) {
        voiceId = "Chinese (Mandarin)_Sincere_Adult";
    } else {
        voiceId = "Chinese (Mandarin)_Reliable_Executive";
    }

    console.log(`[TTS播报] 识别角色: ${speakerName}, 实际朗读: ${cleanText}`);
    if (!cleanText) return;

    try {
        // 使用 GLOBAL_ 打头的全局变量
        const response = await fetch(`https://api.minimaxi.com/v1/t2a_v2?GroupId=${GLOBAL_GROUP_ID}`, {
            method: 'POST',
            headers: { 
                'Authorization': 'Bearer ' + GLOBAL_API_KEY.trim(),
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                "model": "speech-2.8-hd",
                "text": cleanText, 
                "voice_setting": { "voice_id": voiceId, "speed": 0.9, "pitch": 0 },
                "voice_modify": { "sound_effects": "lofi_telephone" },
                "audio_setting": { "sample_rate": 32000, "format": "mp3" },
                "output_format": "url"
            })
        });

        const result = await response.json();
        if (result.data?.audio) {
            document.querySelectorAll('.soul-current-audio').forEach(a => { a.pause(); a.remove(); });
            const audio = new Audio(result.data.audio);
            audio.className = "soul-current-audio";
            return new Promise(res => { 
                audio.onended = () => { audio.remove(); res(); };
                audio.play();
            });
        }
    } catch (e) { console.error("语音播报失败:", e); }
};

// --- 下面接 launchCallUI 和 launchPerfectPacket，内部直接调用 fetchAndPlayVoice 即可 ---
  
    // 语音通话 UI 逻辑 (完美保留原有 UI + 新增 MiniMax 语音同步)
    window.launchCallUI = (name, dialogues, fId) => {
      
        const container = document.getElementById('message-detail-content') || document.querySelector('.message-detail-content');
        if (!container) return;
        const contact = PERMANENT_CONTACTS[fId] || { name: name };
        const avatarUrl = contact.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${fId}`;
        
        const overlay = document.createElement('div');
        overlay.id = "embedded-soul-ui";
        overlay.style.cssText = `position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #000; z-index: 10000; display: flex; flex-direction: column; align-items: center; justify-content: space-between; color: white; overflow: hidden;`;
        overlay.innerHTML = `
            <div style="margin-top: 50px; text-align: center; width: 100%;">
                <div style="position: relative; width: 100px; height: 100px; margin: 0 auto;">
                    <div style="position: absolute; width: 100%; height: 100%; background: #fbab51; border-radius: 50%; filter: blur(25px); animation: breathe-v16 2.5s infinite;"></div>
                    <img src="${avatarUrl}" style="position: relative; width:100%; height:100%; border-radius:50%; object-fit: cover; border: 2px solid rgba(255,255,255,0.3);">
                </div>
                <div style="margin-top: 18px; font-size: 22px; font-weight: 500;">${contact.name}</div>
                <div style="margin-top: 5px; font-size: 13px; opacity: 0.5;">通话中 <span id="soul-timer-v16">00:00</span></div>
                <canvas id="multi-wave-cvs" width="300" height="60" style="margin-top: 25px; width: 85%;"></canvas>
            </div>
            <div id="soul-msg-cont" style="width: 100%; height: 260px; display: flex; flex-direction: column-reverse; align-items: center; gap: 8px; padding-bottom: 20px; overflow:hidden;"></div>
            <div style="margin-bottom: 50px;"><div id="soul-close-btn" style="width: 65px; height: 65px; background: #ff3b30; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 30px; transform: rotate(135deg); color: white;">📞</div>
        `;
        container.appendChild(overlay);

        // --- 动画渲染 (保持原样) ---
        const cvs = document.getElementById('multi-wave-cvs');
        const ctx = cvs.getContext('2d');
        let step = 0;
        function animate() {
            if(!document.getElementById('embedded-soul-ui')) return;
            ctx.clearRect(0, 0, cvs.width, cvs.height);
            step += 0.04;
            const waves = [
                { s: 0.6, f: 0.02, h: 22, color: '#fbd69b', alpha: 0.6, weight: 2 },   
                { s: -0.3, f: 0.015, h: 18, color: '#fbab51', alpha: 0.4, weight: 1.5 }, 
                { s: 0.8, f: 0.04, h: 12, color: '#ffffff', alpha: 0.3, weight: 1 }
            ];
            waves.forEach(w => {
                ctx.beginPath(); ctx.lineWidth = w.weight; ctx.strokeStyle = w.color; ctx.globalAlpha = w.alpha;
                for (let x = 0; x < cvs.width; x++) {
                    const y = cvs.height / 2 + Math.sin(x * w.f + step * w.s) * w.h;
                    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                }
                ctx.stroke();
            });
            requestAnimationFrame(animate);
        } animate();

        // --- 计时器 (保持原样) ---
        let s=0; const tInt = setInterval(() => { s++; const el=document.getElementById('soul-timer-v16'); if(el) el.innerText=`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }, 1000);
        
        // --- 队列播报逻辑 (核心升级) ---
        const cont = document.getElementById('soul-msg-cont'); 
        let idx = 0;
        async function next() {
            if(idx >= dialogues.length || !document.getElementById('embedded-soul-ui')) return;
            
            const line = dialogues[idx++];
            
            // 1. 弹出气泡
            const b = document.createElement('div'); 
            b.className = 'soul-bubble-v16'; 
            b.innerText = line;
            cont.insertBefore(b, cont.firstChild);
            
            // 2. 调用语音并等待播放结束
            await fetchAndPlayVoice(line);
            
            // 3. 停顿 800ms 开启下一句
            setTimeout(next, 800);
        } 
        
        // 首次启动延迟
        setTimeout(next, 1000);

      // --- 最终版：关闭按钮（图标初始化 + 挂断逻辑） ---
        const closeBtn = document.getElementById('soul-close-btn');
        if (closeBtn) {
            // 1. 【立即执行】把粉色话筒换成纯白 SVG
            closeBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="30" height="30" style="transform: rotate(135deg);">
                    <path fill="white" d="M6.62,10.79C8.06,13.62 10.38,15.94 13.21,17.38L15.41,15.18C15.69,14.9 16.08,14.82 16.43,14.93C17.55,15.3 18.75,15.5 20,15.5A1,1 0 0,1 21,16.5V20A1,1 0 0,1 20,21A17,17 0 0,1 3,4A1,1 0 0,1 4,3H7.5A1,1 0 0,1 8.5,4C8.5,5.25 8.7,6.45 9.07,7.57C9.18,7.92 9.1,8.31 8.82,8.59L6.62,10.79Z" />
                </svg>`;
            
            // 2. 【点击触发】挂断逻辑
            closeBtn.onclick = () => { 
                // 播放清脆音效
                const endSound = new Audio("https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3"); 
                endSound.volume = 0.5;
                endSound.play().catch(()=>{});

                // 核心清理逻辑
                clearInterval(tInt); 
                document.querySelectorAll('.soul-current-audio').forEach(a => { a.pause(); a.remove(); });
                
                // 150ms 后移除界面
                setTimeout(() => { overlay.remove(); }, 150);
            };
        }
    };

// --- 红包交互系统 ---
if (!window.launchPerfectPacket) { // 加个判断防止重复定义
    window.launchPerfectPacket = (wish, amount) => {
        console.log("🧧 红包 UI 启动:", wish, amount);
        const overlay = document.createElement('div');
        overlay.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.8); backdrop-filter:blur(8px); z-index:9999999; display:flex; align-items:center; justify-content:center;";
        overlay.innerHTML = `<div style="width:280px; height:380px; background:#cf4e46; border-radius:20px; display:flex; flex-direction:column; align-items:center; color:#fbd69b; position:relative;">
            <div style="position:absolute; top:15px; right:15px; font-size:24px; cursor:pointer;" onclick="this.parentElement.parentElement.remove()">✕</div>
            <div style="margin-top:50px; opacity:0.7; font-size:13px;">来自好友的红包</div>
            <div style="margin-top:25px; font-size:19px; font-weight:bold; padding:0 25px; text-align:center;">${wish}</div>
            <div id="p-open-btn" style="width:85px; height:85px; background:#fbd69b; color:#cf4e46; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:30px; font-weight:bold; cursor:pointer; margin-top:40px; transition:0.6s;">開</div>
        </div>`;
        document.body.appendChild(overlay);
        
        document.getElementById('p-open-btn').onclick = function() {
            this.style.transform = "rotateY(720deg)";
            setTimeout(() => {
                this.parentElement.innerHTML = `<div style="position:absolute; top:15px; right:15px; font-size:24px; cursor:pointer;" onclick="this.parentElement.parentElement.remove()">✕</div>
                <div style="margin-top:90px; font-size:45px; font-weight:bold;">${amount}<span style="font-size:18px"> 元</span></div>
                <div style="margin-top:15px; opacity:0.8; font-size:14px;">已存入零钱</div>`;
            }, 600);
        };
    };
}

/**
     * 【第四部分：核心抓取与逻辑 - 分组+完整预览增强版】
     */
    const setupCoreLogic = () => {
        if (!window.friendRenderer) return;
        
        window.friendRenderer.extractFriendsFromContext = function() {
            const chatLog = (window.SillyTavern?.getContext?.() || {}).chat || [];
            let lastValidIdx = -1;
            for (let i = chatLog.length - 1; i >= 0; i--) {
                if ((chatLog[i].mes || "").includes('[手机快讯]')) { lastValidIdx = i; break; }
            }
            let allMobileText = "";
            chatLog.forEach(e => { if((e.mes||"").includes('[手机快讯]')) allMobileText += e.mes + "\n"; });
            
            let contacts = [];
            // 使用定义的 CLOUD_IDS，若未定义则从 PERMANENT_CONTACTS 提取
            const currentIds = typeof CLOUD_IDS !== 'undefined' ? CLOUD_IDS : Object.keys(PERMANENT_CONTACTS);
            
            currentIds.forEach(fId => {
                const info = PERMANENT_CONTACTS[fId];
                let item = { 
                    character: info.name, 
                    name: info.name, 
                    number: fId, 
                    lastMessage: "暂无消息", 
                    lastMessageTime: "08:00", 
                    messageIndex: -1, 
                    hasUnreadTag: false,
                    isSpecial: info.isSpecial || false,
                    avatar: info.avatar || ""
                };

                // --- 调整后的分组判定逻辑 ---
                const idNum = parseInt(fId);
                
                if (item.isSpecial) {
                    // 1. 核心好友 (102, 103, 107 等) 优先级最高，不进组
                    item.groupType = 'special'; 
                } else if (idNum >= 141 && idNum <= 169) {
                    // 2. 律所同事组
                    item.groupType = 'colleague'; 
                } else if (idNum >= 170 && idNum <= 220) {
                    // 3. 客户项目组
                    item.groupType = 'client'; 
                } else {
                    // 4. 其余所有人（包括 100, 101, 108-120 等订阅号）暂时不分组，直接显示在列表上
                    item.groupType = 'others';
                }

                const lines = allMobileText.split('\n');
                for (let j = lines.length - 1; j >= 0; j--) {
                    if (lines[j].includes(`|${fId}|`)) {
                        const tMatch = lines[j].match(/\[时间\|(\d{1,2}:\d{2})\]/);
                        item.lastMessageTime = tMatch ? tMatch[1] : "08:00";
                        
                        const cMatch = lines[j].match(/\|(?:文字|图片|表情包|红包|语音通话)\|([^\]]+)\]/);
                        if (cMatch) {
                            // 1. 提取原始内容
                            let content = cMatch[1].split('|')[0];

                            // 2. 【核心功能还原：强力清洗与预览转换】
                            if (content.includes('UI_') || content.includes('101_') || content.includes('108_') || content.includes('109_')) {
                                if (content.includes('101_N')) content = "[今日新闻]";
                                else if (content.includes('101_A')) content = "[政务预警]";
                                else if (content.includes('101_W')) content = "[天气快报]";
                                else if (content.includes('108_F')) content = "[时尚快讯]";
                                else if (content.includes('109_H')) content = "[暖心语录]";
                                else if (content.includes('109_E')) content = "[深夜FM]";
                                else if (content.includes('113_S')) content = "[匿名树洞]";
                                else content = "[服务通知]";
                            } 
                            else if (content.includes('<') && content.includes('>')) {
                                content = content
                                    .replace(/<[^>]*>/g, '')   
                                    .replace(/&nbsp;/g, ' ')   
                                    .trim();
                                if (!content) content = "[图文内容]";
                            }

                            // 3. 图片判定
                            item.lastMessage = content.includes('http') ? "[图片/表情]" : content;
                        }
                        item.messageIndex = j; 
                        break;
                    }
                }
                
                // 未读权重逻辑
                if (lastValidIdx !== -1) {
                    const lastMes = chatLog[lastValidIdx].mes;
                    if (lastMes.includes(`|${fId}|`) && lastMes.includes('[UNREAD]')) {
                        item.hasUnreadTag = true; 
                        item.messageIndex += 1000000;
                    }
                }
                contacts.push(item);
            });
            return contacts.sort((a, b) => b.messageIndex - a.messageIndex);
        };
    };

    /**
     * 【第五部分：界面刷新逻辑 (列表+气泡)】
     */
    const runUIUpdate = () => {
      // 0. 顶部标题强制修正 (新增部分)
        const titleEl = document.getElementById('app-title');
        if (titleEl) {
            const fIdMatch = titleEl.innerText.match(/\d+/);
            if (fIdMatch) {
                const fId = fIdMatch[0];
                const info = PERMANENT_CONTACTS[fId];
                if (info) {
                    titleEl.innerText = info.name; // 强制变中文
                    titleEl.setAttribute('data-fixed-id', fId); // 留个暗号给通话界面
                }
            }
        }
        // 1. 列表美化
        document.querySelectorAll('.message-item').forEach(item => {
            const fId = item.getAttribute('data-friend-id');
            const info = PERMANENT_CONTACTS[fId];
            if (!info) return;

            const nameEl = item.querySelector('.message-name') || item.querySelector('.friend-name');
            if (nameEl && !nameEl.hasAttribute('data-fixed')) {
                nameEl.innerText = `${info.name} ${info.tag || ''}`;
                if (info.isSpecial) nameEl.classList.add('special-friend-name');
                nameEl.setAttribute('data-fixed', 'true');
            }
            if (info.isSpecial) {
                const img = item.querySelector('img');
                if (img && !img.classList.contains('special-friend-avatar')) img.classList.add('special-friend-avatar');
            }

            // 红点处理
            const data = window.friendRenderer.extractFriendsFromContext().find(f => f.number === fId);
            if (data) {
                let dot = item.querySelector('.unread-dot');
                if (data.hasUnreadTag) {
                    if(!dot) { dot=document.createElement('div'); dot.className='unread-dot'; item.appendChild(dot); }
                } else if(dot) dot.remove();
                
                let tSpan = item.querySelector('.custom-timestamp') || (()=>{ let s=document.createElement('span'); s.className='custom-timestamp'; item.appendChild(s); return s; })();
                tSpan.innerText = data.lastMessageTime;
            }

            const lastMsgEl = item.querySelector('.message-last-msg, .friend-last-msg');
            if (lastMsgEl && (lastMsgEl.innerText.includes('语音通话') || lastMsgEl.innerText.includes('📞'))) {
                if (!lastMsgEl.querySelector('.force-call-tag')) lastMsgEl.innerHTML = '<span class="force-call-tag">[语音通话]</span>';
            }
        });

        // 2. 气泡转换 (通话 + 服务号 + 红包)
document.querySelectorAll('.message-text:not(.fixed)').forEach(msg => {
    if (msg.closest('.message-item') || msg.closest('.friend-item')) return;

    const raw = msg.innerText;
    const bubble = msg.closest('.message-content');
    let html = ''; // 统一定义 html 变量
    const containerStart = `<div class="service-card-container">`;
    const containerEnd = `</div>`;

    // --- [分支 1]：语音通话 ---
    if (raw.includes('语音通话') || raw.includes('📞')) {
        msg.classList.add('fixed');
        const isSuccess = !(raw.includes('未接通') || raw.includes('已挂断') || raw.includes('已拒绝'));
        
        let status = isSuccess ? "(已接通)" : "(未接通)";
        const leftBracketIdx = raw.indexOf('(') !== -1 ? raw.indexOf('(') : raw.indexOf('（');
        if (leftBracketIdx !== -1) {
            let afterBracket = raw.substring(leftBracketIdx);
            status = afterBracket.split(/[|\]]/)[0].trim();
        }

        let cleanRaw = raw.replace('[📞VOICE_CALL]', '').replace('VOICE_CALL', '').replace('[UNREAD]', '').trim();
        const parts = cleanRaw.split('|').map(p => p.trim());
        const statusIdx = parts.findIndex(p => p.includes('通话') || p.includes('时长') || p.includes('未接'));
        const dialogues = (statusIdx !== -1 && parts.length > statusIdx + 1) ? parts.slice(statusIdx + 1).map(d => d.replace(']', '')) : [];
        
        const titleEl = document.getElementById('app-title');
        const fId = titleEl ? (titleEl.innerText.match(/\d+/) || ["103"])[0] : "103";
        const name = titleEl ? titleEl.innerText.split(' ')[0] : "联系人";

        if (bubble) bubble.style.cssText = "background:transparent !important; border:none !important; box-shadow:none !important; padding:0 !important; overflow:visible !important;";
        
        const card = document.createElement('div');
        card.className = 'call-record-card';
        
        if (isSuccess) {
            card.innerHTML = `<div class="call-row-top"><span>📞</span>语音通话</div><div class="call-row-bottom"><span>${status}</span><span class="read-icon-btn">📖 ▽</span></div>`;
            const preview = document.createElement('div');
            preview.className = 'call-text-preview';
            preview.innerText = dialogues.join('\n');
            card.onclick = (e) => { e.stopPropagation(); window.launchCallUI(name, dialogues, fId); };
            const trigger = card.querySelector('.read-icon-btn');
            trigger.onclick = (e) => {
                e.stopPropagation();
                const isHidden = preview.style.display === 'none' || preview.style.display === '';
                preview.style.display = isHidden ? 'block' : 'none';
                trigger.innerHTML = isHidden ? '📖 △' : '📖 ▽';
                card.style.borderRadius = isHidden ? '8px 8px 0 0' : '8px';
                card.style.borderBottom = isHidden ? 'none' : '1px solid #eeeeee';
            };
            msg.innerHTML = '';
            msg.appendChild(card);
            msg.appendChild(preview);
        } else {
            card.innerHTML = `<div class="call-row-top" style="color:#2f80ed;"><span style="font-size:12px;">🔹</span>语音通话</div><div class="call-row-bottom" style="color:#2f80ed; opacity:0.8;">${status}</div>`;
            card.style.cursor = "default";
            card.onclick = (e) => { e.stopPropagation(); };
            msg.innerHTML = '';
            msg.appendChild(card);
        }
    } 
  // --- [分支 2]：全能天气 (101_W) - 195px 最终定稿版 ---
    else if (raw.includes('101_W|')) {
        const p = raw.match(/101_W\|([^|]+)\|([^|]+)\|([^|]+)\|([^\]]+)/);
        if (p) {
            const city = p[1] || "北京";
            const temp = p[2] || "--°";
            const aqi = parseInt(p[3]) || 0;
            const desc = p[4] || "晴";
            
            const days = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
            const weekDay = days[new Date().getDay()];
            const aqiPos = Math.min(Math.max((aqi / 300) * 100, 5), 95);
            let icon = desc.includes('晴') ? '☀️' : (desc.includes('雨') ? '🌧️' : '⛅');

            if (bubble) bubble.classList.add('service-card-bubble');
            msg.classList.add('service-card-text');

            html = `
            <style>
                @keyframes weatherFloat {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
            </style>
            <div class="service-card-container" style="
                width: 195px; 
                min-height: 100px; 
                margin-bottom: 8px; 
                border-radius: 12px; 
                padding: 12px 14px; 
                background: #ffffff; 
                color: #1d1d1f; 
                box-sizing: border-box; 
                border: 1.2px solid #d1d1d6; 
                position: relative; 
                display: flex; 
                flex-direction: column; 
                justify-content: space-between;
                margin-left: 0px !important;">
                
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-size: 9px; color: #86868b; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">${weekDay} · ${city}</span>
                        <span style="font-size: 28px; font-weight: 700; color: #111; line-height: 1.1; margin: 2px 0;">${temp}</span>
                        <span style="font-size: 11px; font-weight: 600; color: #3a3a3c;">${desc}</span>
                    </div>
                    <div style="font-size: 42px; animation: weatherFloat 4s ease-in-out infinite; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.08));">${icon}</div>
                </div>

                <div style="margin-top: 6px;">
                    <div style="display: flex; justify-content: space-between; font-size: 9px; font-weight: 800; color: #86868b; margin-bottom: 5px;">
                        <span>空气质量 · ${aqi}</span>
                    </div>
                    <div style="width: 100%; height: 4px; background: rgba(0,0,0,0.06); border-radius: 4px; position: relative;">
                        <div style="position: absolute; left: 0; top: 0; height: 100%; width: 100%; border-radius: 4px; background: linear-gradient(to right, #34c759, #ffcc00, #ff9500, #ff3b30, #af52de); opacity: 0.8;"></div>
                        <div style="position: absolute; left: ${aqiPos}%; top: 50%; transform: translate(-50%, -50%); width: 6px; height: 6px; background: #1d1d1f; border-radius: 50%; border: 1.5px solid #fff;"></div>
                    </div>
                </div>
            </div>`;
            
            msg.innerHTML = html;
        }
    }
    // --- [分支 3]：新闻资讯 (101_N) - 电脑手机双优加深版 ---
    else if (raw.includes('101_N|')) {
        const p = raw.match(/101_N\|([^|]+)\|([^\]]+)/);
        if (p) {
            const title = p[1] || "";
            const summary = p[2] || "";
            if (bubble) bubble.classList.add('service-card-bubble');
            msg.classList.add('service-card-text');

            html = `
            <div class="service-card-container" style="
                width: 195px; 
                min-height: 80px; 
                margin-bottom: 8px; 
                border-radius: 12px; 
                padding: 14px 16px; 
                background: #ffffff; 
                color: #1d1d1f; 
                box-sizing: border-box; 
                /* 边框加深：同步为天气同款 #d1d1d6 */
                border: 1.2px solid #d1d1d6; 
                position: relative; 
                box-shadow: 0 4px 12px rgba(0,0,0,0.05); 
                font-family: -apple-system, system-ui, sans-serif; 
                display: flex; 
                flex-direction: column; 
                justify-content: center;
                margin-left: 0px !important;">
                
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                    <span style="color: #007AFF; font-size: 10px; font-weight: 900; letter-spacing: 0.5px;">NEWS</span>
                    <span style="font-size: 9px; color: #bbbbbb; font-weight: 500;">JUST NOW</span>
                </div>
                
                <div style="font-size: 14px; color: #111; font-weight: 600; line-height: 1.35; margin-bottom: 6px;">${title}</div>
                
                <div style="font-size: 11.5px; color: #666; line-height: 1.5; font-weight: 400;">${summary}</div>
            </div>`;
            msg.innerHTML = html;
        }
    }

    // --- [分支 4]：政务/预警 (101_A) - 195px 紧凑磁贴版 ---
    else if (raw.includes('101_A|')) {
        const p = raw.match(/101_A\|([^|]+)\|([^\]]+)/);
        if (p) {
            const alertTitle = p[1] || "";
            const alertDetail = p[2] || "";
            if (bubble) bubble.classList.add('service-card-bubble');
            msg.classList.add('service-card-text');

            html = `
            <style>@keyframes alertPulse { 0%, 100% {opacity:1} 50% {opacity:0.4} }</style>
            <div class="service-card-container" style="
                width: 195px; 
                min-height: 90px; 
                margin-bottom: 8px; 
                border-radius: 12px; 
                padding: 14px 16px; 
                background: #fff5f5; 
                color: #1d1d1f; 
                box-sizing: border-box; 
                /* 预警边框颜色稍微偏红但保持深色感 */
                border: 1.2px solid #ffcfd2; 
                position: relative; 
                box-shadow: 0 4px 12px rgba(255,71,87,0.08); 
                font-family: -apple-system, system-ui, sans-serif; 
                display: flex; 
                flex-direction: column; 
                justify-content: center;
                margin-left: 0px !important;">
                
                <div style="display: flex; align-items: center; gap: 5px; color: #ff4757; font-size: 9px; font-weight: 900; margin-bottom: 8px;">
                    <div style="width: 6px; height: 6px; background: #ff4757; border-radius: 50%; animation: alertPulse 1.2s infinite; flex-shrink: 0;"></div>
                    <span style="letter-spacing: 0.5px; text-transform: uppercase;">SERVICE ALERT</span>
                </div>
                
                <div style="font-size: 13.5px; color: #d63031; font-weight: 800; line-height: 1.35; margin-bottom: 5px;">${alertTitle}</div>
                
                <div style="font-size: 11.5px; color: #424245; line-height: 1.45; font-weight: 400;">${alertDetail}</div>
            </div>`;
            msg.innerHTML = html;
        }
    }
      // --- [分支 5]：VOGUE时尚 (108_F) - 195px 磁贴版 ---
    else if (raw.includes('108_F|')) {
        const p = raw.match(/108_F\|([^|]+)\|([^|]+)\|([^\]]+)/);
        if (p) {
            const vTitle = p[1] || "";
            const vSub = p[2] || "";
            const vBrand = p[3] || "";
            if (bubble) bubble.classList.add('service-card-bubble');
            msg.classList.add('service-card-text');

            html = `
            <div class="service-card-container" style="width:195px; min-height:100px; margin-bottom:8px; border-radius:12px; padding:14px; background:#000; color:#fff; box-sizing:border-box; border:1.2px solid #333; position:relative; display:flex; flex-direction:column; justify-content:center; text-align:center; font-family:serif; margin-left:0px !important;">
                <div style="font-size:14px; letter-spacing:4px; font-weight:900; margin-bottom:6px; border-bottom:1px solid #222; padding-bottom:4px;">VOGUE</div>
                <div style="font-size:8px; color:#d4af37; letter-spacing:1px; margin-bottom:4px; font-weight:800;">${vSub}</div>
                <div style="font-size:11.5px; font-weight:300; line-height:1.3; color:#eee;">“${vTitle}”</div>
                <div style="font-size:8px; color:#666; margin-top:6px;">${vBrand}</div>
            </div>`;
            msg.innerHTML = html;
        }
    }

    // --- [分支 6]：治愈情感 (109_H) - 195px 磁贴版 ---
    else if (raw.includes('109_H|')) {
        const p = raw.match(/109_H\|([^\]]+)/);
        if (p) {
            const quote = p[1] || "";
            if (bubble) bubble.classList.add('service-card-bubble');
            msg.classList.add('service-card-text');

            html = `
            <div class="service-card-container" style="width:195px; min-height:95px; margin-bottom:8px; border-radius:12px; padding:14px; background:#fff9f0; color:#8c6d3f; box-sizing:border-box; border:1.2px solid #f2dec2; position:relative; display:flex; flex-direction:column; justify-content:center; margin-left:0px !important;">
                <div style="font-size:9px; font-weight:900; color:#bda582; margin-bottom:6px;">深夜FM · 暖心</div>
                <div style="font-size:12px; font-weight:600; line-height:1.5; color:#7a5a2d;">“${quote}”</div>
            </div>`;
            msg.innerHTML = html;
        }
    }

    // --- [分支 7]：深夜黑金FM (109_E) - 195px 磁贴版 ---
    else if (raw.includes('109_E|')) {
        const p = raw.match(/109_E\|([^|]+)\|([^\]]+)/);
        if (p) {
            const eTitle = p[1] || "";
            const eText = p[2] || "";
            if (bubble) bubble.classList.add('service-card-bubble');
            msg.classList.add('service-card-text');

            html = `
            <style>
                @keyframes barJump { 0%, 100% { height: 4px; } 50% { height: 10px; } }
            </style>
            <div class="service-card-container" style="width:195px; min-height:100px; margin-bottom:8px; border-radius:12px; padding:14px; background:#1a1a1a; color:#d4af37; box-sizing:border-box; border:1.2px solid #333; position:relative; display:flex; flex-direction:column; justify-content:center; margin-left:0px !important;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div style="font-size:9px; font-weight:900; letter-spacing:1px;">FM 109 · LIVE</div>
                    <div style="display:flex; align-items:flex-end; gap:2px; height:10px;">
                        <div style="width:2px; background:#d4af37; animation:barJump 0.8s infinite 0.1s;"></div>
                        <div style="width:2px; background:#d4af37; animation:barJump 0.8s infinite 0.3s;"></div>
                        <div style="width:2px; background:#d4af37; animation:barJump 0.8s infinite 0.5s;"></div>
                    </div>
                </div>
                <div style="font-size:12.5px; color:#eee; font-weight:700; line-height:1.35; margin-bottom:4px;">“${eTitle}”</div>
                <div style="font-size:10px; color:#888; border-left:1.5px solid #d4af37; padding-left:8px;">${eText}</div>
            </div>`;
            msg.innerHTML = html;
        }
    }

    // --- [分支 8]：树洞吐槽 (113_S) - 195px 森系木质版 ---
    else if (raw.includes('UI_113_S|')) {
        const p = raw.match(/UI_113_S\|([^|]+)\|([^\]]+)/);
        if (p) {
            const sNum = p[1] || "404";
            const sContent = p[2] || "";
            if (bubble) bubble.classList.add('service-card-bubble');
            msg.classList.add('service-card-text');

            html = `
            <style>
                @keyframes leafSway {
                    0%, 100% { transform: rotate(-5deg); }
                    50% { transform: rotate(15deg); }
                }
            </style>
            <div class="service-card-container" style="
                width: 195px; 
                min-height: 85px; 
                margin-bottom: 8px; 
                border-radius: 12px; 
                padding: 12px 14px; 
                background: #fdf5e6; 
                color: #5d4037; 
                box-sizing: border-box; 
                border: 1.5px solid #8b4513; 
                position: relative; 
                display: flex; 
                flex-direction: column; 
                justify-content: space-between; 
                margin-left: 0px !important;
                box-shadow: 2px 2px 0px #d2b48c;">
                
                <div style="position: absolute; top: 4px; right: 8px; font-size: 14px; animation: leafSway 3s ease-in-out infinite;">🍃</div>

                <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 4px;">
                    <span style="font-size: 12px;">🕳️</span>
                    <div style="font-size: 9px; color: #8b4513; font-weight: 900; letter-spacing: 0.5px; opacity: 0.7;">
                        THE HOLE #${sNum}
                    </div>
                </div>

                <div style="font-size: 12px; color: #3e2723; line-height: 1.4; font-weight: 700; text-align: left; padding: 2px 0;">
                    “${sContent}”
                </div>

                <div style="margin-top: 6px; display: flex; justify-content: flex-end;">
                    <span style="font-size: 8px; font-weight: 800; background: #2e7d32; color: #ffffff; padding: 2px 6px; border-radius: 20px; display: flex; align-items: center; gap: 2px;">
                        <span style="font-size: 9px;">🌲</span> 匿名吐槽站
                    </span>
                </div>
            </div>`;
            msg.innerHTML = html;
        }
    }
      // --- [分支 9]：红包系统 ---
    else if (raw.includes('|') && (raw.includes('红包') || raw.match(/\d+(\.\d+)?/)) && !raw.includes('UI_')) {
        msg.classList.add('fixed');
        const amt = (raw.match(/\d+(\.\d+)?/) || ["8.88"])[0];
        const wish = raw.split('|')[1]?.replace(']', '').trim() || "恭喜发财";
        if (bubble) bubble.style.cssText = "background:transparent !important; border:none !important; box-shadow:none !important; padding:0 !important; margin:0 !important; overflow:visible !important; pointer-events:none !important;";
        const card = document.createElement('div');
        card.className = 'beautiful-packet';
        card.innerHTML = `<div>🧧 ${wish}</div><div style="font-size:11px; opacity:0.8; margin-top:6px; border-top:1px solid rgba(255,255,255,0.2); padding-top:4px;">微信红包 (￥${amt})</div>`;
        card.style.cssText = "margin-left: -40px !important; margin-top: -8px !important; position: relative !important; z-index: 999 !important; min-width: 200px !important; display: block !important; pointer-events: auto !important; cursor: pointer;";
        card.onclick = (e) => { 
            e.stopPropagation(); 
            const launch = window.launchPerfectPacket || (parent && parent.window && parent.window.launchPerfectPacket);
            if (typeof launch === 'function') launch(wish, amt);
        };
        msg.innerHTML = ''; 
        msg.appendChild(card);
    }

    // --- [通用渲染：全能版] ---
    if (html) {
        if (bubble) {
            bubble.classList.add('service-card-bubble');
            // 清空内联样式，确保 CSS 自定义区的透明背景生效
            bubble.style.cssText = ""; 
            
            // 针对所有 UI 卡片，强制取消酒馆的内边距，让我们的 130px 准确定位
            if (raw.includes('UI_')) {
                bubble.style.padding = "0";
                bubble.style.background = "transparent";
                bubble.style.border = "none";
                bubble.style.height = "auto"; 
            }
        }
        msg.classList.add('service-card-text');
        msg.innerHTML = html;
    }
}); // 正确闭合 forEach
     // --- 微信语音联动：稳健轮询集成版 ---
        if (!window.voiceEventBound) {
            document.addEventListener('click', (e) => {
                // 1. 识别点击目标
                const isVoice = e.target.innerText?.includes('▶') || 
                                e.target.closest('[class*="voice"]') || 
                                e.target.closest('[class*="play"]');
                if (!isVoice) return;

                // 2. 寻找气泡
                const bubble = e.target.closest('.message-text') || 
                               e.target.closest('.message-content') || 
                               e.target.parentElement;

                if (bubble) {
                    console.log("⏳ 捕获语音点击，等待文字同步...");
                    let lastText = "";
                    let stableCount = 0;
                    
                    const waiter = setInterval(() => {
                        const currentText = bubble.innerText;
                        
                        // 判定文字是否停止变动（且长度合理）
                        if (currentText === lastText && currentText.length > 5) {
                            stableCount++;
                        } else {
                            stableCount = 0;
                        }
                        lastText = currentText;

                        // 连续 3 次检查不变则抓取
                        if (stableCount >= 3) {
                            clearInterval(waiter);
                            
                            // 提取纯台词：剔除时间前缀和杂质
                            const cleanContent = currentText.replace(/^\d+:\d+\s*/, '')
                                                           .replace(/\[.*?\]/g, '')
                                                           .trim();

                            if (typeof window.fetchAndPlayVoice === 'function') {
                                // 自动判定角色（优先从文本抓，抓不到点默认）
                                const nameMatch = currentText.match(/\|([^|]+)\|/);
                                const speaker = nameMatch ? nameMatch[1] : (currentText.includes('李至中') ? '李至中' : '陈一众');
                                
                                console.log(`✅ 同步播报启动: ${speaker}`);
                                window.fetchAndPlayVoice(`${speaker}：${cleanContent}`);
                            }
                        }
                    }, 400);
                }
            }, true); 
            window.voiceEventBound = true;
            console.log("🚀 语音同步模块已随界面逻辑启动");
        }
    };

    /**
     * 【第六部分：iOS 横幅通知 (补回此功能)】
     */
    const initNotifications = () => {
        const bubbleSound = new Audio("https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3");
        let lastMsgKey = localStorage.getItem('last_notified_key') || "";
        setInterval(() => {
            const friends = window.friendRenderer?.extractFriendsFromContext?.() || [];
            if (friends.length === 0) return;
            const latest = friends[0];
            const currentKey = `${latest.number}_${latest.lastMessage}`;
            if (currentKey !== lastMsgKey) {
                if (lastMsgKey !== "" && !latest.lastMessage.includes('[我方消息|') && latest.hasUnreadTag) {
                    bubbleSound.play().catch(()=>{});
                    const toast = document.createElement('div');
                    toast.style.cssText = "position: fixed; top: 30px; left: 50%; transform: translateX(-50%); width: 340px; background: rgba(255,255,255,0.9); backdrop-filter: blur(10px); border-radius: 18px; padding: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); z-index: 999999; display: flex; align-items: center; transition: all 0.5s ease; opacity: 0; transform: translate(-50%, -40px);";
                    toast.innerHTML = `<div style="width:40px; height:40px; background:#ddd; border-radius:8px; margin-right:12px; display:flex; align-items:center; justify-content:center; font-size:20px;">👤</div><div><div style="font-weight:bold; color:black; font-size:14px;">${latest.name}</div><div style="font-size:13px; color:#444;">${latest.lastMessage}</div></div>`;
                    document.body.appendChild(toast);
                    setTimeout(()=>{ toast.style.opacity="1"; toast.style.transform="translate(-50%, 0)"; }, 100);
                    setTimeout(()=>{ toast.style.opacity="0"; toast.style.transform="translate(-50%, -40px)"; setTimeout(()=>toast.remove(), 500); }, 4000);
                }
                lastMsgKey = currentKey;
                localStorage.setItem('last_notified_key', lastMsgKey);
            }
        }, 2000);
    };

    // --- 智能提速逻辑 ---
    let fastCycles = 0;
    const updateLoop = () => {
        setupCoreLogic();
        runUIUpdate();
        
        // 前 10 秒采用高频扫描（200ms一次），确保秒变红包
        // 10 秒后恢复正常频率（1s一次），节省性能
        fastCycles++;
        let nextTick = fastCycles < 50 ? 200 : 1000; 
        setTimeout(updateLoop, nextTick);
    };

    // 立即执行第一次
    updateLoop();
    initNotifications();
})();
