/**
 * 【重构日志：Message App 2.0 - 社交叙事中枢】
 * * 🚩 核心转变：
 * 1. [数据解耦]：废弃“扫描正文”模式，全面转向“phone_data.json 注入”模式。秒开，零延迟。
 * 2. [模式三合一]：
 * - 【托管模式】：监听小飞机图标 (✈️/⏹️)，正文结束后静默生成衍生对话。
 * - 【主动模式】：通过手机“下拉通知栏/灵动岛”触发，手动抓取 <content> 生成即时短讯。
 * - 【导演模式】：手机端专用隐藏输入框，输入指令直接生成“事件盒子”（Archives）。
 * 3. [卡片档案馆]：
 * - 引入“盒子”概念。导演生成的长篇剧情、或手动收藏的精彩对话，打包成带 Header 的精美卡片。
 * - 支持左右滑屏切换场景（如：出差 7 天的连续记录）。
 * 4. [反向注入]：
 * - 支持将“消息盒子”摘要后，一键生成符合格式的世界书（World Info）条目。
 * * 🎨 视觉遗产继承：
 * - 沿用 1.0 版本的正则解析逻辑 (红包/表情包/语音/通话)。
 * - 优化消息渲染流：采用 type-based 渲染，拒绝文字二次跳变。
 */

/**
 * WeChat Component Dispatcher (消息组件分发中心)
 * 作用：识别 type 并直接返回对应的 HTML 片段
 */

const WeChatComponents = {
    // 1. 文本消息 (默认)
    text: (data) => `<div class="msg-bubble text">${data.content}</div>`,

    // 2. 红包消息 (占位)
    red_packet: (data) => {
        // 这里的 HTML 结构直接引用你旧脚本里红包的 CSS 类名
        return `<div class="msg-bubble red-packet">
                    <div class="rp-top">🧧 ${data.memo || '恭喜发财'}</div>
                    <div class="rp-bottom">微信红包</div>
                </div>`;
    },

    // 3. 语音消息 (占位)
    voice: (data) => `<div class="msg-bubble voice">🔊 ${data.duration}"</div>`,

    // 4. 图片消息 (占位)
    image: (data) => `<div class="msg-bubble image"><img src="${data.url}"></div>`,

    // 5. 视频/通话 (占位)
    call: (data) => `<div class="msg-bubble call">📞 通话时长 ${data.duration}</div>`,

    // 6. 事件卡片 (也就是你说的“消息盒子”)
    event_card: (data) => {
        return `<div class="event-mailbox-card">
                    <div class="card-header">${data.time} | ${data.scene}</div>
                    <div class="card-body">${data.summary}</div>
                </div>`;
    }
};
