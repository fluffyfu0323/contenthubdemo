// 使用 leaflet-ant-path 插件实现路线流动效果
// npm install leaflet-ant-path
import { AntPath } from 'leaflet-ant-path';

const silkRoadAnim = new AntPath(
  routesData.silkRoad.geojson.geometry.coordinates.map(c => [c[1], c[0]]),
  {
    color: '#C0392B',
    pulseColor: '#FFD700',
    delay: 800,
    dashArray: [20, 40],
    weight: 5,
    opacity: 0.7
  }
).addTo(map);