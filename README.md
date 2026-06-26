# CupGIS - 地理空间智能平台主站

> 开启地理空间智能新纪元 | Redefining GIS from Low Earth Orbit

CupGIS 主站采用 Three.js 3D 渲染引擎，实现逼真的程序化地球、ISS 风格卫星编队和轨道轨迹动画。首屏以 3D 地球为背景，6 架专属卫星沿不同轨道运行；随页面滚动，相机视角平滑过渡至不同卫星位置，对应展示数据索引、在线工具、技术博客等功能模块。

## ✨ 特性

- **Three.js 3D 渲染引擎** — 程序化生成地球纹理（大陆/海洋/冰盖/城市灯光），自定义 GLSL 着色器实现昼夜分界线、大气辉光、海洋镜面高光
- **ISS 风格卫星编队** — 6 架专属卫星（太阳能板/舱体/天线/机械臂），每模块独立配置轨道参数
- **轨道轨迹渲染** — 可视化卫星飞行轨迹线，活跃模块轨道高亮
- **滚动驱动相机** — 7 个相机航点（英雄区 + 6 模块），smoothstep 平滑过渡
- **黑白红配色** — 纯黑背景、白色文字、中国红（#e63946）强调色
- **Glass-morphism 卡片** — backdrop-filter 毛玻璃模块卡片，悬停边框发光
- **中英文双语** — 一键切换，覆盖所有界面文本、模块内容和 HUD 标签
- **完整 SEO** — Meta 标签、Open Graph、Twitter Card、Schema.org JSON-LD
- **响应式布局** — 桌面/平板/手机全适配，移动端自动降低纹理分辨率和星星数量
- **加载屏幕** — 进度条 + 旋转动画，纹理生成进度实时更新
- **HUD 叠加层** — 轨道相机 HUD（ALT/VEL/INC/LAT/LON）
- **配置化** — 模块信息和轨道参数均在 `config/modules.json` 中配置

## 📁 项目结构

```
WebSite-CupGIS/
├── index.html              # 主页面（SEO、importmap、加载屏幕、HUD）
├── css/
│   └── style.css           # 黑白红主题、Glass-morphism、响应式、动画
├── js/
│   ├── main.js             # 入口：应用编排、加载屏幕、UI 交互
│   ├── scroll.js           # 滚动控制器：scroll → progress → 模块切换
│   ├── i18n.js             # 国际化（中/英双语，ES module）
│   ├── modules.js          # 模块配置加载 + DOM 渲染 + 轨道参数解析
│   └── scene/
│       ├── manager.js      # Three.js 场景管理（渲染器、相机、灯光、渲染循环）
│       ├── earth.js        # 3D 地球（自定义着色器、大气层、云层、昼夜）
│       ├── textures.js     # 程序化纹理生成器（3D 噪声 → 5 种纹理贴图）
│       ├── satellite.js    # ISS 风格卫星模型 + 轨道线 + 活跃光晕
│       └── starfield.js    # 星空背景（3000 颗星、颜色变化、缓慢旋转）
├── config/
│   └── modules.json        # 模块配置（标题、描述、链接、颜色、轨道参数）
├── assets/
│   └── favicon.svg         # 站点图标（地球+卫星 SVG）
├── robots.txt              # 搜索引擎爬虫指引
├── sitemap.xml             # 站点地图
└── README.md               # 项目文档
```

## 🚀 快速开始

### 本地预览

由于使用了 ES modules + importmap 加载 Three.js，需通过 HTTP 服务器运行：

**Python (内置):**
```bash
cd WebSite-CupGIS
python -m http.server 8090
```

**Node.js:**
```bash
cd WebSite-CupGIS
npx serve -p 8090
```

然后打开浏览器访问 `http://localhost:8090`。

> ⚠️ 不支持 `file://` 协议直接打开，ES modules 需要 HTTP 服务器。

### 部署

将整个目录上传至任意静态托管服务即可：
- Nginx / Apache
- GitHub Pages
- Vercel / Netlify / Cloudflare Pages
- 腾讯云 COS / 阿里云 OSS

无需构建步骤，纯静态文件直接部署。Three.js 从 CDN 加载（jsdelivr），首次访问约 200KB gzipped，后续访问利用浏览器缓存。

## ⚙️ 配置说明

### 模块配置 (`config/modules.json`)

所有功能模块和卫星轨道参数通过配置文件定义：

```json
{
  "modules": [
    {
      "id": "data",
      "icon": "database",
      "title": { "zh": "数据索引", "en": "Data Index" },
      "subtitle": { "zh": "副标题", "en": "Subtitle" },
      "description": { "zh": "描述...", "en": "Description..." },
      "url": "https://data.cupgis.com",
      "color": "#e63946",
      "features": { "zh": ["特性1"], "en": ["Feature1"] },
      "orbit": {
        "radius": 1.3,          // 轨道半径（相对地球半径1.0）
        "inclination": 28.5,    // 轨道倾角（度）
        "speed": 0.15,          // 角速度（弧度/帧）
        "startAngle": 0         // 起始角度（弧度）
      }
    }
  ]
}
```

#### 轨道参数说明

| 参数 | 说明 | 推荐范围 |
|------|------|----------|
| `radius` | 轨道半径（地球=1.0） | 1.3 ~ 2.2 |
| `inclination` | 轨道倾角（度） | 15 ~ 90 |
| `speed` | 角速度 | 0.10 ~ 0.35 |
| `startAngle` | 起始角度 | 0 ~ 6.28 |

#### 新增模块

在 `modules` 数组中添加新对象即可。支持的 `icon` 类型：
- `database` / `tools` / `blog` / `docs` / `community` / `about`

### 语言配置

翻译文本在 `js/i18n.js` 的 `translations` 对象中，覆盖：
- 导航栏、英雄区、页脚、模块卡片、HUD 标签、加载屏幕

### 相机航点

相机过渡航点定义在 `js/scene/manager.js` 的 `cameraWaypoints` 数组中。格式：
```javascript
{ pos: [x, y, z], look: [x, y, z] }
```

### SEO 配置

- **Meta 标签** — `index.html` `<head>` 中修改 description、keywords
- **Open Graph** — 修改 og:url、og:image 等社交分享信息
- **Schema.org** — 修改 JSON-LD 结构化数据
- **robots.txt** — 修改爬虫访问规则
- **sitemap.xml** — 更新站点地图 URL

## 🎨 设计规范

### 配色方案

| 用途 | 变量 | 色值 |
|------|------|------|
| 背景 | `--color-bg` | `#000000` |
| 主文字 | `--color-text` | `#ffffff` |
| 次文字 | `--color-text-dim` | `#b0b0b0` |
| 强调色 | `--color-accent` | `#e63946` |
| 卡片背景 | `--color-bg-card` | `rgba(10,10,10,0.85)` |
| 边框 | `--color-border` | `rgba(255,255,255,0.08)` |

### 字体栈

- 显示字体：`Segoe UI, system-ui, -apple-system, sans-serif`
- HUD 字体：`JetBrains Mono, Fira Code, SF Mono, monospace`

## ⚡ 性能优化

| 优化项 | 说明 |
|--------|------|
| Three.js CDN | jsdelivr CDN 加载，浏览器缓存复用 |
| 程序化纹理 | 0 外部图片依赖，3D 噪声算法实时生成 |
| 移动端适配 | 自动降低纹理分辨率（512×256）和星星数量（1500） |
| 像素比限制 | `Math.min(devicePixelRatio, 2)` 防止高 DPI 过度渲染 |
| 后台暂停 | `document.hidden` 检测，切标签页暂停渲染循环 |
| Passive Scroll | `{ passive: true }` 滚动监听 |
| RAF 节流 | 滚动事件 requestAnimationFrame 节流 |
| 预加载 | CSS 和配置文件 `<link rel="preload">` |
| 减少动画 | `prefers-reduced-motion` CSS 媒体查询支持 |
| 总文件大小 | ~84KB 自定义代码 + ~200KB Three.js (gzipped CDN) |

## 🌐 浏览器兼容

- Chrome / Edge 89+（importmap 支持）
- Firefox 108+
- Safari 16.4+
- 移动端 iOS Safari 16.4+ / Chrome Mobile 89+

## 📊 SEO 功能清单

- [x] 完整 Meta 标签（description, keywords, author, robots）
- [x] Open Graph 标签（Facebook 分享优化）
- [x] Twitter Card 标签
- [x] Schema.org JSON-LD 结构化数据（Organization, WebSite）
- [x] canonical 规范链接
- [x] hreflang 多语言替代链接
- [x] robots.txt 爬虫指引
- [x] sitemap.xml 站点地图
- [x] 语义化 HTML5 标签（nav, main, section, footer）
- [x] ARIA 无障碍标签
- [x] SVG favicon

## 📝 自定义指南

### 修改卫星轨道

编辑 `config/modules.json` 中每个模块的 `orbit` 参数。

### 修改地球着色器

编辑 `js/scene/earth.js` 中的 GLSL 色色器字符串：
- `earthFragmentShader` — 地球表面（昼夜混合、大气散射、镜面高光）
- `atmoFragmentShader` — 大气辉光（fresnel 边缘发光、晨昏线暖色）
- `earthVertexShader` / `atmoVertexShader` — 顶点变换

### 修改纹理生成

编辑 `js/scene/textures.js` 中的颜色映射参数：
- 海洋颜色梯度（deepOcean → shallowSea）
- 陆地颜色梯度（lowGreen → snow）
- 冰盖阈值（lat > 0.82）
- 城市灯光密度

### 修改相机航点

编辑 `js/scene/manager.js` 的 `cameraWaypoints` 数组。

## 📄 许可证

MIT License

## 📧 联系

- Website: [https://www.cupgis.com](https://www.cupgis.com)
- Email: contact@cupgis.com
- GitHub: [https://github.com/cupgis](https://github.com/cupgis)

---

© 2025 CupGIS. All rights reserved.
