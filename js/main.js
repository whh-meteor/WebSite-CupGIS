/**
 * CupGIS - 主入口
 * 编排：加载屏幕 → i18n → 配置 → 模块渲染 → 首屏 3D 场景 → 滚动状态 → 语言切换
 */
import { SceneManager } from './scene/manager.js';
import { ScrollController } from './scroll.js';
import { applyTranslations, toggleLanguage, getCurrentLang } from './i18n.js';
import { fetchConfig, renderModules, getModuleOrbitConfigs } from './modules.js';

class CupGISApp {
  constructor() {
    this.sceneManager = null;
    this.scrollController = null;
    this.loader = null;
    this.loaderFill = null;
    this.loaderPercent = null;
    this.loaderText = null;
    this.nav = null;
    this.navToggle = null;
    this.threeCanvas = null;
    this.dotsNav = null;
  }

  async init() {
    // 获取加载屏元素
    this.loader = document.getElementById('loader');
    this.loaderFill = document.getElementById('loaderFill');
    this.loaderPercent = document.getElementById('loaderPercent');
    this.loaderText = document.getElementById('loaderText');

    // 立即绑定 UI 交互
    this._setupNav();
    this._setupLangToggle();
    this._setupSmoothScroll();
    this._setupScrollStates();

    // 初始化 i18n
    applyTranslations(getCurrentLang());

    // 加载模块配置并渲染
    this._updateLoading(0.02, 'loading.scene');
    await fetchConfig();
    renderModules();
    // 语言切换时重新渲染模块
    window.addEventListener('languagechange', () => renderModules());

    // 取模块轨道参数（供首屏 3D 卫星）
    const orbitConfigs = getModuleOrbitConfigs();

    // 初始化 Three.js 首屏场景
    this.threeCanvas = document.getElementById('threeCanvas');
    this.sceneManager = new SceneManager(this.threeCanvas);

    try {
      await this.sceneManager.init(orbitConfigs, (progress) => {
        this._updateLoading(progress);
      });
    } catch (err) {
      console.error('CupGIS: 3D 场景初始化失败:', err);
      this._showError();
      // 3D 失败也不阻塞页面，隐藏画布继续展示模块
      this._hideLoading();
      return;
    }

    // 初始化滚动控制器（进度条 + 3D 卫星高亮）
    this.scrollController = new ScrollController(
      (progress) => this.sceneManager.setScrollProgress(progress),
      (moduleIdx) => this.sceneManager.setActiveModule(moduleIdx)
    );

    this._hideLoading();
  }

  /** 更新加载进度 */
  _updateLoading(progress, textKey) {
    const pct = Math.round(progress * 100);
    if (this.loaderFill) this.loaderFill.style.width = `${pct}%`;
    if (this.loaderPercent) this.loaderPercent.textContent = `${pct}%`;
    if (textKey && this.loaderText) {
      // 根据 progress 选择阶段性文案
      let key = textKey;
      if (progress >= 0.05 && progress < 0.75) key = 'loading.earth';
      else if (progress >= 0.75 && progress < 0.9) key = 'loading.satellites';
      else if (progress >= 0.9) key = 'loading.ready';
      this.loaderText.textContent = this._t(key);
    }
  }

  _t(key) {
    const lang = getCurrentLang();
    const dict = {
      zh: {
        'loading.scene': '构建 3D 场景',
        'loading.earth': '加载地球纹理',
        'loading.satellites': '部署卫星编队',
        'loading.ready': '系统就绪',
        'loading.failed': '加载失败，请刷新页面',
      },
      en: {
        'loading.scene': 'Building 3D scene',
        'loading.earth': 'Loading Earth textures',
        'loading.satellites': 'Deploying satellites',
        'loading.ready': 'System ready',
        'loading.failed': 'Load failed, please refresh',
      },
    };
    return (dict[lang] && dict[lang][key]) || key;
  }

  _hideLoading() {
    if (this.loader) {
      this.loader.classList.add('fade-out');
      setTimeout(() => { if (this.loader) this.loader.style.display = 'none'; }, 700);
    }
  }

  _showError() {
    if (this.loaderText) {
      this.loaderText.textContent = this._t('loading.failed');
      this.loaderText.style.color = '#e63946';
    }
    if (this.loaderFill) this.loaderFill.style.background = '#e63946';
  }

  /** 导航：移动端菜单 + 滚动收缩 */
  _setupNav() {
    this.nav = document.getElementById('nav');
    this.navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');

    if (this.navToggle && navLinks) {
      this.navToggle.addEventListener('click', () => {
        const isOpen = navLinks.classList.toggle('open');
        this.navToggle.classList.toggle('open');
        this.navToggle.setAttribute('aria-expanded', isOpen);
      });
      // 点击链接后关闭菜单
      navLinks.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
          navLinks.classList.remove('open');
          this.navToggle.classList.remove('open');
          this.navToggle.setAttribute('aria-expanded', 'false');
        });
      });
    }
  }

  /** 语言切换 */
  _setupLangToggle() {
    const langToggle = document.getElementById('langToggle');
    if (langToggle) langToggle.addEventListener('click', () => toggleLanguage());
  }

  /** 平滑滚动锚点 */
  _setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        const href = anchor.getAttribute('href');
        if (href === '#' || href.length < 2) return;
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  /** 滚动状态：导航玻璃态 / 首屏 3D 淡出 / 侧边导航点显隐 */
  _setupScrollStates() {
    this.dotsNav = document.getElementById('dotsNav');
    const nav = this.nav;
    const canvas = document.getElementById('threeCanvas');
    const heroEnd = window.innerHeight * 0.65; // 滚过首屏 65% 即淡出 3D

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY || window.pageYOffset;
        // 导航玻璃态
        if (nav) nav.classList.toggle('scrolled', y > 40);
        // 首屏 3D 淡出 + 侧边点显隐
        const pastHero = y > heroEnd;
        if (canvas) canvas.classList.toggle('fade-out', pastHero);
        if (this.dotsNav) this.dotsNav.classList.toggle('visible', pastHero);
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
}

// DOM 就绪后启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new CupGISApp().init());
} else {
  new CupGISApp().init();
}
