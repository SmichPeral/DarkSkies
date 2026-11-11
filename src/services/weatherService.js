/**
 * @fileoverview Weather & Clear Dark Sky Forecast Service for Burlington, NC (BrlngtnNC)
 * Combines live ClearDarkSky (CMC GEM / Allan Rahill & Attilla Danko) HTML image-map scraping with
 * Open-Meteo Multi-Model (CMC GEM Seamless + ECMWF IFS 0.25° + Best Match + Air Quality)
 * and NOAA GOES-East satellite imagery.
 *
 * Works seamlessly inside a native Capacitor Android APK (via CapacitorHttp)
 * and in desktop/mobile web browsers (via direct CORS APIs + CORS proxy fallbacks),
 * with full offline caching in localStorage (`burlington_sky_cache_v2`).
 */

import {
  BURLINGTON_NC,
  computeHourlyDarkness,
  getSolarLunarData,
  getMoonPosition,
  formatEasternTime12h,
} from './astronomyEngine.js';

export const CACHE_KEY = 'burlington_sky_cache_v2';
export const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes fresh window

export const BURLINGTON_STATION = {
  station_id: 'BrlngtnNC',
  station_name: 'Burlington, NC',
  county: 'Alamance County',
  coordinates: {
    lat: BURLINGTON_NC.lat,
    lon: BURLINGTON_NC.lon,
    elevation_m: BURLINGTON_NC.elevation_m,
  },
  bortle_class: BURLINGTON_NC.bortle_class,
  base_nelm: BURLINGTON_NC.baseline_nelm,
  timezone: BURLINGTON_NC.timezone,
  cds_key_url: 'https://www.cleardarksky.com/c/BrlngtnNCkey.html?1',
  cds_gif_url: 'https://www.cleardarksky.com/c/BrlngtnNCcsk.gif',
};

/**
 * Authentic ClearDarkSky (CMC) Color Palette Tokens
 */
export const CDS_COLOR_PALETTE = {
  TIER_5_EXCELLENT: '#003E7E',
  TIER_4_5: '#135393',
  TIER_4_GOOD: '#2C6CAC',
  TIER_3_5: '#3F81C1',
  TIER_3_AVERAGE: '#63A3E3',
  TIER_2_5: '#77B7B7',
  TIER_2_BELOW_AVG: '#95D5D5',
  TIER_1_POOR: '#C7C7C7',
  TIER_0_OVERCAST: '#F0F0F0',

  DARKNESS_DEEP: '#020612',
  DARKNESS_5_5: '#040B29',
  DARKNESS_5_0: '#091A4E',
  DARKNESS_4_5: '#102C75',
  DARKNESS_4_0: '#1B4598',
  DARKNESS_TWILIGHT: '#2C6CAC',
  DARKNESS_DUSK_DAWN: '#6BAED6',
  DARKNESS_DAY: '#FDE68A',

  SMOKE_NONE: '#003E7E',
  SMOKE_LOW: '#2C6CAC',
  SMOKE_MOD: '#63A3E3',
  SMOKE_HIGH: '#95D5D5',
  SMOKE_VERY_HIGH: '#D4A359',
  SMOKE_EXTREME: '#C86432',

  WIND_CALM: '#003E7E',
  WIND_LIGHT: '#2C6CAC',
  WIND_BREEZY: '#63A3E3',
  WIND_WINDY: '#95D5D5',
  WIND_GALE: '#C7C7C7',
  WIND_STORM: '#F0F0F0',

  HUMIDITY_DRY: '#003E7E',
  HUMIDITY_COMFORT: '#2C6CAC',
  HUMIDITY_MODERATE: '#63A3E3',
  HUMIDITY_HUMID: '#95D5D5',
  HUMIDITY_DEW_RISK: '#C7C7C7',
  HUMIDITY_SATURATED: '#E06666',

  TEMP_FREEZING: '#7B2CBF',
  TEMP_COLD: '#003E7E',
  TEMP_CHILLY: '#2C6CAC',
  TEMP_COOL: '#0096C7',
  TEMP_MILD: '#06D6A0',
  TEMP_WARM: '#FFD166',
  TEMP_HOT: '#F77F00',
  TEMP_EXTREME: '#D62828',
};

/**
 * Nearby North Carolina Family Stargazing & Dark-Sky Escape Sites
 */
export const NEARBY_NC_SITES = [
  {
    id: 'cane-creek',
    name: 'Cane Creek Mountains Natural Area',
    short_name: 'Cane Creek Mtn',
    lat: 35.9320,
    lon: -79.3650,
    distance_mi: 12,
    drive_minutes: 20,
    drive_time: '20 min S',
    direction: 'S',
    distance_label: '12 mi S · 20 min',
    bortle_class: 4,
    base_nelm: 6.1,
    family_perk: 'Highest ridge in Alamance Co. — blocks I-40/85 skyglow right down the road.',
  },
  {
    id: 'haw-river',
    name: 'Haw River State Park',
    short_name: 'Haw River SP',
    lat: 36.2528,
    lon: -79.7562,
    distance_mi: 18,
    drive_minutes: 25,
    drive_time: '25 min NW',
    direction: 'NW',
    distance_label: '18 mi NW · 25 min',
    bortle_class: 4,
    base_nelm: 6.0,
    family_perk: 'Wide northern horizons away from Burlington & Greensboro streetlights.',
  },
  {
    id: 'jordan-lake',
    name: 'Jordan Lake (Vista Point / Ebenezer)',
    short_name: 'Jordan Lake',
    lat: 35.7431,
    lon: -79.0195,
    distance_mi: 34,
    drive_minutes: 42,
    drive_time: '42 min SE',
    direction: 'SE',
    distance_label: '34 mi SE · 42 min',
    bortle_class: 3,
    base_nelm: 6.4,
    family_perk: 'Huge open water horizon & darker Bortle 3-4 skies — great Milky Way & galaxy boost.',
  },
  {
    id: 'staunton-river',
    name: 'Staunton River State Park (IDA Dark Sky)',
    short_name: 'Staunton River IDA',
    lat: 36.6965,
    lon: -78.6758,
    distance_mi: 60,
    drive_minutes: 75,
    drive_time: '1 hr 15m NE',
    direction: 'NE',
    distance_label: '60 mi NE · 75 min',
    bortle_class: 2,
    base_nelm: 6.8,
    family_perk: 'Certified International Dark Sky Park — jaw-dropping edge-to-edge Milky Way!',
  },
];

// ============================================================================
// COLOR & LABEL MAPPING UTILITIES
// ============================================================================

export function mapCloudToCds(cloudPct, isEcmwf = false) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(cloudPct) || 0)));
  const rounded10 = Math.round(pct / 10) * 10;

  let color = CDS_COLOR_PALETTE.TIER_5_EXCELLENT;
  if (pct <= 5) color = CDS_COLOR_PALETTE.TIER_5_EXCELLENT;
  else if (pct <= 15) color = CDS_COLOR_PALETTE.TIER_4_5;
  else if (pct <= 25) color = CDS_COLOR_PALETTE.TIER_4_GOOD;
  else if (pct <= 40) color = CDS_COLOR_PALETTE.TIER_3_5;
  else if (pct <= 55) color = CDS_COLOR_PALETTE.TIER_3_AVERAGE;
  else if (pct <= 70) color = CDS_COLOR_PALETTE.TIER_2_5;
  else if (pct <= 85) color = CDS_COLOR_PALETTE.TIER_2_BELOW_AVG;
  else if (pct <= 94) color = CDS_COLOR_PALETTE.TIER_1_POOR;
  else color = CDS_COLOR_PALETTE.TIER_0_OVERCAST;

  let label;
  if (isEcmwf) {
    label = pct <= 5 ? 'Clear Sky' : pct >= 95 ? 'Overcast' : `${pct}% Clouds`;
  } else {
    label = pct <= 5 ? 'Clear Sky' : pct >= 95 ? 'Overcast' : `${rounded10}% Clouds`;
  }

  return { pct, color, label };
}

export function mapTransparencyToCds(scoreOrLabel, cloudPct = 0) {
  if (typeof scoreOrLabel === 'string') {
    const lower = scoreOrLabel.toLowerCase();
    if (lower.includes('too cloudy')) {
      return { score: 1, color: CDS_COLOR_PALETTE.TIER_0_OVERCAST, label: 'Clouded Out' };
    }
    if (lower.includes('transparent')) {
      return { score: 5, color: CDS_COLOR_PALETTE.TIER_5_EXCELLENT, label: 'Crisp / Transparent' };
    }
    if (lower.includes('above average')) {
      return { score: 4, color: CDS_COLOR_PALETTE.TIER_4_GOOD, label: 'Above Average' };
    }
    if (lower.includes('below average')) {
      return { score: 2, color: CDS_COLOR_PALETTE.TIER_2_BELOW_AVG, label: 'Hazy' };
    }
    if (lower.includes('average')) {
      return { score: 3, color: CDS_COLOR_PALETTE.TIER_3_AVERAGE, label: 'Average' };
    }
    if (lower.includes('poor')) {
      return { score: 1, color: CDS_COLOR_PALETTE.TIER_1_POOR, label: 'Poor / Humid' };
    }
  }

  if (cloudPct >= 88) {
    return { score: 1, color: CDS_COLOR_PALETTE.TIER_0_OVERCAST, label: 'Clouded Out' };
  }

  const score = Math.max(1, Math.min(5, Math.round(Number(scoreOrLabel) || 3)));
  const lookup = {
    5: { score: 5, color: CDS_COLOR_PALETTE.TIER_5_EXCELLENT, label: 'Crisp / Transparent' },
    4: { score: 4, color: CDS_COLOR_PALETTE.TIER_4_GOOD, label: 'Above Average' },
    3: { score: 3, color: CDS_COLOR_PALETTE.TIER_3_AVERAGE, label: 'Average' },
    2: { score: 2, color: CDS_COLOR_PALETTE.TIER_2_BELOW_AVG, label: 'Hazy' },
    1: { score: 1, color: CDS_COLOR_PALETTE.TIER_1_POOR, label: 'Poor / Humid' },
  };
  return lookup[score];
}

export function mapSeeingToCds(scoreOrLabel, cloudPct = 0) {
  const fwhmByScore = { 5: 0.8, 4: 1.1, 3: 1.5, 2: 2.1, 1: 2.8 };

  if (typeof scoreOrLabel === 'string') {
    const lower = scoreOrLabel.toLowerCase();
    if (lower.includes('too cloudy')) {
      return { rating: 1, color: CDS_COLOR_PALETTE.TIER_0_OVERCAST, label: 'Clouded Out', fwhm: 2.5 };
    }
    if (lower.includes('5/5') || lower.includes('excellent')) {
      return { rating: 5, color: CDS_COLOR_PALETTE.TIER_5_EXCELLENT, label: 'Steady 5/5', fwhm: 0.8 };
    }
    if (lower.includes('4/5') || lower.includes('good')) {
      return { rating: 4, color: CDS_COLOR_PALETTE.TIER_4_GOOD, label: 'Steady 4/5', fwhm: 1.1 };
    }
    if (lower.includes('3/5') || lower.includes('average')) {
      return { rating: 3, color: CDS_COLOR_PALETTE.TIER_3_AVERAGE, label: 'Average 3/5', fwhm: 1.5 };
    }
    if (lower.includes('2/5') || lower.includes('poor')) {
      return { rating: 2, color: CDS_COLOR_PALETTE.TIER_2_BELOW_AVG, label: 'Wobbly 2/5', fwhm: 2.1 };
    }
    if (lower.includes('1/5') || lower.includes('bad')) {
      return { rating: 1, color: CDS_COLOR_PALETTE.TIER_1_POOR, label: 'Turbulent 1/5', fwhm: 2.8 };
    }
  }

  if (cloudPct >= 92) {
    return { rating: 1, color: CDS_COLOR_PALETTE.TIER_0_OVERCAST, label: 'Clouded Out', fwhm: 2.4 };
  }

  const rating = Math.max(1, Math.min(5, Math.round(Number(scoreOrLabel) || 3)));
  const lookup = {
    5: { rating: 5, color: CDS_COLOR_PALETTE.TIER_5_EXCELLENT, label: 'Steady 5/5', fwhm: fwhmByScore[5] },
    4: { rating: 4, color: CDS_COLOR_PALETTE.TIER_4_GOOD, label: 'Steady 4/5', fwhm: fwhmByScore[4] },
    3: { rating: 3, color: CDS_COLOR_PALETTE.TIER_3_AVERAGE, label: 'Average 3/5', fwhm: fwhmByScore[3] },
    2: { rating: 2, color: CDS_COLOR_PALETTE.TIER_2_BELOW_AVG, label: 'Wobbly 2/5', fwhm: fwhmByScore[2] },
    1: { rating: 1, color: CDS_COLOR_PALETTE.TIER_1_POOR, label: 'Turbulent 1/5', fwhm: fwhmByScore[1] },
  };
  return lookup[rating];
}

export function mapSmokeToCds(ugM3) {
  const val = Math.max(0, Math.round(Number(ugM3) || 0));
  if (val <= 2) return { ug_m3: val, color: CDS_COLOR_PALETTE.SMOKE_NONE, label: 'Clean Air' };
  if (val <= 7) return { ug_m3: val, color: CDS_COLOR_PALETTE.SMOKE_LOW, label: `Clean (${val} µg)` };
  if (val <= 15) return { ug_m3: val, color: CDS_COLOR_PALETTE.SMOKE_MOD, label: `Light Haze (${val} µg)` };
  if (val <= 35) return { ug_m3: val, color: CDS_COLOR_PALETTE.SMOKE_HIGH, label: `Smoke (${val} µg)` };
  if (val <= 70) return { ug_m3: val, color: CDS_COLOR_PALETTE.SMOKE_VERY_HIGH, label: `Heavy Smoke` };
  return { ug_m3: val, color: CDS_COLOR_PALETTE.SMOKE_EXTREME, label: `Dense Smoke` };
}

export function mapWindToCds(mph) {
  const speed = Math.max(0, Math.round(Number(mph) || 0));
  if (speed <= 5) return { mph: speed, range: 'Calm (0–5 mph)', color: CDS_COLOR_PALETTE.WIND_CALM };
  if (speed <= 11) return { mph: speed, range: 'Light (6–11 mph)', color: CDS_COLOR_PALETTE.WIND_LIGHT };
  if (speed <= 16) return { mph: speed, range: 'Breezy (12–16 mph)', color: CDS_COLOR_PALETTE.WIND_BREEZY };
  if (speed <= 28) return { mph: speed, range: 'Windy (17–28 mph)', color: CDS_COLOR_PALETTE.WIND_WINDY };
  if (speed <= 45) return { mph: speed, range: 'Gusty (29–45 mph)', color: CDS_COLOR_PALETTE.WIND_GALE };
  return { mph: speed, range: 'Gale (>45 mph)', color: CDS_COLOR_PALETTE.WIND_STORM };
}

export function mapHumidityToCds(pct) {
  const rh = Math.max(0, Math.min(100, Math.round(Number(pct) || 50)));
  const lowBin = Math.min(95, Math.floor(rh / 5) * 5);
  const range = `${lowBin}%–${lowBin + 5}%`;

  let color = CDS_COLOR_PALETTE.HUMIDITY_COMFORT;
  if (rh < 40) color = CDS_COLOR_PALETTE.HUMIDITY_DRY;
  else if (rh < 55) color = CDS_COLOR_PALETTE.HUMIDITY_COMFORT;
  else if (rh < 70) color = CDS_COLOR_PALETTE.HUMIDITY_MODERATE;
  else if (rh < 85) color = CDS_COLOR_PALETTE.HUMIDITY_HUMID;
  else if (rh < 92) color = CDS_COLOR_PALETTE.HUMIDITY_DEW_RISK;
  else color = CDS_COLOR_PALETTE.HUMIDITY_SATURATED;

  return { pct: rh, range, color };
}

export function mapTempToCds(tempF) {
  const t = Math.round(Number(tempF) ?? 60);
  const lowBin = Math.floor(t / 9) * 9 + 5;
  const range = `${lowBin}°F–${lowBin + 9}°F`;

  let color = CDS_COLOR_PALETTE.TEMP_MILD;
  if (t < 25) color = CDS_COLOR_PALETTE.TEMP_FREEZING;
  else if (t < 35) color = CDS_COLOR_PALETTE.TEMP_COLD;
  else if (t < 45) color = CDS_COLOR_PALETTE.TEMP_CHILLY;
  else if (t < 55) color = CDS_COLOR_PALETTE.TEMP_COOL;
  else if (t < 68) color = CDS_COLOR_PALETTE.TEMP_MILD;
  else if (t < 80) color = CDS_COLOR_PALETTE.TEMP_WARM;
  else if (t < 90) color = CDS_COLOR_PALETTE.TEMP_HOT;
  else color = CDS_COLOR_PALETTE.TEMP_EXTREME;

  return { temp_f: t, range, color };
}

export function degreesToCardinal(deg) {
  if (deg === null || deg === undefined || Number.isNaN(Number(deg))) return 'CALM';
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = Math.round((((Number(deg) % 360) + 360) % 360) / 22.5) % 16;
  return dirs[idx];
}

/**
 * Maps astronomyEngine's computeHourlyDarkness() output into ClearDarkSky matrix colors
 */
function buildDarknessToken(dateObj, cloudPct = 0, scrapedDarknessEntry = null) {
  const engineDark = computeHourlyDarkness(dateObj, cloudPct);

  if (scrapedDarknessEntry && scrapedDarknessEntry.limiting_mag !== null && scrapedDarknessEntry.sun_alt !== null) {
    const sunAlt = scrapedDarknessEntry.sun_alt;
    const mag = scrapedDarknessEntry.limiting_mag;
    if (sunAlt <= -16.5) {
      let color = CDS_COLOR_PALETTE.DARKNESS_DEEP;
      if (mag >= 5.7) color = CDS_COLOR_PALETTE.DARKNESS_DEEP;
      else if (mag >= 5.2) color = CDS_COLOR_PALETTE.DARKNESS_5_5;
      else if (mag >= 4.7) color = CDS_COLOR_PALETTE.DARKNESS_5_0;
      else if (mag >= 4.2) color = CDS_COLOR_PALETTE.DARKNESS_4_5;
      else color = CDS_COLOR_PALETTE.DARKNESS_4_0;

      return {
        darkness_mag: Number(mag.toFixed(1)),
        darkness_color: color,
        darkness_numeric: Number(mag.toFixed(1)),
        is_night: true,
        sun_alt_deg: sunAlt,
        moon_alt_deg: engineDark.moon_alt_deg,
        moon_illum_pct: engineDark.moon_illum_pct,
      };
    }
  }

  let color = CDS_COLOR_PALETTE.DARKNESS_DEEP;
  if (engineDark.sun_alt_deg > -0.833) {
    color = CDS_COLOR_PALETTE.DARKNESS_DAY;
  } else if (engineDark.sun_alt_deg > -6.0) {
    color = CDS_COLOR_PALETTE.DARKNESS_DUSK_DAWN;
  } else if (engineDark.sun_alt_deg > -18.0) {
    color = CDS_COLOR_PALETTE.DARKNESS_TWILIGHT;
  } else {
    const mag = engineDark.limiting_magnitude;
    if (mag >= 5.7) color = CDS_COLOR_PALETTE.DARKNESS_DEEP;
    else if (mag >= 5.2) color = CDS_COLOR_PALETTE.DARKNESS_5_5;
    else if (mag >= 4.7) color = CDS_COLOR_PALETTE.DARKNESS_5_0;
    else if (mag >= 4.2) color = CDS_COLOR_PALETTE.DARKNESS_4_5;
    else color = CDS_COLOR_PALETTE.DARKNESS_4_0;
  }

  return {
    darkness_mag: engineDark.display_label === 'Day' || engineDark.display_label === 'Dusk' || engineDark.display_label === 'Dawn' || engineDark.display_label === 'Twil'
      ? engineDark.display_label
      : engineDark.limiting_magnitude,
    darkness_color: color,
    darkness_numeric: engineDark.limiting_magnitude,
    is_night: engineDark.is_astro_dark,
    sun_alt_deg: engineDark.sun_alt_deg,
    moon_alt_deg: engineDark.moon_alt_deg,
    moon_illum_pct: engineDark.moon_illum_pct,
  };
}

// ============================================================================
// 1. PRIMARY CLEARDARKSKY SCRAPER (`fetchClearDarkSkyChart()`)
// ============================================================================

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&deg;/gi, '°')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)));
}

async function fetchHtmlCrossPlatform(targetUrl, timeoutMs = 6000) {
  const sep = targetUrl.includes('?') ? '&' : '?';
  const bustUrl = `${targetUrl}${sep}_cb=${Date.now()}`;

  if (
    typeof window !== 'undefined' &&
    window.Capacitor?.Plugins?.CapacitorHttp
  ) {
    try {
      const response = await window.Capacitor.Plugins.CapacitorHttp.get({
        url: bustUrl,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Cache-Control': 'no-cache',
        },
        connectTimeout: timeoutMs,
        readTimeout: timeoutMs,
      });
      if (response && response.status >= 200 && response.status < 300 && response.data) {
        return typeof response.data === 'string'
          ? response.data
          : JSON.stringify(response.data);
      }
    } catch {
      // Fall through to CORS proxy fallback in browser preview
    }
  }

  const proxyCandidates = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
    `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
  ];

  let lastError = null;
  for (const proxyUrl of proxyCandidates) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(proxyUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'text/html,application/xhtml+xml,*/*' },
      });
      clearTimeout(timer);
      if (res.ok) {
        const html = await res.text();
        if (html && (html.includes('ckmap') || html.includes('<area') || html.includes('ClearDarkSky'))) {
          return html;
        }
      }
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
    }
  }

  throw lastError || new Error('Unable to fetch ClearDarkSky HTML.');
}

function parseCdsAreaRowItem(rowType, rawTitle, coords, href) {
  const title = decodeHtmlEntities(rawTitle).trim();
  const hourMatch = title.match(/^(\d{1,2}):(\d{2})/);
  const hour24 = hourMatch ? parseInt(hourMatch[1], 10) : null;
  const minute = hourMatch ? parseInt(hourMatch[2], 10) : 0;

  switch (rowType) {
    case 'cloud_gem': {
      let pct = 0;
      const pctMatch = title.match(/(\d+)\s*%\s*covered/i);
      if (/overcast/i.test(title)) pct = 100;
      else if (/clear/i.test(title)) pct = 0;
      else if (pctMatch) pct = parseInt(pctMatch[1], 10);

      const mapped = mapCloudToCds(pct, false);
      const runMatch = title.match(/\((\d{2}Z)[+-]\d+hr\)/i);
      return {
        hour24,
        title,
        coords,
        href,
        cloud_pct: mapped.pct,
        color: mapped.color,
        label: mapped.label,
        model_run: runMatch ? runMatch[1].toUpperCase() : null,
      };
    }

    case 'cloud_ecmwf': {
      let pct = 0;
      const pctMatch = title.match(/(\d+)\s*%/i);
      if (/overcast/i.test(title)) pct = 100;
      else if (/clear/i.test(title)) pct = 0;
      else if (pctMatch) pct = parseInt(pctMatch[1], 10);

      const mapped = mapCloudToCds(pct, true);
      return { hour24, title, coords, href, ecmwf_pct: mapped.pct, color: mapped.color, label: mapped.label };
    }

    case 'transparency': {
      const body = title.replace(/^\d{1,2}:\d{2}:\s*/, '');
      const mapped = mapTransparencyToCds(body);
      return { hour24, title, coords, href, transparency_score: mapped.score, color: mapped.color, label: mapped.label };
    }

    case 'seeing': {
      const body = title.replace(/^\d{1,2}:\d{2}:\s*/, '');
      const mapped = mapSeeingToCds(body);
      return {
        hour24,
        title,
        coords,
        href,
        seeing_rating: mapped.rating,
        seeing_fwhm: mapped.fwhm,
        color: mapped.color,
        label: mapped.label,
      };
    }

    case 'darkness': {
      const magMatch = title.match(/Limiting\s*Mag:\s*([+-]?\d+(?:\.\d+)?)/i);
      const sunMatch = title.match(/SunAlt:\s*([+-]?\d+(?:\.\d+)?)/i);
      return {
        hour24,
        minute,
        title,
        coords,
        href,
        limiting_mag: magMatch ? parseFloat(magMatch[1]) : null,
        sun_alt: sunMatch ? parseFloat(sunMatch[1]) : null,
      };
    }

    case 'smoke': {
      let ug = 0;
      const ugMatch = title.match(/(\d+(?:\.\d+)?)\s*ug\/m\^3/i);
      if (ugMatch) ug = parseFloat(ugMatch[1]);
      const mapped = mapSmokeToCds(ug);
      return { hour24, title, coords, href, smoke_ug_m3: mapped.ug_m3, color: mapped.color, label: mapped.label };
    }

    case 'wind': {
      const rangeMatch = title.match(/(\d+)\s*to\s*(\d+)\s*mph/i);
      const gtMatch = title.match(/>\s*(\d+)\s*mph/i);
      let mph = 4;
      if (rangeMatch) {
        mph = Math.round((parseInt(rangeMatch[1], 10) + parseInt(rangeMatch[2], 10)) / 2);
      } else if (gtMatch) {
        mph = parseInt(gtMatch[1], 10) + 5;
      }
      const mapped = mapWindToCds(mph);
      return { hour24, title, coords, href, wind_mph: mph, wind_mph_range: mapped.range, color: mapped.color };
    }

    case 'humidity': {
      const rhMatch = title.match(/(\d+)%\s*to\s*(\d+)%/i);
      const pct = rhMatch
        ? Math.round((parseInt(rhMatch[1], 10) + parseInt(rhMatch[2], 10)) / 2)
        : 58;
      const mapped = mapHumidityToCds(pct);
      return { hour24, title, coords, href, humidity_pct: pct, humidity_range: mapped.range, color: mapped.color };
    }

    case 'temperature': {
      const tempMatch = title.match(/(-?\d+)\s*F\s*to\s*(-?\d+)\s*F/i);
      const tempF = tempMatch
        ? Math.round((parseInt(tempMatch[1], 10) + parseInt(tempMatch[2], 10)) / 2)
        : 55;
      const mapped = mapTempToCds(tempF);
      return { hour24, title, coords, href, temp_f: tempF, temperature_range: mapped.range, color: mapped.color };
    }

    default:
      return { hour24, title, coords, href };
  }
}

export async function fetchClearDarkSkyChart() {
  const html = await fetchHtmlCrossPlatform(BURLINGTON_STATION.cds_key_url, 6000);

  const updatedMatch =
    html.match(/last\s+updated[^<]*?(\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}(?::\d{2})?)/i) ||
    html.match(/(?:updated|forecast\s+time)\s*:?\s*([A-Za-z]+\s+\d{1,2}[^<\n]{3,25})/i);
  const last_updated = updatedMatch ? updatedMatch[1].trim() : new Date().toISOString();

  const modelRunMatch = html.match(/\b(00Z|06Z|12Z|18Z)\b/i);
  let model_run = modelRunMatch ? modelRunMatch[1].toUpperCase() : null;

  const mapBlockMatch = html.match(/<map[^>]*name=["']?ckmap["']?[^>]*>([\s\S]*?)<\/map>/i);
  const mapContent = mapBlockMatch ? mapBlockMatch[1] : html;

  const rows = { 77: [], 93: [], 109: [], 125: [], 141: [], 189: [], 205: [], 221: [], 237: [] };
  const rowTypeByY1 = {
    77: 'cloud_gem',
    93: 'cloud_ecmwf',
    109: 'transparency',
    125: 'seeing',
    141: 'darkness',
    189: 'smoke',
    205: 'wind',
    221: 'humidity',
    237: 'temperature',
  };

  const areaRegex = /<area\b([^>]+)>/gi;
  let match;
  while ((match = areaRegex.exec(mapContent)) !== null) {
    const attrStr = match[1];
    const titleMatch = attrStr.match(/title=["']([^"']*)["']/i);
    const coordsMatch = attrStr.match(/coords=["'](\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)["']/i);
    const hrefMatch = attrStr.match(/href=["']([^"']*)["']/i);
    if (!titleMatch || !coordsMatch) continue;

    const x1 = parseInt(coordsMatch[1], 10);
    const y1 = parseInt(coordsMatch[2], 10);
    const x2 = parseInt(coordsMatch[3], 10);
    const y2 = parseInt(coordsMatch[4], 10);

    let matchedY = rows[y1] !== undefined ? y1 : null;
    if (matchedY === null) {
      for (const candidateY of Object.keys(rows).map(Number)) {
        if (Math.abs(y1 - candidateY) <= 3) {
          matchedY = candidateY;
          break;
        }
      }
    }

    if (matchedY !== null) {
      const parsed = parseCdsAreaRowItem(
        rowTypeByY1[matchedY],
        titleMatch[1],
        [x1, y1, x2, y2],
        hrefMatch ? hrefMatch[1] : ''
      );
      if (!model_run && parsed.model_run) model_run = parsed.model_run;
      rows[matchedY].push(parsed);
    }
  }

  for (const yKey of Object.keys(rows)) {
    rows[yKey].sort((a, b) => a.coords[0] - b.coords[0]);
  }

  const darknessHourly = [];
  if (rows[141].length > 0) {
    for (let i = 0; i < rows[141].length; i += 4) {
      const slice = rows[141].slice(i, i + 4);
      darknessHourly.push(slice[Math.floor(slice.length / 2)] || slice[0]);
    }
  }

  const totalAreas = Object.values(rows).reduce((acc, arr) => acc + arr.length, 0);
  if (totalAreas === 0) {
    throw new Error('ClearDarkSky HTML contained 0 valid <area> elements.');
  }

  return {
    station_id: BURLINGTON_STATION.station_id,
    last_updated,
    model_run: model_run || determineCurrentUtcModelRun(),
    by_category: {
      cloud_gem: rows[77],
      cloud_ecmwf: rows[93],
      transparency: rows[109],
      seeing: rows[125],
      darkness_hourly: darknessHourly,
      smoke: rows[189],
      wind: rows[205],
      humidity: rows[221],
      temperature: rows[237],
    },
  };
}

function determineCurrentUtcModelRun() {
  const utcHour = new Date().getUTCHours();
  if (utcHour >= 21 || utcHour < 3) return '18Z';
  if (utcHour >= 15) return '12Z';
  if (utcHour >= 9) return '06Z';
  return '00Z';
}

// ============================================================================
// 2. OPEN-METEO MULTI-MODEL FEED + 7-NIGHT OUTLOOK + NEARBY NC DARK SKIES
// ============================================================================

export const OPEN_METEO_FORECAST_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=36.096&longitude=-79.438&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,cloud_cover,visibility,wind_speed_10m,wind_direction_10m,wind_speed_250hPa&models=best_match,gem_seamless,ecmwf_ifs025&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FNew_York&forecast_days=7';

export const OPEN_METEO_AIR_QUALITY_URL =
  'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=36.096&longitude=-79.438&hourly=pm2_5,aerosol_optical_depth&timezone=America%2FNew_York&forecast_days=3';

async function fetchJsonWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const sep = url.includes('?') ? '&' : '?';
  const bustUrl = `${url}${sep}_cb=${Date.now()}`;
  try {
    const res = await fetch(bustUrl, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

function buildDefaultSiteRecord(site, cloudPct = 12, tempF = 54, rhPct = 60, windMph = 5) {
  const transpScore = cloudPct > 85 ? 1 : rhPct < 58 ? 5 : rhPct < 72 ? 4 : 3;
  const seeingScore = cloudPct > 90 ? 1 : windMph <= 6 ? 4 : windMph <= 12 ? 3 : 2;
  const cloudMapped = mapCloudToCds(cloudPct, false);
  const bortleBonus = (5 - site.bortle_class) * 4;
  const score = Math.max(
    8,
    Math.min(99, Math.round((100 - cloudPct) * 0.56 + transpScore * 5 + seeingScore * 4 + bortleBonus))
  );

  let rating = 'GOOD SKY';
  if (score >= 82 && cloudPct <= 20) rating = 'CLEAR & DARK';
  else if (score >= 60 && cloudPct <= 45) rating = 'MOSTLY CLEAR';
  else if (cloudPct <= 70) rating = 'PARTLY CLOUDY';
  else rating = 'CLOUDED OUT';

  return {
    ...site,
    cloud_pct: cloudPct,
    cloud_label: cloudMapped.label,
    cloud_color: cloudMapped.color,
    seeing_rating: seeingScore,
    transparency_score: transpScore,
    temp_f: tempF,
    humidity_pct: rhPct,
    wind_mph: windMph,
    limiting_magnitude: site.base_nelm,
    observing_score: score,
    rating,
  };
}

async function fetchNearbySitesLive() {
  const lats = NEARBY_NC_SITES.map((s) => s.lat).join(',');
  const lons = NEARBY_NC_SITES.map((s) => s.lon).join(',');
  const batchUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,relative_humidity_2m,cloud_cover,wind_speed_10m&hourly=cloud_cover,temperature_2m,relative_humidity_2m,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FNew_York&forecast_days=2`;

  try {
    const data = await fetchJsonWithTimeout(batchUrl, 7000);
    const resultsArray = Array.isArray(data) ? data : [data];

    return NEARBY_NC_SITES.map((site, idx) => {
      const siteData = resultsArray[idx] || resultsArray[0] || {};
      const hourly = siteData.hourly || {};
      const times = hourly.time || [];

      // Prefer tonight's evening stargazing window (20:00–22:00) over daytime clouds!
      let eveningIndices = [];
      for (let k = 0; k < Math.min(28, times.length); k++) {
        const hr = parseInt(String(times[k]).slice(11, 13), 10);
        if (hr >= 19 && hr <= 22) eveningIndices.push(k);
      }

      let cloudPct = Math.round(siteData.current?.cloud_cover ?? 15);
      let tempF = Math.round(siteData.current?.temperature_2m ?? 54);
      let rhPct = Math.round(siteData.current?.relative_humidity_2m ?? 60);
      let windMph = Math.round(siteData.current?.wind_speed_10m ?? 5);

      if (eveningIndices.length > 0 && Array.isArray(hourly.cloud_cover)) {
        const avg = (arr, fallback) =>
          Math.round(
            eveningIndices.reduce((sum, i) => sum + (arr?.[i] ?? fallback), 0) /
              eveningIndices.length
          );
        cloudPct = avg(hourly.cloud_cover, cloudPct);
        tempF = avg(hourly.temperature_2m, tempF);
        rhPct = avg(hourly.relative_humidity_2m, rhPct);
        windMph = avg(hourly.wind_speed_10m, windMph);
      }

      return buildDefaultSiteRecord(site, cloudPct, tempF, rhPct, windMph);
    });
  } catch {
    return NEARBY_NC_SITES.map((site) => buildDefaultSiteRecord(site, 12, 54, 60, 5));
  }
}

export async function fetchOpenMeteoData() {
  const [forecastRes, airQualityRes, nearbySites] = await Promise.all([
    fetchJsonWithTimeout(OPEN_METEO_FORECAST_URL, 8000),
    fetchJsonWithTimeout(OPEN_METEO_AIR_QUALITY_URL, 8000).catch(() => null),
    fetchNearbySitesLive(),
  ]);

  return {
    forecast: forecastRes,
    airQuality: airQualityRes,
    nearbySites,
    fetchedAt: new Date().toISOString(),
  };
}

// ============================================================================
// 3. TONIGHT'S FAMILY PLAN & 7-NIGHT OUTLOOK ANALYZERS
// ============================================================================

function pickHourlySeries(hourlyObj, baseKey, preferredSuffixes = []) {
  if (!hourlyObj) return [];
  for (const suffix of preferredSuffixes) {
    const candidate = `${baseKey}_${suffix}`;
    if (Array.isArray(hourlyObj[candidate])) return hourlyObj[candidate];
  }
  if (Array.isArray(hourlyObj[baseKey])) return hourlyObj[baseKey];
  return [];
}

function formatEasternHourLabels(isoTimestamp, fallbackDate) {
  let dateObj = fallbackDate;
  let hour24 = fallbackDate.getHours();

  if (typeof isoTimestamp === 'string' && isoTimestamp.includes('T')) {
    const [datePart, timePart] = isoTimestamp.split('T');
    const [y, m, d] = datePart.split('-').map(Number);
    const [hr] = timePart.split(':').map(Number);
    if (!Number.isNaN(hr)) {
      hour24 = hr;
      dateObj = new Date(y, m - 1, d, hr, 0, 0);
    }
  }

  const hour_short = String(hour24).padStart(2, '0');
  const hour_est = `${hour_short}:00`;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const day_short = days[dateObj.getDay()];
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const hr12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const hour_12h = `${hr12}:00 ${ampm}`;
  const hour_12h_compact = `${hr12}${hour24 >= 12 ? 'p' : 'a'}`;
  const day_label = `${day_short} ${hour_12h}`;

  return {
    hour24,
    hour_est,
    hour_short,
    hour_12h,
    hour_12h_compact,
    day_short,
    day_label,
    dateObj,
  };
}

function deriveTransparencyScore(aod, rhPct, visibilityM, cloudPct) {
  if (cloudPct >= 90) return 1;
  let score = 5;
  if (aod !== null && aod !== undefined) {
    if (aod > 0.45) score -= 2;
    else if (aod > 0.25) score -= 1.2;
    else if (aod > 0.14) score -= 0.5;
  }
  if (rhPct >= 90) score -= 2;
  else if (rhPct >= 80) score -= 1.2;
  else if (rhPct >= 68) score -= 0.5;
  if (visibilityM !== null && visibilityM !== undefined) {
    if (visibilityM < 8000) score -= 1.5;
    else if (visibilityM < 15000) score -= 0.7;
  }
  return Math.max(1, Math.min(5, Math.round(score)));
}

function deriveSeeingScore(jetStreamMph, surfaceWindMph, cloudPct) {
  if (cloudPct >= 92) return 1;
  let score = 5;
  if (jetStreamMph > 115) score -= 2.2;
  else if (jetStreamMph > 85) score -= 1.4;
  else if (jetStreamMph > 60) score -= 0.7;

  if (surfaceWindMph > 18) score -= 1.8;
  else if (surfaceWindMph > 12) score -= 1.0;
  else if (surfaceWindMph > 7) score -= 0.4;

  return Math.max(1, Math.min(5, Math.round(score)));
}

function computeHourObservingScore({
  cloud_pct,
  ecmwf_pct,
  transparency_score,
  seeing_rating,
  wind_mph,
  humidity_pct,
  smoke_ug_m3,
}) {
  const blendedCloud = cloud_pct * 0.65 + ecmwf_pct * 0.35;
  const cloudComponent = Math.max(0, 100 - blendedCloud * 1.15);
  const transpComponent = (transparency_score / 5) * 100;
  const seeingComponent = (seeing_rating / 5) * 100;
  const windPenalty = wind_mph > 15 ? Math.min(20, (wind_mph - 15) * 1.2) : 0;
  const dewPenalty = humidity_pct > 88 ? (humidity_pct - 88) * 1.2 : 0;
  const smokePenalty = smoke_ug_m3 > 10 ? Math.min(25, (smoke_ug_m3 - 10) * 0.8) : 0;

  const raw =
    cloudComponent * 0.52 +
    transpComponent * 0.26 +
    seeingComponent * 0.22 -
    windPenalty -
    dewPenalty -
    smokePenalty;

  return Math.max(0, Math.min(100, Math.round(raw)));
}

/**
 * Computes Tonight's Family Stargazing Verdict, Comfort Advice, Scope Cooldown Prep Time,
 * and Best Clear Sky Window (never mistaking daytime hours for dark sky!).
 */
export function computeTonightPlan(timeline48h = [], ephemeris = null) {
  const eph = ephemeris || getSolarLunarData(new Date());
  const isDaytimeNow = Boolean(eph.sun.is_daylight);

  // Tonight's evening family hours: dark or dusk hours within the next 18 hours, prioritizing 6 PM – 11 PM
  const upcomingDarkHours = timeline48h.filter(
    (h) => h.index < 18 && (h.is_night || h.sun_alt_deg <= -8)
  );
  const familyHours = upcomingDarkHours.filter(
    (h) => h.hour24 >= 17 && h.hour24 <= 22
  );
  const evalWindow = familyHours.length >= 2
    ? familyHours
    : upcomingDarkHours.length > 0
      ? upcomingDarkHours.slice(0, 4)
      : timeline48h.slice(0, 4);

  const avg = (fn) =>
    Math.round(evalWindow.reduce((sum, h) => sum + fn(h), 0) / Math.max(1, evalWindow.length));

  const avgCloud = avg((h) => h.blended_cloud_pct ?? h.cloud_pct ?? 15);
  const familyScore = avg((h) => h.hour_score ?? 75);
  const avgTempF = avg((h) => h.temp_f ?? 55);
  const avgSeeing = avg((h) => h.seeing_rating ?? 4);
  const maxWindMph = evalWindow.reduce((m, h) => Math.max(m, h.wind_mph ?? 4), 0);
  const peakNelm = Number(
    evalWindow.reduce((m, h) => Math.max(m, h.darkness_numeric || 0), 0).toFixed(1)
  ) || BURLINGTON_STATION.base_nelm;

  // Recommended default hour index to inspect (first clear evening hour tonight, or index 0 if night now)
  const primeEveningHour =
    familyHours.reduce((best, h) => (!best || h.hour_score > best.hour_score ? h : best), null) ||
    upcomingDarkHours[0] ||
    timeline48h[0];
  const recommendedHourIndex = isDaytimeNow && primeEveningHour ? primeEveningHour.index : 0;

  // Find longest/best contiguous clear dark run (blended cloud <= 32%) across the 48h timeline
  let bestRun = [];
  let currentRun = [];
  for (const h of timeline48h) {
    const c = h.blended_cloud_pct ?? h.cloud_pct ?? 0;
    if (h.is_night && c <= 32) {
      currentRun.push(h);
      if (currentRun.length > bestRun.length) bestRun = [...currentRun];
    } else {
      currentRun = [];
    }
  }

  let bestWindowLabel = 'Check Sky Map for cloud breaks';
  if (bestRun.length >= 1) {
    const startH = bestRun[0];
    const endH = bestRun[bestRun.length - 1];
    const endHour12 = formatEasternHourLabels(
      null,
      new Date(endH.date_ms ? endH.date_ms + 3600000 : Date.now())
    ).hour_12h;
    const dayPrefix = startH.index < 16 ? 'Tonight' : startH.day_short;
    bestWindowLabel = `${dayPrefix} ${startH.hour_12h} – ${endHour12} (${bestRun.length}h clear)`;
  }

  // Verdict & tone
  let verdict = 'GOOD BACKYARD NIGHT';
  let verdictTone = 'good'; // 'prime' | 'good' | 'fair' | 'poor'
  if (familyScore >= 80 && avgCloud <= 20) {
    verdict = 'PRIME FAMILY NIGHT';
    verdictTone = 'prime';
  } else if (familyScore >= 60 && avgCloud <= 42) {
    verdict = 'GOOD BACKYARD NIGHT';
    verdictTone = 'good';
  } else if (familyScore >= 40 && avgCloud <= 70) {
    verdict = 'CLOUD GAPS · PLANETS OK';
    verdictTone = 'fair';
  } else {
    verdict = 'CLOUDED OUT TONIGHT';
    verdictTone = 'poor';
  }

  // Family clothing & comfort callout
  let comfortAdvice = `Mild ${avgTempF}°F evening`;
  if (avgTempF < 38) {
    comfortAdvice = `Cold ${avgTempF}°F — bundle up with winter coats, hats & gloves`;
  } else if (avgTempF < 53) {
    comfortAdvice = `Crisp ${avgTempF}°F — grab hoodies or light jackets for the family`;
  } else if (avgTempF > 72) {
    comfortAdvice = `Warm ${avgTempF}°F Carolina night`;
  }

  // When to carry the NexStar 8SE outside before stargazing starts
  let scopePrepAdvice = 'Set your 8SE tube outside 35 min early so the 8" mirror cools down.';
  if (eph.sun.sunset_date) {
    const prepTime = formatEasternTime12h(new Date(eph.sun.sunset_date.getTime() + 10 * 60000));
    scopePrepAdvice = `Carry your 8SE outside around ${prepTime} so the mirror is crisp by ${eph.sun.nautical_dusk_12h}.`;
  }

  const duskStart12h = eph.sun.nautical_dusk_12h !== '--:--' ? eph.sun.nautical_dusk_12h : '6:15 PM';
  const moonNote =
    eph.moon.illumination_percent >= 55 && eph.moon.is_above_horizon
      ? `Bright ${eph.moon.illumination_percent}% Moon is awesome for crater tours (washes out faint galaxies).`
      : eph.moon.illumination_percent <= 25
        ? `Dark ${eph.moon.phase_name} skies (Mag ${peakNelm}) — ideal for nebulae, clusters & Andromeda!`
        : `${eph.moon.phase_name} (${eph.moon.illumination_percent}% lit) — great balance of Moon craters & star clusters.`;

  let familySummary = '';
  if (verdictTone === 'poor') {
    familySummary = `Heavy clouds (${avgCloud}%) over Burlington this evening. ${
      bestRun.length > 0 && bestRun[0].index >= 16
        ? `Next clear window arrives ${bestWindowLabel}.`
        : 'Keep the 8SE packed inside tonight and check the 7-Night Outlook below!'
    }`;
  } else if (isDaytimeNow) {
    familySummary = `Sun sets at ${eph.sun.sunset_12h}; family stargazing kicks off around ${duskStart12h} (${avgCloud}% evening clouds, ${maxWindMph} mph breeze). ${comfortAdvice}. ${moonNote}`;
  } else {
    familySummary = `Skies over Burlington are ${avgCloud <= 15 ? 'clear' : `${avgCloud}% cloudy`} right now (${avgTempF}°F, Seeing ${avgSeeing}/5). ${moonNote}`;
  }

  return {
    is_daytime_now: isDaytimeNow,
    verdict,
    verdict_tone: verdictTone,
    tonight_score: familyScore,
    evening_cloud_pct: avgCloud,
    evening_temp_f: avgTempF,
    evening_wind_mph: maxWindMph,
    evening_seeing: avgSeeing,
    peak_nelm: peakNelm,
    sunset_12h: eph.sun.sunset_12h,
    stargazing_start_12h: duskStart12h,
    family_window_label: `${duskStart12h} – 10:30 PM`,
    best_clear_window: bestWindowLabel,
    comfort_advice: comfortAdvice,
    scope_prep_advice: scopePrepAdvice,
    moon_note: moonNote,
    family_summary: familySummary,
    recommended_hour_index: recommendedHourIndex,
  };
}

/**
 * Builds a real 7-Night Family Stargazing Outlook from Open-Meteo 7-day hourly data
 * (evaluating 8 PM – 11 PM Eastern each evening + real lunar phase!)
 */
function buildSevenNightOutlook(timeArray = [], cloudSeries = [], tempSeries = [], windSeries = []) {
  const nights = [];
  const now = new Date();
  const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, 21, 0, 0);
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const datePrefix = `${yyyy}-${mm}-${dd}T`;

    const eveningIdxs = [];
    for (let i = 0; i < timeArray.length; i++) {
      const t = timeArray[i];
      if (typeof t === 'string' && t.startsWith(datePrefix)) {
        const hr = parseInt(t.slice(11, 13), 10);
        if (hr >= 20 && hr <= 23) eveningIdxs.push(i);
      }
    }

    let avgCloud = dayOffset === 0 ? 12 : (dayOffset * 19) % 65;
    let avgTemp = 54;
    let avgWind = 6;

    if (eveningIdxs.length > 0) {
      avgCloud = Math.round(
        eveningIdxs.reduce((s, idx) => s + (cloudSeries[idx] ?? 20), 0) / eveningIdxs.length
      );
      avgTemp = Math.round(
        eveningIdxs.reduce((s, idx) => s + (tempSeries[idx] ?? 54), 0) / eveningIdxs.length
      );
      avgWind = Math.round(
        eveningIdxs.reduce((s, idx) => s + (windSeries[idx] ?? 6), 0) / eveningIdxs.length
      );
    }

    const moon = getMoonPosition(targetDate);
    const score = Math.max(
      12,
      Math.min(98, Math.round(96 - avgCloud * 0.82 - Math.max(0, avgWind - 8) * 1.5))
    );

    let icon = 'star';
    let label = 'Clear';
    let tone = 'prime';
    if (avgCloud <= 20) {
      icon = 'auto_awesome';
      label = 'Clear';
      tone = 'prime';
    } else if (avgCloud <= 45) {
      icon = 'nights_stay';
      label = 'Mostly Clear';
      tone = 'good';
    } else if (avgCloud <= 72) {
      icon = 'partly_cloudy_night';
      label = 'Partly Cloudy';
      tone = 'fair';
    } else {
      icon = 'cloud';
      label = 'Cloudy';
      tone = 'poor';
    }

    nights.push({
      day_offset: dayOffset,
      day_label: dayOffset === 0 ? 'Tonight' : dayOffset === 1 ? 'Tomorrow' : daysShort[targetDate.getDay()],
      date_short: `${targetDate.getMonth() + 1}/${targetDate.getDate()}`,
      cloud_pct: avgCloud,
      temp_f: avgTemp,
      wind_mph: avgWind,
      score,
      label,
      icon,
      tone,
      moon_illum_pct: moon.illumination_percent,
      moon_phase: moon.phase_name,
    });
  }

  return nights;
}

export function buildSatelliteImageryUrls() {
  const cacheBust = Date.now();
  return {
    ir_band13: `https://cdn.star.nesdis.noaa.gov/GOES19/ABI/SECTOR/ne/13/1200x1200.jpg?t=${cacheBust}`,
    ir_band13_fallback: `https://cdn.star.nesdis.noaa.gov/GOES16/ABI/SECTOR/ne/13/1200x1200.jpg?t=${cacheBust}`,
    geocolor: `https://cdn.star.nesdis.noaa.gov/GOES19/ABI/SECTOR/ne/GEOCOLOR/1200x1200.jpg?t=${cacheBust}`,
    geocolor_fallback: `https://cdn.star.nesdis.noaa.gov/GOES16/ABI/SECTOR/ne/GEOCOLOR/1200x1200.jpg?t=${cacheBust}`,
    water_vapor: `https://cdn.star.nesdis.noaa.gov/GOES19/ABI/SECTOR/ne/09/1200x1200.jpg?t=${cacheBust}`,
    water_vapor_fallback: `https://cdn.star.nesdis.noaa.gov/GOES16/ABI/SECTOR/ne/09/1200x1200.jpg?t=${cacheBust}`,
    csk_gif_url: `https://www.cleardarksky.com/c/BrlngtnNCcsk.gif?t=${cacheBust}`,
  };
}

export function getCachedForecast() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.timeline_48h) && parsed.timeline_48h.length >= 24) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function saveCachedForecast(forecastObj) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(CACHE_KEY, JSON.stringify(forecastObj));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Shared 0ms / Offline Fallback Forecast Snapshot Builder
 * Used both on cold startup before live API resolves and when offline at a rural dark-sky site.
 */
export function buildFallbackForecastSnapshot() {
  const cached = getCachedForecast();
  if (cached) return cached;

  const now = new Date();
  now.setMinutes(0, 0, 0);
  const timeline_48h = [];

  for (let i = 0; i < 48; i++) {
    const dt = new Date(now.getTime() + i * 3600 * 1000);
    const iso = dt.toLocaleString('sv-SE', { timeZone: 'America/New_York' }).replace(' ', 'T');
    const labels = formatEasternHourLabels(iso, dt);

    const cloudPct = i % 14 < 9 ? 10 : 25;
    const ecmwfPct = i % 14 < 9 ? 8 : 22;
    const blendedCloud = Math.round(cloudPct * 0.6 + ecmwfPct * 0.4);
    const gemCloud = mapCloudToCds(cloudPct, false);
    const ecmwfCloud = mapCloudToCds(ecmwfPct, true);
    const transp = mapTransparencyToCds(4, cloudPct);
    const seeing = mapSeeingToCds(4, cloudPct);
    const darkness = buildDarknessToken(labels.dateObj, blendedCloud, null);
    const smoke = mapSmokeToCds(2);
    const wind = mapWindToCds(5);
    const humidity = mapHumidityToCds(58);
    const tempVal = Math.round(56 - Math.cos(((labels.hour24 - 15) / 24) * 2 * Math.PI) * 10);
    const dewVal = tempVal - 9;
    const temp = mapTempToCds(tempVal);
    const hour_score = computeHourObservingScore({
      cloud_pct: gemCloud.pct,
      ecmwf_pct: ecmwfCloud.pct,
      transparency_score: transp.score,
      seeing_rating: seeing.rating,
      wind_mph: wind.mph,
      humidity_pct: humidity.pct,
      smoke_ug_m3: smoke.ug_m3,
    });

    timeline_48h.push({
      index: i,
      timestamp: iso,
      date_ms: dt.getTime(),
      ...labels,
      cloud_pct: gemCloud.pct,
      cloud_gem_color: gemCloud.color,
      cloud_gem_label: gemCloud.label,
      ecmwf_pct: ecmwfCloud.pct,
      cloud_ecmwf_color: ecmwfCloud.color,
      cloud_ecmwf_label: ecmwfCloud.label,
      blended_cloud_pct: blendedCloud,
      blended_cloud_color: mapCloudToCds(blendedCloud, false).color,
      transparency_score: transp.score,
      transparency_color: transp.color,
      transparency_label: transp.label,
      seeing_rating: seeing.rating,
      seeing_color: seeing.color,
      seeing_label: seeing.label,
      seeing_fwhm: seeing.fwhm,
      ...darkness,
      smoke_ug_m3: smoke.ug_m3,
      smoke_color: smoke.color,
      smoke_label: smoke.label,
      wind_mph: wind.mph,
      wind_dir: 'NW',
      jet_stream_kts: 42,
      wind_mph_range: wind.range,
      wind_color: wind.color,
      humidity_pct: humidity.pct,
      humidity_range: humidity.range,
      humidity_color: humidity.color,
      temp_f: temp.temp_f,
      dew_point_f: dewVal,
      temperature_range: temp.range,
      temp_color: temp.color,
      hour_score,
    });
  }

  const ephemeris = getSolarLunarData(now);
  const tonight_plan = computeTonightPlan(timeline_48h, ephemeris);
  const first = timeline_48h[0];

  return {
    station_id: BURLINGTON_STATION.station_id,
    station_name: BURLINGTON_STATION.station_name,
    coordinates: BURLINGTON_STATION.coordinates,
    bortle_class: BURLINGTON_STATION.bortle_class,
    last_updated: now.toISOString(),
    model_run: determineCurrentUtcModelRun(),
    data_source: 'Offline Ephemeris Snapshot',
    is_live: false,
    tonight_plan,
    seven_night_outlook: buildSevenNightOutlook(),
    current_summary: {
      rating: tonight_plan.verdict,
      observing_score: tonight_plan.tonight_score,
      limiting_magnitude: tonight_plan.peak_nelm,
      cloud_coverage_percent: first.cloud_pct,
      cloud_label: first.cloud_gem_label,
      transparency: first.transparency_label,
      seeing: first.seeing_rating,
      seeing_label: first.seeing_label,
      seeing_fwhm_arcsec: first.seeing_fwhm,
      wind_mph: first.wind_mph,
      wind_dir: 'NW',
      jet_stream_kts: 42,
      humidity_percent: first.humidity_pct,
      temperature_f: first.temp_f,
      dew_point_f: first.dew_point_f,
      smoke_ug_m3: first.smoke_ug_m3,
      narrative: tonight_plan.family_summary,
    },
    timeline_48h,
    satellite: buildSatelliteImageryUrls(),
    nearby_sites: NEARBY_NC_SITES.map((s) => buildDefaultSiteRecord(s, 12, 54, 60, 5)),
  };
}

/**
 * Unified Hybrid 48-Hour + 7-Night Forecast Builder (`getBurlingtonSkyForecast()`)
 */
export async function getBurlingtonSkyForecast(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = getCachedForecast();
    if (cached && cached._cached_at && Date.now() - cached._cached_at < CACHE_TTL_MS) {
      return cached;
    }
  }

  const [cdsSettled, openMeteoSettled] = await Promise.allSettled([
    fetchClearDarkSkyChart(),
    fetchOpenMeteoData(),
  ]);

  const cdsData = cdsSettled.status === 'fulfilled' ? cdsSettled.value : null;
  const omData = openMeteoSettled.status === 'fulfilled' ? openMeteoSettled.value : null;

  if (!cdsData && !omData) {
    return buildFallbackForecastSnapshot();
  }

  const hourly = omData?.forecast?.hourly || {};
  const aqHourly = omData?.airQuality?.hourly || {};
  const timeArray = hourly.time || [];

  const nowEasternStr = new Date()
    .toLocaleString('sv-SE', { timeZone: 'America/New_York' })
    .slice(0, 13);
  const nowIsoPrefix = nowEasternStr.replace(' ', 'T');

  let startIdx = timeArray.findIndex((t) => typeof t === 'string' && t.startsWith(nowIsoPrefix));
  if (startIdx < 0) startIdx = 0;

  const tempSeries = pickHourlySeries(hourly, 'temperature_2m', ['best_match', 'gem_seamless', 'ecmwf_ifs025']);
  const rhSeries = pickHourlySeries(hourly, 'relative_humidity_2m', ['best_match', 'gem_seamless', 'ecmwf_ifs025']);
  const dewSeries = pickHourlySeries(hourly, 'dew_point_2m', ['best_match', 'gem_seamless', 'ecmwf_ifs025']);
  const cloudGemSeries = pickHourlySeries(hourly, 'cloud_cover', ['gem_seamless', 'best_match']);
  const cloudEcmwfSeries = pickHourlySeries(hourly, 'cloud_cover', ['ecmwf_ifs025', 'best_match']);
  const visSeries = pickHourlySeries(hourly, 'visibility', ['best_match', 'gem_seamless']);
  const windSpeedSeries = pickHourlySeries(hourly, 'wind_speed_10m', ['best_match', 'gem_seamless', 'ecmwf_ifs025']);
  const windDirSeries = pickHourlySeries(hourly, 'wind_direction_10m', ['best_match', 'gem_seamless']);
  const jetStreamSeries = pickHourlySeries(hourly, 'wind_speed_250hPa', ['best_match', 'ecmwf_ifs025', 'gem_seamless']);

  const pm25Series = Array.isArray(aqHourly.pm2_5) ? aqHourly.pm2_5 : [];
  const aodSeries = Array.isArray(aqHourly.aerosol_optical_depth) ? aqHourly.aerosol_optical_depth : [];

  const timeline_48h = [];
  const now = new Date();

  const currentEasternHour24 = parseInt(nowEasternStr.slice(11, 13), 10);
  let cdsStartIdx = 0;
  if (cdsData?.by_category?.cloud_gem?.length) {
    const foundIdx = cdsData.by_category.cloud_gem.findIndex(
      (item) => item && item.hour24 === currentEasternHour24
    );
    if (foundIdx >= 0) cdsStartIdx = foundIdx;
  }

  for (let i = 0; i < 48; i++) {
    const omIdx = startIdx + i;
    const cdsIdx = cdsStartIdx + i;
    const fallbackDt = new Date(now.getTime() + i * 3600 * 1000);
    const fallbackIso = fallbackDt
      .toLocaleString('sv-SE', { timeZone: 'America/New_York' })
      .replace(' ', 'T');
    const rawIso = timeArray[omIdx] || fallbackIso;
    const labels = formatEasternHourLabels(rawIso, fallbackDt);

    const cdsGemItem = cdsData?.by_category?.cloud_gem?.[cdsIdx] || null;
    const cdsEcmwfItem = cdsData?.by_category?.cloud_ecmwf?.[cdsIdx] || null;
    const cdsTranspItem = cdsData?.by_category?.transparency?.[cdsIdx] || null;
    const cdsSeeingItem = cdsData?.by_category?.seeing?.[cdsIdx] || null;
    const cdsDarknessItem = cdsData?.by_category?.darkness_hourly?.[cdsIdx] || null;
    const cdsSmokeItem = cdsData?.by_category?.smoke?.[cdsIdx] || null;
    const cdsWindItem = cdsData?.by_category?.wind?.[cdsIdx] || null;
    const cdsHumidityItem = cdsData?.by_category?.humidity?.[cdsIdx] || null;
    const cdsTempItem = cdsData?.by_category?.temperature?.[cdsIdx] || null;

    const rawGemCloud = cdsGemItem?.cloud_pct ?? cloudGemSeries[omIdx] ?? 15;
    const gemCloud = cdsGemItem
      ? { pct: cdsGemItem.cloud_pct, color: cdsGemItem.color, label: cdsGemItem.label }
      : mapCloudToCds(rawGemCloud, false);

    const rawEcmwfCloud = cdsEcmwfItem?.ecmwf_pct ?? cloudEcmwfSeries[omIdx] ?? rawGemCloud;
    const ecmwfCloud = cdsEcmwfItem
      ? { pct: cdsEcmwfItem.ecmwf_pct, color: cdsEcmwfItem.color, label: cdsEcmwfItem.label }
      : mapCloudToCds(rawEcmwfCloud, true);

    const blendedCloud = Math.round(gemCloud.pct * 0.6 + ecmwfCloud.pct * 0.4);

    const tempVal = Math.round(tempSeries[omIdx] ?? cdsTempItem?.temp_f ?? 56);
    const dewVal = Math.round(dewSeries[omIdx] ?? tempVal - 8);
    const rhVal = Math.round(rhSeries[omIdx] ?? cdsHumidityItem?.humidity_pct ?? 60);
    const windMphVal = Math.round(windSpeedSeries[omIdx] ?? cdsWindItem?.wind_mph ?? 5);
    const windDegVal = windDirSeries[omIdx] ?? 300;
    const jetMphVal = Math.round(jetStreamSeries[omIdx] ?? 52);
    const visVal = visSeries[omIdx] ?? 24000;
    const pm25Val = Math.round(pm25Series[omIdx] ?? cdsSmokeItem?.smoke_ug_m3 ?? 2);
    const aodVal = aodSeries[omIdx] ?? 0.1;

    const computedTranspScore = deriveTransparencyScore(aodVal, rhVal, visVal, blendedCloud);
    const transp = cdsTranspItem
      ? { score: cdsTranspItem.transparency_score, color: cdsTranspItem.color, label: cdsTranspItem.label }
      : mapTransparencyToCds(computedTranspScore, blendedCloud);

    const computedSeeingScore = deriveSeeingScore(jetMphVal, windMphVal, blendedCloud);
    const seeing = cdsSeeingItem
      ? {
          rating: cdsSeeingItem.seeing_rating,
          color: cdsSeeingItem.color,
          label: cdsSeeingItem.label,
          fwhm: cdsSeeingItem.seeing_fwhm,
        }
      : mapSeeingToCds(computedSeeingScore, blendedCloud);

    const darkness = buildDarknessToken(labels.dateObj, blendedCloud, cdsDarknessItem);
    const smoke = cdsSmokeItem
      ? { ug_m3: cdsSmokeItem.smoke_ug_m3, color: cdsSmokeItem.color, label: cdsSmokeItem.label }
      : mapSmokeToCds(pm25Val);
    const wind = mapWindToCds(windMphVal);
    const humidity = mapHumidityToCds(rhVal);
    const temp = mapTempToCds(tempVal);

    const hour_score = computeHourObservingScore({
      cloud_pct: gemCloud.pct,
      ecmwf_pct: ecmwfCloud.pct,
      transparency_score: transp.score,
      seeing_rating: seeing.rating,
      wind_mph: wind.mph,
      humidity_pct: humidity.pct,
      smoke_ug_m3: smoke.ug_m3,
    });

    timeline_48h.push({
      index: i,
      timestamp: rawIso,
      date_ms: fallbackDt.getTime(),
      ...labels,
      cloud_pct: gemCloud.pct,
      cloud_gem_color: gemCloud.color,
      cloud_gem_label: gemCloud.label,
      ecmwf_pct: ecmwfCloud.pct,
      cloud_ecmwf_color: ecmwfCloud.color,
      cloud_ecmwf_label: ecmwfCloud.label,
      blended_cloud_pct: blendedCloud,
      blended_cloud_color: mapCloudToCds(blendedCloud, false).color,
      transparency_score: transp.score,
      transparency_color: transp.color,
      transparency_label: transp.label,
      seeing_rating: seeing.rating,
      seeing_color: seeing.color,
      seeing_label: seeing.label,
      seeing_fwhm: seeing.fwhm,
      ...darkness,
      smoke_ug_m3: smoke.ug_m3,
      smoke_color: smoke.color,
      smoke_label: smoke.label,
      wind_mph: wind.mph,
      wind_dir: degreesToCardinal(windDegVal),
      jet_stream_kts: Math.round(jetMphVal * 0.868976),
      wind_mph_range: wind.range,
      wind_color: wind.color,
      humidity_pct: humidity.pct,
      humidity_range: humidity.range,
      humidity_color: humidity.color,
      temp_f: temp.temp_f,
      dew_point_f: dewVal,
      temperature_range: temp.range,
      temp_color: temp.color,
      hour_score,
    });
  }

  const ephemeris = getSolarLunarData(now);
  const tonight_plan = computeTonightPlan(timeline_48h, ephemeris);
  const seven_night_outlook = buildSevenNightOutlook(
    timeArray,
    cloudGemSeries,
    tempSeries,
    windSpeedSeries
  );

  const currentHour = timeline_48h[0];
  const current_summary = {
    rating: tonight_plan.verdict,
    observing_score: tonight_plan.tonight_score,
    limiting_magnitude: tonight_plan.peak_nelm,
    cloud_coverage_percent: currentHour.blended_cloud_pct,
    cloud_label: currentHour.cloud_gem_label,
    transparency: currentHour.transparency_label,
    seeing: currentHour.seeing_rating,
    seeing_label: currentHour.seeing_label,
    seeing_fwhm_arcsec: currentHour.seeing_fwhm,
    wind_mph: currentHour.wind_mph,
    wind_dir: currentHour.wind_dir,
    jet_stream_kts: currentHour.jet_stream_kts,
    humidity_percent: currentHour.humidity_pct,
    temperature_f: currentHour.temp_f,
    dew_point_f: currentHour.dew_point_f,
    smoke_ug_m3: currentHour.smoke_ug_m3,
    narrative: tonight_plan.family_summary,
  };

  let dataSourceLabel = 'Open-Meteo GEM + ECMWF Live';
  if (cdsData && omData) dataSourceLabel = 'ClearDarkSky + GEM/ECMWF Live';
  else if (cdsData) dataSourceLabel = 'ClearDarkSky Live';

  const result = {
    station_id: BURLINGTON_STATION.station_id,
    station_name: BURLINGTON_STATION.station_name,
    coordinates: BURLINGTON_STATION.coordinates,
    elevation_m: BURLINGTON_STATION.coordinates.elevation_m,
    bortle_class: BURLINGTON_STATION.bortle_class,
    last_updated: cdsData?.last_updated || omData?.fetchedAt || now.toISOString(),
    model_run: cdsData?.model_run || determineCurrentUtcModelRun(),
    data_source: dataSourceLabel,
    is_live: true,
    _cached_at: Date.now(),
    tonight_plan,
    seven_night_outlook,
    current_summary,
    timeline_48h,
    satellite: buildSatelliteImageryUrls(),
    nearby_sites: omData?.nearbySites || NEARBY_NC_SITES.map((s) => buildDefaultSiteRecord(s, 12, 54, 60, 5)),
  };

  saveCachedForecast(result);
  return result;
}
