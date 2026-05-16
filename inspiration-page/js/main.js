/**
 * main.js - 灵感探索页主入口（Met API 版）
 *
 * 流程：
 * 1. 初始化三个模块
 * 2. 地球纹理加载 → 入场动画
 * 3. 入场完成后 → 加载默认时期的 Met 数据
 * 4. 时间轴切换 → 异步加载该时期数据 → 刷新标记+面板
 * 5. 标记点点击 → 面板显示该聚合区域的资产列表
 */

import { GlobeModule } from './globe.js';
import { TimelineModule } from './timeline.js';
import { PanelModule } from './panel.js';
import { TIME_PERIODS, getPeriodConfig, getCachedAssetsForPeriod } from './data.js';

class InspirationExplorer {
  constructor() {
    this.globe = null;
    this.timeline = null;
    this.panel = null;
    this.loadingEl = null;
    this._currentPeriodKey = null;
    this._currentAssets = [];
    this._currentView = 'explore';
  }

  async init() {
    const globeContainer = document.getElementById('globeContainer');
    const timelineContainer = document.getElementById('timelinePanel');
    const panelContainer = document.getElementById('infoPanel');
    this.loadingEl = document.getElementById('loadingOverlay');

    document.body.classList.add('scene-entering');

    // 1. 初始化时间轴
    this.timeline = new TimelineModule(timelineContainer);
    this.timeline.init();

    // 2. 初始化面板
    this.panel = new PanelModule(panelContainer);
    this.panel.init();

    // 3. 初始化地球
    this.globe = new GlobeModule(globeContainer);

    this.globe.onLoadProgress = (percent) => {
      const textEl = this.loadingEl?.querySelector('.loading-text');
      if (textEl) textEl.textContent = `加载地球纹理… ${percent}%`;
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

    // 5. 初始化视图切换导航
    this._initViewSwitcher();

    // 6. 初始色
    this._updatePeriodColor(this.timeline.getActivePeriod().color);

    console.log('[InspirationExplorer] 初始化完成，等待 Met 数据加载');
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
      document.querySelector('.header')?.classList.add('entered');
      document.querySelector('.header').style.opacity = '';
      document.querySelector('.header').style.transform = '';
    }, 1500);

    setTimeout(() => {
      const tl = document.getElementById('timelinePanel');
      tl.style.opacity = ''; tl.style.transform = '';
      tl.classList.add('entered');
    }, 1800);

    setTimeout(() => {
      const ip = document.getElementById('infoPanel');
      ip.style.opacity = ''; ip.style.transform = '';
      ip.classList.add('entered');
    }, 2300);

    // 加载 Met 数据（入场同时开始，不用等入场完成）
    setTimeout(() => {
      this._loadPeriodData(this.timeline.getActivePeriod());
    }, 2000);

    setTimeout(() => {
      document.body.classList.remove('scene-entering');
    }, 3200);
  }

  /**
   * 核心：加载指定时期的 Met 数据，刷新标记+面板
   */
  async _loadPeriodData(period) {
    if (!period) return;
    this._currentPeriodKey = period.key;

    // 面板显示加载态
    this.panel.showLoading(`正在加载「${period.name}」的藏品…`);

    try {
      const assets = await getCachedAssetsForPeriod(period.key, 20, (loaded, total) => {
        this.panel.updateLoadingProgress(loaded, total);
      });

      // 检查是否还是当前时期（用户可能在加载中切换了）
      if (this._currentPeriodKey !== period.key) return;

      this._currentAssets = assets;

      // 刷新地球标记
      this.globe.setMarkers(assets, period.color, true);

      // 刷新面板
      if (assets.length > 0) {
        this.panel.showAssetList(assets, `${period.name} · The Met`);
        this.panel._lastTitle = `${period.name} · The Met`;
      } else {
        this.panel.showAssetList([], period.name);
      }

      console.log(`[Met] 「${period.name}」加载完成: ${assets.length} 件藏品`);

      // 更新时间轴节点上的计数
      this.timeline.updateNodeCount(period.key, assets.length);

    } catch (err) {
      console.error(`[Met] 加载失败:`, err);
      if (this._currentPeriodKey === period.key) {
        this.panel.showAssetList([], period.name);
      }
    }
  }

  _updatePeriodColor(color) {
    document.documentElement.style.setProperty('--period-color', color);
  }

  _bindEvents() {
    // 时间轴切换 → 加载新时期数据
    this.timeline.onPeriodChange = (periodData) => {
      console.log(`[Event] period:change → ${periodData.name}`);
      this._updatePeriodColor(periodData.color);

      // 先清除旧标记
      this.globe.setMarkers([], periodData.color, true);

      // 异步加载新数据
      this._loadPeriodData(periodData);
    };

    // 标记点点击 → 面板显示该区域资产
    this.globe.onMarkerClick = (cluster) => {
      console.log(`[Event] region:select → ${cluster.regionName} (${cluster.assets.length}件)`);
      this.panel.showAssetList(cluster.assets, `${cluster.regionName} · ${cluster.periodName}`);
      this.panel._lastTitle = `${cluster.regionName} · ${cluster.periodName}`;
    };

    this.globe.onMarkerHover = () => {};

    // 面板卡片点击 → 地球飞行
    this.panel.onAssetSelect = (asset) => {
      if (asset && this.globe) {
        this.globe.flyTo(asset.lat, asset.lng, 1200, 10);
      }
    };
  }

  /* ===== 视图切换 ===== */
  _initViewSwitcher() {
    const btns = document.querySelectorAll('.view-btn');
    const glider = document.querySelector('.nav-glider');
    if (!btns.length || !glider) return;

    // 初始化滑块位置
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

    // 窗口 resize 时重新定位滑块
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

    if (viewName !== 'explore') {
      layout.classList.add(`view-${viewName}`);
    }

    // 切到非探索模式时暂停地球渲染以节省性能
    if (viewName === 'explore') {
      this.globe?.resume?.();
    } else {
      this.globe?.pause?.();
    }

    console.log(`[View] 切换到: ${viewName}`);
  }
}

// ===== 启动 =====
document.addEventListener('DOMContentLoaded', () => {
  const app = new InspirationExplorer();
  app.init().catch(err => console.error('[InspirationExplorer] 启动失败:', err));
});
