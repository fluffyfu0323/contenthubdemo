/**
 * deepdive.js — 深潜模式模块
 *
 * 功能：
 * 1. 正交投影地球（OrthographicCamera）— 完美圆形海报感
 * 2. 可拖拽旋转，查看不同地区
 * 3. 折线图绘制（Canvas 2D）
 * 4. 地球上显示标记光点
 */

import * as THREE from 'three';

// ===== 配置 =====
const CONFIG = {
  earthRadius: 10,      // 大地球，溢出画面
  earthSegments: 64,
  bgColor: 0xeee8dc,
  autoRotateSpeed: 0.0003,
  idleTimeout: 4000,
  tiltAngle: -0.4,      // 北极朝右上，南极朝左下（约23度）
};

export class DeepDiveModule {
  constructor(globeContainer) {
    this.container = globeContainer;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.earth = null;
    this.landGroup = null;
    this.atmosphere = null;

    this.isDragging = false;
    this.isAutoRotating = true;
    this.lastInteraction = 0;
    this.mouse = { prevX: 0, prevY: 0 };
    this.yRotation = -0.8;  // 只绕Y轴旋转（经度方向），初始展示欧亚非
    this.earthOffset = new THREE.Vector3(6, -2, 0); // 大幅偏右偏下

    this._rafId = null;
    this._clock = new THREE.Clock();
    this._initialized = false;
  }

  async init() {
    if (this._initialized) return;
    this._initialized = true;

    this._initScene();
    this._initCamera();
    this._initRenderer();
    this._initLights();
    await this._createEarth();
    this._createAtmosphere();
    this._createMarkers();
    this._initInteractions();
    this._initResize();
    this._animate();
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CONFIG.bgColor);
  }

  _initCamera() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const aspect = w / h;
    // 用较小的 frustumSize 让地球占满视口
    const frustumSize = 14;
    this.camera = new THREE.OrthographicCamera(
      -frustumSize * aspect / 2,
       frustumSize * aspect / 2,
       frustumSize / 2,
      -frustumSize / 2,
      0.1, 1000
    );
    this.camera.position.set(0, 0, 20);
    this.camera.lookAt(0, 0, 0);
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);
  }

  _initLights() {
    this.scene.add(new THREE.AmbientLight(0xfff8ef, 0.7));
    const dl = new THREE.DirectionalLight(0xfff5e6, 0.5);
    dl.position.set(-3, 5, 8);
    this.scene.add(dl);
  }

  async _createEarth() {
    const R = CONFIG.earthRadius;
    const seg = CONFIG.earthSegments;

    // 基底球
    const baseGeo = new THREE.SphereGeometry(R, seg, seg);
    const baseMat = new THREE.MeshPhongMaterial({
      color: 0xe8e0d2, transparent: true, opacity: 0.5,
      specular: 0x000000, shininess: 0,
    });
    this.earth = new THREE.Mesh(baseGeo, baseMat);
    this.earth.position.copy(this.earthOffset); // 偏移，让半球充满画面
    this.scene.add(this.earth);

    this.landGroup = new THREE.Group();
    this.earth.add(this.landGroup);

    try {
      const resp = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json');
      const topo = await resp.json();
      const rings = this._topoToGeo(topo, topo.objects.land);

      // Canvas 纹理绘制陆地
      const canvas = document.createElement('canvas');
      canvas.width = 2048; canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 2048, 1024);
      ctx.fillStyle = 'rgba(76, 67, 58, 0.14)';
      ctx.strokeStyle = 'rgba(42, 36, 36, 0.38)';
      ctx.lineWidth = 0.8;

      rings.forEach(ring => {
        if (ring.length < 3) return;
        ctx.beginPath();
        ring.forEach(([lng, lat], i) => {
          const x = ((lng + 180) / 360) * 2048;
          const y = ((90 - lat) / 180) * 1024;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath(); ctx.fill(); ctx.stroke();
      });

      const texture = new THREE.CanvasTexture(canvas);
      const landMat = new THREE.MeshBasicMaterial({
        map: texture, transparent: true, depthWrite: false,
      });
      const landGeo = new THREE.SphereGeometry(R + 0.005, seg, seg);
      this.landGroup.add(new THREE.Mesh(landGeo, landMat));

    } catch (err) {
      console.warn('[DeepDive] TopoJSON 加载失败:', err);
    }
  }

  _topoToGeo(topology, object) {
    const arcs = topology.arcs;
    const transform = topology.transform;
    const decodedArcs = arcs.map(arc => {
      let x = 0, y = 0;
      return arc.map(([dx, dy]) => {
        x += dx; y += dy;
        if (transform) return [x * transform.scale[0] + transform.translate[0], y * transform.scale[1] + transform.translate[1]];
        return [x, y];
      });
    });
    const rings = [];
    const resolveArc = (index) => index >= 0 ? decodedArcs[index] : [...decodedArcs[~index]].reverse();
    const extractRings = (geo) => {
      if (geo.type === 'GeometryCollection') { geo.geometries.forEach(g => extractRings(g)); }
      else if (geo.type === 'Polygon' || geo.type === 'MultiPolygon') {
        const arcSets = geo.type === 'MultiPolygon' ? geo.arcs.flat() : geo.arcs;
        arcSets.forEach(arcRefs => {
          const ring = [];
          arcRefs.forEach(idx => {
            const pts = resolveArc(idx);
            pts.forEach((pt, i) => { if (i > 0 || ring.length === 0) ring.push(pt); });
          });
          if (ring.length > 2) rings.push(ring);
        });
      }
    };
    extractRings(object);
    return rings;
  }

  _createAtmosphere() {
    const R = CONFIG.earthRadius;
    const vs = `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`;
    const fs = `
      uniform float time;
      varying vec3 vNormal;
      void main() {
        float fresnel = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
        fresnel = pow(fresnel, 3.0);
        float shimmer = sin(time * 0.7) * 0.03 + 1.0;
        // 偏心高光
        float highlight = max(dot(vNormal, normalize(vec3(-0.3, 0.5, 0.6))), 0.0);
        highlight = pow(highlight, 4.0) * 0.25;
        vec3 warmWhite = vec3(1.0, 0.97, 0.93);
        vec3 coolGray = vec3(0.75, 0.72, 0.68);
        vec3 col = mix(warmWhite, coolGray, fresnel * 0.5) + warmWhite * highlight;
        float alpha = (fresnel * 0.5 + highlight) * shimmer;
        gl_FragColor = vec4(col, alpha * 0.6);
      }`;
    const geo = new THREE.SphereGeometry(R + 0.2, 64, 64);
    this._atmoMat = new THREE.ShaderMaterial({
      vertexShader: vs, fragmentShader: fs,
      uniforms: { time: { value: 0 } },
      transparent: true, depthWrite: false, side: THREE.FrontSide,
    });
    const atmo = new THREE.Mesh(geo, this._atmoMat);
    this.earth.add(atmo);
  }

  // 标记点 — 在一些关键文化位置放置光点
  _createMarkers() {
    const markers = [
      { lat: 31, lng: 104, name: '三星堆' },       // 四川
      { lat: 29.3, lng: 117.2, name: '景德镇' },   // 江西
      { lat: 27.7, lng: 109, name: '傩戏' },       // 贵州
      { lat: 60, lng: 10, name: '维京' },          // 挪威
      { lat: -41, lng: 174, name: '毛利' },        // 新西兰
      { lat: 35, lng: -105, name: '牛仔' },        // 美国西部
    ];

    markers.forEach(m => {
      const pos = this._latLngToVec3(m.lat, m.lng, CONFIG.earthRadius + 0.04);
      // 三层光点
      const spriteMat = new THREE.SpriteMaterial({
        color: 0xd6432f,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.copy(pos);
      sprite.scale.setScalar(0.6);
      this.earth.add(sprite);

      // 光晕
      const haloMat = new THREE.SpriteMaterial({
        color: 0xd6432f,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const halo = new THREE.Sprite(haloMat);
      halo.position.copy(pos);
      halo.scale.setScalar(1.4);
      halo.userData = { baseScale: 1.4, phase: Math.random() * Math.PI * 2 };
      this.earth.add(halo);
      if (!this._halos) this._halos = [];
      this._halos.push(halo);
    });
  }

  _latLngToVec3(lat, lng, r) {
    const phi = (90 - lat) * Math.PI / 180;
    const theta = (lng + 180) * Math.PI / 180;
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
       r * Math.cos(phi),
       r * Math.sin(phi) * Math.sin(theta)
    );
  }

  _initInteractions() {
    const el = this.renderer.domElement;

    el.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.isAutoRotating = false;
      this.lastInteraction = Date.now();
      this.mouse.prevX = e.clientX;
      el.setPointerCapture(e.pointerId);
    });

    el.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.mouse.prevX;
      // 只绕 Y 轴旋转（南极到北极那条轴）
      this.yRotation += dx * 0.004;
      this.mouse.prevX = e.clientX;
      this.lastInteraction = Date.now();
    });

    el.addEventListener('pointerup', (e) => {
      this.isDragging = false;
      el.releasePointerCapture(e.pointerId);
      this.lastInteraction = Date.now();
    });
  }

  _initResize() {
    this._resizeHandler = () => {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      const aspect = w / h;
      const frustumSize = 14;
      this.camera.left = -frustumSize * aspect / 2;
      this.camera.right = frustumSize * aspect / 2;
      this.camera.top = frustumSize / 2;
      this.camera.bottom = -frustumSize / 2;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', this._resizeHandler);
  }

  _animate() {
    this._rafId = requestAnimationFrame(() => this._animate());
    const elapsed = this._clock.getElapsedTime();

    if (!this.isDragging && !this.isAutoRotating) {
      if (Date.now() - this.lastInteraction > CONFIG.idleTimeout) this.isAutoRotating = true;
    }
    if (this.isAutoRotating) this.yRotation += CONFIG.autoRotateSpeed;

    // 应用旋转：固定 tilt 倾斜 + 只绕 Y 轴旋转
    if (this.earth) {
      this.earth.rotation.z = CONFIG.tiltAngle;  // 向右倾斜
      this.earth.rotation.y = this.yRotation;    // 只绕极轴旋转
      this.earth.rotation.x = 0.15;             // 微微俯视
    }

    // 大气 time
    if (this._atmoMat) this._atmoMat.uniforms.time.value = elapsed;

    // 光晕呼吸
    if (this._halos) {
      this._halos.forEach(h => {
        const pulse = 1 + Math.sin(elapsed * 2.5 + h.userData.phase) * 0.2;
        h.scale.setScalar(h.userData.baseScale * pulse);
        h.material.opacity = 0.15 + Math.sin(elapsed * 3 + h.userData.phase) * 0.08;
      });
    }

    this.renderer.render(this.scene, this.camera);
  }

  pause() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  }

  resume() {
    if (!this._rafId) { this._clock.getDelta(); this._animate(); }
  }

  dispose() {
    this.pause();
    if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
    if (this.renderer) {
      this.renderer.dispose();
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

// ===== 折线图绘制 =====
export function drawChart(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  // 数据
  const datasets = [
    { data: [72, 78, 74, 82, 88, 85, 91], color: '#d6432f', label: '游戏适配度' },
    { data: [65, 68, 72, 70, 76, 80, 83], color: '#6EB5FF', label: '视觉冲击力' },
    { data: [58, 62, 60, 68, 72, 75, 79], color: '#4ADE80', label: '叙事潜力' },
  ];
  const labels = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'];

  const padL = 30, padR = 10, padT = 10, padB = 24;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  // 网格线
  ctx.strokeStyle = 'rgba(54, 48, 53, 0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (chartH / 4) * i;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
  }

  // Y轴标签
  ctx.fillStyle = 'rgba(54, 48, 53, 0.35)';
  ctx.font = '9px Inter, sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const val = 100 - i * 25;
    const y = padT + (chartH / 4) * i;
    ctx.fillText(String(val), padL - 6, y + 3);
  }

  // X轴标签
  ctx.textAlign = 'center';
  labels.forEach((l, i) => {
    const x = padL + (chartW / (labels.length - 1)) * i;
    ctx.fillText(l, x, H - 6);
  });

  // 绘制折线
  datasets.forEach(ds => {
    ctx.beginPath();
    ctx.strokeStyle = ds.color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ds.data.forEach((val, i) => {
      const x = padL + (chartW / (ds.data.length - 1)) * i;
      const y = padT + chartH - (val / 100) * chartH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 点
    ds.data.forEach((val, i) => {
      const x = padL + (chartW / (ds.data.length - 1)) * i;
      const y = padT + chartH - (val / 100) * chartH;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = ds.color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  });
}
