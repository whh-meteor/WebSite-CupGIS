/**
 * CupGIS - 真实地球场景（复刻 xieyufei.com Three.js 真实地球案例）
 *
 * 修复要点（对照案例）：
 * 1. 晨昏线：纯净 smoothstep 昼夜混合，无额外橙色着色
 * 2. 云层：使用 BRC 纹理蓝色通道混入地表着色器（避免 PNG alpha 白斑 bug）
 * 3. 星空：银河背景球 + Points 闪烁星，比例对照案例
 * 4. 鼠标交互：OrbitControls 旋转（在 manager.js 中实现）
 *
 * 参考：https://xieyufei.com/2026/01/22/Threejs-Real-Earth.html
 */
import * as THREE from 'three';

/* ── 场景尺度常量（地球半径 = 1） ── */
const EARTH_RADIUS = 1;
const ATMO_RADIUS = 1.06;
const SUN_RADIUS = 0.42;
const MOON_RADIUS = 0.17;
const MOON_TRACK_RADIUS = 2.2;
const BG_STARS_RADIUS = 60;
const STARS_MIN_DIST = 14;
const STARS_MAX_DIST = 40;
const STARS_AMOUNT = window.innerWidth < 768 ? 600 : 1200;

/* ── 纹理路径 ── */
const TEXTURE_PATHS = {
  day: './assets/textures/earth_daymap_4k.jpg',
  night: './assets/textures/earth_nightmap_4k.jpg',
  brc: './assets/textures/earth_brc_4k.jpg',      // R=bump, G=roughness, B=clouds
  moon: './assets/textures/moon.jpg',
  milkyway: './assets/textures/milky_way.jpg',
};

/* ═══════════════════════════════════════════════════════════════
   地球表面着色器：白天/夜间贴图 + 平滑晨昏线 + 云层(BRC蓝通道)
   对照案例：纯净 smoothstep 混合，无额外着色
   ═══════════════════════════════════════════════════════════════ */
const earthVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormalW;
  void main() {
    vUv = uv;
    // 世界空间法线，保证昼夜分界线不随地球自转/相机移动而漂移
    vNormalW = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const earthFragmentShader = `
  uniform sampler2D dayTexture;
  uniform sampler2D nightTexture;
  uniform sampler2D brcMap;        // R=bump, G=roughness, B=clouds
  uniform vec3 sunPosition;
  uniform float transitionWidth;   // 晨昏线过渡宽度
  uniform float cloudOffset;       // 云层独立旋转偏移（U方向平移）
  varying vec2 vUv;
  varying vec3 vNormalW;

  void main() {
    vec3 normal = normalize(vNormalW);
    vec3 lightDir = normalize(sunPosition);

    // 法线与太阳方向的点积 = cos(θ)
    float dotProduct = dot(normal, lightDir);

    // ── 平滑晨昏线过渡（纯净 mix，无额外着色）──
    float transitionCenter = 0.0;
    float transitionStart = transitionCenter - transitionWidth * 0.5;
    float transitionEnd = transitionCenter + transitionWidth * 0.5;
    float dayStrength = smoothstep(transitionStart, transitionEnd, dotProduct);

    // ── 纹理采样 ──
    vec3 dayColor = texture2D(dayTexture, vUv).rgb;
    vec3 nightColor = texture2D(nightTexture, vUv).rgb;

    // ── 云层：从 BRC 蓝色通道提取 ──
    // 使用 U 方向反向平移，使云层与地球自转方向一致（向东漂移）
    vec2 cloudUv = vec2(vUv.x - cloudOffset, vUv.y);
    float cloudsStrength = smoothstep(0.25, 1.0, texture2D(brcMap, cloudUv).b);

    // 白天侧：云层半透明混合，降低白度
    vec3 dayCloudColor = mix(dayColor, vec3(0.92, 0.94, 0.96), cloudsStrength * 0.7);
    dayColor = mix(dayColor, dayCloudColor, dayStrength);

    // 白天侧整体提亮
    dayColor *= 1.3;

    // 夜间灯光大幅增强，确保黑暗面城市灯光清晰可见
    nightColor *= 7.0;

    // 夜间侧也显示云层（月光照射感，提升亮度使其可见）
    vec3 nightCloudColor = mix(nightColor, vec3(0.22, 0.24, 0.28), cloudsStrength * 0.55);
    nightColor = mix(nightColor, nightCloudColor, 1.0 - dayStrength);

    // 基础昼夜混合
    vec3 color = mix(nightColor, dayColor, dayStrength);

    gl_FragColor = vec4(color, 1.0);
  }
`;

/* ═══════════════════════════════════════════════════════════════
   大气光晕着色器（BackSide 球体 + Fresnel）
   ═══════════════════════════════════════════════════════════════ */
const atmoVertexShader = `
  varying vec3 vNormalW;
  varying vec3 vPositionW;
  void main() {
    vNormalW = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vPositionW = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const atmoFragmentShader = `
  uniform vec3 sunPosition;
  varying vec3 vNormalW;
  varying vec3 vPositionW;

  void main() {
    vec3 normal = normalize(vNormalW);
    vec3 viewDir = normalize(cameraPosition - vPositionW);

    float fresnel = 1.0 - abs(dot(viewDir, normal));
    float alpha = clamp((fresnel - 0.6) / 0.4, 0.0, 1.0);
    alpha = 1.0 - alpha;
    alpha = pow(alpha, 3.0);

    float sunOrientation = dot(normal, normalize(sunPosition));
    alpha *= smoothstep(-0.5, 1.0, sunOrientation);

    // 大气色：白天蓝，暮光微暖
    vec3 atmoDay = vec3(0.30, 0.70, 1.00);
    vec3 atmoTwilight = vec3(0.95, 0.45, 0.15);
    vec3 atmoColor = mix(atmoTwilight, atmoDay, smoothstep(-0.2, 0.7, sunOrientation));

    gl_FragColor = vec4(atmoColor, alpha);
  }
`;

/* ═══════════════════════════════════════════════════════════════
   闪烁星空着色器（Points）—— 完全对照案例
   ═══════════════════════════════════════════════════════════════ */
const starsVertexShader = `
  attribute float size;
  attribute vec3 color;
  attribute float phase;
  attribute float frequency;
  varying vec3 vColor;
  uniform float time;

  void main() {
    vColor = color;
    // 闪烁：sin 波 + 随机噪声
    float blink = sin(time * frequency + phase) * 0.5 + 0.8;
    float noise = sin(dot(position, vec3(12.9898, 78.233, 45.5432)) * 43758.5453) * 0.1;
    float finalSize = size * (blink + noise);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = finalSize * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const starsFragmentShader = `
  varying vec3 vColor;
  void main() {
    float distanceToCenter = length(gl_PointCoord - vec2(0.5));
    if (distanceToCenter > 0.5) discard;
    float alpha = 1.0 - smoothstep(0.0, 0.5, distanceToCenter);
    gl_FragColor = vec4(vColor, alpha * 0.9);
  }
`;

/* ═══════════════════════════════════════════════════════════════
   真实地球场景类
   ═══════════════════════════════════════════════════════════════ */
export class Earth {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.radius = options.radius || 1;
    this.group = new THREE.Group();

    // 各部件
    this.earthMesh = null;
    this.atmoMesh = null;
    this.sunMesh = null;
    this.moonGroup = null;
    this.moonOrbitPivot = null;
    this.bgStarsMesh = null;
    this.starsPoints = null;
    this.starsMaterial = null;

    // 太阳位置（驱动昼夜），初始偏右上
    this.sunPosition = new THREE.Vector3(3.8, 1.3, 0.6);
    this.sunOrbitAngle = 0;

    // 地球自转角度
    this.earthRotation = 0;
    // 云层独立旋转角度（比地球稍快，产生相对运动）
    this.cloudRotation = 0;

    // 内部计时
    this.elapsed = 0;
  }

  async init(onProgress) {
    const textures = await this._loadTextures(onProgress);

    this._createEarth(textures);
    this._createAtmosphere();
    this._createSun(textures);
    this._createMoon(textures);
    this._createMilkyWay(textures);
    this._createTwinkleStars();

    this.scene.add(this.group);
  }

  /* ── 纹理加载 ── */
  async _loadTextures(onProgress) {
    const loader = new THREE.TextureLoader();
    const entries = Object.entries(TEXTURE_PATHS);
    const total = entries.length;
    const textures = {};

    for (let i = 0; i < total; i++) {
      const [name, path] = entries[i];
      textures[name] = await new Promise((resolve, reject) => {
        loader.load(path, (tex) => {
          const colorTextures = ['day', 'night', 'moon', 'milkyway'];
          tex.colorSpace = colorTextures.includes(name)
            ? THREE.SRGBColorSpace
            : THREE.LinearSRGBColorSpace;
          tex.anisotropy = 8;
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          if (onProgress) onProgress((i + 1) / total);
          resolve(tex);
        }, undefined, (err) => {
          console.warn(`CupGIS: 纹理加载失败 ${path}`, err);
          reject(err);
        });
      });
    }
    return textures;
  }

  /* ── 地球（含云层，混入地表着色器）── */
  _createEarth(textures) {
    const seg = window.innerWidth < 768 ? 64 : 96;
    const geometry = new THREE.SphereGeometry(this.radius, seg, seg);
    const material = new THREE.ShaderMaterial({
      vertexShader: earthVertexShader,
      fragmentShader: earthFragmentShader,
      uniforms: {
        dayTexture: { value: textures.day },
        nightTexture: { value: textures.night },
        brcMap: { value: textures.brc },
        sunPosition: { value: this.sunPosition },
        transitionWidth: { value: 0.3 },
        cloudOffset: { value: 0.0 },
      },
    });
    this.earthMesh = new THREE.Mesh(geometry, material);
    // 地球轴倾角 23.5°
    this.earthMesh.rotation.z = THREE.MathUtils.degToRad(23.5);
    this.group.add(this.earthMesh);
  }

  /* ── 大气光晕 ── */
  _createAtmosphere() {
    const seg = window.innerWidth < 768 ? 32 : 48;
    const geometry = new THREE.SphereGeometry(ATMO_RADIUS, seg, seg);
    const material = new THREE.ShaderMaterial({
      vertexShader: atmoVertexShader,
      fragmentShader: atmoFragmentShader,
      uniforms: {
        sunPosition: { value: this.sunPosition },
      },
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.atmoMesh = new THREE.Mesh(geometry, material);
    this.group.add(this.atmoMesh);
  }

  /* ── 太阳（程序化 Canvas 纹理 + 光晕）── */
  _createSun(textures) {
    const sunTex = this._makeSunTexture();
    const geometry = new THREE.SphereGeometry(SUN_RADIUS, 32, 32);
    const material = new THREE.MeshBasicMaterial({ map: sunTex });
    this.sunMesh = new THREE.Mesh(geometry, material);
    this.sunMesh.position.copy(this.sunPosition);
    this.group.add(this.sunMesh);

    // 太阳光晕精灵
    const haloTex = this._makeGlowTexture();
    const haloMat = new THREE.SpriteMaterial({
      map: haloTex,
      color: 0xffaa33,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const halo = new THREE.Sprite(haloMat);
    halo.scale.set(SUN_RADIUS * 6, SUN_RADIUS * 6, 1);
    this.sunMesh.add(halo);
  }

  /* ── 月球 + 可见轨道 ── */
  _createMoon(textures) {
    this.moonGroup = new THREE.Group();
    this.moonGroup.rotation.x = THREE.MathUtils.degToRad(65);
    this.moonGroup.rotation.z = THREE.MathUtils.degToRad(10);

    this.moonOrbitPivot = new THREE.Group();
    this.moonGroup.add(this.moonOrbitPivot);

    // 轨道环
    const trackGeo = new THREE.TorusGeometry(MOON_TRACK_RADIUS, 0.009, 64, 128);
    const trackMat = new THREE.MeshBasicMaterial({
      color: 0x99aabb,
      transparent: true,
      opacity: 0.5,
    });
    const track = new THREE.Mesh(trackGeo, trackMat);
    this.moonOrbitPivot.add(track);

    // 月球
    const moonGeo = new THREE.SphereGeometry(MOON_RADIUS, 48, 48);
    const moonMat = new THREE.MeshBasicMaterial({ map: textures.moon });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.set(MOON_TRACK_RADIUS, 0, 0);
    this.moonOrbitPivot.add(moon);
    this.moonMesh = moon;

    this.group.add(this.moonGroup);
  }

  /* ── 银河背景球 ── */
  _createMilkyWay(textures) {
    const geometry = new THREE.SphereGeometry(BG_STARS_RADIUS, 64, 64);
    geometry.scale(-1, 1, 1);
    const material = new THREE.MeshBasicMaterial({
      map: textures.milkyway,
      side: THREE.DoubleSide,
    });
    this.bgStarsMesh = new THREE.Mesh(geometry, material);
    this.group.add(this.bgStarsMesh);
  }

  /* ── 闪烁星空（Points）── 完全对照案例 ── */
  _createTwinkleStars() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(STARS_AMOUNT * 3);
    const colors = new Float32Array(STARS_AMOUNT * 3);
    const sizes = new Float32Array(STARS_AMOUNT);
    const phases = new Float32Array(STARS_AMOUNT);
    const frequencies = new Float32Array(STARS_AMOUNT);

    for (let i = 0; i < STARS_AMOUNT; i++) {
      const i3 = i * 3;
      // 球坐标随机分布
      const distance = STARS_MIN_DIST + Math.random() * (STARS_MAX_DIST - STARS_MIN_DIST);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i3] = distance * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = distance * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = distance * Math.cos(phi);

      // 颜色：偏白/蓝/红橙（对照案例）
      const c = Math.random();
      if (c < 0.7) {
        colors[i3] = 1.0;
        colors[i3 + 1] = 0.9 + Math.random() * 0.1;
        colors[i3 + 2] = 0.8 + Math.random() * 0.2;
      } else if (c < 0.9) {
        colors[i3] = 0.4 + Math.random() * 0.3;
        colors[i3 + 1] = 0.6 + Math.random() * 0.3;
        colors[i3 + 2] = 1.0;
      } else {
        colors[i3] = 1.0;
        colors[i3 + 1] = 0.5 + Math.random() * 0.3;
        colors[i3 + 2] = 0.3 + Math.random() * 0.2;
      }

      sizes[i] = Math.random() * 2 + 0.5;
      frequencies[i] = Math.random() * 0.5 + 0.5;
      phases[i] = Math.random() * Math.PI * 2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('frequency', new THREE.BufferAttribute(frequencies, 1));

    this.starsMaterial = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0.0 } },
      vertexShader: starsVertexShader,
      fragmentShader: starsFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.starsPoints = new THREE.Points(geometry, this.starsMaterial);
    this.group.add(this.starsPoints);
  }

  /* ── 程序化太阳纹理 ── */
  _makeSunTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, '#fff7d6');
    grad.addColorStop(0.3, '#ffd24a');
    grad.addColorStop(0.7, '#ff8a1e');
    grad.addColorStop(1, '#c43c00');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 1400; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() * 18 + 2;
      const a = Math.random() * 0.15;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = Math.random() < 0.5
        ? `rgba(255, 240, 180, ${a + 0.05})`
        : `rgba(180, 60, 0, ${a})`;
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /* ── 光晕纹理 ── */
  _makeGlowTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255, 220, 140, 1)');
    grad.addColorStop(0.2, 'rgba(255, 160, 60, 0.6)');
    grad.addColorStop(0.5, 'rgba(255, 100, 30, 0.2)');
    grad.addColorStop(1, 'rgba(255, 80, 20, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
  }

  /* ── 每帧更新 ── */
  update(scrollProgress, deltaTime) {
    this.elapsed += deltaTime;

    // 地球自转
    this.earthRotation += deltaTime * 0.06;
    if (this.earthMesh) this.earthMesh.rotation.y = this.earthRotation;

    // 云层独立旋转（U方向反向平移，与地球自转同向但更慢，产生微弱相对运动）
    this.cloudRotation += deltaTime * 0.005;
    if (this.earthMesh) this.earthMesh.material.uniforms.cloudOffset.value = this.cloudRotation;

    // 太阳公转（绕 Y 轴），驱动昼夜交替（降低速度）
    this.sunOrbitAngle += deltaTime * 0.03;
    const r = this.sunPosition.length();
    const baseY = 1.3;
    const planeR = Math.sqrt(Math.max(r * r - baseY * baseY, 0.01));
    this.sunPosition.set(
      Math.cos(this.sunOrbitAngle) * planeR,
      baseY,
      Math.sin(this.sunOrbitAngle) * planeR
    );
    if (this.sunMesh) {
      this.sunMesh.position.copy(this.sunPosition);
      // 太阳自转（大幅降低速度，使其可见且不眼花）
      this.sunMesh.rotation.y += deltaTime * 0.04;
    }

    // 同步太阳位置到着色器
    if (this.earthMesh) this.earthMesh.material.uniforms.sunPosition.value.copy(this.sunPosition);
    if (this.atmoMesh) this.atmoMesh.material.uniforms.sunPosition.value.copy(this.sunPosition);

    // 月球公转
    if (this.moonOrbitPivot) this.moonOrbitPivot.rotation.z += deltaTime * 0.25;
    if (this.moonMesh) this.moonMesh.rotation.y += deltaTime * 0.25;

    // 星空闪烁
    if (this.starsMaterial) this.starsMaterial.uniforms.time.value = this.elapsed;

    // 银河背景缓慢自转
    if (this.bgStarsMesh) this.bgStarsMesh.rotation.y += deltaTime * 0.005;
  }

  dispose() {
    this.group.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (child.material.uniforms) {
          Object.values(child.material.uniforms).forEach(u => {
            if (u.value && u.value.dispose) u.value.dispose();
          });
        }
        child.material.dispose();
      }
    });
    this.scene.remove(this.group);
  }
}
