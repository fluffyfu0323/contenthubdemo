/**
 * globe.js — Paper Style 地球模块
 *
 * Phase 1: TopoJSON 陆地轮廓线 + 半透明填充（替代 NASA 纹理）
 * Phase 2: 手工径向大气光晕 + 偏心暖白高光 + 呼吸 shimmer
 * Phase 3: 三层发光圆点标记 + 脉冲呼吸动画（Sprite + 自定义 shader）
 *
 * 技术: Three.js，但视觉设计借鉴 Canvas 2D 的"手绘海报"风格
 */

import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// ===== 配置 =====
const CONFIG = {
  earthRadius: 5,
  earthSegments: 64,

  // 大气
  atmosphereRadius: 5.25,

  // 星空（纸质风格用极淡的点缀）
  starCount: 400,
  starFieldRadius: 300,

  // 相机
  cameraFov: 45, cameraNear: 0.1, cameraFar: 1000,
  cameraDistance: 15,
  cameraEntryDistance: 35,
  zoomMin: 8, zoomMax: 28,

  autoRotateSpeed: 0.0006,
  idleTimeout: 3000,

  // 光照 — 偏柔和
  ambientIntensity: 0.6,
  dirLightIntensity: 0.6,
  dirLightPos: [-3, 5, 5],

  // 标记
  marker: {
    clusterDeg: 5,
    baseSize: 0.12,
    haloSize: 0.28,
    hoverScale: 1.4,
    enterDuration: 600,
    exitDuration: 300,
    surfaceOffset: 0.03,
  },
  flyToZoomDist: 10,

  // 背景色 — 纸质暖白
  bgColor: 0xeee8dc,

  // 陆地颜色
  landFill: 'rgba(76, 67, 58, 0.10)',
  landStroke: 'rgba(42, 36, 36, 0.30)',
};

// ===== 工具 =====
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

// ================================================================
// Phase 3: 三层光点 Sprite Shader
// ================================================================
const MARKER_SPRITE_VS = `
  uniform float scale;
  uniform float time;
  void main() {
    // 脉冲呼吸：大小随时间波动
    float breath = 1.0 + sin(time * 2.5) * 0.12;
    vec4 mvPosition = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    // 固定屏幕大小的 billboard
    float sz = scale * breath;
    mvPosition.xy += position.xy * sz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const MARKER_SPRITE_FS = `
  uniform vec3 coreColor;
  uniform vec3 haloColor;
  uniform float opacity;
  uniform float time;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    // 我们用自定义 geometry，所以从 position 推导 uv
    // 这里改用 gl_FragCoord 不合适，用 varying
    discard; // 不会到这里
  }
`;

// 更好的方案：用 PlaneGeometry + ShaderMaterial 做 billboard
const GLOW_VS = `
  uniform float scale;
  uniform float time;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    float breath = 1.0 + sin(time * 2.5) * 0.15;
    vec4 mvPosition = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float sz = scale * breath;
    vec2 offset = (uv - 0.5) * 2.0 * sz;
    mvPosition.xy += offset;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const GLOW_FS = `
  uniform vec3 coreColor;
  uniform vec3 haloColor;
  uniform float opacity;
  uniform float time;
  uniform float hover;
  varying vec2 vUv;

  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center) * 2.0; // 0~1 from center to edge

    // Layer 1: 外层光晕（大圆半透明）
    float halo = smoothstep(1.0, 0.3, dist) * 0.22;

    // Layer 2: 中间描边环
    float ring = smoothstep(0.55, 0.45, dist) - smoothstep(0.45, 0.35, dist);
    ring *= 0.5;

    // Layer 3: 核心亮点
    float core = smoothstep(0.35, 0.0, dist);
    core = pow(core, 1.5) * 0.95;

    // 呼吸脉冲（光晕层大小波动）
    float pulse = sin(time * 3.0) * 0.08 + 1.0;
    halo *= pulse;

    // hover 增强
    float hoverBoost = 1.0 + hover * 0.5;
    halo *= hoverBoost;
    core *= (1.0 + hover * 0.3);

    // 合成
    vec3 col = haloColor * halo + haloColor * ring + coreColor * core;
    float alpha = (halo + ring * 0.6 + core) * opacity;

    // 外围淡出
    alpha *= smoothstep(1.0, 0.8, dist);

    gl_FragColor = vec4(col, alpha);
  }
`;

// ================================================================
// Phase 2: 艺术化大气光晕 Shader
// ================================================================
const ATMO_VS = `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const ATMO_FS = `
  uniform vec3 warmWhite;
  uniform vec3 coolTone;
  uniform float intensity;
  uniform float time;
  uniform vec3 cameraPos;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    vec3 viewDir = normalize(cameraPos - vWorldPos);
    float fresnel = 1.0 - dot(viewDir, vWorldNormal);
    fresnel = clamp(fresnel, 0.0, 1.0);
    fresnel = pow(fresnel, 2.5);

    // 呼吸 shimmer
    float shimmer = sin(time * 0.7) * 0.035 + 1.0;

    // 偏心高光（光源固定左上方）
    vec3 lightDir = normalize(vec3(-0.3, 0.5, 0.8));
    float highlight = max(dot(vWorldNormal, lightDir), 0.0);
    highlight = pow(highlight, 3.0) * 0.3;

    // 混合暖白和冷调
    vec3 color = mix(warmWhite, coolTone, fresnel * 0.6);
    color += warmWhite * highlight;

    float alpha = fresnel * intensity * shimmer;
    alpha = clamp(alpha, 0.0, 0.6);

    gl_FragColor = vec4(color, alpha);
  }
`;

// ===== GlobeModule =====
export class GlobeModule {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.labelRenderer = null;
    this.earth = null;
    this.landGroup = null;
    this.atmosphere = null;
    this.stars = null;

    this.isDragging = false;
    this.isAutoRotating = true;
    this.lastInteraction = 0;
    this.mouse = { x: 0, y: 0, prevX: 0, prevY: 0 };
    this.spherical = { theta: 0, phi: Math.PI / 2.2 }; // 微倾斜

    this.targetDistance = CONFIG.cameraDistance;
    this.currentDistance = CONFIG.cameraEntryDistance;

    this._rafId = null;
    this._resizeHandler = null;
    this._paused = false;

    this.onLoadProgress = null;
    this.onLoadComplete = null;

    this._entryPhase = 'waiting';

    // 标记点
    this.markersGroup = null;
    this._markerMeshes = [];
    this._hoveredMarker = null;
    this._raycaster = new THREE.Raycaster();
    this._mouseNDC = new THREE.Vector2();
    this._currentColor = '#d6432f';
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
    this._initMarkersGroup();
    this._initInteractions();
    this._initResize();
    this._animate();
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CONFIG.bgColor);
  }

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
    this.renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: false, powerPreference: 'high-performance'
    });
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
    this.scene.add(new THREE.AmbientLight(0xfff8ef, CONFIG.ambientIntensity));
    const dl = new THREE.DirectionalLight(0xfff5e6, CONFIG.dirLightIntensity);
    dl.position.set(...CONFIG.dirLightPos);
    this.scene.add(dl);
  }

  // ===== 极淡的纸质星空 =====
  _createStarField() {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(CONFIG.starCount * 3);
    const sizes = new Float32Array(CONFIG.starCount);
    for (let i = 0; i < CONFIG.starCount; i++) {
      const r = CONFIG.starFieldRadius;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      pos[i*3]   = r * Math.sin(p) * Math.cos(t);
      pos[i*3+1] = r * Math.sin(p) * Math.sin(t);
      pos[i*3+2] = r * Math.cos(p);
      sizes[i] = 0.3 + Math.random() * 0.8;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x8a7e72, size: 0.6, sizeAttenuation: true,
      transparent: true, opacity: 0
    });
    this.stars = new THREE.Points(geo, mat);
    this.scene.add(this.stars);
  }

  // ================================================================
  // Phase 1: TopoJSON 陆地轮廓线地球
  // ================================================================
  async _createEarth() {
    const R = CONFIG.earthRadius;
    const seg = CONFIG.earthSegments;

    // 基底球体 — 极淡的暖灰色
    const baseGeo = new THREE.SphereGeometry(R, seg, seg);
    const baseMat = new THREE.MeshPhongMaterial({
      color: 0xe8e0d2,
      transparent: true,
      opacity: 0.4,
      specular: 0x000000,
      shininess: 0,
    });
    this.earth = new THREE.Mesh(baseGeo, baseMat);
    this.scene.add(this.earth);

    // 加载 TopoJSON 陆地数据
    this.landGroup = new THREE.Group();
    this.scene.add(this.landGroup);

    try {
      if (this.onLoadProgress) this.onLoadProgress(10);
      const resp = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json');
      const topo = await resp.json();
      if (this.onLoadProgress) this.onLoadProgress(60);

      // 解析 TopoJSON → GeoJSON 多边形
      const land = this._topoToGeo(topo, topo.objects.land);
      if (this.onLoadProgress) this.onLoadProgress(80);

      // 绘制陆地轮廓
      this._drawLandContours(land, R + 0.01);

      // 绘制半透明陆地填充
      this._drawLandFills(land, R + 0.005);

      if (this.onLoadProgress) this.onLoadProgress(100);
      if (this.onLoadComplete) this.onLoadComplete();
    } catch (err) {
      console.warn('[Globe] TopoJSON 加载失败，使用纯色球体:', err);
      if (this.onLoadComplete) this.onLoadComplete();
    }
  }

  // 简版 TopoJSON → GeoJSON 解析
  _topoToGeo(topology, object) {
    const arcs = topology.arcs;
    const transform = topology.transform;

    // 解码弧线
    const decodedArcs = arcs.map(arc => {
      let x = 0, y = 0;
      return arc.map(([dx, dy]) => {
        x += dx; y += dy;
        if (transform) {
          return [
            x * transform.scale[0] + transform.translate[0],
            y * transform.scale[1] + transform.translate[1]
          ];
        }
        return [x, y];
      });
    });

    // 解析几何体
    const rings = [];
    const resolveArc = (index) => {
      if (index >= 0) return decodedArcs[index];
      return [...decodedArcs[~index]].reverse();
    };

    const extractRings = (geo) => {
      if (geo.type === 'GeometryCollection') {
        geo.geometries.forEach(g => extractRings(g));
      } else if (geo.type === 'Polygon' || geo.type === 'MultiPolygon') {
        const arcSets = geo.type === 'MultiPolygon' ? geo.arcs.flat() : geo.arcs;
        arcSets.forEach(arcRefs => {
          const ring = [];
          arcRefs.forEach(idx => {
            const pts = resolveArc(idx);
            pts.forEach((pt, i) => {
              if (i > 0 || ring.length === 0) ring.push(pt);
            });
          });
          if (ring.length > 2) rings.push(ring);
        });
      }
    };

    extractRings(object);
    return rings;
  }

  _lngLatToVec3(lng, lat, r) {
    const phi   = (90 - lat) * Math.PI / 180;
    const theta = (lng + 180) * Math.PI / 180;
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
       r * Math.cos(phi),
       r * Math.sin(phi) * Math.sin(theta)
    );
  }

  // 陆地轮廓线 — 类似水彩画线条
  _drawLandContours(rings, radius) {
    const material = new THREE.LineBasicMaterial({
      color: 0x2a2424,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });

    rings.forEach(ring => {
      const points = [];
      // 每隔几个点取一个，避免过密
      const step = Math.max(1, Math.floor(ring.length / 200));
      for (let i = 0; i < ring.length; i += step) {
        const [lng, lat] = ring[i];
        points.push(this._lngLatToVec3(lng, lat, radius));
      }
      // 闭合
      if (points.length > 2) {
        points.push(points[0].clone());
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        this.landGroup.add(new THREE.Line(geo, material));
      }
    });
  }

  // 陆地半透明填充 — multiply 混合效果
  _drawLandFills(rings, radius) {
    // 使用一个大的半透明球体叠加纹理来模拟
    // 更好的方案：在 Canvas 2D 上绘制陆地，然后作为纹理贴到球上
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // 透明底
    ctx.clearRect(0, 0, 2048, 1024);

    // 绘制陆地填充
    ctx.fillStyle = 'rgba(76, 67, 58, 0.12)';
    ctx.strokeStyle = 'rgba(42, 36, 36, 0.35)';
    ctx.lineWidth = 0.8;

    rings.forEach(ring => {
      if (ring.length < 3) return;
      ctx.beginPath();
      ring.forEach(([lng, lat], i) => {
        // 经纬度 → 等矩形投影像素坐标
        const x = ((lng + 180) / 360) * 2048;
        const y = ((90 - lat) / 180) * 1024;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    // 作为纹理
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;

    const landMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
    });

    const landGeo = new THREE.SphereGeometry(radius, CONFIG.earthSegments, CONFIG.earthSegments);
    const landMesh = new THREE.Mesh(landGeo, landMat);
    this.landGroup.add(landMesh);
  }

  // ================================================================
  // Phase 2: 艺术化大气光晕
  // ================================================================
  _createAtmosphere() {
    const geo = new THREE.SphereGeometry(CONFIG.atmosphereRadius, CONFIG.earthSegments, CONFIG.earthSegments);
    this._atmoMat = new THREE.ShaderMaterial({
      vertexShader: ATMO_VS,
      fragmentShader: ATMO_FS,
      uniforms: {
        warmWhite: { value: new THREE.Color(0xfff8ef) },
        coolTone:  { value: new THREE.Color(0xc8beb2) },
        intensity: { value: 0 },
        time:      { value: 0 },
        cameraPos: { value: new THREE.Vector3() },
      },
      side: THREE.BackSide,
      blending: THREE.NormalBlending,
      transparent: true,
      depthWrite: false,
    });
    this.atmosphere = new THREE.Mesh(geo, this._atmoMat);
    this.scene.add(this.atmosphere);
  }

  // ================================================================
  // Phase 3: 三层光点标记系统
  // ================================================================
  _initMarkersGroup() {
    this.markersGroup = new THREE.Group();
    this.markersGroup.name = 'markers';
    this.scene.add(this.markersGroup);
  }

  setMarkers(assets, color = '#d6432f', animated = true) {
    this._currentColor = color;
    if (animated && this._markerMeshes.length > 0) {
      this._animateMarkersOut(() => { this._clearMarkers(); this._buildMarkers(assets, color, true); });
    } else {
      this._clearMarkers();
      this._buildMarkers(assets, color, animated);
    }
  }

  _buildMarkers(assets, color, animated) {
    if (!assets || !assets.length) return;
    const clusters = clusterAssets(assets);
    const maxCount = Math.max(...clusters.map(c => c.assets.length), 1);
    const threeColor = new THREE.Color(color);

    // 计算一个更亮的核心色
    const coreColor = new THREE.Color(color);
    coreColor.multiplyScalar(1.3);
    coreColor.r = Math.min(coreColor.r, 1);
    coreColor.g = Math.min(coreColor.g, 1);
    coreColor.b = Math.min(coreColor.b, 1);

    clusters.forEach((cluster, ci) => {
      const count = cluster.assets.length;
      const t = maxCount > 1 ? (count - 1) / (maxCount - 1) : 0;

      // 大小映射：文物越多，点越大
      const baseScale = CONFIG.marker.baseSize + t * (CONFIG.marker.haloSize - CONFIG.marker.baseSize);

      const surfacePos = latLngToVector3(cluster.lat, cluster.lng, CONFIG.earthRadius + CONFIG.marker.surfaceOffset);
      const normal = surfacePos.clone().normalize();

      // 创建 billboard 光点 mesh
      const planeGeo = new THREE.PlaneGeometry(1, 1);
      const glowMat = new THREE.ShaderMaterial({
        vertexShader: GLOW_VS,
        fragmentShader: GLOW_FS,
        uniforms: {
          coreColor: { value: coreColor.clone() },
          haloColor: { value: threeColor.clone() },
          opacity:   { value: 0 },
          time:      { value: 0 },
          scale:     { value: baseScale },
          hover:     { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });

      const glowMesh = new THREE.Mesh(planeGeo, glowMat);
      glowMesh.position.copy(surfacePos);
      // Billboard 会在 shader 中处理

      // 暖白描边圆（固定在表面）
      const ringGeo = new THREE.RingGeometry(baseScale * 0.28, baseScale * 0.35, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xfaf5ec,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(surfacePos);
      ringMesh.lookAt(surfacePos.clone().multiplyScalar(2));

      // Tooltip
      const labelDiv = this._createLabelDiv(cluster);
      const labelObj = new CSS2DObject(labelDiv);
      labelObj.position.copy(surfacePos.clone().add(normal.clone().multiplyScalar(0.3)));
      labelObj.visible = false;

      this.markersGroup.add(glowMesh);
      this.markersGroup.add(ringMesh);
      this.markersGroup.add(labelObj);

      const markerData = {
        glow: glowMesh,
        ring: ringMesh,
        label: labelObj,
        cluster,
        baseScale,
        color: threeColor,
        surfacePos,
        normal,
        timeOffset: Math.random() * 10,  // 错开呼吸相位
      };

      this._markerMeshes.push(markerData);

      if (animated) {
        this._animateMarkerIn(markerData, ci * 80);
      } else {
        glowMat.uniforms.opacity.value = 1.0;
        ringMat.opacity = 0.85;
      }
    });
  }

  _createLabelDiv(cluster) {
    const div = document.createElement('div');
    div.className = 'marker-tooltip';
    const thumbs = cluster.assets.slice(0, 3).map(a =>
      `<img src="${a.thumbnail}" alt="${a.name}" class="marker-tooltip-thumb">`).join('');
    div.innerHTML = `
      <div class="marker-tooltip-title">${cluster.regionName} · ${cluster.periodName}</div>
      <div class="marker-tooltip-count">${cluster.assets.length} 件文化资产</div>
      ${thumbs ? `<div class="marker-tooltip-thumbs">${thumbs}</div>` : ''}`;
    return div;
  }

  _animateMarkerIn(marker, delay = 0) {
    const start = performance.now() + delay;
    const dur = CONFIG.marker.enterDuration;
    const tick = (now) => {
      const elapsed = now - start;
      if (elapsed < 0) { requestAnimationFrame(tick); return; }
      const t = Math.min(elapsed / dur, 1);
      // Elastic ease out
      const e = t === 1 ? 1 : 1 - Math.pow(2, -10 * t) * Math.cos((t * 10 - 0.75) * (2 * Math.PI / 3));
      marker.glow.material.uniforms.opacity.value = e;
      marker.glow.material.uniforms.scale.value = marker.baseScale * e;
      marker.ring.material.opacity = 0.85 * e;
      const ringScale = e;
      marker.ring.scale.setScalar(ringScale);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  _animateMarkersOut(onComplete) {
    if (!this._markerMeshes.length) { onComplete(); return; }
    this._animatingOut = true;
    const dur = CONFIG.marker.exitDuration;
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / dur, 1);
      const e = 1 - (1 - t) * (1 - t);
      this._markerMeshes.forEach(m => {
        m.glow.material.uniforms.opacity.value = 1 - e;
        m.glow.material.uniforms.scale.value = m.baseScale * (1 - e);
        m.ring.material.opacity = 0.85 * (1 - e);
      });
      if (t < 1) requestAnimationFrame(tick);
      else { this._animatingOut = false; onComplete(); }
    };
    requestAnimationFrame(tick);
  }

  _clearMarkers() {
    this._markerMeshes.forEach(m => {
      m.label.visible = false;
      m.glow.geometry.dispose(); m.glow.material.dispose();
      m.ring.geometry.dispose(); m.ring.material.dispose();
      this.markersGroup.remove(m.glow);
      this.markersGroup.remove(m.ring);
      this.markersGroup.remove(m.label);
    });
    this._markerMeshes = [];
    this._hoveredMarker = null;
  }

  // ===== 交互 =====
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
      this._mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this._mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      if (!this.isDragging) { this._checkHover(); return; }
      const dx = e.clientX - this.mouse.prevX;
      const dy = e.clientY - this.mouse.prevY;
      this.spherical.theta -= dx * 0.005;
      this.spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.spherical.phi - dy * 0.005));
      this.mouse.prevX = e.clientX;
      this.mouse.prevY = e.clientY;
      this.lastInteraction = Date.now();
    });

    el.addEventListener('pointerup', (e) => {
      const wasDrag = pointerDownPos && (Math.abs(e.clientX - pointerDownPos.x) > 4 || Math.abs(e.clientY - pointerDownPos.y) > 4);
      this.isDragging = false;
      el.releasePointerCapture(e.pointerId);
      this.lastInteraction = Date.now();
      pointerDownPos = null;
      if (!wasDrag) this._checkClick();
    });

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.targetDistance = Math.max(CONFIG.zoomMin, Math.min(CONFIG.zoomMax, this.targetDistance + e.deltaY * 0.01));
      this.lastInteraction = Date.now();
      this.isAutoRotating = false;
    }, { passive: false });
  }

  _checkHover() {
    if (this._animatingOut || !this._markerMeshes.length) return;
    this._raycaster.setFromCamera(this._mouseNDC, this.camera);

    // 检测光点 — 用球体包围盒近似
    let closest = null;
    let closestDist = Infinity;

    this._markerMeshes.forEach(m => {
      const worldPos = m.glow.position.clone();
      const screenPos = worldPos.clone().project(this.camera);
      const dx = screenPos.x - this._mouseNDC.x;
      const dy = screenPos.y - this._mouseNDC.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 检查是否在可见半球
      const camDir = this.camera.position.clone().normalize();
      const dotProduct = worldPos.clone().normalize().dot(camDir);
      if (dotProduct < 0.05) return; // 背面的不检测

      if (dist < 0.06 && dist < closestDist) {
        closestDist = dist;
        closest = m;
      }
    });

    if (closest !== this._hoveredMarker) {
      if (this._hoveredMarker) this._setMarkerHover(this._hoveredMarker, false);
      if (closest) this._setMarkerHover(closest, true);
      this._hoveredMarker = closest;
      if (this.onMarkerHover) this.onMarkerHover(closest ? closest.cluster : null);
    }
  }

  _setMarkerHover(marker, hovered) {
    if (hovered) {
      marker.glow.material.uniforms.hover.value = 1.0;
      marker.label.visible = true;
      this.container.style.cursor = 'pointer';
    } else {
      marker.glow.material.uniforms.hover.value = 0.0;
      marker.label.visible = false;
      this.container.style.cursor = 'crosshair';
    }
  }

  _checkClick() {
    // 先检查标记
    if (this._markerMeshes.length && !this._animatingOut) {
      this._raycaster.setFromCamera(this._mouseNDC, this.camera);
      let closest = null;
      let closestDist = Infinity;

      this._markerMeshes.forEach(m => {
        const worldPos = m.glow.position.clone();
        const screenPos = worldPos.clone().project(this.camera);
        const dx = screenPos.x - this._mouseNDC.x;
        const dy = screenPos.y - this._mouseNDC.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const camDir = this.camera.position.clone().normalize();
        const dotProduct = worldPos.clone().normalize().dot(camDir);
        if (dotProduct < 0.05) return;
        if (dist < 0.06 && dist < closestDist) {
          closestDist = dist;
          closest = m;
        }
      });

      if (closest) {
        this.flyTo(closest.cluster.lat, closest.cluster.lng, 1000, CONFIG.flyToZoomDist);
        if (this.onMarkerClick) this.onMarkerClick(closest.cluster);
        return;
      }
    }

    this.isAutoRotating = !this.isAutoRotating;
    this.lastInteraction = Date.now();
  }

  // ===== Resize =====
  _initResize() {
    this._resizeHandler = () => {
      const w = this.container.clientWidth, h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      if (this.labelRenderer) this.labelRenderer.setSize(w, h);
    };
    window.addEventListener('resize', this._resizeHandler);
  }

  // ===== 暂停/恢复 =====
  pause() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
      this._paused = true;
    }
  }
  resume() {
    if (this._paused) {
      this._paused = false;
      this._clock.getDelta();
      this._animate();
    }
  }

  // ===== 主动画循环 =====
  _animate() {
    this._rafId = requestAnimationFrame(() => this._animate());
    const dt = this._clock.getDelta();
    const elapsed = this._clock.getElapsedTime();

    if (!this.isDragging && !this.isAutoRotating) {
      if (Date.now() - this.lastInteraction > CONFIG.idleTimeout) this.isAutoRotating = true;
    }
    if (this.isAutoRotating) this.spherical.theta += CONFIG.autoRotateSpeed;

    this.currentDistance += (this.targetDistance - this.currentDistance) * 0.06;
    this._updateCameraPosition();

    // Phase 2: 更新大气 uniforms
    if (this._atmoMat) {
      this._atmoMat.uniforms.cameraPos.value.copy(this.camera.position);
      this._atmoMat.uniforms.time.value = elapsed;
    }

    // Phase 3: 更新光点 time uniform（elapsed + 初始偏移量，错开呼吸相位）
    this._markerMeshes.forEach(m => {
      m.glow.material.uniforms.time.value = elapsed + m.timeOffset;
      // Billboard: 让 plane 始终面向相机
      m.glow.lookAt(this.camera.position);
    });

    if (this.stars) this.stars.rotation.y += 0.00003;

    this.renderer.render(this.scene, this.camera);
    if (this.labelRenderer) this.labelRenderer.render(this.scene, this.camera);
  }

  // ===== 入场序列 =====
  playEntrySequence() {
    this._entryPhase = 'animating';
    const start = performance.now();
    const entryDist = CONFIG.cameraEntryDistance;
    const normalDist = CONFIG.cameraDistance;

    const tick = (now) => {
      const t = now - start;

      // 星空渐入
      if (this.stars && t < 1000) {
        this.stars.material.opacity = Math.min(t / 1000, 1) * 0.25;
      } else if (this.stars) {
        this.stars.material.opacity = 0.25;
      }

      // 地球飞近
      if (t >= 200 && t < 1500) {
        const p = (t - 200) / 1300;
        const e = 1 - Math.pow(1 - p, 3);
        this.currentDistance = entryDist + (normalDist - entryDist) * e;
        this.targetDistance = this.currentDistance;
      } else if (t >= 1500) {
        this.targetDistance = normalDist;
      }

      // 大气光晕
      if (this._atmoMat && t >= 400 && t < 1200) {
        const p = (t - 400) / 800;
        this._atmoMat.uniforms.intensity.value = Math.min(p, 1) * 1.2;
      } else if (this._atmoMat && t >= 1200) {
        this._atmoMat.uniforms.intensity.value = 1.2;
      }

      if (t < 1500) {
        requestAnimationFrame(tick);
      } else {
        this._entryPhase = 'done';
      }
    };
    requestAnimationFrame(tick);
  }

  // ===== flyTo =====
  flyTo(lat, lng, duration = 1500, zoomDist = null) {
    const targetPos = latLngToVector3(lat, lng, 1).normalize();
    const targetPhi  = Math.acos(Math.max(-1, Math.min(1, targetPos.y)));
    const targetTheta = Math.atan2(targetPos.x, targetPos.z);

    let startTheta = this.spherical.theta;
    let dTheta = targetTheta - startTheta;
    dTheta = ((dTheta + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

    const startPhi = this.spherical.phi;
    const startDist = this.currentDistance;
    const endDist = zoomDist || this.currentDistance;
    const startTime = Date.now();
    this.isAutoRotating = false;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const p = Math.min(elapsed / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);

      this.spherical.theta = startTheta + dTheta * e;
      this.spherical.phi = startPhi + (targetPhi - startPhi) * e;
      this.currentDistance = startDist + (endDist - startDist) * e;
      this.targetDistance = this.currentDistance;

      if (p < 1) requestAnimationFrame(animate);
      else this.lastInteraction = Date.now();
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
      if (o.material) { if (Array.isArray(o.material)) o.material.forEach(m => m.dispose()); else o.material.dispose(); }
    });
  }
}
