/**
 * Fanfic App - 同人网
 */
class FanficApp {
    constructor() {
        this.initStyles(); // 第一步：先把皮肤刷上
        this.render();     // 第二步：渲染页面
    }

    // 🎨 把样式集成在 JS 内部
    initStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .fanfic-container { background: #f4f1ea; color: #2a2a2a; }
            .tag-red { color: #900; font-weight: bold; }
            /* 这里放原本需要写在 .css 文件里的所有内容 */
        `;
        document.head.appendChild(style);
    }
    
    // ... 逻辑代码 ...
}
