// SillyTavern 手机容器入口。
// 业务 App 均由手机壳从独立服务器按需加载；GitHub 仓库只负责启动容器。
(function bootstrapMobileContainer() {
  'use strict';

  if (window.__mobileContainerBootstrapped) return;
  window.__mobileContainerBootstrapped = true;

  const BASE = './scripts/extensions/third-party/mobile';

  function loadStyle(name) {
    const href = `${BASE}/${name}`;
    const existing = document.querySelector(`link[data-mobile-entry="${name}"]`);
    if (existing) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.mobileEntry = name;
    link.onerror = () => console.warn(`[Mobile Entry] 样式加载失败，容器脚本继续启动: ${href}`);
    document.head.appendChild(link);
  }

  function loadScript(name, attempts = 3) {
    const src = `${BASE}/${name}`;

    const run = attempt => new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-mobile-entry="${name}"]`);
      if (existing?.dataset.loaded === 'true') return resolve();
      if (existing) existing.remove();

      const script = document.createElement('script');
      const timer = setTimeout(() => {
        script.remove();
        reject(new Error(`脚本加载超时: ${src}`));
      }, 15000);

      script.src = src;
      script.dataset.mobileEntry = name;
      script.onload = () => {
        clearTimeout(timer);
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = () => {
        clearTimeout(timer);
        script.remove();
        reject(new Error(`脚本加载失败: ${src}`));
      };
      document.head.appendChild(script);
    }).catch(error => {
      if (attempt >= attempts) throw error;
      return new Promise(resolve => setTimeout(resolve, 500 * (2 ** (attempt - 1))))
        .then(() => run(attempt + 1));
    });

    return run(1);
  }

  // 样式表与脚本并行启动。移动端 WebView 偶尔不会为动态 link 触发 load，
  // 入口不能因此永远卡住，导致手机缩略图必须刷新数次才出现。
  loadStyle('mobile-phone.css');
  loadStyle('drag-helper.css');

  loadScript('drag-helper.js')
    .then(() => loadScript('mobile-phone.js'))
    .then(() => console.log('[Mobile Entry] 手机容器启动完成'))
    .catch(error => {
      window.__mobileContainerBootstrapped = false;
      console.error('[Mobile Entry] 手机容器启动失败', error);
    });
})();
