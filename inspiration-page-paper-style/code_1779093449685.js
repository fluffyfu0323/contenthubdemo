// routes.js - 路线数据与地图初始化

// ========== 路线 GeoJSON 数据 ==========
const routesData = {
  "silkRoad": {
    name: "🐫 丝绸之路",
    nameEn: "Silk Road",
    color: "#C0392B",
    period: "公元前2世纪 — 公元15世纪",
    description: "连接中国长安与地中海地区，横跨欧亚大陆的古代贸易走廊，传播丝绸、瓷器、茶叶及佛教、伊斯兰教等文化。",
    geojson: {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [108.94, 34.26],  // 西安（长安）
          [103.83, 36.06],  // 兰州
          [98.29, 39.77],   // 张掖
          [94.66, 40.14],   // 敦煌
          [87.62, 43.79],   // 乌鲁木齐
          [76.95, 43.25],   // 比什凯克
          [69.28, 41.31],   // 塔什干
          [66.96, 39.65],   // 撒马尔罕
          [64.42, 39.77],   // 布哈拉
          [51.39, 35.69],   // 德黑兰
          [44.37, 33.31],   // 巴格达
          [36.29, 33.51],   // 大马士革
          [35.50, 33.89],   // 贝鲁特
          [29.01, 41.01],   // 伊斯坦布尔
          [12.50, 41.90],   // 罗马
        ]
      }
    },
    keyPoints: [
      { name: "长安", coords: [108.94, 34.26], desc: "起点：汉唐帝国都城" },
      { name: "敦煌", coords: [94.66, 40.14], desc: "丝路门户，莫高窟所在地" },
      { name: "撒马尔罕", coords: [66.96, 39.65], desc: "中亚贸易枢纽" },
      { name: "罗马", coords: [12.50, 41.90], desc: "终点：罗马帝国中心" }
    ]
  },

  "teaHorseRoad": {
    name: "🐴 茶马古道",
    nameEn: "Tea Horse Road",
    color: "#27AE60",
    period: "唐宋时期 — 20世纪中期",
    description: "以茶叶和马匹为主要交易商品，连接中国西南与西藏、南亚的古代商道，穿越横断山脉。",
    geojson: {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [100.98, 22.79],  // 西双版纳（普洱茶产区）
          [100.23, 25.04],  // 大理
          [100.23, 26.87],  // 丽江
          [99.71, 27.83],   // 香格里拉
          [98.91, 28.66],   // 德钦
          [98.60, 29.65],   // 芒康
          [97.17, 31.14],   // 昌都
          [91.13, 29.65],   // 拉萨
        ]
      }
    },
    keyPoints: [
      { name: "普洱", coords: [100.98, 22.79], desc: "茶叶产区起点" },
      { name: "大理", coords: [100.23, 25.04], desc: "南诏国商贸中心" },
      { name: "拉萨", coords: [91.13, 29.65], desc: "茶马互市重要终点" }
    ]
  },

  "spiceRoute": {
    name: "🌶️ 香料之路（海上贸易航线）",
    nameEn: "Spice Route",
    color: "#E67E22",
    period: "公元前3世纪 — 公元17世纪",
    description: "连接东南亚香料群岛、印度、阿拉伯半岛与欧洲的海上贸易航线，传播了胡椒、丁香、肉豆蔻等珍贵香料。",
    geojson: {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [127.38, -0.54],  // 马鲁古群岛（香料群岛）
          [110.36, -7.80],  // 爪哇
          [104.06, 1.29],   // 马六甲海峡
          [80.27, 13.08],   // 金奈（印度东海岸）
          [73.86, 15.49],   // 果阿
          [56.27, 25.29],   // 霍尔木兹海峡
          [45.02, 12.80],   // 亚丁湾
          [43.15, 14.53],   // 亚丁
          [32.53, 29.97],   // 苏伊士
          [23.73, 37.97],   // 雅典
          [12.50, 41.90],   // 罗马
          [9.19, 45.46],    // 米兰
          [-9.14, 38.74],   // 里斯本
        ]
      }
    },
    keyPoints: [
      { name: "马鲁古群岛", coords: [127.38, -0.54], desc: "丁香与肉豆蔻原产地" },
      { name: "马六甲", coords: [104.06, 1.29], desc: "东西方海运咽喉" },
      { name: "亚丁", coords: [43.15, 14.53], desc: "阿拉伯商人集散地" }
    ]
  },

  "transSaharan": {
    name: "🏜️ 撒哈拉横贯贸易路线",
    nameEn: "Trans-Saharan Trade Route",
    color: "#F1C40F",
    period: "公元8世纪 — 公元16世纪",
    description: "穿越撒哈拉沙漠连接北非地中海沿岸与西非的绿洲贸易路线，以黄金、食盐、象牙和奴隶交易为主。",
    geojson: {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [-8.01, 31.63],   // 马拉喀什
          [-5.55, 34.02],   // 菲斯
          [3.06, 36.74],    // 阿尔及尔
          [2.11, 33.80],    // 加尔达亚
          [5.43, 28.05],    // 盖尔达耶
          [2.12, 21.86],    // 阿德拉尔
          [-0.05, 16.27],   // 廷巴克图
          [-7.99, 12.65],   // 巴马科
          [-1.52, 12.37],   // 瓦加杜古
        ]
      }
    },
    keyPoints: [
      { name: "廷巴克图", coords: [-0.05, 16.27], desc: "撒哈拉贸易黄金城" },
      { name: "马拉喀什", coords: [-8.01, 31.63], desc: "北非商贸枢纽" }
    ]
  },

  "romanRoads": {
    name: "🏛️ 罗马大道（罗马帝国道路系统）",
    nameEn: "Roman Roads (Via Romana)",
    color: "#8E44AD",
    period: "公元前3世纪 — 公元5世纪",
    description: "罗马帝国修建的道路网络覆盖整个地中海世界，'条条大路通罗马'体现了其规模。阿庇亚大道是其中最著名的一条。",
    geojson: {
      type: "FeatureCollection",
      features: [
        { // Via Appia - 阿庇亚大道
          type: "Feature",
          properties: { name: "Via Appia 阿庇亚大道" },
          geometry: {
            type: "LineString",
            coordinates: [
              [12.50, 41.90],   // 罗马
              [14.27, 40.85],   // 那不勒斯
              [16.87, 41.12],   // 巴里
              [18.17, 40.35],   // 布林迪西
            ]
          }
        },
        { // 北方路线
          type: "Feature",
          properties: { name: "Via Augusta 奥古斯塔大道" },
          geometry: {
            type: "LineString",
            coordinates: [
              [12.50, 41.90],   // 罗马
              [11.25, 43.77],   // 佛罗伦萨
              [7.69, 45.07],    // 都灵
              [5.37, 43.30],    // 马赛
              [2.17, 41.39],    // 巴塞罗那
              [-3.70, 40.42],   // 马德里
            ]
          }
        },
        { // 东方路线 Via Egnatia
          type: "Feature",
          properties: { name: "Via Egnatia 埃格纳提亚大道" },
          geometry: {
            type: "LineString",
            coordinates: [
              [18.17, 40.35],   // 布林迪西
              [20.85, 39.62],   // 希腊西海岸
              [22.95, 40.63],   // 塞萨洛尼基
              [29.01, 41.01],   // 伊斯坦布尔
            ]
          }
        }
      ]
    },
    keyPoints: [
      { name: "罗马", coords: [12.50, 41.90], desc: "帝国中心，万路之源" },
      { name: "布林迪西", coords: [18.17, 40.35], desc: "通往东方的港口" },
      { name: "伊斯坦布尔", coords: [29.01, 41.01], desc: "东罗马/拜占庭都城" }
    ]
  }
};

// ========== 地图初始化 ==========
const map = L.map('map', {
  center: [30, 50],
  zoom: 3,
  minZoom: 2,
  maxZoom: 10,
  worldCopyJump: true
});

// 使用复古风格底图（推荐 Stamen Watercolor 或 CartoDB）
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap & CartoDB',
  subdomains: 'abcd'
}).addTo(map);

// ========== 渲染路线 ==========
const routeLayers = {};

Object.keys(routesData).forEach(key => {
  const route = routesData[key];
  const layerGroup = L.layerGroup();

  // 绘制路线（带动画虚线效果）
  const routeLine = L.geoJSON(route.geojson, {
    style: {
      color: route.color,
      weight: 4,
      opacity: 0.8,
      dashArray: '10, 6',       // 虚线效果，模拟古道
      lineJoin: 'round',
      lineCap: 'round'
    },
    onEachFeature: (feature, layer) => {
      layer.bindPopup(`
        <div class="route-popup">
          <h3>${route.name}</h3>
          <p><strong>时期：</strong>${route.period}</p>
          <p>${route.description}</p>
        </div>
      `);
    }
  }).addTo(layerGroup);

  // 绘制关键节点
  route.keyPoints.forEach(point => {
    L.circleMarker([point.coords[1], point.coords[0]], {
      radius: 7,
      fillColor: route.color,
      color: '#fff',
      weight: 2,
      fillOpacity: 0.9
    })
    .bindPopup(`<b>${point.name}</b><br>${point.desc}`)
    .addTo(layerGroup);
  });

  layerGroup.addTo(map);
  routeLayers[route.name] = layerGroup;
});

// ========== 图层控制器（可切换显示/隐藏路线） ==========
L.control.layers(null, routeLayers, {
  collapsed: false,
  position: 'topright'
}).addTo(map);

// ========== 自定义图例 ==========
const legend = L.control({ position: 'bottomright' });
legend.onAdd = function() {
  const div = L.DomUtil.create('div', 'legend');
  div.innerHTML = '<h4>📜 文化交流路线</h4>';
  Object.values(routesData).forEach(route => {
    div.innerHTML += `
      <div class="legend-item">
        <div class="legend-color" style="background:${route.color}"></div>
        <span>${route.name}</span>
      </div>
    `;
  });
  return div;
};
legend.addTo(map);