/**
 * Screen 4: Live NOAA Satellite Cloud Radar & NC Dark-Sky Road-Trip Advisor
 * Preserves exact GOES-East SECTOR/ne projection locked dead-center on Burlington, NC (21.5%, 77.2%).
 */

import { NEARBY_NC_SITES, buildSatelliteImageryUrls } from '../services/weatherService.js';

const SITE_MAP_OFFSETS = {
  burlington: { dx: 0, dy: 0, color: '#00E5FF' },
  'cane-creek': { dx: 7, dy: 19, color: '#00E676' },
  'haw-river': { dx: -28, dy: -18, color: '#38BDF8' },
  'jordan-lake': { dx: 38, dy: 42, color: '#FF7A2F' },
  'staunton-river': { dx: 68, dy: -70, color: '#A78BFA' },
};

export function renderSatelliteMapScreen(container, state = {}, actions = {}) {
  if (!container) return;

  const forecast = state.forecast || {};
  const plan = forecast.tonight_plan || {};
  const ephemeris = state.ephemeris || {};
  const sat = forecast.satellite || buildSatelliteImageryUrls();
  const isRedMode = Boolean(state?.nightVisionMode || document.body.classList.contains('night-vision-mode'));

  let activeLayer = state.activeMapLayer || 'ir'; // 'ir' | 'geocolor' | 'bortle'
  if (!['ir', 'geocolor', 'bortle'].includes(activeLayer)) activeLayer = 'ir';

  let selectedSiteId = 'burlington';
  let zoomLevel = 1.0;
  let panX = 0;
  let panY = 0;

  const liveNearby =
    Array.isArray(forecast.nearby_sites) && forecast.nearby_sites.length > 0
      ? forecast.nearby_sites
      : NEARBY_NC_SITES.map((s) => ({
          ...s,
          cloud_pct: 12,
          seeing_rating: 4,
          temp_f: 54,
          wind_mph: 5,
          observing_score: 84,
          rating: 'CLEAR & DARK',
        }));

  const homeSite = {
    id: 'burlington',
    name: 'Burlington Backyard (Home)',
    short_name: 'Burlington Home',
    lat: 36.096,
    lon: -79.438,
    distance_label: '0 mi · Home Base',
    drive_time: '0 min',
    bortle_class: 4,
    base_nelm: 6.0,
    cloud_pct: plan.evening_cloud_pct ?? forecast.current_summary?.cloud_coverage_percent ?? 12,
    seeing_rating: plan.evening_seeing ?? forecast.current_summary?.seeing ?? 4,
    temp_f: plan.evening_temp_f ?? forecast.current_summary?.temperature_f ?? 54,
    observing_score: plan.tonight_score ?? forecast.current_summary?.observing_score ?? 85,
    family_perk: 'Zero drive time, warm house & bathroom steps away — tough to beat with kids!',
  };

  const allSites = [homeSite, ...liveNearby];

  // Smart "Worth the Drive Tonight?" advisor
  const moonIllum = ephemeris.moon?.illumination_percent ?? 20;
  const moonUp = ephemeris.moon?.is_above_horizon ?? false;
  const jordan = liveNearby.find((s) => s.id === 'jordan-lake') || liveNearby[0];
  const caneCreek = liveNearby.find((s) => s.id === 'cane-creek') || liveNearby[0];

  let roadTripVerdict = '';
  if (homeSite.cloud_pct >= 65 && jordan && jordan.cloud_pct <= 30) {
    roadTripVerdict = `Burlington has ${homeSite.cloud_pct}% clouds, but ${jordan.short_name} (${jordan.drive_time}) is much clearer (${jordan.cloud_pct}% clouds)! Worth loading up the 8SE.`;
  } else if (moonIllum >= 55 && moonUp) {
    roadTripVerdict = `Moonlight (${moonIllum}% lit) brightens rural parks tonight too — stay right in your Burlington backyard for awesome Moon craters, Saturn & Jupiter!`;
  } else if (homeSite.cloud_pct <= 25 && jordan && jordan.cloud_pct <= 25) {
    roadTripVerdict = `Clear & dark across Piedmont NC! Backyard Bortle 4 is great tonight — or hop ${caneCreek?.drive_time || '20 min'} to Cane Creek / ${jordan.drive_time} to Jordan Lake (Bortle 3) for deeper galaxies.`;
  } else {
    roadTripVerdict = `Backyard score is ${homeSite.observing_score}/100 (${homeSite.cloud_pct}% clouds). Tap any NC Dark-Sky park below to compare live clouds & darkness.`;
  }

  container.innerHTML = `
    <div class="safe-top pb-28 px-4 space-y-4">
      <!-- Clean Header -->
      <header class="flex items-center justify-between pt-1">
        <div>
          <div class="flex items-center gap-1.5">
            <span class="material-symbols-outlined text-accent text-[20px]">satellite_alt</span>
            <h1 class="text-lg font-extrabold tracking-tight text-dark-on-surface">Live Sky Map &amp; Escapes</h1>
          </div>
          <p class="font-label text-[11px] text-dark-on-surface-variant">
            NOAA GOES-East Live Sector · Piedmont NC Dark-Sky Sites
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            id="btn-map-red"
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

          <button
            id="btn-map-refresh"
            type="button"
            title="Refresh NOAA Satellite Frame"
            class="w-9 h-9 rounded-full bg-dark-surface-container-high/80 border border-dark-outline flex items-center justify-center text-dark-on-surface-variant hover:text-accent tap-scale"
          >
            <span id="map-sync-icon" class="material-symbols-outlined text-[19px]">sync</span>
          </button>
        </div>
      </header>

      <!-- Layer Mode Pills -->
      <div class="grid grid-cols-3 gap-1.5">
        <button type="button" data-layer="ir" class="layer-btn py-2 px-2 rounded-2xl border text-xs font-bold tap-scale">
          Night IR Clouds
        </button>
        <button type="button" data-layer="geocolor" class="layer-btn py-2 px-2 rounded-2xl border text-xs font-bold tap-scale">
          GeoColor Live
        </button>
        <button type="button" data-layer="bortle" class="layer-btn py-2 px-2 rounded-2xl border text-xs font-bold tap-scale">
          Light Domes
        </button>
      </div>

      <!-- LOCKED GOES-EAST SATELLITE VIEWPORT -->
      <section class="glass-card rounded-3xl border border-dark-outline/90 overflow-hidden">
        <div
          id="map-viewport"
          class="relative w-full h-72 bg-[#060C17] overflow-hidden cursor-grab active:cursor-grabbing touch-none"
        >
          <div
            id="map-transform-stage"
            class="w-full h-full relative transition-transform duration-75 ease-out"
            style="transform-origin: center center;"
          >
            <!-- Locked GOES-East NE Sector Projection: Burlington, NC at exact center (50%, 50%) -->
            <img
              id="goes-sat-img"
              src="${sat.ir_band13}"
              alt="NOAA GOES-East North Carolina Cloud Cover"
              class="opacity-85 select-none pointer-events-none"
              style="position: absolute; width: 240%; max-width: none; aspect-ratio: 1 / 1; left: 50%; top: 50%; transform: translate(-21.5%, -77.2%);"
            />

            <!-- Optional Light-Pollution Dome Canvas Overlay -->
            <canvas
              id="bortle-overlay-canvas"
              width="420"
              height="320"
              class="absolute inset-0 w-full h-full pointer-events-none"
            ></canvas>

            <!-- Interactive Site Pins -->
            <div class="absolute inset-0">
              ${allSites
                .map((s) => {
                  const off = SITE_MAP_OFFSETS[s.id] || { dx: 0, dy: 0, color: '#00E5FF' };
                  return `
                  <button
                    type="button"
                    data-map-pin="${s.id}"
                    style="left: calc(50% + ${off.dx}px); top: calc(50% + ${off.dy}px); transform: translate(-50%, -50%);"
                    class="map-pin-btn absolute flex flex-col items-center group z-10"
                  >
                    <span
                      class="w-3.5 h-3.5 rounded-full border-2 border-white shadow-lg transition-transform"
                      style="background:${off.color}"
                    ></span>
                    <span class="mt-0.5 px-1.5 py-0.5 rounded bg-dark-surface/90 border border-dark-outline text-[9px] font-label font-bold text-dark-on-surface whitespace-nowrap">
                      ${s.id === 'burlington' ? 'Burlington' : s.short_name}
                    </span>
                  </button>
                `;
                })
                .join('')}
            </div>
          </div>

          <!-- Top-Left Layer Status Pill -->
          <div class="absolute top-3 left-3 bg-dark-surface/85 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-dark-outline font-label text-[10px] pointer-events-none">
            <div id="map-badge-title" class="text-accent font-bold">NOAA GOES-East Infrared (Band 13)</div>
            <div id="map-badge-sub" class="text-dark-on-surface-variant">White/Bright = Clouds · Dark = Clear Sky</div>
          </div>

          <!-- Zoom & Re-Center Controls -->
          <div class="absolute bottom-3 right-3 flex flex-col gap-1.5 z-20">
            <button id="map-zoom-in" type="button" class="w-8 h-8 rounded-full bg-dark-surface/90 border border-dark-outline text-dark-on-surface flex items-center justify-center tap-scale">
              <span class="material-symbols-outlined text-[16px]">add</span>
            </button>
            <button id="map-zoom-out" type="button" class="w-8 h-8 rounded-full bg-dark-surface/90 border border-dark-outline text-dark-on-surface flex items-center justify-center tap-scale">
              <span class="material-symbols-outlined text-[16px]">remove</span>
            </button>
            <button id="map-center" type="button" title="Center on Burlington" class="w-8 h-8 rounded-full bg-dark-surface/90 border border-dark-outline text-accent flex items-center justify-center tap-scale">
              <span class="material-symbols-outlined text-[16px]">my_location</span>
            </button>
          </div>
        </div>

        <!-- Selected Site Quick Readout Bar -->
        <div id="selected-site-bar" class="p-3.5 bg-dark-surface/75 border-t border-dark-outline/80 flex items-center justify-between gap-3"></div>
      </section>

      <!-- WORTH THE DRIVE TONIGHT? ROAD-TRIP ADVISOR -->
      <section class="cosmic-hero-card rounded-3xl p-4 border border-dark-outline/90 space-y-3">
        <div class="flex items-center gap-1.5 text-xs font-label uppercase tracking-wider text-celestron font-bold">
          <span class="material-symbols-outlined text-[17px]">directions_car</span>
          <span>Worth the Drive Tonight?</span>
        </div>
        <p class="text-xs leading-relaxed text-dark-on-surface/95">${roadTripVerdict}</p>

        <!-- Site Comparison Cards -->
        <div class="space-y-2 pt-1">
          ${allSites
            .map((s) => {
              const isHome = s.id === 'burlington';
              return `
              <div
                data-site-card="${s.id}"
                class="site-compare-card rounded-2xl p-3 border cursor-pointer transition-all space-y-1.5 ${
                  s.id === selectedSiteId
                    ? 'bg-accent/10 border-accent/70'
                    : 'bg-dark-surface/70 border-dark-outline/70 hover:border-accent/40'
                }"
              >
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs font-extrabold text-dark-on-surface">${s.name}</span>
                      <span class="text-[10px] font-label px-1.5 py-0.5 rounded bg-dark-surface-container-high text-accent font-bold">
                        Bortle ${s.bortle_class}
                      </span>
                    </div>
                    <div class="text-[10.5px] font-label text-dark-on-surface-variant mt-0.5">
                      ${s.distance_label} · Limiting Mag ${s.base_nelm}
                    </div>
                  </div>
                  <div class="text-right font-label shrink-0">
                    <div class="text-xs font-bold ${
                      s.cloud_pct <= 25 ? 'text-emerald-300' : s.cloud_pct <= 55 ? 'text-amber-300' : 'text-slate-400'
                    }">
                      ${s.cloud_pct}% Clouds
                    </div>
                    <div class="text-[10px] text-dark-on-surface-variant">Score ${s.observing_score}/100</div>
                  </div>
                </div>

                <div class="flex items-center justify-between gap-2 pt-0.5">
                  <p class="text-[11px] text-dark-on-surface-variant leading-snug">${s.family_perk || ''}</p>
                  ${
                    !isHome
                      ? `<a
                          href="https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lon}"
                          target="_blank"
                          rel="noopener noreferrer"
                          data-stop-prop="true"
                          class="shrink-0 px-2.5 py-1 rounded-xl bg-dark-surface-container-high border border-dark-outline text-[10.5px] font-label font-bold text-accent hover:border-accent"
                        >
                          Map ↗
                        </a>`
                      : ''
                  }
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      </section>
    </div>
  `;

  const imgEl = container.querySelector('#goes-sat-img');
  const stageEl = container.querySelector('#map-transform-stage');
  const bortleCanvas = container.querySelector('#bortle-overlay-canvas');
  const badgeTitle = container.querySelector('#map-badge-title');
  const badgeSub = container.querySelector('#map-badge-sub');
  const selectedBar = container.querySelector('#selected-site-bar');

  // GOES-19 -> GOES-16 automatic fallback
  if (imgEl) {
    imgEl.onerror = () => {
      if (activeLayer === 'geocolor' && imgEl.src !== sat.geocolor_fallback) {
        imgEl.src = sat.geocolor_fallback;
      } else if (activeLayer !== 'geocolor' && imgEl.src !== sat.ir_band13_fallback) {
        imgEl.src = sat.ir_band13_fallback;
      }
    };
  }

  function applyStageTransform() {
    if (stageEl) {
      stageEl.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
    }
  }

  function drawBortleOverlay() {
    if (!bortleCanvas) return;
    const ctx = bortleCanvas.getContext('2d');
    const w = bortleCanvas.width;
    const h = bortleCanvas.height;
    ctx.clearRect(0, 0, w, h);

    if (activeLayer !== 'bortle') return;

    const cx = w / 2;
    const cy = h / 2;

    // Urban skyglow domes around Greensboro (W), Winston-Salem (WNW), Durham/Raleigh (ESE) vs dark zones
    const domes = [
      { x: cx - 38, y: cy + 4, r: 44, color: 'rgba(251, 146, 60, 0.42)', label: 'Greensboro Glow' },
      { x: cx + 62, y: cy + 28, r: 58, color: 'rgba(248, 113, 113, 0.45)', label: 'Durham / Raleigh' },
      { x: cx, y: cy, r: 22, color: 'rgba(250, 204, 21, 0.24)', label: '' },
      { x: cx + 68, y: cy - 70, r: 42, color: 'rgba(16, 185, 129, 0.24)', label: '' },
    ];

    domes.forEach((d) => {
      const g = ctx.createRadialGradient(d.x, d.y, 2, d.x, d.y, d.r);
      g.addColorStop(0, d.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function updateLayerUI() {
    container.querySelectorAll('.layer-btn').forEach((btn) => {
      const isAct = btn.getAttribute('data-layer') === activeLayer;
      btn.className = `layer-btn py-2 px-2 rounded-2xl border text-xs font-bold tap-scale ${
        isAct
          ? 'bg-accent text-dark-surface border-accent'
          : 'bg-dark-surface-container border-dark-outline text-dark-on-surface-variant'
      }`;
    });

    if (imgEl) {
      imgEl.src = activeLayer === 'geocolor' ? sat.geocolor : sat.ir_band13;
      imgEl.style.opacity = activeLayer === 'bortle' ? '0.45' : '0.85';
    }

    if (badgeTitle && badgeSub) {
      if (activeLayer === 'ir') {
        badgeTitle.textContent = 'NOAA GOES-East Night Infrared (10.3 μm)';
        badgeSub.textContent = 'Detects clouds 24/7 — Dark = Clear Sky';
      } else if (activeLayer === 'geocolor') {
        badgeTitle.textContent = 'NOAA GOES-East GeoColor Live';
        badgeSub.textContent = 'True-color daytime / City lights + fog at night';
      } else {
        badgeTitle.textContent = 'Piedmont NC Light-Pollution Domes';
        badgeSub.textContent = 'Warm = City Skyglow · Green/Blue = Dark Escapes';
      }
    }

    drawBortleOverlay();
  }

  function updateSelectedSiteUI() {
    const site = allSites.find((s) => s.id === selectedSiteId) || homeSite;
    if (selectedBar) {
      selectedBar.innerHTML = `
        <div>
          <div class="text-xs font-extrabold text-dark-on-surface">${site.name}</div>
          <div class="text-[11px] font-label text-dark-on-surface-variant">
            Bortle ${site.bortle_class} (Mag ${site.base_nelm}) · ${site.temp_f}°F · Seeing ${site.seeing_rating}/5
          </div>
        </div>
        <div class="text-right font-label shrink-0">
          <div class="text-xs font-bold text-accent">${site.cloud_pct}% Clouds</div>
          <div class="text-[10px] text-dark-on-surface-variant">Score ${site.observing_score}/100</div>
        </div>
      `;
    }

    container.querySelectorAll('.site-compare-card').forEach((el) => {
      const match = el.getAttribute('data-site-card') === selectedSiteId;
      el.className = `site-compare-card rounded-2xl p-3 border cursor-pointer transition-all space-y-1.5 ${
        match
          ? 'bg-accent/10 border-accent/70'
          : 'bg-dark-surface/70 border-dark-outline/70 hover:border-accent/40'
      }`;
    });
  }

  // Pan & Drag gesture support on viewport
  const viewport = container.querySelector('#map-viewport');
  let dragging = false;
  let startX = 0;
  let startY = 0;

  viewport?.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    dragging = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    viewport.setPointerCapture?.(e.pointerId);
  });

  viewport?.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    panX = Math.max(-140, Math.min(140, e.clientX - startX));
    panY = Math.max(-120, Math.min(120, e.clientY - startY));
    applyStageTransform();
  });

  viewport?.addEventListener('pointerup', () => {
    dragging = false;
  });

  // Wire buttons
  container.querySelectorAll('.layer-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeLayer = btn.getAttribute('data-layer') || 'ir';
      state.activeMapLayer = activeLayer;
      updateLayerUI();
    });
  });

  container.querySelector('#map-zoom-in')?.addEventListener('click', () => {
    zoomLevel = Math.min(2.6, Number((zoomLevel + 0.35).toFixed(2)));
    applyStageTransform();
  });

  container.querySelector('#map-zoom-out')?.addEventListener('click', () => {
    zoomLevel = Math.max(0.85, Number((zoomLevel - 0.35).toFixed(2)));
    applyStageTransform();
  });

  container.querySelector('#map-center')?.addEventListener('click', () => {
    selectedSiteId = 'burlington';
    zoomLevel = 1.0;
    panX = 0;
    panY = 0;
    applyStageTransform();
    updateSelectedSiteUI();
  });

  function focusSite(siteId) {
    selectedSiteId = siteId;
    const off = SITE_MAP_OFFSETS[siteId] || { dx: 0, dy: 0 };
    panX = -off.dx * zoomLevel;
    panY = -off.dy * zoomLevel;
    applyStageTransform();
    updateSelectedSiteUI();
  }

  container.querySelectorAll('[data-map-pin]').forEach((btn) => {
    btn.addEventListener('click', () => focusSite(btn.getAttribute('data-map-pin')));
  });

  container.querySelectorAll('[data-site-card]').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-stop-prop]')) return;
      focusSite(card.getAttribute('data-site-card'));
    });
  });

  container.querySelector('#btn-map-red')?.addEventListener('click', () => {
    actions.toggleNightVision();
    renderSatelliteMapScreen(container, state, actions);
  });

  container.querySelector('#btn-map-refresh')?.addEventListener('click', async () => {
    const icon = container.querySelector('#map-sync-icon');
    icon?.classList.add('animate-spin', 'text-accent');
    try {
      await actions.refreshForecast();
    } finally {
      icon?.classList.remove('animate-spin');
    }
  });

  updateLayerUI();
  updateSelectedSiteUI();
}

export default renderSatelliteMapScreen;
