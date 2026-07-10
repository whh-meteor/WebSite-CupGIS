/**
 * CupGIS - 模块加载与渲染
 * ES module：拉取配置 → 渲染 6 大模块（深浅交替半屏）+ 子项卡片网格 + 侧边导航点
 */
import { getCurrentLang, t } from './i18n.js';

let moduleData = null;

// 各模块类型对应的 SVG 图标（线性极简风）
const icons = {
  database: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
  tools: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
  grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  layers: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  blog: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
  compass: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
};

/**
 * 拉取模块配置
 */
export async function fetchConfig() {
  try {
    const response = await fetch("config/modules.json");
    if (!response.ok) throw new Error("Failed to load config");
    moduleData = await response.json();
    return moduleData;
  } catch (err) {
    console.error("CupGIS: 配置加载失败:", err);
    return null;
  }
}

/**
 * 取模块轨道参数（供首屏 3D 卫星使用）
 */
export function getModuleOrbitConfigs() {
  if (!moduleData) return [];
  return moduleData.modules.map((mod) => ({
    id: mod.id,
    icon: mod.icon,
    color: '#e63946',
    title: mod.title,
    radius: mod.orbit?.radius || 1.5,
    inclination: mod.orbit?.inclination || 45,
    speed: mod.orbit?.speed || 0.2,
    startAngle: mod.orbit?.startAngle || 0,
  }));
}

/**
 * 渲染所有模块区块 + 侧边导航点
 */
export function renderModules() {
  if (!moduleData) return;

  const container = document.getElementById("moduleSections");
  const dotsNav = document.getElementById("dotsNav");
  if (!container) return;

  const lang = getCurrentLang();

  // 渲染模块区块
  const html = moduleData.modules.map((mod, index) => {
    const themeClass = mod.theme === 'light' ? 'module--light' : 'module--dark';
    const reverseClass = index % 2 === 1 ? 'module--reverse' : '';
    const iconSvg = icons[mod.icon] || icons.compass;
    const title = mod.title[lang] || mod.title.zh;
    const subtitle = mod.subtitle[lang] || mod.subtitle.zh;
    const description = mod.description[lang] || mod.description.zh;
    const num = String(index + 1).padStart(2, '0');
    const itemsLabel = t("module.itemsLabel");

    // 子项卡片网格
    const itemsHtml = (mod.items || []).map((item) => {
      const name = item.name[lang] || item.name.zh;
      const desc = item.desc[lang] || item.desc.zh;
      const tag = item.tag[lang] || item.tag.zh;
      const isExternal = /^https?:/i.test(item.url) || item.url.startsWith('mailto:');
      return `
        <a class="item-card" href="${item.url}" ${isExternal ? 'target="_blank" rel="noopener"' : ''}>
          <div class="item-top">
            <span class="item-tag">${tag}</span>
            <span class="item-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
            </span>
          </div>
          <div class="item-name">${name}</div>
          <div class="item-desc">${desc}</div>
        </a>
      `;
    }).join("");

    return `
      <section class="module ${themeClass} ${reverseClass}" id="${mod.id}" data-module-index="${index}" data-num="${num}">
        <div class="module-grid">
          <div class="module-aside">
            <div class="module-head">
              <span class="module-index">${num}</span>
              <span class="module-icon">${iconSvg}</span>
            </div>
            <div class="module-tag">${title}</div>
            <h2 class="module-title">${title}</h2>
            <p class="module-subtitle">${subtitle}</p>
            <p class="module-desc">${description}</p>
          </div>
          <div class="module-items">
            <div class="module-items-label">${itemsLabel}</div>
            <div class="item-grid">${itemsHtml}</div>
          </div>
        </div>
      </section>
    `;
  }).join("");

  container.innerHTML = html;

  // 渲染侧边导航点
  if (dotsNav) {
    const dotsHtml = moduleData.modules.map((mod) => {
      const name = mod.title[lang] || mod.title.zh;
      return `<button class="dot" data-target="${mod.id}" aria-label="${name}"><span class="dot-inner"></span></button>`;
    }).join("");
    dotsNav.innerHTML = dotsHtml;
  }

  // 初始化滚动揭示与侧边导航点交互
  initRevealObserver();
  initDotsNav();
}

/**
 * 滚动揭示动画（IntersectionObserver）
 */
function initRevealObserver() {
  const sections = document.querySelectorAll(".module");
  if (!sections.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          // 子项卡片依次淡入
          const cards = entry.target.querySelectorAll(".item-card");
          cards.forEach((card, i) => {
            card.style.transitionDelay = `${0.1 + i * 0.08}s`;
          });
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -80px 0px" }
  );

  sections.forEach((section) => observer.observe(section));
}

/**
 * 侧边导航点：点击跳转 + 滚动高亮当前
 */
function initDotsNav() {
  const dots = document.querySelectorAll(".dot");
  if (!dots.length) return;

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      const target = document.getElementById(dot.dataset.target);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  // 高亮当前可见模块对应的点
  const sections = document.querySelectorAll(".module");
  const navObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          dots.forEach((d) => {
            d.classList.toggle("active", d.dataset.target === id);
          });
        }
      });
    },
    { threshold: 0.4 }
  );
  sections.forEach((s) => navObserver.observe(s));
}

/**
 * 取原始模块数据
 */
export function getData() {
  return moduleData;
}
