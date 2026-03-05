// 【施工标记】保留：物理引擎，用于手机图标拖拽及未来背包物品交互。
/**
 * 通用拖拽辅助插件
 * 支持PC端和移动端的拖拽功能
 * 确保不影响原有的点击事件
 */

class DragHelper {
  constructor(element, options = {}) {
    this.element = element;
    this.options = {
      boundary: document.body, // 拖拽边界
      clickThreshold: 5, // 移动距离阈值，小于此值视为点击
      dragClass: 'dragging', // 拖拽时添加的CSS类
      savePosition: true, // 是否保存位置
      storageKey: 'drag-position', // localStorage键名
      touchTimeout: 200, // 触摸超时时间（毫秒），超过此时间且未移动则视为长按开始拖拽
      dragHandle: null, // 拖拽手柄选择器，如果指定则只有该元素可以拖拽
      ...options
    };

    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;
    this.startElementX = 0;
    this.startElementY = 0;
    this.moved = false;
    this.startTime = 0;
    this.touchTimer = null;

    this.init();
  }

  init() {
    // 设置元素为可拖拽
    this.element.style.position = 'absolute';
    this.element.style.cursor = 'move';
    this.element.style.userSelect = 'none';
    this.element.style.webkitUserSelect = 'none';
    this.element.style.mozUserSelect = 'none';
    this.element.style.msUserSelect = 'none';

    // 加载保存的位置
    if (this.options.savePosition) {
      this.loadPosition();
    }

    // 绑定事件
    this.bindEvents();
  }

    bindEvents() {
    // 确定事件绑定的目标元素
    const eventTarget = this.options.dragHandle ?
      this.element.querySelector(this.options.dragHandle) : this.element;

    if (!eventTarget) {
      console.warn('DragHelper: 拖拽手柄元素未找到:', this.options.dragHandle);
      return;
    }

    // PC端事件
    eventTarget.addEventListener('mousedown', this.handleStart.bind(this), { passive: false });
    document.addEventListener('mousemove', this.handleMove.bind(this), { passive: false });
    document.addEventListener('mouseup', this.handleEnd.bind(this), { passive: false });

    // 移动端事件
    eventTarget.addEventListener('touchstart', this.handleStart.bind(this), { passive: false });
    document.addEventListener('touchmove', this.handleMove.bind(this), { passive: false });
    document.addEventListener('touchend', this.handleEnd.bind(this), { passive: false });

    // 防止拖拽时的默认行为
    eventTarget.addEventListener('dragstart', (e) => e.preventDefault());

    // 保存事件目标以便后续销毁
    this.eventTarget = eventTarget;
  }

        handleStart(e) {
    // 如果指定了拖拽手柄，检查是否在手柄上开始拖拽
    if (this.options.dragHandle) {
      const handleElement = this.element.querySelector(this.options.dragHandle);
      if (handleElement && !handleElement.contains(e.target)) {
        return; // 不在拖拽手柄上，忽略事件
      }
    }

    const event = e.type.startsWith('touch') ? e.touches[0] : e;

    this.isDragging = true;
    this.moved = false;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.startTime = Date.now();

    const rect = this.element.getBoundingClientRect();
    this.startElementX = rect.left;
    this.startElementY = rect.top;

    // 清除之前的定时器
    if (this.touchTimer) {
      clearTimeout(this.touchTimer);
      this.touchTimer = null;
    }

    // 只对PC端鼠标事件立即开始拖拽
    if (e.type === 'mousedown') {
      e.preventDefault();
      this.element.classList.add(this.options.dragClass);
      this.element.style.zIndex = '9999';
    } else if (e.type === 'touchstart') {
      // 触摸事件延迟处理，给点击事件一个机会
      this.touchTimer = setTimeout(() => {
        if (this.isDragging && !this.moved) {
          this.element.classList.add(this.options.dragClass);
          this.element.style.zIndex = '9999';
        }
      }, this.options.touchTimeout);
    }
  }

    handleMove(e) {
    if (!this.isDragging) return;

    const event = e.type.startsWith('touch') ? e.touches[0] : e;

    const deltaX = event.clientX - this.startX;
    const deltaY = event.clientY - this.startY;

    // 检查是否移动超过阈值
    if (!this.moved && (Math.abs(deltaX) > this.options.clickThreshold || Math.abs(deltaY) > this.options.clickThreshold)) {
      this.moved = true;
      // 确认开始拖拽，添加视觉反馈并阻止默认行为
      e.preventDefault();
      this.element.classList.add(this.options.dragClass);
      this.element.style.zIndex = '9999';

      // 清除触摸定时器
      if (this.touchTimer) {
        clearTimeout(this.touchTimer);
        this.touchTimer = null;
      }
    }

    if (this.moved) {
      // 继续阻止默认行为以避免滚动等干扰
      e.preventDefault();

      const newX = this.startElementX + deltaX;
      const newY = this.startElementY + deltaY;

      // 边界检查
      const boundedPosition = this.constrainToBoundary(newX, newY);

      this.element.style.left = boundedPosition.x + 'px';
      this.element.style.top = boundedPosition.y + 'px';
    }
  }

  handleEnd(e) {
    if (!this.isDragging) return;

    // 清除触摸定时器
    if (this.touchTimer) {
      clearTimeout(this.touchTimer);
      this.touchTimer = null;
    }

    this.isDragging = false;
    this.element.classList.remove(this.options.dragClass);

    // 如果没有移动超过阈值，不阻止点击事件
    if (!this.moved) {
      this.element.style.zIndex = ''; // 恢复原始z-index
      // 对于触摸事件，如果时间很短且没有移动，确保点击事件能正常触发
      if (e.type === 'touchend') {
        const touchDuration = Date.now() - this.startTime;
        if (touchDuration < this.options.touchTimeout) {
          // 短触摸，让点击事件正常执行
          return;
        }
      }
      return;
    }

    // 保存位置
    if (this.options.savePosition && this.moved) {
      this.savePosition();
    }

    // 延迟恢复z-index，确保拖拽动画完成
    setTimeout(() => {
      this.element.style.zIndex = '';
    }, 100);

    // 如果移动了，阻止后续的点击事件
    if (this.moved) {
      const preventClick = (event) => {
        event.stopPropagation();
        event.preventDefault();
        this.element.removeEventListener('click', preventClick, true);
      };
      this.element.addEventListener('click', preventClick, true);
    }
  }

  constrainToBoundary(x, y) {
    const boundary = this.options.boundary;
    const elementRect = this.element.getBoundingClientRect();
    const boundaryRect = boundary.getBoundingClientRect();

    // 计算边界
    const minX = boundaryRect.left;
    const minY = boundaryRect.top;
    const maxX = boundaryRect.right - elementRect.width;
    const maxY = boundaryRect.bottom - elementRect.height;

    return {
      x: Math.max(minX, Math.min(maxX, x)),
      y: Math.max(minY, Math.min(maxY, y))
    };
  }

  savePosition() {
    if (!this.options.savePosition) return;

    const rect = this.element.getBoundingClientRect();
    const position = {
      left: rect.left,
      top: rect.top
    };

    try {
      localStorage.setItem(this.options.storageKey, JSON.stringify(position));
    } catch (error) {
      console.warn('无法保存拖拽位置:', error);
    }
  }

  loadPosition() {
    if (!this.options.savePosition) return;

    try {
      const saved = localStorage.getItem(this.options.storageKey);
      if (saved) {
        const position = JSON.parse(saved);

        // 验证位置是否仍然有效
        const boundedPosition = this.constrainToBoundary(position.left, position.top);

        this.element.style.left = boundedPosition.x + 'px';
        this.element.style.top = boundedPosition.y + 'px';
      }
    } catch (error) {
      console.warn('无法加载拖拽位置:', error);
    }
  }

      // 销毁拖拽功能
  destroy() {
    // 清除定时器
    if (this.touchTimer) {
      clearTimeout(this.touchTimer);
      this.touchTimer = null;
    }

    // 使用保存的事件目标进行清理
    const target = this.eventTarget || this.element;

    target.removeEventListener('mousedown', this.handleStart);
    document.removeEventListener('mousemove', this.handleMove);
    document.removeEventListener('mouseup', this.handleEnd);

    target.removeEventListener('touchstart', this.handleStart);
    document.removeEventListener('touchmove', this.handleMove);
    document.removeEventListener('touchend', this.handleEnd);

    target.removeEventListener('dragstart', (e) => e.preventDefault());

    this.element.style.cursor = '';
    this.element.classList.remove(this.options.dragClass);
    this.element.style.zIndex = '';

    this.eventTarget = null;
  }

  // 静态方法：为元素快速添加拖拽功能
  static makeDraggable(element, options = {}) {
    return new DragHelper(element, options);
  }
}

// 导出到全局作用域
window.DragHelper = DragHelper;
