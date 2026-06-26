/**
 * CupGIS - Scroll Controller
 * Maps page scroll to animation progress and active module index
 * Handles smooth scrolling, progress bar, and scroll-based reveals
 */
export class ScrollController {
  constructor(onProgressChange, onModuleChange) {
    this.onProgressChange = onProgressChange;
    this.onModuleChange = onModuleChange;
    this.progress = 0;
    this.activeModuleIndex = -1;
    this._ticking = false;

    this._init();
  }

  _init() {
    // Scroll event with passive listener for performance
    window.addEventListener('scroll', this._onScroll.bind(this), { passive: true });

    // Also handle wheel events for smoother tracking
    window.addEventListener('resize', this._recalculate.bind(this));

    this._recalculate();
  }

  _onScroll() {
    if (!this._ticking) {
      this._ticking = true;
      requestAnimationFrame(() => {
        this._recalculate();
        this._ticking = false;
      });
    }
  }

  _recalculate() {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollTop = window.scrollY || window.pageYOffset;
    this.progress = scrollHeight > 0 ? Math.min(1, scrollTop / scrollHeight) : 0;

    // Determine active module based on progress
    const heroEnd = 0.08;
    const moduleSpan = (1 - heroEnd) / 6;
    let moduleIdx = -1;

    if (this.progress > heroEnd) {
      moduleIdx = Math.min(5, Math.floor((this.progress - heroEnd) / moduleSpan));
    }

    // Update scroll progress bar
    const progressBar = document.getElementById('scrollProgress');
    if (progressBar) {
      progressBar.style.transform = `scaleX(${this.progress})`;
    }

    // Notify changes
    if (this.onProgressChange) {
      this.onProgressChange(this.progress);
    }

    if (moduleIdx !== this.activeModuleIndex) {
      this.activeModuleIndex = moduleIdx;
      if (this.onModuleChange) {
        this.onModuleChange(moduleIdx);
      }
    }
  }

  getProgress() {
    return this.progress;
  }

  getActiveModule() {
    return this.activeModuleIndex;
  }

  // Smooth scroll to a specific module section
  scrollToModule(moduleId) {
    const section = document.getElementById(moduleId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}
