/**
 * Friend Renderer - 好友渲染器
 * 从上下文中提取好友信息并渲染成消息列表
 */

// 避免重复定义
if (typeof window.FriendRenderer === 'undefined') {
  class FriendRenderer {
    constructor() {
      // 使用统一的正则表达式管理器
      this.contextMonitor =
        window['contextMonitor'] || (window['ContextMonitor'] ? new window['ContextMonitor']() : null);
      if (!this.contextMonitor) {
        console.warn('[Friend Renderer] 上下文监控器未初始化，使用默认正则表达式');
        this.friendPattern = /\[好友id\|([^|]+)\|(\d+)\]/g;
      } else {
        this.friendPattern = this.contextMonitor.getRegexForFormat('friend');
      }
      this.extractedFriends = [];
      this.lastChatRecord = '';
      this.init();
    }

    init() {
      console.log('[Friend Renderer] 好友渲染器初始化完成');
    }

    /**
     * 从上下文中提取所有好友和群聊信息
     */
    extractFriendsFromContext() {
      this.extractedFriends = [];

      // 检查移动端上下文编辑器是否可用
      if (!window.mobileContextEditor) {
        console.warn('[Friend Renderer] 移动端上下文编辑器未加载');
        return [];
      }

      // 检查SillyTavern是否准备就绪
      if (!window.mobileContextEditor.isSillyTavernReady()) {
        console.warn('[Friend Renderer] SillyTavern未准备就绪');
        return [];
      }

      try {
        // 获取上下文数据
        const context = window.SillyTavern.getContext();
        if (!context || !context.chat || !Array.isArray(context.chat)) {
          console.warn('[Friend Renderer] 聊天数据不可用');
          return [];
        }

        // 遍历所有消息，提取好友和群聊信息
        const friendsMap = new Map();
        const groupsMap = new Map();

        // 定义正则表达式
        const friendPattern = /\[好友id\|([^|]+)\|(\d+)\]/g;
        const groupPattern = /\[群聊\|([^|]+)\|([^|]+)\|([^\]]+)\]/g;

        // 新增：支持群聊消息格式来提取群聊信息
        const groupMessagePattern = /\[群聊消息\|([^|]+)\|([^|]+)\|([^|]+)\|([^\]]+)\]/g;
        // 新增：支持我方群聊消息格式
        const myGroupMessagePattern = /\[我方群聊消息\|我\|([^|]+)\|([^|]+)\|([^\]]+)\]/g;

        context.chat.forEach((message, index) => {
          if (message.mes && typeof message.mes === 'string') {
            // 移除thinking标签后再进行匹配，避免提取thinking内的内容
            const messageForMatching = this.removeThinkingTags(message.mes);

            // 提取好友信息
            const friendMatches = [...messageForMatching.matchAll(friendPattern)];
            friendMatches.forEach(match => {
              const friendName = match[1];
              const friendNumber = match[2];
              const friendKey = `friend_${friendName}_${friendNumber}`;

              if (!friendsMap.has(friendKey) || friendsMap.get(friendKey).messageIndex < index) {
                friendsMap.set(friendKey, {
                  type: 'friend',
                  name: friendName,
                  number: friendNumber,
                  messageIndex: index,
                  addTime: message.send_date || Date.now(),
                  isGroup: false,
                });
              }
            });

            // 提取群聊信息（原有格式）
            const groupMatches = [...messageForMatching.matchAll(groupPattern)];
            groupMatches.forEach(match => {
              const groupName = match[1];
              const groupId = match[2];
              const groupMembers = match[3];
              const groupKey = `group_${groupId}`; // 统一使用群ID作为key

              if (!groupsMap.has(groupKey) || groupsMap.get(groupKey).messageIndex < index) {
                groupsMap.set(groupKey, {
                  type: 'group',
                  name: groupName,
                  number: groupId,
                  members: groupMembers,
                  messageIndex: index,
                  addTime: message.send_date || Date.now(),
                  isGroup: true,
                });
              }
            });

            // 处理群聊消息格式
            const groupMessageMatches = [...messageForMatching.matchAll(groupMessagePattern)];
            groupMessageMatches.forEach(match => {
              const groupId = match[1];
              const senderName = match[2];
              const messageType = match[3];
              const messageContent = match[4];

              const groupKey = `group_${groupId}`; // 统一使用群ID作为key

              if (!groupsMap.has(groupKey)) {
                // 如果群聊不存在，创建一个基于消息的群聊记录
                groupsMap.set(groupKey, {
                  type: 'group',
                  name: `群聊${groupId}`,
                  number: groupId,
                  members: senderName,
                  messageIndex: index,
                  addTime: message.send_date || Date.now(),
                  isGroup: true,
                });
              } else {
                // 如果已存在，更新成员列表和最新消息索引
                const existingGroup = groupsMap.get(groupKey);
                if (existingGroup.members && !existingGroup.members.includes(senderName)) {
                  existingGroup.members += `、${senderName}`;
                }
                if (existingGroup.messageIndex < index) {
                  existingGroup.messageIndex = index;
                  existingGroup.addTime = message.send_date || Date.now();
                }
              }
            });

            // 处理我方群聊消息格式
            const myGroupMessageMatches = [...messageForMatching.matchAll(myGroupMessagePattern)];
            myGroupMessageMatches.forEach(match => {
              const groupId = match[1];
              const messageType = match[2];
              const messageContent = match[3];

              const groupKey = `group_${groupId}`; // 统一使用群ID作为key

              if (!groupsMap.has(groupKey)) {
                // 如果群聊不存在，创建一个基于消息的群聊记录
                groupsMap.set(groupKey, {
                  type: 'group',
                  name: `群聊${groupId}`,
                  number: groupId,
                  members: '我',
                  messageIndex: index,
                  addTime: message.send_date || Date.now(),
                  isGroup: true,
                });
              } else {
                // 如果已存在，更新最新消息索引
                const existingGroup = groupsMap.get(groupKey);
                if (!existingGroup.members.includes('我')) {
                  existingGroup.members += '、我';
                }
                if (existingGroup.messageIndex < index) {
                  existingGroup.messageIndex = index;
                  existingGroup.addTime = message.send_date || Date.now();
                }
              }
            });
          }
        });

        // 合并好友和群聊，按添加时间排序
        const allContacts = [...Array.from(friendsMap.values()), ...Array.from(groupsMap.values())].sort(
          (a, b) => b.addTime - a.addTime,
        );

        // 为每个联系人找到最后一条消息
        this.extractedFriends = allContacts.map(contact => {
          const lastMessage = this.getLastMessageForContact(context.chat, contact);
          return {
            ...contact,
            lastMessage: lastMessage,
          };
        });

        // 只在联系人数量变化时输出日志，避免重复输出
        if (!this.lastContactCount || this.lastContactCount !== this.extractedFriends.length) {
          console.log(`[Friend Renderer] 从上下文中提取到 ${this.extractedFriends.length} 个联系人 (好友+群聊)`);
          this.lastContactCount = this.extractedFriends.length;
        }

        return this.extractedFriends;
      } catch (error) {
        console.error('[Friend Renderer] 提取联系人信息失败:', error);
        return [];
      }
    }

    /**
     * 获取指定联系人的最后一条消息
     */
    getLastMessageForContact(chatMessages, contact) {
      if (!chatMessages || chatMessages.length === 0) {
        return '暂无聊天记录';
      }

      // 创建匹配模式
      let messagePatterns = [];

      if (contact.isGroup) {
        // 群聊消息模式
        messagePatterns = [
          // 我方群聊消息：[我方群聊消息|我|群ID|消息类型|消息内容]
          new RegExp(`\\[我方群聊消息\\|我\\|${this.escapeRegex(contact.number)}\\|[^|]+\\|([^\\]]+)\\]`, 'g'),
          // 群聊消息格式：[群聊消息|群ID|发送者|消息类型|消息内容]
          new RegExp(`\\[群聊消息\\|${this.escapeRegex(contact.number)}\\|[^|]+\\|[^|]+\\|([^\\]]+)\\]`, 'g'),
          // 原有格式兼容（如果还有的话）
          new RegExp(
            `\\[我方群聊消息\\|${this.escapeRegex(contact.name)}\\|${this.escapeRegex(
              contact.number,
            )}\\|[^|]+\\|([^|]+)\\|[^\\]]+\\]`,
            'g',
          ),
          new RegExp(
            `\\[对方群聊消息\\|${this.escapeRegex(contact.name)}\\|${this.escapeRegex(
              contact.number,
            )}\\|[^|]+\\|[^|]+\\|([^\\]]+)\\]`,
            'g',
          ),
        ];
      } else {
        // 私聊消息模式
        messagePatterns = [
          // 我方消息：[我方消息|我|好友号|消息内容|时间]
          new RegExp(`\\[我方消息\\|我\\|${this.escapeRegex(contact.number)}\\|([^|]+)\\|[^\\]]+\\]`, 'g'),
          // 对方消息：[对方消息|好友名|好友号|消息类型|消息内容]
          new RegExp(
            `\\[对方消息\\|${this.escapeRegex(contact.name)}\\|${this.escapeRegex(
              contact.number,
            )}\\|[^|]+\\|([^\\]]+)\\]`,
            'g',
          ),
        ];
      }

      // 从最后一条消息开始往前找
      for (let i = chatMessages.length - 1; i >= 0; i--) {
        const message = chatMessages[i];
        if (message.mes && typeof message.mes === 'string') {
          for (const pattern of messagePatterns) {
            const matches = [...message.mes.matchAll(pattern)];
            if (matches.length > 0) {
              // 找到最后一条匹配的消息，提取内容
              const lastMatch = matches[matches.length - 1];
              if (lastMatch[1]) {
                const content = lastMatch[1].trim();
                return content.length > 50 ? content.substring(0, 50) + '...' : content;
              }
            }
            pattern.lastIndex = 0; // 重置正则表达式
          }
        }
      }

      return contact.isGroup ? '暂无群聊记录' : '暂无聊天记录';
    }

    /**
     * 转义正则表达式特殊字符
     */
    escapeRegex(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * 获取最后一条聊天记录（保留兼容性）
     */
    getLastChatRecord(chatMessages) {
      if (!chatMessages || chatMessages.length === 0) {
        return '暂无聊天记录';
      }

      // 从最后一条消息开始往前找，找到第一条非好友添加/群聊添加消息
      for (let i = chatMessages.length - 1; i >= 0; i--) {
        const message = chatMessages[i];
        if (message.mes && typeof message.mes === 'string') {
          // 如果不是好友添加或群聊格式的消息，则作为最后聊天记录
          const friendPattern = /\[好友id\|[^|]+\|\d+\]/;
          const groupPattern = /\[群聊\|[^|]+\|[^|]+\|[^\]]+\]/;

          if (!friendPattern.test(message.mes) && !groupPattern.test(message.mes)) {
            // 提取实际的消息内容
            const actualContent = this.extractActualMessageContent(message.mes);
            return actualContent.length > 50 ? actualContent.substring(0, 50) + '...' : actualContent;
          }
        }
      }

      return '暂无聊天记录';
    }

    /**
     * 提取实际的消息内容（过滤思考过程，提取QQ格式消息）
     */
    extractActualMessageContent(messageText) {
  try {
    // 1. 移除 <thinking> 标签及其内容
    let cleanedText = messageText.replace(/<think>[\s\S]*?<\/think>|<thinking>[\s\S]*?<\/thinking>/gi, '');

    // 2. 定义匹配模式
    const qqMessagePatterns = [
      /\[我方消息\|[^|]+\|[^|]+\|([^|]+)\|[^\]]+\]/g,
      /\[我方群聊消息\|[^|]+\|[^|]+\|[^|]+\|([^|]+)\|[^\]]+\]/g,
      /\[对方消息\|[^|]+\|[^|]+\|[^|]+\|([^\]]+)\]/g,
      /\[对方群聊消息\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|([^\]]+)\]/g,
      /\[群聊消息\|[^|]+\|[^|]+\|[^|]+\|([^\]]+)\]/g,
      /\[表情包\|[^|]+\|[^\]]+\]/g,
      /\[语音\|[^|]+\|([^\]]+)\]/g,
      /\[红包\|([^|]+)\|[^\]]+\]/g,
    ];

    const extractedMessages = [];

    for (const pattern of qqMessagePatterns) {
      let match;
      while ((match = pattern.exec(cleanedText)) !== null) {
        if (match[1] || match[0]) {
          let content = match[1] || match[0];

          // --- 核心修复：强力清洗预览中的 HTML ---
          if (content.includes('<img')) {
            content = '[图片]';
          } else if (content.includes('<video')) {
            content = '[视频]';
          } else if (content.includes('<audio')) {
            content = '[音频]';
          } else if (/<[^>]+>/g.test(content)) {
            // 这里是关键：先移除所有 HTML 标签，再把 &nbsp; 等实体转为空格
            content = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
            // 如果洗完只剩下空白，说明是纯图文卡片，给个保底
            if (!content) content = '[图文消息]';
          }
          // --- 修复结束 ---

          // 保持原有的特殊格式处理
          if (pattern.source.includes('红包')) {
            extractedMessages.push(`红包：${content}`);
          } else if (pattern.source.includes('表情包')) {
            extractedMessages.push('表情包');
          } else if (pattern.source.includes('语音')) {
            extractedMessages.push(`语音：${content}`);
          } else {
            extractedMessages.push(content);
          }
        }
      }
      pattern.lastIndex = 0;
    }

    if (extractedMessages.length > 0) {
      const finalContent = extractedMessages[extractedMessages.length - 1];
      // 限制字数，防止预览撑破布局
      return finalContent.length > 50 ? finalContent.substring(0, 50) + '...' : finalContent;
    }

    // 3. 兜底逻辑：如果没有匹配到格式，处理纯文本
    let finalClean = cleanedText.trim().replace(/\n\s*\n/g, '\n').split('\n')[0];
    return finalClean.length > 50 ? finalClean.substring(0, 50) + '...' : finalClean || '消息内容';
    
  } catch (error) {
    console.error('[Friend Renderer] 提取消息内容失败:', error);
    return '消息内容';
  }
}

    /**
     * HTML转义函数
     */
    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    /**
     * 渲染好友和群聊列表HTML - 最终森系折叠版
     */
    renderFriendsHTML() {
        // 1. 提取排序好的好友数据
        const contacts = this.extractFriendsFromContext();

        if (contacts.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">💬</div>
                    <div class="empty-text">暂无联系人</div>
                </div>`;
        }

        // 2. 初始化分组容器
        const groups = { special: [], colleague: [], client: [], others: [] };
        
        // 3. 将好友分流到不同组
        contacts.forEach(c => {
            const gType = c.groupType || 'others';
            if (groups[gType]) {
                groups[gType].push(c);
            } else {
                groups.others.push(c);
            }
        });

        // 4. 定义内部渲染逻辑 (保留你原有的 escapeHtml 和样式判定)
        const renderItem = (contact) => {
            const lastMessage = this.escapeHtml(contact.lastMessage || '暂无消息');
            
            // 头像判定逻辑：如果有配置好的头像就用，没有就用你原有的渲染方式
            let avatarHTML;
            if (contact.avatar) {
                avatarHTML = `<div class="message-avatar" style="background-image: url('${contact.avatar}'); background-size: cover; background-position: center;"></div>`;
            } else if (contact.isGroup) {
                avatarHTML = `<div class="message-avatar group-avatar"></div>`;
            } else {
                // 如果没有配置头像，尝试调用你原有的 getRandomAvatar()
                avatarHTML = `<div class="message-avatar">${typeof this.getRandomAvatar === 'function' ? this.getRandomAvatar() : '👤'}</div>`;
            }

            return `
                <div class="message-item ${contact.isGroup ? 'group-item' : 'friend-item'}" data-friend-id="${contact.number}" data-is-group="${contact.isGroup}">
                    ${avatarHTML}
                    <div class="message-content">
                        <div class="message-name">
                            ${contact.name} 
                            ${contact.isGroup ? '<span class="group-badge">群聊</span>' : ''}
                            ${contact.hasUnreadTag ? '<span style="color:#ff3b30;font-size:10px;margin-left:4px;">●</span>' : ''}
                        </div>
                        <div class="message-text">${lastMessage}</div>
                    </div>
                    <div style="font-size:10px; color:#bbb; min-width:30px; text-align:right;">${contact.lastMessageTime || ''}</div>
                </div>`;
        };

        // 5. 定义折叠标题渲染模板
        const renderGroupWrapper = (title, list, icon) => {
            if (list.length === 0) return "";
            return `
                <div class="contact-group-header" onclick="const b=this.nextElementSibling; b.style.display=b.style.display==='none'?'block':'none'; this.querySelector('.arrow').innerText=b.style.display==='none'?'▶':'▼';">
                    <div class="group-title"><span>${icon} ${title}</span> <span class="group-count">${list.length}</span></div>
                    <span class="arrow">▶</span>
                </div>
                <div class="contact-group-body" style="display:none;">
                    ${list.map(renderItem).join('')}
                </div>`;
        };

        // 6. 最终 HTML 拼接
        return `
            <style>
                .contact-group-header { padding: 8px 16px; background: #fdf5e6; display: flex; justify-content: space-between; align-items: center; cursor: pointer; border-bottom: 0.5px solid #eee; margin-top:5px; }
                .group-title { font-size: 11px; font-weight: 900; color: #8b4513; display: flex; align-items: center; gap: 6px; }
                .group-count { background: #8b4513; color: white; font-size: 9px; padding: 1px 5px; border-radius: 10px; opacity: 0.6; }
                .arrow { font-size: 10px; color: #8b4513; }
                .contact-group-body { background: #fff; border-bottom: 0.5px solid #eee; }
            </style>
            
            <div class="special-list">
                ${groups.special.map(renderItem).join('')}
                ${groups.others.map(renderItem).join('')}
            </div>
            
            ${renderGroupWrapper('律所权力金字塔', groups.colleague, '⚖️')}
            ${renderGroupWrapper('客户与项目合作', groups.client, '💎')}
        `;
    }

    /**
     * 获取群成员数量
     */
    getMemberCount(membersString) {
      if (!membersString) return 0;
      // 群成员格式：我、张三、李四、王五
      const members = membersString.split('、').filter(m => m.trim());
      return members.length;
    }

    /**
     * 获取随机头像
     */
    getRandomAvatar() {
      // 返回空字符串，不显示表情符号，只显示背景图片
      return '';
    }

    /**
     * 格式化时间
     */
    formatTime(timestamp) {
      // 处理各种可能的时间戳格式
      let date;

      if (!timestamp) {
        // 如果没有时间戳，使用当前时间
        date = new Date();
      } else if (typeof timestamp === 'string') {
        // 如果是字符串，尝试解析
        date = new Date(timestamp);
        // 如果解析失败，使用当前时间
        if (isNaN(date.getTime())) {
          date = new Date();
        }
      } else if (typeof timestamp === 'number') {
        // 如果是数字，直接使用
        date = new Date(timestamp);
        // 检查是否为有效时间戳
        if (isNaN(date.getTime())) {
          date = new Date();
        }
      } else {
        // 其他情况使用当前时间
        date = new Date();
      }

      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      // 如果时间差异过大（超过1年），可能是时间戳格式问题，显示简单格式
      if (Math.abs(diffDays) > 365) {
        return date.toLocaleDateString('zh-CN', {
          month: 'short',
          day: 'numeric',
        });
      }

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

    /**
     * 获取好友数量
     */
    getFriendCount() {
      return this.extractedFriends.length;
    }

    /**
     * 根据ID获取好友信息
     */
    getFriendById(friendId) {
      return this.extractedFriends.find(friend => friend.number === friendId);
    }

    /**
     * 刷新好友列表
     */
    refresh() {
      this.extractFriendsFromContext();
      console.log('[Friend Renderer] 好友列表已刷新');
    }

    /**
     * 提取好友信息（兼容方法名）
     */
    extractFriends() {
      return this.extractFriendsFromContext();
    }

    /**
     * 移除thinking标签包裹的内容
     */
    removeThinkingTags(text) {
      if (!text || typeof text !== 'string') {
        return text;
      }

      // 移除 <think>...</think> 和 <thinking>...</thinking> 标签及其内容
      const thinkingTagRegex = /<think>[\s\S]*?<\/think>|<thinking>[\s\S]*?<\/thinking>/gi;
      return text.replace(thinkingTagRegex, '');
    }

    /**
     * 检查格式标记是否在thinking标签内
     */
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

    /**
     * 只移除不在thinking标签内的格式标记
     */
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

    /**
     * 调试输出
     */
    debug() {
      // 修复：只在调试模式下输出详细信息
      if (window.DEBUG_FRIEND_RENDERER) {
        console.group('[Friend Renderer] 调试信息');
        console.log('提取的好友数量:', this.extractedFriends.length);
        console.log('好友列表:', this.extractedFriends);
        console.log('最后聊天记录:', this.lastChatRecord);
        console.log('正则表达式:', this.friendPattern);
        console.groupEnd();
      }
    }
  }

  // 创建全局实例
  window.FriendRenderer = FriendRenderer;
  window.friendRenderer = new FriendRenderer();

  // 为message-app提供的接口
  window.renderFriendsFromContext = function () {
    return window.friendRenderer.renderFriendsHTML();
  };

  window.refreshFriendsList = function () {
    window.friendRenderer.refresh();
  };

  console.log('[Friend Renderer] 好友渲染器模块加载完成');
} // 结束 if (typeof window.FriendRenderer === 'undefined') 检查
