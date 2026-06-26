/**
 * CupGIS - Internationalization (i18n)
 * ES module bilingual support: Chinese (zh) / English (en)
 * Covers all UI text, module content, and HUD labels
 */

const translations = {
  zh: {
    nav: {
      data: "数据索引",
      tools: "在线工具",
      blog: "技术博客",
      docs: "开发文档",
      community: "社区",
      about: "关于",
    },
    hero: {
      badge: "轨道智能平台",
      slogan: "开启地理空间智能新纪元",
      desc: "从近地轨道俯瞰，重新定义地理信息系统的边界。集数据索引、在线工具、技术博客于一体。",
      cta1: "开始探索",
      cta2: "了解更多",
      scroll: "向下滚动探索",
    },
    footer: {
      desc: "开启地理空间智能新纪元",
      product: "产品",
      resources: "资源",
      connect: "联系",
      rights: "保留所有权利。",
    },
    module: {
      visit: "访问",
      features: "核心功能",
    },
    hud: {
      orbital: "轨道相机",
      recording: "录制中",
      alt: "高度",
      vel: "速度",
      inc: "倾角",
      lat: "纬度",
      lon: "经度",
    },
    loading: {
      title: "正在初始化轨道系统...",
      earth: "生成地球纹理",
      scene: "构建3D场景",
      satellites: "部署卫星编队",
      ready: "系统就绪",
    },
  },
  en: {
    nav: {
      data: "Data Index",
      tools: "Tools",
      blog: "Blog",
      docs: "Docs",
      community: "Community",
      about: "About",
    },
    hero: {
      badge: "Orbital Intelligence Platform",
      slogan: "Redefining GIS from Low Earth Orbit",
      desc: "A new perspective on geospatial intelligence. Data index, online tools, and technical blogs, all from orbit.",
      cta1: "Start Exploring",
      cta2: "Learn More",
      scroll: "Scroll to explore",
    },
    footer: {
      desc: "Redefining GIS from Low Earth Orbit",
      product: "Product",
      resources: "Resources",
      connect: "Connect",
      rights: "All rights reserved.",
    },
    module: {
      visit: "Visit",
      features: "Key Features",
    },
    hud: {
      orbital: "ORBITAL CAM",
      recording: "REC",
      alt: "ALT",
      vel: "VEL",
      inc: "INC",
      lat: "LAT",
      lon: "LON",
    },
    loading: {
      title: "Initializing orbital systems...",
      earth: "Generating Earth textures",
      scene: "Building 3D scene",
      satellites: "Deploying satellite fleet",
      ready: "System ready",
    },
  },
};

let currentLang = localStorage.getItem("cupgis-lang") || "zh";

/**
 * Apply translations to all data-i18n elements
 */
export function applyTranslations(lang) {
  currentLang = lang;
  const dict = translations[lang] || translations.zh;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const keys = key.split(".");
    let value = dict;
    for (const k of keys) {
      value = value ? value[k] : null;
    }
    if (value) el.textContent = value;
  });

  // Update HTML lang attribute
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";

  // Update language toggle button
  const langCurrent = document.getElementById("langCurrent");
  if (langCurrent) langCurrent.textContent = lang === "zh" ? "EN" : "中文";

  // Dispatch event for module re-render
  window.dispatchEvent(new CustomEvent("languagechange", { detail: { lang } }));
}

/**
 * Toggle between zh and en
 */
export function toggleLanguage() {
  const newLang = currentLang === "zh" ? "en" : "zh";
  localStorage.setItem("cupgis-lang", newLang);
  applyTranslations(newLang);
}

/**
 * Get current language
 */
export function getCurrentLang() {
  return currentLang;
}

/**
 * Get translation for a key
 */
export function t(key) {
  const dict = translations[currentLang] || translations.zh;
  const keys = key.split(".");
  let value = dict;
  for (const k of keys) {
    value = value ? value[k] : null;
  }
  return value || key;
}
