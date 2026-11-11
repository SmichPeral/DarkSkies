/**
 * Burlington Dark Skies — Family Celestial Passport Journal & Hardware Settings Persistence
 * Dedicated to Burlington, NC & Celestron NexStar 8SE
 *
 * Pure ES Module — Single Unified localStorage Schema (Zero Bloat)
 */

const STORAGE_KEYS = {
  OBS_LOGS: 'burlington_obs_logs_v1',
  LEGACY_LOGS: 'dark_skies_burlington_logs_v1',
  APP_SETTINGS: 'burlington_app_settings_v2',
};

/**
 * Generates an initial dark-field Andromeda sketch SVG data URL for the sample log entry
 */
function createDefaultM31SketchDataUrl() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    <defs>
      <radialGradient id="m31Core" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#fff8e7" stop-opacity="0.95"/>
        <stop offset="22%" stop-color="#d8e2ff" stop-opacity="0.65"/>
        <stop offset="58%" stop-color="#8fa8d6" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="#05070b" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="m32Core" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
        <stop offset="45%" stop-color="#bfd2ff" stop-opacity="0.45"/>
        <stop offset="100%" stop-color="#05070b" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="400" height="400" fill="#05070b"/>
    <circle cx="200" cy="200" r="184" fill="#070a10" stroke="#1e293b" stroke-width="2" stroke-dasharray="4 4"/>
    <g transform="translate(200 200) rotate(-38)">
      <ellipse cx="0" cy="0" rx="135" ry="42" fill="url(#m31Core)"/>
      <ellipse cx="0" cy="0" rx="52" ry="20" fill="url(#m31Core)"/>
      <path d="M -95 -14 Q -10 -24 90 -10" fill="none" stroke="#05070b" stroke-width="4.5" opacity="0.78"/>
    </g>
    <circle cx="252" cy="268" r="18" fill="url(#m32Core)"/>
    <circle cx="112" cy="118" r="1.5" fill="#e2e8f0" opacity="0.85"/>
    <circle cx="288" cy="105" r="1.8" fill="#cbd5e1" opacity="0.9"/>
    <circle cx="145" cy="290" r="1.3" fill="#94a3b8" opacity="0.75"/>
    <circle cx="95" cy="230" r="1.5" fill="#e2e8f0" opacity="0.8"/>
    <circle cx="310" cy="215" r="1.2" fill="#cbd5e1" opacity="0.7"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const SEED_OBSERVATION_LOG = {
  id: 'obs-seed-001',
  session_number: '#001',
  timestamp: '2026-10-24T21:15:00.000Z',
  location: 'Burlington, NC Backyard (Bortle 4)',
  target_id: 'm31',
  target_object: 'M31 · Andromeda Galaxy',
  target_code: 'M31',
  target_name: 'Andromeda Galaxy',
  family_wow_rating: 5,
  who_spotted: 'Whole Family',
  apparent_magnitude: '+3.4',
  optics: {
    ota: 'NexStar 8SE (f/10 · 2032mm)',
    eyepiece: '25mm Stock (81x · 0.62° FOV)',
    eyepiece_mm: 25,
    magnification: 81,
    tfov: '0.62°',
    filter: 'No Filter',
    reducer_active: false,
    barlow_active: false,
  },
  sky_conditions_snapshot: {
    seeing: 'Steady 4/5',
    seeing_rating: 4,
    transparency: 'Above Average',
    temp_f: 52,
    humidity_pct: 60,
    nelm: 5.9,
  },
  notes:
    'Bright glowing core jumped right out in the 25mm eyepiece! Everyone got a turn seeing light that left Andromeda 2.5 million years ago — plus little companion galaxy M32 tucked at 5 o\'clock.',
  sketch_image_base64: createDefaultM31SketchDataUrl(),
};

/**
 * Normalizes target code/string to one of the 14 canonical showpiece IDs when possible
 */
export function inferCanonicalTargetId(rawIdOrName = '') {
  const s = String(rawIdOrName).toLowerCase().trim();
  if (!s) return 'm31';
  if (s === 'm81_m82' || s.includes('m81') || s.includes('m82') || s.includes('bode')) return 'm81_m82';
  if (s === 'double_cluster' || s.includes('double cluster') || s.includes('869')) return 'double_cluster';
  const known = ['saturn', 'jupiter', 'moon', 'm42', 'm45', 'albireo', 'm13', 'm31', 'm57', 'mars', 'venus', 'm27'];
  for (const id of known) {
    if (s === id || s.startsWith(`${id} `) || s.startsWith(`${id}·`) || s.includes(id)) {
      return id;
    }
  }
  return s.replace(/[^a-z0-9_]/g, '') || 'custom';
}

/**
 * Retrieves all saved family stargazing logs from unified localStorage.
 * Automatically migrates any legacy split-key entries if present.
 */
export function getObservationLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.OBS_LOGS);
    let logs = raw ? JSON.parse(raw) : null;

    // One-time migration from legacy split key if present
    const legacyRaw = localStorage.getItem(STORAGE_KEYS.LEGACY_LOGS);
    if (legacyRaw) {
      try {
        const legacyArr = JSON.parse(legacyRaw);
        if (Array.isArray(legacyArr) && legacyArr.length > 0) {
          const existingIds = new Set((logs || []).map((l) => l.id));
          const migrated = legacyArr
            .filter((item) => item && !existingIds.has(item.id) && item.id !== 'seed_084_m31')
            .map((item) => ({
              id: item.id,
              session_number: item.sessionLabel || '#002',
              timestamp: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
              location: 'Burlington, NC Backyard (Bortle 4)',
              target_id: inferCanonicalTargetId(item.targetId || item.targetName),
              target_object: item.targetName || 'Celestial Target',
              target_code: String(item.targetId || 'OBS').toUpperCase(),
              family_wow_rating: 5,
              who_spotted: 'Whole Family',
              apparent_magnitude: String(item.targetMag || '').replace('Mag ', '') || '+4.0',
              optics: {
                ota: item.scope || 'NexStar 8SE',
                eyepiece: item.eyepieceLabel || '25mm Stock (81x)',
                eyepiece_mm: Number(item.eyepieceMm || 25),
                filter: item.filter || 'No Filter',
              },
              sky_conditions_snapshot: {
                seeing: item.seeing || '4/5',
                transparency: item.transparency || 'Above Average',
                temp_f: parseInt(String(item.temp || '54').replace(/[^\d-]/g, ''), 10) || 54,
                humidity_pct: parseInt(String(item.humidity || '60').replace(/[^\d]/g, ''), 10) || 60,
                nelm: parseFloat(item.nelm || '5.8') || 5.8,
              },
              notes: item.notes || '',
              sketch_image_base64: item.sketchDataUrl || null,
            }));
          logs = [...migrated, ...(logs || [SEED_OBSERVATION_LOG])];
          localStorage.setItem(STORAGE_KEYS.OBS_LOGS, JSON.stringify(logs));
        }
        localStorage.removeItem(STORAGE_KEYS.LEGACY_LOGS);
      } catch {
        // Ignore malformed legacy data
      }
    }

    if (!Array.isArray(logs) || logs.length === 0) {
      const initial = [SEED_OBSERVATION_LOG];
      localStorage.setItem(STORAGE_KEYS.OBS_LOGS, JSON.stringify(initial));
      return initial;
    }

    return logs.map((l) => ({
      ...l,
      target_id: l.target_id || inferCanonicalTargetId(l.target_code || l.target_object),
      family_wow_rating: Math.max(1, Math.min(5, Number(l.family_wow_rating || 5))),
      who_spotted: l.who_spotted || 'Whole Family',
    }));
  } catch {
    return [SEED_OBSERVATION_LOG];
  }
}

/**
 * Returns a Set of canonical target IDs that the family has already logged in their Passport
 */
export function getSpottedTargetIds() {
  const logs = getObservationLogs();
  const ids = new Set();
  for (const log of logs) {
    const tid = log.target_id || inferCanonicalTargetId(log.target_code || log.target_object);
    if (tid) ids.add(tid);
  }
  return ids;
}

export function getNextSessionNumber(existingLogs = null) {
  const logs = existingLogs || getObservationLogs();
  let maxNum = 0;
  for (const log of logs) {
    if (typeof log.session_number === 'string') {
      const match = log.session_number.match(/(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!Number.isNaN(num) && num < 80 && num > maxNum) {
          maxNum = num;
        } else if (!Number.isNaN(num) && num >= 80 && logs.length > 1 && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }
  if (maxNum === 0) maxNum = logs.length;
  return `#${String(maxNum + 1).padStart(3, '0')}`;
}

/**
 * Saves a new or updated family stargazing log entry
 */
export function saveObservationLog(entry = {}) {
  const logs = getObservationLogs();
  const existingIndex = entry.id ? logs.findIndex((item) => item.id === entry.id) : -1;

  const sessionNumber =
    entry.session_number ||
    (existingIndex >= 0 ? logs[existingIndex].session_number : getNextSessionNumber(logs));

  const id = entry.id || `obs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const timestamp = entry.timestamp || new Date().toISOString();

  const rawOptics = entry.optics || {};
  const eyepieceMm = Number(rawOptics.eyepiece_mm || entry.eyepiece_mm || 25);
  const reducerActive = Boolean(rawOptics.reducer_active ?? entry.reducer_active ?? false);
  const barlowActive = Boolean(rawOptics.barlow_active ?? entry.barlow_active ?? false);

  const factor = (reducerActive ? 0.63 : 1) * (barlowActive ? 2.0 : 1);
  const effectiveFocalLength = Math.round(2032 * factor);
  const effectiveFocalRatio = `f/${(10 * factor).toFixed(1).replace(/\.0$/, '')}`;
  const magnification = rawOptics.magnification || Math.round(effectiveFocalLength / eyepieceMm);
  const afov = eyepieceMm === 9 ? 82 : eyepieceMm === 12 ? 60 : eyepieceMm === 32 ? 52 : 50;
  const tfov = rawOptics.tfov || `${(afov / magnification).toFixed(2)}°`;

  const optics = {
    ota: rawOptics.ota || `NexStar 8SE (${effectiveFocalRatio} · ${effectiveFocalLength}mm)`,
    eyepiece: rawOptics.eyepiece || `${eyepieceMm}mm (${magnification}x · ${tfov} FOV)`,
    eyepiece_mm: eyepieceMm,
    magnification,
    tfov,
    filter: rawOptics.filter || entry.filter || 'No Filter',
    reducer_active: reducerActive,
    barlow_active: barlowActive,
  };

  const rawSky = entry.sky_conditions_snapshot || {};
  const sky_conditions_snapshot = {
    seeing: rawSky.seeing || 'Steady 4/5',
    seeing_rating: Number(rawSky.seeing_rating ?? 4),
    transparency: rawSky.transparency || 'Above Average',
    temp_f: Number(rawSky.temp_f ?? 54),
    humidity_pct: Number(rawSky.humidity_pct ?? 60),
    nelm: Number(rawSky.nelm ?? 5.9),
  };

  const targetObject = entry.target_object || 'M31 · Andromeda Galaxy';
  const targetId = entry.target_id || inferCanonicalTargetId(entry.target_code || targetObject);

  const record = {
    id,
    session_number: sessionNumber,
    timestamp,
    location: entry.location || 'Burlington, NC Backyard (Bortle 4)',
    target_id: targetId,
    target_object: targetObject,
    target_code:
      entry.target_code ||
      (targetObject.includes('·') ? targetObject.split('·')[0].trim() : targetId.toUpperCase()),
    target_name:
      entry.target_name ||
      (targetObject.includes('·') ? targetObject.split('·')[1].trim() : targetObject),
    family_wow_rating: Math.max(1, Math.min(5, Number(entry.family_wow_rating || 5))),
    who_spotted: entry.who_spotted || 'Whole Family',
    apparent_magnitude:
      entry.apparent_magnitude !== undefined && entry.apparent_magnitude !== null
        ? String(entry.apparent_magnitude)
        : '+3.4',
    optics,
    sky_conditions_snapshot,
    notes: entry.notes !== undefined ? String(entry.notes).trim() : '',
    sketch_image_base64: entry.sketch_image_base64 || null,
  };

  const updatedLogs =
    existingIndex >= 0
      ? logs.map((item, idx) => (idx === existingIndex ? record : item))
      : [record, ...logs];

  try {
    localStorage.setItem(STORAGE_KEYS.OBS_LOGS, JSON.stringify(updatedLogs));
  } catch (err) {
    console.error('[storageService] Failed to save observation log:', err);
  }

  return record;
}

export function deleteObservationLog(id) {
  const logs = getObservationLogs();
  const filtered = logs.filter((item) => item.id !== id);
  try {
    localStorage.setItem(STORAGE_KEYS.OBS_LOGS, JSON.stringify(filtered));
  } catch (err) {
    console.error('[storageService] Failed to delete observation log:', err);
  }
  return filtered;
}

export async function exportLogbookAsJson() {
  const logs = getObservationLogs();
  const exportPayload = {
    observatory: 'Burlington Dark Skies — Family Celestial Journal',
    location: 'Burlington, NC (36.096°N, 79.438°W · Bortle 4)',
    instrument: 'Celestron NexStar 8SE (203.2mm f/10 Schmidt-Cassegrain)',
    exported_at: new Date().toISOString(),
    total_sightings: logs.length,
    sightings: logs,
  };

  const jsonString = JSON.stringify(exportPayload, null, 2);
  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `burlington-family-sky-journal-${dateStamp}.json`;

  try {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const file = new File([blob], filename, { type: 'application/json' });

    if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: 'Burlington Dark Skies — Family Journal',
        text: `${logs.length} Celestron NexStar 8SE family stargazing sightings`,
        files: [file],
      });
      return { success: true, filename, count: logs.length, method: 'share' };
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1500);

    return { success: true, filename, count: logs.length, method: 'download' };
  } catch (err) {
    return { success: false, filename, count: logs.length, error: err?.message };
  }
}

/**
 * Exports a shareable Family Observation Souvenir Card PNG (with optional sketch or starfield crest)
 */
export async function exportSketchAsPng(entry) {
  const targetEntry = entry || getObservationLogs()[0] || SEED_OBSERVATION_LOG;
  const safeTarget = (targetEntry.target_code || 'sky')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  const filename = `burlington-8se-${safeTarget}-souvenir.png`;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = targetEntry.sketch_image_base64 ? 980 : 560;
    const ctx = canvas.getContext('2d');

    // Cosmic dark gradient card
    const bgGrad = ctx.createLinearGradient(0, 0, 800, canvas.height);
    bgGrad.addColorStop(0, '#0b1221');
    bgGrad.addColorStop(1, '#060910');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle decorative stars
    ctx.fillStyle = 'rgba(226,232,240,0.35)';
    for (let i = 0; i < 42; i++) {
      const sx = ((i * 193) % 740) + 30;
      const sy = ((i * 137) % (canvas.height - 60)) + 30;
      ctx.beginPath();
      ctx.arc(sx, sy, (i % 3) * 0.6 + 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Border frame
    ctx.strokeStyle = '#233146';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    // Header badge
    ctx.fillStyle = '#FF7A2F';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(
      `BURLINGTON DARK SKIES · CELESTRON NEXSTAR 8SE · ${targetEntry.who_spotted?.toUpperCase() || 'FAMILY SIGHTING'}`,
      48,
      62
    );

    // Target title & Wow stars
    ctx.fillStyle = '#EEF4FB';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText(targetEntry.target_object || 'Cosmic Sighting', 48, 106);

    const starsStr = '★'.repeat(targetEntry.family_wow_rating || 5) + '☆'.repeat(5 - (targetEntry.family_wow_rating || 5));
    ctx.fillStyle = '#FFD54F';
    ctx.font = '22px sans-serif';
    ctx.fillText(`${starsStr}  Family Wow`, 48, 142);

    ctx.fillStyle = '#00E5FF';
    ctx.font = '15px monospace';
    const opticsStr = targetEntry.optics?.eyepiece || '25mm Stock (81x)';
    const filterStr = targetEntry.optics?.filter || 'No Filter';
    ctx.fillText(`NexStar 8SE 8" SCT  |  ${opticsStr}  |  ${filterStr}`, 48, 174);

    let notesStartY = 230;

    if (targetEntry.sketch_image_base64) {
      await new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          ctx.save();
          ctx.beginPath();
          ctx.arc(400, 465, 245, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(img, 155, 220, 490, 490);
          ctx.restore();

          ctx.beginPath();
          ctx.arc(400, 465, 245, 0, Math.PI * 2);
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 3;
          ctx.stroke();
          resolve();
        };
        img.onerror = () => resolve();
        img.src = targetEntry.sketch_image_base64;
      });
      notesStartY = 765;
    }

    // Notes text wrap
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '20px sans-serif';
    const notesText = targetEntry.notes || 'Spotted from our backyard in Burlington, NC!';
    const words = notesText.split(' ');
    let line = '';
    let y = notesStartY;
    for (let i = 0; i < words.length; i++) {
      const testLine = `${line}${words[i]} `;
      if (ctx.measureText(testLine).width > 700 && i > 0) {
        ctx.fillText(line.trim(), 48, y);
        line = `${words[i]} `;
        y += 30;
      } else {
        line = testLine;
      }
    }
    if (line.trim()) ctx.fillText(line.trim(), 48, y);

    // Footer timestamp
    ctx.fillStyle = '#64748B';
    ctx.font = '14px monospace';
    const dateFormatted = new Date(targetEntry.timestamp || Date.now()).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
    ctx.fillText(
      `Logged ${dateFormatted} · ${targetEntry.location || 'Burlington, NC'} · ${targetEntry.sky_conditions_snapshot?.temp_f ?? 54}°F`,
      48,
      canvas.height - 44
    );

    const dataUrl = canvas.toDataURL('image/png');
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], filename, { type: 'image/png' });

    if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: `${targetEntry.target_object} — Family Sighting Card`,
        text: targetEntry.notes || 'Spotted in Burlington, NC with our Celestron NexStar 8SE!',
        files: [file],
      });
      return { success: true, filename, dataUrl, method: 'share' };
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1500);

    return { success: true, filename, dataUrl, method: 'download' };
  } catch (err) {
    return { success: false, filename, error: err?.message };
  }
}

// ============================================================================
// APP & NEXSTAR 8SE SETTINGS PERSISTENCE
// ============================================================================

export const DEFAULT_APP_SETTINGS = {
  nightVisionMode: false,
  nexstarIndoorTempF: 70,
  cooldownStartTimestamp: null, // Honest: null until user taps "Set Scope Outside"
  reducerActive: false,
  barlowActive: false,
  selectedEyepieceMm: 25,
  selectedFilter: 'No Filter',
  alignedStarNames: [],
};

export function getAppSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.APP_SETTINGS);
    if (!raw) {
      return { ...DEFAULT_APP_SETTINGS };
    }
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_APP_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

export function saveAppSettings(patch = {}) {
  const current = getAppSettings();
  const updated = { ...current, ...patch };
  try {
    localStorage.setItem(STORAGE_KEYS.APP_SETTINGS, JSON.stringify(updated));
  } catch (err) {
    console.error('[storageService] Failed to save app settings:', err);
  }
  return updated;
}
