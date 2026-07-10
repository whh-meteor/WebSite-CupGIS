/**
 * CupGIS - 国际化模块（i18n）
 * ES module 双语支持：中文（zh）/ 英文（en）
 * 覆盖导航、首屏、模块、页脚、加载屏幕等全部界面文本
 */

const translations = {
  zh: {
    nav: {
      data: "数据",
      tools: "工具",
      products: "产品",
      cases: "案例",
      blog: "博客",
      about: "关于",
    },
    hero: {
      badge: "地理空间智能平台",
      slogan: "开启地理空间智能新纪元",
      desc: "从近地轨道俯瞰，重新定义地理信息系统的边界。集数据索引、在线工具、产品矩阵、应用案例与技术博客于一体。",
      cta1: "开始探索",
      cta2: "了解更多",
      scroll: "向下滚动探索",
    },
    module: {
      explore: "进入",
      visit: "访问",
      itemsLabel: "探索内容",
      number: "模块",
    },
    footer: {
      desc: "开启地理空间智能新纪元",
      platform: "平台",
      resources: "资源",
      connect: "联系",
      rights: "保留所有权利。",
    },
    loading: {
      scene: "构建 3D 场景",
      earth: "加载地球纹理",
      satellites: "部署卫星编队",
      ready: "系统就绪",
      failed: "加载失败，请刷新页面",
    },
  },
  en: {
    nav: {
      data: "Data",
      tools: "Tools",
      products: "Products",
      cases: "Cases",
      blog: "Blog",
      about: "About",
    },
    hero: {
      badge: "Geospatial Intelligence Platform",
      slogan: "A New Era of Geospatial Intelligence",
      desc: "A new perspective from low Earth orbit. Data index, online tools, product matrix, case studies and technical blog — all in one.",
      cta1: "Start Exploring",
      cta2: "Learn More",
      scroll: "Scroll to explore",
    },
    module: {
      explore: "Enter",
      visit: "Visit",
      itemsLabel: "Explore",
      number: "Module",
    },
    footer: {
      desc: "A New Era of Geospatial Intelligence",
      platform: "Platform",
      resources: "Resources",
      connect: "Connect",
      rights: "All rights reserved.",
    },
    loading: {
      scene: "Building 3D scene",
      earth: "Loading Earth textures",
      satellites: "Deploying satellites",
      ready: "System ready",
      failed: "Load failed, please refresh",
    },
  },
};

// 当前语言，优先读取本地存储
let currentLang = localStorage.getItem("cupgis-lang") || "zh";

/**
 * 将翻译应用到所有带 data-i18n 的元素
 */
export function applyTranslations(lang) {
  currentLang = lang;
  const dict = translations[lang] || translations.zh;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const value = resolveKey(dict, key);
    if (value) el.textContent = value;
  });

  // 更新 html lang 属性
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";

  // 更新语言切换按钮显示（显示"另一种语言"）
  const langCurrent = document.getElementById("langCurrent");
  if (langCurrent) langCurrent.textContent = lang === "zh" ? "EN" : "中文";

  // 派发语言变更事件，供模块重新渲染
  window.dispatchEvent(new CustomEvent("languagechange", { detail: { lang } }));
}

/**
 * 中英文切换
 */
export function toggleLanguage() {
  const newLang = currentLang === "zh" ? "en" : "zh";
  localStorage.setItem("cupgis-lang", newLang);
  applyTranslations(newLang);
}

/**
 * 获取当前语言
 */
export function getCurrentLang() {
  return currentLang;
}

/**
 * 按 key（如 "nav.data"）取翻译值
 */
export function t(key) {
  const dict = translations[currentLang] || translations.zh;
  return resolveKey(dict, key) || key;
}

/**
 * 解析嵌套 key
 */
function resolveKey(dict, key) {
  const keys = key.split(".");
  let value = dict;
  for (const k of keys) {
    value = value ? value[k] : null;
  }
  return value;
}
