/**
 * main.js — Paper Style 主入口
 * 编排地球、时间轴、面板的初始化和事件连接
 */

import { GlobeModule } from './globe.js';
import { TimelineModule } from './timeline.js';
import { PanelModule } from './panel.js';
import { TIME_PERIODS, getPeriodConfig, getCachedAssetsForPeriod } from './data.js';
import { DeepDiveModule, drawChart } from './deepdive.js';
import { OverviewMapModule } from './overview-map.js';

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
    this.loadingEl = document.getElementById('loadingOverlay');

    // 1. 初始化视图切换导航
    this._initViewSwitcher();

    // 2. 默认进入深潜模式（不加载3D地球）
    this._switchView('deepdive');

    // 隐藏地球 loading（因为默认不加载地球）
    if (this.loadingEl) {
      this.loadingEl.style.display = 'none';
    }

    console.log('[Paper Style] 初始化完成（默认深潜模式）');
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

  /* ===== 视图切换 ===== */
  _initViewSwitcher() {
    this._currentView = null; // 初始为null，确保第一次switchView能执行
    const btns = document.querySelectorAll('.view-btn');
    const glider = document.querySelector('.nav-glider');
    if (!btns.length || !glider) return;

    const activeBtn = document.querySelector('.view-btn.active');
    if (activeBtn) {
      requestAnimationFrame(() => this._moveGlider(glider, activeBtn));
    }

    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('active')) return;
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._moveGlider(glider, btn);
        this._switchView(btn.dataset.view);
      });
    });

    window.addEventListener('resize', () => {
      const current = document.querySelector('.view-btn.active');
      if (current) this._moveGlider(glider, current);
    });
  }

  _moveGlider(glider, targetBtn) {
    glider.style.left = targetBtn.offsetLeft + 'px';
    glider.style.width = targetBtn.offsetWidth + 'px';
  }

  _switchView(viewName) {
    if (this._currentView === viewName) return;
    this._currentView = viewName;

    const layout = document.querySelector('.app-layout');
    layout.classList.remove('view-explore', 'view-overview', 'view-deepdive');

    if (viewName === 'explore') {
      // 懒加载3D地球
      this._initExploreGlobe();
      this.globe?.resume?.();
      this._ddModule?.pause?.();
    } else if (viewName === 'overview') {
      layout.classList.add('view-overview');
      this.globe?.pause?.();
      this._ddModule?.pause?.();
      this._initOverviewMap();
    } else if (viewName === 'deepdive') {
      layout.classList.add('view-deepdive');
      this.globe?.pause?.();
      this._initDeepDive();
    }
  }

  /* ===== 懒加载3D地球 ===== */
  async _initExploreGlobe() {
    if (this.globe) return; // 已初始化过

    const globeContainer = document.getElementById('globeContainer');
    const timelineContainer = document.getElementById('timelinePanel');
    const panelContainer = document.getElementById('infoPanel');
    this.loadingEl = document.getElementById('loadingOverlay');

    if (this.loadingEl) {
      this.loadingEl.style.display = '';
      this.loadingEl.classList.remove('fade-out');
    }

    // 初始化时间轴
    this.timeline = new TimelineModule(timelineContainer);
    this.timeline.init();

    // 初始化面板
    this.panel = new PanelModule(panelContainer);
    this.panel.init();

    // 初始化地球
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
    this._bindEvents();
    this._updatePeriodColor(this.timeline.getActivePeriod().color);
  }

  /* ===== 全景地图初始化 ===== */
  _initOverviewMap() {
    if (!this._overviewMap) {
      const container = document.getElementById('overviewContainer');
      if (container) {
        this._overviewMap = new OverviewMapModule(container);
        this._overviewMap.init();
      }
    } else {
      this._overviewMap.resize();
    }
  }

  async _initDeepDive() {
    if (!this._ddModule) {
      const container = document.getElementById('ddGlobeContainer');
      if (container) {
        this._ddModule = new DeepDiveModule(container);
        await this._ddModule.init();
      }
      // 绘制折线图
      setTimeout(() => drawChart('ddChart'), 100);
    } else {
      this._ddModule.resume();
    }
  }
}

// ===== 启动 =====
document.addEventListener('DOMContentLoaded', () => {
  const app = new InspirationExplorerPaper();
  app.init().catch(err => console.error('[Paper Style] 启动失败:', err));
});
