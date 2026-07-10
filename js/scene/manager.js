/**
 * CupGIS - 场景管理器
 * Three.js 首屏 3D 场景：真实地球（含太阳/月球/轨道/星空/大气/昼夜交替）
 * 鼠标交互：OrbitControls 拖拽旋转 + 滚轮缩放 + 自动旋转
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Earth } from './earth.js';

export class SceneManager {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.earth = null;
    this.clock = new THREE.Clock();
    this.scrollProgress = 0;
    this.activeModuleIndex = -1;
    this.isReady = false;
    this._animationId = null;
  }

  async init(moduleConfigs, onProgress) {
    this._setupRenderer();
    this._setupScene();
    this._setupCamera();
    this._setupLights();
    this._setupControls();

    // 真实地球场景（内置太阳/月球/星空/大气/昼夜）
    this.earth = new Earth(this.scene, { radius: 1 });
    onProgress(0.05);
    await this.earth.init((p) => onProgress(0.05 + p * 0.9));
    onProgress(1.0);

    // 初始相机位置
    this.camera.position.set(0, 0.6, 4.6);
    this.camera.lookAt(0, 0.15, 0);

    this.isReady = true;
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
      42,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );
  }

  _setupLights() {
    // 极弱环境光，主要光照由地球着色器基于太阳位置计算
    const ambient = new THREE.AmbientLight(0x222233, 0.2);
    this.scene.add(ambient);
  }

  /** OrbitControls：鼠标拖拽旋转 + 滚轮缩放 + 自动旋转 */
  _setupControls() {
    this.controls = new OrbitControls(this.camera, this.canvas);
    // 允许旋转
    this.controls.enableRotate = true;
    // 允许缩放
    this.controls.enableZoom = true;
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 12;
    // 禁用平移（避免位移到空白处）
    this.controls.enablePan = false;
    // 自动旋转（用户未交互时缓慢转动）
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.4;
    // 旋转阻尼（惯性平滑）
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    // 限制极角避免翻面
    this.controls.minPolarAngle = 0.2;
    this.controls.maxPolarAngle = Math.PI - 0.2;
    // 初始目标
    this.controls.target.set(0, 0.15, 0);
    this.controls.update();
  }

  _startRenderLoop() {
    const animate = () => {
      this._animationId = requestAnimationFrame(animate);
      const delta = this.clock.getDelta();

      if (document.hidden) return;

      this.earth.update(this.scrollProgress, delta);
      // OrbitControls 阻尼更新
      if (this.controls) this.controls.update();

      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  setScrollProgress(progress) {
    this.scrollProgress = progress;
  }

  setActiveModule(index) {
    this.activeModuleIndex = index;
  }

  dispose() {
    if (this._animationId) cancelAnimationFrame(this._animationId);
    if (this.controls) this.controls.dispose();
    if (this.earth) this.earth.dispose();
    if (this.renderer) this.renderer.dispose();
  }
}
