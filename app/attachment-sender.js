/**
 * 【李至中手机模拟器 - 附件处理模块（待重构）】
 * * 🚩 重构思路（占位注释）：
 * 1. 核心任务：负责将李律师购买的商品、收到的图片转换为手机能显示的 Q 版 icon 或缩略图。
 * 2. 拒绝操作：严禁直接去碰酒馆的发送框（send_textarea），那是旧时代的卡顿来源。
 * 3. 未来对接：对接“收纳系统”方案A/B，当物品移入背包时，调用此脚本的 fileToBase64 功能。
 */

class MobileAttachmentTool {
    constructor() {
        // 限制10MB，保护内存
        this.maxFileSize = 10 * 1024 * 1024;
        this.supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        console.log('🖼️ [System] 附件处理工具已降级为纯净模式，等待新协议接入。');
    }

    // 未来保留：将图片转为Base64码（用于收纳盒图标生成）
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // 未来保留：验证文件大小（防止李律师买的“超大物件”撑爆内存）
    validateFile(file) {
        if (file.size > this.maxFileSize) return { isValid: false, error: '文件太大' };
        return { isValid: true };
    }
}

// 注册到全局，但现在不执行任何主动操作
window.attachmentTool = new MobileAttachmentTool();

/**
 * 附件发送器 - 处理文件上传和发送功能
 * 支持图片、文档等多种文件类型的上传和发送
 */

// @ts-check
// TypeScript类型声明
/**
 * @typedef {Object} UploadResult
 * @property {boolean} success
 * @property {string} fileUrl
 * @property {string} fileName
 * @property {number} fileSize
 * @property {string} fileType
 * @property {string} uploadMethod
 */

/**
 * @typedef {Object} AttachmentSenderGlobal
 * @property {Object} attachmentSender
 * @property {Function} testAttachmentSender
 * @property {Function} checkAttachmentEnvironment
 * @property {Function} testSillyTavernUpload
 * @property {Function} testImageMessageFlow
 * @property {Function} testImageMessageParsing
 * @property {Function} testMultipleImageFormats
 * @property {Function} checkSillyTavernMessages
 */

// 扩展Window接口
// @ts-ignore
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.AttachmentSender = window.AttachmentSender || undefined;
  // @ts-ignore
  window.attachmentSender = window.attachmentSender || undefined;
}

(function (window) {
  'use strict';

  class AttachmentSender {
    constructor() {
      this.currentChatTarget = null;
      this.currentChatName = null;
      this.isCurrentChatGroup = false;

      // 支持的文件类型
      this.supportedTypes = {
        images: [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/bmp',
          'image/tiff',
          'image/svg+xml',
        ],
        documents: [
          'application/pdf',
          'text/plain',
          'text/csv',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ],
        archives: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'],
        audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'],
        video: ['video/mp4', 'video/avi', 'video/mov', 'video/wmv'],
      };

      // 文件大小限制 (10MB)
      this.maxFileSize = 10 * 1024 * 1024;

      console.log('[AttachmentSender] 附件发送器初始化完成');
    }

    // 设置当前聊天对象
    setCurrentChat(targetId, targetName, isGroup = false) {
      console.log(`[AttachmentSender] 🔍 设置聊天对象: ${targetName} (${targetId}), 群聊: ${isGroup}`);
      this.currentChatTarget = targetId;
      this.currentChatName = targetName;
      this.isCurrentChatGroup = isGroup;

      console.log(`[AttachmentSender] ✅ 聊天对象设置完成:`, {
        target: this.currentChatTarget,
        name: this.currentChatName,
        isGroup: this.isCurrentChatGroup,
      });
    }

    // 检查文件类型是否支持
    isFileTypeSupported(file) {
      const allSupportedTypes = [
        ...this.supportedTypes.images,
        ...this.supportedTypes.documents,
        ...this.supportedTypes.archives,
        ...this.supportedTypes.audio,
        ...this.supportedTypes.video,
      ];

      return allSupportedTypes.includes(file.type);
    }

    // 获取文件类型分类
    getFileCategory(file) {
      if (this.supportedTypes.images.includes(file.type)) return 'image';
      if (this.supportedTypes.documents.includes(file.type)) return 'document';
      if (this.supportedTypes.archives.includes(file.type)) return 'archive';
      if (this.supportedTypes.audio.includes(file.type)) return 'audio';
      if (this.supportedTypes.video.includes(file.type)) return 'video';
      return 'unknown';
    }

    // 格式化文件大小
    formatFileSize(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 验证文件
    validateFile(file) {
      const errors = [];

      // 检查文件大小
      if (file.size > this.maxFileSize) {
        errors.push(`文件大小超过限制 (最大 ${this.formatFileSize(this.maxFileSize)})`);
      }

      // 检查文件类型
      if (!this.isFileTypeSupported(file)) {
        errors.push('不支持的文件类型');
      }

      // 检查文件名
      if (!file.name || file.name.trim() === '') {
        errors.push('文件名无效');
      }

      return {
        isValid: errors.length === 0,
        errors: errors,
      };
    }

    // 创建文件预览
    createFilePreview(file) {
      const category = this.getFileCategory(file);
      const fileSize = this.formatFileSize(file.size);

      let previewContent = '';
      let icon = '📄';

      switch (category) {
        case 'image':
          icon = '🖼️';
          // 对于图片，创建缩略图预览
          const imageUrl = URL.createObjectURL(file);
          previewContent = `
                        <div class="file-preview-image">
                            <img src="${imageUrl}" alt="${file.name}" style="max-width: 100px; max-height: 100px; border-radius: 4px;">
                        </div>
                    `;
          break;
        case 'document':
          icon = '📄';
          break;
        case 'archive':
          icon = '📦';
          break;
        case 'audio':
          icon = '🎵';
          break;
        case 'video':
          icon = '🎬';
          break;
        default:
          icon = '📎';
      }

      return {
        icon,
        category,
        previewContent,
        fileName: file.name,
        fileSize,
        file,
      };
    }

    // 上传文件到SillyTavern
    async uploadFileToSillyTavern(file) {
      try {
        console.log(`[AttachmentSender] 🔍 开始上传文件到SillyTavern: ${file.name}`);
        console.log(`[AttachmentSender] 🔍 文件信息:`, {
          name: file.name,
          size: file.size,
          type: file.type,
        });

        // 方法1: 使用SillyTavern的uploadFileAttachmentToServer函数
        if (window.uploadFileAttachmentToServer) {
          console.log(`[AttachmentSender] 🔍 使用uploadFileAttachmentToServer上传`);

          try {
            const uploadedUrl = await window.uploadFileAttachmentToServer(file, 'chat');
            console.log(`[AttachmentSender] ✅ uploadFileAttachmentToServer上传成功:`, uploadedUrl);

            return {
              success: true,
              fileUrl: uploadedUrl,
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              uploadMethod: 'uploadFileAttachmentToServer',
            };
          } catch (error) {
            console.warn(`[AttachmentSender] ⚠️ uploadFileAttachmentToServer失败:`, error);
          }
        }

        // 方法2: 使用SillyTavern的文件上传API
        console.log(`[AttachmentSender] 🔍 尝试使用/api/files/upload API`);

        try {
          // 转换文件为base64
          const base64Data = await this.fileToBase64(file);

          // 生成唯一文件名
          const timestamp = Date.now();
          const randomId = Math.random().toString(36).substring(2, 8);
          const fileExtension = file.name.split('.').pop() || 'txt';
          const uniqueFileName = `mobile_attachment_${timestamp}_${randomId}.${fileExtension}`;

          console.log(`[AttachmentSender] 🔍 生成唯一文件名:`, uniqueFileName);

          const response = await fetch('/api/files/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: uniqueFileName,
              data: base64Data,
            }),
          });

          if (response.ok) {
            const result = await response.json();
            console.log(`[AttachmentSender] ✅ API上传成功:`, result);

            return {
              success: true,
              fileUrl: result.path || result.url || uniqueFileName,
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              uploadMethod: 'api',
              uploadResult: result,
            };
          } else {
            console.warn(`[AttachmentSender] ⚠️ API上传失败:`, response.status, response.statusText);
          }
        } catch (error) {
          console.warn(`[AttachmentSender] ⚠️ API上传异常:`, error);
        }

        // 方法3: 模拟SillyTavern的文件输入上传
        console.log(`[AttachmentSender] 🔍 尝试模拟文件输入上传`);

        try {
          const result = await this.simulateFileInputUpload(file);
          if (result.success) {
            return result;
          }
        } catch (error) {
          console.warn(`[AttachmentSender] ⚠️ 模拟上传失败:`, error);
        }

        // 备用方案：创建本地URL（但这不会真正上传到SillyTavern）
        console.log(`[AttachmentSender] ⚠️ 所有上传方法失败，使用本地URL备用方案`);
        const fileUrl = URL.createObjectURL(file);

        return {
          success: true,
          fileUrl: fileUrl,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          isLocalFile: true,
          uploadMethod: 'local',
        };
      } catch (error) {
        console.error(`[AttachmentSender] ❌ 文件上传失败:`, error);
        return {
          success: false,
          error: error.message,
        };
      }
    }

    // 将文件转换为base64
    async fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          // 移除data:前缀，只保留base64数据
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    // 模拟SillyTavern的文件输入上传
    async simulateFileInputUpload(file) {
      try {
        console.log(`[AttachmentSender] 🔍 开始模拟文件输入上传`);

        // 查找SillyTavern的文件输入元素
        const fileInput = document.getElementById('file_form_input');
        if (!fileInput) {
          throw new Error('找不到SillyTavern的文件输入元素');
        }

        console.log(`[AttachmentSender] 🔍 找到文件输入元素，准备设置文件`);

        // 创建DataTransfer对象来模拟文件选择
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);

        // 设置文件到输入元素
        fileInput.files = dataTransfer.files;

        // 触发change事件
        const changeEvent = new Event('change', { bubbles: true });
        fileInput.dispatchEvent(changeEvent);

        console.log(`[AttachmentSender] 🔍 已触发文件输入change事件`);

        // 等待一下让SillyTavern处理文件
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 检查是否有文件被附加
        const fileAttached = document.querySelector('.file_attached');
        if (fileAttached) {
          console.log(`[AttachmentSender] ✅ 文件已被SillyTavern处理`);

          return {
            success: true,
            fileUrl: 'attached_to_sillytavern',
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            uploadMethod: 'simulate',
          };
        } else {
          throw new Error('文件未被SillyTavern正确处理');
        }
      } catch (error) {
        console.error(`[AttachmentSender] ❌ 模拟上传失败:`, error);
        return {
          success: false,
          error: error.message,
        };
      }
    }

    // 发送附件消息到SillyTavern聊天
    async sendAttachmentMessage(uploadResult, additionalMessages = '') {
      console.log('[AttachmentSender] 🔍 开始发送附件消息');
      console.log('[AttachmentSender] 🔍 当前聊天对象:', {
        target: this.currentChatTarget,
        name: this.currentChatName,
        isGroup: this.isCurrentChatGroup,
      });

      try {
        if (!this.currentChatTarget || !this.currentChatName) {
          throw new Error('未设置聊天对象');
        }

        const category = this.getFileCategory({ type: uploadResult.fileType });
        const fileSize = this.formatFileSize(uploadResult.fileSize);

        console.log('[AttachmentSender] 🔍 文件信息:', {
          category,
          fileSize,
          fileName: uploadResult.fileName,
          fileType: uploadResult.fileType,
        });

        // 构建消息内容 - 使用message-app能识别的格式
        let messageContent = '';

        if (this.isCurrentChatGroup) {
          // 群聊格式
          messageContent = `向${this.currentChatName}（${this.currentChatTarget}）发送群聊消息\n\n`;
          messageContent += `请按照线上聊天群聊消息中的要求和格式生成角色回复，回复需要符合角色人设和当前剧情\n\n`;
        } else {
          // 私聊格式
          messageContent = `向${this.currentChatName}（${this.currentChatTarget}）发送消息\n\n`;
          messageContent += `请按照线上聊天私聊消息中的要求和格式生成角色回复，回复需要符合角色人设和当前剧情\n\n`;
        }

        // 处理用户输入的附加消息
        if (additionalMessages && additionalMessages.trim()) {
          console.log('[AttachmentSender] 🔍 处理附加消息:', additionalMessages);
          const messageLines = additionalMessages.split('\n').filter(line => line.trim());

          for (const line of messageLines) {
            const trimmedLine = line.trim();
            if (trimmedLine) {
              messageContent += `[我方消息|${this.currentChatName}|${this.currentChatTarget}|文字|${trimmedLine}]\n`;
            }
          }
          messageContent += '\n';
        }

        // 根据文件类型添加不同的消息格式 - 使用message-app能解析的格式
        if (category === 'image') {
          messageContent += `[我方消息|${this.currentChatName}|${this.currentChatTarget}|附件|图片: ${uploadResult.fileName}]`;
        } else {
          messageContent += `[我方消息|${this.currentChatName}|${this.currentChatTarget}|附件|附件: ${uploadResult.fileName} (${fileSize})]`;
        }

        console.log('[AttachmentSender] 🔍 构建的消息内容:', messageContent);

        // 发送消息到SillyTavern
        const success = await this.sendToSillyTavern(messageContent, uploadResult);

        if (success) {
          console.log(`[AttachmentSender] ✅ 附件消息发送成功`);

          // 🌟 新增：等待SillyTavern处理消息，然后提取图片信息
          if (category === 'image') {
            console.log(`[AttachmentSender] 🔍 等待SillyTavern处理图片消息...`);
            setTimeout(async () => {
              await this.extractImageFromSillyTavern(uploadResult);
            }, 2000); // 等待2秒让SillyTavern处理消息
          }

          return true;
        } else {
          throw new Error('发送消息到SillyTavern失败');
        }
      } catch (error) {
        console.error(`[AttachmentSender] ❌ 发送附件消息失败:`, error);
        return false;
      }
    }

    // 发送消息到SillyTavern
    async sendToSillyTavern(messageContent, uploadResult) {
      console.log('[AttachmentSender] 🔍 开始发送消息到SillyTavern');
      console.log('[AttachmentSender] 🔍 消息内容:', messageContent);
      console.log('[AttachmentSender] 🔍 上传结果:', uploadResult);

      try {
        // 检查SillyTavern环境
        console.log('[AttachmentSender] 🔍 检查SillyTavern环境:');
        console.log('  - send_textarea存在:', !!document.getElementById('send_textarea'));
        console.log('  - send_but存在:', !!document.getElementById('send_but'));
        console.log('  - window.Generate存在:', typeof window.Generate === 'function');
        console.log('  - window.messageSender存在:', !!window.messageSender);
        console.log('  - window.sendMessageAsUser存在:', typeof window.sendMessageAsUser === 'function');

        // 方法1: 使用标准的DOM元素方法（参考其他app的实现）
        const messageTextarea = document.getElementById('send_textarea');
        const sendButton = document.getElementById('send_but');

        if (messageTextarea && sendButton) {
          console.log('[AttachmentSender] 🔍 使用方法1: DOM元素方法');

          // 检查元素状态
          console.log('[AttachmentSender] 🔍 输入框状态:', {
            disabled: messageTextarea.disabled,
            value: messageTextarea.value,
          });
          console.log('[AttachmentSender] 🔍 发送按钮状态:', {
            disabled: sendButton.disabled,
            classList: Array.from(sendButton.classList),
          });

          // 保存原始内容
          const originalContent = messageTextarea.value;
          console.log('[AttachmentSender] 🔍 原始输入框内容:', originalContent);

          // 检查输入框是否可用
          if (messageTextarea.disabled) {
            console.warn('[AttachmentSender] ⚠️ 输入框被禁用');
            return false;
          }

          // 检查发送按钮是否可用
          if (sendButton.disabled || sendButton.classList.contains('disabled')) {
            console.warn('[AttachmentSender] ⚠️ 发送按钮被禁用');
            return false;
          }

          // 设置消息内容
          messageTextarea.value = messageContent;
          console.log('[AttachmentSender] 🔍 已设置输入框值:', messageTextarea.value);

          // 触发输入事件
          messageTextarea.dispatchEvent(new Event('input', { bubbles: true }));
          messageTextarea.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('[AttachmentSender] 🔍 已触发输入事件');

          // 延迟点击发送按钮
          await new Promise(resolve => setTimeout(resolve, 300));
          sendButton.click();
          console.log('[AttachmentSender] 🔍 已点击发送按钮');

          // 等待一下再恢复原始内容
          setTimeout(() => {
            if (messageTextarea.value === messageContent) {
              messageTextarea.value = originalContent;
              console.log('[AttachmentSender] 🔍 恢复原始输入框内容');
            }
          }, 1000);

          return true;
        } else {
          console.warn('[AttachmentSender] ⚠️ 找不到send_textarea或send_but元素');
        }

        // 方法2: 使用messageSender（如果存在）
        if (window.messageSender && typeof window.messageSender.sendToChat === 'function') {
          console.log('[AttachmentSender] 🔍 使用方法2: messageSender.sendToChat');
          const result = await window.messageSender.sendToChat(messageContent);
          console.log('[AttachmentSender] 🔍 messageSender结果:', result);
          return result;
        }

        // 方法3: 尝试直接调用SillyTavern的聊天API
        if (window.sendMessageAsUser) {
          console.log('[AttachmentSender] 🔍 使用方法3: sendMessageAsUser');
          await window.sendMessageAsUser(messageContent);
          return true;
        }

        // 方法4: 使用Generate函数（如果存在）
        if (typeof window.Generate === 'function') {
          console.log('[AttachmentSender] 🔍 使用方法4: Generate函数');
          if (messageTextarea) {
            const originalContent = messageTextarea.value;
            messageTextarea.value = messageContent;
            window.Generate('normal');
            setTimeout(() => {
              if (messageTextarea.value === messageContent) {
                messageTextarea.value = originalContent;
              }
            }, 1000);
            return true;
          }
        }

        console.warn('[AttachmentSender] ❌ 无法找到合适的发送方法');
        return false;
      } catch (error) {
        console.error(`[AttachmentSender] 发送到SillyTavern失败:`, error);
        return false;
      }
    }

    // 获取当前时间
    getCurrentTime() {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    }

    // 🌟 新增：获取当前角色名
    getCurrentCharacterName() {
      try {
        console.log(`[AttachmentSender] 🔍 开始获取角色名...`);

        // 方法1: 从聊天消息中获取角色名
        const chatMessages = document.querySelectorAll('#chat .mes');
        if (chatMessages.length > 0) {
          // 查找最近的AI消息，获取角色名
          for (let i = chatMessages.length - 1; i >= 0; i--) {
            const message = chatMessages[i];
            const isUser = message.getAttribute('is_user') === 'true';
            if (!isUser) {
              const charName = message.getAttribute('ch_name');
              if (charName && charName.trim()) {
                console.log(`[AttachmentSender] ✅ 从消息获取角色名:`, charName);
                return charName.trim();
              }
            }
          }
        }

        // 方法2: 从当前聊天名获取（通常就是角色名）
        if (this.currentChatName && this.currentChatName !== '秦倦') {
          console.log(`[AttachmentSender] ✅ 使用当前聊天名作为角色名:`, this.currentChatName);
          return this.currentChatName;
        }

        // 方法3: 从URL或其他地方获取
        const urlParams = new URLSearchParams(window.location.search);
        const charFromUrl = urlParams.get('char') || urlParams.get('character');
        if (charFromUrl) {
          console.log(`[AttachmentSender] ✅ 从URL获取角色名:`, charFromUrl);
          return charFromUrl;
        }

        // 方法4: 从localStorage获取最近使用的角色
        try {
          const recentChar =
            localStorage.getItem('selected_character') ||
            localStorage.getItem('character_name') ||
            localStorage.getItem('current_character');
          if (recentChar) {
            console.log(`[AttachmentSender] ✅ 从localStorage获取角色名:`, recentChar);
            return recentChar;
          }
        } catch (e) {
          console.warn(`[AttachmentSender] ⚠️ 无法访问localStorage:`, e);
        }

        // 方法5: 最后的备用方案
        console.warn(`[AttachmentSender] ⚠️ 无法获取角色名，使用默认值`);
        return 'default';
      } catch (error) {
        console.error(`[AttachmentSender] ❌ 获取角色名失败:`, error);
        return 'default';
      }
    }

    // 🌟 新增：从SillyTavern提取图片信息
    async extractImageFromSillyTavern(uploadResult) {
      try {
        console.log(`[AttachmentSender] 🔍 开始从SillyTavern DOM提取图片信息`);

        // 直接从DOM中查找最新的图片消息
        const chatMessages = document.querySelectorAll('#chat .mes');
        console.log(`[AttachmentSender] 🔍 找到${chatMessages.length}条DOM消息`);

        if (chatMessages.length === 0) {
          console.warn(`[AttachmentSender] ⚠️ 没有找到聊天消息DOM元素`);
          return null;
        }

        // 从最后几条消息中查找图片
        const messagesToCheck = Math.min(3, chatMessages.length); // 检查最后3条消息
        console.log(`[AttachmentSender] 🔍 检查最后${messagesToCheck}条消息...`);

        for (let i = chatMessages.length - messagesToCheck; i < chatMessages.length; i++) {
          const messageElement = chatMessages[i];
          console.log(`[AttachmentSender] 🔍 检查消息${i + 1}:`, messageElement);

          // 查找图片元素
          const imgElements = messageElement.querySelectorAll('img.mes_img');
          console.log(`[AttachmentSender] 🔍 消息${i + 1}中的图片数量:`, imgElements.length);

          if (imgElements.length > 0) {
            // 找到图片，获取最后一张（最新的）
            const latestImg = imgElements[imgElements.length - 1];
            let imageSrc = latestImg.src;

            console.log(`[AttachmentSender] 🔍 原始图片URL:`, imageSrc);
            console.log(`[AttachmentSender] 🔍 图片元素详情:`, {
              src: latestImg.src,
              alt: latestImg.alt,
              className: latestImg.className,
              width: latestImg.width,
              height: latestImg.height,
            });

            // 🌟 修复图片路径：如果URL不完整，尝试从其他图片中获取实际文件名
            if (imageSrc === 'http://127.0.0.1:8000/' || imageSrc.endsWith('/')) {
              console.log(`[AttachmentSender] ⚠️ 图片URL不完整，尝试从其他图片获取实际文件名...`);

              const characterName = this.getCurrentCharacterName();
              console.log(`[AttachmentSender] 🔍 获取到的角色名:`, characterName);

              // 🌟 尝试从页面中的其他图片获取实际的文件名模式
              const workingImages = document.querySelectorAll('img.mes_img');
              let actualFileName = null;

              console.log(`[AttachmentSender] 🔍 页面中的图片数量:`, workingImages.length);

              for (let img of workingImages) {
                if (img.src && img.src.includes('/user/images/') && img.naturalWidth > 0) {
                  // 提取实际的文件名
                  const urlParts = img.src.split('/');
                  const fileName = urlParts[urlParts.length - 1];
                  console.log(`[AttachmentSender] 🔍 找到工作的图片:`, img.src);
                  console.log(`[AttachmentSender] 🔍 提取的文件名:`, fileName);

                  // 如果这是最新的图片（通常文件名包含时间戳）
                  if (fileName && fileName.length > 10) {
                    actualFileName = fileName;
                    break;
                  }
                }
              }

              if (actualFileName) {
                // 使用找到的实际文件名
                const encodedCharacterName = encodeURIComponent(characterName);
                const correctPath = `/user/images/${encodedCharacterName}/${actualFileName}`;
                const correctUrl = `http://127.0.0.1:8000${correctPath}`;

                console.log(`[AttachmentSender] 🔍 使用实际文件名:`, actualFileName);
                console.log(`[AttachmentSender] 🔍 构建的正确路径:`, correctPath);
                console.log(`[AttachmentSender] 🔍 完整URL:`, correctUrl);

                imageSrc = correctUrl;
                console.log(`[AttachmentSender] ✅ 使用实际文件名构建的路径:`, imageSrc);
              } else {
                // 备用方案：使用原始文件名
                const encodedCharacterName = encodeURIComponent(characterName);
                const encodedFileName = encodeURIComponent(uploadResult.fileName);
                const correctPath = `/user/images/${encodedCharacterName}/${encodedFileName}`;
                const correctUrl = `http://127.0.0.1:8000${correctPath}`;

                console.log(`[AttachmentSender] ⚠️ 未找到实际文件名，使用原始文件名:`, uploadResult.fileName);
                console.log(`[AttachmentSender] 🔍 备用URL:`, correctUrl);

                imageSrc = correctUrl;
                console.log(`[AttachmentSender] ⚠️ 使用备用路径:`, imageSrc);
              }
            }

            console.log(`[AttachmentSender] ✅ 最终图片URL:`, imageSrc);

            // 通知message-app有新的图片消息
            this.notifyMessageAppNewImage({
              imagePath: imageSrc,
              fileName: uploadResult.fileName,
              fileSize: uploadResult.fileSize,
              fileType: uploadResult.fileType,
              chatTarget: this.currentChatTarget,
              chatName: this.currentChatName,
              isGroup: this.isCurrentChatGroup,
              time: this.getCurrentTime(),
            });

            return imageSrc;
          }
        }

        console.warn(`[AttachmentSender] ⚠️ 在最近的消息中未找到图片`);
        return null;
      } catch (error) {
        console.error(`[AttachmentSender] ❌ 提取图片信息失败:`, error);
        return null;
      }
    }

    // 🌟 新增：获取SillyTavern消息
    getSillyTavernMessages() {
      try {
        console.log(`[AttachmentSender] 🔍 尝试获取SillyTavern消息数据...`);

        // 检查所有可能的消息数据源
        console.log(`[AttachmentSender] 🔍 检查数据源:`, {
          'window.chat': !!window.chat,
          'window.chat.length': window.chat ? window.chat.length : 'N/A',
          'window.context': !!window.context,
          'window.context.chat': !!(window.context && window.context.chat),
          'window.messages': !!window.messages,
        });

        // 尝试多种方式获取SillyTavern的消息数据
        if (window.chat && Array.isArray(window.chat)) {
          console.log(`[AttachmentSender] ✅ 使用window.chat，消息数量:`, window.chat.length);
          return window.chat;
        }

        if (window.context && window.context.chat && Array.isArray(window.context.chat)) {
          console.log(`[AttachmentSender] ✅ 使用window.context.chat，消息数量:`, window.context.chat.length);
          return window.context.chat;
        }

        if (window.messages && Array.isArray(window.messages)) {
          console.log(`[AttachmentSender] ✅ 使用window.messages，消息数量:`, window.messages.length);
          return window.messages;
        }

        // 尝试从DOM中获取
        const chatContainer = document.querySelector('#chat');
        if (chatContainer && chatContainer.messages) {
          console.log(`[AttachmentSender] ✅ 使用DOM chatContainer.messages`);
          return chatContainer.messages;
        }

        console.warn(`[AttachmentSender] ⚠️ 无法找到SillyTavern消息数据`);
        return null;
      } catch (error) {
        console.error(`[AttachmentSender] ❌ 获取SillyTavern消息失败:`, error);
        return null;
      }
    }

    // 🌟 新增：通知message-app有新的图片消息
    notifyMessageAppNewImage(imageInfo) {
      try {
        console.log(`[AttachmentSender] 🔍 通知message-app新图片消息:`, imageInfo);

        // 检查message-app是否存在
        if (!window.messageApp) {
          console.warn(`[AttachmentSender] ⚠️ message-app未找到`);
          return;
        }

        // 调用message-app的方法来处理新图片
        if (typeof window.messageApp.handleNewImageMessage === 'function') {
          window.messageApp.handleNewImageMessage(imageInfo);
        } else {
          console.warn(`[AttachmentSender] ⚠️ message-app.handleNewImageMessage方法不存在`);

          // 备用方案：触发消息刷新
          if (typeof window.messageApp.refreshCurrentMessages === 'function') {
            console.log(`[AttachmentSender] 🔍 使用备用方案：刷新消息列表`);
            setTimeout(() => {
              window.messageApp.refreshCurrentMessages();
            }, 1000);
          }
        }
      } catch (error) {
        console.error(`[AttachmentSender] ❌ 通知message-app失败:`, error);
      }
    }

    // 🌟 修改：动态获取SillyTavern服务器地址，优先使用相对路径
    getSillyTavernServerUrl() {
      try {
        // 🌟 优先使用相对路径，因为SillyTavern本身就是这样处理的
        console.log(`[AttachmentSender] 🔍 使用相对路径（推荐）`);
        return ''; // 返回空字符串表示使用相对路径

        // 备用方案：如果需要完整URL，从当前页面获取
        /*
        const currentUrl = window.location;
        if (currentUrl.hostname && currentUrl.port) {
          const serverUrl = `${currentUrl.protocol}//${currentUrl.hostname}:${currentUrl.port}`;
          console.log(`[AttachmentSender] 🔍 从当前URL获取服务器地址:`, serverUrl);
          return serverUrl;
        }

        // 方法2: 尝试从配置或全局变量获取
        if (window.api_server_url) {
          console.log(`[AttachmentSender] 🔍 从window.api_server_url获取服务器地址:`, window.api_server_url);
          return window.api_server_url;
        }

        // 方法3: 默认地址（备用方案）
        const defaultUrl = 'http://127.0.0.1:8000';
        console.warn(`[AttachmentSender] ⚠️ 无法获取服务器地址，使用默认地址:`, defaultUrl);
        return defaultUrl;
        */
      } catch (error) {
        console.error(`[AttachmentSender] ❌ 获取服务器地址失败:`, error);
        return '';
      }
    }

    // 🌟 修改：解析新的图片消息格式但不渲染，只提供解析功能
    parseImageMessageFormat(messageContent) {
      try {
        console.log(`[AttachmentSender] 🔍 解析图片消息格式:`, messageContent);

        // 匹配新的消息格式：[我方消息|络络|555555|附件|图片: 760e7464a688a0bb.png]
        const imageMessageRegex = /\[我方消息\|([^|]+)\|([^|]+)\|附件\|图片:\s*([^|\]]+)\]/g;

        // 查找所有匹配的图片消息
        const matches = [...messageContent.matchAll(imageMessageRegex)];

        if (matches.length === 0) {
          console.log(`[AttachmentSender] 🔍 未找到图片消息格式`);
          return null;
        }

        const parsedImages = [];
        const serverUrl = this.getSillyTavernServerUrl();

        for (const match of matches) {
          const [fullMatch, friendName, friendId, fileName] = match;
          console.log(`[AttachmentSender] 🔍 解析到图片消息:`, {
            friendName,
            friendId,
            fileName,
            fullMatch,
          });

          // 构建图片URL
          const encodedFriendName = encodeURIComponent(friendName);

          // 🌟 处理文件名 - 可能需要查找真实的文件名
          let actualFileName = fileName.trim();

          // 如果文件名看起来像是ID（短且没有扩展名），需要查找真实文件名
          if (actualFileName.length < 20 && !actualFileName.includes('.')) {
            console.log(`[AttachmentSender] 🔍 文件名像是ID，尝试查找真实文件名...`);
            actualFileName = this.findActualImageFileName(friendName, actualFileName);
          }

          const imageUrl = `${serverUrl}/user/images/${encodedFriendName}/${actualFileName}`;

          parsedImages.push({
            fullMatch,
            friendName,
            friendId,
            fileName,
            actualFileName,
            imageUrl,
          });
        }

        return parsedImages;
      } catch (error) {
        console.error(`[AttachmentSender] ❌ 解析图片消息失败:`, error);
        return null;
      }
    }

    // 🌟 修改：使用相对路径构建图片URL，与SillyTavern保持一致
    buildImageUrl(friendName, fileName) {
      try {
        console.log(`[AttachmentSender] 🔍 构建图片URL: ${friendName}, ${fileName}`);

        // 🌟 首先尝试找到真实的文件名
        let actualFileName = fileName.trim();

        // 如果文件名看起来像是ID或很短，尝试查找真实文件名
        if (actualFileName.length < 30 && !actualFileName.includes('_')) {
          console.log(`[AttachmentSender] 🔍 文件名较短，尝试查找真实文件名...`);
          const foundFileName = this.findActualImageFileName(friendName, actualFileName);
          if (foundFileName && foundFileName !== actualFileName) {
            actualFileName = foundFileName;
            console.log(`[AttachmentSender] ✅ 使用找到的真实文件名:`, actualFileName);
          }
        }

        // 🌟 使用相对路径，与SillyTavern一致
        const relativePath = `/user/images/${friendName}/${actualFileName}`;
        console.log(`[AttachmentSender] ✅ 构建的相对路径:`, relativePath);

        return relativePath;
      } catch (error) {
        console.error(`[AttachmentSender] ❌ 构建图片URL失败:`, error);
        return `/user/images/${friendName}/${fileName}`;
      }
    }

    // 🌟 新增：改进文件名查找逻辑，从页面中的实际图片获取真实文件名
    findActualImageFileName(friendName, fileId) {
      try {
        console.log(`[AttachmentSender] 🔍 查找真实图片文件名: ${friendName}, ${fileId}`);

        // 方法1: 从页面中的图片元素获取（最可靠）
        const existingImages = document.querySelectorAll('img.mes_img, img[src*="/user/images/"]');
        console.log(`[AttachmentSender] 🔍 页面中找到${existingImages.length}个相关图片元素`);

        for (const img of existingImages) {
          const src = img.src;
          console.log(`[AttachmentSender] 🔍 检查图片:`, src);

          // 检查是否是同一个好友的图片目录
          if (
            src.includes(`/user/images/${encodeURIComponent(friendName)}/`) ||
            src.includes(`/user/images/${friendName}/`)
          ) {
            const urlParts = src.split('/');
            const fileName = urlParts[urlParts.length - 1];

            console.log(`[AttachmentSender] 🔍 找到${friendName}的图片:`, fileName);

            // 🌟 新策略：返回最近的（通常是最新的）图片文件名
            // 如果文件名包含时间戳，优先使用时间戳较大的
            if (fileName && fileName.length > 10) {
              console.log(`[AttachmentSender] ✅ 找到可能的真实文件名:`, fileName);
              return fileName;
            }
          }
        }

        // 方法2: 从SillyTavern消息数据中查找
        if (window.chat && Array.isArray(window.chat)) {
          console.log(`[AttachmentSender] 🔍 从SillyTavern聊天数据查找...`);
          for (const message of window.chat.slice(-10)) {
            // 检查最近10条消息
            if (message.extra && message.extra.image) {
              const imagePath = message.extra.image;
              console.log(`[AttachmentSender] 🔍 检查消息图片:`, imagePath);

              if (imagePath.includes(friendName)) {
                const fileName = imagePath.split('/').pop();
                console.log(`[AttachmentSender] ✅ 从聊天数据找到文件名:`, fileName);
                return fileName;
              }
            }
          }
        }

        // 方法3: 检查页面中最新的图片（按时间戳）
        const allImages = Array.from(existingImages)
          .map(img => {
            const src = img.src;
            const fileName = src.split('/').pop();
            const timestampMatch = fileName.match(/(\d{13})/); // 匹配13位时间戳
            return {
              src,
              fileName,
              timestamp: timestampMatch ? parseInt(timestampMatch[1]) : 0,
            };
          })
          .filter(
            item =>
              item.src.includes(`/user/images/${encodeURIComponent(friendName)}/`) ||
              item.src.includes(`/user/images/${friendName}/`),
          )
          .sort((a, b) => b.timestamp - a.timestamp); // 按时间戳降序排列

        if (allImages.length > 0) {
          const newestImage = allImages[0];
          console.log(`[AttachmentSender] ✅ 找到最新的图片文件:`, newestImage.fileName);
          return newestImage.fileName;
        }

        // 备用方案：使用原始文件名
        console.warn(`[AttachmentSender] ⚠️ 无法找到真实文件名，使用原始ID:`, fileId);
        return fileId.includes('.') ? fileId : `${fileId}.png`;
      } catch (error) {
        console.error(`[AttachmentSender] ❌ 查找真实文件名失败:`, error);
        return fileId.includes('.') ? fileId : `${fileId}.png`;
      }
    }

    // 处理文件选择
    async handleFileSelection(files, additionalMessages = '') {
      console.log('[AttachmentSender] 🔍 开始处理文件选择，文件数量:', files.length);
      console.log('[AttachmentSender] 🔍 附加消息:', additionalMessages);
      const results = [];

      for (const file of files) {
        console.log('[AttachmentSender] 🔍 处理文件:', {
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
        });

        const validation = this.validateFile(file);
        console.log('[AttachmentSender] 🔍 文件验证结果:', validation);

        if (!validation.isValid) {
          console.warn('[AttachmentSender] ❌ 文件验证失败:', validation.errors);
          results.push({
            file,
            success: false,
            errors: validation.errors,
          });
          continue;
        }

        // 上传文件
        console.log('[AttachmentSender] 🔍 开始上传文件...');
        const uploadResult = await this.uploadFileToSillyTavern(file);
        console.log('[AttachmentSender] 🔍 文件上传结果:', uploadResult);

        if (uploadResult.success) {
          // 发送消息
          console.log('[AttachmentSender] 🔍 开始发送附件消息...');
          const sendSuccess = await this.sendAttachmentMessage(uploadResult, additionalMessages);
          console.log('[AttachmentSender] 🔍 消息发送结果:', sendSuccess);

          results.push({
            file,
            success: sendSuccess,
            uploadResult,
            errors: sendSuccess ? [] : ['发送消息失败'],
          });
        } else {
          console.error('[AttachmentSender] ❌ 文件上传失败:', uploadResult.error);
          results.push({
            file,
            success: false,
            errors: [uploadResult.error],
          });
        }
      }

      console.log('[AttachmentSender] 🔍 所有文件处理完成，结果:', results);
      return results;
    }
  }

  // 导出到全局
  window.AttachmentSender = AttachmentSender;

  // 创建全局实例
  if (!window.attachmentSender) {
    window.attachmentSender = new AttachmentSender();
  }

  // 添加测试函数到全局，方便控制台调试
  window.testAttachmentSender = async function (testMessage = '测试附件发送功能') {
    console.log('[AttachmentSender] 🧪 开始测试发送功能...');

    if (!window.attachmentSender) {
      console.error('[AttachmentSender] ❌ attachmentSender未初始化');
      return false;
    }

    // 模拟上传结果
    const mockUploadResult = {
      success: true,
      fileUrl: 'test://mock-file-url',
      fileName: 'test-file.png',
      fileSize: 12345,
      fileType: 'image/png',
    };

    try {
      const result = await window.attachmentSender.sendToSillyTavern(testMessage, mockUploadResult);
      console.log('[AttachmentSender] 🧪 测试结果:', result);
      return result;
    } catch (error) {
      console.error('[AttachmentSender] 🧪 测试失败:', error);
      return false;
    }
  };

  // 添加环境检测函数
  window.checkAttachmentEnvironment = function () {
    console.log('[AttachmentSender] 🔍 环境检测结果:');
    console.log('  - send_textarea存在:', !!document.getElementById('send_textarea'));
    console.log('  - send_but存在:', !!document.getElementById('send_but'));
    console.log('  - window.Generate存在:', typeof window.Generate === 'function');
    console.log('  - window.messageSender存在:', !!window.messageSender);
    console.log(
      '  - window.messageSender.sendToChat存在:',
      !!(window.messageSender && typeof window.messageSender.sendToChat === 'function'),
    );
    console.log('  - window.sendMessageAsUser存在:', typeof window.sendMessageAsUser === 'function');
    console.log('  - window.attachmentSender存在:', !!window.attachmentSender);

    // 检查SillyTavern上传功能
    console.log(
      '  - window.uploadFileAttachmentToServer存在:',
      typeof window.uploadFileAttachmentToServer === 'function',
    );
    console.log('  - #file_form_input存在:', !!document.getElementById('file_form_input'));
    console.log('  - #attachFile存在:', !!document.getElementById('attachFile'));
    console.log('  - .file_attached存在:', !!document.querySelector('.file_attached'));

    // 检查元素状态
    const textarea = document.getElementById('send_textarea');
    const sendBtn = document.getElementById('send_but');

    if (textarea) {
      console.log('  - 输入框状态:', {
        disabled: textarea.disabled,
        value: textarea.value,
        placeholder: textarea.placeholder,
      });
    }

    if (sendBtn) {
      console.log('  - 发送按钮状态:', {
        disabled: sendBtn.disabled,
        classList: Array.from(sendBtn.classList),
        textContent: sendBtn.textContent,
      });
    }

    // 检查当前是否有附件
    const fileAttached = document.querySelector('.file_attached');
    if (fileAttached) {
      const fileName = fileAttached.querySelector('.file_name');
      const fileSize = fileAttached.querySelector('.file_size');
      console.log('  - 当前附件:', {
        fileName: fileName ? fileName.textContent : '未知',
        fileSize: fileSize ? fileSize.textContent : '未知',
      });
    }
  };

  // 添加上传测试函数
  window.testSillyTavernUpload = async function () {
    console.log('[AttachmentSender] 🧪 开始测试SillyTavern上传功能...');

    // 创建一个测试文件
    const testContent = 'This is a test file for attachment upload';
    const testBlob = new Blob([testContent], { type: 'text/plain' });
    const testFile = new File([testBlob], 'test-attachment.txt', { type: 'text/plain' });

    console.log('[AttachmentSender] 🧪 创建测试文件:', {
      name: testFile.name,
      size: testFile.size,
      type: testFile.type,
    });

    if (!window.attachmentSender) {
      console.error('[AttachmentSender] ❌ attachmentSender未初始化');
      return false;
    }

    try {
      const result = await window.attachmentSender.uploadFileToSillyTavern(testFile);
      console.log('[AttachmentSender] 🧪 上传测试结果:', result);
      return result;
    } catch (error) {
      console.error('[AttachmentSender] 🧪 上传测试失败:', error);
      return false;
    }
  };

  // 添加完整流程测试函数
  window.testImageMessageFlow = async function () {
    console.log('[AttachmentSender] 🧪 开始测试完整图片消息流程...');

    // 创建一个测试图片文件
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(0, 0, 100, 100);
    ctx.fillStyle = '#fff';
    ctx.font = '16px Arial';
    ctx.fillText('TEST', 30, 55);

    // 转换为blob
    return new Promise(resolve => {
      canvas.toBlob(async blob => {
        const testFile = new File([blob], 'test-image.png', { type: 'image/png' });

        console.log('[AttachmentSender] 🧪 创建测试图片文件:', {
          name: testFile.name,
          size: testFile.size,
          type: testFile.type,
        });

        if (!window.attachmentSender) {
          console.error('[AttachmentSender] ❌ attachmentSender未初始化');
          resolve(false);
          return;
        }

        // 设置测试聊天对象
        window.attachmentSender.setCurrentChat('test123', '测试好友', false);

        try {
          const results = await window.attachmentSender.handleFileSelection([testFile]);
          console.log('[AttachmentSender] 🧪 完整流程测试结果:', results);
          resolve(results);
        } catch (error) {
          console.error('[AttachmentSender] 🧪 完整流程测试失败:', error);
          resolve(false);
        }
      }, 'image/png');
    });
  };

  console.log('[AttachmentSender] 附件发送器模块加载完成');
  // 添加SillyTavern消息检查函数
  window.checkSillyTavernMessages = function () {
    console.log('[AttachmentSender] 🔍 检查SillyTavern消息数据结构...');

    // 检查window.chat
    if (window.chat) {
      console.log('[AttachmentSender] 🔍 window.chat存在，类型:', typeof window.chat);
      console.log('[AttachmentSender] 🔍 window.chat是数组:', Array.isArray(window.chat));
      if (Array.isArray(window.chat)) {
        console.log('[AttachmentSender] 🔍 window.chat长度:', window.chat.length);
        if (window.chat.length > 0) {
          const lastMessage = window.chat[window.chat.length - 1];
          console.log('[AttachmentSender] 🔍 最后一条消息:', lastMessage);
          console.log('[AttachmentSender] 🔍 最后一条消息的extra:', lastMessage.extra);
          if (lastMessage.extra) {
            console.log('[AttachmentSender] 🔍 extra.image:', lastMessage.extra.image);
            console.log('[AttachmentSender] 🔍 extra.file:', lastMessage.extra.file);
          }
        }
      }
    } else {
      console.log('[AttachmentSender] ⚠️ window.chat不存在');
    }

    // 检查其他可能的数据源
    console.log('[AttachmentSender] 🔍 其他数据源:');
    console.log('  - window.context:', !!window.context);
    console.log('  - window.context.chat:', !!(window.context && window.context.chat));

    // 检查DOM中的消息元素
    const chatMessages = document.querySelectorAll('#chat .mes');
    console.log('[AttachmentSender] 🔍 DOM中的消息元素数量:', chatMessages.length);

    if (chatMessages.length > 0) {
      const lastMsgElement = chatMessages[chatMessages.length - 1];
      console.log('[AttachmentSender] 🔍 最后一个消息DOM元素:', lastMsgElement);

      // 检查是否有图片元素
      const imgElements = lastMsgElement.querySelectorAll('img');
      console.log('[AttachmentSender] 🔍 最后消息中的图片元素数量:', imgElements.length);
      if (imgElements.length > 0) {
        imgElements.forEach((img, index) => {
          console.log(`[AttachmentSender] 🔍 图片${index + 1}:`, {
            src: img.src,
            alt: img.alt,
            className: img.className,
          });
        });
      }
    }
  };

  console.log('[AttachmentSender] 💡 可用的测试命令:');
  console.log('  - checkAttachmentEnvironment() - 检查环境状态');
  console.log('  - testAttachmentSender("测试消息") - 测试发送功能');
  console.log('  - testSillyTavernUpload() - 测试SillyTavern上传功能');
  console.log('  - testImageMessageFlow() - 测试完整图片消息流程');
  console.log('  - checkSillyTavernMessages() - 检查SillyTavern消息数据结构');
  console.log('  - testImageMessageParsing() - 测试新的图片消息解析功能');

  // 🌟 新增：测试新的图片消息解析功能
  window.testImageMessageParsing = function (testMessage = '[我方消息|络络|555555|附件|图片: 760e7464a688a0bb.png]') {
    console.log('[AttachmentSender] 🧪 开始测试图片消息解析功能...');

    if (!window.attachmentSender) {
      console.error('[AttachmentSender] ❌ attachmentSender未初始化');
      return false;
    }

    try {
      console.log('[AttachmentSender] 🧪 测试输入:', testMessage);

      // 测试解析功能
      const result = window.attachmentSender.parseImageMessageFormat(testMessage);
      console.log('[AttachmentSender] 🧪 解析结果:', result);

      // 测试服务器地址获取
      const serverUrl = window.attachmentSender.getSillyTavernServerUrl();
      console.log('[AttachmentSender] 🧪 服务器地址:', serverUrl);

      // 测试图片URL构建
      const imageUrl = window.attachmentSender.buildImageUrl('络络', '-_3.png');
      console.log('[AttachmentSender] 🧪 构建的图片URL:', imageUrl);

      return {
        success: true,
        originalMessage: testMessage,
        parsedResult: result,
        serverUrl: serverUrl,
        imageUrl: imageUrl,
      };
    } catch (error) {
      console.error('[AttachmentSender] 🧪 测试失败:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  };

  // 🌟 新增：批量测试多种图片消息格式
  window.testMultipleImageFormats = function () {
    console.log('[AttachmentSender] 🧪 开始批量测试多种图片消息格式...');

    const testCases = [
      '[我方消息|络络|555555|附件|图片: 760e7464a688a0bb.png]',
      '[我方消息|Alice|123456|附件|图片: image123.jpg]',
      '[我方消息|测试用户|999999|附件|图片: test_image_2024.png]',
      '这是一段包含多个图片的文本 [我方消息|用户1|111|附件|图片: pic1.png] 以及 [我方消息|用户2|222|附件|图片: pic2.jpg] 的消息',
    ];

    const results = [];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`[AttachmentSender] 🧪 测试用例 ${i + 1}:`, testCase);

      const result = window.testImageMessageParsing(testCase);
      results.push({
        testCase: i + 1,
        input: testCase,
        result: result,
      });
    }

    console.log('[AttachmentSender] 🧪 批量测试完成，结果:', results);
    return results;
  };
})(window);
