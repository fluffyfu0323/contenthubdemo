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
    this.yRotation = -3.0;  // Y轴旋转，初始展示中国及东南亚
    this.xRotation = 0;     // X轴旋转
    this.earthOffset = new THREE.Vector3(2, -1, 0); // 地球位置靠近中心

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
    this._initSidebarHover();
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

    // 用一个父 Group 来做固定倾斜，地球本体只绕自身 Y 轴旋转
    this.earthPivot = new THREE.Group();
    this.earthPivot.position.copy(this.earthOffset);
    // 北极朝右上倾斜：绕 Z 轴旋转约 -23度
    this.earthPivot.rotation.z = CONFIG.tiltAngle;
    this.scene.add(this.earthPivot);

    // 基底球
    const baseGeo = new THREE.SphereGeometry(R, seg, seg);
    const baseMat = new THREE.MeshPhongMaterial({
      color: 0xe8e0d2, transparent: true, opacity: 0.5,
      specular: 0x000000, shininess: 0,
    });
    this.earth = new THREE.Mesh(baseGeo, baseMat);
    this.earthPivot.add(this.earth);

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

  // 标记点 — 在关键文化位置放置光点
  _createMarkers() {
    const markers = [
      {
        lat: 31, lng: 104, name: '三星堆',
        subtitle: '古蜀文明',
        content: `<strong>部分游戏联动记录：</strong><br>• 2023年 ×《原神》— 战略合作，宣传片《仰观千秋，俯察万象》<br>• 2025年 ×《王者荣耀》— 十周年联动，张艺谋任艺术指导`,
        highlight: '青铜面具、神树、纵目人像，神秘的东方文明符号',
        link: '#'
      },
      {
        lat: 29.3, lng: 117.2, name: '景德镇',
        subtitle: '千年瓷都',
        content: `<strong>部分游戏联动记录：</strong><br>• 2022年 ×《英雄联盟》— 青花瓷主题皮肤，纪录片《龙韵瓷华》<br>• 2024年 × 腾讯互娱 — 景德镇文旅战略合作签约<br>• 2026年 ×《桃源深处有人家》— 联动御窑博物院「霰雪寻瓷」`,
        highlight: '青花、粉彩、玲珑瓷，世界制瓷工艺巅峰',
        link: '#'
      },
      {
        lat: 27.7, lng: 109, name: '傩戏',
        subtitle: '千年活化石',
        content: `<strong>部分游戏联动记录：</strong><br>• 2024年 ×《桃源深处有人家》— 贵州傩文化主题联动<br>• 2025年 × 池州傩戏入驻腾讯手游 — 12尊傩面具数字化<br>• 2025年 ×《以闪亮之名》— 非遗傩戏时装联动`,
        highlight: '驱邪祈福面具、"戏剧活化石"，中国最古老的祭祀表演艺术',
        link: '#'
      },
      {
        lat: 40.0, lng: 94.8, name: '敦煌',
        subtitle: '丝路明珠',
        content: `<strong>部分游戏联动记录：</strong><br>• 2018-2025年 ×《王者荣耀》— 飞天皮肤系列（杨玉环·遇见飞天、瑶·遇见神鹿）<br>• 2023年 × 腾讯 — "数字藏经洞"上线，游戏引擎还原莫高窟<br>• 2025年 × 网易 — 联手敦煌研究院打造沉浸式体验`,
        highlight: '莫高窟壁画、飞天、藻井纹样，世界最大佛教艺术宝库',
        link: '#'
      },
      {
        lat: 35.7, lng: 139.7, name: '浮世绘',
        subtitle: '江户美学',
        content: `<strong>艺术特征：</strong><br>• 鲜艳平涂色彩 + 大胆构图 + 黑色粗轮廓线<br>• 题材涵盖风景、美人、武士、妖怪<br>• 影响印象派（莫奈、梵高），东西方美学交汇里程碑`,
        highlight: '游戏设计参考：《大神》《对马岛之魂》《阴阳师》等均运用浮世绘视觉风格',
        link: '#'
      },
      {
        lat: 32.7, lng: 53.7, name: '波斯地毯',
        subtitle: '地面上的艺术',
        content: `<strong>艺术特征：</strong><br>• 纯手工打结编织，单块耗时数年<br>• 图案融合几何纹样、花园意象与阿拉伯书法<br>• 天然植物/矿物染料，千年不褪色`,
        highlight: '设计灵感：对称与无限延伸的纹样逻辑，适合宫殿、圣殿、魔法阵等场景',
        link: '#'
      },
    ];

    // 创建圆形纹理
    const circleTexture = this._createCircleTexture();
    const haloTexture = this._createCircleTexture(0.3);

    this._markerSprites = []; // 用于 raycaster 检测

    markers.forEach(m => {
      const pos = this._latLngToVec3(m.lat, m.lng, CONFIG.earthRadius + 0.04);
      // 圆形光点
      const spriteMat = new THREE.SpriteMaterial({
        map: circleTexture,
        color: 0xd6432f,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.copy(pos);
      sprite.scale.setScalar(0.6);
      sprite.userData = { markerData: m }; // 存储卡片数据
      this.earth.add(sprite);
      this._markerSprites.push(sprite);

      // 圆形光晕
      const haloMat = new THREE.SpriteMaterial({
        map: haloTexture,
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

    // 创建 hover 卡片 DOM
    this._createTooltip();
    // 初始化 Raycaster hover 检测
    this._initHoverDetection();
  }

  // 创建 hover 卡片 DOM
  _createTooltip() {
    this._tooltip = document.createElement('div');
    this._tooltip.className = 'dd-marker-tooltip';
    this._tooltip.style.display = 'none';
    this._tooltip.innerHTML = `
      <div class="dd-tooltip-header">
        <span class="dd-tooltip-name"></span>
        <span class="dd-tooltip-subtitle"></span>
      </div>
      <div class="dd-tooltip-content"></div>
      <div class="dd-tooltip-highlight"></div>
      <a class="dd-tooltip-btn" href="#" target="_blank">查看更多详情 →</a>
    `;
    this.container.appendChild(this._tooltip);
  }

  // 显示卡片
  _showTooltip(data, screenX, screenY) {
    const tooltip = this._tooltip;
    tooltip.querySelector('.dd-tooltip-name').textContent = `📍 ${data.name}`;
    tooltip.querySelector('.dd-tooltip-subtitle').textContent = `· ${data.subtitle}`;
    tooltip.querySelector('.dd-tooltip-content').innerHTML = data.content;
    tooltip.querySelector('.dd-tooltip-highlight').textContent = data.highlight;
    tooltip.querySelector('.dd-tooltip-btn').href = data.link;

    tooltip.style.display = 'block';

    // 定位卡片（在光点右侧显示，避免遮挡）
    const rect = this.container.getBoundingClientRect();
    let left = screenX - rect.left + 20;
    let top = screenY - rect.top - 60;

    // 边界检测：防止超出容器
    const tw = tooltip.offsetWidth || 280;
    const th = tooltip.offsetHeight || 200;
    if (left + tw > rect.width) left = screenX - rect.left - tw - 20;
    if (top + th > rect.height) top = rect.height - th - 10;
    if (top < 10) top = 10;

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }

  _hideTooltip() {
    if (this._tooltip) {
      this._tooltip.style.display = 'none';
    }
  }

  // Raycaster hover 检测
  _initHoverDetection() {
    this._raycaster = new THREE.Raycaster();
    this._mouseVec = new THREE.Vector2();
    this._hoveredMarker = null;

    const el = this.renderer.domElement;

    el.addEventListener('pointermove', (e) => {
      if (this.isDragging) {
        this._hideTooltip();
        return;
      }

      const rect = el.getBoundingClientRect();
      this._mouseVec.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this._mouseVec.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this._raycaster.setFromCamera(this._mouseVec, this.camera);
      const intersects = this._raycaster.intersectObjects(this._markerSprites);

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        if (this._hoveredMarker !== hit) {
          this._hoveredMarker = hit;
          el.style.cursor = 'pointer';
          this._showTooltip(hit.userData.markerData, e.clientX, e.clientY);
        }
      } else {
        if (this._hoveredMarker) {
          this._hoveredMarker = null;
          el.style.cursor = 'grab';
          this._hideTooltip();
        }
      }
    });

    el.addEventListener('pointerleave', () => {
      this._hoveredMarker = null;
      this._hideTooltip();
    });
  }

  // 侧边栏卡片 hover —— 复用地球 tooltip
  _initSidebarHover() {
    // 文案数据映射（按名称索引）
    this._cultureData = {
      '三星堆': {
        name: '三星堆', subtitle: '古蜀文明',
        content: `<strong>部分游戏联动记录：</strong><br>• 2023年 ×《原神》— 战略合作，宣传片《仰观千秋，俯察万象》<br>• 2025年 ×《王者荣耀》— 十周年联动，张艺谋任艺术指导`,
        highlight: '青铜面具、神树、纵目人像，神秘的东方文明符号',
        link: '#'
      },
      '景德镇': {
        name: '景德镇', subtitle: '千年瓷都',
        content: `<strong>部分游戏联动记录：</strong><br>• 2022年 ×《英雄联盟》— 青花瓷主题皮肤，纪录片《龙韵瓷华》<br>• 2024年 × 腾讯互娱 — 景德镇文旅战略合作签约<br>• 2026年 ×《桃源深处有人家》— 联动御窑博物院「霰雪寻瓷」`,
        highlight: '青花、粉彩、玲珑瓷，世界制瓷工艺巅峰',
        link: '#'
      },
      '傩戏': {
        name: '傩戏', subtitle: '千年活化石',
        content: `<strong>部分游戏联动记录：</strong><br>• 2024年 ×《桃源深处有人家》— 贵州傩文化主题联动<br>• 2025年 × 池州傩戏入驻腾讯手游 — 12尊傩面具数字化<br>• 2025年 ×《以闪亮之名》— 非遗傩戏时装联动`,
        highlight: '驱邪祈福面具、"戏剧活化石"，中国最古老的祭祀表演艺术',
        link: '#'
      },
      '敦煌': {
        name: '敦煌', subtitle: '丝路明珠',
        content: `<strong>部分游戏联动记录：</strong><br>• 2018-2025年 ×《王者荣耀》— 飞天皮肤系列（杨玉环·遇见飞天、瑶·遇见神鹿）<br>• 2023年 × 腾讯 — "数字藏经洞"上线，游戏引擎还原莫高窟<br>• 2025年 × 网易 — 联手敦煌研究院打造沉浸式体验`,
        highlight: '莫高窟壁画、飞天、藻井纹样，世界最大佛教艺术宝库',
        link: '#'
      },
      '浮世绘': {
        name: '浮世绘', subtitle: '江户美学',
        content: `<strong>艺术特征：</strong><br>• 鲜艳平涂色彩 + 大胆构图 + 黑色粗轮廓线<br>• 题材涵盖风景、美人、武士、妖怪<br>• 影响印象派（莫奈、梵高），东西方美学交汇里程碑`,
        highlight: '游戏设计参考：《大神》《对马岛之魂》《阴阳师》等均运用浮世绘视觉风格',
        link: '#'
      },
      '波斯地毯': {
        name: '波斯地毯', subtitle: '地面上的艺术',
        content: `<strong>艺术特征：</strong><br>• 纯手工打结编织，单块耗时数年<br>• 图案融合几何纹样、花园意象与阿拉伯书法<br>• 天然植物/矿物染料，千年不褪色`,
        highlight: '设计灵感：对称与无限延伸的纹样逻辑，适合宫殿、圣殿、魔法阵等场景',
        link: '#'
      }
    };

    // 创建侧边栏专用 tooltip（挂载到deepdive容器避免overflow裁剪）
    this._sidebarTooltip = document.createElement('div');
    this._sidebarTooltip.className = 'dd-marker-tooltip dd-sidebar-tooltip';
    this._sidebarTooltip.style.display = 'none';
    this._sidebarTooltip.innerHTML = `
      <div class="dd-tooltip-header">
        <span class="dd-tooltip-name"></span>
        <span class="dd-tooltip-subtitle"></span>
      </div>
      <div class="dd-tooltip-content"></div>
      <div class="dd-tooltip-highlight"></div>
      <a class="dd-tooltip-btn" href="#" target="_blank">查看更多详情 →</a>
    `;
    document.getElementById('deepdiveContainer')?.appendChild(this._sidebarTooltip);

    // 给所有带 data-culture 的元素绑定 hover
    const items = document.querySelectorAll('[data-culture]');
    items.forEach(item => {
      item.addEventListener('mouseenter', (e) => {
        const key = item.dataset.culture;
        const data = this._cultureData[key];
        if (!data) return;

        const tooltip = this._sidebarTooltip;
        tooltip.querySelector('.dd-tooltip-name').textContent = `📍 ${data.name}`;
        tooltip.querySelector('.dd-tooltip-subtitle').textContent = `· ${data.subtitle}`;
        tooltip.querySelector('.dd-tooltip-content').innerHTML = data.content;
        tooltip.querySelector('.dd-tooltip-highlight').textContent = data.highlight;
        tooltip.querySelector('.dd-tooltip-btn').href = data.link;

        // 相对于 deepdive 容器定位
        const containerRect = document.getElementById('deepdiveContainer').getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();

        tooltip.style.display = 'block';
        let left = itemRect.right - containerRect.left + 12;
        let top = itemRect.top - containerRect.top;

        // 边界检测：如果超出容器底部，向上偏移
        const th = tooltip.offsetHeight || 220;
        if (top + th > containerRect.height) {
          top = containerRect.height - th - 10;
        }
        if (top < 10) top = 10;

        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
      });

      item.addEventListener('mouseleave', () => {
        this._sidebarTooltip.style.display = 'none';
      });
    });
  }

  // 生成圆形渐变纹理
  _createCircleTexture(softness = 0.6) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const center = size / 2;
    const radius = size / 2;

    const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
    gradient.addColorStop(0, `rgba(255, 255, 255, 1)`);
    gradient.addColorStop(1 - softness, `rgba(255, 255, 255, 0.8)`);
    gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
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
      this.mouse.prevY = e.clientY;
      el.setPointerCapture(e.pointerId);
    });

    el.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.mouse.prevX;
      const dy = e.clientY - this.mouse.prevY;
      // 360度自由旋转
      this.yRotation += dx * 0.004;
      this.xRotation += dy * 0.004;
      this.xRotation = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.xRotation));
      this.mouse.prevX = e.clientX;
      this.mouse.prevY = e.clientY;
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

    // 只绕 Y 轴旋转（极轴），倾斜由 earthPivot 固定
    if (this.earth) {
      this.earth.rotation.x = this.xRotation;
      this.earth.rotation.y = this.yRotation;
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
