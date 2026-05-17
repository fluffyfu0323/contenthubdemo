/**
 * panel.js — Paper Style 右侧信息面板
 * 功能与原版一致，样式由 CSS 控制
 */

export class PanelModule {
  constructor(container) {
    this.container = container;
    this.currentAsset = null;
    this.currentAssets = [];
    this._lastTitle = '';
    this.onAssetSelect = null;
  }

  init() { this._renderPlaceholder(); }

  _renderPlaceholder() {
    this.container.innerHTML = `
      <div class="panel-placeholder">
        <div class="placeholder-icon">🌍</div>
        <div class="placeholder-title">选择一个文化地标</div>
        <div class="placeholder-desc">
          在地球上点击发光标注点，<br>
          或从左侧时间轴选择一个时期，<br>
          即可查看来自 The Met 的文化资产。
        </div>
      </div>`;
  }

  showLoading(message = '正在加载藏品…') {
    this.container.innerHTML = `
      <div class="panel-loading">
        <div class="panel-loading-spinner"></div>
        <div class="panel-loading-text">${this._esc(message)}</div>
      </div>`;
  }

  updateLoadingProgress(loaded, total) {
    const el = this.container.querySelector('.panel-loading-text');
    if (el) el.textContent = `正在加载… ${loaded}/${total} 件藏品`;
  }

  showAssetList(assets, title = '文化资产') {
    this.currentAssets = assets;
    this.currentAsset = null;
    this._lastTitle = title;

    if (!assets || !assets.length) {
      this.container.innerHTML = `
        <div class="panel-placeholder">
          <div class="placeholder-icon">📭</div>
          <div class="placeholder-title">暂无数据</div>
          <div class="placeholder-desc">该时期/区域暂未加载到符合条件的文化资产。</div>
        </div>`;
      return;
    }

    const cards = assets.map((a, i) => {
      const imgUrl = a.thumbnail || '';
      const fallbackUrl = `https://placehold.co/128x128/e8e0d2/7a7068?text=${encodeURIComponent(a.name.slice(0,12))}`;
      return `
        <div class="asset-card" data-index="${i}">
          <div class="asset-card-img-wrap">
            <img class="asset-card-img" src="${imgUrl}" alt="${this._esc(a.name)}" loading="lazy"
                 onerror="this.onerror=null;this.src='${fallbackUrl}'">
          </div>
          <div class="asset-card-info">
            <div class="asset-card-name">${this._esc(a.name)}</div>
            <div class="asset-card-meta">
              ${a.regionName ? `<span>${this._esc(a.regionName)}</span>` : ''}
              ${a.yearDisplay ? `<span>· ${this._esc(a.yearDisplay)}</span>` : ''}
            </div>
            ${a.culture ? `<div class="asset-card-culture">${this._esc(a.culture)}</div>` : ''}
          </div>
        </div>`;
    }).join('');

    this.container.innerHTML = `
      <div class="panel-header">
        <div class="panel-header-title">${this._esc(title)}</div>
        <div class="panel-header-count">${assets.length} 件藏品</div>
      </div>
      <div class="panel-list">${cards}</div>`;

    this.container.querySelectorAll('.asset-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.index);
        const asset = this.currentAssets[idx];
        if (asset) {
          this.showAsset(asset);
          if (this.onAssetSelect) this.onAssetSelect(asset);
        }
      });
    });
  }

  showAsset(asset) {
    this.currentAsset = asset;
    const imgUrl = asset.fullImage || asset.thumbnail || '';
    const fallbackUrl = `https://placehold.co/400x300/e8e0d2/7a7068?text=${encodeURIComponent(asset.name.slice(0,20))}`;
    const tags = (asset.tags || []).map(t => `<span class="asset-detail-tag">${this._esc(t)}</span>`).join('');

    this.container.innerHTML = `
      <div class="panel-detail">
        <button class="panel-back-btn" id="panelBackBtn">← 返回列表</button>
        <div class="asset-detail-img-wrap">
          <img class="asset-detail-img" src="${imgUrl}" alt="${this._esc(asset.name)}"
               onerror="this.onerror=null;this.src='${fallbackUrl}'">
        </div>
        <div class="asset-detail-body">
          <h3 class="asset-detail-name">${this._esc(asset.name)}</h3>
          ${asset.artist ? `<div class="asset-detail-artist">🎨 ${this._esc(asset.artist)}</div>` : ''}
          <div class="asset-detail-meta-grid">
            ${this._row('年代', asset.yearDisplay)}
            ${this._row('地区', asset.regionName)}
            ${this._row('文化', asset.culture)}
            ${this._row('部门', asset.department)}
            ${this._row('博物馆', asset.museum)}
          </div>
          ${asset.description ? `<div class="asset-detail-desc">${this._esc(asset.description)}</div>` : ''}
          ${tags ? `<div class="asset-detail-tags">${tags}</div>` : ''}
          ${asset.sourceUrl ? `<a class="asset-detail-link" href="${asset.sourceUrl}" target="_blank" rel="noopener">在 The Met 官网查看 →</a>` : ''}
          ${asset.isPublicDomain ? `<div class="asset-detail-license"><span class="license-badge">CC0</span>公共领域 · 可自由用于商业用途</div>` : ''}
        </div>
      </div>`;

    document.getElementById('panelBackBtn')?.addEventListener('click', () => {
      if (this.currentAssets.length) this.showAssetList(this.currentAssets, this._lastTitle);
      else this._renderPlaceholder();
    });
  }

  _row(label, value) {
    return value ? `<div class="detail-meta-row"><span class="detail-meta-label">${label}</span><span class="detail-meta-value">${this._esc(value)}</span></div>` : '';
  }

  reset() { this.currentAsset = null; this.currentAssets = []; this._renderPlaceholder(); }
  _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  dispose() { this.container.innerHTML = ''; }
}
