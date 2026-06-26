/**
 * CupGIS - Main Entry Point
 * ES module orchestrator: initializes 3D scene, scroll controller, i18n, modules
 * Handles loading screen, UI interactions, and coordinate between components
 */
import { SceneManager } from './scene/manager.js';
import { ScrollController } from './scroll.js';
import { applyTranslations, toggleLanguage, getCurrentLang } from './i18n.js';
import { fetchConfig, renderModules, getModuleOrbitConfigs } from './modules.js';

class CupGISApp {
  constructor() {
    this.sceneManager = null;
    this.scrollController = null;
    this.loadingScreen = null;
    this.loadingBar = null;
    this.loadingText = null;
    this.navToggle = null;
    this.langToggle = null;
  }

  async init() {
    // Get loading screen elements
    this.loadingScreen = document.getElementById('loadingScreen');
    this.loadingBar = document.getElementById('loadingBar');
    this.loadingText = document.getElementById('loadingText');
    this.loadingPercent = document.getElementById('loadingPercent');

    // Setup UI interactions immediately
    this._setupNav();
    this._setupLangToggle();
    this._setupSmoothScroll();

    // Initialize i18n
    applyTranslations(getCurrentLang());

    // Load module config
    this._updateLoading(0, 'loading.scene');
    await fetchConfig();

    // Render modules into DOM
    renderModules();

    // Listen for language changes to re-render modules
    window.addEventListener('languagechange', () => renderModules());

    // Get module orbit configs for satellites
    const orbitConfigs = getModuleOrbitConfigs();

    // Initialize Three.js scene
    const canvas = document.getElementById('threeCanvas');
    this.sceneManager = new SceneManager(canvas);

    try {
      await this.sceneManager.init(orbitConfigs, (progress) => {
        this._updateLoading(progress);
      });
    } catch (err) {
      console.error('CupGIS: Scene initialization failed:', err);
      this._showError();
      return;
    }

    // Initialize scroll controller
    this.scrollController = new ScrollController(
      (progress) => this.sceneManager.setScrollProgress(progress),
      (moduleIdx) => {
        this.sceneManager.setActiveModule(moduleIdx);
        this._updateModuleHighlight(moduleIdx);
      }
    );

    // Hide loading screen
    this._hideLoading();
  }

  _updateLoading(progress, textKey) {
    if (this.loadingBar) {
      this.loadingBar.style.width = `${Math.round(progress * 100)}%`;
    }
    if (this.loadingPercent) {
      this.loadingPercent.textContent = `${Math.round(progress * 100)}%`;
    }
    if (textKey && this.loadingText) {
      const text = this._getLoadingText(textKey, progress);
      this.loadingText.textContent = text;
    }
  }

  _getLoadingText(key, progress) {
    if (progress < 0.05) return '构建3D场景... / Building 3D scene...';
    if (progress < 0.75) return '加载地球纹理... / Loading Earth textures...';
    if (progress < 0.85) return '部署卫星编队... / Deploying satellites...';
    if (progress < 1) return '系统就绪 / System ready...';
    return '';
  }

  _hideLoading() {
    if (this.loadingScreen) {
      this.loadingScreen.classList.add('fade-out');
      setTimeout(() => {
        this.loadingScreen.style.display = 'none';
      }, 800);
    }
  }

  _showError() {
    if (this.loadingText) {
      this.loadingText.textContent = '加载失败，请刷新页面 / Load failed, please refresh';
      this.loadingText.style.color = '#e63946';
    }
    if (this.loadingBar) {
      this.loadingBar.style.background = '#e63946';
    }
  }

  _setupNav() {
    this.navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');

    if (this.navToggle && navLinks) {
      this.navToggle.addEventListener('click', () => {
        const isOpen = navLinks.classList.toggle('open');
        this.navToggle.classList.toggle('open');
        this.navToggle.setAttribute('aria-expanded', isOpen);
      });

      // Close nav on link click
      navLinks.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
          navLinks.classList.remove('open');
          this.navToggle.classList.remove('open');
          this.navToggle.setAttribute('aria-expanded', 'false');
        });
      });
    }
  }

  _setupLangToggle() {
    this.langToggle = document.getElementById('langToggle');
    if (this.langToggle) {
      this.langToggle.addEventListener('click', () => toggleLanguage());
    }
  }

  _setupSmoothScroll() {
    // All anchor links scroll smoothly
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(anchor.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    });
  }

  _updateModuleHighlight(index) {
    const sections = document.querySelectorAll('.module-section');
    sections.forEach((section, i) => {
      if (i === index) {
        section.classList.add('active-module');
      } else {
        section.classList.remove('active-module');
      }
    });
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new CupGISApp().init());
} else {
  new CupGISApp().init();
}
