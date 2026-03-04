/**
 * 【重构日志：Incremental Renderer 2.0 - 逻辑停用预备】
 * * ⚠️ 警告：本脚本是 1.0 “正文扫描模式”的核心组件，与 2.0 “数据注入模式”存在逻辑冲突。
 * * 🚩 当前状态：
 * 1. [待废弃]：formatMatchers（正则匹配器）已过时。2.0 模式下消息数据由 phone_data.json 直接分发，无需从正文“抠图”。
 * 2. [保留监控]：暂时保留 setupFloorMonitor 逻辑，用于研究如何触发“实时注入”。
 * 3. [防干扰]：如果出现消息重复渲染或界面跳动，优先检查并禁用本脚本的 processNewMessages 函数。
 * * 🎯 目标：
 * - 最终将本脚本的功能合并入 message-app.js 的监听模块，彻底移除所有正则表达式解析逻辑。
 */

/**
 * 增量渲染器 - Incremental Renderer
 * 专门用于增量渲染消息，避免界面跳动
 * 只渲染最新楼层的消息，历史消息使用缓存
 */

class IncrementalRenderer {
  constructor() {
    this.processedMessageIds = new Set(); // 已处理的消息ID
    this.cachedRenderedMessages = new Map(); // 缓存已渲染的消息HTML
    this.lastProcessedMessageIndex = -1; // 最后处理的消息索引
    this.lastFloorCount = 0; // 最后的楼层数量
    this.floorMonitor = null; // 楼层监控器实例
    this.isEnabled = true;
    this.renderingInProgress = false; // 防止重复渲染

    // 使用统一的正则表达式管理器
    this.contextMonitor =
      window['contextMonitor'] || (window['ContextMonitor'] ? new window['ContextMonitor']() : null);

    if (this.contextMonitor) {
      // 从统一管理器获取格式配置
      const formats = this.contextMonitor.getAllExtractorFormats();
      this.formatMatchers = {
        friend: {
          regex: formats.friend.regex,
          type: 'friend',
          fields: formats.friend.fields,
        },
        myMessage: {
          regex: formats.myMessage.regex,
          type: 'myMessage',
          fields: formats.myMessage.fields,
        },
        theirMessage: {
          regex: formats.otherMessage.regex,
          type: 'theirMessage',
          fields: formats.otherMessage.fields,
        },
        groupMessage: {
          regex: formats.groupMessage.regex,
          type: 'groupMessage',
          fields: formats.groupMessage.fields,
        },
        myGroupMessage: {
          regex: formats.myGroupMessage.regex,
          type: 'myGroupMessage',
          fields: formats.myGroupMessage.fields,
        },
      };
    } else {
      console.warn('[增量渲染器] 上下文监控器未初始化，使用默认格式匹配器');
      // 保持原有的格式匹配器配置作为备用
      this.formatMatchers = {
        friend: {
          regex: /\[好友id\|([^|]+)\|([^|]+)\]/g,
          type: 'friend',
          fields: ['name', 'number'],
        },
        myMessage: {
          regex: /\[我方消息\|([^|]+)\|([^|]+)\|([^\]]+)\]/g,
          type: 'myMessage',
          fields: ['receiver', 'number', 'content'],
        },
        theirMessage: {
          regex: /\[对方消息\|([^|]+)\|([^|]+)\|([^\]]+)\]/g,
          type: 'theirMessage',
          fields: ['sender', 'number', 'content'],
        },
        groupMessage: {
          regex: /\[群聊消息\|([^|]+)\|([^|]+)\|([^\]]+)\]/g,
          type: 'groupMessage',
          fields: ['groupId', 'sender', 'content'],
        },
        myGroupMessage: {
          regex: /\[我方群聊消息\|([^|]+)\|我\|([^\]]+)\]/g,
          type: 'myGroupMessage',
          fields: ['groupId', 'content'],
        },
      };
    }

    this.init();
  }

  init() {
    console.log('[增量渲染器] 初始化...');
    this.setupFloorMonitor();
    this.initializeCache();
  }

  // 设置楼层监控器
  setupFloorMonitor() {
    try {
      // 使用现有的楼层监控器
      if (window.MobileContext && window.MobileContext.addFloorListener) {
        // 监听楼层增加事件
        window.MobileContext.addFloorListener('onFloorAdded', data => {
          this.handleNewFloor(data);
        });

        // 启动楼层监控
        if (window.MobileContext.startFloorMonitor) {
          window.MobileContext.startFloorMonitor();
        }

        console.log('[增量渲染器] ✅ 楼层监控器已设置');
      } else {
        console.warn('[增量渲染器] 楼层监控器不可用，使用备选方案');
        this.setupFallbackMonitor();
      }
    } catch (error) {
      console.error('[增量渲染器] 设置楼层监控失败:', error);
      this.setupFallbackMonitor();
    }
  }

  // 备选监控方案
  setupFallbackMonitor() {
    setInterval(() => {
      this.checkForNewMessages();
    }, 2000); // 2秒检查一次，比原来的频率更低
  }

  // 检查新消息（备选方案）
  checkForNewMessages() {
    try {
      const currentMessages = this.getCurrentMessages();
      if (currentMessages.length > this.lastProcessedMessageIndex + 1) {
        const newMessages = currentMessages.slice(this.lastProcessedMessageIndex + 1);
        this.processNewMessages(newMessages);
      }
    } catch (error) {
      console.error('[增量渲染器] 检查新消息失败:', error);
    }
  }

  // 初始化缓存
  initializeCache() {
    try {
      // 加载现有消息到缓存
      const existingMessages = this.getCurrentMessages();
      this.lastProcessedMessageIndex = existingMessages.length - 1;

      // 为现有消息创建缓存条目（但不实际渲染）
      existingMessages.forEach((message, index) => {
        if (message.id || message.send_date) {
          const messageId = this.generateMessageId(message, index);
          this.processedMessageIds.add(messageId);
        }
      });

      console.log(`[增量渲染器] 缓存已初始化，已处理 ${this.processedMessageIds.size} 条消息`);
    } catch (error) {
      console.error('[增量渲染器] 初始化缓存失败:', error);
    }
  }

  // 处理新楼层
  handleNewFloor(floorData) {
    if (!this.isEnabled || this.renderingInProgress) {
      return;
    }

    console.log('[增量渲染器] 检测到新楼层:', floorData);

    // 获取新增的消息
    const newMessages = this.getNewMessages();
    if (newMessages.length > 0) {
      this.processNewMessages(newMessages);
    }
  }

  // 获取新消息
  getNewMessages() {
    try {
      const currentMessages = this.getCurrentMessages();
      const newMessages = [];

      // 从最后处理的索引开始检查
      for (let i = this.lastProcessedMessageIndex + 1; i < currentMessages.length; i++) {
        const message = currentMessages[i];
        const messageId = this.generateMessageId(message, i);

        if (!this.processedMessageIds.has(messageId)) {
          newMessages.push({
            ...message,
            index: i,
            id: messageId,
          });
        }
      }

      return newMessages;
    } catch (error) {
      console.error('[增量渲染器] 获取新消息失败:', error);
      return [];
    }
  }

  // 处理新消息
  async processNewMessages(newMessages) {
    if (this.renderingInProgress) {
      return;
    }

    this.renderingInProgress = true;

    try {
      console.log(`[增量渲染器] 处理 ${newMessages.length} 条新消息`);

      for (const message of newMessages) {
        await this.processMessage(message);

        // 更新处理状态
        this.processedMessageIds.add(message.id);
        this.lastProcessedMessageIndex = Math.max(this.lastProcessedMessageIndex, message.index);
      }

      // 触发界面更新（只更新新增部分）
      this.updateInterface();
    } catch (error) {
      console.error('[增量渲染器] 处理新消息失败:', error);
    } finally {
      this.renderingInProgress = false;
    }
  }

  // 处理单条消息
  async processMessage(message) {
    try {
      if (!message.mes) {
        return;
      }

      // 检查消息中是否包含需要渲染的格式
      const extractedData = this.extractFormatsFromMessage(message.mes);

      if (extractedData.length > 0) {
        console.log(`[增量渲染器] 消息 ${message.index} 包含 ${extractedData.length} 个格式:`, extractedData);

        // 处理每个提取的格式
        for (const data of extractedData) {
          await this.renderFormat(data, message);
        }

        // 缓存渲染结果
        this.cacheMessageRender(message, extractedData);
      }
    } catch (error) {
      console.error('[增量渲染器] 处理消息失败:', error);
    }
  }

  // 从消息中提取格式
  extractFormatsFromMessage(messageText) {
    const extractedData = [];

    Object.entries(this.formatMatchers).forEach(([formatName, matcher]) => {
      const regex = new RegExp(matcher.regex.source, matcher.regex.flags);
      let match;

      while ((match = regex.exec(messageText)) !== null) {
        const data = {
          type: matcher.type,
          fullMatch: match[0],
          index: match.index,
          fields: {},
        };

        // 填充字段
        matcher.fields.forEach((fieldName, index) => {
          data.fields[fieldName] = match[index + 1] || '';
        });

        extractedData.push(data);
      }
    });

    return extractedData;
  }

  // 渲染格式
  async renderFormat(formatData, message) {
    try {
      switch (formatData.type) {
        case 'friend':
          await this.renderFriend(formatData.fields, message);
          break;
        case 'myMessage':
          await this.renderMyMessage(formatData.fields, message);
          break;
        case 'theirMessage':
          await this.renderTheirMessage(formatData.fields, message);
          break;
        case 'groupMessage':
          await this.renderGroupMessage(formatData.fields, message);
          break;
        case 'myGroupMessage':
          await this.renderMyGroupMessage(formatData.fields, message);
          break;
        default:
          console.warn('[增量渲染器] 未知的格式类型:', formatData.type);
      }
    } catch (error) {
      console.error('[增量渲染器] 渲染格式失败:', error);
    }
  }

  // 渲染好友信息
  async renderFriend(fields, message) {
    if (window.friendRenderer) {
      await window.friendRenderer.addFriend(fields.name, fields.number);
    }
    console.log(`[增量渲染器] ✅ 好友已添加: ${fields.name} (${fields.number})`);
  }

  // 渲染我方消息
  async renderMyMessage(fields, message) {
    if (window.messageSender) {
      await window.messageSender.addMyMessage(fields.receiver, fields.number, fields.content);
    }
    console.log(`[增量渲染器] ✅ 我方消息已添加: 给 ${fields.receiver} (${fields.number})`);
  }

  // 渲染对方消息
  async renderTheirMessage(fields, message) {
    if (window.messageSender) {
      await window.messageSender.addTheirMessage(fields.sender, fields.number, fields.content);
    }
    console.log(`[增量渲染器] ✅ 对方消息已添加: 来自 ${fields.sender} (${fields.number})`);
  }

  // 渲染群消息
  async renderGroupMessage(fields, message) {
    if (window.groupRenderer) {
      await window.groupRenderer.addGroupMessage(fields.groupId, fields.sender, fields.content);
    }
    console.log(`[增量渲染器] ✅ 群消息已添加: 群 ${fields.groupId}, 发送者 ${fields.sender}`);
  }

  // 渲染我方群消息
  async renderMyGroupMessage(fields, message) {
    if (window.groupRenderer) {
      await window.groupRenderer.addMyGroupMessage(fields.groupId, fields.content);
    }
    console.log(`[增量渲染器] ✅ 我方群消息已添加: 群 ${fields.groupId}`);
  }

  // 缓存消息渲染结果
  cacheMessageRender(message, extractedData) {
    const cacheKey = message.id;
    this.cachedRenderedMessages.set(cacheKey, {
      message: message,
      extractedData: extractedData,
      renderedAt: Date.now(),
      html: this.generateMessageHTML(extractedData),
    });
  }

  // 生成消息HTML
  generateMessageHTML(extractedData) {
    return extractedData
      .map(data => {
        return `<div class="rendered-format ${data.type}">${data.fullMatch}</div>`;
      })
      .join('');
  }

  // 更新界面（增量更新）
  updateInterface() {
    try {
      // 只更新 MessageApp 的特定部分，而不是全量刷新
      if (window.messageApp) {
        // 触发轻量级的界面更新
        this.updateMessageAppIncremental();
      }

      // 发送增量更新事件
      this.dispatchIncrementalUpdateEvent();
    } catch (error) {
      console.error('[增量渲染器] 更新界面失败:', error);
    }
  }

  // MessageApp增量更新
  updateMessageAppIncremental() {
    try {
      // 只更新好友列表的计数和最新消息预览
      if (window.messageApp.currentView === 'list') {
        this.updateFriendListIncremental();
      }

      // 如果在消息详情页面，只添加新消息
      if (window.messageApp.currentView === 'messageDetail') {
        this.updateMessageDetailIncremental();
      }
    } catch (error) {
      console.error('[增量渲染器] MessageApp增量更新失败:', error);
    }
  }

  // 增量更新好友列表
  updateFriendListIncremental() {
    // 只更新未读计数和最新消息预览，不重新渲染整个列表
    const friendItems = document.querySelectorAll('.message-item');

    friendItems.forEach(item => {
      const friendId = item.getAttribute('data-friend-id');
      if (friendId) {
        // 更新未读计数
        this.updateUnreadCount(item, friendId);

        // 更新最新消息预览
        this.updateLastMessagePreview(item, friendId);
      }
    });
  }

  // 增量更新消息详情
  updateMessageDetailIncremental() {
    // 在消息详情页面只添加新消息，不重新渲染历史消息
    const messageContainer = document.querySelector('.message-detail-content');
    if (messageContainer && window.messageApp.currentFriendId) {
      // 只添加新的消息气泡到容器末尾
      this.appendNewMessageBubbles(messageContainer, window.messageApp.currentFriendId);
    }
  }

  // 添加新消息气泡
  appendNewMessageBubbles(container, friendId) {
    // 获取最近未渲染的消息
    const recentMessages = this.getRecentMessagesForFriend(friendId);

    recentMessages.forEach(message => {
      const messageBubble = this.createMessageBubble(message);
      container.appendChild(messageBubble);
    });
  }

  // 创建消息气泡
  createMessageBubble(messageData) {
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${messageData.type}`;
    bubble.innerHTML = messageData.html;
    return bubble;
  }

  // 获取当前消息
  getCurrentMessages() {
    try {
      // 从 window.chat 获取消息
      if (window.chat && Array.isArray(window.chat)) {
        return window.chat;
      }

      // 从 SillyTavern 上下文获取
      if (window.SillyTavern && typeof window.SillyTavern.getContext === 'function') {
        const context = window.SillyTavern.getContext();
        return context.chat || [];
      }

      return [];
    } catch (error) {
      console.error('[增量渲染器] 获取当前消息失败:', error);
      return [];
    }
  }

  // 生成消息ID
  generateMessageId(message, index) {
    // 使用多种方式生成唯一ID
    if (message.id) {
      return `msg_${message.id}`;
    }
    if (message.send_date) {
      return `msg_${message.send_date}_${index}`;
    }
    // 使用消息内容的哈希作为备选
    const contentHash = this.simpleHash(message.mes || '', index);
    return `msg_${contentHash}_${index}`;
  }

  // 简单哈希函数
  simpleHash(str, seed = 0) {
    let hash = seed;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash).toString(36);
  }

  // 派发增量更新事件
  dispatchIncrementalUpdateEvent() {
    try {
      const event = new CustomEvent('incrementalRenderUpdate', {
        detail: {
          timestamp: Date.now(),
          processedCount: this.processedMessageIds.size,
          lastIndex: this.lastProcessedMessageIndex,
          cacheSize: this.cachedRenderedMessages.size,
        },
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('[增量渲染器] 派发事件失败:', error);
    }
  }

  // 启用/禁用增量渲染
  setEnabled(enabled) {
    this.isEnabled = enabled;
    console.log(`[增量渲染器] ${enabled ? '启用' : '禁用'}`);
  }

  // 清空缓存
  clearCache() {
    this.processedMessageIds.clear();
    this.cachedRenderedMessages.clear();
    this.lastProcessedMessageIndex = -1;
    console.log('[增量渲染器] 缓存已清空');
  }

  // 获取状态
  getStatus() {
    return {
      isEnabled: this.isEnabled,
      renderingInProgress: this.renderingInProgress,
      processedCount: this.processedMessageIds.size,
      cachedCount: this.cachedRenderedMessages.size,
      lastProcessedIndex: this.lastProcessedMessageIndex,
      hasFloorMonitor: !!this.floorMonitor,
    };
  }

  // 强制处理所有消息
  async forceProcessAll() {
    console.log('[增量渲染器] 强制处理所有消息...');
    this.clearCache();
    this.initializeCache();

    const allMessages = this.getCurrentMessages();
    const newMessages = allMessages.map((msg, index) => ({
      ...msg,
      index: index,
      id: this.generateMessageId(msg, index),
    }));

    await this.processNewMessages(newMessages);
  }

  // 处理新消息（SillyTavern格式）
  processNewMessages(sillyTavernMessages) {
    if (!Array.isArray(sillyTavernMessages)) {
      console.warn('[Incremental Renderer] 无效的消息数组');
      return;
    }

    console.log(`[Incremental Renderer] 处理 ${sillyTavernMessages.length} 条SillyTavern消息`);

    let newMessagesFound = 0;

    sillyTavernMessages.forEach((message, index) => {
      const messageId = this.generateMessageId(message, index);

      // 检查是否是新消息
      if (!this.processedMessageIds.has(messageId)) {
        // 转换SillyTavern消息格式
        const convertedMessage = this.convertSillyTavernMessage(message, index);

        if (convertedMessage) {
          // 处理新消息
          this.processMessage(convertedMessage);
          newMessagesFound++;
        }
      }
    });

    if (newMessagesFound > 0) {
      console.log(`[Incremental Renderer] ✅ 发现并处理了 ${newMessagesFound} 条新消息`);

      // 触发更新事件
      this.dispatchUpdateEvent({
        type: 'sillytavern_messages',
        newMessageCount: newMessagesFound,
        totalMessages: sillyTavernMessages.length,
      });
    }
  }

  // 转换SillyTavern消息格式
  convertSillyTavernMessage(sillyMessage, index) {
    try {
      // SillyTavern消息对象结构：
      // {
      //   mes: "消息内容",
      //   name: "发送者名称",
      //   is_user: boolean,
      //   send_date: timestamp,
      //   extra: { ... }
      // }

      const messageText = sillyMessage.mes || '';

      // 提取各种QQ格式
      const formats = this.extractAllFormats(messageText);

      if (formats.length === 0) {
        // 如果没有QQ格式，仍然记录这个消息以避免重复处理
        return {
          id: this.generateMessageId(sillyMessage, index),
          type: 'plain_text',
          content: messageText,
          sender: sillyMessage.name || 'Unknown',
          isUser: sillyMessage.is_user || false,
          timestamp: sillyMessage.send_date || Date.now(),
          formats: [],
        };
      }

      return {
        id: this.generateMessageId(sillyMessage, index),
        type: 'qq_format',
        content: messageText,
        sender: sillyMessage.name || 'Unknown',
        isUser: sillyMessage.is_user || false,
        timestamp: sillyMessage.send_date || Date.now(),
        formats: formats,
      };
    } catch (error) {
      console.error('[Incremental Renderer] 转换SillyTavern消息失败:', error);
      return null;
    }
  }

  // 为SillyTavern消息生成唯一ID
  generateMessageId(sillyMessage, index) {
    // 尝试多种方式生成唯一ID
    if (sillyMessage.send_date) {
      return `st_${sillyMessage.send_date}_${index}`;
    }

    if (sillyMessage.id) {
      return `st_${sillyMessage.id}`;
    }

    // 基于内容和索引生成哈希
    const content = sillyMessage.mes || '';
    const hash = this.simpleHash(content + index + (sillyMessage.name || ''));
    return `st_${hash}_${index}`;
  }

  // 简单哈希函数
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }
}

// 创建全局实例
window.IncrementalRenderer = IncrementalRenderer;

// 为其他模块提供接口
window.createIncrementalRenderer = function () {
  if (!window.incrementalRenderer) {
    window.incrementalRenderer = new IncrementalRenderer();
  }
  return window.incrementalRenderer;
};

console.log('[增量渲染器] 模块已加载完成');

// 导出类
if (typeof module !== 'undefined' && module.exports) {
  module.exports = IncrementalRenderer;
}
