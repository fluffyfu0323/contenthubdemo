/**
 * main.js — Paper Style 主入口
 * 编排地球、时间轴、面板的初始化和事件连接
 */

import { GlobeModule } from './globe.js';
import { TimelineModule } from './timeline.js';
import { PanelModule } from './panel.js';
import { TIME_PERIODS, getPeriodConfig, getCachedAssetsForPeriod } from './data.js';

class InspirationExplorerPaper {
  constructor() {
    this.globe = null;
    this.timeline = null;
    this.panel = null;
    this.loadingEl = null;
    this._currentPeriodKey = null;
    this._currentAssets = [];
  }

  async init() {
    const globeContainer = document.getElementById('globeContainer');
    const timelineContainer = document.getElementById('timelinePanel');
    const panelContainer = document.getElementById('infoPanel');
    this.loadingEl = document.getElementById('loadingOverlay');

    document.body.classList.add('scene-entering');

    // 1. 时间轴
    this.timeline = new TimelineModule(timelineContainer);
    this.timeline.init();

    // 2. 面板
    this.panel = new PanelModule(panelContainer);
    this.panel.init();

    // 3. 地球
    this.globe = new GlobeModule(globeContainer);

    this.globe.onLoadProgress = (percent) => {
      const textEl = this.loadingEl?.querySelector('.loading-text');
      if (textEl) textEl.textContent = `加载地球数据… ${percent}%`;
    };

    this.globe.onLoadComplete = () => {
      setTimeout(() => {
        if (this.loadingEl) {
          this.loadingEl.classList.add('fade-out');
          setTimeout(() => { this.loadingEl.style.display = 'none'; }, 600);
        }
        this._playEntrySequence();
      }, 200);
    };

    await this.globe.init();

    // 4. 绑定事件
    this._bindEvents();

    // 5. 初始色
    this._updatePeriodColor(this.timeline.getActivePeriod().color);

    console.log('[Paper Style] 初始化完成');
  }

  _playEntrySequence() {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      document.body.classList.remove('scene-entering');
      this._loadPeriodData(this.timeline.getActivePeriod());
      return;
    }

    this.globe.playEntrySequence();

    setTimeout(() => {
      const h = document.querySelector('.header');
      if (h) { h.classList.add('entered'); h.style.opacity = ''; h.style.transform = ''; }
    }, 1500);

    setTimeout(() => {
      const tl = document.getElementById('timelinePanel');
      tl.style.opacity = ''; tl.style.transform = ''; tl.classList.add('entered');
    }, 1800);

    setTimeout(() => {
      const ip = document.getElementById('infoPanel');
      ip.style.opacity = ''; ip.style.transform = ''; ip.classList.add('entered');
    }, 2300);

    setTimeout(() => { this._loadPeriodData(this.timeline.getActivePeriod()); }, 2000);
    setTimeout(() => { document.body.classList.remove('scene-entering'); }, 3200);
  }

  async _loadPeriodData(period) {
    if (!period) return;
    this._currentPeriodKey = period.key;
    this.panel.showLoading(`正在加载「${period.name}」的藏品…`);

    try {
      const assets = await getCachedAssetsForPeriod(period.key, 20, (loaded, total) => {
        this.panel.updateLoadingProgress(loaded, total);
      });

      if (this._currentPeriodKey !== period.key) return;
      this._currentAssets = assets;

      this.globe.setMarkers(assets, period.color, true);

      if (assets.length > 0) {
        this.panel.showAssetList(assets, `${period.name} · The Met`);
        this.panel._lastTitle = `${period.name} · The Met`;
      } else {
        this.panel.showAssetList([], period.name);
      }

      this.timeline.updateNodeCount(period.key, assets.length);
    } catch (err) {
      console.error(`[Paper] 加载失败:`, err);
      if (this._currentPeriodKey === period.key) {
        this.panel.showAssetList([], period.name);
      }
    }
  }

  _updatePeriodColor(color) {
    document.documentElement.style.setProperty('--period-color', color);
  }

  _bindEvents() {
    this.timeline.onPeriodChange = (periodData) => {
      this._updatePeriodColor(periodData.color);
      this.globe.setMarkers([], periodData.color, true);
      this._loadPeriodData(periodData);
    };

    this.globe.onMarkerClick = (cluster) => {
      this.panel.showAssetList(cluster.assets, `${cluster.regionName} · ${cluster.periodName}`);
      this.panel._lastTitle = `${cluster.regionName} · ${cluster.periodName}`;
    };

    this.globe.onMarkerHover = () => {};

    this.panel.onAssetSelect = (asset) => {
      if (asset && this.globe) {
        this.globe.flyTo(asset.lat, asset.lng, 1200, 10);
      }
    };
  }
}

// ===== 启动 =====
document.addEventListener('DOMContentLoaded', () => {
  const app = new InspirationExplorerPaper();
  app.init().catch(err => console.error('[Paper Style] 启动失败:', err));
});
