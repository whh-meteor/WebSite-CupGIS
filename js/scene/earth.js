/**
 * CupGIS - Realistic 3D Earth
 * Referencing the official Three.js webgpu_tsl_earth example:
 * https://threejs.org/examples/#webgpu_tsl_earth
 *
 * Key design decisions (matching official example):
 * 1. Cloud data extracted from the BLUE channel of a combined texture
 *    (earth_bump_roughness_clouds_4096.jpg), NOT from a separate cloud PNG.
 *    This eliminates the Indexed PNG alpha parsing bug that caused white blobs.
 * 2. Clouds are rendered INSIDE the surface shader (mixed into day color),
 *    NOT as a separate transparent sphere. Single-pass = no double-rendering.
 * 3. Atmosphere uses BackSide sphere with Fresnel remap(0.73→1, 1→0) + pow(3).
 * 4. Day/night transition via sunOrientation smoothstep(-0.25, 0.5).
 * 5. Bump mapping from combined texture's RED channel.
 *
 * Texture sources:
 * - earth_daymap_4k.jpg    (Three.js official, 4096×2048)
 * - earth_nightmap_4k.jpg  (Three.js official, 4096×2048)
 * - earth_brc_4k.jpg       (Combined: R=bump, G=roughness, B=clouds, 4096×2048)
 */
import * as THREE from 'three';

/* ── Texture paths ── */
const TEXTURE_PATHS = {
  day:   './assets/textures/earth_daymap_4k.jpg',
  night: './assets/textures/earth_nightmap_4k.jpg',
  brc:   './assets/textures/earth_brc_4k.jpg',  // Combined: R=bump, G=roughness, B=clouds
};

/* ═══════════════════════════════════════════════════════════════
   Earth Surface Shader (GLSL translation of official TSL logic)
   
   Official TSL → GLSL mapping:
   - texture(brcTex, uv()).b.smoothstep(0.2, 1) → smoothstep(0.2, 1.0, texture2D(brcMap, vUv).b)
   - mix(texture(dayTex), vec3(1), cloudsStrength.mul(2)) → mix(dayTex.rgb, vec3(1.0), cloudsStrength * 2.0)
   - mix(night.rgb, output.rgb, dayStrength) → mix(nightColor, surfaceColor, dayStrength)
   - fresnel.remap(0.73, 1, 1, 0).pow(3) → pow(clamp((fresnel - 0.73) / 0.27, 0.0, 1.0), 3.0)
   ═══════════════════════════════════════════════════════════════ */

const earthVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPositionW;

  void main() {
    vUv = uv;
    vNormalW = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vPositionW = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const earthFragmentShader = `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform sampler2D brcMap;   // Combined: R=bump, G=roughness, B=clouds
  uniform vec3 sunDir;

  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPositionW;

  void main() {
    vec3 normal = normalize(vNormalW);
    vec3 viewDir = normalize(cameraPosition - vPositionW);

    // ── Texture sampling ──
    vec3 dayTex   = texture2D(dayMap, vUv).rgb;
    vec3 nightTex = texture2D(nightMap, vUv).rgb;
    vec3 brcTex   = texture2D(brcMap, vUv).rgb;

    // ── Extract channels from combined texture ──
    // R channel = bump/elevation (used for normal perturbation)
    // G channel = roughness (not used in this simplified shader)
    // B channel = cloud coverage
    float bumpElevation = brcTex.r;
    float cloudsStrength = smoothstep(0.2, 1.0, brcTex.b);

    // ── Bump mapping: perturb normals based on elevation gradient ──
    // Combine bump (R) with cloud elevation for consistent surface normals
    float combinedElevation = max(bumpElevation, cloudsStrength);
    
    // Compute normal perturbation from elevation gradient
    float bumpScale = 0.35;
    vec2 texelSize = vec2(1.0 / 4096.0, 1.0 / 2048.0);
    
    // Sample neighboring pixels for gradient calculation
    float elevRight = max(texture2D(brcMap, vUv + vec2(texelSize.x, 0.0)).r, 
                          smoothstep(0.2, 1.0, texture2D(brcMap, vUv + vec2(texelSize.x, 0.0)).b));
    float elevUp    = max(texture2D(brcMap, vUv + vec2(0.0, texelSize.y)).r,
                          smoothstep(0.2, 1.0, texture2D(brcMap, vUv + vec2(0.0, texelSize.y)).b));
    
    // Gradient-based normal perturbation
    vec3 perturbedNormal = normalize(normal + vec3(
      -(elevRight - combinedElevation) * bumpScale,
      -(elevUp - combinedElevation) * bumpScale,
      0.0
    ));

    // Use perturbed normal for lighting calculations
    normal = perturbedNormal;

    // ── Clouds mixed into day color (official approach) ──
    // mix(dayTexture, vec3(1), cloudsStrength * 2)
    // This makes cloudy areas appear white/bright, simulating cloud coverage
    vec3 dayColor = mix(dayTex, vec3(1.0), cloudsStrength * 2.0);

    // ── Sun orientation (same as official) ──
    float sunOrientation = dot(normal, normalize(sunDir));

    // ── Day/night blend ──
    float dayStrength = smoothstep(-0.25, 0.5, sunOrientation);

    // Base surface: blend night and day
    vec3 surfaceColor = mix(nightTex, dayColor, dayStrength);

    // ── Fresnel for atmosphere edge glow ──
    float fresnel = 1.0 - abs(dot(viewDir, normal));

    // ── Atmosphere overlay ──
    // Same as official: atmosphereDayStrength * fresnel^2, clamped
    float atmosphereDayStrength = smoothstep(-0.5, 1.0, sunOrientation);
    float atmosphereMix = clamp(atmosphereDayStrength * pow(fresnel, 2.0), 0.0, 1.0);

    // Atmosphere color: twilight (warm orange) → day (blue)
    vec3 atmoDayColor     = vec3(0.30, 0.70, 1.00);   // #4db2ff
    vec3 atmoTwilightColor = vec3(0.74, 0.29, 0.04);   // #bc490b
    vec3 atmosphereColor = mix(atmoTwilightColor, atmoDayColor, smoothstep(-0.25, 0.75, sunOrientation));

    // ── Final composition ──
    vec3 finalOutput = mix(surfaceColor, atmosphereColor, atmosphereMix);

    gl_FragColor = vec4(finalOutput, 1.0);
  }
`;

/* ═══════════════════════════════════════════════════════════════
   Atmosphere Glow Shader (BackSide sphere)
   
   Official approach: fresnel.remap(0.73, 1, 1, 0).pow(3) * sunOrientation.smoothstep(-0.5, 1)
   
   Translation: Only visible from edge inward (~73%), pow(3) for sharp falloff,
   multiplied by sun-facing factor.
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
  uniform vec3 sunDir;

  varying vec3 vNormalW;
  varying vec3 vPositionW;

  void main() {
    vec3 normal = normalize(vNormalW);
    vec3 viewDir = normalize(cameraPosition - vPositionW);

    // Fresnel: how much we see the edge vs center
    float fresnel = 1.0 - abs(dot(viewDir, normal));

    // Remap: visible from 73% inward, fades toward center
    // Official: fresnel.remap(0.73, 1, 1, 0) → (fresnel - 0.73) / (1 - 0.73)
    float alpha = clamp((fresnel - 0.73) / 0.27, 0.0, 1.0);
    // Invert: edge=1, center=0
    alpha = 1.0 - alpha;
    // pow(3) for sharp concentration at edge
    alpha = pow(alpha, 3.0);

    // Multiply by sun-facing factor (only sun side has bright atmosphere)
    float sunOrientation = dot(normal, normalize(sunDir));
    alpha *= smoothstep(-0.5, 1.0, sunOrientation);

    // Atmosphere color: twilight → day gradient
    vec3 atmoDayColor     = vec3(0.30, 0.70, 1.00);   // #4db2ff
    vec3 atmoTwilightColor = vec3(0.74, 0.29, 0.04);   // #bc490b
    vec3 atmosphereColor = mix(atmoTwilightColor, atmoDayColor, smoothstep(-0.25, 0.75, sunOrientation));

    gl_FragColor = vec4(atmosphereColor, alpha);
  }
`;

/* ══════════════════════════════════════
   Earth Class
   ══════════════════════════════════════ */

export class Earth {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.radius = options.radius || 1;
    this.group = new THREE.Group();
    this.earthMesh = null;
    this.atmoMesh = null;
    // NO cloudMesh — clouds are in the surface shader now
    this.sunDir = new THREE.Vector3(0, 0, 3).normalize();
    this.rotationAngle = 0;
  }

  async init(onProgress) {
    const textures = await this._loadTextures(onProgress);
    this._createEarthMesh(textures);
    this._createAtmosphere();
    // NO separate cloud sphere
    this.scene.add(this.group);
  }

  async _loadTextures(onProgress) {
    const loader = new THREE.TextureLoader();
    const names = ['day', 'night', 'brc'];
    const total = names.length;
    const textures = {};

    for (let i = 0; i < total; i++) {
      const name = names[i];
      const path = TEXTURE_PATHS[name];
      textures[name] = await new Promise((resolve, reject) => {
        loader.load(path, (tex) => {
          tex.colorSpace = (name === 'day' || name === 'night')
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
          console.warn(`Failed to load texture: ${path}`, err);
          reject(err);
        });
      });
    }

    return textures;
  }

  _createEarthMesh(textures) {
    const segments = window.innerWidth < 768 ? 48 : 64;
    const geometry = new THREE.SphereGeometry(this.radius, segments, segments);

    // Uniforms: day + night + combined BRC (no separate cloud texture!)
    const material = new THREE.ShaderMaterial({
      vertexShader: earthVertexShader,
      fragmentShader: earthFragmentShader,
      uniforms: {
        dayMap:   { value: textures.day },
        nightMap: { value: textures.night },
        brcMap:   { value: textures.brc },
        sunDir:   { value: this.sunDir },
      },
    });

    this.earthMesh = new THREE.Mesh(geometry, material);
    this.group.add(this.earthMesh);
  }

  _createAtmosphere() {
    const atmoRadius = this.radius * 1.04;
    const segments = window.innerWidth < 768 ? 32 : 48;
    const geometry = new THREE.SphereGeometry(atmoRadius, segments, segments);

    const material = new THREE.ShaderMaterial({
      vertexShader: atmoVertexShader,
      fragmentShader: atmoFragmentShader,
      uniforms: {
        sunDir: { value: this.sunDir },
      },
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.atmoMesh = new THREE.Mesh(geometry, material);
    this.group.add(this.atmoMesh);
  }

  update(scrollProgress, deltaTime) {
    // Earth rotation: auto + scroll-driven
    const autoSpeed = deltaTime * 0.025;
    this.rotationAngle += autoSpeed;
    const scrollRotation = scrollProgress * Math.PI * 4;
    this.earthMesh.rotation.y = this.rotationAngle + scrollRotation;
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
