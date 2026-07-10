/**
 * CupGIS - 滚动控制器
 * 计算页面滚动进度 → 更新进度条 → 通知 3D 场景与模块高亮
 */
export class ScrollController {
  constructor(onProgressChange, onModuleChange) {
    this.onProgressChange = onProgressChange;
    this.onModuleChange = onModuleChange;
    this.progress = 0;
    this.activeModuleIndex = -1;
    this.moduleCount = 0;
    this._ticking = false;

    this._init();
  }

  _init() {
    window.addEventListener('scroll', this._onScroll.bind(this), { passive: true });
    window.addEventListener('resize', this._recalculate.bind(this));
    this._recalculate();
  }

  _onScroll() {
    if (this._ticking) return;
    this._ticking = true;
    requestAnimationFrame(() => {
      this._recalculate();
      this._ticking = false;
    });
  }

  _recalculate() {
    // 动态读取模块数量
    if (!this.moduleCount) {
      this.moduleCount = document.querySelectorAll('.module').length || 6;
    }

    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollTop = window.scrollY || window.pageYOffset;
    this.progress = scrollHeight > 0 ? Math.min(1, scrollTop / scrollHeight) : 0;

    // 按进度推断当前模块索引（首屏 hero 占前段）
    const heroEnd = 0.08;
    const moduleSpan = (1 - heroEnd) / this.moduleCount;
    let moduleIdx = -1;
    if (this.progress > heroEnd) {
      moduleIdx = Math.min(this.moduleCount - 1, Math.floor((this.progress - heroEnd) / moduleSpan));
    }

    // 更新进度条
    const progressBar = document.getElementById('scrollProgress');
    if (progressBar) progressBar.style.transform = `scaleX(${this.progress})`;

    // 通知 3D 进度
    if (this.onProgressChange) this.onProgressChange(this.progress);

    // 模块切换通知
    if (moduleIdx !== this.activeModuleIndex) {
      this.activeModuleIndex = moduleIdx;
      if (this.onModuleChange) this.onModuleChange(moduleIdx);
    }
  }

  getProgress() { return this.progress; }
  getActiveModule() { return this.activeModuleIndex; }
}
