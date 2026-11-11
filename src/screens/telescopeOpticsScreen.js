/**
 * Screen 3: Celestron NexStar 8SE Prep, Cooldown, Dew Guard & SkyAlign Compass
 * Advisory-only real-world hardware prep for Burlington, NC (Zero fake Wi-Fi slew buttons)
 */

import {
  getNexStar8SETelemetry,
  getSkyAlignStars,
  getDefaultStargazingReferenceDate,
} from '../services/astronomyEngine.js';

export function renderTelescopeOpticsScreen(container, state, actions) {
  if (!container) return;

  // Clear any prior live cooldown tick interval attached to container
  if (container._cooldownInterval) {
    clearInterval(container._cooldownInterval);
    container._cooldownInterval = null;
  }

  const isRedMode = Boolean(state?.nightVisionMode || document.body.classList.contains('night-vision-mode'));

  function getLiveTelemetry() {
    const plan = state?.forecast?.tonight_plan || {};
    const curr = state?.currentHour || {};
    const outdoorTempF = curr.tempF ?? plan.evening_temp_f ?? 52;
    const humidityPct = curr.humidity ?? 62;
    const dewPointF = curr.dewPointF ?? undefined;
    const seeingScore = curr.seeing ?? plan.evening_seeing ?? 4;
    const cloudPct = curr.cloudCover ?? plan.evening_cloud_pct ?? 12;

    const indoorTempF = Number(state?.optics?.indoorTempF ?? state?.settings?.nexstarIndoorTempF ?? 70);
    const cooldownStartTimestamp =
      state?.optics?.cooldownStartTimestamp ?? state?.settings?.cooldownStartTimestamp ?? null;
    const reducerActive = Boolean(state?.hasReducer ?? state?.optics?.hasReducer);
    const barlowActive = Boolean(state?.hasBarlow ?? state?.optics?.hasBarlow);

    const telemetry = getNexStar8SETelemetry(
      {
        ambient_temp_f: outdoorTempF,
        humidity_pct: humidityPct,
        dew_point_f: dewPointF,
        seeing_score: seeingScore,
      },
      {
        indoor_start_temp_f: indoorTempF,
        cooldownStartTimestamp,
        reducerActive,
        barlowActive,
      }
    );

    const refDate = getDefaultStargazingReferenceDate(new Date());
    const skyAlign = getSkyAlignStars(refDate, { cloud_cover_pct: cloudPct });

    return { telemetry, skyAlign, indoorTempF, cooldownStartTimestamp, reducerActive, barlowActive };
  }

  function drawSkyAlignCompass(canvas, skyAlign, alignedSet) {
    if (!canvas || !skyAlign) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const size = canvas.clientWidth || 220;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 14;

    ctx.clearRect(0, 0, size, size);

    // Dome background
    const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
    grad.addColorStop(0, '#070d1d');
    grad.addColorStop(1, '#101d36');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#233146';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Optimal 22°–72° backyard sightline annulus (avoids trees <20° and fork zenith lock >74°)
    const rOuter = r * ((90 - 22) / 90);
    const rInner = r * ((90 - 72) / 90);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
    ctx.arc(cx, cy, rInner, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(0, 229, 255, 0.06)';
    ctx.fill();
    ctx.restore();

    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 1;
    [rOuter, rInner].forEach((rad) => {
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    const stars = skyAlign.recommended_stars || [];
    if (stars.length >= 3) {
      ctx.beginPath();
      stars.forEach((s, idx) => {
        const sx = cx + s.nx * r;
        const sy = cy + s.ny * r;
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 122, 47, 0.12)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 122, 47, 0.65)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    stars.forEach((s, idx) => {
      const sx = cx + s.nx * r;
      const sy = cy + s.ny * r;
      const isDone = alignedSet.has(s.name);
      const color = isDone ? '#00E676' : '#FF7A2F';

      ctx.beginPath();
      ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      ctx.fillStyle = isDone ? 'rgba(0, 230, 118, 0.22)' : 'rgba(255, 122, 47, 0.22)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.font = 'bold 9.5px "Spline Sans Mono", monospace';
      ctx.fillStyle = '#EEF4FB';
      ctx.textAlign = sx > cx + 25 ? 'right' : 'left';
      ctx.fillText(`${idx + 1}.${s.name}`, sx + (sx > cx + 25 ? -7 : 7), sy + 3);
    });

    // Cardinals
    ctx.font = 'bold 10px "Spline Sans Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FF7A2F';
    ctx.fillText('N', cx, 10);
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('S', cx, size - 3);
    ctx.fillText('E', 7, cy + 3.5);
    ctx.fillText('W', size - 7, cy + 3.5);
  }

  function renderView() {
    const {
      telemetry,
      skyAlign,
      indoorTempF,
      cooldownStartTimestamp,
      reducerActive,
      barlowActive,
    } = getLiveTelemetry();

    const selectedEpMm = Number(state?.selectedEyepiece || 25);
    const alignedNames = Array.isArray(state?.optics?.alignedStarNames)
      ? state.optics.alignedStarNames
      : [];
    const alignedSet = new Set(alignedNames);
    const alignedCount = skyAlign.recommended_stars.filter((s) => alignedSet.has(s.name)).length;

    const dewBadgeClass =
      telemetry.dew.risk_level === 'HIGH DEW RISK'
        ? 'bg-rose-500/15 border-rose-400/40 text-rose-300'
        : telemetry.dew.risk_level === 'MODERATE DEW'
          ? 'bg-amber-500/15 border-amber-400/40 text-amber-300'
          : 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300';

    container.innerHTML = `
      <div class="safe-top pb-28 px-4 space-y-4">
        <!-- Header -->
        <header class="flex items-center justify-between pt-1">
          <div>
            <div class="flex items-center gap-1.5">
              <span class="material-symbols-outlined text-celestron text-[20px]">center_focus_strong</span>
              <h1 class="text-lg font-extrabold tracking-tight text-dark-on-surface">Celestron NexStar 8SE</h1>
            </div>
            <p class="font-label text-[11px] text-dark-on-surface-variant">
              8" f/10 SCT (2032mm) · Cooldown, Dew &amp; SkyAlign Guide
            </p>
          </div>

          <button
            id="btn-optics-red"
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

        <!-- 8SE HERO: Seeing Cap & Quick Eyepiece Simulator CTA -->
        <section class="celestron-hero-card rounded-3xl p-4 border border-celestron/35 space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-celestron/15 border border-celestron/40 text-celestron font-label text-[10.5px] font-bold">
                <span>STARBRIGHT XLT · 843× HUMAN EYE LIGHT GRASP</span>
              </div>
              <h2 class="text-base font-extrabold text-dark-on-surface mt-2">
                Tonight's Atmosphere Cap: <span class="text-accent">${telemetry.seeing_limit.label}</span>
              </h2>
              <p class="text-xs text-dark-on-surface-variant mt-0.5">
                ${telemetry.seeing_limit.condition}
              </p>
            </div>
          </div>

          <p class="text-xs leading-relaxed text-dark-on-surface/90 bg-dark-surface/60 rounded-2xl p-2.5 border border-dark-outline/60">
            ${telemetry.seeing_limit.recommendation}
          </p>

          <button
            id="btn-open-fov-sim"
            type="button"
            class="w-full bg-celestron text-dark-surface font-extrabold text-sm py-2.5 px-4 rounded-2xl flex items-center justify-center gap-1.5 shadow-lg shadow-celestron/20 tap-scale"
          >
            <span class="material-symbols-outlined text-[19px]">visibility</span>
            <span>Open Interactive 8SE Eyepiece Simulator</span>
          </button>
        </section>

        <!-- 1. CLOSED-TUBE THERMAL COOLDOWN TIMER -->
        <section class="glass-card rounded-3xl p-4 border border-dark-outline/90 space-y-3">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h2 class="text-sm font-bold text-dark-on-surface flex items-center gap-1.5">
                <span class="material-symbols-outlined text-accent text-[18px]">device_thermostat</span>
                <span>8" Mirror Cooldown Timer</span>
              </h2>
              <p class="text-[11px] text-dark-on-surface-variant">
                Indoor ${indoorTempF}°F → Outdoor ${telemetry.thermal.ambient_temp_f}°F (ΔT ${telemetry.thermal.delta_t_f}°F)
              </p>
            </div>
            <span class="font-label text-[10.5px] font-bold px-2.5 py-1 rounded-full ${
              telemetry.thermal.is_acclimated
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/40'
                : 'bg-celestron/15 text-celestron border border-celestron/40'
            }">
              ${telemetry.thermal.status}
            </span>
          </div>

          <!-- Progress Bar -->
          <div class="space-y-1">
            <div class="w-full h-2.5 bg-dark-surface rounded-full overflow-hidden border border-dark-outline/60">
              <div
                class="h-full bg-gradient-to-r from-celestron to-accent transition-all duration-500"
                style="width: ${telemetry.thermal.is_timer_active ? telemetry.thermal.progress_percent : 8}%"
              ></div>
            </div>
            <div class="flex justify-between text-[10.5px] font-label text-dark-on-surface-variant">
              <span>Wide-Field (81x): <strong class="text-dark-on-surface">${
                telemetry.thermal.wide_field_minutes === 0 ? 'Ready!' : `~${telemetry.thermal.wide_field_minutes}m`
              }</strong></span>
              <span>Sharp Planets (200x): <strong class="text-dark-on-surface">${
                telemetry.thermal.estimated_cooldown_minutes === 0 ? 'Ready!' : `~${telemetry.thermal.estimated_cooldown_minutes}m`
              }</strong></span>
            </div>
          </div>

          <p class="text-xs text-dark-on-surface/90 leading-relaxed">
            ${telemetry.thermal.family_advice}
          </p>

          <!-- Controls: House Temp Adjuster + Start/Reset Cooldown -->
          <div class="flex items-center justify-between gap-2 pt-1">
            <div class="flex items-center gap-1.5 bg-dark-surface/80 border border-dark-outline rounded-2xl px-2.5 py-1.5">
              <span class="text-[10.5px] font-label text-dark-on-surface-variant">House:</span>
              <button id="btn-indoor-minus" type="button" class="w-6 h-6 rounded-lg bg-dark-surface-container-high text-dark-on-surface font-bold text-xs tap-scale">-</button>
              <span class="font-label text-xs font-bold text-dark-on-surface w-9 text-center">${indoorTempF}°F</span>
              <button id="btn-indoor-plus" type="button" class="w-6 h-6 rounded-lg bg-dark-surface-container-high text-dark-on-surface font-bold text-xs tap-scale">+</button>
            </div>

            ${
              cooldownStartTimestamp
                ? `<button
                    id="btn-reset-cooldown"
                    type="button"
                    class="flex-1 bg-dark-surface-container-high border border-dark-outline text-dark-on-surface-variant hover:text-dark-on-surface font-semibold text-xs py-2.5 px-3 rounded-2xl flex items-center justify-center gap-1.5 tap-scale"
                  >
                    <span class="material-symbols-outlined text-[16px]">restart_alt</span>
                    <span>Outside ${telemetry.thermal.elapsed_minutes}m · Reset</span>
                  </button>`
                : `<button
                    id="btn-start-cooldown"
                    type="button"
                    class="flex-1 bg-accent/15 border border-accent/40 text-accent font-bold text-xs py-2.5 px-3 rounded-2xl flex items-center justify-center gap-1.5 tap-scale"
                  >
                    <span class="material-symbols-outlined text-[16px]">timer</span>
                    <span>Scope Is Outside · Start Timer</span>
                  </button>`
            }
          </div>
        </section>

        <!-- 2. CAROLINA DEW SHIELD & CORRECTOR GUARD -->
        <section class="glass-card rounded-3xl p-4 border border-dark-outline/90 space-y-2">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-sm font-bold text-dark-on-surface flex items-center gap-1.5">
              <span class="material-symbols-outlined text-accent text-[18px]">water_drop</span>
              <span>8" Front Glass Dew Guard</span>
            </h2>
            <span class="font-label text-[10.5px] font-bold px-2.5 py-0.5 rounded-full border ${dewBadgeClass}">
              ${telemetry.dew.risk_level}
            </span>
          </div>
          <div class="grid grid-cols-3 gap-2 text-[11px] font-label bg-dark-surface/65 rounded-2xl p-2.5 border border-dark-outline/60">
            <div>
              <div class="text-[10px] text-dark-on-surface-variant">Air / Dew Pt</div>
              <div class="font-bold text-dark-on-surface">${telemetry.dew.ambient_temp_f}°F / ${telemetry.dew.dew_point_f}°F</div>
            </div>
            <div>
              <div class="text-[10px] text-dark-on-surface-variant">Dew Margin</div>
              <div class="font-bold text-dark-on-surface">${telemetry.dew.dew_depression_f}°F spread</div>
            </div>
            <div>
              <div class="text-[10px] text-dark-on-surface-variant">Humidity</div>
              <div class="font-bold text-dark-on-surface">${telemetry.dew.humidity_pct}% RH</div>
            </div>
          </div>
          <p class="text-xs text-dark-on-surface/90 leading-relaxed">
            ${telemetry.dew.recommendation_text}
          </p>
        </section>

        <!-- 3. SKYALIGN 3-STAR BACKYARD COMPASS -->
        <section class="glass-card rounded-3xl p-4 border border-dark-outline/90 space-y-3">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h2 class="text-sm font-bold text-dark-on-surface flex items-center gap-1.5">
                <span class="material-symbols-outlined text-celestron text-[18px]">explore</span>
                <span>Best 3 SkyAlign Stars (${skyAlign.time_12h})</span>
              </h2>
              <p class="text-[11px] text-dark-on-surface-variant">
                Wide triangle between 22°–72° (clears trees &amp; avoids zenith lock)
              </p>
            </div>
            <span class="font-label text-[10.5px] font-bold px-2 py-0.5 rounded-lg ${
              alignedCount === 3 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-dark-surface-container-high text-accent'
            }">
              ${alignedCount}/3 Aligned
            </span>
          </div>

          <!-- Overhead Triangle Canvas -->
          <div class="mx-auto w-full max-w-[225px] aspect-square">
            <canvas id="skyalign-compass-canvas" class="w-full h-full"></canvas>
          </div>

          <!-- Interactive 3-Star Checklist -->
          <div class="space-y-2">
            ${skyAlign.recommended_stars
              .map((star, idx) => {
                const checked = alignedSet.has(star.name);
                return `
                <button
                  type="button"
                  data-align-star="${star.name}"
                  class="w-full rounded-2xl p-3 border text-left flex items-center justify-between gap-3 tap-scale ${
                    checked
                      ? 'bg-emerald-950/30 border-emerald-500/50'
                      : 'bg-dark-surface/70 border-dark-outline/70 hover:border-celestron/50'
                  }"
                >
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span class="w-6 h-6 rounded-full flex items-center justify-center font-label text-xs font-bold shrink-0 ${
                      checked ? 'bg-emerald-400 text-dark-surface' : 'bg-celestron/20 text-celestron'
                    }">
                      ${checked ? '✓' : idx + 1}
                    </span>
                    <div class="min-w-0">
                      <div class="text-xs font-bold text-dark-on-surface">
                        ${star.name} <span class="font-normal text-dark-on-surface-variant">· ${star.constellation}</span>
                      </div>
                      <div class="text-[11px] text-dark-on-surface-variant truncate">${star.hint}</div>
                    </div>
                  </div>
                  <div class="text-right shrink-0 font-label">
                    <div class="text-xs font-bold text-accent">${star.alt_deg}° ${star.cardinal}</div>
                    <div class="text-[10px] text-dark-on-surface-variant">Az ${star.az_padded}°</div>
                  </div>
                </button>
              `;
              })
              .join('')}
          </div>

          <!-- Pro Hand-Control Tip -->
          <div class="bg-dark-surface/70 rounded-2xl p-2.5 border border-dark-outline/60 text-[11.5px] text-dark-on-surface-variant leading-snug">
            <strong class="text-celestron">NexStar Pro Tip:</strong> Center each star with your 25mm eyepiece, and always finish centering using the <strong class="text-dark-on-surface">UP</strong> and <strong class="text-dark-on-surface">RIGHT</strong> arrow keys on the hand controller so the gears stay meshed!
          </div>
        </section>

        <!-- 4. EYEPIECE & REDUCER / BARLOW MATRIX -->
        <section class="glass-card rounded-3xl p-4 border border-dark-outline/90 space-y-3">
          <div>
            <h2 class="text-sm font-bold text-dark-on-surface">Eyepiece &amp; Optical Train Matrix</h2>
            <p class="text-[11px] font-label text-accent">${telemetry.eyepiece_matrix.configuration_label}</p>
          </div>

          <!-- Reducer & Barlow Toggles -->
          <div class="grid grid-cols-2 gap-2">
            <button
              id="btn-toggle-reducer"
              type="button"
              class="py-2 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 tap-scale ${
                reducerActive
                  ? 'bg-accent/20 border-accent text-accent'
                  : 'bg-dark-surface/70 border-dark-outline text-dark-on-surface-variant'
              }"
            >
              <span class="material-symbols-outlined text-[16px]">zoom_out_map</span>
              <span>f/6.3 Reducer</span>
            </button>

            <button
              id="btn-toggle-barlow"
              type="button"
              class="py-2 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 tap-scale ${
                barlowActive
                  ? 'bg-celestron/20 border-celestron text-celestron'
                  : 'bg-dark-surface/70 border-dark-outline text-dark-on-surface-variant'
              }"
            >
              <span class="material-symbols-outlined text-[16px]">zoom_in</span>
              <span>2× Barlow</span>
            </button>
          </div>

          <!-- 4 Eyepiece Cards -->
          <div class="space-y-2">
            ${telemetry.eyepiece_matrix.eyepieces
              .map((ep) => {
                const isSelected = ep.focal_length_mm === selectedEpMm;
                return `
                <button
                  type="button"
                  data-ep-card="${ep.focal_length_mm}"
                  class="w-full rounded-2xl p-3 border text-left flex items-center justify-between gap-2 tap-scale ${
                    isSelected
                      ? 'bg-accent/10 border-accent/70'
                      : 'bg-dark-surface/65 border-dark-outline/70 hover:border-accent/40'
                  }"
                >
                  <div>
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs font-extrabold text-dark-on-surface">${ep.name}</span>
                      ${
                        ep.exceeds_seeing_limit
                          ? `<span class="text-[9.5px] font-label px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">Over Cap</span>`
                          : ''
                      }
                    </div>
                    <div class="text-[11px] text-dark-on-surface-variant mt-0.5">${ep.optical_note}</div>
                  </div>
                  <div class="text-right font-label shrink-0">
                    <div class="text-sm font-extrabold ${ep.exceeds_seeing_limit ? 'text-amber-300' : 'text-accent'}">${ep.magnification_display}</div>
                    <div class="text-[10px] text-dark-on-surface-variant">${ep.tfov_display} · ${ep.exit_pupil_display}</div>
                  </div>
                </button>
              `;
              })
              .join('')}
          </div>
        </section>
      </div>
    `;

    const compassCanvas = container.querySelector('#skyalign-compass-canvas');
    drawSkyAlignCompass(compassCanvas, skyAlign, alignedSet);

    // Wire interactions
    container.querySelector('#btn-optics-red')?.addEventListener('click', () => {
      actions.toggleNightVision();
      renderView();
    });

    container.querySelector('#btn-open-fov-sim')?.addEventListener('click', () => {
      actions.navigate('fov', { fromScreen: 'optics' });
    });

    container.querySelector('#btn-indoor-minus')?.addEventListener('click', () => {
      actions.updateSettings({ nexstarIndoorTempF: Math.max(55, indoorTempF - 2) });
      renderView();
    });

    container.querySelector('#btn-indoor-plus')?.addEventListener('click', () => {
      actions.updateSettings({ nexstarIndoorTempF: Math.min(82, indoorTempF + 2) });
      renderView();
    });

    container.querySelector('#btn-start-cooldown')?.addEventListener('click', () => {
      actions.updateSettings({ cooldownStartTimestamp: Date.now() });
      renderView();
    });

    container.querySelector('#btn-reset-cooldown')?.addEventListener('click', () => {
      actions.updateSettings({ cooldownStartTimestamp: null });
      renderView();
    });

    container.querySelectorAll('[data-align-star]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const starName = btn.getAttribute('data-align-star');
        const nextSet = new Set(alignedNames);
        if (nextSet.has(starName)) nextSet.delete(starName);
        else nextSet.add(starName);
        actions.updateSettings({ alignedStarNames: Array.from(nextSet) });
        renderView();
      });
    });

    container.querySelector('#btn-toggle-reducer')?.addEventListener('click', () => {
      actions.toggleReducer(!reducerActive);
      renderView();
    });

    container.querySelector('#btn-toggle-barlow')?.addEventListener('click', () => {
      actions.toggleBarlow(!barlowActive);
      renderView();
    });

    container.querySelectorAll('[data-ep-card]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mm = Number(btn.getAttribute('data-ep-card') || 25);
        actions.selectEyepiece(mm);
        actions.navigate('fov', { selectedEyepiece: mm, fromScreen: 'optics' });
      });
    });
  }

  renderView();

  // Live refresh every 30s if cooldown timer is running while viewing this tab
  container._cooldownInterval = setInterval(() => {
    if (!document.body.contains(container) || state.activeScreen !== 'optics') {
      clearInterval(container._cooldownInterval);
      container._cooldownInterval = null;
      return;
    }
    if (state?.optics?.cooldownStartTimestamp) {
      renderView();
    }
  }, 30000);
}

export default renderTelescopeOpticsScreen;
