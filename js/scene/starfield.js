/**
 * CupGIS - Luxurious Star Field ("星空顶")
 * Milky Way background sphere + twinkling Points stars
 * Inspired by high-end star ceiling design with blinking effects
 *
 * Features:
 * - Milky Way texture on a large background sphere
 * - 1000 twinkling stars between sun and background sphere
 * - Each star has independent color, size, blink phase/frequency
 * - Custom ShaderMaterial with sin-based blinking + noise
 * - Smooth circular points with glow falloff
 * - Additive blending for realistic star glow
 */
import * as THREE from 'three';

/* ── Configuration ── */
const STARS_AMOUNT = window.innerWidth < 768 ? 600 : 1000;
const STARS_MIN_DISTANCE = 30;
const STARS_MAX_DISTANCE = 80;
const MILKY_WAY_RADIUS = 100;
const MILKY_WAY_TEXTURE_PATH = './assets/textures/milky_way.jpg';

/* ── Star Vertex Shader ── */
const starsVertexShader = `
  attribute float size;
  attribute vec3 starColor;
  attribute float phase;
  attribute float frequency;

  varying vec3 vStarColor;
  varying float vAlpha;

  uniform float time;

  void main() {
    vStarColor = starColor;

    // Blinking: sin wave with per-star frequency and phase offset
    float blink = sin(time * frequency + phase) * 0.5 + 0.8;

    // Random noise for more natural twinkling (less uniform)
    float noise = sin(dot(position, vec3(12.9898, 78.233, 45.5432)) * 43758.5453) * 0.15;

    // Final size = base size × blink intensity × noise
    float finalSize = size * (blink + noise);

    // Alpha also modulated by blink for brightness variation
    vAlpha = clamp(blink + noise, 0.3, 1.2);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = finalSize * (250.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

/* ── Star Fragment Shader ── */
const starsFragmentShader = `
  varying vec3 vStarColor;
  varying float vAlpha;

  void main() {
    // Circular point shape (discard outside circle)
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    // Smooth glow falloff: bright center, soft edge
    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
    // Add core brightness boost
    float core = 1.0 - smoothstep(0.0, 0.15, dist);
    alpha = alpha * 0.7 + core * 0.5;

    // Apply blink-modulated alpha
    alpha *= vAlpha;

    // Slight warm core tint for brightest stars
    vec3 finalColor = mix(vStarColor, vStarColor + vec3(0.3, 0.2, 0.1), core * 0.4);

    gl_FragColor = vec4(finalColor, alpha * 0.85);
  }
`;

/* ── Milky Way Vertex Shader ── */
const milkyWayVertexShader = `
  varying vec2 vUv;
  varying vec3 vPositionW;
  varying vec3 vNormalW;

  void main() {
    vUv = uv;
    vPositionW = (modelMatrix * vec4(position, 1.0)).xyz;
    vNormalW = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/* ── Milky Way Fragment Shader ── */
const milkyWayFragmentShader = `
  uniform sampler2D milkyWayMap;
  uniform float time;

  varying vec2 vUv;
  varying vec3 vPositionW;
  varying vec3 vNormalW;

  void main() {
    vec4 texColor = texture2D(milkyWayMap, vUv);

    // Subtle shimmer on the Milky Way band
    float shimmer = sin(time * 0.3 + vUv.x * 20.0) * 0.02 + 1.0;
    texColor.rgb *= shimmer;

    // Brighten the Milky Way center band slightly
    float brightness = texColor.r + texColor.g + texColor.b;
    texColor.rgb *= 1.0 + brightness * 0.1;

    gl_FragColor = texColor;
  }
`;

/* ── StarField Class ── */
export class StarField {
  constructor(scene, count = STARS_AMOUNT) {
    this.scene = scene;
    this.count = count;
    this.starsMesh = null;
    this.milkyWayMesh = null;
    this.starMaterial = null;
    this.milkyWayMaterial = null;
    this.isMilkyWayLoaded = false;

    // Create twinkling stars immediately
    this._createStars();

    // Load Milky Way background asynchronously
    this._loadMilkyWay();
  }

  _createStars() {
    const positions = new Float32Array(this.count * 3);
    const starColors = new Float32Array(this.count * 3);
    const sizes = new Float32Array(this.count);
    const phases = new Float32Array(this.count);
    const frequencies = new Float32Array(this.count);

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;

      // ── Position: spherical distribution between min/max distance ──
      const distance = STARS_MIN_DISTANCE + Math.random() * (STARS_MAX_DISTANCE - STARS_MIN_DISTANCE);
      const theta = Math.random() * Math.PI * 2;       // azimuth
      const phi = Math.acos(2 * Math.random() - 1);    // polar angle

      positions[i3]     = distance * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = distance * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = distance * Math.cos(phi);

      // ── Color: realistic star color distribution ──
      const colorChoice = Math.random();
      if (colorChoice < 0.65) {
        // White / pale yellow stars (most common)
        starColors[i3]     = 1.0;
        starColors[i3 + 1] = 0.92 + Math.random() * 0.08;
        starColors[i3 + 2] = 0.82 + Math.random() * 0.18;
      } else if (colorChoice < 0.85) {
        // Blue / blue-white stars (hot stars)
        starColors[i3]     = 0.4 + Math.random() * 0.3;
        starColors[i3 + 1] = 0.6 + Math.random() * 0.3;
        starColors[i3 + 2] = 1.0;
      } else {
        // Red / orange stars (cool stars)
        starColors[i3]     = 1.0;
        starColors[i3 + 1] = 0.5 + Math.random() * 0.3;
        starColors[i3 + 2] = 0.3 + Math.random() * 0.2;
      }

      // ── Size: varied brightness ──
      sizes[i] = Math.random() * 2.5 + 0.5;

      // ── Blink frequency: each star twinkles at its own rate ──
      frequencies[i] = Math.random() * 0.6 + 0.4;

      // ── Blink phase: offset so they don't blink in sync ──
      phases[i] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('starColor', new THREE.BufferAttribute(starColors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('frequency', new THREE.BufferAttribute(frequencies, 1));

    this.starMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 },
      },
      vertexShader: starsVertexShader,
      fragmentShader: starsFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.starsMesh = new THREE.Points(geometry, this.starMaterial);
    this.starsMesh.frustumCulled = false;
    this.scene.add(this.starsMesh);
  }

  async _loadMilkyWay() {
    const loader = new THREE.TextureLoader();

    try {
      const texture = await new Promise((resolve, reject) => {
        loader.load(MILKY_WAY_TEXTURE_PATH, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          resolve(tex);
        }, undefined, (err) => {
          console.warn('CupGIS: Milky Way texture load failed:', err);
          reject(err);
        });
      });

      this._createMilkyWaySphere(texture);
      this.isMilkyWayLoaded = true;
    } catch (e) {
      // Fallback: no Milky Way sphere, just stars
      console.warn('CupGIS: Proceeding without Milky Way background');
    }
  }

  _createMilkyWaySphere(texture) {
    const segments = window.innerWidth < 768 ? 32 : 48;
    const geometry = new THREE.SphereGeometry(MILKY_WAY_RADIUS, segments, segments);

    this.milkyWayMaterial = new THREE.ShaderMaterial({
      uniforms: {
        milkyWayMap: { value: texture },
        time: { value: 0.0 },
      },
      vertexShader: milkyWayVertexShader,
      fragmentShader: milkyWayFragmentShader,
      side: THREE.BackSide, // Render inside of sphere (we're looking from center)
      depthWrite: false,
    });

    this.milkyWayMesh = new THREE.Mesh(geometry, this.milkyWayMaterial);
    this.milkyWayMesh.frustumCulled = false;
    this.scene.add(this.milkyWayMesh);
  }

  update(elapsedTime) {
    // Update star blink time
    if (this.starMaterial) {
      this.starMaterial.uniforms.time.value = elapsedTime;
    }

    // Update Milky Way shimmer
    if (this.milkyWayMaterial) {
      this.milkyWayMaterial.uniforms.time.value = elapsedTime;
    }

    // Slow star field rotation (very subtle, adds depth)
    if (this.starsMesh) {
      this.starsMesh.rotation.y = elapsedTime * 0.003;
      this.starsMesh.rotation.x = Math.sin(elapsedTime * 0.001) * 0.02;
    }

    // Milky Way also slowly rotates
    if (this.milkyWayMesh) {
      this.milkyWayMesh.rotation.y = elapsedTime * 0.002;
    }
  }

  dispose() {
    if (this.starsMesh) {
      this.starsMesh.geometry.dispose();
      this.starMaterial.dispose();
      this.scene.remove(this.starsMesh);
    }
    if (this.milkyWayMesh) {
      this.milkyWayMesh.geometry.dispose();
      this.milkyWayMaterial.uniforms.milkyWayMap.value.dispose();
      this.milkyWayMaterial.dispose();
      this.scene.remove(this.milkyWayMesh);
    }
  }
}
