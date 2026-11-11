/**
 * Screen 1: Tonight's Family Stargazing Dashboard (Burlington, NC)
 * Honest daytime-aware Tonight Verdict, Top 3 Family Showpieces,
 * Streamlined 48-Hour Clear Dark Sky Matrix, and 7-Night Family Outlook.
 */

import {
  BURLINGTON_NC,
  getSolarLunarData,
  getFovSimulatorTargets,
  getDefaultStargazingReferenceDate,
} from '../services/astronomyEngine.js';

import { computeTonightPlan } from '../services/weatherService.js';

function renderMoonPhaseSvg(illumPct = 18, phaseName = 'Waxing Crescent') {
  const pct = Math.max(0, Math.min(100, Number(illumPct) || 0));
  const isWaning = /waning|last/i.test(phaseName);
  const r = 14;
  const cx = 16;
  const cy = 16;

  if (pct <= 3) {
    return `<svg viewBox="0 0 32 32" class="w-8 h-8 shrink-0">
      <circle cx="16" cy="16" r="14" fill="#0f172a" stroke="#334155" stroke-width="1.5"/>
    </svg>`;
  }
  if (pct >= 97) {
    return `<svg viewBox="0 0 32 32" class="w-8 h-8 shrink-0">
      <circle cx="16" cy="16" r="14" fill="#fde68a" stroke="#f59e0b" stroke-width="1"/>
    </svg>`;
  }

  // Approximate terminator ellipse rx
  const k = pct / 100;
  const rx = Math.abs(1 - 2 * k) * r;
  const sweepOuter = isWaning ? 0 : 1;
  const sweepTerminator = k > 0.5 ? (isWaning ? 0 : 1) : (isWaning ? 1 : 0);

  const d = `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${sweepOuter} ${cx} ${cy + r} A ${rx.toFixed(2)} ${r} 0 0 ${sweepTerminator} ${cx} ${cy - r} Z`;

  return `<svg viewBox="0 0 32 32" class="w-8 h-8 shrink-0">
    <circle cx="16" cy="16" r="14" fill="#0b1324" stroke="#334155" stroke-width="1.2"/>
    <path d="${d}" fill="#fde68a"/>
  </svg>`;
}

function getVerdictTheme(tone) {
  switch (tone) {
    case 'prime':
      return {
        badgeBg: 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300',
        dot: 'bg-emerald-400',
        scoreColor: 'text-emerald-300',
      };
    case 'good':
      return {
        badgeBg: 'bg-accent/15 border-accent/40 text-accent',
        dot: 'bg-accent',
        scoreColor: 'text-accent',
      };
    case 'fair':
      return {
        badgeBg: 'bg-amber-500/15 border-amber-400/40 text-amber-300',
        dot: 'bg-amber-400',
        scoreColor: 'text-amber-300',
      };
    default:
      return {
        badgeBg: 'bg-rose-500/15 border-rose-400/40 text-rose-300',
        dot: 'bg-rose-400',
        scoreColor: 'text-rose-300',
      };
  }
}

export function renderDashboardScreen(container, state, actions) {
  if (!container) return;

  const forecast = state?.forecast || {};
  const timeline = Array.isArray(forecast.timeline_48h) ? forecast.timeline_48h : [];
  const ephemeris = state?.ephemeris || getSolarLunarData(new Date(), BURLINGTON_NC.lat, BURLINGTON_NC.lon);
  const plan = forecast.tonight_plan || computeTonightPlan(timeline, ephemeris);
  const sevenNights = Array.isArray(forecast.seven_night_outlook) ? forecast.seven_night_outlook : [];
  const nearbySites = Array.isArray(forecast.nearby_sites) ? forecast.nearby_sites : [];

  const verdictTheme = getVerdictTheme(plan.verdict_tone);
  const selectedIdx = Math.max(0, Math.min(timeline.length - 1, Number(state?.selectedHourIndex ?? plan.recommended_hour_index ?? 0)));

  // Top 3 Family Showpiece targets for tonight's prime stargazing window
  const primeRefDate = getDefaultStargazingReferenceDate(new Date());
  const tonightCatalog = getFovSimulatorTargets(primeRefDate, { seeingRating: plan.evening_seeing || 4 });
  const topThreeTargets = tonightCatalog.target_list.filter((t) => t.alt_deg >= 12).slice(0, 3);

  const isRedMode = Boolean(state?.nightVisionMode || document.body.classList.contains('night-vision-mode'));

  container.innerHTML = `
    <div class="safe-top pb-28 px-4 space-y-4">
      <!-- Clean App Header -->
      <header class="flex items-center justify-between pt-1">
        <div>
          <div class="flex items-center gap-1.5">
            <span class="material-symbols-outlined text-accent text-[20px]">auto_awesome</span>
            <h1 class="text-lg font-extrabold tracking-tight text-dark-on-surface">Burlington Dark Skies</h1>
          </div>
          <p class="font-label text-[11px] text-dark-on-surface-variant">
            Bortle 4 Backyard · NexStar 8SE · <span class="text-dark-on-surface/80">${forecast.model_run || '06Z'} Sync</span>
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            id="btn-red-vision"
            type="button"
            title="Toggle Eye-Safe Red Night Vision"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-semibold tap-scale ${
              isRedMode
                ? 'bg-red-950/80 border-red-500/70 text-red-300'
                : 'bg-dark-surface-container-high/80 border-dark-outline text-dark-on-surface-variant hover:text-dark-on-surface'
            }"
          >
            <span class="w-2 h-2 rounded-full ${isRedMode ? 'bg-red-400 animate-pulse' : 'bg-red-500/80'}"></span>
            <span class="font-label text-[11px]">Red Eye</span>
          </button>

          <button
            id="btn-sync-forecast"
            type="button"
            title="Refresh Live Sky Forecast"
            class="w-9 h-9 rounded-full bg-dark-surface-container-high/80 border border-dark-outline flex items-center justify-center text-dark-on-surface-variant hover:text-accent tap-scale"
          >
            <span id="sync-icon" class="material-symbols-outlined text-[19px]">sync</span>
          </button>
        </div>
      </header>

      <!-- HERO: Tonight's Family Stargazing Verdict -->
      <section class="cosmic-hero-card rounded-3xl p-4 border border-dark-outline/90 space-y-3.5">
        <div class="flex items-start justify-between gap-3">
          <div class="space-y-1.5">
            <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-label font-bold tracking-wide ${verdictTheme.badgeBg}">
              <span class="w-1.5 h-1.5 rounded-full ${verdictTheme.dot}"></span>
              <span>${plan.verdict}</span>
            </div>
            <div class="text-[11px] font-label text-dark-on-surface-variant">
              ${plan.is_daytime_now ? `Daylight Now · Tonight's Outlook` : `Live Night Sky over Burlington`}
            </div>
          </div>

          <div class="text-right shrink-0 bg-dark-surface/65 border border-dark-outline/80 rounded-2xl px-3 py-1.5">
            <div class="font-label text-[10px] uppercase tracking-wider text-dark-on-surface-variant">Tonight</div>
            <div class="font-label text-2xl font-bold leading-none ${verdictTheme.scoreColor}">
              ${plan.tonight_score}<span class="text-xs font-normal text-dark-on-surface-variant">/100</span>
            </div>
          </div>
        </div>

        <p class="text-[13.5px] leading-relaxed text-dark-on-surface/95">
          ${plan.family_summary}
        </p>

        <!-- 3 Key Family Planning Pills -->
        <div class="grid grid-cols-2 gap-2.5 pt-0.5">
          <div class="bg-dark-surface/60 rounded-2xl p-2.5 border border-dark-outline/60">
            <div class="flex items-center gap-1 text-[10px] font-label uppercase tracking-wider text-accent">
              <span class="material-symbols-outlined text-[14px]">family_star</span>
              <span>Family Window</span>
            </div>
            <div class="font-label text-xs font-bold text-dark-on-surface mt-1">${plan.family_window_label}</div>
            <div class="text-[11px] text-dark-on-surface-variant mt-0.5">Sunset ${plan.sunset_12h} · ${plan.evening_temp_f}°F</div>
          </div>

          <div class="bg-dark-surface/60 rounded-2xl p-2.5 border border-dark-outline/60 flex items-center gap-2.5">
            ${renderMoonPhaseSvg(ephemeris.moon.illumination_percent, ephemeris.moon.phase_name)}
            <div class="min-w-0">
              <div class="text-[10px] font-label uppercase tracking-wider text-chart-moon truncate">${ephemeris.moon.phase_name}</div>
              <div class="font-label text-xs font-bold text-dark-on-surface mt-0.5">${ephemeris.moon.illumination_percent}% Lit</div>
              <div class="text-[11px] text-dark-on-surface-variant truncate">Darkness Mag ${plan.peak_nelm}</div>
            </div>
          </div>
        </div>

        <!-- Best Clear Run + 8SE Cooldown Tip -->
        <div class="bg-celestron/10 border border-celestron/30 rounded-2xl px-3 py-2 flex items-start gap-2.5">
          <span class="material-symbols-outlined text-celestron text-[18px] mt-0.5">tips_and_updates</span>
          <div class="text-xs leading-snug text-dark-on-surface/90">
            <span class="font-bold text-celestron">8SE Tip:</span> ${plan.scope_prep_advice}
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-2.5 pt-0.5">
          <button
            id="btn-hero-explore"
            type="button"
            class="flex-1 bg-accent text-dark-surface font-bold text-sm py-2.5 px-4 rounded-2xl flex items-center justify-center gap-1.5 shadow-lg shadow-accent/15 tap-scale"
          >
            <span class="material-symbols-outlined text-[19px]">explore</span>
            <span>See What's Up Tonight</span>
          </button>
          <button
            id="btn-hero-scope"
            type="button"
            class="bg-dark-surface-container-high border border-dark-outline text-dark-on-surface font-semibold text-xs py-2.5 px-3.5 rounded-2xl flex items-center gap-1.5 tap-scale"
          >
            <span class="material-symbols-outlined text-celestron text-[18px]">center_focus_strong</span>
            <span>8SE Prep</span>
          </button>
        </div>
      </section>

      <!-- TOP 3 FAMILY SHOWPIECES TONIGHT -->
      <section class="space-y-2">
        <div class="flex items-center justify-between px-0.5">
          <h2 class="text-xs font-label font-bold uppercase tracking-wider text-dark-on-surface-variant">
            Top 3 NexStar 8SE Sights Tonight
          </h2>
          <button id="btn-all-targets" type="button" class="text-xs font-semibold text-accent hover:underline">
            All 14 Wonders →
          </button>
        </div>

        <div class="grid grid-cols-3 gap-2">
          ${topThreeTargets
            .map(
              (t) => `
            <button
              type="button"
              data-quick-target="${t.id}"
              data-quick-ep="${t.best_eyepiece_mm}"
              data-quick-reducer="${t.recommended_reducer}"
              class="glass-card rounded-2xl p-2.5 border border-dark-outline/80 text-left flex flex-col justify-between hover:border-accent/60 tap-scale"
            >
              <div>
                <div class="flex items-center justify-between gap-1">
                  <span class="text-[10px] font-label px-1.5 py-0.5 rounded bg-accent/15 text-accent font-bold">
                    ${t.alt_deg}° ${t.cardinal}
                  </span>
                  <span class="text-[10px] text-chart-moon">${'★'.repeat(Math.min(5, t.family_wow))}</span>
                </div>
                <div class="font-bold text-xs text-dark-on-surface mt-1.5 line-clamp-1">
                  ${t.name.split('·')[0].trim()}
                </div>
                <div class="text-[10.5px] text-dark-on-surface-variant line-clamp-1 mt-0.5">
                  ${t.name.includes('·') ? t.name.split('·')[1].trim() : t.category}
                </div>
              </div>
              <div class="mt-2 pt-1.5 border-t border-dark-outline/50 flex items-center justify-between text-[10px] font-label text-celestron">
                <span>${t.best_eyepiece_mm}mm${t.recommended_reducer ? ' + f/6.3' : ''}</span>
                <span class="material-symbols-outlined text-[13px]">visibility</span>
              </div>
            </button>
          `
            )
            .join('')}
        </div>
      </section>

      <!-- STREAMLINED 48-HOUR CLEAR DARK SKY MATRIX -->
      <section class="glass-card rounded-3xl p-3.5 border border-dark-outline/90 space-y-3">
        <div class="flex items-center justify-between gap-2">
          <div>
            <h2 class="text-sm font-bold text-dark-on-surface">48-Hour Clear Sky Chart</h2>
            <p class="text-[11px] text-dark-on-surface-variant">
              Best Clear Run: <span class="text-accent font-semibold">${plan.best_clear_window}</span>
            </p>
          </div>
          <button
            id="btn-jump-tonight"
            type="button"
            class="px-2.5 py-1 rounded-xl bg-dark-surface-container-high border border-dark-outline font-label text-[10.5px] font-semibold text-accent tap-scale"
          >
            Jump to Tonight
          </button>
        </div>

        <!-- Legend -->
        <div class="flex items-center gap-3 text-[10px] font-label text-dark-on-surface-variant">
          <span class="inline-flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-[#003E7E]"></span>Deep Blue = Clear / Steady</span>
          <span class="inline-flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-[#95D5D5]"></span>Pale = Cloudy / Hazy</span>
        </div>

        <!-- Matrix Grid with Sticky Row Labels -->
        <div class="flex items-stretch gap-1.5">
          <!-- Left Labels -->
          <div class="shrink-0 w-[64px] flex flex-col justify-between pt-[34px] pb-0.5 text-[10.5px] font-label text-dark-on-surface-variant select-none">
            <div class="h-5 flex items-center">Clouds</div>
            <div class="h-5 flex items-center">Clarity</div>
            <div class="h-5 flex items-center">Steady</div>
            <div class="h-5 flex items-center">Darkness</div>
            <div class="h-5 flex items-center">Wind</div>
            <div class="h-5 flex items-center">Temp</div>
          </div>

          <!-- Horizontal Scrollable 48 Columns -->
          <div id="matrix-scroll" class="overflow-x-auto no-scrollbar flex-1 pb-1">
            <div class="inline-flex gap-[3px] min-w-max">
              ${timeline
                .map((h, idx) => {
                  const isSelected = idx === selectedIdx;
                  const isMidnight = h.hour24 === 0 || idx === 0;
                  return `
                  <button
                    type="button"
                    data-hour-col="${idx}"
                    class="hour-col-btn w-[22px] flex flex-col items-center rounded-lg p-[1px] transition-all ${
                      isSelected ? 'ring-2 ring-accent bg-accent/15 z-10' : 'hover:bg-white/5'
                    } ${h.hour24 === 0 && idx > 0 ? 'ml-1.5 border-l border-accent/40 pl-1' : ''}"
                  >
                    <span class="h-[14px] text-[9px] font-label leading-none ${
                      isMidnight ? 'text-accent font-bold' : 'text-transparent'
                    }">
                      ${idx === 0 ? 'Now' : isMidnight ? h.day_short : '·'}
                    </span>
                    <span class="h-[16px] text-[9.5px] font-label leading-tight ${
                      isSelected ? 'text-accent font-bold' : h.is_night ? 'text-dark-on-surface' : 'text-dark-on-surface-variant/70'
                    }">
                      ${h.hour_12h_compact || h.hour_short}
                    </span>

                    <span class="w-full h-5 rounded-[3px] mb-[3px]" style="background:${h.blended_cloud_color || h.cloud_gem_color}"></span>
                    <span class="w-full h-5 rounded-[3px] mb-[3px]" style="background:${h.transparency_color}"></span>
                    <span class="w-full h-5 rounded-[3px] mb-[3px]" style="background:${h.seeing_color}"></span>
                    <span class="w-full h-5 rounded-[3px] mb-[3px] border border-white/10" style="background:${h.darkness_color}"></span>
                    <span class="w-full h-5 rounded-[3px] mb-[3px]" style="background:${h.wind_color}"></span>
                    <span class="w-full h-5 rounded-[3px]" style="background:${h.temp_color}"></span>
                  </button>
                `;
                })
                .join('')}
            </div>
          </div>
        </div>

        <!-- Active Hour Inspector Card -->
        <div id="hour-inspector" class="bg-dark-surface/75 rounded-2xl p-3 border border-dark-outline/80 space-y-2"></div>
      </section>

      <!-- 7-NIGHT FAMILY STARGAZING OUTLOOK -->
      <section class="space-y-2">
        <div class="flex items-center justify-between px-0.5">
          <h2 class="text-xs font-label font-bold uppercase tracking-wider text-dark-on-surface-variant">
            7-Night Evening Outlook (8 PM – 11 PM)
          </h2>
        </div>

        <div class="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          ${sevenNights
            .map((n) => {
              const scoreClass =
                n.tone === 'prime'
                  ? 'text-emerald-300 border-emerald-500/30'
                  : n.tone === 'good'
                    ? 'text-accent border-accent/30'
                    : n.tone === 'fair'
                      ? 'text-amber-300 border-amber-500/30'
                      : 'text-slate-400 border-dark-outline/70';
              return `
              <div class="glass-card shrink-0 w-[96px] rounded-2xl p-2.5 border ${scoreClass} flex flex-col items-center text-center">
                <span class="text-[11px] font-bold text-dark-on-surface">${n.day_label}</span>
                <span class="text-[10px] font-label text-dark-on-surface-variant">${n.date_short}</span>
                <span class="material-symbols-outlined text-[22px] my-1.5">${n.icon}</span>
                <span class="font-label text-sm font-extrabold">${n.score}</span>
                <span class="text-[10px] text-dark-on-surface-variant mt-0.5">${n.cloud_pct}% Clouds</span>
                <span class="text-[10px] font-label text-dark-on-surface/80 mt-0.5">${n.temp_f}°F · ☾${n.moon_illum_pct}%</span>
              </div>
            `;
            })
            .join('')}
        </div>
      </section>

      <!-- WORTH A DRIVE TONIGHT? NEARBY NC DARK SKY PREVIEW -->
      <section class="glass-card rounded-3xl p-3.5 border border-dark-outline/80 space-y-2.5">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-bold text-dark-on-surface">Darker Skies Near Burlington</h2>
            <p class="text-[11px] text-dark-on-surface-variant">Compare backyard Bortle 4 vs quick family road trips</p>
          </div>
          <button id="btn-open-map" type="button" class="text-xs font-semibold text-accent hover:underline">
            Radar & Sites →
          </button>
        </div>

        <div class="space-y-1.5">
          ${nearbySites
            .slice(0, 3)
            .map(
              (site) => `
            <button
              type="button"
              data-open-site="${site.id}"
              class="w-full bg-dark-surface/65 hover:bg-dark-surface rounded-2xl px-3 py-2 border border-dark-outline/60 flex items-center justify-between text-left tap-scale"
            >
              <div>
                <div class="text-xs font-bold text-dark-on-surface">${site.short_name}</div>
                <div class="text-[10.5px] font-label text-dark-on-surface-variant">
                  ${site.distance_label} · Bortle ${site.bortle_class} (Mag ${site.base_nelm})
                </div>
              </div>
              <div class="text-right">
                <div class="font-label text-xs font-bold ${
                  site.cloud_pct <= 25 ? 'text-emerald-300' : site.cloud_pct <= 55 ? 'text-amber-300' : 'text-slate-400'
                }">
                  ${site.cloud_pct}% Clouds
                </div>
                <div class="text-[10px] font-label text-dark-on-surface-variant">Score ${site.observing_score}</div>
              </div>
            </button>
          `
            )
            .join('')}
        </div>
      </section>

      <!-- Attribution Footer -->
      <footer class="text-center text-[10.5px] text-dark-on-surface-variant/75 pt-1 pb-2">
        Clear Dark Sky color model inspired by Attilla Danko &amp; Allan Rahill (CMC GEM) + Open-Meteo ECMWF.
      </footer>
    </div>
  `;

  function updateHourInspector(idx) {
    const inspectorEl = container.querySelector('#hour-inspector');
    if (!inspectorEl || !timeline[idx]) return;
    const h = timeline[idx];

    const targetDt = h.date_ms ? new Date(h.date_ms) : new Date();
    const hourTargets = getFovSimulatorTargets(targetDt, { seeingRating: h.seeing_rating || 4 })
      .target_list.filter((t) => t.alt_deg >= 15)
      .slice(0, 3)
      .map((t) => t.name.split('·')[0].trim())
      .join(', ');

    const skyStateText = h.is_night
      ? `Dark Sky · Mag ${h.darkness_numeric}`
      : h.darkness_mag === 'Day'
        ? 'Daylight (Sun Up)'
        : 'Twilight Transition';

    inspectorEl.innerHTML = `
      <div class="flex items-center justify-between border-b border-dark-outline/60 pb-2">
        <div>
          <span class="font-label text-xs font-bold text-accent">${h.day_label}</span>
          <span class="text-[11px] text-dark-on-surface-variant ml-1.5">· ${skyStateText}</span>
        </div>
        <span class="font-label text-xs font-bold px-2 py-0.5 rounded-lg bg-dark-surface-container-high text-dark-on-surface">
          Score ${h.hour_score}/100
        </span>
      </div>

      <div class="grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <div class="text-dark-on-surface-variant text-[10px]">Clouds (GEM/ECMWF)</div>
          <div class="font-label font-semibold text-dark-on-surface">${h.cloud_pct}% / ${h.ecmwf_pct}%</div>
        </div>
        <div>
          <div class="text-dark-on-surface-variant text-[10px]">8SE Air Steadiness</div>
          <div class="font-label font-semibold text-dark-on-surface">${h.seeing_label}</div>
        </div>
        <div>
          <div class="text-dark-on-surface-variant text-[10px]">Temp / Breeze</div>
          <div class="font-label font-semibold text-dark-on-surface">${h.temp_f}°F · ${h.wind_mph} mph</div>
        </div>
      </div>

      ${
        h.is_night && hourTargets
          ? `<div class="text-[11px] text-dark-on-surface-variant pt-0.5">
              <span class="text-celestron font-semibold">High in Burlington at ${h.hour_12h}:</span> ${hourTargets}
            </div>`
          : ''
      }
    `;
  }

  updateHourInspector(selectedIdx);

  // Scroll matrix gently so selected column is visible if > 4
  const scrollWrap = container.querySelector('#matrix-scroll');
  if (scrollWrap && selectedIdx > 3) {
    requestAnimationFrame(() => {
      scrollWrap.scrollLeft = Math.max(0, (selectedIdx - 3) * 25);
    });
  }

  // Event Listeners
  container.querySelector('#btn-red-vision')?.addEventListener('click', () => {
    actions.toggleNightVision();
    renderDashboardScreen(container, state, actions);
  });

  container.querySelector('#btn-sync-forecast')?.addEventListener('click', async () => {
    const icon = container.querySelector('#sync-icon');
    icon?.classList.add('animate-spin', 'text-accent');
    try {
      await actions.refreshForecast();
    } finally {
      icon?.classList.remove('animate-spin');
    }
  });

  container.querySelector('#btn-hero-explore')?.addEventListener('click', () => {
    actions.navigate('explore');
  });

  container.querySelector('#btn-all-targets')?.addEventListener('click', () => {
    actions.navigate('explore');
  });

  container.querySelector('#btn-hero-scope')?.addEventListener('click', () => {
    actions.navigate('optics');
  });

  container.querySelector('#btn-open-map')?.addEventListener('click', () => {
    actions.navigate('map');
  });

  container.querySelectorAll('[data-open-site]').forEach((btn) => {
    btn.addEventListener('click', () => actions.navigate('map'));
  });

  container.querySelectorAll('[data-quick-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-quick-target');
      const ep = Number(btn.getAttribute('data-quick-ep') || 25);
      const useReducer = btn.getAttribute('data-quick-reducer') === 'true';
      actions.navigate('fov', {
        selectedTargetId: targetId,
        selectedEyepiece: ep,
        hasReducer: useReducer,
        hasBarlow: false,
        fromScreen: 'dashboard',
      });
    });
  });

  container.querySelector('#btn-jump-tonight')?.addEventListener('click', () => {
    const idx = plan.recommended_hour_index ?? 0;
    actions.selectHour(idx);
    container.querySelectorAll('[data-hour-col]').forEach((el) => {
      const cIdx = Number(el.getAttribute('data-hour-col'));
      el.classList.toggle('ring-2', cIdx === idx);
      el.classList.toggle('ring-accent', cIdx === idx);
      el.classList.toggle('bg-accent/15', cIdx === idx);
    });
    updateHourInspector(idx);
    if (scrollWrap) {
      scrollWrap.scrollTo({ left: Math.max(0, (idx - 3) * 25), behavior: 'smooth' });
    }
  });

  container.querySelectorAll('[data-hour-col]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-hour-col'));
      actions.selectHour(idx);
      container.querySelectorAll('[data-hour-col]').forEach((el) => {
        const cIdx = Number(el.getAttribute('data-hour-col'));
        el.classList.toggle('ring-2', cIdx === idx);
        el.classList.toggle('ring-accent', cIdx === idx);
        el.classList.toggle('bg-accent/15', cIdx === idx);
      });
      updateHourInspector(idx);
    });
  });
}

export default renderDashboardScreen;
