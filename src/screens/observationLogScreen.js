/**
 * Screen 5: Family Celestial Passport & Observation Journal
 * Unified storage via storageService.js — 14 Cosmic Wonder Stamps, Quick Logging,
 * Optional Eyepiece Sketchpad, and Shareable Souvenir Card PNG Export.
 */

import {
  DEFAULT_EYEPIECES,
  getFovSimulatorTargets,
  getDefaultStargazingReferenceDate,
} from '../services/astronomyEngine.js';

import {
  getObservationLogs,
  getSpottedTargetIds,
  exportSketchAsPng,
  exportLogbookAsJson,
} from '../services/storageService.js';

const WHO_OPTIONS = ['Whole Family', 'Kids First!', 'Solo Session'];
const LOCATION_OPTIONS = [
  'Burlington, NC Backyard (Bortle 4)',
  'Cane Creek Mtn (Alamance Co.)',
  'Haw River State Park',
  'Jordan Lake (Bortle 3)',
  'Staunton River Dark Sky Park',
];

export function renderObservationLogScreen(container, state, actions) {
  if (!container) return;

  const refDate = getDefaultStargazingReferenceDate(new Date());
  const catalog = getFovSimulatorTargets(refDate);
  const allTargets = catalog.target_list;

  let selectedTargetId = state?.selectedTargetId || 'saturn';
  if (!catalog.targets[selectedTargetId]) {
    selectedTargetId = allTargets[0]?.id || 'saturn';
  }

  let wowRating = 5;
  let whoSpotted = 'Whole Family';
  let locationChoice = LOCATION_OPTIONS[0];
  let eyepieceMm = Number(state?.selectedEyepiece || 25);
  let filterChoice = state?.selectedFilter || 'No Filter';
  let sketchOpen = false;
  let hasDrawnStrokes = false;
  let brushColor = '#f8fafc';
  let brushSize = 2.4;
  let toastMessage = '';

  const isRedMode = Boolean(state?.nightVisionMode || document.body.classList.contains('night-vision-mode'));

  function renderView() {
    const logs = getObservationLogs();
    const spottedIds = getSpottedTargetIds();
    const spottedCount = allTargets.filter((t) => spottedIds.has(t.id)).length;
    const passportPct = Math.round((spottedCount / allTargets.length) * 100);
    const currentTarget = catalog.targets[selectedTargetId] || allTargets[0];

    container.innerHTML = `
      <div class="safe-top pb-28 px-4 space-y-4">
        <!-- Header -->
        <header class="flex items-center justify-between pt-1">
          <div>
            <div class="flex items-center gap-1.5">
              <span class="material-symbols-outlined text-accent text-[20px]">auto_stories</span>
              <h1 class="text-lg font-extrabold tracking-tight text-dark-on-surface">Family Sky Passport</h1>
            </div>
            <p class="font-label text-[11px] text-dark-on-surface-variant">
              Burlington Stargazing Memories &amp; NexStar 8SE Sightings
            </p>
          </div>

          <button
            id="btn-journal-red"
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

        ${
          toastMessage
            ? `<div class="bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px]">verified</span>
                <span>${toastMessage}</span>
              </div>`
            : ''
        }

        <!-- 1. FAMILY CELESTIAL PASSPORT PROGRESS (X / 14 WONDERS) -->
        <section class="cosmic-hero-card rounded-3xl p-4 border border-dark-outline/90 space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-[10.5px] font-label uppercase tracking-wider text-accent font-bold">
                Burlington Cosmic Quest
              </div>
              <h2 class="text-base font-extrabold text-dark-on-surface mt-0.5">
                ${spottedCount} of ${allTargets.length} Showpiece Wonders Spotted
              </h2>
            </div>
            <span class="font-label text-sm font-extrabold text-chart-moon">${passportPct}%</span>
          </div>

          <div class="w-full h-2.5 bg-dark-surface rounded-full overflow-hidden border border-dark-outline/70">
            <div
              class="h-full bg-gradient-to-r from-accent to-emerald-400 transition-all duration-500"
              style="width: ${Math.max(5, passportPct)}%"
            ></div>
          </div>

          <!-- 14 Mini Stamp Chips -->
          <div class="flex flex-wrap gap-1.5 pt-0.5">
            ${allTargets
              .map((t) => {
                const done = spottedIds.has(t.id);
                const selected = t.id === selectedTargetId;
                const shortTitle = t.name.split('·')[0].trim();
                return `
                <button
                  type="button"
                  data-stamp-id="${t.id}"
                  class="px-2.5 py-1 rounded-xl border text-[10.5px] font-label font-semibold flex items-center gap-1 tap-scale ${
                    selected
                      ? 'ring-2 ring-accent bg-accent/20 border-accent text-dark-on-surface'
                      : done
                        ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                        : 'bg-dark-surface/65 border-dark-outline/70 text-dark-on-surface-variant'
                  }"
                >
                  <span>${done ? '✓' : '○'}</span>
                  <span>${shortTitle}</span>
                </button>
              `;
              })
              .join('')}
          </div>
        </section>

        <!-- 2. QUICK FAMILY SIGHTING LOGGER -->
        <section class="glass-card rounded-3xl p-4 border border-dark-outline/90 space-y-3.5">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-extrabold text-dark-on-surface">Log a Telescope Sighting</h2>
            <span class="text-[10.5px] font-label text-celestron">
              ${state?.currentHour?.tempF ?? 54}°F · Seeing ${state?.currentHour?.seeing ?? 4}/5
            </span>
          </div>

          <!-- Target Selector -->
          <div class="space-y-1">
            <label class="text-[11px] font-label text-dark-on-surface-variant">What did you spot?</label>
            <select
              id="log-target-select"
              class="w-full bg-dark-surface border border-dark-outline rounded-2xl px-3 py-2.5 text-xs font-bold text-dark-on-surface focus:outline-none focus:border-accent"
            >
              ${allTargets
                .map(
                  (t) => `
                <option value="${t.id}" ${t.id === selectedTargetId ? 'selected' : ''}>
                  ${t.name} (${t.category})
                </option>
              `
                )
                .join('')}
            </select>
          </div>

          <!-- Family Wow Stars + Who Spotted -->
          <div class="grid grid-cols-2 gap-2.5">
            <div class="bg-dark-surface/70 rounded-2xl p-2.5 border border-dark-outline/70">
              <div class="text-[10px] font-label text-dark-on-surface-variant mb-1">Family "Wow" Rating</div>
              <div class="flex items-center gap-1">
                ${[1, 2, 3, 4, 5]
                  .map(
                    (star) => `
                  <button
                    type="button"
                    data-wow="${star}"
                    class="text-lg leading-none tap-scale ${
                      star <= wowRating ? 'text-chart-moon' : 'text-slate-600'
                    }"
                  >
                    ★
                  </button>
                `
                  )
                  .join('')}
              </div>
            </div>

            <div class="bg-dark-surface/70 rounded-2xl p-2.5 border border-dark-outline/70">
              <div class="text-[10px] font-label text-dark-on-surface-variant mb-1">Crew</div>
              <select
                id="log-who-select"
                class="w-full bg-transparent text-xs font-bold text-dark-on-surface focus:outline-none"
              >
                ${WHO_OPTIONS.map(
                  (w) => `<option value="${w}" class="bg-dark-surface" ${w === whoSpotted ? 'selected' : ''}>${w}</option>`
                ).join('')}
              </select>
            </div>
          </div>

          <!-- Eyepiece & Observing Site -->
          <div class="grid grid-cols-2 gap-2.5">
            <div>
              <label class="text-[10.5px] font-label text-dark-on-surface-variant">8SE Eyepiece</label>
              <select
                id="log-ep-select"
                class="mt-1 w-full bg-dark-surface border border-dark-outline rounded-2xl px-2.5 py-2 text-xs font-semibold text-dark-on-surface focus:outline-none focus:border-accent"
              >
                ${DEFAULT_EYEPIECES.map(
                  (ep) => `
                  <option value="${ep.focal_length_mm}" ${ep.focal_length_mm === eyepieceMm ? 'selected' : ''}>
                    ${ep.short_name} (${Math.round(2032 / ep.focal_length_mm)}x)
                  </option>
                `
                ).join('')}
              </select>
            </div>

            <div>
              <label class="text-[10.5px] font-label text-dark-on-surface-variant">Observing Spot</label>
              <select
                id="log-site-select"
                class="mt-1 w-full bg-dark-surface border border-dark-outline rounded-2xl px-2.5 py-2 text-xs font-semibold text-dark-on-surface focus:outline-none focus:border-accent"
              >
                ${LOCATION_OPTIONS.map(
                  (loc) => `<option value="${loc}" ${loc === locationChoice ? 'selected' : ''}>${loc}</option>`
                ).join('')}
              </select>
            </div>
          </div>

          <!-- Family Notes -->
          <div>
            <label class="text-[10.5px] font-label text-dark-on-surface-variant">Memory / What It Looked Like</label>
            <textarea
              id="log-notes-input"
              rows="2"
              placeholder="e.g., Kids saw Saturn's rings and Titan right away in the 12mm eyepiece!"
              class="mt-1 w-full bg-dark-surface border border-dark-outline rounded-2xl p-3 text-xs text-dark-on-surface placeholder:text-dark-on-surface-variant/50 focus:outline-none focus:border-accent"
            ></textarea>
          </div>

          <!-- Optional Collapsible Eyepiece Sketchpad -->
          <div class="border border-dark-outline/70 rounded-2xl overflow-hidden bg-dark-surface/50">
            <button
              id="btn-toggle-sketch"
              type="button"
              class="w-full px-3 py-2.5 flex items-center justify-between text-xs font-semibold text-dark-on-surface-variant hover:text-dark-on-surface"
            >
              <span class="flex items-center gap-1.5">
                <span class="material-symbols-outlined text-accent text-[16px]">draw</span>
                <span>Eyepiece Sketchpad (Optional for Kids &amp; Sketchers)</span>
              </span>
              <span class="material-symbols-outlined text-[18px]">${sketchOpen ? 'expand_less' : 'expand_more'}</span>
            </button>

            ${
              sketchOpen
                ? `<div class="p-3 border-t border-dark-outline/70 space-y-2.5">
                    <div class="mx-auto w-full max-w-[240px] aspect-square">
                      <canvas
                        id="eyepiece-sketch-canvas"
                        width="320"
                        height="320"
                        class="w-full h-full rounded-full border-2 border-slate-700 bg-[#05070c] touch-none cursor-crosshair"
                      ></canvas>
                    </div>
                    <div class="flex items-center justify-between gap-2">
                      <div class="flex items-center gap-1.5">
                        <button type="button" data-brush="#f8fafc" class="w-6 h-6 rounded-full bg-slate-100 border-2 ${brushColor === '#f8fafc' ? 'border-accent scale-110' : 'border-transparent'}"></button>
                        <button type="button" data-brush="#fbbf24" class="w-6 h-6 rounded-full bg-amber-400 border-2 ${brushColor === '#fbbf24' ? 'border-accent scale-110' : 'border-transparent'}"></button>
                        <button type="button" data-brush="#38bdf8" class="w-6 h-6 rounded-full bg-sky-400 border-2 ${brushColor === '#38bdf8' ? 'border-accent scale-110' : 'border-transparent'}"></button>
                      </div>
                      <button id="btn-clear-sketch" type="button" class="text-[11px] font-label text-dark-on-surface-variant hover:text-rose-300 px-2 py-1 rounded-lg bg-dark-surface-container-high">
                        Clear Pad
                      </button>
                    </div>
                  </div>`
                : ''
            }
          </div>

          <button
            id="btn-save-log"
            type="button"
            class="w-full bg-accent text-dark-surface font-extrabold text-sm py-3 px-4 rounded-2xl flex items-center justify-center gap-1.5 shadow-lg shadow-accent/15 tap-scale"
          >
            <span class="material-symbols-outlined text-[19px]">verified</span>
            <span>Stamp ${currentTarget?.name.split('·')[0].trim() || 'Sighting'} in Family Passport</span>
          </button>
        </section>

        <!-- 3. SAVED SIGHTINGS HISTORY -->
        <section class="space-y-2.5">
          <div class="flex items-center justify-between px-0.5">
            <h2 class="text-xs font-label font-bold uppercase tracking-wider text-dark-on-surface-variant">
              Saved Family Sightings (${logs.length})
            </h2>
            <button id="btn-export-json" type="button" class="text-[11px] font-label font-semibold text-accent hover:underline">
              Backup JSON ↓
            </button>
          </div>

          <div class="space-y-3">
            ${logs
              .map((log) => {
                const dateStr = new Date(log.timestamp || Date.now()).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
                const stars = '★'.repeat(log.family_wow_rating || 5);
                return `
                <article class="glass-card rounded-3xl p-4 border border-dark-outline/80 space-y-2.5">
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <div class="flex items-center gap-1.5 text-[10.5px] font-label text-celestron font-bold">
                        <span>${log.session_number || '#001'}</span>
                        <span>·</span>
                        <span>${dateStr}</span>
                        <span>·</span>
                        <span>${log.who_spotted || 'Whole Family'}</span>
                      </div>
                      <h3 class="text-sm font-extrabold text-dark-on-surface mt-0.5">${log.target_object}</h3>
                      <div class="text-[11px] font-label text-dark-on-surface-variant">
                        ${log.optics?.eyepiece || '25mm Stock (81x)'} · ${log.location || 'Burlington, NC'}
                      </div>
                    </div>
                    <span class="text-xs text-chart-moon shrink-0">${stars}</span>
                  </div>

                  ${
                    log.sketch_image_base64
                      ? `<div class="flex justify-center py-1">
                          <img src="${log.sketch_image_base64}" alt="Eyepiece Sketch" class="w-28 h-28 rounded-full border border-dark-outline object-cover" />
                        </div>`
                      : ''
                  }

                  ${
                    log.notes
                      ? `<p class="text-xs leading-relaxed text-dark-on-surface/90 bg-dark-surface/65 rounded-2xl p-3 border border-dark-outline/50">
                          ${log.notes}
                        </p>`
                      : ''
                  }

                  <div class="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      data-share-card="${log.id}"
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/15 border border-accent/40 text-accent text-[11px] font-label font-bold tap-scale"
                    >
                      <span class="material-symbols-outlined text-[15px]">ios_share</span>
                      <span>Souvenir Card PNG</span>
                    </button>

                    <button
                      type="button"
                      data-delete-log="${log.id}"
                      class="text-[11px] font-label text-dark-on-surface-variant hover:text-rose-400 px-2 py-1"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              `;
              })
              .join('')}
          </div>
        </section>
      </div>
    `;

    // Initialize optional Sketchpad Canvas if open
    const sketchCanvas = container.querySelector('#eyepiece-sketch-canvas');
    if (sketchCanvas) {
      const ctx = sketchCanvas.getContext('2d');
      function resetSketchBg() {
        ctx.fillStyle = '#05070c';
        ctx.fillRect(0, 0, 320, 320);
        ctx.beginPath();
        ctx.arc(160, 160, 150, 0, Math.PI * 2);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.stroke();
        hasDrawnStrokes = false;
      }
      resetSketchBg();

      let drawing = false;
      const getPt = (e) => {
        const rect = sketchCanvas.getBoundingClientRect();
        return {
          x: ((e.clientX - rect.left) / rect.width) * 320,
          y: ((e.clientY - rect.top) / rect.height) * 320,
        };
      };

      sketchCanvas.addEventListener('pointerdown', (e) => {
        drawing = true;
        hasDrawnStrokes = true;
        const p = getPt(e);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        sketchCanvas.setPointerCapture?.(e.pointerId);
      });

      sketchCanvas.addEventListener('pointermove', (e) => {
        if (!drawing) return;
        const p = getPt(e);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = brushColor;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      });

      sketchCanvas.addEventListener('pointerup', () => {
        drawing = false;
      });

      container.querySelector('#btn-clear-sketch')?.addEventListener('click', resetSketchBg);

      container.querySelectorAll('[data-brush]').forEach((b) => {
        b.addEventListener('click', () => {
          brushColor = b.getAttribute('data-brush') || '#f8fafc';
          container.querySelectorAll('[data-brush]').forEach((el) => {
            const act = el.getAttribute('data-brush') === brushColor;
            el.classList.toggle('border-accent', act);
            el.classList.toggle('scale-110', act);
            el.classList.toggle('border-transparent', !act);
          });
        });
      });
    }

    // Wire Form & Passport Controls
    container.querySelector('#btn-journal-red')?.addEventListener('click', () => {
      actions.toggleNightVision();
      renderView();
    });

    container.querySelectorAll('[data-stamp-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedTargetId = btn.getAttribute('data-stamp-id') || 'saturn';
        actions.selectTarget(selectedTargetId);
        const t = catalog.targets[selectedTargetId];
        if (t?.best_eyepiece_mm) eyepieceMm = t.best_eyepiece_mm;
        renderView();
      });
    });

    container.querySelector('#log-target-select')?.addEventListener('change', (e) => {
      selectedTargetId = e.target.value;
      actions.selectTarget(selectedTargetId);
      const t = catalog.targets[selectedTargetId];
      if (t?.best_eyepiece_mm) eyepieceMm = t.best_eyepiece_mm;
      renderView();
    });

    container.querySelectorAll('[data-wow]').forEach((btn) => {
      btn.addEventListener('click', () => {
        wowRating = Number(btn.getAttribute('data-wow') || 5);
        renderView();
      });
    });

    container.querySelector('#log-who-select')?.addEventListener('change', (e) => {
      whoSpotted = e.target.value;
    });

    container.querySelector('#log-ep-select')?.addEventListener('change', (e) => {
      eyepieceMm = Number(e.target.value || 25);
    });

    container.querySelector('#log-site-select')?.addEventListener('change', (e) => {
      locationChoice = e.target.value;
    });

    container.querySelector('#btn-toggle-sketch')?.addEventListener('click', () => {
      sketchOpen = !sketchOpen;
      renderView();
    });

    container.querySelector('#btn-save-log')?.addEventListener('click', () => {
      const target = catalog.targets[selectedTargetId] || allTargets[0];
      const notesVal = container.querySelector('#log-notes-input')?.value?.trim() || '';
      const sketchData =
        sketchOpen && hasDrawnStrokes && sketchCanvas
          ? sketchCanvas.toDataURL('image/png')
          : null;

      actions.saveLog({
        target_id: target.id,
        target_object: target.name,
        target_code: target.id.toUpperCase(),
        apparent_magnitude: target.apparent_magnitude,
        family_wow_rating: wowRating,
        who_spotted: whoSpotted,
        location: locationChoice,
        eyepiece_mm: eyepieceMm,
        filter: filterChoice,
        reducer_active: Boolean(state?.hasReducer),
        barlow_active: Boolean(state?.hasBarlow),
        notes: notesVal || `Spotted ${target.name.split('·')[0].trim()} through our NexStar 8SE!`,
        sketch_image_base64: sketchData,
        sky_conditions_snapshot: {
          seeing: `Steady ${state?.currentHour?.seeing ?? 4}/5`,
          seeing_rating: Number(state?.currentHour?.seeing ?? 4),
          transparency: state?.currentHour?.transparency || 'Above Average',
          temp_f: Number(state?.currentHour?.tempF ?? 54),
          humidity_pct: Number(state?.currentHour?.humidity ?? 60),
          nelm: parseFloat(state?.currentHour?.nelm || '5.9') || 5.9,
        },
      });

      sketchOpen = false;
      hasDrawnStrokes = false;
      toastMessage = `Stamped ${target.name.split('·')[0].trim()} into your Family Sky Passport!`;
      renderView();
      setTimeout(() => {
        toastMessage = '';
      }, 3500);
    });

    container.querySelectorAll('[data-share-card]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-share-card');
        const entry = logs.find((l) => l.id === id);
        if (entry) {
          await exportSketchAsPng(entry);
        }
      });
    });

    container.querySelectorAll('[data-delete-log]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-delete-log');
        if (id) {
          actions.deleteLog(id);
          renderView();
        }
      });
    });

    container.querySelector('#btn-export-json')?.addEventListener('click', async () => {
      await exportLogbookAsJson();
    });
  }

  renderView();
}

export default renderObservationLogScreen;
