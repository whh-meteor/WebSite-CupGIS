/**
 * CupGIS - Satellite Module
 * ISS-like 3D satellite built from primitives + orbital trajectory rendering
 * Each module gets a dedicated satellite on its own orbit
 */
import * as THREE from 'three';

export class Satellite {
  constructor(scene, config) {
    this.scene = scene;
    this.config = config;
    this.group = new THREE.Group();
    this.orbitLine = null;
    this.glowMesh = null;
    this.active = false;
    this.angle = config.startAngle || 0;

    this._buildModel();
    this._buildOrbit();
    this._buildGlow();
    this._positionOnOrbit();
    this.scene.add(this.group);
  }

  /* ── Build ISS-like satellite from primitives ── */
  _buildModel() {
    const c = this.config;
    const accentColor = new THREE.Color(c.color || '#e63946');

    // Main truss backbone
    const truss = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.08, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xc8cdd4, metalness: 0.7, roughness: 0.3 })
    );
    this.group.add(truss);

    // Central module (cylinder)
    const moduleGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.12, 8);
    const moduleMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.6, roughness: 0.4 });
    const mainModule = new THREE.Mesh(moduleGeom, moduleMat);
    mainModule.rotation.z = Math.PI / 2;
    mainModule.position.set(0, 0, 0);
    this.group.add(mainModule);

    // Second module
    const mod2 = new THREE.Mesh(moduleGeom, moduleMat);
    mod2.rotation.z = Math.PI / 2;
    mod2.position.set(0.10, 0, 0);
    this.group.add(mod2);

    // Solar panel arrays (left & right)
    const panelGeom = new THREE.BoxGeometry(0.36, 0.005, 0.14);
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x1a1c40, metalness: 0.4, roughness: 0.6,
      emissive: 0x0a0a20, emissiveIntensity: 0.2
    });

    const leftPanel = new THREE.Mesh(panelGeom, panelMat);
    leftPanel.position.set(-0.32, 0, 0);
    this.group.add(leftPanel);

    const rightPanel = new THREE.Mesh(panelGeom, panelMat);
    rightPanel.position.set(0.32, 0, 0);
    this.group.add(rightPanel);

    // Solar panel grid lines (thin lines on panels)
    const lineMat = new THREE.LineBasicMaterial({ color: 0x3a4060 });
    for (const panelX of [-0.32, 0.32]) {
      for (let i = -0.06; i <= 0.06; i += 0.03) {
        const pts = [new THREE.Vector3(panelX - 0.18, 0.006, i), new THREE.Vector3(panelX + 0.18, 0.006, i)];
        const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
        this.group.add(new THREE.Line(lineGeom, lineMat));
      }
    }

    // Panel masts
    const mastGeom = new THREE.BoxGeometry(0.12, 0.02, 0.02);
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x556070, metalness: 0.8, roughness: 0.2 });
    const leftMast = new THREE.Mesh(mastGeom, mastMat);
    leftMast.position.set(-0.16, 0, 0);
    this.group.add(leftMast);
    const rightMast = new THREE.Mesh(mastGeom, mastMat);
    rightMast.position.set(0.16, 0, 0);
    this.group.add(rightMast);

    // Antenna boom
    const boomGeom = new THREE.CylinderGeometry(0.005, 0.005, 0.15, 4);
    const boomMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.1 });
    const antenna = new THREE.Mesh(boomGeom, boomMat);
    antenna.position.set(0.05, 0.08, 0);
    this.group.add(antenna);

    // Dish antenna
    const dishGeom = new THREE.SphereGeometry(0.03, 8, 4, 0, Math.PI * 2, 0, Math.PI / 3);
    const dishMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide });
    const dish = new THREE.Mesh(dishGeom, dishMat);
    dish.position.set(0.05, 0.16, 0);
    dish.rotation.x = Math.PI;
    this.group.add(dish);

    // Red accent beacon (module color)
    const beaconGeom = new THREE.SphereGeometry(0.012, 8, 8);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: accentColor, emissive: accentColor, emissiveIntensity: 0.8
    });
    const beacon = new THREE.Mesh(beaconGeom, beaconMat);
    beacon.position.set(0.14, 0.05, 0);
    this.group.add(beacon);

    // Radiator panels
    const radGeom = new THREE.BoxGeometry(0.08, 0.003, 0.06);
    const radMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, metalness: 0.5, roughness: 0.5 });
    const rad1 = new THREE.Mesh(radGeom, radMat);
    rad1.position.set(-0.02, -0.04, 0);
    this.group.add(rad1);
    const rad2 = new THREE.Mesh(radGeom, radMat);
    rad2.position.set(0.06, -0.04, 0);
    this.group.add(rad2);

    // Scale the model based on orbit radius
    const s = 0.6;
    this.group.scale.set(s, s, s);
  }

  /* ── Build orbital trajectory line ── */
  _buildOrbit() {
    const c = this.config;
    const radius = c.radius || 1.5;
    const inclination = (c.inclination || 45) * Math.PI / 180;
    const points = [];

    for (let i = 0; i <= 360; i += 2) {
      const a = (i / 360) * Math.PI * 2;
      const x = radius * Math.cos(a);
      const y = radius * Math.sin(a) * Math.sin(inclination);
      const z = radius * Math.sin(a) * Math.cos(inclination);
      points.push(new THREE.Vector3(x, y, z));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const color = new THREE.Color(c.color || '#e63946');
    const material = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.25,
      depthWrite: false
    });
    this.orbitLine = new THREE.Line(geometry, material);
    this.scene.add(this.orbitLine);
  }

  /* ── Glow sphere for active state ── */
  _buildGlow() {
    const color = new THREE.Color(this.config.color || '#e63946');
    const glowGeom = new THREE.SphereGeometry(0.15, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.glowMesh = new THREE.Mesh(glowGeom, glowMat);
    this.group.add(this.glowMesh);
  }

  /* ── Position satellite on its orbit ── */
  _positionOnOrbit() {
    const c = this.config;
    const radius = c.radius || 1.5;
    const inclination = (c.inclination || 45) * Math.PI / 180;
    const a = this.angle;

    const x = radius * Math.cos(a);
    const y = radius * Math.sin(a) * Math.sin(inclination);
    const z = radius * Math.sin(a) * Math.cos(inclination);
    this.group.position.set(x, y, z);

    // Orient satellite: face direction of travel
    const nextA = a + 0.01;
    const nx = radius * Math.cos(nextA);
    const ny = radius * Math.sin(nextA) * Math.sin(inclination);
    const nz = radius * Math.sin(nextA) * Math.cos(inclination);
    this.group.lookAt(nx, ny, nz);
  }

  /* ── Update each frame ── */
  update(deltaTime) {
    const speed = (this.config.speed || 0.3) * deltaTime;
    this.angle += speed;
    this._positionOnOrbit();

    // Glow pulse when active
    if (this.glowMesh) {
      const targetOpacity = this.active ? 0.35 : 0;
      this.glowMesh.material.opacity += (targetOpacity - this.glowMesh.material.opacity) * 0.1;
      if (this.active) {
        const pulse = 0.15 + Math.sin(Date.now() * 0.003) * 0.05;
        this.glowMesh.scale.setScalar(pulse / 0.15);
      }
    }

    // Orbit line visibility
    if (this.orbitLine) {
      const targetOpacity = this.active ? 0.5 : 0.15;
      this.orbitLine.material.opacity += (targetOpacity - this.orbitLine.material.opacity) * 0.05;
    }
  }

  setActive(isActive) {
    this.active = isActive;
  }

  dispose() {
    this.group.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });
    this.scene.remove(this.group);
    if (this.orbitLine) {
      this.orbitLine.geometry.dispose();
      this.orbitLine.material.dispose();
      this.scene.remove(this.orbitLine);
    }
  }
}
