/**
 * timeline.js — Paper Style 时间轴模块
 * 纸质暖色风格，功能与原版一致
 */

import { TIME_PERIODS } from './data.js';

const CONF = {
  defaultPeriod: 'classical',
  heightRatio:   0.70,
  nodeSize:      10,
  nodeActiveScale: 1.6,
  snapThreshold: 0.12,
  animStagger:   80,
  transitionMs:  300,
};

export class TimelineModule {
  constructor(container) {
    this.container = container;
    this.periods = TIME_PERIODS;
    this.activeIndex = this.periods.findIndex(p => p.key === CONF.defaultPeriod);
    if (this.activeIndex < 0) this.activeIndex = 2;
    this.activePeriod = this.periods[this.activeIndex].key;
    this.nodePositions = [];
    this.els = {};
    this._dragging = false;
    this._dragStartY = 0;
    this._sliderPos = 0;
    this.onPeriodChange = null;
    this._cleanups = [];
  }

  init() {
    this._calcNodePositions();
    this._render();
    this._cacheEls();
    this._bindInteractions();
    this._setActive(this.activeIndex, false);
    this._playEntrance();
  }

  _calcNodePositions() {
    const n = this.periods.length;
    const marginTop = 0.04, marginBottom = 0.04;
    const usable = 1 - marginTop - marginBottom;
    this.nodePositions = this.periods.map((_, i) => marginTop + (i / (n - 1)) * usable);
  }

  _render() {
    this.container.innerHTML = `
      <div class="tl-wrapper" tabindex="0" aria-label="时间轴导航">
        <div class="tl-track"><div class="tl-track-glow"></div></div>
        ${this.periods.map((p, i) => {
          const top = this.nodePositions[i] * 100;
          const yearStr = this._formatRange(p.range);
          return `
            <div class="tl-node" data-index="${i}" data-period="${p.key}" style="top: ${top}%" title="${p.name} ${yearStr}">
              <div class="tl-node-dot" style="--node-color: ${p.color}"></div>
              <div class="tl-node-text">
                <div class="tl-node-label">${p.name}</div>
                <div class="tl-node-year">${yearStr}</div>
                <div class="tl-node-count" data-period="${p.key}"></div>
              </div>
            </div>`;
        }).join('')}
        <div class="tl-slider" aria-label="时间滑块"><div class="tl-slider-handle"></div></div>
        <div class="tl-year-label tl-year-top">远古</div>
        <div class="tl-year-label tl-year-bottom">当代</div>
      </div>`;
  }

  _formatRange(range) {
    const fmt = (y) => {
      if (y <= -10000) return `${Math.round(y / -1000)}千年前`;
      if (y < 0) return `前${-y}`;
      return String(y);
    };
    return `${fmt(range[0])} – ${fmt(range[1])}`;
  }

  _cacheEls() {
    this.els.wrapper   = this.container.querySelector('.tl-wrapper');
    this.els.track     = this.container.querySelector('.tl-track');
    this.els.trackGlow = this.container.querySelector('.tl-track-glow');
    this.els.slider    = this.container.querySelector('.tl-slider');
    this.els.handle    = this.container.querySelector('.tl-slider-handle');
    this.els.nodes     = Array.from(this.container.querySelectorAll('.tl-node'));
  }

  _bindInteractions() {
    const wrapper = this.els.wrapper;
    const slider  = this.els.slider;

    this.els.nodes.forEach(node => {
      const handler = (e) => { e.stopPropagation(); this._goToPeriod(parseInt(node.dataset.index)); };
      node.addEventListener('click', handler);
      this._cleanups.push(() => node.removeEventListener('click', handler));
    });

    const onPointerDown = (e) => {
      this._dragging = true; slider.classList.add('dragging');
      document.body.style.userSelect = 'none'; e.preventDefault();
    };
    const onPointerMove = (e) => {
      if (!this._dragging) return;
      const rect = this.els.track.getBoundingClientRect();
      const clamped = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      this._moveSliderTo(clamped); this._checkSnapHint(clamped);
    };
    const onPointerUp = () => {
      if (!this._dragging) return;
      this._dragging = false; slider.classList.remove('dragging');
      document.body.style.userSelect = ''; this._snapToNearest();
    };

    slider.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    this._cleanups.push(
      () => slider.removeEventListener('pointerdown', onPointerDown),
      () => document.removeEventListener('pointermove', onPointerMove),
      () => document.removeEventListener('pointerup', onPointerUp)
    );

    const onTrackClick = (e) => {
      if (this._dragging) return;
      const rect = this.els.track.getBoundingClientRect();
      const clamped = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      this._moveSliderTo(clamped); this._snapToNearest();
    };
    this.els.track.addEventListener('click', onTrackClick);
    this._cleanups.push(() => this.els.track.removeEventListener('click', onTrackClick));

    const onWheel = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (e.deltaY > 0) this._goToPeriod(Math.min(this.activeIndex + 1, this.periods.length - 1));
      else this._goToPeriod(Math.max(this.activeIndex - 1, 0));
    };
    wrapper.addEventListener('wheel', onWheel, { passive: false });
    this._cleanups.push(() => wrapper.removeEventListener('wheel', onWheel));

    const onKeyDown = (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); this._goToPeriod(Math.max(this.activeIndex - 1, 0)); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); this._goToPeriod(Math.min(this.activeIndex + 1, this.periods.length - 1)); }
    };
    wrapper.addEventListener('keydown', onKeyDown);
    this._cleanups.push(() => wrapper.removeEventListener('keydown', onKeyDown));
    wrapper.addEventListener('click', () => wrapper.focus());
  }

  _goToPeriod(index) { if (index !== this.activeIndex) this._setActive(index, true); }

  _setActive(index, animated = true) {
    this.activeIndex = index;
    this.activePeriod = this.periods[index].key;
    const period = this.periods[index];
    const pos = this.nodePositions[index];

    this.els.nodes.forEach((node, i) => {
      node.classList.toggle('active', i === index);
      node.querySelector('.tl-node-dot').style.setProperty('--node-color', this.periods[i].color);
    });

    this._moveSliderTo(pos, animated);
    this._sliderPos = pos;
    this._updateTrackGlow(period.color, animated);

    if (this.onPeriodChange) {
      this.onPeriodChange({ key: period.key, name: period.name, range: period.range, color: period.color, index });
    }
  }

  _moveSliderTo(normalizedY, animated = true) {
    const slider = this.els.slider;
    slider.style.transition = animated ? `top ${CONF.transitionMs}ms cubic-bezier(0.2, 0, 0, 1)` : 'none';
    slider.style.top = `${normalizedY * 100}%`;
    this._sliderPos = normalizedY;
  }

  _checkSnapHint(pos) {
    let nearestIdx = 0, nearestDist = Infinity;
    this.nodePositions.forEach((nPos, i) => {
      const dist = Math.abs(pos - nPos);
      if (dist < nearestDist) { nearestDist = dist; nearestIdx = i; }
    });
    this.els.nodes.forEach((node, i) => node.classList.toggle('snap-hint', i === nearestIdx && nearestDist < CONF.snapThreshold));
  }

  _snapToNearest() {
    let nearestIdx = 0, nearestDist = Infinity;
    this.nodePositions.forEach((nPos, i) => {
      const dist = Math.abs(this._sliderPos - nPos);
      if (dist < nearestDist) { nearestDist = dist; nearestIdx = i; }
    });
    this.els.nodes.forEach(n => n.classList.remove('snap-hint'));
    this._setActive(nearestIdx, true);
  }

  _updateTrackGlow(color, animated = true) {
    const glow = this.els.trackGlow;
    glow.style.transition = animated ? `background ${CONF.transitionMs}ms ease` : 'none';
    glow.style.background = `linear-gradient(to bottom, ${color}00 0%, ${color}44 20%, ${color}88 50%, ${color}44 80%, ${color}00 100%)`;
  }

  _playEntrance() {
    const wrapper = this.els.wrapper;
    wrapper.classList.add('tl-entering');
    this.els.nodes.forEach((node, i) => { node.style.animationDelay = `${300 + i * CONF.animStagger}ms`; });
    this.els.slider.style.animationDelay = `${300 + this.periods.length * CONF.animStagger}ms`;
    const totalDuration = 300 + this.periods.length * CONF.animStagger + 500;
    setTimeout(() => {
      wrapper.classList.remove('tl-entering');
      wrapper.classList.add('tl-entered');
      wrapper.focus({ preventScroll: true });
    }, totalDuration);
  }

  getActivePeriod() { return this.periods[this.activeIndex]; }
  setActivePeriod(periodKey) {
    const idx = this.periods.findIndex(p => p.key === periodKey);
    if (idx >= 0 && idx !== this.activeIndex) this._setActive(idx, true);
  }
  updateNodeCount(periodKey, count) {
    const el = this.container.querySelector(`.tl-node-count[data-period="${periodKey}"]`);
    if (el) el.textContent = count > 0 ? String(count) : '';
  }
  dispose() { this._cleanups.forEach(fn => fn()); this._cleanups = []; this.container.innerHTML = ''; }
}
