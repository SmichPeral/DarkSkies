/**
 * Screen 2: Explore Burlington's Sky ("What's Up Tonight")
 * Interactive Overhead Burlington Sky Dome + Time Scrubber + 14 Ranked Family & 8SE Showpieces
 */

import {
  getFovSimulatorTargets,
  getSkyDomeSnapshot,
  getDefaultStargazingReferenceDate,
  formatEasternTime12h,
} from '../services/astronomyEngine.js';

import { getSpottedTargetIds } from '../services/storageService.js';

const CATEGORIES = [
  { id: 'best', label: 'Best Tonight', icon: 'auto_awesome' },
  { id: 'kids', label: 'Kid Favorites', icon: 'child_care' },
  { id: 'Planets & Moon', label: 'Planets & Moon', icon: 'public' },
  { id: 'Nebulae & Galaxies', label: 'Nebulae & Galaxies', icon: 'blur_on' },
  { id: 'Clusters & Doubles', label: 'Clusters & Stars', icon: 'grain' },
];

function getToneClasses(tone) {
  switch (tone) {
    case 'prime':
      return 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300';
    case 'good':
      return 'bg-accent/15 border-accent/40 text-accent';
    case 'low':
      return 'bg-amber-500/15 border-amber-400/40 text-amber-300';
    default:
      return 'bg-slate-800/80 border-slate-700 text-slate-400';
  }
}

export function renderExploreSkyScreen(container, state, actions) {
  if (!container) return;

  let activeCategory = state.exploreCategory || 'best';
  let minutesOffset = Number(state.exploreMinutesOffset || 0);
  let highlightedId = state.selectedTargetId || 'saturn';

  const baseRefDate = getDefaultStargazingReferenceDate(new Date());
  const isRedMode = Boolean(state?.nightVisionMode || document.body.classList.contains('night-vision-mode'));

  function getActiveDate() {
    return new Date(baseRefDate.getTime() + minutesOffset * 60000);
  }

  container.innerHTML = `
    <div class="safe-top pb-28 px-4 space-y-4">
      <!-- Header -->
      <header class="flex items-center justify-between pt-1">
        <div>
          <div class="flex items-center gap-1.5">
            <span class="material-symbols-outlined text-accent text-[20px]">explore</span>
            <h1 class="text-lg font-extrabold tracking-tight text-dark-on-surface">Explore Tonight's Sky</h1>
          </div>
          <p class="font-label text-[11px] text-dark-on-surface-variant">
            Burlington Overhead Dome · 14 NexStar 8SE Family Wonders
          </p>
        </div>

        <button
          id="btn-explore-red"
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-semibold tap-scale ${
            isRedMode
              ? 'bg-red-950/80 border-red-500/70 text-red-300'
              : 'bg-dark-surface-container-high/80 border-dark-outline text-dark-on-surface-variant'
          }"
        >
          <span class="w-2 h-2 rounded-full ${isRedMode ? 'bg-red-400 animate-pulse' : 'bg-red-500/80'}"></span>
          <span class="font-label text-[11px]">Red Eye</span>
        </button>
      </header>

      <!-- Interactive Overhead Sky Dome Card -->
      <section class="cosmic-hero-card rounded-3xl p-3.5 border border-dark-outline/90 space-y-3">
        <div class="flex items-center justify-between px-0.5">
          <div>
            <div class="text-[10.5px] font-label uppercase tracking-wider text-accent font-bold">
              Looking Straight Up · Burlington, NC
            </div>
            <div id="dome-time-readout" class="font-label text-sm font-bold text-dark-on-surface"></div>
          </div>
          <div class="flex items-center gap-2 text-[10px] font-label">
            <span class="inline-flex items-center gap-1 text-celestron">
              <span class="w-2 h-2 rounded-full bg-celestron"></span>Planets
            </span>
            <span class="inline-flex items-center gap-1 text-accent">
              <span class="w-2 h-2 rounded-full bg-accent"></span>Deep Sky
            </span>
          </div>
        </div>

        <!-- High-DPI Sky Dome Canvas -->
        <div class="relative mx-auto w-full max-w-[310px] aspect-square flex items-center justify-center">
          <canvas
            id="burlington-sky-dome"
            class="w-full h-full rounded-full cursor-pointer touch-manipulation"
          ></canvas>
        </div>

        <!-- Selected Dome Marker Quick Banner -->
        <div id="dome-selected-banner" class="bg-dark-surface/75 rounded-2xl px-3 py-2 border border-dark-outline/70 flex items-center justify-between gap-2"></div>

        <!-- Sky Time Scrubber -->
        <div class="space-y-1.5 pt-0.5">
          <div class="flex items-center justify-between text-[10.5px] font-label text-dark-on-surface-variant">
            <span>Scrub Evening Sky Rotation</span>
            <button id="btn-reset-sky-time" type="button" class="text-accent font-semibold hover:underline">
              Reset to Prime Start
            </button>
          </div>
          <input
            id="sky-time-slider"
            type="range"
            min="-60"
            max="360"
            step="15"
            value="${minutesOffset}"
            class="w-full h-1.5 rounded-lg bg-dark-surface-container-high cursor-pointer"
          />
          <div class="flex justify-between text-[9.5px] font-label text-dark-on-surface-variant/80">
            <span>-1 hr</span>
            <span>Start</span>
            <span>+2 hrs</span>
            <span>+4 hrs</span>
            <span>+6 hrs</span>
          </div>
        </div>
      </section>

      <!-- Category Filter Pills -->
      <div id="explore-category-bar" class="flex gap-2 overflow-x-auto no-scrollbar py-0.5">
        ${CATEGORIES.map(
          (cat) => `
          <button
            type="button"
            data-cat="${cat.id}"
            class="cat-pill shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold tap-scale ${
              cat.id === activeCategory
                ? 'bg-accent text-dark-surface border-accent'
                : 'bg-dark-surface-container border-dark-outline text-dark-on-surface-variant'
            }"
          >
            <span class="material-symbols-outlined text-[15px]">${cat.icon}</span>
            <span>${cat.label}</span>
          </button>
        `
        ).join('')}
      </div>

      <!-- Ranked Target Cards Container -->
      <div id="explore-targets-list" class="space-y-3"></div>
    </div>
  `;

  const canvas = container.querySelector('#burlington-sky-dome');
  const timeReadout = container.querySelector('#dome-time-readout');
  const selectedBanner = container.querySelector('#dome-selected-banner');
  const targetsListEl = container.querySelector('#explore-targets-list');
  const sliderEl = container.querySelector('#sky-time-slider');

  let renderedMarkerHitboxes = [];

  function drawSkyDome(snapshot) {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const cssSize = canvas.clientWidth || 300;
    canvas.width = Math.round(cssSize * dpr);
    canvas.height = Math.round(cssSize * dpr);

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const cx = cssSize / 2;
    const cy = cssSize / 2;
    const radius = cssSize / 2 - 14;

    ctx.clearRect(0, 0, cssSize, cssSize);

    // Sky dome radial background
    const skyGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, radius);
    if (snapshot.sun.altitude_deg > -2) {
      skyGrad.addColorStop(0, '#16325c');
      skyGrad.addColorStop(0.75, '#1e3f6e');
      skyGrad.addColorStop(1, '#2d578a');
    } else {
      skyGrad.addColorStop(0, '#050914');
      skyGrad.addColorStop(0.68, '#091226');
      skyGrad.addColorStop(1, '#10203d');
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = skyGrad;
    ctx.fill();
    ctx.clip();

    // Subtle background star dust
    ctx.fillStyle = 'rgba(226, 232, 240, 0.25)';
    for (let i = 0; i < 55; i++) {
      const ang = (i * 137.5 * Math.PI) / 180;
      const rr = Math.sqrt((i + 1) / 56) * radius * 0.96;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, (i % 2) * 0.4 + 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Backyard treeline band (outer 0°–15° altitude)
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.arc(cx, cy, radius * ((90 - 15) / 90), 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(6, 15, 16, 0.45)';
    ctx.fill();

    // Altitude rings (30° and 60°) + Meridian/Prime vertical crosshairs
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    [30, 60].forEach((alt) => {
      ctx.beginPath();
      ctx.arc(cx, cy, radius * ((90 - alt) / 90), 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(cx - radius, cy);
    ctx.lineTo(cx + radius, cy);
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy + radius);
    ctx.stroke();
    ctx.setLineDash([]);

    // Constellation stick figures
    for (const c of snapshot.constellations) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
      ctx.lineWidth = 1.1;
      for (const [i1, i2] of c.lines) {
        const s1 = c.stars[i1];
        const s2 = c.stars[i2];
        if (!s1 || !s2) continue;
        ctx.beginPath();
        ctx.moveTo(cx + s1.nx * radius, cy + s1.ny * radius);
        ctx.lineTo(cx + s2.nx * radius, cy + s2.ny * radius);
        ctx.stroke();
      }

      for (const s of c.stars) {
        if (s.alt < 0) continue;
        ctx.beginPath();
        ctx.arc(cx + s.nx * radius, cy + s.ny * radius, 1.7, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(241, 245, 249, 0.85)';
        ctx.fill();
      }

      const lx = cx + c.labelPos.nx * radius;
      const ly = cy + c.labelPos.ny * radius - 6;
      ctx.font = '600 8.5px "Mulish", sans-serif';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.68)';
      ctx.textAlign = 'center';
      ctx.fillText(c.name, lx, ly);
    }

    // Polaris North Star marker
    if (snapshot.polaris) {
      const px = cx + snapshot.polaris.nx * radius;
      const py = cy + snapshot.polaris.ny * radius;
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fde68a';
      ctx.fill();
      ctx.font = '600 8px "Spline Sans Mono", monospace';
      ctx.fillStyle = 'rgba(253, 230, 138, 0.8)';
      ctx.textAlign = 'left';
      ctx.fillText('Polaris', px + 5, py + 2.5);
    }

    // Interactive Showpiece Markers
    renderedMarkerHitboxes = [];
    for (const m of snapshot.markers) {
      const mx = cx + m.nx * radius;
      const my = cy + m.ny * radius;
      const isSelected = m.id === highlightedId;
      const isPlanet = m.group === 'planets';
      const color = m.id === 'moon' ? '#FFD54F' : isPlanet ? '#FF7A2F' : '#00E5FF';

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(mx, my, 11, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.6;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(mx, my, 15, 0, Math.PI * 2);
        ctx.fillStyle = isPlanet ? 'rgba(255, 122, 47, 0.18)' : 'rgba(0, 229, 255, 0.18)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(mx, my, isPlanet ? 4.4 : 3.6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#060910';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (isSelected || m.alt_deg >= 22 || isPlanet) {
        ctx.font = `${isSelected ? '700 9.5px' : '600 8.5px'} "Spline Sans Mono", monospace`;
        ctx.fillStyle = isSelected ? '#FFFFFF' : color;
        ctx.textAlign = mx > cx + 40 ? 'right' : 'left';
        const offsetX = mx > cx + 40 ? -7 : 7;
        ctx.fillText(m.name, mx + offsetX, my + 3);
      }

      renderedMarkerHitboxes.push({ id: m.id, x: mx, y: my, r: 18 });
    }

    ctx.restore();

    // Horizon Ring & Cardinal Compass Points (N, E, S, W — overhead view!)
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#233146';
    ctx.lineWidth = 2;
    ctx.stroke();

    const cardinals = [
      { label: 'N', x: cx, y: 10 },
      { label: 'S', x: cx, y: cssSize - 3 },
      { label: 'E', x: 8, y: cy + 3.5 },
      { label: 'W', x: cssSize - 8, y: cy + 3.5 },
    ];
    ctx.font = 'bold 10.5px "Spline Sans Mono", monospace';
    ctx.textAlign = 'center';
    for (const c of cardinals) {
      ctx.fillStyle = c.label === 'N' ? '#FF7A2F' : '#94A3B8';
      ctx.fillText(c.label, c.x, c.y);
    }
  }

  function renderAll() {
    const activeDate = getActiveDate();
    const seeingRating = state?.currentHour?.seeing || 4;
    const catalog = getFovSimulatorTargets(activeDate, { seeingRating });
    const snapshot = getSkyDomeSnapshot(activeDate);
    const spottedIds = getSpottedTargetIds();

    if (!catalog.targets[highlightedId] && catalog.target_list[0]) {
      highlightedId = catalog.target_list[0].id;
    }

    const dayName = activeDate.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
    });
    if (timeReadout) {
      timeReadout.textContent = `${dayName} · ${formatEasternTime12h(activeDate)} Eastern`;
    }

    drawSkyDome(snapshot);

    // Selected Dome Banner
    const selTarget = catalog.targets[highlightedId] || catalog.target_list[0];
    if (selectedBanner && selTarget) {
      selectedBanner.innerHTML = `
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-bold text-dark-on-surface truncate">${selTarget.name}</span>
            <span class="text-[10px] font-label px-1.5 py-0.5 rounded ${getToneClasses(selTarget.status_tone)}">
              ${selTarget.alt_deg >= 6 ? `${selTarget.alt_deg}° ${selTarget.cardinal}` : 'Below Trees'}
            </span>
          </div>
          <div class="text-[11px] text-dark-on-surface-variant truncate mt-0.5">
            8SE Best: <span class="text-celestron font-semibold">${selTarget.recommended_setup}</span>
          </div>
        </div>
        <button
          type="button"
          id="btn-banner-fov"
          class="shrink-0 bg-accent/15 border border-accent/40 text-accent font-label text-[11px] font-bold px-2.5 py-1.5 rounded-xl tap-scale"
        >
          8SE View →
        </button>
      `;
      selectedBanner.querySelector('#btn-banner-fov')?.addEventListener('click', () => {
        actions.navigate('fov', {
          selectedTargetId: selTarget.id,
          selectedEyepiece: selTarget.best_eyepiece_mm,
          hasReducer: selTarget.recommended_reducer,
          hasBarlow: false,
          fromScreen: 'explore',
        });
      });
    }

    // Filter target cards
    let filtered = catalog.target_list;
    if (activeCategory === 'kids') {
      filtered = filtered.filter((t) => t.kid_favorite);
    } else if (activeCategory !== 'best') {
      filtered = filtered.filter((t) => t.category === activeCategory);
    }

    if (targetsListEl) {
      targetsListEl.innerHTML = filtered
        .map((t) => {
          const isSpotted = spottedIds.has(t.id);
          const isHighlighted = t.id === highlightedId;
          return `
            <article
              id="target-card-${t.id}"
              data-card-id="${t.id}"
              class="glass-card rounded-3xl p-4 border transition-all space-y-3 ${
                isHighlighted ? 'border-accent/80 ring-1 ring-accent/40' : 'border-dark-outline/80'
              }"
            >
              <!-- Card Header -->
              <div class="flex items-start justify-between gap-2">
                <div>
                  <div class="flex items-center flex-wrap gap-1.5">
                    <h3 class="text-base font-extrabold text-dark-on-surface">${t.name}</h3>
                    ${
                      isSpotted
                        ? `<span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-label font-bold">
                            <span class="material-symbols-outlined text-[12px]">verified</span>Spotted
                          </span>`
                        : ''
                    }
                  </div>
                  <p class="text-xs text-dark-on-surface-variant mt-0.5">${t.subtitle}</p>
                </div>

                <div class="text-right shrink-0">
                  <div class="text-xs text-chart-moon tracking-tight" title="Family Wow Factor">
                    ${'★'.repeat(t.family_wow)}${'☆'.repeat(5 - t.family_wow)}
                  </div>
                  <div class="font-label text-[10px] text-dark-on-surface-variant">
                    Score <span class="text-dark-on-surface font-bold">${t.tonight_score}</span>
                  </div>
                </div>
              </div>

              <!-- Honest Sky Position Badges -->
              <div class="flex flex-wrap items-center gap-1.5 text-[11px] font-label">
                <span class="px-2.5 py-1 rounded-xl border font-semibold ${getToneClasses(t.status_tone)}">
                  ${t.status_badge}
                </span>
                <span class="px-2.5 py-1 rounded-xl bg-dark-surface/70 border border-dark-outline/60 text-dark-on-surface-variant">
                  Peaks ${t.peak_time_12h} (${t.peak_alt_deg}°)
                </span>
              </div>

              <!-- Family Space Story Callout -->
              <div class="bg-dark-surface/75 rounded-2xl p-3 border border-dark-outline/60 space-y-1.5">
                <div class="flex items-center gap-1 text-[10.5px] font-label uppercase tracking-wider text-accent font-bold">
                  <span class="material-symbols-outlined text-[14px]">auto_stories</span>
                  <span>Tell the Family</span>
                </div>
                <p class="text-xs leading-relaxed text-dark-on-surface/95">${t.kid_hook}</p>
              </div>

              <!-- 8SE Eyepiece Tip -->
              <div class="flex items-start gap-2 text-xs text-dark-on-surface-variant">
                <span class="material-symbols-outlined text-celestron text-[17px] mt-0.5">center_focus_strong</span>
                <div>
                  <span class="font-bold text-celestron">${t.recommended_setup}:</span>
                  <span> ${t.how_to_spot}</span>
                </div>
              </div>

              <!-- Actions -->
              <div class="grid grid-cols-2 gap-2 pt-0.5">
                <button
                  type="button"
                  data-sim-target="${t.id}"
                  data-sim-ep="${t.best_eyepiece_mm}"
                  data-sim-reducer="${t.recommended_reducer}"
                  class="bg-accent/15 hover:bg-accent/25 border border-accent/40 text-accent font-bold text-xs py-2.5 px-3 rounded-2xl flex items-center justify-center gap-1.5 tap-scale"
                >
                  <span class="material-symbols-outlined text-[17px]">visibility</span>
                  <span>8SE Eyepiece View</span>
                </button>
                <button
                  type="button"
                  data-log-target="${t.id}"
                  data-log-ep="${t.best_eyepiece_mm}"
                  class="bg-dark-surface-container-high hover:border-celestron/50 border border-dark-outline text-dark-on-surface font-semibold text-xs py-2.5 px-3 rounded-2xl flex items-center justify-center gap-1.5 tap-scale"
                >
                  <span class="material-symbols-outlined text-celestron text-[17px]">bookmark_add</span>
                  <span>${isSpotted ? 'Log Again' : 'Stamp Passport'}</span>
                </button>
              </div>
            </article>
          `;
        })
        .join('');

      // Wire buttons inside target cards
      targetsListEl.querySelectorAll('[data-sim-target]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const tid = btn.getAttribute('data-sim-target');
          const ep = Number(btn.getAttribute('data-sim-ep') || 25);
          const useReducer = btn.getAttribute('data-sim-reducer') === 'true';
          actions.navigate('fov', {
            selectedTargetId: tid,
            selectedEyepiece: ep,
            hasReducer: useReducer,
            hasBarlow: false,
            fromScreen: 'explore',
          });
        });
      });

      targetsListEl.querySelectorAll('[data-log-target]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const tid = btn.getAttribute('data-log-target');
          const ep = Number(btn.getAttribute('data-log-ep') || 25);
          actions.navigate('logbook', {
            selectedTargetId: tid,
            selectedEyepiece: ep,
          });
        });
      });

      targetsListEl.querySelectorAll('[data-card-id]').forEach((card) => {
        card.addEventListener('click', () => {
          highlightedId = card.getAttribute('data-card-id');
          actions.selectTarget(highlightedId);
          renderAll();
        });
      });
    }
  }

  // Canvas tap hit-testing
  canvas?.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let closest = null;
    let bestDist = 999;
    for (const hb of renderedMarkerHitboxes) {
      const dist = Math.hypot(x - hb.x, y - hb.y);
      if (dist <= hb.r && dist < bestDist) {
        bestDist = dist;
        closest = hb;
      }
    }

    if (closest) {
      highlightedId = closest.id;
      actions.selectTarget(highlightedId);
      renderAll();
      const cardEl = container.querySelector(`#target-card-${closest.id}`);
      cardEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });

  // Time Slider Scrub
  sliderEl?.addEventListener('input', () => {
    minutesOffset = Number(sliderEl.value || 0);
    state.exploreMinutesOffset = minutesOffset;
    renderAll();
  });

  container.querySelector('#btn-reset-sky-time')?.addEventListener('click', () => {
    minutesOffset = 0;
    state.exploreMinutesOffset = 0;
    if (sliderEl) sliderEl.value = '0';
    renderAll();
  });

  // Category Pills
  container.querySelectorAll('.cat-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategory = btn.getAttribute('data-cat') || 'best';
      state.exploreCategory = activeCategory;
      container.querySelectorAll('.cat-pill').forEach((b) => {
        const active = b.getAttribute('data-cat') === activeCategory;
        b.className = `cat-pill shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold tap-scale ${
          active
            ? 'bg-accent text-dark-surface border-accent'
            : 'bg-dark-surface-container border-dark-outline text-dark-on-surface-variant'
        }`;
      });
      renderAll();
    });
  });

  container.querySelector('#btn-explore-red')?.addEventListener('click', () => {
    actions.toggleNightVision();
    renderExploreSkyScreen(container, state, actions);
  });

  renderAll();
}

export default renderExploreSkyScreen;
