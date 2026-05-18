/**
 * overview-map.js — 全景模式：全球文化交流路线地图
 * 技术栈: Leaflet.js + GeoJSON
 * 优化: 多备用瓦片源 + SVG路线流动动画 + 文化标记
 */

// ========== 路线 GeoJSON 数据 ==========
const routesData = {
  silkRoad: {
    name: "🐫 丝绸之路",
    nameEn: "Silk Road",
    color: "#C0392B",
    pulseColor: "#FFD700",
    period: "公元前2世纪 — 公元15世纪",
    description: "连接中国长安与地中海地区，横跨欧亚大陆的古代贸易走廊，传播丝绸、瓷器、茶叶及佛教、伊斯兰教等文化。",
    geojson: {
      type: "Feature",
      properties: { name: "丝绸之路" },
      geometry: {
        type: "LineString",
        coordinates: [
          [108.94, 34.26], [103.83, 36.06], [98.29, 39.77],
          [94.66, 40.14], [87.62, 43.79], [76.95, 43.25],
          [69.28, 41.31], [66.96, 39.65], [64.42, 39.77],
          [51.39, 35.69], [44.37, 33.31], [36.29, 33.51],
          [35.50, 33.89], [29.01, 41.01], [12.50, 41.90],
        ]
      }
    },
    keyPoints: [
      { name: "长安", coords: [108.94, 34.26], desc: "起点：汉唐帝国都城", icon: "🏯" },
      { name: "敦煌", coords: [94.66, 40.14], desc: "丝路门户，莫高窟所在地", icon: "🏛️" },
      { name: "撒马尔罕", coords: [66.96, 39.65], desc: "中亚贸易枢纽", icon: "🧵" },
      { name: "罗马", coords: [12.50, 41.90], desc: "终点：罗马帝国中心", icon: "🏛️" }
    ]
  },

  teaHorseRoad: {
    name: "🐴 茶马古道",
    nameEn: "Tea Horse Road",
    color: "#27AE60",
    pulseColor: "#90EE90",
    period: "唐宋时期 — 20世纪中期",
    description: "以茶叶和马匹为主要交易商品，连接中国西南与西藏、南亚的古代商道，穿越横断山脉。",
    geojson: {
      type: "Feature",
      properties: { name: "茶马古道" },
      geometry: {
        type: "LineString",
        coordinates: [
          [100.98, 22.79], [100.23, 25.04], [100.23, 26.87],
          [99.71, 27.83], [98.91, 28.66], [98.60, 29.65],
          [97.17, 31.14], [91.13, 29.65],
        ]
      }
    },
    keyPoints: [
      { name: "普洱", coords: [100.98, 22.79], desc: "茶叶产区起点", icon: "🍵" },
      { name: "大理", coords: [100.23, 25.04], desc: "南诏国商贸中心", icon: "🏔️" },
      { name: "拉萨", coords: [91.13, 29.65], desc: "茶马互市重要终点", icon: "🕌" }
    ]
  },

  spiceRoute: {
    name: "🌶️ 香料之路",
    nameEn: "Spice Route",
    color: "#E67E22",
    pulseColor: "#FFDAB9",
    period: "公元前3世纪 — 公元17世纪",
    description: "连接东南亚香料群岛、印度、阿拉伯半岛与欧洲的海上贸易航线，传播了胡椒、丁香、肉豆蔻等珍贵香料。",
    geojson: {
      type: "Feature",
      properties: { name: "香料之路" },
      geometry: {
        type: "LineString",
        coordinates: [
          [127.38, -0.54], [110.36, -7.80], [104.06, 1.29],
          [80.27, 13.08], [73.86, 15.49], [56.27, 25.29],
          [45.02, 12.80], [43.15, 14.53], [32.53, 29.97],
          [23.73, 37.97], [12.50, 41.90], [9.19, 45.46],
          [-9.14, 38.74],
        ]
      }
    },
    keyPoints: [
      { name: "马鲁古群岛", coords: [127.38, -0.54], desc: "丁香与肉豆蔻原产地", icon: "🌶️" },
      { name: "马六甲", coords: [104.06, 1.29], desc: "东西方海运咽喉", icon: "⚓" },
      { name: "亚丁", coords: [43.15, 14.53], desc: "阿拉伯商人集散地", icon: "🚢" }
    ]
  },

  transSaharan: {
    name: "🏜️ 撒哈拉横贯路线",
    nameEn: "Trans-Saharan Trade Route",
    color: "#F1C40F",
    pulseColor: "#FFFACD",
    period: "公元8世纪 — 公元16世纪",
    description: "穿越撒哈拉沙漠连接北非地中海沿岸与西非的绿洲贸易路线，以黄金、食盐、象牙和奴隶交易为主。",
    geojson: {
      type: "Feature",
      properties: { name: "撒哈拉横贯路线" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-8.01, 31.63], [-5.55, 34.02], [3.06, 36.74],
          [2.11, 33.80], [5.43, 28.05], [2.12, 21.86],
          [-0.05, 16.27], [-7.99, 12.65], [-1.52, 12.37],
        ]
      }
    },
    keyPoints: [
      { name: "廷巴克图", coords: [-0.05, 16.27], desc: "撒哈拉贸易黄金城", icon: "💰" },
      { name: "马拉喀什", coords: [-8.01, 31.63], desc: "北非商贸枢纽", icon: "🕌" }
    ]
  },

  romanRoads: {
    name: "🏛️ 罗马大道",
    nameEn: "Roman Roads",
    color: "#8E44AD",
    pulseColor: "#DDA0DD",
    period: "公元前3世纪 — 公元5世纪",
    description: "罗马帝国修建的道路网络覆盖整个地中海世界，'条条大路通罗马'体现了其规模。",
    geojson: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "Via Appia 阿庇亚大道" },
          geometry: {
            type: "LineString",
            coordinates: [[12.50, 41.90], [14.27, 40.85], [16.87, 41.12], [18.17, 40.35]]
          }
        },
        {
          type: "Feature",
          properties: { name: "Via Augusta 奥古斯塔大道" },
          geometry: {
            type: "LineString",
            coordinates: [[12.50, 41.90], [11.25, 43.77], [7.69, 45.07], [5.37, 43.30], [2.17, 41.39], [-3.70, 40.42]]
          }
        },
        {
          type: "Feature",
          properties: { name: "Via Egnatia 埃格纳提亚大道" },
          geometry: {
            type: "LineString",
            coordinates: [[18.17, 40.35], [20.85, 39.62], [22.95, 40.63], [29.01, 41.01]]
          }
        }
      ]
    },
    keyPoints: [
      { name: "罗马", coords: [12.50, 41.90], desc: "帝国中心，万路之源", icon: "🏛️" },
      { name: "布林迪西", coords: [18.17, 40.35], desc: "通往东方的港口", icon: "⚓" },
      { name: "伊斯坦布尔", coords: [29.01, 41.01], desc: "东罗马/拜占庭都城", icon: "🕌" }
    ]
  }
};

// ========== OverviewMap 模块 ==========
export class OverviewMapModule {
  constructor(container) {
    this.container = container;
    this.map = null;
    this.routeLayers = {};
    this._initialized = false;
    this._loadingEl = null;
    this._animFrameId = null;
  }

  init() {
    if (this._initialized) return;
    this._initialized = true;

    const mapWrap = this.container.querySelector('.overview-map-wrap');

    // 显示加载状态
    this._showLoading(mapWrap);

    // 创建地图容器
    const mapDiv = document.createElement('div');
    mapDiv.id = 'overviewMap';
    mapDiv.style.cssText = 'width:100%;height:100%;';
    mapWrap.appendChild(mapDiv);

    // 初始化 Leaflet 地图（SVG渲染，确保CSS动画可用）
    this.map = L.map('overviewMap', {
      center: [28, 60],
      zoom: 3,
      minZoom: 2,
      maxZoom: 10,
      worldCopyJump: true,
      zoomControl: false,
      renderer: L.svg()  // 必须用SVG才能支持CSS动画
    });

    // 添加缩放控件
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    // 瓦片源列表（按优先级，失败自动切换）
    const tileSources = [
      {
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        options: { subdomains: 'abcd', maxZoom: 19, attribution: '&copy; OSM &copy; CARTO' }
      },
      {
        url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png',
        options: { maxZoom: 20, attribution: '&copy; Stadia Maps &copy; OSM' }
      },
      {
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        options: { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }
      }
    ];

    // 尝试加载瓦片，失败自动切换备用源
    this._loadTileWithFallback(tileSources, 0);

    // 5秒超时保底隐藏loading
    setTimeout(() => this._hideLoading(), 5000);

    // 渲染路线（带流动动画）
    this._renderRoutes();

    // 渲染文化标记
    this._renderCultureMarkers();

    // 渲染图例
    this._renderLegend();

    // 启动流动动画
    this._startFlowAnimation();

    // 修复容器大小
    setTimeout(() => this.map.invalidateSize(), 300);
  }

  _showLoading(container) {
    this._loadingEl = document.createElement('div');
    this._loadingEl.className = 'overview-loading';
    this._loadingEl.innerHTML = `
      <div class="overview-loading-spinner"></div>
      <div class="overview-loading-text">正在加载文化路线地图…</div>
    `;
    container.appendChild(this._loadingEl);
  }

  _hideLoading() {
    if (this._loadingEl) {
      this._loadingEl.classList.add('fade-out');
      setTimeout(() => {
        this._loadingEl?.remove();
        this._loadingEl = null;
      }, 400);
    }
  }

  _loadTileWithFallback(sources, index) {
    if (index >= sources.length) {
      // 所有源都失败，使用最后一个并隐藏loading
      this._hideLoading();
      return;
    }

    const source = sources[index];
    let errorCount = 0;
    const maxErrors = 8; // 容忍的最大错误瓦片数

    const tileLayer = L.tileLayer(source.url, {
      ...source.options,
      errorTileUrl: '', // 失败瓦片显示空白而非灰色
      crossOrigin: 'anonymous'
    }).addTo(this.map);

    // 监听加载成功
    tileLayer.on('load', () => {
      this._hideLoading();
    });

    // 监听单个瓦片加载失败
    tileLayer.on('tileerror', (e) => {
      errorCount++;
      // 对失败的瓦片进行重试（最多2次）
      const tile = e.tile;
      const src = tile.src || tile.getAttribute('src');
      if (tile._retryCount === undefined) tile._retryCount = 0;
      if (tile._retryCount < 2 && src) {
        tile._retryCount++;
        setTimeout(() => {
          tile.src = src + (src.includes('?') ? '&' : '?') + 'retry=' + tile._retryCount;
        }, 1000 * tile._retryCount);
      }

      // 如果错误太多，切换到备用源
      if (errorCount > maxErrors) {
        this.map.removeLayer(tileLayer);
        console.warn(`[OverviewMap] 瓦片源 ${index} 加载失败过多，切换备用源...`);
        this._loadTileWithFallback(sources, index + 1);
      }
    });
  }

  _renderRoutes() {
    // 注入 SVG 发光滤镜到地图 SVG 容器
    this._injectSVGFilters();
    this._flowParticles = []; // 存储流动光点的 polyline 引用

    Object.keys(routesData).forEach(key => {
      const route = routesData[key];
      const layerGroup = L.layerGroup();

      const allCoordinates = this._extractCoordinates(route.geojson);

      allCoordinates.forEach(coords => {
        const latLngs = coords.map(c => [c[1], c[0]]);

        // 第1层：外发光（宽、模糊、低透明度）
        L.polyline(latLngs, {
          color: route.color,
          weight: 12,
          opacity: 0.12,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
          className: 'route-glow-outer'
        }).addTo(layerGroup);

        // 第2层：中间发光
        L.polyline(latLngs, {
          color: route.color,
          weight: 6,
          opacity: 0.3,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
          className: 'route-glow-mid'
        }).addTo(layerGroup);

        // 第3层：核心实线（亮、窄）
        L.polyline(latLngs, {
          color: route.pulseColor,
          weight: 2.5,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
          className: 'route-core'
        }).addTo(layerGroup);

        // 第4层：流动光点（短高亮段沿路线移动）
        const particle = L.polyline(latLngs, {
          color: '#ffffff',
          weight: 3,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: '8, 200',
          interactive: false,
          className: `flow-particle flow-particle-${key}`
        }).addTo(layerGroup);
        this._flowParticles.push(particle);

        // 透明宽击中区域（用于交互）
        L.polyline(latLngs, {
          weight: 20,
          opacity: 0,
          interactive: true
        }).bindPopup(`
          <div class="route-popup">
            <h3 style="margin:0 0 8px;font-size:15px;color:${route.color}">${route.name}</h3>
            <p style="margin:0 0 4px;font-size:12px;color:#7a7068"><strong>时期：</strong>${route.period}</p>
            <p style="margin:0;font-size:12px;color:#363035;line-height:1.5">${route.description}</p>
          </div>
        `).addTo(layerGroup);
      });

      layerGroup.addTo(this.map);
      this.routeLayers[key] = { layer: layerGroup, visible: true, data: route };
    });
  }

  _injectSVGFilters() {
    // 在 Leaflet 的 SVG overlay 中添加发光 filter
    const svgEl = this.map.getRenderer(L.polyline([[0,0]])).getContainer
      ? this.map.getRenderer(L.polyline([[0,0],[1,1]])).getContainer()
      : document.querySelector('.leaflet-overlay-pane svg');

    if (svgEl && !svgEl.querySelector('#glowFilter')) {
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      defs.innerHTML = `
        <filter id="glowFilter" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      `;
      svgEl.insertBefore(defs, svgEl.firstChild);
    }
  }

  _extractCoordinates(geojson) {
    if (geojson.type === 'FeatureCollection') {
      return geojson.features.map(f => f.geometry.coordinates);
    } else if (geojson.type === 'Feature') {
      return [geojson.geometry.coordinates];
    }
    return [];
  }

  // 光脉冲流动动画：短光点沿路线移动
  _startFlowAnimation() {
    let offset = 0;

    const animate = () => {
      offset -= 3;  // 流动速度

      // 直接通过 Leaflet polyline 内部的 _path 属性访问 SVG path 元素
      if (this._flowParticles) {
        this._flowParticles.forEach(polyline => {
          const pathEl = polyline._path || polyline.getElement?.();
          if (pathEl) {
            pathEl.setAttribute('stroke-dashoffset', offset);
          }
        });
      }

      this._animFrameId = requestAnimationFrame(animate);
    };

    // 延迟启动，确保 Leaflet SVG 渲染完成
    setTimeout(() => {
      this._animFrameId = requestAnimationFrame(animate);
    }, 800);
  }

  _stopFlowAnimation() {
    if (this._animFrameId) {
      cancelAnimationFrame(this._animFrameId);
      this._animFrameId = null;
    }
  }

  _renderCultureMarkers() {
    Object.keys(routesData).forEach(key => {
      const route = routesData[key];
      const layerGroup = this.routeLayers[key]?.layer;
      if (!layerGroup) return;

      route.keyPoints.forEach(point => {
        const icon = L.divIcon({
          html: `<span class="culture-marker" style="--marker-color:${route.color}">${point.icon || '📍'}</span>`,
          className: 'culture-marker-container',
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        const marker = L.marker([point.coords[1], point.coords[0]], { icon })
          .addTo(layerGroup);

        marker.bindPopup(`
          <div style="text-align:center;min-width:120px">
            <div style="font-size:24px;margin-bottom:4px">${point.icon || '📍'}</div>
            <b style="font-size:14px;color:${route.color}">${point.name}</b>
            <p style="margin:6px 0 0;font-size:12px;color:#7a7068;line-height:1.4">${point.desc}</p>
          </div>
        `);

        marker.on('mouseover', () => {
          const el = marker.getElement();
          if (el) el.classList.add('marker-hover');
        });
        marker.on('mouseout', () => {
          const el = marker.getElement();
          if (el) el.classList.remove('marker-hover');
        });
      });
    });
  }

  _renderLegend() {
    const legend = L.control({ position: 'topleft' });
    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'overview-legend');
      div.innerHTML = `
        <div class="overview-legend-inner">
          <h4 class="overview-legend-title">📜 全球文化交流路线</h4>
          ${Object.entries(routesData).map(([key, route]) => `
            <label class="overview-legend-item" data-route="${key}">
              <span class="overview-legend-color" style="background:${route.color}"></span>
              <span class="overview-legend-name">${route.name}</span>
              <span class="overview-legend-period">${route.period}</span>
            </label>
          `).join('')}
          <div class="overview-legend-hint">点击路线名称切换显隐</div>
        </div>
      `;

      div.querySelectorAll('.overview-legend-item').forEach(item => {
        item.addEventListener('click', () => {
          const routeKey = item.dataset.route;
          this._toggleRoute(routeKey, item);
        });
      });

      return div;
    };
    legend.addTo(this.map);
  }

  _toggleRoute(key, legendItem) {
    const route = this.routeLayers[key];
    if (!route) return;

    if (route.visible) {
      this.map.removeLayer(route.layer);
      route.visible = false;
      legendItem.classList.add('legend-disabled');
    } else {
      this.map.addLayer(route.layer);
      route.visible = true;
      legendItem.classList.remove('legend-disabled');
    }
  }

  flyToRoute(key) {
    const route = routesData[key];
    if (!route) return;
    const geojsonLayer = L.geoJSON(route.geojson);
    this.map.flyToBounds(geojsonLayer.getBounds(), {
      padding: [50, 50],
      duration: 1.2
    });
  }

  resize() {
    if (this.map) {
      this.map.invalidateSize();
    }
  }

  destroy() {
    this._stopFlowAnimation();
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this._initialized = false;
  }
}
