/**
 * CupGIS - Scene Manager
 * Three.js scene orchestration: renderer, camera, lights, render loop
 * Manages Earth (real NASA textures), Satellites, StarField, scroll-driven camera
 */
import * as THREE from 'three';
import { Earth } from './earth.js';
import { Satellite } from './satellite.js';
import { StarField } from './starfield.js';

export class SceneManager {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.earth = null;
    this.satellites = [];
    this.starField = null;
    this.clock = new THREE.Clock();
    this.scrollProgress = 0;
    this.activeModuleIndex = -1;
    this.isReady = false;
    this._animationId = null;

    // Camera path waypoints (relative to Earth at origin)
    // Each waypoint corresponds to viewing a different satellite
    this.cameraWaypoints = [
      { pos: [0, 2, 7],    look: [0, 0, 0] },    // Hero: distant overview
      { pos: [1.5, 1.5, 4], look: [0, 0, 0] },    // Module 0
      { pos: [-1, 2, 5],    look: [0, 0, 0] },    // Module 1
      { pos: [2, 0.8, 3.5], look: [0, 0, 0] },    // Module 2
      { pos: [0, 3.5, 3],   look: [0, 0, 0] },    // Module 3 (polar view)
      { pos: [-2, 1.2, 4.5],look: [0, 0, 0] },    // Module 4
      { pos: [0, 1.8, 6],   look: [0, 0, 0] },    // Module 5
    ];

    this._currentCamPos = new THREE.Vector3(0, 2, 7);
    this._currentLookAt = new THREE.Vector3(0, 0, 0);
  }

  async init(moduleConfigs, onProgress) {
    this._setupRenderer();
    this._setupScene();
    this._setupCamera();
    this._setupLights();

    // Create Earth with real NASA textures
    this.earth = new Earth(this.scene, { radius: 1 });
    onProgress(0.05);
    await this.earth.init((p) => onProgress(0.05 + p * 0.7)); // Texture loading = 5%-75%
    onProgress(0.75);

    // Create StarField
    const starCount = window.innerWidth < 768 ? 1500 : 3000;
    this.starField = new StarField(this.scene, starCount);
    onProgress(0.80);

    // Create Satellites (one per module)
    for (const config of moduleConfigs) {
      const sat = new Satellite(this.scene, config);
      this.satellites.push(sat);
    }
    onProgress(0.90);

    // Initial camera position
    this.camera.position.copy(this._currentCamPos);
    this.camera.lookAt(this._currentLookAt);

    this.isReady = true;
    onProgress(1.0);
    this._startRenderLoop();
  }

  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Handle resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  _setupScene() {
    this.scene = new THREE.Scene();
  }

  _setupCamera() {
    this.camera = new THREE.PerspectiveCamera(
      25, // Tighter FOV like official example (25°)
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );
  }

  _setupLights() {
    // Sun directional light (same position as sunDir for consistency)
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
    sunLight.position.set(0, 0, 3); // Matches earth.js sunDir
    this.scene.add(sunLight);

    // Very subtle ambient fill for night side
    const ambient = new THREE.AmbientLight(0x111122, 0.15);
    this.scene.add(ambient);
  }

  _startRenderLoop() {
    const animate = () => {
      this._animationId = requestAnimationFrame(animate);
      const delta = this.clock.getDelta();
      const elapsed = this.clock.getElapsedTime();

      if (document.hidden) return; // Pause when tab hidden

      // Update Earth
      this.earth.update(this.scrollProgress, delta);

      // Update StarField
      this.starField.update(elapsed);

      // Update Satellites
      for (const sat of this.satellites) {
        sat.update(delta);
      }

      // Smooth camera transition
      this._updateCamera(delta);

      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  _updateCamera(delta) {
    const progress = this.scrollProgress;
    const numModules = this.satellites.length;

    // Map scroll progress to camera waypoint index
    const heroEnd = 0.08;
    const moduleSpan = (1 - heroEnd) / numModules;
    const moduleIndex = Math.min(
      numModules - 1,
      Math.max(0, Math.floor((progress - heroEnd) / moduleSpan))
    );
    const localProgress = ((progress - heroEnd) / moduleSpan) - moduleIndex;

    // Determine target waypoint
    let wpIndex;
    let t = 0;
    if (progress < heroEnd) {
      wpIndex = 0;
      t = progress / heroEnd;
    } else {
      wpIndex = 1 + moduleIndex;
      t = Math.min(1, Math.max(0, localProgress));
    }

    // Smooth interpolation between waypoints
    const fromWP = this.cameraWaypoints[Math.max(0, wpIndex)];
    const toWP = this.cameraWaypoints[Math.min(this.cameraWaypoints.length - 1, wpIndex + 1)];

    const fromPos = new THREE.Vector3(...fromWP.pos);
    const toPos = new THREE.Vector3(...toWP.pos);
    const fromLook = new THREE.Vector3(...fromWP.look);
    const toLook = new THREE.Vector3(...toWP.look);

    // Ease function
    const easeT = t * t * (3 - 2 * t); // smoothstep

    const targetPos = fromPos.clone().lerp(toPos, easeT);
    const targetLook = fromLook.clone().lerp(toLook, easeT);

    // Smooth camera movement (not instant)
    const smoothing = 1 - Math.pow(0.03, delta);
    this._currentCamPos.lerp(targetPos, smoothing);
    this._currentLookAt.lerp(targetLook, smoothing);

    this.camera.position.copy(this._currentCamPos);
    this.camera.lookAt(this._currentLookAt);
  }

  setScrollProgress(progress) {
    this.scrollProgress = progress;
  }

  setActiveModule(index) {
    this.activeModuleIndex = index;
    for (let i = 0; i < this.satellites.length; i++) {
      this.satellites[i].setActive(i === index);
    }
  }

  dispose() {
    if (this._animationId) cancelAnimationFrame(this._animationId);
    this.earth.dispose();
    this.starField.dispose();
    this.satellites.forEach(s => s.dispose());
    this.renderer.dispose();
  }
}
