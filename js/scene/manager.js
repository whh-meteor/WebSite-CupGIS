/**
 * CupGIS - 场景管理器
 * Three.js 首屏 3D 场景：地球 + 卫星编队 + 星空
 * 仅首屏展示，滚动后画布淡出；相机采用固定视角 + 鼠标视差
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

    // 首屏固定视角基础参数
    this._baseCamPos = new THREE.Vector3(0, 1.0, 3.4);
    this._baseLookAt = new THREE.Vector3(0, 0, 0);
    this._currentCamPos = this._baseCamPos.clone();
    this._currentLookAt = this._baseLookAt.clone();

    // 鼠标视差目标
    this._targetMouseX = 0;
    this._targetMouseY = 0;
  }

  async init(moduleConfigs, onProgress) {
    this._setupRenderer();
    this._setupScene();
    this._setupCamera();
    this._setupLights();
    this._setupMouseParallax();

    // 地球（真实 NASA 纹理）
    this.earth = new Earth(this.scene, { radius: 1 });
    onProgress(0.05);
    await this.earth.init((p) => onProgress(0.05 + p * 0.7)); // 纹理占 5%-75%
    onProgress(0.75);

    // 星空
    const starCount = window.innerWidth < 768 ? 1500 : 3000;
    this.starField = new StarField(this.scene, starCount);
    onProgress(0.80);

    // 卫星编队（每模块一架）
    for (const config of moduleConfigs) {
      const sat = new Satellite(this.scene, config);
      this.satellites.push(sat);
    }
    onProgress(0.90);

    // 初始相机
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
    this.renderer.setClearColor(0x0a0a0c, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

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
      32,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );
  }

  _setupLights() {
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
    sunLight.position.set(0, 0, 3);
    this.scene.add(sunLight);
    const ambient = new THREE.AmbientLight(0x111122, 0.15);
    this.scene.add(ambient);
  }

  /** 鼠标视差：相机随鼠标轻微偏移 */
  _setupMouseParallax() {
    window.addEventListener('mousemove', (e) => {
      this._targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
      this._targetMouseY = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  _startRenderLoop() {
    const animate = () => {
      this._animationId = requestAnimationFrame(animate);
      const delta = this.clock.getDelta();
      const elapsed = this.clock.getElapsedTime();

      if (document.hidden) return; // 标签页隐藏时暂停

      this.earth.update(this.scrollProgress, delta);
      this.starField.update(elapsed);
      for (const sat of this.satellites) sat.update(delta);

      this._updateCamera(delta);

      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  /** 相机：固定视角 + 鼠标视差平滑跟随 */
  _updateCamera(delta) {
    // 视差偏移量
    const parallaxX = this._targetMouseX * 0.35;
    const parallaxY = -this._targetMouseY * 0.2;

    const targetPos = this._baseCamPos.clone().add(new THREE.Vector3(parallaxX, parallaxY, 0));
    const targetLook = this._baseLookAt.clone().add(new THREE.Vector3(parallaxX * 0.3, parallaxY * 0.3, 0));

    // 平滑插值
    const smoothing = 1 - Math.pow(0.04, delta);
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
