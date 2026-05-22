// 自定义文化图标
const cultureIcons = {
  silk:    L.divIcon({ html: '🧵', className: 'emoji-icon', iconSize: [24, 24] }),
  tea:     L.divIcon({ html: '🍵', className: 'emoji-icon', iconSize: [24, 24] }),
  spice:   L.divIcon({ html: '🌶️', className: 'emoji-icon', iconSize: [24, 24] }),
  gold:    L.divIcon({ html: '💰', className: 'emoji-icon', iconSize: [24, 24] }),
  temple:  L.divIcon({ html: '🏛️', className: 'emoji-icon', iconSize: [24, 24] }),
};

// 在关键节点放置文化标记
L.marker([40.14, 94.66], { icon: cultureIcons.temple })
  .bindPopup('<b>敦煌莫高窟</b><br>丝路上的佛教艺术宝库')
  .addTo(map);