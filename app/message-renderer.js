/**
 * Message Renderer - 消息渲染器
 * 从上下文中提取并渲染具体的聊天消息
 * 支持虚拟滚动和性能优化
 */

// 避免重复定义
if (typeof window.MessageRenderer === 'undefined') {
  // @ts-ignore
  window.MessageRenderer = class MessageRenderer {
    constructor() {
      this.contextMonitor = null;
      this.currentFriendId = null;
      this.myMessages = [];
      this.otherMessages = [];
      this.groupMessages = [];
      this.allMessages = [];
      this.retryCount = 0;
      this.maxRetries = 10;

      // 性能优化相关
      this.virtualScrolling = {
        itemHeight: 80, // 预估消息项高度
        visibleCount: 20, // 可见消息数量
        buffer: 10, // 缓冲区大小
        scrollTop: 0,
        startIndex: 0,
        endIndex: 20,
      };

      this.pagination = {
        pageSize: 50, // 每页消息数量
        currentPage: 0,
        totalPages: 0,
        loadedMessages: [],
        isLoading: false,
      };

      this.messageCache = new Map(); // 消息缓存
      this.renderCache = new Map(); // 渲染缓存

      // 🔥 新增：好友姓名到ID的映射
      this.friendNameToIdMap = new Map();
      this.groupNameToIdMap = new Map();
      this.generatedUserIds = new Map(); // 缓存生成的用户ID

      this.init();
    }

    init() {
      console.log('[Message Renderer] 消息渲染器初始化完成 - 已启用性能优化');
      this.loadContextMonitor();
    }

    /**
     * 🔥 最终稳健版：解析消息逻辑（彻底移除所有可能导致报错的符号）
     */
    parseMessagesFromRawText(rawText) {
      var messages = [];
      if (!rawText) return messages;

      var messageRegex = /\[(我方消息|对方消息|群聊消息|我方群聊消息)\|([^|]*)\|([^|]*)\|([^|]*)\|([^\]]*)\]/g;
      var match;
      var position = 0;

      while ((match = messageRegex.exec(rawText)) !== null) {
        var fullMatch = match[0];
        var messageType = match[1];
        var f1 = match[2];
        var f2 = match[3];
        var f3 = match[4];
        var f4 = match[5];

        var sender = "";
        var number = "";
        var msgType = "";
        var content = "";

        if (messageType === '群聊消息') {
          sender = f2; number = f1; msgType = f3; content = f4;
        } else if (messageType === '我方群聊消息' || messageType === '我方消息') {
          sender = '李至中'; // 核心改动点
          number = f2; msgType = f3; content = f4;
        } else {
          sender = f1; number = f2; msgType = f3; content = f4;
        }

        messages.push({
          fullMatch: fullMatch,
          messageType: messageType,
          sender: sender,
          number: number,
          msgType: msgType,
          content: content,
          textPosition: match.index,
          contextOrder: position++
        });
      }
      return messages;
    }
    
      // 🔥 修复：确保消息按原始文本中的出现顺序排列（最早→最新）
      // 原始文本中的消息顺序通常是正确的：对方消息在前，我方消息在后
      messages.sort((a, b) => a.textPosition - b.textPosition);
      console.log('[Message Renderer] 按原始文本位置排序，确保时间顺序正确');

      console.log('[Message Renderer] 从原始文本解析到', messages.length, '条消息');
      console.log(
        '[Message Renderer] 排序后的消息顺序:',
        messages.map((msg, i) => ({
          index: i,
          textPosition: msg.textPosition,
          content: msg.content?.substring(0, 20) + '...',
          fullMatch: msg.fullMatch?.substring(0, 40) + '...',
        })),
      );

      return messages;
    }

    /**
     * 🔥 估计消息在上下文中的位置
     */
    estimateMessagePosition(message, globalIndex) {
      // 🔥 修复：基于消息内容和上下文正确估计位置

      // 1. 如果有明确的位置字段，使用它
      if (message.textPosition !== undefined) return message.textPosition;
      if (message.contextOrder !== undefined) return message.contextOrder;
      if (message.index !== undefined) return message.index;
      if (message.position !== undefined) return message.position;
      if (message.order !== undefined) return message.order;

      // 2. 基于消息内容分析位置
      const content = message.content || '';
      const fullMatch = message.fullMatch || '';

      // 3. 根据消息类型和内容特征估计位置
      let estimatedPosition = globalIndex || 0;

      // 如果是红包消息，通常比较早
      if (content.includes('红包') || content.includes('100')) {
        estimatedPosition = estimatedPosition - 1000;
      }

      // 如果是语音消息，通常比较晚
      if (content.includes('语音') || message.msgType === '语音') {
        estimatedPosition = estimatedPosition + 1000;
      }

      // 如果是"早点休息"这类结束语，通常最晚
      if (content.includes('早点休息') || content.includes('明天见')) {
        estimatedPosition = estimatedPosition + 2000;
      }

      // 如果是"没事的"这类回应，通常在中间
      if (content.includes('没事的')) {
        estimatedPosition = estimatedPosition + 500;
      }

      // 如果是"在吗"这类开场白，通常比较早
      if (content.includes('在吗')) {
        estimatedPosition = estimatedPosition - 500;
      }

      // 4. 根据提取顺序调整
      if (message._extractionOrder !== undefined) {
        estimatedPosition = estimatedPosition + message._extractionOrder * 100;
      }

      // 5. 根据类型索引调整
      if (message._typeIndex !== undefined) {
        estimatedPosition = estimatedPosition + message._typeIndex;
      }

      return estimatedPosition;
    }

    /**
     * 简单哈希函数
     */
    simpleHash(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // 转换为32位整数
      }
      return Math.abs(hash);
    }

    /**
     * 🔥 新增：建立好友姓名到ID的映射关系
     * 从动态提取的数据格式中解析好友和群聊信息
     */
    buildFriendNameToIdMapping() {
      const friendMap = new Map();
      const groupMap = new Map();

      // 检查是否有FriendRenderer实例
      // @ts-ignore
      if (window.friendRenderer && window.friendRenderer.extractedFriends) {
        // @ts-ignore
        window.friendRenderer.extractedFriends.forEach(contact => {
          if (contact.isGroup) {
            // 群聊：记录群名到群ID的映射
            groupMap.set(contact.name, contact.number);
            if (window.DEBUG_MESSAGE_RENDERER) {
              console.log(`[Message Renderer] 群聊映射: ${contact.name} -> ${contact.number}`);
            }
          } else {
            // 好友：记录好友名到好友ID的映射
            friendMap.set(contact.name, contact.number);
            if (window.DEBUG_MESSAGE_RENDERER) {
              console.log(`[Message Renderer] 好友映射: ${contact.name} -> ${contact.number}`);
            }
          }
        });
      }

      // 如果没有提取到信息，尝试从上下文中直接解析
      if (friendMap.size === 0 && groupMap.size === 0) {
        console.log('[Message Renderer] 尝试从上下文中直接解析好友和群聊信息');
        this.parseFriendDataFromContext(friendMap, groupMap);
      }

      // 存储映射关系
      this.friendNameToIdMap = friendMap;
      this.groupNameToIdMap = groupMap;

      if (window.DEBUG_MESSAGE_RENDERER) {
        console.log(`[Message Renderer] 建立了 ${friendMap.size} 个好友映射和 ${groupMap.size} 个群聊映射`);
      }
      return { friendMap, groupMap };
    }

    /**
     * 🔥 新增：从上下文中直接解析好友和群聊数据
     */
    parseFriendDataFromContext(friendMap, groupMap) {
      try {
        // 检查SillyTavern是否可用
        // @ts-ignore
        if (!window.SillyTavern || !window.SillyTavern.getContext) {
          console.warn('[Message Renderer] SillyTavern上下文不可用');
          return;
        }

        // @ts-ignore
        const context = window.SillyTavern.getContext();
        if (!context || !context.chat || !Array.isArray(context.chat)) {
          console.warn('[Message Renderer] 聊天数据不可用');
          return;
        }

        // 定义正则表达式匹配动态提取的格式
        const friendPattern = /\[好友id\|([^|]+)\|(\d+)\]/g;
        const groupPattern = /\[群聊\|([^|]+)\|([^|]+)\|([^\]]+)\]/g;

        context.chat.forEach(message => {
          if (message.mes && typeof message.mes === 'string') {
            // 移除thinking标签
            const messageForMatching = this.removeThinkingTags ? this.removeThinkingTags(message.mes) : message.mes;

            // 提取好友信息：[好友id|络络|555555]
            const friendMatches = [...messageForMatching.matchAll(friendPattern)];
            friendMatches.forEach(match => {
              const friendName = match[1];
              const friendId = match[2];
              friendMap.set(friendName, friendId);
            });

            // 提取群聊信息：[群聊|一家人|123456|我、络络、江叙之]
            const groupMatches = [...messageForMatching.matchAll(groupPattern)];
            groupMatches.forEach(match => {
              const groupName = match[1];
              const groupId = match[2];
              const membersList = match[3];

              groupMap.set(groupName, groupId);

              // 🔥 新增：解析群聊成员列表，为每个成员建立映射
              if (membersList) {
                const members = membersList
                  .split(/[、,，]/)
                  .map(name => name.trim())
                  .filter(name => name);
                members.forEach(memberName => {
                  // 如果成员不在好友映射中，生成一个唯一ID
                  if (!friendMap.has(memberName) && memberName !== '我') {
                    const generatedId = this.generateUserIdFromName(memberName);
                    friendMap.set(memberName, generatedId);
                    console.log(`[Message Renderer] 为群聊成员 "${memberName}" 建立映射: ${generatedId}`);
                  }
                });
              }
            });
          }
        });
      } catch (error) {
        console.error('[Message Renderer] 解析好友数据时出错:', error);
      }
    }

    /**
     * 🔥 新增：根据发送者姓名获取对应的ID
     */
    getIdBySenderName(senderName, isGroupMessage) {
      // 首先检查是否已建立映射
      if (!this.friendNameToIdMap || !this.groupNameToIdMap) {
        this.buildFriendNameToIdMapping();
      }

      if (isGroupMessage) {
        // 对于群聊消息，尝试从群聊映射中查找
        // 注意：群聊消息的发送者是群内成员，我们需要的是群ID
        // 这里可能需要根据当前聊天上下文来确定群ID
        return this.currentFriendId || '';
      } else {
        // 对于私聊消息，从好友映射中查找
        return this.friendNameToIdMap.get(senderName) || '';
      }
    }

    /**
     * 🔥 新增：移除thinking标签的辅助方法（如果不存在的话）
     */
    removeThinkingTags(text) {
      if (!text) return '';
      // 移除 <thinking>...</thinking> 标签及其内容
      return text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    }

    /**
     * 🔥 新增：为用户姓名生成唯一ID
     * 用于群聊中没有明确好友关系的成员
     */
    generateUserIdFromName(userName) {
      if (!userName) return '';

      // 方法1：使用简单哈希算法生成数字ID
      let hash = this.simpleHash(userName);

      // 确保ID是6位数字，添加固定前缀避免与真实ID冲突
      let generatedId = '8' + (hash % 100000).toString().padStart(5, '0');

      console.log(`[Message Renderer] 为用户 "${userName}" 生成ID: ${generatedId}`);

      // 缓存生成的ID，确保同一用户总是得到相同的ID
      if (!this.generatedUserIds) {
        this.generatedUserIds = new Map();
      }

      if (this.generatedUserIds.has(userName)) {
        return this.generatedUserIds.get(userName);
      } else {
        this.generatedUserIds.set(userName, generatedId);
        return generatedId;
      }
    }

    // 加载上下文监控器
    loadContextMonitor() {
      // @ts-ignore
      if (window.ContextMonitor && window.contextMonitor) {
        // @ts-ignore
        this.contextMonitor = window.contextMonitor;
        console.log('[Message Renderer] 上下文监控器已连接');
        this.retryCount = 0; // 重置重试计数
      } else if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.warn(`[Message Renderer] 上下文监控器未找到，将延迟连接 (第${this.retryCount}次尝试)`);
        setTimeout(() => {
          this.loadContextMonitor();
        }, 1000);
      } else {
        console.error('[Message Renderer] 上下文监控器连接失败，已达到最大重试次数');
        // 创建空的上下文监控器以避免错误
        this.createFallbackContextMonitor();
      }
    }

    // 创建备用上下文监控器
    createFallbackContextMonitor() {
      console.warn('[Message Renderer] 使用备用上下文监控器');
      this.contextMonitor = {
        extractFromCurrentChat: async formatName => {
          console.warn('[Message Renderer] 使用备用上下文监控器，返回空数据');
          return {
            formatName: formatName,
            chatId: 'fallback',
            totalMessages: 0,
            extractedCount: 0,
            extractions: [],
            extractedAt: new Date(),
          };
        },
      };
    }

    /**
     * 提取指定好友的所有消息
     * @param {string|string[]} friendId - 好友ID，可以是单个ID或ID数组
     */
    async extractMessagesForFriend(friendId) {
      if (!this.contextMonitor) {
        throw new Error('上下文监控器未加载');
      }

      try {
        if (window.DEBUG_MESSAGE_RENDERER) {
          console.log('[Message Renderer] 🔥 开始使用统一提取法，保持原始穿插顺序');
        }

        // 🔥 新增：在提取消息前建立好友映射
        this.buildFriendNameToIdMapping();

        // 🔥 核心修复：使用统一提取法，一次性提取所有消息
        // 这样可以保持消息在原始文本中的穿插顺序
        if (window.DEBUG_MESSAGE_RENDERER) {
          console.log('[Message Renderer] 使用统一提取法（保持原始穿插顺序）');
        }

        // 使用universalMessage格式来提取所有消息
        // 这个格式可以匹配所有类型的消息，保持原始顺序
        const result = await this.contextMonitor.extractFromCurrentChat('universalMessage');

        if (!result || !result.extractions) {
          console.warn('[Message Renderer] 统一提取失败，尝试备用方法');
          // 备用方法：使用分别提取法
          return this.extractMessagesWithFallback(friendId);
        }

        let allExtractions = result.extractions;

        if (window.DEBUG_MESSAGE_RENDERER) {
          console.log(`[Message Renderer] 统一提取到 ${allExtractions.length} 条消息`);
        }

        // 修复：只在调试模式下显示详细消息顺序
        if (window.DEBUG_MESSAGE_RENDERER) {
          console.log('[Message Renderer] 原始提取顺序:');
          allExtractions.forEach((msg, index) => {
            console.log(`消息${index + 1}:`, {
              content: msg.content?.substring(0, 30) + '...',
              fullMatch: msg.fullMatch?.substring(0, 50) + '...',
              index: msg.index,
              globalIndex: msg.globalIndex,
              messageIndex: msg.messageIndex,
              originalMessageIndex: msg.originalMessageIndex,
            });
          });
        }

        // 过滤出指定好友的消息（保持原始顺序）
        let friendMessages = [];

        allExtractions.forEach((msg, originalIndex) => {
          // 处理不同格式的字段映射
          let msgIdentifier;

          if (msg.fullMatch && msg.fullMatch.startsWith('[群聊消息')) {
            // 群聊消息格式：[群聊消息|群ID|发送者|消息类型|消息内容]
            // 对于universalMessage格式，character字段是群ID，number字段是发送者
            if (msg.character && msg.number) {
              // 这是universalMessage格式的结果
              msgIdentifier = String(msg.character || ''); // 群ID
              // 修复字段映射
              msg.sender = msg.number; // 发送者
              msg.number = msg.character; // 群ID
            } else {
              // 这是groupMessage格式的结果
              msgIdentifier = String(msg.number || '');
            }
          } else if (msg.fullMatch && msg.fullMatch.startsWith('[我方群聊消息')) {
            // 我方群聊消息格式：[我方群聊消息|我|群ID|消息类型|消息内容]
            if (msg.character && msg.number) {
              // 这是universalMessage格式的结果
              msgIdentifier = String(msg.character || ''); // 群ID
              // 修复字段映射
              msg.sender = '我'; // 发送者
              msg.number = msg.character; // 群ID
            } else {
              // 这是myGroupMessage格式的结果
              msgIdentifier = String(msg.number || '');
            }
          } else {
            // 普通消息
            msgIdentifier = String(msg.number || '');
          }

          // 修复：只在调试模式下输出群聊消息调试信息
          if (
            window.DEBUG_MESSAGE_RENDERER &&
            msg.fullMatch &&
            (msg.fullMatch.startsWith('[群聊消息') || msg.fullMatch.startsWith('[我方群聊消息'))
          ) {
            console.log(`[Message Renderer] 群聊消息调试:`, {
              fullMatch: msg.fullMatch?.substring(0, 50) + '...',
              number: msg.number,
              sender: msg.sender,
              msgIdentifier: msgIdentifier,
              character: msg.character,
            });
          }

          // 支持单个好友ID或好友ID数组
          const targetIds = Array.isArray(friendId) ? friendId.map(String) : [String(friendId)];
          const isMatch = targetIds.includes(msgIdentifier);

          if (isMatch) {
            // 修复：只在调试模式下输出匹配成功日志
            if (window.DEBUG_MESSAGE_RENDERER) {
              console.log(
                `[Message Renderer] 匹配成功: ${msgIdentifier} 在 [${targetIds.join(', ')}] 中, 原始位置: ${
                  msg.globalIndex
                }, 消息: ${msg.fullMatch?.substring(0, 50)}...`,
              );
            }

            // 为消息添加原始位置信息
            msg.originalIndex = originalIndex;
            friendMessages.push(msg);
          }
        });

        if (window.DEBUG_MESSAGE_RENDERER) {
          console.log('过滤后的好友消息数量:', friendMessages.length);
          console.log(
            '过滤后的消息顺序:',
            friendMessages.map((msg, i) => ({
              index: i,
              globalIndex: msg.globalIndex,
              content: msg.content?.substring(0, 20) + '...',
              fullMatch: msg.fullMatch?.substring(0, 40) + '...',
            })),
          );
        }

        // 🔥 修复：确保消息按全局索引排序，保持原始穿插顺序
        friendMessages.sort((a, b) => {
          // 🔥 优先使用 globalIndex（全局提取顺序）- 这是最重要的
          // globalIndex 反映了消息在原始文本中的出现顺序
          if (a.globalIndex !== undefined && b.globalIndex !== undefined) {
            return a.globalIndex - b.globalIndex;
          }

          // 其次使用 messageIndex（消息索引）
          if (a.messageIndex !== undefined && b.messageIndex !== undefined) {
            return a.messageIndex - b.messageIndex;
          }

          // 再次使用 originalIndex（在 allExtractions 中的位置）
          if (a.originalIndex !== undefined && b.originalIndex !== undefined) {
            return a.originalIndex - b.originalIndex;
          }

          // 最后使用时间戳排序（如果有的话）
          if (a.messageTimestamp && b.messageTimestamp) {
            const timeA = new Date(a.messageTimestamp).getTime();
            const timeB = new Date(b.messageTimestamp).getTime();
            if (timeA !== timeB) {
              return timeA - timeB;
            }
          }

          return 0;
        });
        console.log('[Message Renderer] 按全局索引排序，确保原始穿插顺序正确');

        if (window.DEBUG_MESSAGE_RENDERER) {
          console.log(
            '排序后的消息顺序:',
            friendMessages.map((msg, i) => ({
              index: i,
              globalIndex: msg.globalIndex,
              content: msg.content?.substring(0, 20) + '...',
              fullMatch: msg.fullMatch?.substring(0, 40) + '...',
            })),
          );
        }

        if (window.DEBUG_MESSAGE_RENDERER) {
          console.log('过滤并排序后的好友消息数量:', friendMessages.length);
          console.log(
            '排序后的消息详细信息:',
            friendMessages.map((msg, index) => ({
              排序位置: index,
              globalIndex: msg.globalIndex,
              content: msg.content?.substring(0, 30) + '...',
              fullMatch: msg.fullMatch?.substring(0, 50) + '...',
              isMyMessage: msg.fullMatch?.startsWith('[我方消息'),
              isGroupMessage: msg.fullMatch?.startsWith('[群聊消息'),
              // 🔥 添加name和extra信息，用于统一性检查
              originalMessageName: msg.originalMessageName,
              originalMessageExtra: msg.originalMessageExtra,
              originalMessageIndex: msg.originalMessageIndex,
              所有字段: Object.keys(msg),
            })),
          );
        }

        // 分别统计我方、对方和群聊消息
        const myMessages = friendMessages.filter(msg => msg.fullMatch && msg.fullMatch.startsWith('[我方消息'));
        const otherMessages = friendMessages.filter(msg => msg.fullMatch && msg.fullMatch.startsWith('[对方消息'));
        const groupMessages = friendMessages.filter(
          msg => msg.fullMatch && (msg.fullMatch.startsWith('[群聊消息') || msg.fullMatch.startsWith('[我方群聊消息')),
        );

        if (window.DEBUG_MESSAGE_RENDERER) {
          console.log(
            `[Message Renderer] 提取完成：我方消息 ${myMessages.length} 条，对方消息 ${otherMessages.length} 条，群聊消息 ${groupMessages.length} 条`,
          );
        }

        return {
          myMessages: myMessages,
          otherMessages: otherMessages,
          groupMessages: groupMessages,
          allMessages: friendMessages,
        };
      } catch (error) {
        console.error('[Message Renderer] 提取消息时发生错误:', error);
        throw error;
      }
    }

    /**
     * 备用提取方法：使用分别提取法
     */
    async extractMessagesWithFallback(friendId) {
      console.log('[Message Renderer] 使用备用分别提取法');

      const extractionResults = [];
      const extractionTasks = [
        { name: 'myMessage', order: 1 },
        { name: 'otherMessage', order: 2 },
        { name: 'groupMessage', order: 3 },
        { name: 'myGroupMessage', order: 4 },
      ];

      // 按顺序提取每种类型的消息
      for (const task of extractionTasks) {
        try {
          const result = await this.contextMonitor.extractFromCurrentChat(task.name);
          if (result && result.extractions) {
            result.extractions.forEach((msg, index) => {
              msg._extractionType = task.name;
              msg._extractionOrder = task.order;
              msg._typeIndex = index;
              msg._estimatedPosition = msg.index || 0;
              if (msg.globalIndex !== undefined) {
                msg._globalIndex = msg.globalIndex;
              }
              extractionResults.push(msg);
            });
          }
        } catch (e) {
          console.warn(`[Message Renderer] 提取 ${task.name} 失败:`, e);
        }
      }

      // 按index排序
      extractionResults.sort((a, b) => {
        const aIndex = a.index || 0;
        const bIndex = b.index || 0;
        return aIndex - bIndex;
      });

      // 过滤出指定好友的消息
      let friendMessages = [];
      extractionResults.forEach((msg, originalIndex) => {
        let msgIdentifier;
        if (msg.fullMatch && (msg.fullMatch.startsWith('[群聊消息') || msg.fullMatch.startsWith('[我方群聊消息'))) {
          msgIdentifier = String(msg.number || '');
        } else {
          msgIdentifier = String(msg.number || '');
        }

        const targetIds = Array.isArray(friendId) ? friendId.map(String) : [String(friendId)];
        const isMatch = targetIds.includes(msgIdentifier);

        if (isMatch) {
          msg.originalIndex = originalIndex;
          friendMessages.push(msg);
        }
      });

      // 按全局索引排序
      friendMessages.sort((a, b) => {
        if (a.globalIndex !== undefined && b.globalIndex !== undefined) {
          return a.globalIndex - b.globalIndex;
        }
        if (a.messageIndex !== undefined && b.messageIndex !== undefined) {
          return a.messageIndex - b.messageIndex;
        }
        if (a.originalIndex !== undefined && b.originalIndex !== undefined) {
          return a.originalIndex - b.originalIndex;
        }
        return 0;
      });

      // 分别统计
      const myMessages = friendMessages.filter(msg => msg.fullMatch && msg.fullMatch.startsWith('[我方消息'));
      const otherMessages = friendMessages.filter(msg => msg.fullMatch && msg.fullMatch.startsWith('[对方消息'));
      const groupMessages = friendMessages.filter(
        msg => msg.fullMatch && (msg.fullMatch.startsWith('[群聊消息') || msg.fullMatch.startsWith('[我方群聊消息')),
      );

      return {
        myMessages: myMessages,
        otherMessages: otherMessages,
        groupMessages: groupMessages,
        allMessages: friendMessages,
      };
    }

    /**
     * 渲染消息详情页面 - 反向分页模式
     */
    async renderMessageDetail(friendId, friendName) {
      if (window.DEBUG_MESSAGE_RENDERER) {
        console.log(`[Message Renderer] 渲染消息详情 (反向分页模式): ${friendId}, ${friendName}`);
      }

      if (!this.contextMonitor) {
        console.error('[Message Renderer] 上下文监控器未初始化');
        return this.renderErrorMessageDetail(friendId, friendName, '上下文监控器未初始化');
      }

      try {
        // 重置分页状态
        this.resetPagination();

        // 提取消息数据
        const messageData = await this.extractMessagesForFriend(friendId);

        if (!messageData || messageData.allMessages.length === 0) {
          return this.renderEmptyMessageDetail(friendId, friendName);
        }

        const totalCount = messageData.allMessages.length;
        if (window.DEBUG_MESSAGE_RENDERER) {
          console.log(`[Message Renderer] 找到 ${totalCount} 条消息，启用反向分页模式`);
        }

        // 显示性能优化提示
        if (totalCount > 100) {
          this.showPerformanceIndicator(`反向分页已启用 (${totalCount}条消息)`, 3000);
        }

        // 初始化反向分页 - 从最新消息开始
        this.initReversePagination(messageData.allMessages);

        // 渲染最新的消息（最后一页）
        const latestMessages = this.getLatestMessages();
        if (window.DEBUG_MESSAGE_RENDERER) {
          console.log(`[Message Renderer] 获取到 ${latestMessages.length} 条最新消息`);
        }

        // 修复：只在调试模式下显示最新消息的顺序
        if (window.DEBUG_MESSAGE_RENDERER && latestMessages.length > 0) {
          console.log('[Message Renderer] 最新消息顺序验证:');
          console.log('第一条显示的消息:', latestMessages[0]?.content?.substring(0, 30) + '...');
          console.log(
            '最后一条显示的消息:',
            latestMessages[latestMessages.length - 1]?.content?.substring(0, 30) + '...',
          );
          console.log('应该是最新的消息在底部');
        }

        const messagesHtml = this.renderMessagesBatch(latestMessages);

        this._lastRenderedMessageKeys = latestMessages.map(m => this.getMessageKey(m));
        this._lastRenderedMessageHashes = latestMessages.map(m => this.getMessageRenderHash(m));

        return `
                <div class="message-detail-app">
                    <div class="message-detail-content" id="message-detail-content" data-background-id="${friendId}">
                        <div class="messages-wrapper" id="messages-wrapper">
                            ${this.renderLoadOlderButton()}
                            <div class="messages-container" id="messages-container">
                                ${messagesHtml}
                            </div>
                        </div>
                    </div>
                    <div class="message-detail-footer">
                        <div class="message-stats">
                            显示最新 ${latestMessages.length}/${totalCount} 条消息
                            (我方: ${messageData.myMessages.length}, 对方: ${messageData.otherMessages.length}, 群聊: ${
          messageData.groupMessages.length
        })
                        </div>
                        <div class="message-send-area">
                            <div class="send-input-container">
                                <textarea id="message-send-input" placeholder="发送消息..." maxlength="1000"></textarea>
                                <div class="send-tools">
                                    <button class="send-tool-btn" id="send-emoji-btn" title="表情"><i class="fas fa-smile"></i></button>
                                    <button class="send-tool-btn" id="send-sticker-btn" title="表情包"><i class="fas fa-image"></i></button>
                                    <button class="send-tool-btn" id="send-voice-btn" title="语音"><i class="fas fa-microphone"></i></button>
                                    <button class="send-tool-btn" id="send-redpack-btn" title="红包"><i class="fas fa-gift"></i></button>
                                </div>
                            </div>
                            <button class="send-message-btn" id="send-message-btn"><i class="fas fa-paper-plane"></i></button>
                        </div>
                    </div>
                </div>
            `;
      } catch (error) {
        console.error('[Message Renderer] 渲染消息详情失败:', error);
        return this.renderErrorMessageDetail(friendId, friendName, error.message);
      }
    }

    /**
     * 重置分页状态
     */
    resetPagination() {
      this.pagination = {
        pageSize: 50,
        currentPage: 0,
        totalPages: 0,
        loadedMessages: [],
        isLoading: false,
      };
      this.virtualScrolling.startIndex = 0;
      this.virtualScrolling.endIndex = this.virtualScrolling.visibleCount;
    }

    /**
     * 初始化分页
     */
    initPagination(allMessages) {
      this.pagination.totalPages = Math.ceil(allMessages.length / this.pagination.pageSize);
      this.pagination.loadedMessages = [...allMessages]; // 复制消息数组
      console.log(`[Message Renderer] 分页初始化: ${allMessages.length} 条消息, ${this.pagination.totalPages} 页`);
    }

    /**
     * 初始化反向分页 - 从最新消息开始
     */
    initReversePagination(allMessages) {
      this.pagination.totalPages = Math.ceil(allMessages.length / this.pagination.pageSize);
      this.pagination.loadedMessages = [...allMessages]; // 复制消息数组
      // 从最后一页开始（最新消息）
      this.pagination.currentPage = this.pagination.totalPages - 1;
      this.pagination.loadedPages = 1; // 已加载页数
      if (window.DEBUG_MESSAGE_RENDERER) {
        console.log(
          `[Message Renderer] 反向分页初始化: ${allMessages.length} 条消息, ${this.pagination.totalPages} 页, 从第${
            this.pagination.currentPage + 1
          }页开始`,
        );
      }

      // 修复：只在调试模式下显示消息时间顺序验证
      if (window.DEBUG_MESSAGE_RENDERER && allMessages.length > 0) {
        console.log('[Message Renderer] 消息时间顺序验证:');
        console.log('第一条消息:', allMessages[0]?.content?.substring(0, 30) + '...');
        console.log('最后一条消息:', allMessages[allMessages.length - 1]?.content?.substring(0, 30) + '...');
      }
    }

    /**
     * 获取指定页的消息
     */
    getPageMessages(pageIndex) {
      const startIndex = pageIndex * this.pagination.pageSize;
      const endIndex = Math.min(startIndex + this.pagination.pageSize, this.pagination.loadedMessages.length);
      return this.pagination.loadedMessages.slice(startIndex, endIndex);
    }

    /**
     * 获取最新的消息（反向分页使用）
     */
    getLatestMessages() {
      const totalMessages = this.pagination.loadedMessages.length;
      const startIndex = Math.max(0, totalMessages - this.pagination.pageSize);
      const latestMessages = this.pagination.loadedMessages.slice(startIndex);

      if (window.DEBUG_MESSAGE_RENDERER) {
        console.log(
          `[Message Renderer] 获取最新消息: 总数${totalMessages}, 起始索引${startIndex}, 获取${latestMessages.length}条`,
        );
        console.log(
          '[Message Renderer] 最新消息内容:',
          latestMessages.map((msg, i) => ({
            index: i,
            content: msg.content?.substring(0, 30) + '...',
            isLatest: i === latestMessages.length - 1,
          })),
        );
      }

      return latestMessages;
    }

    /**
     * 获取历史消息（反向分页使用）
     */
    getOlderMessages() {
      const totalMessages = this.pagination.loadedMessages.length;
      const loadedPages = this.pagination.loadedPages || 1;
      const pageSize = this.pagination.pageSize;

      // 计算要加载的历史消息范围
      const endIndex = totalMessages - loadedPages * pageSize;
      const startIndex = Math.max(0, endIndex - pageSize);

      const olderMessages = this.pagination.loadedMessages.slice(startIndex, endIndex);

      console.log(
        `[Message Renderer] 获取历史消息: 总数${totalMessages}, 范围${startIndex}-${endIndex}, 获取${olderMessages.length}条`,
      );
      console.log(
        '[Message Renderer] 历史消息内容:',
        olderMessages.map((msg, i) => ({
          index: i,
          content: msg.content?.substring(0, 30) + '...',
          isOldest: i === 0,
        })),
      );

      return olderMessages;
    }

    /**
     * 批量渲染消息 - 优化DOM操作
     */
        /**
     * 批量渲染消息 - 保留缓存，尽量少的 DOM 操作
     */
    renderMessagesBatch(messages) {
      // 使用缓存
      const cacheKey = this.generateCacheKey(messages);
      if (this.renderCache.has(cacheKey)) {
        return this.renderCache.get(cacheKey);
      }

      // 保持原有顺序（messages 已经按时间排序）
      const htmlArray = [];
      for (let i = 0; i < messages.length; i++) {
        htmlArray.push(this.renderSingleMessage(messages[i]));
      }
      const result = htmlArray.join('');

      // 写入缓存并限制大小
      this.renderCache.set(cacheKey, result);
      if (this.renderCache.size > 50) {
        const firstKey = this.renderCache.keys().next().value;
        this.renderCache.delete(firstKey);
      }
      return result;
    }

    // 生成用于比对的消息唯一key（尽量稳定）
    getMessageKey(message) {
      if (!message) return 'null';
      if (message.id !== undefined && message.id !== null) return `id:${message.id}`;
      if (message.messageIndex !== undefined && message.messageIndex !== null) return `mi:${message.messageIndex}`;
      if (message.globalIndex !== undefined && message.globalIndex !== null) return `gi:${message.globalIndex}`;
      if (message.textPosition !== undefined && message.textPosition !== null) return `tp:${message.textPosition}`;
      if (message.contextOrder !== undefined && message.contextOrder !== null) return `co:${message.contextOrder}`;
      if (message.fullMatch) return `fm:${this.simpleHash(String(message.fullMatch))}`;
      const raw = [message.messageType || '', message.sender || '', message.number || '', message.msgType || ''].join('|');
      return `h:${this.simpleHash(raw)}`;
    }

    // 生成用于检测同一条消息内容是否变化的渲染签名（hash）
    getMessageRenderHash(message) {
      try {
        const raw = [
          message.messageType || '',
          message.sender || '',
          message.number || '',
          message.msgType || '',
          message.content || '',
          message.detailedContent || '',
          message.extra ? JSON.stringify(message.extra) : ''
        ].join('|');
        return String(this.simpleHash(raw));
      } catch (e) {
        return String(Date.now());
      }
    }

    // 基于前缀/后缀相同的增量更新（常见仅尾部变化）
    incrementalUpdateMessages(container, newMessages) {
      if (!container) return;
      const oldLen = Array.isArray(this._lastRenderedMessageKeys) ? this._lastRenderedMessageKeys.length : 0;
      const newKeys = (newMessages || []).map(m => this.getMessageKey(m));
      const newHashes = (newMessages || []).map(m => this.getMessageRenderHash(m));

      // 如果容器现有子节点数量与上次记录不一致（例如老版本渲染或加载过历史消息），直接整页重绘
      const childrenLen = container.children ? container.children.length : 0;
      if (oldLen !== childrenLen) {
        container.innerHTML = this.renderMessagesBatch(newMessages);
        this._lastRenderedMessageKeys = newKeys;
        this._lastRenderedMessageHashes = newHashes;
        this.initLazyLoadingForNewMessages();
        return;
      }

      // 最长公共前缀（键+内容不变）
      let prefix = 0;
      const minLen = Math.min(oldLen, newKeys.length);
      while (
        prefix < minLen &&
        this._lastRenderedMessageKeys[prefix] === newKeys[prefix] &&
        this._lastRenderedMessageHashes[prefix] === newHashes[prefix]
      ) {
        prefix++;
      }

      // 完全一致，无需更新
      if (prefix === oldLen && prefix === newKeys.length) return;

      // 同样计算公共后缀
      let suffix = 0;
      while (
        suffix < (oldLen - prefix) &&
        suffix < (newKeys.length - prefix) &&
        this._lastRenderedMessageKeys[oldLen - 1 - suffix] === newKeys[newKeys.length - 1 - suffix] &&
        this._lastRenderedMessageHashes[oldLen - 1 - suffix] === newHashes[newHashes.length - 1 - suffix]
      ) {
        suffix++;
      }

      const mustRemove = oldLen - prefix - suffix; // 需要替换的旧节点数量
      const mustInsert = newKeys.length - prefix - suffix; // 需要插入的新节点数量

      // 删除中间需要替换的旧节点（从 prefix 到 oldLen - suffix - 1）
      for (let r = 0; r < mustRemove; r++) {
        const nodeToRemove = container.children[prefix];
        if (nodeToRemove) container.removeChild(nodeToRemove);
      }

      // 插入新节点：在后缀首节点之前插入（如果存在），否则追加到末尾
      const anchorNode = suffix > 0 ? container.children[prefix] : null;
      if (mustInsert > 0) {
        const fragment = document.createDocumentFragment();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = this.renderMessagesBatch(newMessages.slice(prefix, prefix + mustInsert));
        while (tempDiv.firstChild) fragment.appendChild(tempDiv.firstChild);
        if (anchorNode) {
          container.insertBefore(fragment, anchorNode);
        } else {
          container.appendChild(fragment);
        }
      }

      // 更新缓存并补挂懒加载
      this._lastRenderedMessageKeys = newKeys;
      this._lastRenderedMessageHashes = newHashes;
      this.initLazyLoadingForNewMessages();

    // 生成用于比对的消息唯一key（尽量稳定）
    }
        generateCacheKey(messages) {
      if (!messages || messages.length === 0) return 'empty';
      const first = messages[0] || {};
      const last = messages[messages.length - 1] || {};
      const idPart = `${messages.length}_${first.messageIndex || 0}_${last.messageIndex || 0}`;
      // 加入内容指纹，避免同长度/同索引但内容变化时命中旧缓存
      const sig = this.simpleHash(
        messages
          .map(m => `${this.getMessageKey(m)}:${this.getMessageRenderHash(m)}`)
          .join('|')
      );
      return `${idPart}_${sig}`;
    }

    /**
     * 渲染加载更多按钮（向下加载新消息）
     */
    renderLoadMoreButton() {
      if (this.pagination.currentPage >= this.pagination.totalPages - 1) {
        return ''; // 没有更多消息
      }

      return `
            <div class="load-more-container" style="text-align: center; padding: 20px;">
                <button id="load-more-messages-btn"
                        class="load-more-btn"
                        style="padding: 10px 20px; border: 1px solid #ddd; border-radius: 20px; background: #f8f9fa; color: #333; cursor: pointer; font-size: 14px; transition: all 0.3s ease;">
                    加载更多消息 (${this.pagination.currentPage + 1}/${this.pagination.totalPages})
                </button>
            </div>
        `;
    }

    /**
     * 渲染加载历史消息按钮（向上加载老消息）
     */
    renderLoadOlderButton() {
      // 计算剩余可加载的页数
      const remainingPages = this.pagination.totalPages - (this.pagination.loadedPages || 1);

      if (remainingPages <= 0) {
        return ''; // 没有更多历史消息
      }

      return `
            <div class="load-older-container" style="text-align: center; padding: 20px; background: linear-gradient(180deg, #f8f9fa 0%, rgba(248, 249, 250, 0.8) 50%, transparent 100%);">
                <button id="load-older-messages-btn"
                        class="load-older-btn"
                        style="padding: 10px 20px; border: 1px solid #ddd; border-radius: 20px; background: #f8f9fa; color: #333; cursor: pointer; font-size: 14px; transition: all 0.3s ease; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                    📜 加载历史消息 (还有${remainingPages}页)
                </button>
            </div>
        `;
    }

    /**
     * 渲染单条消息
     */
    renderSingleMessage(message) {
      // 判断消息类型
      const isMine = message.fullMatch && message.fullMatch.startsWith('[我方消息');
      const isGroupMessage =
        message.fullMatch &&
        (message.fullMatch.startsWith('[群聊消息') || message.fullMatch.startsWith('[我方群聊消息'));
      const isMyGroupMessage = message.fullMatch && message.fullMatch.startsWith('[我方群聊消息');

      let messageClass = '';
      let senderName = '';

      if (isGroupMessage) {
        if (isMyGroupMessage) {
          // 我方群聊消息
          messageClass = 'message-sent group-message';
          senderName = '我';
        } else {
          // 其他群聊消息：判断是否是我发送的
          // 现在sender字段已经正确映射了发送者
          const senderInMessage = message.sender || '';
          const isMyGroupMessage = senderInMessage === '我';

          messageClass = isMyGroupMessage ? 'message-sent group-message' : 'message-received group-message';
          senderName = senderInMessage;
        }
      } else {
        // 普通私聊消息
        messageClass = isMine ? 'message-sent' : 'message-received';
        senderName = message.character || '';
      }

      // 提取字段值
      // 🔥 修复：统一使用 message.number 字段，它在字段映射过程中已经正确设置
      // 对于群聊消息，number 字段包含群ID
      // 对于普通消息，number 字段包含好友ID
      let friendId = message.number || '';
      const messageType = message.messageType || '';
      const content = message.content || '';

      // 🔥 新增：尝试通过发送者姓名获取更精确的ID
      if (!friendId && senderName) {
        // 确保映射已建立
        if (this.friendNameToIdMap.size === 0 && this.groupNameToIdMap.size === 0) {
          this.buildFriendNameToIdMapping();
        }

        // 对于所有消息（包括群聊），都尝试获取发送者的个人ID
        const mappedId = this.friendNameToIdMap.get(senderName);
        if (mappedId) {
          friendId = mappedId;
          console.log(`[Message Renderer] 通过姓名 "${senderName}" 映射到个人ID: ${friendId}`);
        } else if (isGroupMessage) {
          // 如果是群聊消息但找不到发送者的个人ID，则使用群ID作为备用
          friendId = this.currentFriendId || '';
          console.log(`[Message Renderer] 群聊消息找不到 "${senderName}" 的个人ID，使用群ID: ${friendId}`);
        }
      }

      // 🔥 新增：对于群聊消息，优先使用发送者的个人ID而不是群ID
      if (isGroupMessage && senderName && senderName !== '我') {
        // 确保映射已建立
        if (this.friendNameToIdMap.size === 0 && this.groupNameToIdMap.size === 0) {
          this.buildFriendNameToIdMapping();
        }

        const senderPersonalId = this.friendNameToIdMap.get(senderName);
        if (senderPersonalId) {
          friendId = senderPersonalId;
          if (window.DEBUG_MESSAGE_RENDERER) {
            console.log(`[Message Renderer] 群聊消息使用发送者 "${senderName}" 的个人ID: ${friendId}`);
          }
        } else {
          // 如果找不到发送者的个人ID，生成一个基于姓名的唯一ID
          friendId = this.generateUserIdFromName(senderName);
          console.log(`[Message Renderer] 为群聊成员 "${senderName}" 生成唯一ID: ${friendId}`);
        }
      }

      // 🌟 特殊处理：图片消息（新增）
      if (
        messageType === '图片' ||
        content.includes('[图片:') ||
        (message.detailedContent && message.detailedContent.includes('<img'))
      ) {
        const imageContent = message.detailedContent || content;

        // 为接收的图片消息创建特殊布局
        if (!isMine && !isMyGroupMessage) {
          return `
                <div class="message-detail ${messageClass}" title="图片消息" data-friend-id="${friendId}">
                    <span class="message-sender">${senderName}</span>
                    <div class="message-body">
                        <div class="message-avatar" id="message-avatar-${friendId}">
                            ${this.getMessageAvatar(isMine || isMyGroupMessage, senderName)}
                        </div>
                        <div class="message-content">
                        <div class="message-meta">
                            <span class="message-type">图片</span>
                            ${isGroupMessage ? '<span class="group-badge">群聊</span>' : ''}
                        </div>
                            <div class="image-message-content">
                                ${imageContent}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // 发送的图片消息保持原有布局
        return `
                <div class="message-detail ${messageClass}" title="图片消息" data-friend-id="${friendId}">
                    <div class="message-avatar" id="message-avatar-${friendId}">
                        ${this.getMessageAvatar(isMine || isMyGroupMessage, senderName)}
                    </div>
                    <div class="message-content">
                    <div class="message-meta">
                        <span class="message-sender">${senderName}</span>
                        <span class="message-type">图片</span>
                        ${isGroupMessage ? '<span class="group-badge">群聊</span>' : ''}
                    </div>
                        <div class="image-message-content">
                            ${imageContent}
                        </div>
                    </div>
                </div>
            `;
      }

      // 🌟 新增：特殊处理附件消息（包括图片附件）
      if (messageType === '附件' && content) {
        let processedContent = content;

        // 检查是否是图片附件，如果是，解析并渲染为img标签
        if (content.includes('图片:') || message.fullMatch?.includes('附件|图片:')) {
          // 🌟 修改：优先使用extra.image中的真实路径
          console.log(`[Message Renderer] 🔍 处理图片附件消息:`, {
            content,
            fullMatch: message.fullMatch,
            extra: message.extra,
          });

          let imageUrl = null;

          // 🌟 方法1：优先使用原始消息的extra.image中的真实路径（最可靠）
          if (message.originalMessageExtra && message.originalMessageExtra.image) {
            imageUrl = message.originalMessageExtra.image;
            console.log(`[Message Renderer] ✅ 使用originalMessageExtra.image中的真实路径:`, imageUrl);
          } else if (message.extra && message.extra.image) {
            imageUrl = message.extra.image;
            console.log(`[Message Renderer] ✅ 使用extra.image中的真实路径:`, imageUrl);
          } else {
            // 🌟 方法2：解析消息格式获取文件名，然后构建URL
            const imageRegex = /图片:\s*([^|\]]+)/;
            const match = content.match(imageRegex) || (message.fullMatch && message.fullMatch.match(imageRegex));

            if (match) {
              const fileName = match[1].trim();
              console.log(`[Message Renderer] 🔍 从消息解析到图片文件名:`, fileName);

              // 获取好友名称（优先从消息中获取，否则使用当前好友名）
              let friendName = senderName;
              if (message.fullMatch) {
                const friendMatch = message.fullMatch.match(/\[我方消息\|([^|]+)\|/);
                if (friendMatch) {
                  friendName = friendMatch[1];
                }
              }

              // 构建图片URL
              if (window.attachmentSender && typeof window.attachmentSender.buildImageUrl === 'function') {
                imageUrl = window.attachmentSender.buildImageUrl(friendName, fileName);
              } else {
                // 备用方案：使用相对路径，与SillyTavern保持一致
                imageUrl = `${fileName}`;
              }

              console.log(`[Message Renderer] 🔍 构建的图片URL:`, imageUrl);
            }
          }

          if (imageUrl) {
            // 提取文件名用于显示（从路径中获取）
            const displayFileName = imageUrl.split('/').pop() || 'image.png';

            // 创建img标签替换原内容 - 使用响应式设计
            processedContent = `<img src="${imageUrl}" alt="${displayFileName}" class="attachment-image" style="width: 100%; max-width: 100%; height: auto; border-radius: 8px; margin: 4px; cursor: pointer; object-fit: contain;" onclick="this.style.transform=this.style.transform?'':'scale(2)'; setTimeout(()=>this.style.transform='', 3000);" title="点击放大查看: ${displayFileName}" loading="lazy">`;

            console.log(`[Message Renderer] ✅ 已生成图片标签:`, {
              imageUrl,
              displayFileName,
              processedContent: processedContent.substring(0, 100) + '...',
            });
          } else {
            console.warn(`[Message Renderer] ⚠️ 无法获取图片URL，保持原内容`);
          }
        }

        // 为接收的附件消息创建特殊布局
        if (!isMine && !isMyGroupMessage) {
          return `
                <div class="message-detail ${messageClass}" title="附件消息" data-friend-id="${friendId}">
                    <span class="message-sender">${senderName}</span>
                    <div class="message-body">
                        <div class="message-avatar" id="message-avatar-${friendId}">
                            ${this.getMessageAvatar(isMine || isMyGroupMessage, senderName)}
                        </div>
                        <div class="message-content">
                        <div class="message-meta">
                            <span class="message-type">附件</span>
                            ${isGroupMessage ? '<span class="group-badge">群聊</span>' : ''}
                        </div>
                            <div class="attachment-message-content">
                                ${processedContent}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // 发送的附件消息保持原有布局
        return `
                <div class="message-detail ${messageClass}" title="附件消息" data-friend-id="${friendId}">
                    <div class="message-avatar" id="message-avatar-${friendId}">
                        ${this.getMessageAvatar(isMine || isMyGroupMessage, senderName)}
                    </div>
                    <div class="message-content">
                    <div class="message-meta">
                        <span class="message-sender">${senderName}</span>
                        <span class="message-type">附件</span>
                        ${isGroupMessage ? '<span class="group-badge">群聊</span>' : ''}
                    </div>
                        <div class="attachment-message-content">
                            ${processedContent}
                        </div>
                    </div>
                </div>
            `;
      }

      // 🌟 特殊处理：表情包消息
      if (messageType === '表情包' && content) {
        // 为接收的表情包消息创建特殊布局
        if (!isMine && !isMyGroupMessage) {
          return `
                <div class="message-detail ${messageClass}" title="表情包" data-friend-id="${friendId}">
                    <span class="message-sender">${senderName}</span>
                    <div class="message-body">
                        <div class="message-avatar" id="message-avatar-${friendId}">
                            ${this.getMessageAvatar(isMine || isMyGroupMessage, senderName)}
                        </div>
                        <div class="message-content">
                        <div class="message-meta">
                            <span class="message-type">${messageType}</span>
                            ${isGroupMessage ? '<span class="group-badge">群聊</span>' : ''}
                        </div>
                            <img src="${content}"
                                 data-filename="${content}"
                                 alt="${content}"
                                 class="qq-sticker-image lazy-load"
                                 style="max-width: 150px; max-height: 150px; border-radius: 8px; margin: 4px; cursor: pointer; background: #f0f0f0;"
                                 onclick="this.style.transform='scale(1.5)'; setTimeout(() => this.style.transform='scale(1)', 2000);"
                                 title="${content}"
                                 loading="lazy">
                        </div>
                    </div>
                </div>
            `;
        }

        // 发送的表情包消息保持原有布局
        return `
                <div class="message-detail ${messageClass}" title="表情包" data-friend-id="${friendId}">
                    <div class="message-avatar" id="message-avatar-${friendId}">
                        ${this.getMessageAvatar(isMine || isMyGroupMessage, senderName)}
                    </div>

                    <div class="message-content">
                    <div class="message-meta">
                        <span class="message-sender">${senderName}</span>
                        <span class="message-type">${messageType}</span>
                        ${isGroupMessage ? '<span class="group-badge">群聊</span>' : ''}
                    </div>
                        <img src="${content}"
                             data-filename="${content}"
                             alt="${content}"
                             class="qq-sticker-image lazy-load"
                             style="max-width: 150px; max-height: 150px; border-radius: 8px; margin: 4px; cursor: pointer; background: #f0f0f0;"
                             onclick="this.style.transform='scale(1.5)'; setTimeout(() => this.style.transform='scale(1)', 2000);"
                             title="${content}"
                             loading="lazy">
                    </div>
                </div>
            `;
      }

      // 为接收的消息创建特殊布局，将sender移到头像上方
      if (!isMine && !isMyGroupMessage) {
        return `
            <div class="message-detail ${messageClass}" title="${messageType}" data-friend-id="${friendId}">
                <span class="message-sender">${senderName}</span>
                <div class="message-body">
                    <div class="message-avatar" id="message-avatar-${friendId}">
                        ${this.getMessageAvatar(isMine || isMyGroupMessage, senderName)}
                    </div>
                    <div class="message-content">
                        <div class="message-meta">
                            <span class="message-type">${messageType}</span>
                            ${isGroupMessage ? '<span class="group-badge">群聊</span>' : ''}
                        </div>
                        <div class="message-text">${content}</div>
                    </div>
                </div>
            </div>
        `;
      }

      // 发送的消息保持原有布局
      return `
            <div class="message-detail ${messageClass}" title="${messageType}" data-friend-id="${friendId}">
                <div class="message-avatar" id="message-avatar-${friendId}">
                    ${this.getMessageAvatar(isMine || isMyGroupMessage, senderName)}
                </div>
                <div class="message-content">

                    <div class="message-meta">
                        <span class="message-sender">${senderName}</span>
                        <span class="message-type">${messageType}</span>
                        ${isGroupMessage ? '<span class="group-badge">群聊</span>' : ''}
                    </div>
                    <div class="message-text">${content}</div>
                </div>
            </div>
        `;
    }

    /**
     * 获取消息头像
     */
    getMessageAvatar(isMine, character) {
      if (isMine) {
        return ''; // 我方固定头像
      } else {
        // 对方头像可以根据角色名生成
        const avatars = ['', '', '', '', '', '', '', '', '', '', '', '', ''];
        const index = (character.length + character.charCodeAt(0)) % avatars.length;
        return avatars[index];
      }
    }

    /**
     * 格式化消息时间
     */
    formatMessageTime(timestamp) {
      if (!timestamp) return '未知时间';

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
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    }

    /**
     * 渲染空消息页面
     */
    renderEmptyMessageDetail(friendId, friendName) {
      return `
            <div class="message-detail-app">
                <div class="message-detail-content" id="message-detail-content" data-background-id="${friendId}">
                    <div class="empty-messages">
                        <div class="empty-icon">💬</div>
                        <div class="empty-text">暂无消息记录</div>
                        <div class="empty-hint">开始发送消息来建立聊天记录</div>
                    </div>
                </div>
                <div class="message-detail-footer">
                    <div class="message-stats">
                        共 0 条消息 (我方: 0, 对方: 0, 群聊: 0)
                    </div>
                    <div class="message-send-area">
                        <div class="send-input-container">
                            <textarea id="message-send-input" placeholder="发送消息..." maxlength="1000"></textarea>
                            <div class="send-tools">
                                <button class="send-tool-btn" id="send-emoji-btn" title="表情"><i class="fas fa-smile"></i></button>
                                <button class="send-tool-btn" id="send-sticker-btn" title="表情包"><i class="fas fa-image"></i></button>
                                <button class="send-tool-btn" id="send-voice-btn" title="语音"><i class="fas fa-microphone"></i></button>
                                <button class="send-tool-btn" id="send-redpack-btn" title="红包"><i class="fas fa-gift"></i></button>
                            </div>
                        </div>
                        <button class="send-message-btn" id="send-message-btn"><i class="fas fa-paper-plane"></i></button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 渲染错误页面
     */
    renderErrorMessageDetail(friendId, friendName, errorMessage) {
      return `
            <div class="message-detail-app">
                <div class="message-detail-content" id="message-detail-content" data-background-id="${friendId}">
                    <div class="error-messages">
                        <div class="error-icon">⚠️</div>
                        <div class="error-text">加载消息失败</div>
                        <div class="error-details">${errorMessage}</div>
                        <button class="retry-btn" onclick="window.messageRenderer.renderMessageDetail('${friendId}', '${friendName}')">
                            重试
                        </button>
                    </div>
                </div>
                <div class="message-detail-footer">
                    <div class="message-stats">
                        加载失败，但您仍可以发送消息
                    </div>
                    <div class="message-send-area">
                        <div class="send-input-container">
                            <textarea id="message-send-input" placeholder="发送消息..." maxlength="1000"></textarea>
                            <div class="send-tools">
                                <button class="send-tool-btn" id="send-emoji-btn" title="表情"><i class="fas fa-smile"></i></button>
                                <button class="send-tool-btn" id="send-sticker-btn" title="表情包"><i class="fas fa-image"></i></button>
                                <button class="send-tool-btn" id="send-voice-btn" title="语音"><i class="fas fa-microphone"></i></button>
                                <button class="send-tool-btn" id="send-redpack-btn" title="红包"><i class="fas fa-gift"></i></button>
                            </div>
                        </div>
                        <button class="send-message-btn" id="send-message-btn"><i class="fas fa-paper-plane"></i></button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 绑定消息详情页面的事件
     */
    bindMessageDetailEvents() {
      const appContent = document.getElementById('app-content');
      if (!appContent) return;

      // 返回按钮
      const backBtn = appContent.querySelector('#back-to-message-list');
      if (backBtn) {
        backBtn.addEventListener('click', () => {
          // 触发返回到消息列表
          if (window.messageApp) {
            window.messageApp.showMessageList();
          }
        });
      }

      // 刷新按钮
      const refreshBtn = appContent.querySelector('#refresh-messages-btn');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
          if (this.currentFriendId) {
            try {
              refreshBtn.innerHTML = '<span>⏳</span>';
              refreshBtn.disabled = true;

              // 重新渲染当前好友的消息
              const friendName = this.getCurrentFriendName();
              const newContent = await this.renderMessageDetail(this.currentFriendId, friendName);
              appContent.innerHTML = newContent;
              this.bindMessageDetailEvents();
            } catch (error) {
              console.error('[Message Renderer] 刷新消息失败:', error);
            }
          }
        });
      }

      // 绑定加载历史消息事件
      this.bindLoadOlderEvent();

      // 初始化懒加载
      this.initLazyLoading();

      // 消息详情内容区域滚动到底部（显示最新消息）
      const messageDetailContent = appContent.querySelector('.message-detail-content');
      if (messageDetailContent) {
        setTimeout(() => {
          messageDetailContent.scrollTop = messageDetailContent.scrollHeight;
          console.log('[Message Renderer] 已滚动到底部显示最新消息');
        }, 100);
      }

      // 绑定发送相关事件
      this.bindSendEvents();
    }

    /**
     * 绑定发送相关事件
     */
    bindSendEvents() {
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
        console.warn('[Message Renderer] MessageSender未加载，延迟绑定事件');
        setTimeout(() => this.bindSendEvents(), 1000);
        return;
      }

      // 设置当前聊天对象
      if (this.currentFriendId) {
        const friendName = this.getCurrentFriendName();
        // @ts-ignore
        window.messageSender.setCurrentChat(this.currentFriendId, friendName, false);
      }

      // 输入框事件
      if (sendInput) {
        // 自动调整高度
        sendInput.addEventListener('input', () => {
          // @ts-ignore
          window.messageSender.adjustTextareaHeight(sendInput);
        });

        // 回车发送
        sendInput.addEventListener('keydown', e => {
          // @ts-ignore
          window.messageSender.handleEnterSend(e, sendInput);
        });

        // 字数统计
        sendInput.addEventListener('input', () => {
          this.updateCharCount(sendInput);
        });
      }

      // 发送按钮事件
      if (sendButton) {
        sendButton.addEventListener('click', async () => {
          if (sendInput) {
            // @ts-ignore
            const message = sendInput.value ? sendInput.value.trim() : '';
            if (message) {
              // @ts-ignore
              const success = await window.messageSender.sendMessage(message);
              if (success) {
                // @ts-ignore
                if (sendInput.value !== undefined) {
                  // @ts-ignore
                  sendInput.value = '';
                }
                // @ts-ignore
                window.messageSender.adjustTextareaHeight(sendInput);
                this.updateCharCount(sendInput);
                // 发送成功后刷新消息列表
                setTimeout(() => this.refreshCurrentMessages(), 1000);
              }
            }
          }
        });
      }

      // 表情按钮事件
      if (emojiBtn) {
        emojiBtn.addEventListener('click', () => {
          this.showEmojiPanel();
        });
      }

      // 表情包按钮事件
      if (stickerBtn) {
        stickerBtn.addEventListener('click', () => {
          this.showStickerPanel();
        });
      }

      // 语音按钮事件
      if (voiceBtn) {
        voiceBtn.addEventListener('click', () => {
          this.showVoicePanel();
        });
      }

      // 红包按钮事件
      if (redpackBtn) {
        redpackBtn.addEventListener('click', () => {
          this.showRedpackPanel();
        });
      }
    }

    /**
     * 更新字数统计
     */
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

    /**
     * 显示表情面板
     */
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
      console.log(`[Message Renderer] 表情包面板已显示，包含 ${stickerImages.length} 个表情包`);
      if (stickerImages.length > 0 && stickerImages[0].fullPath) {
        console.log('[Message Renderer] 使用世界书配置的表情包路径');
      } else {
        console.log('[Message Renderer] 使用默认表情包配置');
      }
    }

    /**
     * 显示表情包面板
     */
    async showStickerPanel() {
      console.log('[Message Renderer] 显示表情包面板');

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
                        <button id="refresh-sticker-btn" onclick="window.messageRenderer.refreshStickerConfig()"
                                style="background: #667eea; color: white; border: none; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 4px;"
                                title="从世界书重新加载表情包配置">
                            <i class="fas fa-sync-alt"></i> 刷新
                        </button>
                        <button onclick="this.parentElement.parentElement.parentElement.parentElement.remove()"
                                style="background: none; border: none; font-size: 20px; cursor: pointer; color: #999; padding: 5px;">✕</button>
                    </div>
                </div>

                <div class="sticker-grid-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(48px, 1fr)); gap: 8px; max-height: 300px; overflow-y: auto; padding: 10px; background: #f8f9fa; border-radius: 12px;">
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

    /**
     * 显示语音面板
     */
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
      let groupName = '';

      // 尝试从 MessageSender 获取当前好友ID和群聊状态
      if (window.messageSender && window.messageSender.currentFriendId) {
        targetId = window.messageSender.currentFriendId;
        isGroup = window.messageSender.isGroup || false;
        groupName = window.messageSender.currentFriendName || '';
      }

      // 如果没有获取到，尝试从其他地方获取
      if (!targetId) {
        // 从 MessageApp 获取
        if (window.messageApp && window.messageApp.currentFriendId) {
          targetId = window.messageApp.currentFriendId;
          isGroup = window.messageApp.isGroup || false;
          groupName = window.messageApp.currentFriendName || '';
        }
      }

      // 如果还是没有，使用默认值
      if (!targetId) {
        targetId = '223456'; // 默认好友ID
        console.warn('[Message Renderer] 未能获取当前好友ID，使用默认值:', targetId);
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
            console.log(`[Message Renderer] 从缓存获取表情包路径: ${filename} -> ${fullPath}`);
          } else {
            fullPath = filename;
            console.log(`[Message Renderer] 未找到表情包配置，使用原文件名: ${filename}`);
          }
        } catch (error) {
          console.warn('[Message Renderer] 获取表情包完整路径失败，使用原文件名:', error);
          fullPath = filename;
        }
      } else {
        console.log(`[Message Renderer] 使用传入的完整路径: ${filename} -> ${fullPath}`);
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
      let groupName = '';

      // 尝试从 MessageSender 获取当前好友ID和群聊状态
      if (window.messageSender && window.messageSender.currentFriendId) {
        targetId = window.messageSender.currentFriendId;
        isGroup = window.messageSender.isGroup || false;
        groupName = window.messageSender.currentFriendName || '';
      }

      // 如果没有获取到，尝试从其他地方获取
      if (!targetId) {
        // 从 MessageApp 获取
        if (window.messageApp && window.messageApp.currentFriendId) {
          targetId = window.messageApp.currentFriendId;
          isGroup = window.messageApp.isGroup || false;
          groupName = window.messageApp.currentFriendName || '';
        }
      }

      // 如果还是没有，使用默认值
      if (!targetId) {
        targetId = '223456'; // 默认好友ID
        console.warn('[Message Renderer] 未能获取当前好友ID，使用默认值:', targetId);
      }

      // 🔥 修改：生成表情包消息格式 - 使用完整路径
      let stickerMessage;
      if (isGroup) {
        stickerMessage = `[群聊消息|${targetId}|我|表情包|${fullPath}]`;
      } else {
        stickerMessage = `[我方消息|我|${targetId}|表情包|${fullPath}]`;
      }

      console.log(`[Message Renderer] 生成表情包消息: ${filename} -> ${fullPath}`);

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
     * 🔥 新增：从世界书读取表情包详情
     * 查找名为"表情包详情"的世界书条目，解析前缀和后缀，生成完整的图片路径
     */
    async getStickerImagesFromWorldInfo() {
      console.log('[Message Renderer] 开始从世界书读取表情包详情');

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

        console.log(`[Message Renderer] 找到 ${stickerDetailEntries.length} 个表情包详情条目:`);
        stickerDetailEntries.forEach((entry, index) => {
          console.log(`${index + 1}. "${entry.comment}" (来源: ${entry.world})`);
        });

        if (stickerDetailEntries.length === 0) {
          console.warn('[Message Renderer] 未找到"表情包详情"世界书条目，使用默认表情包列表');
          console.log('[Message Renderer] 搜索的条目总数:', allEntries.length);
          console.log('[Message Renderer] 条目示例:', allEntries.slice(0, 3).map(e => ({
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
          console.log(`[Message Renderer] 解析第 ${i + 1} 个表情包详情条目: "${entry.comment}" (来源: ${entry.world})`);

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
              console.log(`[Message Renderer] 从"${entry.comment}"解析到 ${stickerImages.length} 个表情包`);
            } else {
              console.warn(`[Message Renderer] 条目"${entry.comment}"解析失败，内容可能格式不正确`);
            }
          } catch (error) {
            console.error(`[Message Renderer] 解析条目"${entry.comment}"时出错:`, error);
          }
        }

        if (allStickerImages.length === 0) {
          console.warn('[Message Renderer] 所有表情包详情条目解析失败，使用默认表情包列表');
          return this.getDefaultStickerImages();
        }

        console.log(`[Message Renderer] 成功从 ${stickerDetailEntries.length} 个条目解析到总共 ${allStickerImages.length} 个表情包`);
        return allStickerImages;

      } catch (error) {
        console.error('[Message Renderer] 读取世界书表情包详情时出错:', error);
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
            console.log(`[Message Renderer] 通过getSortedEntries获取到 ${entries.length} 个世界书条目`);
            return allEntries; // 如果成功，直接返回
          } catch (error) {
            console.warn('[Message Renderer] getSortedEntries调用失败:', error);
          }
        }

        // 2. 备用方法：手动获取全局和角色世界书
        console.log('[Message Renderer] 使用备用方法获取世界书条目');

        // 🔥 修复：获取全局世界书 - 从DOM元素读取
        console.log('[Message Renderer] 尝试获取全局世界书...');
        console.log('[Message Renderer] window.selected_world_info:', window.selected_world_info);
        console.log('[Message Renderer] window.world_names:', window.world_names);

        // 🔥 新增：方法1 - 从DOM元素获取选中的世界书
        const worldInfoSelect = document.getElementById('world_info');
        if (worldInfoSelect) {
          console.log('[Message Renderer] 找到世界书选择器元素');

          // 获取所有选中的选项
          const selectedOptions = Array.from(worldInfoSelect.selectedOptions);
          console.log(`[Message Renderer] 找到 ${selectedOptions.length} 个选中的世界书选项:`, selectedOptions.map(opt => opt.text));

          for (const option of selectedOptions) {
            const worldName = option.text;
            const worldIndex = option.value;

            try {
              console.log(`[Message Renderer] 正在加载全局世界书: ${worldName} (索引: ${worldIndex})`);
              const worldData = await this.loadWorldInfoByName(worldName);
              if (worldData && worldData.entries) {
                const entries = Object.values(worldData.entries).map(entry => ({
                  ...entry,
                  world: worldName
                }));
                allEntries.push(...entries);
                console.log(`[Message Renderer] 从全局世界书"${worldName}"获取到 ${entries.length} 个条目`);
              } else {
                console.warn(`[Message Renderer] 全局世界书"${worldName}"没有条目或加载失败`);
              }
            } catch (error) {
              console.warn(`[Message Renderer] 加载全局世界书"${worldName}"失败:`, error);
            }
          }
        } else {
          console.log('[Message Renderer] 未找到世界书选择器元素 #world_info');
        }

        // 方法2：从 selected_world_info 变量获取（备用）
        if (allEntries.length === 0 && typeof window.selected_world_info !== 'undefined' && Array.isArray(window.selected_world_info) && window.selected_world_info.length > 0) {
          console.log(`[Message Renderer] 备用方法：从变量获取 ${window.selected_world_info.length} 个全局世界书:`, window.selected_world_info);

          for (const worldName of window.selected_world_info) {
            try {
              console.log(`[Message Renderer] 正在加载全局世界书: ${worldName}`);
              const worldData = await this.loadWorldInfoByName(worldName);
              if (worldData && worldData.entries) {
                const entries = Object.values(worldData.entries).map(entry => ({
                  ...entry,
                  world: worldName
                }));
                allEntries.push(...entries);
                console.log(`[Message Renderer] 从全局世界书"${worldName}"获取到 ${entries.length} 个条目`);
              }
            } catch (error) {
              console.warn(`[Message Renderer] 加载全局世界书"${worldName}"失败:`, error);
            }
          }
        }

        // 方法3：从 world_info.globalSelect 获取（备用）
        if (allEntries.length === 0 && typeof window.world_info !== 'undefined' && window.world_info.globalSelect) {
          console.log('[Message Renderer] 备用方法：从 world_info.globalSelect 获取:', window.world_info.globalSelect);

          for (const worldName of window.world_info.globalSelect) {
            try {
              const worldData = await this.loadWorldInfoByName(worldName);
              if (worldData && worldData.entries) {
                const entries = Object.values(worldData.entries).map(entry => ({
                  ...entry,
                  world: worldName
                }));
                allEntries.push(...entries);
                console.log(`[Message Renderer] 从world_info.globalSelect世界书"${worldName}"获取到 ${entries.length} 个条目`);
              }
            } catch (error) {
              console.warn(`[Message Renderer] 从world_info.globalSelect加载世界书"${worldName}"失败:`, error);
            }
          }
        }

        // 获取角色绑定的世界书
        try {
          const characterEntries = await this.getCharacterWorldInfoEntries();
          allEntries.push(...characterEntries);
        } catch (error) {
          console.warn('[Message Renderer] 获取角色世界书失败:', error);
        }

      } catch (error) {
        console.error('[Message Renderer] 获取世界书条目时出错:', error);
      }

      console.log(`[Message Renderer] 总共获取到 ${allEntries.length} 个世界书条目`);

      // 🔥 新增：为调试提供详细信息
      if (allEntries.length > 0) {
        console.log('[Message Renderer] 世界书条目预览:', allEntries.slice(0, 3).map(entry => ({
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
          console.log(`[Message Renderer] 使用loadWorldInfo函数加载世界书: ${worldName}`);
          return await window.loadWorldInfo(worldName);
        }

        // 备用方法：直接调用API（需要正确的请求头）
        console.log(`[Message Renderer] 使用API加载世界书: ${worldName}`);

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
          console.log(`[Message Renderer] 成功加载世界书 "${worldName}":`, data);
          return data;
        } else {
          console.error(`[Message Renderer] 加载世界书 "${worldName}" 失败: ${response.status} ${response.statusText}`);
        }

      } catch (error) {
        console.error(`[Message Renderer] 加载世界书 "${worldName}" 时出错:`, error);
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
          console.log('[Message Renderer] 无法获取当前角色信息');
          return entries;
        }

        console.log(`[Message Renderer] 找到当前角色: ${character.name} (ID: ${characterId})`);

        // 获取角色绑定的主要世界书
        const worldName = character.data?.extensions?.world;
        if (worldName) {
          console.log(`[Message Renderer] 角色绑定的主要世界书: ${worldName}`);
          const worldData = await this.loadWorldInfoByName(worldName);
          if (worldData && worldData.entries) {
            const worldEntries = Object.values(worldData.entries).map(entry => ({
              ...entry,
              world: worldName
            }));
            entries.push(...worldEntries);
            console.log(`[Message Renderer] 从角色主要世界书获取到 ${worldEntries.length} 个条目`);
          }
        }

        // 🔥 新增：获取角色的额外世界书
        if (typeof window.world_info !== 'undefined' && window.world_info.charLore) {
          // 获取角色文件名
          const fileName = character.avatar || `${character.name}.png`;
          const extraCharLore = window.world_info.charLore.find(e => e.name === fileName);

          if (extraCharLore && Array.isArray(extraCharLore.extraBooks)) {
            console.log(`[Message Renderer] 角色额外世界书: ${extraCharLore.extraBooks.join(', ')}`);

            for (const extraWorldName of extraCharLore.extraBooks) {
              try {
                const worldData = await this.loadWorldInfoByName(extraWorldName);
                if (worldData && worldData.entries) {
                  const worldEntries = Object.values(worldData.entries).map(entry => ({
                    ...entry,
                    world: extraWorldName
                  }));
                  entries.push(...worldEntries);
                  console.log(`[Message Renderer] 从角色额外世界书"${extraWorldName}"获取到 ${worldEntries.length} 个条目`);
                }
              } catch (error) {
                console.warn(`[Message Renderer] 加载角色额外世界书"${extraWorldName}"失败:`, error);
              }
            }
          }
        }

      } catch (error) {
        console.error('[Message Renderer] 获取角色世界书条目时出错:', error);
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
        console.log('[Message Renderer] 解析表情包详情内容:', content);

        // 尝试JSON格式解析
        if (content.trim().startsWith('{')) {
          const jsonData = JSON.parse(content);
          const prefix = jsonData.prefix || '';
          const suffix = jsonData.suffix || '';
          const files = jsonData.files || [];

          for (const filename of files) {
            const fullPath = prefix + filename + suffix;
            // 🔥 修复：生成正确的备用路径
            const fallbackPath = `data/default-user/extensions/mobile/images/${filename}`;

            stickerImages.push({
              filename: filename,
              fullPath: fullPath,
              displayName: filename,
              fallbackPath: fallbackPath,
              prefix: prefix,
              suffix: suffix
            });
          }

          console.log(`[Message Renderer] JSON格式解析成功，获取到 ${stickerImages.length} 个表情包`);
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
              const fallbackPath = `data/default-user/extensions/mobile/images/${filename}`;

              stickerImages.push({
                filename: filename,
                fullPath: fullPath,
                displayName: filename,
                fallbackPath: fallbackPath,
                prefix: prefix,
                suffix: suffix
              });
            }

            console.log(`[Message Renderer] 管道格式解析成功，前缀: "${prefix}", 后缀: "${suffix}", 获取到 ${stickerImages.length} 个表情包`);
            return stickerImages;
          }
        }

        // 尝试简单逗号分隔格式
        if (content.includes(',')) {
          const files = content.split(',').map(f => f.trim()).filter(f => f);
          const defaultPrefix = 'data/default-user/extensions/mobile/images/';
          const defaultSuffix = '';

          for (const filename of files) {
            const fullPath = defaultPrefix + filename + defaultSuffix;
            stickerImages.push({
              filename: filename,
              fullPath: fullPath,
              displayName: filename
            });
          }

          console.log(`[Message Renderer] 简单格式解析成功，使用默认前缀，获取到 ${stickerImages.length} 个表情包`);
          return stickerImages;
        }

        // 尝试单行格式（每行一个文件名）
        const lines = content.split('\n').map(line => line.trim()).filter(line => line);
        if (lines.length > 0) {
          const defaultPrefix = 'data/default-user/extensions/mobile/images/';
          const defaultSuffix = '';

          for (const filename of lines) {
            const fullPath = defaultPrefix + filename + defaultSuffix;
            stickerImages.push({
              filename: filename,
              fullPath: fullPath,
              displayName: filename
            });
          }

          console.log(`[Message Renderer] 行分隔格式解析成功，获取到 ${stickerImages.length} 个表情包`);
          return stickerImages;
        }

      } catch (error) {
        console.error('[Message Renderer] 解析表情包详情时出错:', error);
      }

      console.warn('[Message Renderer] 无法解析表情包详情内容，返回空列表');
      return stickerImages;
    }

    // /**
    //  * 🔥 新增：获取默认表情包列表
    //  */
    // getDefaultStickerImages() {
    //   const defaultFiles = [
    //     'zjlr8e.jpg',
    //     'emzckz.jpg',
    //     'ivtswg.jpg',
    //     'lgply8.jpg',
    //     'au4ay5.jpg',
    //     'qasebg.jpg',
    //     '5kqdkh.jpg',
    //     '8kvr4u.jpg',
    //     'aotnxp.jpg',
    //     'xigzwa.jpg',
    //     'y7px4h.jpg',
    //     'z2sxmv.jpg',
    //     's10h5m.jpg',
    //     'hoghwb.jpg',
    //     'kin0oj.jpg',
    //     'l9nqv0.jpg',
    //     'kv2ubl.gif',
    //     '6eyt6n.jpg',
    //   ];

    //   const defaultPrefix = 'data/default-user/extensions/mobile/images/';
    //   const defaultSuffix = '';

    //   return defaultFiles.map(filename => ({
    //     filename: filename,
    //     fullPath: defaultPrefix + filename + defaultSuffix,
    //     displayName: filename
    //   }));
    // }

    /**
     * 🔥 新增：测试表情包配置功能
     * 可以在浏览器控制台调用 window.messageRenderer.testStickerConfig() 来测试
     */
    async testStickerConfig() {
      console.log('=== 表情包配置测试开始 ===');

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
            console.log('✅ 表情包配置测试通过！');
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
        console.error('❌ 表情包配置测试失败:', error);
        return { success: false, error: error.message };
      } finally {
        console.log('=== 表情包配置测试结束 ===');
      }
    }

    /**
     * 显示提示消息
     */
    showToast(message, type = 'info') {
      const toast = document.createElement('div');
      toast.className = `send-status-toast ${type}`;
      toast.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px;">
                ${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}
                ${type === 'success' ? '成功' : type === 'error' ? '错误' : '提示'}
            </div>
            <div style="font-size: 12px; opacity: 0.9;">
                ${message}
            </div>
        `;

      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    }

    /**
     * 显示红包面板
     */
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
      let groupName = '';

      // 尝试从 MessageSender 获取当前好友ID和群聊状态
      if (window.messageSender && window.messageSender.currentFriendId) {
        targetId = window.messageSender.currentFriendId;
        isGroup = window.messageSender.isGroup || false;
        groupName = window.messageSender.currentFriendName || '';
      }

      // 如果没有获取到，尝试从其他地方获取
      if (!targetId) {
        // 从 MessageApp 获取
        if (window.messageApp && window.messageApp.currentFriendId) {
          targetId = window.messageApp.currentFriendId;
          isGroup = window.messageApp.isGroup || false;
          groupName = window.messageApp.currentFriendName || '';
        }
      }

      // 如果还是没有，使用默认值
      if (!targetId) {
        targetId = '223456'; // 默认好友ID
        console.warn('[Message Renderer] 未能获取当前好友ID，使用默认值:', targetId);
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

    /**
     * 加载更多消息（向下，实际上在反向分页中不常用）
     */
    async loadMoreMessages() {
      if (this.pagination.isLoading || this.pagination.currentPage >= this.pagination.totalPages - 1) {
        return;
      }

      this.pagination.isLoading = true;
      const loadMoreBtn = document.getElementById('load-more-messages-btn');

      if (loadMoreBtn) {
        loadMoreBtn.textContent = '加载中...';
        loadMoreBtn.disabled = true;
      }

      try {
        // 模拟加载延迟
        await new Promise(resolve => setTimeout(resolve, 300));

        this.pagination.currentPage++;
        const newMessages = this.getPageMessages(this.pagination.currentPage);

        // 批量添加新消息到DOM
        await this.appendMessagesToContainer(newMessages);

        // 更新加载更多按钮
        this.updateLoadMoreButton();
      } catch (error) {
        console.error('[Message Renderer] 加载更多消息失败:', error);
      } finally {
        this.pagination.isLoading = false;
      }
    }

    /**
     * 加载历史消息（向上滚动）
     */
    async loadOlderMessages() {
      if (this.pagination.isLoading) {
        return;
      }

      // 检查是否还有历史消息可以加载
      const remainingPages = this.pagination.totalPages - (this.pagination.loadedPages || 1);
      if (remainingPages <= 0) {
        return;
      }

      this.pagination.isLoading = true;
      const loadOlderBtn = document.getElementById('load-older-messages-btn');
      const messageDetailContent = document.querySelector('.message-detail-content');
      const messagesContainer = document.getElementById('messages-container');

      if (loadOlderBtn) {
        loadOlderBtn.textContent = '⏳ 加载中...';
        loadOlderBtn.disabled = true;
      }

      // 记录当前滚动位置和第一条消息
      const oldScrollHeight = messageDetailContent ? messageDetailContent.scrollHeight : 0;
      const firstMessage = messagesContainer ? messagesContainer.firstElementChild : null;

      try {
        // 模拟加载延迟
        await new Promise(resolve => setTimeout(resolve, 300));

        // 🔥 修复：使用新的历史消息获取方法
        const olderMessages = this.getOlderMessages();

        if (olderMessages.length > 0) {
          // 将历史消息添加到容器顶部
          await this.prependMessagesToContainer(olderMessages);

          // 增加已加载页数
          this.pagination.loadedPages = (this.pagination.loadedPages || 1) + 1;

          // 更新加载历史消息按钮
          this.updateLoadOlderButton();

          // 保持滚动位置（关键：防止跳动）
          if (messageDetailContent && firstMessage) {
            const newScrollHeight = messageDetailContent.scrollHeight;
            const scrollOffset = newScrollHeight - oldScrollHeight;
            messageDetailContent.scrollTop = scrollOffset;
          }
        } else {
          console.log('[Message Renderer] 没有更多历史消息可加载');
        }
      } catch (error) {
        console.error('[Message Renderer] 加载历史消息失败:', error);
      } finally {
        this.pagination.isLoading = false;
      }
    }

    /**
     * 将新消息添加到容器底部
     */
    async appendMessagesToContainer(newMessages) {
      const container = document.getElementById('messages-container');
      if (!container || newMessages.length === 0) return;

      // 使用DocumentFragment优化DOM操作
      const fragment = document.createDocumentFragment();
      const tempDiv = document.createElement('div');

      tempDiv.innerHTML = this.renderMessagesBatch(newMessages);

      // 将新消息元素添加到fragment
      while (tempDiv.firstChild) {
        fragment.appendChild(tempDiv.firstChild);
      }

      // 一次性添加到DOM
      container.appendChild(fragment);

      // 为新添加的图片初始化懒加载
      this.initLazyLoadingForNewMessages();

      console.log(`[Message Renderer] 已添加 ${newMessages.length} 条新消息到底部`);
    }

    /**
     * 将历史消息添加到容器顶部
     */
    async prependMessagesToContainer(olderMessages) {
      const container = document.getElementById('messages-container');
      if (!container || olderMessages.length === 0) return;

      // 使用DocumentFragment优化DOM操作
      const fragment = document.createDocumentFragment();
      const tempDiv = document.createElement('div');

      tempDiv.innerHTML = this.renderMessagesBatch(olderMessages);

      // 将历史消息元素添加到fragment
      while (tempDiv.firstChild) {
        fragment.appendChild(tempDiv.firstChild);
      }

      // 一次性添加到DOM顶部
      container.insertBefore(fragment, container.firstChild);

      // 为新添加的图片初始化懒加载
      this.initLazyLoadingForNewMessages();

      console.log(`[Message Renderer] 已添加 ${olderMessages.length} 条历史消息到顶部`);
    }

    /**
     * 更新加载更多按钮
     */
    updateLoadMoreButton() {
      const loadMoreContainer = document.querySelector('.load-more-container');
      if (!loadMoreContainer) return;

      if (this.pagination.currentPage >= this.pagination.totalPages - 1) {
        // 没有更多消息，移除按钮
        loadMoreContainer.innerHTML = `
                <div style="text-align: center; padding: 10px; color: #999; font-size: 12px;">
                    已显示所有消息
                </div>
            `;
      } else {
        // 更新按钮文本
        loadMoreContainer.innerHTML = `
                <button id="load-more-messages-btn"
                        class="load-more-btn"
                        style="padding: 10px 20px; border: 1px solid #ddd; border-radius: 20px; background: #f8f9fa; color: #333; cursor: pointer; font-size: 14px; transition: all 0.3s ease;">
                    加载更多消息 (${this.pagination.currentPage + 1}/${this.pagination.totalPages})
                </button>
            `;

        // 重新绑定事件
        this.bindLoadMoreEvent();
      }
    }

    /**
     * 更新加载历史消息按钮
     */
    updateLoadOlderButton() {
      const loadOlderContainer = document.querySelector('.load-older-container');
      if (!loadOlderContainer) return;

      const remainingPages = this.pagination.totalPages - (this.pagination.loadedPages || 1);

      if (remainingPages <= 0) {
        // 没有更多历史消息，移除按钮
        loadOlderContainer.innerHTML = `
                <div style="text-align: center; padding: 10px; color: #999; font-size: 12px; background: linear-gradient(180deg, #f8f9fa 0%, rgba(248, 249, 250, 0.8) 50%, transparent 100%);">
                    📚 已显示所有历史消息
                </div>
            `;
      } else {
        // 更新按钮文本
        loadOlderContainer.innerHTML = `
                <button id="load-older-messages-btn"
                        class="load-older-btn"
                        style="padding: 10px 20px; border: 1px solid #ddd; border-radius: 20px; background: #f8f9fa; color: #333; cursor: pointer; font-size: 14px; transition: all 0.3s ease; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                    📜 加载历史消息 (还有${remainingPages}页)
                </button>
            `;

        // 重新绑定事件
        this.bindLoadOlderEvent();
      }
    }

    /**
     * 绑定加载更多事件
     */
    bindLoadMoreEvent() {
      const loadMoreBtn = document.getElementById('load-more-messages-btn');
      if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
          this.loadMoreMessages();
        });
      }
    }

    /**
     * 绑定加载历史消息事件
     */
    bindLoadOlderEvent() {
      const loadOlderBtn = document.getElementById('load-older-messages-btn');
      if (loadOlderBtn) {
        loadOlderBtn.addEventListener('click', () => {
          this.loadOlderMessages();
        });
      }
    }

    /**
     * 初始化懒加载
     */
    initLazyLoading() {
      // 创建 Intersection Observer 进行图片懒加载
      if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver(
          (entries, observer) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                const img = entry.target;
                this.loadImage(img);
                observer.unobserve(img);
              }
            });
          },
          {
            rootMargin: '50px 0px', // 提前50px开始加载
            threshold: 0.1,
          },
        );

        // 观察所有懒加载图片
        const lazyImages = document.querySelectorAll('.lazy-load');
        lazyImages.forEach(img => {
          imageObserver.observe(img);
        });

        // 保存observer以便后续使用
        this.imageObserver = imageObserver;
      } else {
        // 降级处理：直接加载所有图片
        const lazyImages = document.querySelectorAll('.lazy-load');
        lazyImages.forEach(img => this.loadImage(img));
      }
    }

    /**
     * 🔥 修改：加载单张图片 - 支持表情包路径转换
     */
    async loadImage(img) {
      let src = img.getAttribute('src');
      const filename = img.getAttribute('data-filename');

      if (!src) return;

      // 🔥 新增：如果是表情包图片且只有文件名，尝试获取完整路径
      if (filename && img.classList.contains('qq-sticker-image')) {
        const fullPath = await this.getStickerFullPath(filename);
        if (fullPath && fullPath !== filename) {
          src = fullPath;
          console.log(`[Message Renderer] 表情包路径转换: ${filename} -> ${src}`);
        }
      }

      // 添加加载状态
      img.classList.add('loading');

      // 创建新图片对象进行预加载
      const imageLoader = new Image();

      imageLoader.onload = () => {
        // 加载成功
        img.src = src;
        img.classList.remove('loading');
        img.classList.add('loaded');
        img.removeAttribute('src');
      };

      imageLoader.onerror = async () => {
        // 🔥 修改：加载失败时，尝试使用世界书配置的备用路径
        img.classList.remove('loading');
        img.classList.add('error');

        // 如果是表情包且有文件名，尝试使用世界书配置的路径作为备用
        if (filename && img.classList.contains('qq-sticker-image')) {
          const fallbackPath = await this.getStickerFallbackPath(filename);
          if (fallbackPath && fallbackPath !== src) {
            console.log(`[Message Renderer] 尝试表情包备用路径: ${fallbackPath}`);

            const fallbackLoader = new Image();
            fallbackLoader.onload = () => {
              img.src = fallbackPath;
              img.classList.remove('error');
              img.classList.add('loaded');
              console.log(`[Message Renderer] 表情包备用路径加载成功: ${fallbackPath}`);
            };
            fallbackLoader.onerror = () => {
              // 最终失败
              img.style.background = '#f8d7da';
              img.alt = '图片加载失败';
              console.warn(`[Message Renderer] 表情包所有路径都加载失败: ${filename}`);
            };
            fallbackLoader.src = fallbackPath;
            return;
          }
        }

        // 默认错误处理
        img.style.background = '#f8d7da';
        img.alt = '图片加载失败';
      };

      imageLoader.src = src;
    }

    /**
     * 🔥 新增：获取表情包完整路径
     */
    async getStickerFullPath(filename) {
      try {
        // 🔥 优化：使用缓存避免重复读取世界书
        if (!this._stickerConfigCache) {
          this._stickerConfigCache = await this.getStickerImagesFromWorldInfo();
          // 设置缓存过期时间（30秒）
          setTimeout(() => {
            this._stickerConfigCache = null;
          }, 30000);
        }

        const stickerImages = this._stickerConfigCache;

        // 查找匹配的表情包
        const stickerData = stickerImages.find(sticker =>
          (sticker.filename === filename) ||
          (typeof sticker === 'string' && sticker === filename)
        );

        if (stickerData && stickerData.fullPath) {
          console.log(`[Message Renderer] 表情包路径映射: ${filename} -> ${stickerData.fullPath}`);
          return stickerData.fullPath;
        }

        // 如果没找到配置，尝试使用默认前缀
        const defaultPath = `data/default-user/extensions/mobile/images/${filename}`;
        console.log(`[Message Renderer] 使用默认表情包路径: ${filename} -> ${defaultPath}`);
        return defaultPath;

      } catch (error) {
        console.warn('[Message Renderer] 获取表情包完整路径失败:', error);
        return `data/default-user/extensions/mobile/images/${filename}`;
      }
    }

    /**
     * 🔥 新增：获取表情包备用路径
     */
    async getStickerFallbackPath(filename) {
      try {
        // 🔥 优化：使用缓存避免重复读取世界书
        if (!this._stickerConfigCache) {
          this._stickerConfigCache = await this.getStickerImagesFromWorldInfo();
          // 设置缓存过期时间（30秒）
          setTimeout(() => {
            this._stickerConfigCache = null;
          }, 30000);
        }

        const stickerImages = this._stickerConfigCache;

        // 查找匹配的表情包
        const stickerData = stickerImages.find(sticker =>
          (sticker.filename === filename) ||
          (typeof sticker === 'string' && sticker === filename)
        );

        if (stickerData) {
          // 🔥 关键修复：优先使用世界书配置的前缀+后缀作为备用路径
          if (stickerData.prefix && stickerData.suffix !== undefined) {
            const worldBookPath = stickerData.prefix + filename + stickerData.suffix;
            console.log(`[Message Renderer] 使用世界书前缀作为备用路径: ${filename} -> ${worldBookPath}`);
            return worldBookPath;
          }

          // 如果有预设的备用路径
          if (stickerData.fallbackPath) {
            return stickerData.fallbackPath;
          }
        }

        // 最后使用默认路径
        const defaultPath = `data/default-user/extensions/mobile/images/${filename}`;
        console.log(`[Message Renderer] 使用默认备用路径: ${filename} -> ${defaultPath}`);
        return defaultPath;

      } catch (error) {
        console.warn('[Message Renderer] 获取表情包备用路径失败:', error);
        return `data/default-user/extensions/mobile/images/${filename}`;
      }
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
            console.log(`[Message Renderer] 使用缓存的表情包配置，包含 ${cacheData.data.length} 个表情包`);
            return cacheData.data;
          } else {
            console.log('[Message Renderer] 表情包缓存已过期');
            localStorage.removeItem('stickerConfig_cache');
          }
        }
      } catch (error) {
        console.warn('[Message Renderer] 读取表情包缓存失败:', error);
        localStorage.removeItem('stickerConfig_cache');
      }

      // 没有有效缓存，返回默认配置
      console.log('[Message Renderer] 没有缓存，使用默认表情包配置');
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
        console.log(`[Message Renderer] 表情包配置已缓存，包含 ${stickerImages.length} 个表情包`);
      } catch (error) {
        console.warn('[Message Renderer] 缓存表情包配置失败:', error);
      }
    }

    /**
     * 🔥 新增：刷新表情包配置（从世界书重新读取）
     */
    async refreshStickerConfig() {
      console.log('[Message Renderer] 开始刷新表情包配置...');

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
        this._stickerConfigCache = null; // 清除内存缓存

        // 从世界书重新读取
        const stickerImages = await this.getStickerImagesFromWorldInfo();

        // 缓存新配置
        this.cacheStickerImages(stickerImages);

        // 更新面板内容
        this.updateStickerPanel(stickerImages);

        // 显示成功提示
        this.showToast('表情包配置已刷新', 'success');

      } catch (error) {
        console.error('[Message Renderer] 刷新表情包配置失败:', error);
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

      console.log(`[Message Renderer] 表情包面板已更新，包含 ${stickerImages.length} 个表情包`);
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
              fallbackPath = `data/default-user/extensions/mobile/images/${stickerData.filename || stickerData}`;
            }

            return `
            <div class="sticker-item" onclick="window.messageRenderer.insertStickerMessage('${stickerData.filename || stickerData}', '${stickerData.fullPath || stickerData}')"
                 style="cursor: pointer; padding: 4px; border: 2px solid transparent; border-radius: 8px; transition: all 0.3s ease;width:25%"
                 onmouseover="this.style.borderColor='#667eea'; this.style.transform='scale(1.1)'"
                 onmouseout="this.style.borderColor='transparent'; this.style.transform='scale(1)'"
                 title="${stickerData.displayName || stickerData}">
                <img src="${stickerData.fullPath || stickerData}"
                     alt="${stickerData.displayName || stickerData}"
                     style="width: 48px; height: 48px; object-fit: cover; border-radius: 4px; display: block;"
                     loading="lazy"
                     >
            </div>
        `;
          }
        )
        .join('');
    }

    /**
     * 为新添加的消息初始化懒加载
     */
    initLazyLoadingForNewMessages() {
      if (this.imageObserver) {
        const newLazyImages = document.querySelectorAll('.lazy-load:not(.loaded):not(.loading):not(.error)');
        newLazyImages.forEach(img => {
          this.imageObserver.observe(img);
        });
      }
    }

    /**
     * 刷新当前消息 - 性能优化版本
     */
    async refreshCurrentMessages() {
      if (!this.currentFriendId) return;

      try {
        const appContent = document.getElementById('app-content');
        if (!appContent) return;

        // 提取最新消息
        const messageData = await this.extractMessagesForFriend(this.currentFriendId);

        // 重新初始化反向分页
        this.initReversePagination(messageData.allMessages);

        // 只更新消息容器，保留发送区域
        const messagesContainer = appContent.querySelector('.messages-container');
        if (messagesContainer && messageData.allMessages.length > 0) {
          // 获取最新的消息（反向分页模式）
          const latestMessages = this.getLatestMessages();
          this.incrementalUpdateMessages(messagesContainer, latestMessages);

          // 更新加载历史消息按钮
          const loadOlderContainer = appContent.querySelector('.load-older-container');
          if (loadOlderContainer) {
            loadOlderContainer.innerHTML = this.renderLoadOlderButton();
            this.bindLoadOlderEvent();
          }

          // 滚动到底部显示最新消息
          setTimeout(() => {
            const messageDetailContent = document.querySelector('.message-detail-content');
            if (messageDetailContent) {
              messageDetailContent.scrollTop = messageDetailContent.scrollHeight;
              console.log('[Message Renderer] 已滚动到底部显示最新消息');
            }
          }, 100);
        }

        // 更新统计信息
        const statsElement = appContent.querySelector('.message-stats');
        if (statsElement) {
          const totalCount = messageData.allMessages.length;
          const latestMessages = this.getLatestMessages();
          statsElement.textContent = `显示最新 ${latestMessages.length}/${totalCount} 条消息 (我方: ${messageData.myMessages.length}, 对方: ${messageData.otherMessages.length}, 群聊: ${messageData.groupMessages.length})`;
        }
      } catch (error) {
        console.error('[Message Renderer] 刷新消息失败:', error);
      }
    }

    /**
     * 获取当前好友名称
     */
    getCurrentFriendName() {
      if (window.friendRenderer && this.currentFriendId) {
        const friend = window.friendRenderer.getFriendById(this.currentFriendId);
        return friend ? friend.name : null;
      }
      return null;
    }

    /**
     * 获取消息统计信息
     */
    getMessageStats(friendId = null) {
      const targetId = friendId || this.currentFriendId;
      if (!targetId) return null;

      return {
        friendId: targetId,
        myMessagesCount: this.myMessages.length,
        otherMessagesCount: this.otherMessages.length,
        groupMessagesCount: this.groupMessages.length,
        totalCount: this.allMessages.length,
        lastMessageTime:
          this.allMessages.length > 0 ? this.allMessages[this.allMessages.length - 1].messageTimestamp : null,
      };
    }

    /**
     * 性能监控
     */
    showPerformanceIndicator(message, duration = 2000) {
      let indicator = document.querySelector('.performance-indicator');
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'performance-indicator';
        document.body.appendChild(indicator);
      }

      indicator.textContent = message;
      indicator.classList.add('show');

      setTimeout(() => {
        indicator.classList.remove('show');
      }, duration);
    }

    /**
     * 获取性能统计信息
     */
    getPerformanceStats() {
      return {
        totalMessages: this.allMessages.length,
        loadedPages: this.pagination.currentPage + 1,
        totalPages: this.pagination.totalPages,
        cacheSize: this.renderCache.size,
        currentPageSize: this.pagination.pageSize,
        virtualScrolling: this.virtualScrolling,
        memoryUsage: performance.memory
          ? {
              used: Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB',
              total: Math.round(performance.memory.totalJSHeapSize / 1048576) + 'MB',
            }
          : '不可用',
      };
    }

    /**
     * 清理缓存
     */
    clearCache() {
      this.renderCache.clear();
      this.messageCache.clear();
      console.log('[Message Renderer] 缓存已清理');
      this.showPerformanceIndicator('缓存已清理', 1500);
    }

    /**
     * 调试方法
     */
    debug() {
      console.group('[Message Renderer] 调试信息');
      console.log('当前好友ID:', this.currentFriendId);
      console.log('我方消息数量:', this.myMessages.length);
      console.log('对方消息数量:', this.otherMessages.length);
      console.log('群聊消息数量:', this.groupMessages.length);
      console.log('总消息数量:', this.allMessages.length);
      console.log('上下文监控器状态:', !!this.contextMonitor);
      console.log('好友姓名映射数量:', this.friendNameToIdMap ? this.friendNameToIdMap.size : 0);
      console.log('群聊姓名映射数量:', this.groupNameToIdMap ? this.groupNameToIdMap.size : 0);
      console.log('性能统计:', this.getPerformanceStats());
      if (this.allMessages.length > 0) {
        console.log('消息样例:', this.allMessages[0]);
      }
      if (this.friendNameToIdMap && this.friendNameToIdMap.size > 0) {
        console.log('好友姓名映射:', Array.from(this.friendNameToIdMap.entries()));
      }
      if (this.groupNameToIdMap && this.groupNameToIdMap.size > 0) {
        console.log('群聊姓名映射:', Array.from(this.groupNameToIdMap.entries()));
      }
      console.groupEnd();
    }
  };

  // 创建全局实例
  window.MessageRenderer = MessageRenderer;
  window.messageRenderer = new MessageRenderer();

  // 为message-app提供的接口
  window.renderMessageDetailForFriend = async function (friendId, friendName) {
    if (!window.messageRenderer) {
      console.error('[Message Renderer] 消息渲染器未加载');
      return '<div>消息渲染器未加载</div>';
    }

    return await window.messageRenderer.renderMessageDetail(friendId, friendName);
  };

  window.bindMessageDetailEvents = function () {
    if (window.messageRenderer) {
      window.messageRenderer.bindMessageDetailEvents();
    }
  };

  console.log('[Message Renderer] 消息渲染器模块加载完成');
} // 结束 if (typeof window.MessageRenderer === 'undefined') 检查
