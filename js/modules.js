/**
 * CupGIS - Module Loader & Renderer
 * ES module: fetches config, renders module cards with rich interactions
 */
import { getCurrentLang, t } from './i18n.js';

let moduleData = null;

// SVG icons for each module type
const icons = {
  database: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
  tools: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
  blog: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
  docs: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y1="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  community: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  about: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
};

/**
 * Fetch module configuration from config file
 */
export async function fetchConfig() {
  try {
    const response = await fetch("config/modules.json");
    if (!response.ok) throw new Error("Failed to load config");
    moduleData = await response.json();
    return moduleData;
  } catch (err) {
    console.error("CupGIS: Failed to load module config:", err);
    return null;
  }
}

/**
 * Get module configs with orbit parameters
 * Returns array of { id, icon, color, radius, inclination, speed, startAngle, ... }
 */
export function getModuleOrbitConfigs() {
  if (!moduleData) return [];
  return moduleData.modules.map((mod) => ({
    id: mod.id,
    icon: mod.icon,
    color: mod.color,
    title: mod.title,
    subtitle: mod.subtitle,
    description: mod.description,
    url: mod.url,
    features: mod.features,
    // Orbit parameters read from config file (config/modules.json)
    radius: mod.orbit?.radius || 1.5,
    inclination: mod.orbit?.inclination || 45,
    speed: mod.orbit?.speed || 0.2,
    startAngle: mod.orbit?.startAngle || 0,
  }));
}

/**
 * Render module sections into DOM
 */
export function renderModules() {
  if (!moduleData) return;

  const container = document.getElementById("moduleSections");
  if (!container) return;

  const lang = getCurrentLang();
  const visitText = t("module.visit");
  const featuresText = t("module.features");

  const html = moduleData.modules.map((mod, index) => {
    const align = index % 2 === 0 ? "left" : "right";
    const iconSvg = icons[mod.icon] || icons.about;
    const title = mod.title[lang] || mod.title.zh;
    const subtitle = mod.subtitle[lang] || mod.subtitle.zh;
    const description = mod.description[lang] || mod.description.zh;
    const features = mod.features[lang] || mod.features.zh;
    const num = String(index + 1).padStart(2, "0");

    const featuresHtml = features.map((f) => `<li>${f}</li>`).join("");

    return `
      <section class="section module-section align-${align}" id="${mod.id}"
        style="--module-color: ${mod.color}" data-module-index="${index}">
        <div class="module-number">${num}</div>
        <div class="module-card">
          <div class="module-icon">${iconSvg}</div>
          <div class="module-tag">${title}</div>
          <h2 class="module-title">${title}</h2>
          <p class="module-subtitle">${subtitle}</p>
          <p class="module-desc">${description}</p>
          <div class="module-features-label">${featuresText}</div>
          <ul class="module-features">${featuresHtml}</ul>
          <a href="${mod.url}" target="_blank" rel="noopener" class="module-link">
            ${visitText} ${title}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </a>
        </div>
      </section>
    `;
  }).join("");

  container.innerHTML = html;

  // Init IntersectionObserver for reveal animations
  initRevealObserver();
}

/**
 * IntersectionObserver for scroll-reveal animations on module cards
 */
function initRevealObserver() {
  const sections = document.querySelectorAll(".module-section");
  if (!sections.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -50px 0px" }
  );

  sections.forEach((section) => observer.observe(section));
}

/**
 * Get raw module data
 */
export function getData() {
  return moduleData;
}
