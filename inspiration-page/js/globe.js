/**
 * globe.js - 3D 地球模块（第5轮：视觉打磨）
 *
 * 功能：
 * - NASA Blue Marble 日间纹理 + Night Lights 夜间纹理叠加
 * - 改进菲涅尔大气辉光 Shader
 * - 星空粒子（入场 opacity 渐入）
 * - 淡经纬网格线（近距才可见）
 * - 标记点：渐变透明光柱 Shader + 底座涟漪 + 粒子上升
 * - 入场序列钩子（地球飞近 + 大气渐入）
 * - CSS2DRenderer hover 卡片 / Raycasting
 *
 * 纹理来源：
 * - 日间：NASA Blue Marble (unpkg CDN)
 * - 夜间：NASA Night Lights (unpkg CDN)
 * - 凹凸：Earth Topology (unpkg CDN)
 */

import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// ===== 配置 =====
const CONFIG = {
  earthRadius: 5,
  earthSegments: 64,
  earthTextureUrl: 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
  earthNightUrl: 'https://unpkg.com/three-globe/example/img/earth-night.jpg',
  earthBumpUrl: 'https://unpkg.com/three-globe/example/img/earth-topology.png',
  bumpScale: 0.05,

  atmosphereRadius: 5.18,
  atmosphereColor: 0x4fc3f7,

  starCount: 3000,
  starFieldRadius: 400,

  cameraFov: 45, cameraNear: 0.1, cameraFar: 1000,
  cameraDistance: 16,
  cameraEntryDistance: 40,   // 入场起始距离
  zoomMin: 8, zoomMax: 30,

  autoRotateSpeed: 0.0008,
  idleTimeout: 3000,

  ambientIntensity: 0.35,
  dirLightIntensity: 1.1,
  dirLightPos: [5, 3, 5],

  marker: {
    clusterDeg: 5,
    baseRadius: 0.04,
    pillarRadius: 0.025,
    pillarMinH: 0.15,
    pillarMaxH: 0.7,
    pillarSegments: 8,
    hoverScale: 1.25,
    enterDuration: 500,
    exitDuration: 300,
    surfaceOffset: 0.02,
    rippleCount: 2,            // 涟漪圈数
    particleCount: 6,          // 每个标记的上升粒子数
  },
  flyToZoomDist: 10,
};

// ===== 工具函数 =====
export function latLngToVector3(lat, lng, radius = CONFIG.earthRadius) {
  const phi   = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
     radius * Math.cos(phi),
     radius * Math.sin(phi) * Math.sin(theta)
  );
}

export function clusterAssets(assets, thresholdDeg = CONFIG.marker.clusterDeg) {
  const clusters = [];
  const used = new Set();
  for (let i = 0; i < assets.length; i++) {
    if (used.has(i)) continue;
    const group = [assets[i]];
    used.add(i);
    for (let j = i + 1; j < assets.length; j++) {
      if (used.has(j)) continue;
      if (Math.abs(assets[i].lat - assets[j].lat) <= thresholdDeg &&
          Math.abs(assets[i].lng - assets[j].lng) <= thresholdDeg) {
        group.push(assets[j]);
        used.add(j);
      }
    }
    const avgLat = group.reduce((s, a) => s + a.lat, 0) / group.length;
    const avgLng = group.reduce((s, a) => s + a.lng, 0) / group.length;
    clusters.push({ lat: avgLat, lng: avgLng, assets: group,
                    regionName: group[0].regionName, periodName: group[0].periodName });
  }
  return clusters;
}

// ===== 光柱渐变 Shader =====
const PILLAR_VS = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const PILLAR_FS = `
  uniform vec3 color;
  uniform float opacity;
  varying vec2 vUv;
  void main() {
    float fade = 1.0 - pow(vUv.y, 0.6);
    float base = 0.3 + 0.7 * smoothstep(0.0, 0.1, vUv.y);
    float alpha = opacity * fade * base;
    gl_FragColor = vec4(color * 1.3, alpha);
  }
`;

// ===== GlobeModule 类 =====
export class GlobeModule {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.labelRenderer = null;
    this.earth = null;
    this.earthNight = null;
    this.atmosphere = null;
    this.gridLines = null;
    this.stars = null;

    this.isDragging = false;
    this.isAutoRotating = true;
    this.lastInteraction = 0;
    this.mouse = { x: 0, y: 0, prevX: 0, prevY: 0 };
    this.spherical = { theta: 0, phi: Math.PI / 2 };

    this.targetDistance = CONFIG.cameraDistance;
    this.currentDistance = CONFIG.cameraEntryDistance; // 入场起始远处

    this._rafId = null;
    this._resizeHandler = null;

    this.onLoadProgress = null;
    this.onLoadComplete = null;

    // 入场序列
    this._entryPhase = 'waiting'; // waiting | animating | done

    // 标记点
    this.markersGroup = null;
    this._markerMeshes = [];
    this._hoveredMarker = null;
    this._raycaster = new THREE.Raycaster();
    this._mouseNDC = new THREE.Vector2();
    this._currentColor = '#CD853F';
    this._animatingOut = false;
    this._clock = new THREE.Clock();

    this.onMarkerClick = null;
    this.onMarkerHover = null;
  }

  async init() {
    this._initScene();
    this._initCamera();
    this._initRenderer();
    this._initLabelRenderer();
    this._initLights();
    this._createStarField();
    await this._createEarth();
    this._createAtmosphere();
    this._createGridLines();
    this._initMarkersGroup();
    this._initInteractions();
    this._initResize();
    this._animate();
  }

  _initScene() { this.scene = new THREE.Scene(); }

  _initCamera() {
    const { clientWidth: w, clientHeight: h } = this.container;
    this.camera = new THREE.PerspectiveCamera(CONFIG.cameraFov, w / h, CONFIG.cameraNear, CONFIG.cameraFar);
    this._updateCameraPosition();
  }

  _updateCameraPosition() {
    const { theta, phi } = this.spherical;
    const d = this.currentDistance;
    this.camera.position.set(
      d * Math.sin(phi) * Math.sin(theta),
      d * Math.cos(phi),
      d * Math.sin(phi) * Math.cos(theta)
    );
    this.camera.lookAt(0, 0, 0);
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);
  }

  _initLabelRenderer() {
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = '0';
    this.labelRenderer.domElement.style.left = '0';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    this.labelRenderer.domElement.classList.add('globe-labels');
    this.container.appendChild(this.labelRenderer.domElement);
  }

  _initLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, CONFIG.ambientIntensity));
    const dl = new THREE.DirectionalLight(0xffffff, CONFIG.dirLightIntensity);
    dl.position.set(...CONFIG.dirLightPos);
    this.scene.add(dl);
  }

  // ---------- 星空 ----------
  _createStarField() {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(CONFIG.starCount * 3);
    for (let i = 0; i < CONFIG.starCount; i++) {
      const r = CONFIG.starFieldRadius;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      pos[i*3] = r*Math.sin(p)*Math.cos(t);
      pos[i*3+1] = r*Math.sin(p)*Math.sin(t);
      pos[i*3+2] = r*Math.cos(p);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, sizeAttenuation: true, transparent: true, opacity: 0 });
    this.stars = new THREE.Points(geo, mat);
    this.scene.add(this.stars);
  }

  // ---------- 地球 ----------
  async _createEarth() {
    const loader = new THREE.TextureLoader();
    const load = (u) => new Promise((res, rej) => {
      loader.load(u, t => res(t), p => {
        if (this.onLoadProgress && p.total > 0) this.onLoadProgress(Math.round(p.loaded/p.total*100));
      }, e => rej(e));
    });

    try {
      const [dayTex, nightTex, bumpTex] = await Promise.all([
        load(CONFIG.earthTextureUrl),
        load(CONFIG.earthNightUrl).catch(() => null),
        load(CONFIG.earthBumpUrl).catch(() => null),
      ]);

      const geo = new THREE.SphereGeometry(CONFIG.earthRadius, CONFIG.earthSegments, CONFIG.earthSegments);

      // 日间球
      const mat = new THREE.MeshPhongMaterial({
        map: dayTex, bumpMap: bumpTex, bumpScale: CONFIG.bumpScale,
        specular: new THREE.Color(0x222222), shininess: 15,
      });
      this.earth = new THREE.Mesh(geo, mat);
      this.scene.add(this.earth);

      // 夜间球（叠加在日间球上方，用 additive blending）
      if (nightTex) {
        const nightMat = new THREE.MeshBasicMaterial({
          map: nightTex, transparent: true, opacity: 0.6,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        this.earthNight = new THREE.Mesh(geo.clone(), nightMat);
        this.earthNight.scale.setScalar(1.001); // 微偏避免 z-fighting
        this.scene.add(this.earthNight);
      }

      if (this.onLoadComplete) this.onLoadComplete();
    } catch {
      const geo = new THREE.SphereGeometry(CONFIG.earthRadius, CONFIG.earthSegments, CONFIG.earthSegments);
      this.earth = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color: 0x1a3a5c }));
      this.scene.add(this.earth);
      if (this.onLoadComplete) this.onLoadComplete();
    }
  }

  // ---------- 菲涅尔大气辉光 ----------
  _createAtmosphere() {
    const vs = `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }`;
    const fs = `
      uniform vec3 glowColor;
      uniform float intensity;
      uniform vec3 cameraPos;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      void main() {
        vec3 viewDir = normalize(cameraPos - vWorldPos);
        float fresnel = 1.0 - dot(viewDir, vWorldNormal);
        fresnel = clamp(fresnel, 0.0, 1.0);
        float glow = pow(fresnel, 3.5) * intensity;
        gl_FragColor = vec4(glowColor, glow);
      }`;
    const geo = new THREE.SphereGeometry(CONFIG.atmosphereRadius, CONFIG.earthSegments, CONFIG.earthSegments);
    this._atmoMat = new THREE.ShaderMaterial({
      vertexShader: vs, fragmentShader: fs,
      uniforms: {
        glowColor: { value: new THREE.Color(CONFIG.atmosphereColor) },
        intensity: { value: 0 }, // 入场时从0渐入
        cameraPos: { value: new THREE.Vector3() },
      },
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    this.atmosphere = new THREE.Mesh(geo, this._atmoMat);
    this.scene.add(this.atmosphere);
  }

  // ---------- 经纬网格线 ----------
  _createGridLines() {
    const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.04, depthWrite: false });
    const group = new THREE.Group();
    const R = CONFIG.earthRadius + 0.01;

    // 纬度线 (每30度)
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts = [];
      const phi = (90 - lat) * Math.PI / 180;
      for (let i = 0; i <= 64; i++) {
        const theta = (i / 64) * Math.PI * 2;
        pts.push(new THREE.Vector3(
          -R * Math.sin(phi) * Math.cos(theta),
           R * Math.cos(phi),
           R * Math.sin(phi) * Math.sin(theta)
        ));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      group.add(new THREE.Line(geo, material));
    }

    // 经度线 (每30度)
    for (let lng = 0; lng < 360; lng += 30) {
      const pts = [];
      const theta = (lng + 180) * Math.PI / 180;
      for (let i = 0; i <= 64; i++) {
        const phi = (i / 64) * Math.PI;
        pts.push(new THREE.Vector3(
          -R * Math.sin(phi) * Math.cos(theta),
           R * Math.cos(phi),
           R * Math.sin(phi) * Math.sin(theta)
        ));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      group.add(new THREE.Line(geo, material));
    }

    this.gridLines = group;
    this.scene.add(group);
  }

  // ===== 标记点系统 =====
  _initMarkersGroup() {
    this.markersGroup = new THREE.Group();
    this.markersGroup.name = 'markers';
    this.scene.add(this.markersGroup);
  }

  setMarkers(assets, color = '#CD853F', animated = true) {
    this._currentColor = color;
    if (animated && this._markerMeshes.length > 0) {
      this._animateMarkersOut(() => { this._clearMarkers(); this._buildMarkers(assets, color, true); });
    } else {
      this._clearMarkers(); this._buildMarkers(assets, color, animated);
    }
  }

  _buildMarkers(assets, color, animated) {
    if (!assets || !assets.length) return;
    const clusters = clusterAssets(assets);
    const maxCount = Math.max(...clusters.map(c => c.assets.length), 1);
    const threeColor = new THREE.Color(color);

    clusters.forEach((cluster, ci) => {
      const count = cluster.assets.length;
      const t = maxCount > 1 ? (count - 1) / (maxCount - 1) : 0;
      const targetH = CONFIG.marker.pillarMinH + t * (CONFIG.marker.pillarMaxH - CONFIG.marker.pillarMinH);
      const surfacePos = latLngToVector3(cluster.lat, cluster.lng, CONFIG.earthRadius + CONFIG.marker.surfaceOffset);
      const normal = surfacePos.clone().normalize();

      const mg = new THREE.Group();
      mg.position.copy(surfacePos);
      mg.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), normal);
      mg.userData = { cluster, targetH, currentH: 0 };

      // 底座环
      const baseGeo = new THREE.RingGeometry(CONFIG.marker.baseRadius*0.5, CONFIG.marker.baseRadius*1.5, 16);
      const baseMat = new THREE.MeshBasicMaterial({ color: threeColor, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.rotation.x = -Math.PI/2;
      mg.add(baseMesh);

      // 涟漪环 (2圈)
      const ripples = [];
      for (let r = 0; r < CONFIG.marker.rippleCount; r++) {
        const ripGeo = new THREE.RingGeometry(CONFIG.marker.baseRadius*1.5, CONFIG.marker.baseRadius*1.8, 24);
        const ripMat = new THREE.MeshBasicMaterial({ color: threeColor, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
        const ripMesh = new THREE.Mesh(ripGeo, ripMat);
        ripMesh.rotation.x = -Math.PI/2;
        ripMesh.userData = { phase: r * Math.PI }; // 错开相位
        mg.add(ripMesh);
        ripples.push(ripMesh);
      }

      // 渐变光柱 (Shader)
      const pillarGeo = new THREE.CylinderGeometry(CONFIG.marker.pillarRadius, CONFIG.marker.pillarRadius*1.3, 1, CONFIG.marker.pillarSegments, 1, true);
      const pillarMat = new THREE.ShaderMaterial({
        vertexShader: PILLAR_VS, fragmentShader: PILLAR_FS,
        uniforms: { color: { value: threeColor }, opacity: { value: 0.85 } },
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
      });
      const pillarMesh = new THREE.Mesh(pillarGeo, pillarMat);
      pillarMesh.scale.set(1, 0.001, 1);
      mg.add(pillarMesh);

      // 顶部光点
      const tipGeo = new THREE.SphereGeometry(CONFIG.marker.pillarRadius*1.2, 8, 8);
      const tipMat = new THREE.MeshBasicMaterial({ color: threeColor, transparent: true, opacity: 0.8 });
      const tipMesh = new THREE.Mesh(tipGeo, tipMat);
      tipMesh.visible = false;
      mg.add(tipMesh);

      // 上升粒子
      const particles = [];
      for (let p = 0; p < CONFIG.marker.particleCount; p++) {
        const pGeo = new THREE.SphereGeometry(0.008, 4, 4);
        const pMat = new THREE.MeshBasicMaterial({ color: threeColor, transparent: true, opacity: 0 });
        const pMesh = new THREE.Mesh(pGeo, pMat);
        pMesh.visible = false;
        pMesh.userData = { speed: 0.2 + Math.random()*0.3, offset: Math.random()*Math.PI*2 };
        mg.add(pMesh);
        particles.push(pMesh);
      }

      // Tooltip
      const labelDiv = this._createLabelDiv(cluster);
      const labelObj = new CSS2DObject(labelDiv);
      labelObj.position.set(0, targetH + 0.12, 0);
      labelObj.visible = false;
      mg.add(labelObj);

      this.markersGroup.add(mg);
      this._markerMeshes.push({
        group: mg, pillar: pillarMesh, base: baseMesh, tip: tipMesh,
        label: labelObj, cluster, targetH, color: threeColor,
        ripples, particles,
      });

      if (animated) {
        this._animateMarkerIn(this._markerMeshes[this._markerMeshes.length-1], ci*60);
      } else {
        pillarMesh.scale.set(1, targetH, 1);
        pillarMesh.position.y = targetH/2;
        tipMesh.position.y = targetH;
        tipMesh.visible = true;
        mg.userData.currentH = targetH;
      }
    });
  }

  _createLabelDiv(cluster) {
    const div = document.createElement('div');
    div.className = 'marker-tooltip';
    const thumbs = cluster.assets.slice(0,3).map(a =>
      `<img src="${a.thumbnail}" alt="${a.name}" class="marker-tooltip-thumb">`).join('');
    div.innerHTML = `
      <div class="marker-tooltip-title">${cluster.regionName} · ${cluster.periodName}</div>
      <div class="marker-tooltip-count">${cluster.assets.length} 件文化资产</div>
      ${thumbs ? `<div class="marker-tooltip-thumbs">${thumbs}</div>` : ''}`;
    return div;
  }

  _animateMarkerIn(marker, delay = 0) {
    const { pillar, tip, group } = marker;
    const targetH = marker.targetH;
    const start = performance.now() + delay;
    const dur = CONFIG.marker.enterDuration;
    const tick = (now) => {
      const elapsed = now - start;
      if (elapsed < 0) { requestAnimationFrame(tick); return; }
      const t = Math.min(elapsed/dur, 1);
      const e = t === 1 ? 1 : 1 - Math.pow(2, -10*t) * Math.cos((t*10-0.75)*(2*Math.PI/3));
      const h = targetH * e;
      pillar.scale.set(1, Math.max(h, 0.001), 1);
      pillar.position.y = h/2;
      tip.position.y = h;
      tip.visible = h > 0.02;
      group.userData.currentH = h;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  _animateMarkersOut(onComplete) {
    if (!this._markerMeshes.length) { onComplete(); return; }
    this._animatingOut = true;
    const dur = CONFIG.marker.exitDuration;
    const startH = this._markerMeshes.map(m => m.group.userData.currentH || m.targetH);
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      const t = Math.min(elapsed/dur, 1);
      const e = 1 - (1-t)*(1-t);
      this._markerMeshes.forEach((m, i) => {
        const h = startH[i]*(1-e);
        m.pillar.scale.set(1, Math.max(h,0.001), 1);
        m.pillar.position.y = h/2;
        m.tip.position.y = h;
        m.tip.visible = h > 0.02;
        m.base.material.opacity = 0.6*(1-e);
        m.group.userData.currentH = h;
      });
      if (t < 1) requestAnimationFrame(tick);
      else { this._animatingOut = false; onComplete(); }
    };
    requestAnimationFrame(tick);
  }

  _clearMarkers() {
    this._markerMeshes.forEach(m => {
      m.label.visible = false;
      m.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      this.markersGroup.remove(m.group);
    });
    this._markerMeshes = [];
    this._hoveredMarker = null;
  }

  // ---------- 涟漪 + 粒子 per-frame 更新 ----------
  _updateMarkerEffects(dt) {
    const time = this._clock.getElapsedTime();
    this._markerMeshes.forEach(m => {
      const h = m.group.userData.currentH;
      if (h < 0.02) return;

      // 涟漪
      m.ripples.forEach(rip => {
        const phase = rip.userData.phase;
        const cycle = (time * 1.2 + phase) % (Math.PI * 2);
        const progress = cycle / (Math.PI * 2);
        const scale = 1 + progress * 2.5;
        rip.scale.set(scale, scale, 1);
        rip.material.opacity = 0.25 * (1 - progress);
      });

      // 粒子上升
      m.particles.forEach(p => {
        p.visible = true;
        const { speed, offset } = p.userData;
        const cycle = ((time * speed + offset) % 1);
        p.position.y = cycle * h;
        p.position.x = Math.sin(time * 2 + offset) * 0.02;
        p.position.z = Math.cos(time * 2 + offset) * 0.02;
        p.material.opacity = 0.6 * Math.sin(cycle * Math.PI);
      });
    });
  }

  // ---------- 交互 ----------
  _initInteractions() {
    const el = this.renderer.domElement;
    let pointerDownPos = null;

    el.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.isAutoRotating = false;
      this.lastInteraction = Date.now();
      this.mouse.prevX = e.clientX;
      this.mouse.prevY = e.clientY;
      pointerDownPos = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    });

    el.addEventListener('pointermove', (e) => {
      const rect = this.container.getBoundingClientRect();
      this._mouseNDC.x = ((e.clientX - rect.left)/rect.width)*2 - 1;
      this._mouseNDC.y = -((e.clientY - rect.top)/rect.height)*2 + 1;
      if (!this.isDragging) { this._checkHover(); return; }
      const dx = e.clientX - this.mouse.prevX;
      const dy = e.clientY - this.mouse.prevY;
      this.spherical.theta -= dx * 0.005;
      this.spherical.phi = Math.max(0.1, Math.min(Math.PI-0.1, this.spherical.phi - dy*0.005));
      this.mouse.prevX = e.clientX;
      this.mouse.prevY = e.clientY;
      this.lastInteraction = Date.now();
    });

    el.addEventListener('pointerup', (e) => {
      const wasDrag = pointerDownPos && (Math.abs(e.clientX-pointerDownPos.x)>4 || Math.abs(e.clientY-pointerDownPos.y)>4);
      this.isDragging = false;
      el.releasePointerCapture(e.pointerId);
      this.lastInteraction = Date.now();
      pointerDownPos = null;
      if (!wasDrag) this._checkClick();
    });

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.targetDistance = Math.max(CONFIG.zoomMin, Math.min(CONFIG.zoomMax, this.targetDistance + e.deltaY*0.01));
      this.lastInteraction = Date.now();
      this.isAutoRotating = false;
    }, { passive: false });
  }

  _checkHover() {
    if (this._animatingOut || !this._markerMeshes.length) return;
    this._raycaster.setFromCamera(this._mouseNDC, this.camera);
    const targets = [];
    this._markerMeshes.forEach(m => targets.push(m.pillar, m.base, m.tip));
    const hits = this._raycaster.intersectObjects(targets, false);
    let hit = null;
    if (hits.length > 0) hit = this._markerMeshes.find(m => m.pillar===hits[0].object || m.base===hits[0].object || m.tip===hits[0].object);
    if (hit !== this._hoveredMarker) {
      if (this._hoveredMarker) this._setMarkerHover(this._hoveredMarker, false);
      if (hit) this._setMarkerHover(hit, true);
      this._hoveredMarker = hit;
      if (this.onMarkerHover) this.onMarkerHover(hit ? hit.cluster : null);
    }
  }

  _setMarkerHover(marker, hovered) {
    const { pillar, tip, label } = marker;
    const targetH = marker.targetH;
    if (hovered) {
      pillar.material.uniforms.opacity.value = 1.0;
      tip.material.opacity = 1.0;
      this._tweenHeight(marker, targetH*CONFIG.marker.hoverScale, 200);
      label.visible = true;
      label.position.y = targetH*CONFIG.marker.hoverScale + 0.12;
      this.container.style.cursor = 'pointer';
    } else {
      pillar.material.uniforms.opacity.value = 0.75;
      tip.material.opacity = 0.8;
      this._tweenHeight(marker, targetH, 200);
      label.visible = false;
      this.container.style.cursor = 'crosshair';
    }
  }

  _tweenHeight(marker, newH, dur) {
    const { pillar, tip, group } = marker;
    const startH = group.userData.currentH || marker.targetH;
    const startTime = performance.now();
    const tick = (now) => {
      const t = Math.min((now-startTime)/dur, 1);
      const ease = 1 - Math.pow(1-t, 3);
      const h = startH + (newH-startH)*ease;
      pillar.scale.set(1, Math.max(h,0.001), 1);
      pillar.position.y = h/2;
      tip.position.y = h;
      group.userData.currentH = h;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  _checkClick() {
    this._raycaster.setFromCamera(this._mouseNDC, this.camera);

    // 先检查是否命中标记点
    if (this._markerMeshes.length && !this._animatingOut) {
      const targets = [];
      this._markerMeshes.forEach(m => targets.push(m.pillar, m.base, m.tip));
      const hits = this._raycaster.intersectObjects(targets, false);
      if (hits.length) {
        const hit = this._markerMeshes.find(m => m.pillar===hits[0].object || m.base===hits[0].object || m.tip===hits[0].object);
        if (hit) {
          this.flyTo(hit.cluster.lat, hit.cluster.lng, 1000, CONFIG.flyToZoomDist);
          if (this.onMarkerClick) this.onMarkerClick(hit.cluster);
          return;
        }
      }
    }

    // 没命中标记 → 检查是否点在地球上（或空白处）→ 切换自转
    this.isAutoRotating = !this.isAutoRotating;
    this.lastInteraction = Date.now();
  }

  // ---------- Resize ----------
  _initResize() {
    this._resizeHandler = () => {
      const w = this.container.clientWidth, h = this.container.clientHeight;
      this.camera.aspect = w/h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      if (this.labelRenderer) this.labelRenderer.setSize(w, h);
    };
    window.addEventListener('resize', this._resizeHandler);
  }

  // ---------- 暂停/恢复渲染（视图切换用） ----------
  pause() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
      this._paused = true;
      console.log('[Globe] 渲染已暂停');
    }
  }

  resume() {
    if (this._paused) {
      this._paused = false;
      this._clock.getDelta(); // 消耗掉暂停期间的 delta 时间
      this._animate();
      console.log('[Globe] 渲染已恢复');
    }
  }

  // ---------- 主动画循环 ----------
  _animate() {
    this._rafId = requestAnimationFrame(() => this._animate());
    const dt = this._clock.getDelta();

    if (!this.isDragging && !this.isAutoRotating) {
      if (Date.now() - this.lastInteraction > CONFIG.idleTimeout) this.isAutoRotating = true;
    }
    if (this.isAutoRotating) this.spherical.theta += CONFIG.autoRotateSpeed;

    this.currentDistance += (this.targetDistance - this.currentDistance) * 0.06;
    this._updateCameraPosition();

    // 更新菲涅尔 uniform
    if (this._atmoMat) this._atmoMat.uniforms.cameraPos.value.copy(this.camera.position);

    // 经纬网格透明度随距离
    if (this.gridLines) {
      const distFactor = THREE.MathUtils.smoothstep(this.currentDistance, 8, 14);
      this.gridLines.traverse(child => {
        if (child.material) child.material.opacity = 0.06 * (1 - distFactor);
      });
    }

    if (this.stars) this.stars.rotation.y += 0.00005;

    // 标记点涟漪+粒子
    this._updateMarkerEffects(dt);

    this.renderer.render(this.scene, this.camera);
    if (this.labelRenderer) this.labelRenderer.render(this.scene, this.camera);
  }

  // ===== 入场序列 API =====

  /**
   * 播放入场序列，由 main.js 编排调用
   */
  playEntrySequence() {
    this._entryPhase = 'animating';
    const start = performance.now();

    // 星空渐入 (0~800ms)
    // 地球飞近 (300~1500ms, distance 40→16)
    // 大气辉光 (500~1300ms, intensity 0→1.5)

    const entryDist = CONFIG.cameraEntryDistance;
    const normalDist = CONFIG.cameraDistance;

    const tick = (now) => {
      const t = now - start;

      // 星空
      if (this.stars && t < 800) {
        this.stars.material.opacity = Math.min(t / 800, 1) * 0.7;
      } else if (this.stars) {
        this.stars.material.opacity = 0.7;
      }

      // 地球飞近
      if (t >= 300 && t < 1500) {
        const p = (t - 300) / 1200;
        const e = 1 - Math.pow(1 - p, 3);
        this.currentDistance = entryDist + (normalDist - entryDist) * e;
        this.targetDistance = this.currentDistance;
      } else if (t >= 1500) {
        this.targetDistance = normalDist;
      }

      // 大气辉光
      if (this._atmoMat && t >= 500 && t < 1300) {
        const p = (t - 500) / 800;
        this._atmoMat.uniforms.intensity.value = Math.min(p, 1) * 1.5;
      } else if (this._atmoMat && t >= 1300) {
        this._atmoMat.uniforms.intensity.value = 1.5;
      }

      if (t < 1500) {
        requestAnimationFrame(tick);
      } else {
        this._entryPhase = 'done';
      }
    };
    requestAnimationFrame(tick);
  }

  // ===== 公共 API =====
  flyTo(lat, lng, duration = 1500, zoomDist = null) {
    // 从经纬度求目标点 3D 坐标，再反推相机球坐标
    const targetPos = latLngToVector3(lat, lng, 1).normalize();
    // 相机球坐标 phi: 天顶角(0=北极, PI=南极), theta: 方位角
    // 相机位置: (d*sin(phi)*sin(theta), d*cos(phi), d*sin(phi)*cos(theta))
    // 要让相机正对目标点，相机方向向量要与目标点方向对齐
    const targetPhi  = Math.acos(Math.max(-1, Math.min(1, targetPos.y)));
    const targetTheta = Math.atan2(targetPos.x, targetPos.z);

    // 选择最短旋转路径（避免绕远）
    let startTheta = this.spherical.theta;
    let dTheta = targetTheta - startTheta;
    // 归一化到 [-PI, PI]
    dTheta = ((dTheta + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

    const startPhi = this.spherical.phi;
    const startDist = this.currentDistance;
    const endDist = zoomDist || this.currentDistance;
    const startTime = Date.now();
    this.isAutoRotating = false;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const p = Math.min(elapsed / duration, 1);
      const e = 1 - Math.pow(1 - p, 3); // ease-out cubic

      this.spherical.theta = startTheta + dTheta * e;
      this.spherical.phi = startPhi + (targetPhi - startPhi) * e;
      this.currentDistance = startDist + (endDist - startDist) * e;
      this.targetDistance = this.currentDistance;

      if (p < 1) {
        requestAnimationFrame(animate);
      } else {
        this.lastInteraction = Date.now();
      }
    };
    animate();
  }

  dispose() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
    this._clearMarkers();
    if (this.renderer) { this.renderer.dispose(); this.container.removeChild(this.renderer.domElement); }
    if (this.labelRenderer) this.container.removeChild(this.labelRenderer.domElement);
    this.scene?.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { if (Array.isArray(o.material)) o.material.forEach(m=>m.dispose()); else o.material.dispose(); }
    });
  }
}
