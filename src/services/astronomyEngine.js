/**
 * Astronomy, Ephemeris & Celestron NexStar 8SE Optical Engine
 * Dedicated to Burlington, NC (36.096°N, -79.438°W · Bortle Class 4)
 *
 * Single source of truth for:
 * - Real-time Solar & Lunar positions, phases, twilight windows, and NELM darkness
 * - Keplerian planetary solver (Venus, Mars, Jupiter + Galilean moons, Saturn + ring tilt)
 * - 14 Curated Family & NexStar 8SE Showpiece Targets with live rise/peak/set & Bortle-4 scoring
 * - Burlington Overhead Sky Dome projection & constellation stick figures
 * - NexStar 8SE closed-tube thermal cooldown milestones, dew physics, eyepiece matrix & SkyAlign triangle solver
 */

export const BURLINGTON_NC = {
  name: 'Burlington, NC',
  county: 'Alamance County',
  lat: 36.096,
  lon: -79.438,
  elevation_m: 193,
  bortle_class: 4,
  baseline_nelm: 6.0,
  timezone: 'America/New_York',
};

export const NEXSTAR_8SE_SPECS = {
  model: 'Celestron NexStar 8SE',
  optical_design: 'Schmidt-Cassegrain (SCT)',
  coating: 'StarBright XLT',
  aperture_mm: 203.2,
  aperture_in: 8.0,
  focal_length_mm: 2032,
  native_focal_ratio: 10.0,
  visual_back_in: 1.25,
  dawes_limit_arcsec: 0.57,
  rayleigh_limit_arcsec: 0.69,
  light_grasp_vs_eye: 843,
  limiting_stellar_mag: 14.0,
  secondary_obstruction_pct_dia: 31.0,
  max_theoretical_mag: 400,
  min_useful_mag: 29,
  mount_type: 'Single Fork Arm Alt-Az GoTo',
};

export const DEFAULT_EYEPIECES = [
  {
    id: '32mm-plossl',
    name: '32mm Omni Plössl',
    short_name: '32mm Wide',
    focal_length_mm: 32,
    afov_deg: 52,
    barrel_in: 1.25,
    role: 'Max Wide Field',
    badge: 'Clusters & Sweeps',
  },
  {
    id: '25mm-plossl',
    name: '25mm E-Lux Plössl (Stock)',
    short_name: '25mm Stock',
    focal_length_mm: 25,
    afov_deg: 50,
    barrel_in: 1.25,
    role: 'Wide Field',
    badge: 'Nebulae & Galaxies',
  },
  {
    id: '12mm-plossl',
    name: '12mm Planetary (60°)',
    short_name: '12mm Planet',
    focal_length_mm: 12,
    afov_deg: 60,
    barrel_in: 1.25,
    role: 'Planetary & Globulars',
    badge: 'Jupiter & M13',
  },
  {
    id: '9mm-nagler',
    name: '9mm Ultra-Wide (82°)',
    short_name: '9mm High',
    focal_length_mm: 9,
    afov_deg: 82,
    barrel_in: 1.25,
    role: 'High Power',
    badge: 'Saturn & Moon Craters',
  },
];

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

function normalizeDegrees(deg) {
  return ((deg % 360) + 360) % 360;
}

export function toJulianDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return d.getTime() / 86400000 + 2440587.5;
}

export function toDaysSinceJ2000(date = new Date()) {
  return toJulianDate(date) - 2451545.0;
}

export function getGMSTDegrees(date = new Date()) {
  const jd = toJulianDate(date);
  const d = jd - 2451545.0;
  const T = d / 36525.0;
  const gmst =
    280.46061837 +
    360.98564736629 * d +
    0.000387933 * T * T -
    (T * T * T) / 38710000.0;
  return normalizeDegrees(gmst);
}

export function getLocalSiderealTime(date = new Date(), lon = BURLINGTON_NC.lon) {
  const lstDeg = normalizeDegrees(getGMSTDegrees(date) + lon);
  const totalHours = lstDeg / 15.0;
  const hours = Math.floor(totalHours);
  const minutesFloat = (totalHours - hours) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = Math.floor((minutesFloat - minutes) * 60);

  return {
    degrees: lstDeg,
    hours: totalHours,
    formatted: `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`,
    short: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} LST`,
  };
}

export function azimuthToCardinal(azDeg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(normalizeDegrees(azDeg) / 45) % 8;
  return dirs[idx];
}

export function equatorialToHorizontal(
  raDeg,
  decDeg,
  date = new Date(),
  lat = BURLINGTON_NC.lat,
  lon = BURLINGTON_NC.lon
) {
  const lstDeg = getLocalSiderealTime(date, lon).degrees;
  const haRad = normalizeDegrees(lstDeg - raDeg) * DEG2RAD;
  const decRad = decDeg * DEG2RAD;
  const latRad = lat * DEG2RAD;

  const sinAlt =
    Math.sin(decRad) * Math.sin(latRad) +
    Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
  const altRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

  const y = -Math.sin(haRad) * Math.cos(decRad);
  const x =
    Math.sin(decRad) * Math.cos(latRad) -
    Math.cos(decRad) * Math.sin(latRad) * Math.cos(haRad);
  const azDeg = normalizeDegrees(Math.atan2(y, x) * RAD2DEG);
  const altDeg = altRad * RAD2DEG;

  return {
    altitude_deg: Number(altDeg.toFixed(2)),
    azimuth_deg: Number(azDeg.toFixed(2)),
    cardinal: azimuthToCardinal(azDeg),
  };
}

/**
 * Formats a Date into 24-hour ("18:38") and friendly 12-hour ("6:38 PM") Eastern Time
 */
export function formatEasternTimeHHMM(date) {
  if (!date) return '--:--';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: BURLINGTON_NC.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
}

export function formatEasternTime12h(date) {
  if (!date) return '--:--';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: BURLINGTON_NC.timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    const h = date.getHours();
    const m = String(date.getMinutes()).padStart(2, '0');
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
  }
}

// ============================================================================
// 1. SOLAR & LUNAR EPHEMERIS
// ============================================================================

export function getSunPosition(
  date = new Date(),
  lat = BURLINGTON_NC.lat,
  lon = BURLINGTON_NC.lon
) {
  const d = toDaysSinceJ2000(date);
  const L = normalizeDegrees(280.460 + 0.9856474 * d);
  const g = normalizeDegrees(357.528 + 0.9856003 * d);
  const gRad = g * DEG2RAD;

  const lambda = L + 1.915 * Math.sin(gRad) + 0.020 * Math.sin(2 * gRad);
  const lambdaRad = lambda * DEG2RAD;
  const eps = (23.439 - 0.0000004 * d) * DEG2RAD;

  const raDeg = normalizeDegrees(
    Math.atan2(Math.cos(eps) * Math.sin(lambdaRad), Math.cos(lambdaRad)) * RAD2DEG
  );
  const decDeg = Math.asin(Math.sin(eps) * Math.sin(lambdaRad)) * RAD2DEG;
  const horiz = equatorialToHorizontal(raDeg, decDeg, date, lat, lon);

  return {
    ra_deg: raDeg,
    dec_deg: decDeg,
    ecliptic_lon_deg: normalizeDegrees(lambda),
    ...horiz,
  };
}

function getLunarPhaseName(elongationDeg) {
  const deg = normalizeDegrees(elongationDeg);
  if (deg < 11.25 || deg >= 348.75) return 'New Moon';
  if (deg < 78.75) return 'Waxing Crescent';
  if (deg < 101.25) return 'First Quarter';
  if (deg < 168.75) return 'Waxing Gibbous';
  if (deg < 191.25) return 'Full Moon';
  if (deg < 258.75) return 'Waning Gibbous';
  if (deg < 281.25) return 'Last Quarter';
  return 'Waning Crescent';
}

export function getMoonPosition(
  date = new Date(),
  lat = BURLINGTON_NC.lat,
  lon = BURLINGTON_NC.lon
) {
  const d = toDaysSinceJ2000(date);

  const L0 = normalizeDegrees(218.316 + 13.176396 * d);
  const M = normalizeDegrees(134.963 + 13.064993 * d);
  const F = normalizeDegrees(93.272 + 13.229350 * d);
  const D = normalizeDegrees(297.850 + 12.190749 * d);
  const Ms = normalizeDegrees(357.529 + 0.985600 * d);

  const Mrad = M * DEG2RAD;
  const Frad = F * DEG2RAD;
  const Drad = D * DEG2RAD;
  const Msrad = Ms * DEG2RAD;

  const lambda =
    L0 +
    6.289 * Math.sin(Mrad) +
    1.274 * Math.sin(2 * Drad - Mrad) +
    0.658 * Math.sin(2 * Drad) +
    0.214 * Math.sin(2 * Mrad) -
    0.186 * Math.sin(Msrad) -
    0.114 * Math.sin(2 * Frad);

  const beta =
    5.128 * Math.sin(Frad) +
    0.280 * Math.sin(Mrad + Frad) +
    0.277 * Math.sin(Mrad - Frad) +
    0.173 * Math.sin(2 * Drad - Frad);

  const lambdaRad = lambda * DEG2RAD;
  const betaRad = beta * DEG2RAD;
  const eps = (23.439 - 0.0000004 * d) * DEG2RAD;

  const sinDec =
    Math.sin(betaRad) * Math.cos(eps) +
    Math.cos(betaRad) * Math.sin(eps) * Math.sin(lambdaRad);
  const decDeg = Math.asin(Math.max(-1, Math.min(1, sinDec))) * RAD2DEG;

  const y = Math.sin(lambdaRad) * Math.cos(eps) - Math.tan(betaRad) * Math.sin(eps);
  const x = Math.cos(lambdaRad);
  const raDeg = normalizeDegrees(Math.atan2(y, x) * RAD2DEG);

  const geocentricHoriz = equatorialToHorizontal(raDeg, decDeg, date, lat, lon);
  const topocentricAlt =
    geocentricHoriz.altitude_deg - 0.95 * Math.cos(geocentricHoriz.altitude_deg * DEG2RAD);

  const sun = getSunPosition(date, lat, lon);
  const elongationDeg = normalizeDegrees(lambda - sun.ecliptic_lon_deg);
  const phaseAngleRad = elongationDeg * DEG2RAD;
  const illuminationFraction = (1 - Math.cos(phaseAngleRad)) / 2;
  const illuminationPercent = Math.round(illuminationFraction * 100);
  const phaseName = getLunarPhaseName(elongationDeg);

  // Sky glow penalty on Burlington's baseline Bortle 4 (6.0 NELM) ONLY when Moon is above horizon
  let skyGlowPenalty = 0;
  if (topocentricAlt > 0) {
    const altFactor = Math.sin(Math.max(5, topocentricAlt) * DEG2RAD);
    const illumFactor = Math.pow(illuminationFraction, 1.35);
    skyGlowPenalty = Number((2.3 * illumFactor * (0.35 + 0.65 * altFactor)).toFixed(2));
  }

  return {
    ra_deg: raDeg,
    dec_deg: decDeg,
    altitude_deg: Number(topocentricAlt.toFixed(2)),
    azimuth_deg: geocentricHoriz.azimuth_deg,
    cardinal: geocentricHoriz.cardinal,
    phase_angle: Number(elongationDeg.toFixed(1)),
    illumination_percent: illuminationPercent,
    illumination_fraction: Number(illuminationFraction.toFixed(3)),
    phase_name: phaseName,
    age_days: Number(((elongationDeg / 360) * 29.53059).toFixed(1)),
    sky_glow_mag_penalty: skyGlowPenalty,
  };
}

function findAltitudeCrossing(altFn, startTimeMs, endTimeMs, targetAltDeg, direction) {
  const stepMs = 5 * 60 * 1000;
  let prevT = startTimeMs;
  let prevAlt = altFn(new Date(prevT)) - targetAltDeg;

  for (let t = startTimeMs + stepMs; t <= endTimeMs; t += stepMs) {
    const currAlt = altFn(new Date(t)) - targetAltDeg;
    const isRising = prevAlt <= 0 && currAlt > 0;
    const isSetting = prevAlt >= 0 && currAlt < 0;

    if (
      (direction === 'rising' && isRising) ||
      (direction === 'setting' && isSetting)
    ) {
      let lo = prevT;
      let hi = t;
      for (let i = 0; i < 8; i++) {
        const mid = 0.5 * (lo + hi);
        const midVal = altFn(new Date(mid)) - targetAltDeg;
        if ((prevAlt <= 0 && midVal <= 0) || (prevAlt >= 0 && midVal >= 0)) {
          lo = mid;
        } else {
          hi = mid;
        }
      }
      return new Date(0.5 * (lo + hi));
    }
    prevT = t;
    prevAlt = currAlt;
  }
  return null;
}

export function getSolarLunarData(
  date = new Date(),
  lat = BURLINGTON_NC.lat,
  lon = BURLINGTON_NC.lon
) {
  const refDate = date instanceof Date ? date : new Date(date);
  const sunNow = getSunPosition(refDate, lat, lon);
  const moonNow = getMoonPosition(refDate, lat, lon);

  const anchorMs = refDate.getTime();
  const searchEnd = anchorMs + 26 * 3600 * 1000;

  const sunAltFn = (d) => getSunPosition(d, lat, lon).altitude_deg;
  const moonAltFn = (d) => getMoonPosition(d, lat, lon).altitude_deg;

  const eveningStart = anchorMs - 10 * 3600 * 1000;
  const morningEnd = anchorMs + 24 * 3600 * 1000;

  const sunsetDate = findAltitudeCrossing(sunAltFn, eveningStart, morningEnd, -0.833, 'setting');
  const civilDuskDate = findAltitudeCrossing(sunAltFn, eveningStart, morningEnd, -6.0, 'setting');
  const nauticalDuskDate = findAltitudeCrossing(sunAltFn, eveningStart, morningEnd, -12.0, 'setting');
  const astroDuskDate = findAltitudeCrossing(sunAltFn, eveningStart, morningEnd, -18.0, 'setting');

  const dawnSearchStart = astroDuskDate ? astroDuskDate.getTime() : anchorMs;
  const dawnSearchEnd = dawnSearchStart + 18 * 3600 * 1000;

  const astroDawnDate = findAltitudeCrossing(sunAltFn, dawnSearchStart, dawnSearchEnd, -18.0, 'rising');
  const nauticalDawnDate = findAltitudeCrossing(sunAltFn, dawnSearchStart, dawnSearchEnd, -12.0, 'rising');
  const civilDawnDate = findAltitudeCrossing(sunAltFn, dawnSearchStart, dawnSearchEnd, -6.0, 'rising');
  const sunriseDate = findAltitudeCrossing(sunAltFn, dawnSearchStart, dawnSearchEnd, -0.833, 'rising');

  const nextMoonRiseDate = findAltitudeCrossing(
    moonAltFn,
    anchorMs - 2 * 3600 * 1000,
    searchEnd,
    0.125,
    'rising'
  );
  const nextMoonSetDate = findAltitudeCrossing(
    moonAltFn,
    anchorMs - 2 * 3600 * 1000,
    searchEnd,
    0.125,
    'setting'
  );

  let darkDurationHours = 0;
  if (astroDuskDate && astroDawnDate) {
    darkDurationHours = Number(
      ((astroDawnDate.getTime() - astroDuskDate.getTime()) / 3600000).toFixed(1)
    );
  }

  const effectiveNelm = Number(
    Math.max(3.4, BURLINGTON_NC.baseline_nelm - moonNow.sky_glow_mag_penalty).toFixed(1)
  );

  return {
    location: BURLINGTON_NC,
    timestamp: refDate.toISOString(),
    lst: getLocalSiderealTime(refDate, lon),
    sun: {
      altitude_deg: sunNow.altitude_deg,
      azimuth_deg: sunNow.azimuth_deg,
      cardinal: sunNow.cardinal,
      sunset: formatEasternTimeHHMM(sunsetDate),
      sunset_12h: formatEasternTime12h(sunsetDate),
      sunset_date: sunsetDate,
      civil_dusk: formatEasternTimeHHMM(civilDuskDate),
      civil_dusk_12h: formatEasternTime12h(civilDuskDate),
      nautical_dusk: formatEasternTimeHHMM(nauticalDuskDate),
      nautical_dusk_12h: formatEasternTime12h(nauticalDuskDate),
      astronomical_dusk: formatEasternTimeHHMM(astroDuskDate),
      astronomical_dusk_12h: formatEasternTime12h(astroDuskDate),
      astro_dusk_date: astroDuskDate,
      astronomical_dawn: formatEasternTimeHHMM(astroDawnDate),
      astronomical_dawn_12h: formatEasternTime12h(astroDawnDate),
      astro_dawn_date: astroDawnDate,
      nautical_dawn: formatEasternTimeHHMM(nauticalDawnDate),
      civil_dawn: formatEasternTimeHHMM(civilDawnDate),
      sunrise: formatEasternTimeHHMM(sunriseDate),
      sunrise_12h: formatEasternTime12h(sunriseDate),
      dark_window_hours: darkDurationHours,
      is_astronomical_night: sunNow.altitude_deg <= -18.0,
      is_twilight: sunNow.altitude_deg > -18.0 && sunNow.altitude_deg <= -0.833,
      is_daylight: sunNow.altitude_deg > -0.833,
    },
    moon: {
      phase_angle: moonNow.phase_angle,
      illumination_percent: moonNow.illumination_percent,
      phase_name: moonNow.phase_name,
      age_days: moonNow.age_days,
      altitude_deg: moonNow.altitude_deg,
      azimuth_deg: moonNow.azimuth_deg,
      cardinal: moonNow.cardinal,
      is_above_horizon: moonNow.altitude_deg > 0,
      next_rise: formatEasternTimeHHMM(nextMoonRiseDate),
      next_rise_12h: formatEasternTime12h(nextMoonRiseDate),
      next_set: formatEasternTimeHHMM(nextMoonSetDate),
      next_set_12h: formatEasternTime12h(nextMoonSetDate),
      sky_glow_mag_penalty: moonNow.sky_glow_mag_penalty,
      effective_nelm: effectiveNelm,
    },
  };
}

/**
 * Hourly Darkness & Limiting Magnitude helper used across both Forecast Matrix and Weather Merger
 */
export function computeHourlyDarkness(
  timestamp,
  cloudPct = 0,
  lat = BURLINGTON_NC.lat,
  lon = BURLINGTON_NC.lon
) {
  const d = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const sun = getSunPosition(d, lat, lon);
  const moon = getMoonPosition(d, lat, lon);

  const easternHourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: BURLINGTON_NC.timezone,
    hour: '2-digit',
    hour12: false,
  }).format(d);
  const easternHour = parseInt(easternHourStr, 10) || d.getHours();
  const isMorning = easternHour >= 3 && easternHour < 12;

  let displayLabel = '';
  let limitingMag = BURLINGTON_NC.baseline_nelm;
  let darknessState = 'Astro Dark';

  if (sun.altitude_deg > -0.833) {
    displayLabel = 'Day';
    darknessState = 'Daylight';
    limitingMag = 0.0;
  } else if (sun.altitude_deg > -6.0) {
    displayLabel = isMorning ? 'Dawn' : 'Dusk';
    darknessState = 'Civil Twilight';
    limitingMag = 2.5;
  } else if (sun.altitude_deg > -12.0) {
    displayLabel = isMorning ? 'Twil' : 'Dusk';
    darknessState = 'Nautical Twilight';
    limitingMag = 4.3;
  } else if (sun.altitude_deg > -18.0) {
    displayLabel = 'Twil';
    darknessState = 'Astro Twilight';
    limitingMag = Math.max(4.4, Number((5.4 - moon.sky_glow_mag_penalty * 0.6).toFixed(1)));
  } else {
    const cloudPenalty = (Math.max(0, Math.min(100, cloudPct)) / 100) * 1.3;
    limitingMag = Math.max(
      3.2,
      BURLINGTON_NC.baseline_nelm - moon.sky_glow_mag_penalty - cloudPenalty
    );
    displayLabel = limitingMag.toFixed(1);
    darknessState =
      moon.altitude_deg > 0 && moon.illumination_percent > 25
        ? 'Moonlit Night'
        : 'True Dark (Bortle 4)';
  }

  return {
    timestamp: d.toISOString(),
    sun_alt_deg: sun.altitude_deg,
    moon_alt_deg: moon.altitude_deg,
    moon_illum_pct: moon.illumination_percent,
    limiting_magnitude: Number(limitingMag.toFixed(1)),
    display_label: displayLabel,
    darkness_state: darknessState,
    is_astro_dark: sun.altitude_deg <= -12.0, // Nautical/Astro dark suitable for family stargazing
    is_deep_dark: sun.altitude_deg <= -18.0,
  };
}

// ============================================================================
// 2. KEPLERIAN PLANETARY EPHEMERIS & GALILEAN MOONS
// ============================================================================

const PLANET_ELEMENTS = {
  venus: {
    name: 'Venus',
    N0: 76.6799, Nd: 2.46590e-5,
    i0: 3.3946, id: 2.75e-8,
    w0: 54.8910, wd: 1.38374e-5,
    a: 0.723330,
    e0: 0.006773, ed: -1.302e-9,
    M0: 48.0052, Md: 1.6021302244,
    unitDiameterArcsec: 16.92,
  },
  mars: {
    name: 'Mars',
    N0: 49.5574, Nd: 2.11081e-5,
    i0: 1.8497, id: -1.78e-8,
    w0: 286.5016, wd: 2.92961e-5,
    a: 1.523688,
    e0: 0.093405, ed: 2.516e-9,
    M0: 18.6021, Md: 0.5240207766,
    unitDiameterArcsec: 9.36,
  },
  jupiter: {
    name: 'Jupiter',
    N0: 100.4542, Nd: 2.76854e-5,
    i0: 1.3030, id: -1.557e-7,
    w0: 273.8777, wd: 1.64505e-5,
    a: 5.20256,
    e0: 0.048498, ed: 4.469e-9,
    M0: 19.8950, Md: 0.0830853001,
    unitDiameterArcsec: 196.74,
  },
  saturn: {
    name: 'Saturn',
    N0: 113.6634, Nd: 2.38980e-5,
    i0: 2.4886, id: -1.081e-7,
    w0: 339.3939, wd: 2.97661e-5,
    a: 9.55475,
    e0: 0.055546, ed: -9.499e-9,
    M0: 316.9670, Md: 0.0334442282,
    unitDiameterArcsec: 165.6,
  },
};

function solveKeplerRad(Mrad, e) {
  let E = Mrad + e * Math.sin(Mrad) * (1.0 + e * Math.cos(Mrad));
  for (let iter = 0; iter < 4; iter++) {
    const dE = (E - e * Math.sin(E) - Mrad) / (1 - e * Math.cos(E));
    E -= dE;
  }
  return E;
}

export function getPlanetPosition(
  planetKey,
  date = new Date(),
  lat = BURLINGTON_NC.lat,
  lon = BURLINGTON_NC.lon
) {
  const el = PLANET_ELEMENTS[planetKey];
  if (!el) return null;

  const d = toDaysSinceJ2000(date);

  // Earth heliocentric ecliptic rectangular coordinates
  const Me = normalizeDegrees(357.5291 + 0.98560028 * d) * DEG2RAD;
  const Ee = solveKeplerRad(Me, 0.016709);
  const xve = Math.cos(Ee) - 0.016709;
  const yve = Math.sqrt(1 - 0.016709 * 0.016709) * Math.sin(Ee);
  const ve = Math.atan2(yve, xve);
  const re = Math.sqrt(xve * xve + yve * yve);
  const loneclEarth = ve + (282.9404 + 4.70935e-5 * d) * DEG2RAD;
  const xe = re * Math.cos(loneclEarth);
  const ye = re * Math.sin(loneclEarth);

  // Planet heliocentric orbital elements
  const N = normalizeDegrees(el.N0 + el.Nd * d) * DEG2RAD;
  const inc = (el.i0 + el.id * d) * DEG2RAD;
  const w = normalizeDegrees(el.w0 + el.wd * d) * DEG2RAD;
  const a = el.a;
  const e = el.e0 + el.ed * d;
  const M = normalizeDegrees(el.M0 + el.Md * d) * DEG2RAD;

  // Perturbations for Jupiter & Saturn mutual resonance
  const Mj = normalizeDegrees(19.8950 + 0.0830853001 * d) * DEG2RAD;
  const Ms = normalizeDegrees(316.9670 + 0.0334442282 * d) * DEG2RAD;

  const E = solveKeplerRad(M, e);
  const xv = a * (Math.cos(E) - e);
  const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yv, xv);
  const r = Math.sqrt(xv * xv + yv * yv);

  let xh = r * (Math.cos(N) * Math.cos(v + w) - Math.sin(N) * Math.sin(v + w) * Math.cos(inc));
  let yh = r * (Math.sin(N) * Math.cos(v + w) + Math.cos(N) * Math.sin(v + w) * Math.cos(inc));
  const zh = r * (Math.sin(v + w) * Math.sin(inc));

  let lonecl = Math.atan2(yh, xh);
  const latecl = Math.atan2(zh, Math.sqrt(xh * xh + yh * yh));

  if (planetKey === 'jupiter') {
    lonecl += (-0.332 * Math.sin(2 * Mj - 5 * Ms - 67.6 * DEG2RAD)) * DEG2RAD;
  } else if (planetKey === 'saturn') {
    lonecl += (0.812 * Math.sin(2 * Mj - 5 * Ms - 67.6 * DEG2RAD)) * DEG2RAD;
  }
  xh = r * Math.cos(lonecl) * Math.cos(latecl);
  yh = r * Math.sin(lonecl) * Math.cos(latecl);

  // Geocentric ecliptic rectangular
  const xg = xh - xe;
  const yg = ygVal(yh, ye);
  const zg = zh;

  function ygVal(yh0, ye0) {
    return yh0 - ye0;
  }

  const distAU = Math.sqrt(xg * xg + yg * yg + zg * zg);
  const eps = (23.4393 - 3.563e-7 * d) * DEG2RAD;

  const xeq = xg;
  const yeq = yg * Math.cos(eps) - zg * Math.sin(eps);
  const zeq = yg * Math.sin(eps) + zg * Math.cos(eps);

  const raDeg = normalizeDegrees(Math.atan2(yeq, xeq) * RAD2DEG);
  const decDeg = Math.asin(Math.max(-1, Math.min(1, zeq / distAU))) * RAD2DEG;
  const horiz = equatorialToHorizontal(raDeg, decDeg, date, lat, lon);

  // Phase angle & illuminated fraction
  const cosPhase = Math.max(
    -1,
    Math.min(1, (r * r + distAU * distAU - re * re) / (2 * r * distAU))
  );
  const phaseAngleDeg = Math.acos(cosPhase) * RAD2DEG;
  const illumPct = Math.round(((1 + cosPhase) / 2) * 100);
  const angularSizeArcsec = Number((el.unitDiameterArcsec / distAU).toFixed(1));

  // Apparent visual magnitude approximation
  const logTerm = 5 * Math.log10(r * distAU);
  let mag = 0;
  if (planetKey === 'venus') {
    mag = -4.34 + logTerm + 0.013 * phaseAngleDeg + 4.2e-7 * Math.pow(phaseAngleDeg, 3);
  } else if (planetKey === 'mars') {
    mag = -1.51 + logTerm + 0.016 * phaseAngleDeg;
  } else if (planetKey === 'jupiter') {
    mag = -9.40 + logTerm + 0.005 * phaseAngleDeg;
  } else if (planetKey === 'saturn') {
    mag = -8.88 + logTerm + 0.044 * phaseAngleDeg - 0.65;
  }

  // Compute Saturn's real ring plane tilt B (sub-Earth latitude relative to Saturn north pole RA=40.59°, Dec=83.54°)
  let ringTiltDeg = 0;
  let ringsArcsec = 0;
  if (planetKey === 'saturn') {
    const poleRa = 40.59 * DEG2RAD;
    const poleDec = 83.54 * DEG2RAD;
    const raRad = raDeg * DEG2RAD;
    const decRad = decDeg * DEG2RAD;
    const sinB =
      -Math.sin(poleDec) * Math.sin(decRad) -
      Math.cos(poleDec) * Math.cos(decRad) * Math.cos(raRad - poleRa);
    ringTiltDeg = Number((Math.asin(Math.max(-1, Math.min(1, sinB))) * RAD2DEG).toFixed(1));
    ringsArcsec = Number((375.0 / distAU).toFixed(1));
  }

  return {
    id: planetKey,
    name: el.name,
    ra_deg: raDeg,
    dec_deg: decDeg,
    distance_au: Number(distAU.toFixed(2)),
    angular_size_arcsec: angularSizeArcsec,
    rings_arcsec: ringsArcsec,
    ring_tilt_deg: ringTiltDeg,
    illumination_percent: illumPct,
    apparent_magnitude: Number(mag.toFixed(1)),
    ...horiz,
  };
}

export function getGalileanMoons(date = new Date()) {
  const d = toDaysSinceJ2000(date);
  const uIo = normalizeDegrees(163.8 + 203.40586 * d) * DEG2RAD;
  const uEuropa = normalizeDegrees(358.4 + 101.29163 * d) * DEG2RAD;
  const uGanymede = normalizeDegrees(5.7 + 50.23451 * d) * DEG2RAD;
  const uCallisto = normalizeDegrees(224.8 + 21.48798 * d) * DEG2RAD;

  return [
    {
      name: 'Io',
      short: 'Io',
      color: '#fde68a',
      x_jupiter_radii: Number((5.9 * Math.sin(uIo)).toFixed(2)),
      y_jupiter_radii: Number((0.25 * Math.cos(uIo)).toFixed(2)),
      in_transit_or_occultation: Math.abs(5.9 * Math.sin(uIo)) < 1.05,
    },
    {
      name: 'Europa',
      short: 'Eur',
      color: '#e0f2fe',
      x_jupiter_radii: Number((9.4 * Math.sin(uEuropa)).toFixed(2)),
      y_jupiter_radii: Number((0.4 * Math.cos(uEuropa)).toFixed(2)),
      in_transit_or_occultation: Math.abs(9.4 * Math.sin(uEuropa)) < 1.05,
    },
    {
      name: 'Ganymede',
      short: 'Gan',
      color: '#ffffff',
      x_jupiter_radii: Number((15.0 * Math.sin(uGanymede)).toFixed(2)),
      y_jupiter_radii: Number((0.65 * Math.cos(uGanymede)).toFixed(2)),
      in_transit_or_occultation: Math.abs(15.0 * Math.sin(uGanymede)) < 1.05,
    },
    {
      name: 'Callisto',
      short: 'Cal',
      color: '#cbd5e1',
      x_jupiter_radii: Number((26.4 * Math.sin(uCallisto)).toFixed(2)),
      y_jupiter_radii: Number((1.1 * Math.cos(uCallisto)).toFixed(2)),
      in_transit_or_occultation: Math.abs(26.4 * Math.sin(uCallisto)) < 1.05,
    },
  ];
}

// ============================================================================
// 3. OBJECT VISIBILITY WINDOW & 14 FAMILY SHOWPIECE TARGETS
// ============================================================================

/**
 * Computes when an object peaks (transits) and its rise/set status over tonight's window
 */
export function getObjectVisibilitySummary(
  raDeg,
  decDeg,
  refDate = new Date(),
  lat = BURLINGTON_NC.lat,
  lon = BURLINGTON_NC.lon
) {
  const nowHoriz = equatorialToHorizontal(raDeg, decDeg, refDate, lat, lon);
  const lstDeg = getLocalSiderealTime(refDate, lon).degrees;

  // Hour angle in hours (-12 to +12): negative means rising toward meridian, positive means past meridian
  let haDeg = normalizeDegrees(lstDeg - raDeg);
  if (haDeg > 180) haDeg -= 360;
  const hoursUntilTransit = -haDeg / 15.027;
  const transitDate = new Date(refDate.getTime() + hoursUntilTransit * 3600000);
  const peakAltDeg = Math.round(90 - Math.abs(lat - decDeg));

  const altDeg = Math.round(nowHoriz.altitude_deg);
  let statusBadge = '';
  let statusTone = 'muted';

  if (altDeg >= 35) {
    statusBadge = `High Overhead · ${altDeg}° ${nowHoriz.cardinal}`;
    statusTone = 'prime';
  } else if (altDeg >= 18) {
    statusBadge = `Clear Sightline · ${altDeg}° ${nowHoriz.cardinal}`;
    statusTone = 'good';
  } else if (altDeg >= 6) {
    statusBadge = haDeg < 0
      ? `Rising Low · ${altDeg}° ${nowHoriz.cardinal}`
      : `Setting Low · ${altDeg}° ${nowHoriz.cardinal}`;
    statusTone = 'low';
  } else {
    // Find next rise above 12° within next 16 hours
    const altFn = (d) => equatorialToHorizontal(raDeg, decDeg, d, lat, lon).altitude_deg;
    const riseTime = findAltitudeCrossing(
      altFn,
      refDate.getTime(),
      refDate.getTime() + 16 * 3600000,
      12,
      'rising'
    );
    statusBadge = riseTime
      ? `Below Trees · Clears 12° at ${formatEasternTime12h(riseTime)}`
      : `Below Horizon Now`;
    statusTone = 'below';
  }

  return {
    alt_deg: altDeg,
    az_deg: Math.round(nowHoriz.azimuth_deg),
    cardinal: nowHoriz.cardinal,
    is_visible: altDeg >= 8,
    is_prime_alt: altDeg >= 20,
    peak_time_12h: formatEasternTime12h(transitDate),
    peak_alt_deg: peakAltDeg,
    is_rising: haDeg < 0,
    status_badge: statusBadge,
    status_tone: statusTone,
  };
}

/**
 * Returns Tonight's default prime family stargazing timestamp if called during daytime,
 * or the exact requested timestamp when scrubbing.
 */
export function getDefaultStargazingReferenceDate(now = new Date()) {
  const eph = getSolarLunarData(now);
  if (!eph.sun.is_daylight) {
    return now;
  }
  // During daytime, default target preview to ~75 mins after sunset (prime family stargazing start!)
  if (eph.sun.sunset_date) {
    return new Date(eph.sun.sunset_date.getTime() + 75 * 60000);
  }
  const tonight = new Date(now);
  tonight.setHours(20, 30, 0, 0);
  return tonight;
}

/**
 * Master catalog of 14 Showpiece Targets for Family Stargazing in Burlington, NC with the NexStar 8SE
 */
export function getFovSimulatorTargets(
  date = new Date(),
  options = {}
) {
  const refDate = date instanceof Date ? date : new Date(date);
  const lat = BURLINGTON_NC.lat;
  const lon = BURLINGTON_NC.lon;
  const seeingRating = Number(options.seeingRating ?? 4);

  const moon = getMoonPosition(refDate, lat, lon);
  const moonUpAndBright = moon.altitude_deg > 2 && moon.illumination_percent >= 40;

  const jup = getPlanetPosition('jupiter', refDate, lat, lon);
  const sat = getPlanetPosition('saturn', refDate, lat, lon);
  const mars = getPlanetPosition('mars', refDate, lat, lon);
  const venus = getPlanetPosition('venus', refDate, lat, lon);
  const galileanMoons = getGalileanMoons(refDate);
  const transitingMoon = galileanMoons.find((m) => m.in_transit_or_occultation);

  function scoreTarget({ altDeg, familyWow, moonImmune, needsSteadySeeing, isPlanetOrMoon }) {
    if (altDeg < 6) return Math.max(5, 18 + altDeg);
    let s = 42;
    if (altDeg >= 35) s += 30;
    else if (altDeg >= 20) s += 22;
    else if (altDeg >= 12) s += 10;

    s += familyWow * 5;
    if (moonUpAndBright && !moonImmune) {
      s -= Math.round((moon.illumination_percent / 100) * 26);
    }
    if (needsSteadySeeing && seeingRating <= 2) {
      s -= 12;
    }
    if (isPlanetOrMoon && altDeg >= 18) {
      s += 6;
    }
    return Math.max(8, Math.min(99, Math.round(s)));
  }

  const rawDefinitions = [
    {
      id: 'saturn',
      name: 'Saturn & Rings',
      subtitle: `Ring Tilt ${Math.abs(sat.ring_tilt_deg)}° & Giant Moon Titan`,
      category: 'Planets & Moon',
      group: 'planets',
      kid_favorite: true,
      family_wow: 5,
      ra_deg: sat.ra_deg,
      dec_deg: sat.dec_deg,
      apparent_magnitude: sat.apparent_magnitude,
      angular_size_arcsec: sat.rings_arcsec,
      globe_size_arcsec: sat.angular_size_arcsec,
      ring_tilt_deg: sat.ring_tilt_deg,
      angular_size_display: `${sat.rings_arcsec}" rings (${sat.angular_size_arcsec}" globe)`,
      best_eyepiece_mm: seeingRating >= 4 ? 9 : 12,
      recommended_reducer: false,
      recommended_filter: 'No Filter',
      recommended_setup: seeingRating >= 4 ? '9mm (226x) or 12mm (169x)' : '12mm (169x) for steady rings',
      moon_immune: true,
      needs_seeing: true,
      kid_hook: 'Everyone remembers their first real look at Saturn! You are seeing real ice rings nearly 900 million miles away — plus orange moon Titan bigger than planet Mercury.',
      how_to_spot: 'Start with your 25mm to center the golden "star", then swap to 12mm or 9mm to pop the rings and Titan.',
    },
    {
      id: 'jupiter',
      name: 'Jupiter & 4 Moons',
      subtitle: transitingMoon
        ? `Cloud Belts + ${transitingMoon.name} Transit Alert!`
        : 'Cloud Belts & Io, Europa, Ganymede, Callisto',
      category: 'Planets & Moon',
      group: 'planets',
      kid_favorite: true,
      family_wow: 5,
      ra_deg: jup.ra_deg,
      dec_deg: jup.dec_deg,
      apparent_magnitude: jup.apparent_magnitude,
      angular_size_arcsec: jup.angular_size_arcsec,
      angular_size_display: `${jup.angular_size_arcsec}" disk`,
      best_eyepiece_mm: 12,
      recommended_reducer: false,
      recommended_filter: 'No Filter',
      recommended_setup: '12mm (169x) for cloud belts & 4 pinpoint moons',
      moon_immune: true,
      needs_seeing: true,
      galilean_moons: galileanMoons,
      kid_hook: '1,300 Earths could fit inside Jupiter! Watch its 4 moons — Europa hides a liquid saltwater ocean twice as big as all Earth\'s oceans combined.',
      how_to_spot: 'Look for two rusty-brown cloud stripes across Jupiter\'s middle and up to 4 tiny "stars" lined up on either side.',
    },
    {
      id: 'moon',
      name: `The Moon (${moon.phase_name})`,
      subtitle: `${moon.illumination_percent}% Lit · 3D Crater Terminator`,
      category: 'Planets & Moon',
      group: 'planets',
      kid_favorite: true,
      family_wow: moon.illumination_percent >= 8 && moon.illumination_percent <= 92 ? 5 : 4,
      ra_deg: moon.ra_deg,
      dec_deg: moon.dec_deg,
      apparent_magnitude: -11.8,
      angular_size_arcsec: 1860,
      angular_size_display: "31' (0.52°)",
      moon_phase_pct: moon.illumination_percent,
      moon_phase_angle: moon.phase_angle,
      best_eyepiece_mm: 12,
      recommended_reducer: false,
      recommended_filter: moon.illumination_percent > 55 ? 'Polarizer' : 'No Filter',
      recommended_setup: '25mm (81x) full disc or 9mm (226x) crater flyover',
      moon_immune: true,
      needs_seeing: false,
      kid_hook: 'Aim right along the shadow line (the "terminator") — mountain peaks catch sunrise light while crater floors sit in pitch-black night!',
      how_to_spot: 'In the 8SE at 169x–226x you feel like an Apollo astronaut orbiting 50 miles above the lunar mountains.',
    },
    {
      id: 'm42',
      name: 'M42 · Orion Nebula',
      subtitle: 'Stellar Nursery & 4 Baby Suns (Trapezium)',
      category: 'Nebulae & Galaxies',
      group: 'dso',
      kid_favorite: true,
      family_wow: 5,
      ra_deg: 83.8221,
      dec_deg: -5.3911,
      apparent_magnitude: 4.0,
      angular_size_arcsec: 3900,
      angular_size_display: "65' × 60'",
      best_eyepiece_mm: 25,
      recommended_reducer: true,
      recommended_filter: 'UHC Filter',
      recommended_setup: '25mm Stock (81x) or 32mm (64x) for sweeping wings',
      moon_immune: false,
      needs_seeing: false,
      kid_hook: 'This glowing cloud below Orion\'s Belt is a real star factory 1,344 light-years away — right in the center sit 4 newborn giant suns called the Trapezium!',
      how_to_spot: 'Even from a Burlington backyard, the 8-inch mirror shows ghostly greenish-silver bat wings wrapped around 4 diamond pinpoint stars.',
    },
    {
      id: 'm45',
      name: 'M45 · Pleiades (Seven Sisters)',
      subtitle: 'Blazing Ice-Blue Star Cluster in Taurus',
      category: 'Clusters & Doubles',
      group: 'clusters',
      kid_favorite: true,
      family_wow: 5,
      ra_deg: 56.75,
      dec_deg: 24.1167,
      apparent_magnitude: 1.6,
      angular_size_arcsec: 6600,
      angular_size_display: "110'",
      best_eyepiece_mm: 32,
      recommended_reducer: true,
      recommended_filter: 'No Filter',
      recommended_setup: '25mm or 32mm + f/6.3 Reducer for widest jewel-box view',
      moon_immune: true,
      needs_seeing: false,
      kid_hook: 'In Japan this cluster is called "Subaru" — look at the Subaru car badge in your driveway, then count how many dozens more stars pop out in the telescope!',
      how_to_spot: 'Use your lowest-power eyepiece (25mm or 32mm, plus f/6.3 reducer if you have one) because this cluster is huge and dazzling!',
    },
    {
      id: 'albireo',
      name: 'Albireo · Gold & Sapphire Twins',
      subtitle: 'Color-Contrast Double Star in Cygnus',
      category: 'Clusters & Doubles',
      group: 'clusters',
      kid_favorite: true,
      family_wow: 5,
      ra_deg: 292.6803,
      dec_deg: 27.9597,
      apparent_magnitude: 3.1,
      angular_size_arcsec: 35,
      angular_size_display: '35" separation',
      best_eyepiece_mm: 25,
      recommended_reducer: false,
      recommended_filter: 'No Filter',
      recommended_setup: '25mm Stock (81x) — crisp color contrast!',
      moon_immune: true,
      needs_seeing: false,
      kid_hook: 'To your naked eye it looks like one ordinary star at the head of the Swan — through the 8SE it splits into a glowing golden-orange sun next to a brilliant electric-blue sun!',
      how_to_spot: 'Ask each family member what two colors they see! Works great even when the Moon is bright over Burlington.',
    },
    {
      id: 'm13',
      name: 'M13 · Great Hercules Cluster',
      subtitle: 'Snowball of 300,000 Ancient Stars',
      category: 'Clusters & Doubles',
      group: 'clusters',
      kid_favorite: true,
      family_wow: 5,
      ra_deg: 250.4217,
      dec_deg: 36.46,
      apparent_magnitude: 5.8,
      angular_size_arcsec: 1200,
      angular_size_display: "20'",
      best_eyepiece_mm: 12,
      recommended_reducer: false,
      recommended_filter: 'No Filter',
      recommended_setup: '12mm (169x) resolves glittering star chains to the core',
      moon_immune: false,
      needs_seeing: false,
      kid_hook: 'This single ball of 300,000 stars is 11.6 billion years old — almost three times older than our Sun and Earth!',
      how_to_spot: 'This is where an 8-inch Celestron shines over smaller scopes: crank up to 12mm (169x) and watch the fuzzy ball explode into spilled sugar on black velvet.',
    },
    {
      id: 'double_cluster',
      name: 'NGC 869/884 · Double Cluster',
      subtitle: 'Twin Star Treasure Chests in Perseus',
      category: 'Clusters & Doubles',
      group: 'clusters',
      kid_favorite: true,
      family_wow: 5,
      ra_deg: 35.125,
      dec_deg: 57.14,
      apparent_magnitude: 3.7,
      angular_size_arcsec: 3600,
      angular_size_display: "60' pair",
      best_eyepiece_mm: 25,
      recommended_reducer: true,
      recommended_filter: 'No Filter',
      recommended_setup: '25mm or 32mm (+ f/6.3 Reducer frames both clusters!)',
      moon_immune: true,
      needs_seeing: false,
      kid_hook: 'Two young super-clusters side by side, packed with massive blue-white supergiants and a few ruby-red stars right in the middle!',
      how_to_spot: 'Pan gently left and right with the hand controller at 81x to hop from one glittering jewel box right into its twin.',
    },
    {
      id: 'm31',
      name: 'M31 · Andromeda Galaxy',
      subtitle: 'Trillion-Star Neighbor + Companion M32',
      category: 'Nebulae & Galaxies',
      group: 'dso',
      kid_favorite: true,
      family_wow: 4,
      ra_deg: 10.6847,
      dec_deg: 41.2687,
      apparent_magnitude: 3.4,
      angular_size_arcsec: 11400,
      angular_size_display: "190' × 60' (Core 38')",
      best_eyepiece_mm: 25,
      recommended_reducer: true,
      recommended_filter: 'No Filter',
      recommended_setup: '25mm Stock (81x) or f/6.3 Reducer (51x)',
      moon_immune: false,
      needs_seeing: false,
      kid_hook: 'This is the farthest thing human eyes can see — the actual photons hitting your eye tonight left Andromeda 2.5 million years ago!',
      how_to_spot: 'Look for the bright creamy oval core and spot fuzzier mini-galaxy M32 tucked just off to the side in the same eyepiece field.',
    },
    {
      id: 'm57',
      name: 'M57 · Ring Nebula',
      subtitle: 'Cosmic Smoke Ring in Lyra',
      category: 'Nebulae & Galaxies',
      group: 'dso',
      kid_favorite: true,
      family_wow: 4,
      ra_deg: 283.3962,
      dec_deg: 33.0292,
      apparent_magnitude: 8.8,
      angular_size_arcsec: 86,
      angular_size_display: '1.4\' × 1.0\' (86")',
      best_eyepiece_mm: 12,
      recommended_reducer: false,
      recommended_filter: 'OIII (Oxygen)',
      recommended_setup: '12mm (169x) — look slightly to the side (averted vision)!',
      moon_immune: false,
      needs_seeing: false,
      kid_hook: 'Kids call it the "Space Cheerios"! It\'s the glowing shell puffed off by a sun-like star at the end of its life 2,300 light-years away.',
      how_to_spot: 'Compact and punchy enough to cut right through Burlington suburban glow at 169x. Look beside the ring rather than straight at it to pop the dark donut hole!',
    },
    {
      id: 'mars',
      name: 'Mars · The Red Planet',
      subtitle: `${mars.angular_size_arcsec}" Ochre Disk · Mag ${mars.apparent_magnitude}`,
      category: 'Planets & Moon',
      group: 'planets',
      kid_favorite: true,
      family_wow: mars.angular_size_arcsec >= 10 ? 5 : 4,
      ra_deg: mars.ra_deg,
      dec_deg: mars.dec_deg,
      apparent_magnitude: mars.apparent_magnitude,
      angular_size_arcsec: mars.angular_size_arcsec,
      angular_size_display: `${mars.angular_size_arcsec}" disk`,
      best_eyepiece_mm: 9,
      recommended_reducer: false,
      recommended_filter: 'No Filter',
      recommended_setup: '9mm (226x) for polar cap & dark surface plains',
      moon_immune: true,
      needs_seeing: true,
      kid_hook: 'NASA rovers Curiosity and Perseverance are driving around on that rust-red little world right now!',
      how_to_spot: 'Wait until Mars climbs high (>35°) and let your 8SE cool down fully to spot subtle dark markings and the bright polar hood.',
    },
    {
      id: 'venus',
      name: 'Venus · Evening / Morning Star',
      subtitle: `${venus.illumination_percent}% Lit Phase · Mag ${venus.apparent_magnitude}`,
      category: 'Planets & Moon',
      group: 'planets',
      kid_favorite: true,
      family_wow: 4,
      ra_deg: venus.ra_deg,
      dec_deg: venus.dec_deg,
      apparent_magnitude: venus.apparent_magnitude,
      angular_size_arcsec: venus.angular_size_arcsec,
      venus_phase_pct: venus.illumination_percent,
      angular_size_display: `${venus.angular_size_arcsec}" (${venus.illumination_percent}% lit)`,
      best_eyepiece_mm: 12,
      recommended_reducer: false,
      recommended_filter: 'Polarizer',
      recommended_setup: '12mm (169x) — shows a miniature Moon phase!',
      moon_immune: true,
      needs_seeing: false,
      kid_hook: 'Just like Galileo discovered in 1610, Venus goes through crescent and half phases proving it orbits the Sun inside Earth\'s track!',
      how_to_spot: 'Catch Venus in twilight right after sunset or before dawn when sky glare softens its dazzling brilliance.',
    },
    {
      id: 'm27',
      name: 'M27 · Dumbbell Nebula',
      subtitle: 'Giant Apple-Core Planetary Nebula',
      category: 'Nebulae & Galaxies',
      group: 'dso',
      kid_favorite: false,
      family_wow: 4,
      ra_deg: 299.9012,
      dec_deg: 22.7211,
      apparent_magnitude: 7.4,
      angular_size_arcsec: 480,
      angular_size_display: "8.0' × 5.7'",
      best_eyepiece_mm: 25,
      recommended_reducer: false,
      recommended_filter: 'UHC Filter',
      recommended_setup: '25mm Stock (81x) — large bow-tie glow!',
      moon_immune: false,
      needs_seeing: false,
      kid_hook: 'Shaped like a glowing hourglass or apple core floating in a rich Milky Way starfield 1,360 light-years away.',
      how_to_spot: 'Much larger than the Ring Nebula — use your 25mm eyepiece on a moonless Burlington night.',
    },
    {
      id: 'm81_m82',
      name: 'M81 & M82 · Bode\'s & Cigar Pair',
      subtitle: 'Two Galaxies in One Eyepiece Field!',
      category: 'Nebulae & Galaxies',
      group: 'dso',
      kid_favorite: false,
      family_wow: 4,
      ra_deg: 148.888,
      dec_deg: 69.3,
      apparent_magnitude: 6.9,
      angular_size_arcsec: 2200,
      angular_size_display: "27' & 11' pair",
      best_eyepiece_mm: 32,
      recommended_reducer: true,
      recommended_filter: 'No Filter',
      recommended_setup: '32mm or 25mm + f/6.3 Reducer frames BOTH galaxies together',
      moon_immune: false,
      needs_seeing: false,
      kid_hook: '12 million light-years north near the Big Dipper: one grand spiral galaxy locked in a gravitational tug-of-war with a thin "cigar" starburst galaxy!',
      how_to_spot: 'Best on clear moonless nights or a quick 35-min trip to Jordan Lake; look for an oval glow next to a sharp silver needle.',
    },
  ];

  const enrichedList = rawDefinitions.map((item) => {
    const vis = getObjectVisibilitySummary(item.ra_deg, item.dec_deg, refDate, lat, lon);
    const tonightScore = scoreTarget({
      altDeg: vis.alt_deg,
      familyWow: item.family_wow,
      moonImmune: item.moon_immune,
      needsSteadySeeing: item.needs_seeing,
      isPlanetOrMoon: item.group === 'planets',
    });

    return {
      ...item,
      ...vis,
      tonight_score: tonightScore,
    };
  });

  // Sort by highest Tonight Score first (visible prime targets float right to the top!)
  const sortedList = [...enrichedList].sort((a, b) => b.tonight_score - a.tonight_score);
  const targetsById = {};
  for (const t of enrichedList) {
    targetsById[t.id] = t;
  }

  return {
    observer: BURLINGTON_NC.name,
    timestamp: refDate.toISOString(),
    time_12h: formatEasternTime12h(refDate),
    moon_summary: {
      phase_name: moon.phase_name,
      illumination_percent: moon.illumination_percent,
      is_up: moon.altitude_deg > 0,
      altitude_deg: Math.round(moon.altitude_deg),
    },
    targets: targetsById,
    target_list: sortedList,
  };
}

// ============================================================================
// 4. BURLINGTON OVERHEAD SKY DOME CONSTELLATIONS & PROJECTION
// ============================================================================

const CONSTELLATION_FIGURES = [
  {
    name: 'Big Dipper',
    stars: [
      [165.93, 61.75], // Dubhe 0
      [165.46, 56.38], // Merak 1
      [178.46, 53.69], // Phecda 2
      [183.86, 57.03], // Megrez 3
      [193.51, 55.96], // Alioth 4
      [200.98, 54.93], // Mizar 5
      [206.89, 49.31], // Alkaid 6
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]],
  },
  {
    name: 'Cassiopeia',
    stars: [
      [2.29, 59.15],  // Caph 0
      [10.13, 56.54], // Schedar 1
      [14.18, 60.72], // Gamma Cas 2
      [21.45, 60.24], // Ruchbah 3
      [28.60, 63.67], // Segin 4
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  {
    name: 'Orion',
    stars: [
      [88.79, 7.41],  // Betelgeuse 0
      [81.28, 6.35],  // Bellatrix 1
      [83.00, -0.30], // Mintaka 2
      [84.05, -1.20], // Alnilam 3
      [85.19, -1.94], // Alnitak 4
      [86.94, -9.67], // Saiph 5
      [78.63, -8.20], // Rigel 6
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [0, 4], [4, 5], [2, 6], [5, 6]],
  },
  {
    name: 'Cygnus',
    stars: [
      [310.36, 45.28], // Deneb 0
      [305.56, 40.26], // Sadr 1
      [292.68, 27.96], // Albireo 2
      [296.24, 45.13], // Delta Cyg 3
      [311.55, 33.97], // Gienah 4
    ],
    lines: [[0, 1], [1, 2], [3, 1], [1, 4]],
  },
  {
    name: 'Lyra',
    stars: [
      [279.23, 38.78], // Vega 0
      [282.52, 33.36], // Sheliak 1
      [284.74, 32.69], // Sulafat 2
      [284.10, 36.90], // Delta Lyr 3
    ],
    lines: [[0, 3], [3, 2], [2, 1], [1, 3]],
  },
  {
    name: 'Taurus',
    stars: [
      [68.98, 16.51], // Aldebaran 0
      [64.95, 15.63], // Hyadum I 1
      [81.57, 28.61], // Elnath 2
      [84.41, 21.14], // Zeta Tau 3
    ],
    lines: [[2, 1], [1, 0], [0, 3]],
  },
  {
    name: 'Leo',
    stars: [
      [152.09, 11.97], // Regulus 0
      [154.99, 19.84], // Algieba 1
      [168.53, 20.52], // Zosma 2
      [177.26, 14.57], // Denebola 3
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0]],
  },
  {
    name: 'Pegasus',
    stars: [
      [346.19, 15.21], // Markab 0
      [345.94, 28.08], // Scheat 1
      [2.09, 29.09],   // Alpheratz 2
      [3.31, 15.18],   // Algenib 3
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0]],
  },
];

/**
 * Projects horizontal coordinates (alt, az) onto normalized overhead sky dome (-1..1, -1..1)
 * Note: Looking UP at the sky dome, North is UP (y = -r), South is DOWN (y = +r),
 * East is LEFT (x = -r), West is RIGHT (x = +r), matching real overhead star charts!
 */
export function projectAltAzToDome(altDeg, azDeg) {
  const zenithDist = (90 - altDeg) / 90; // 0 at zenith, 1 at horizon
  const azRad = azDeg * DEG2RAD;
  return {
    nx: -zenithDist * Math.sin(azRad), // East (90°) -> -x (Left), West (270°) -> +x (Right)
    ny: -zenithDist * Math.cos(azRad), // North (0°) -> -y (Top), South (180°) -> +y (Bottom)
    r_norm: zenithDist,
  };
}

export function getSkyDomeSnapshot(date = new Date()) {
  const refDate = date instanceof Date ? date : new Date(date);
  const lat = BURLINGTON_NC.lat;
  const lon = BURLINGTON_NC.lon;

  const constellations = CONSTELLATION_FIGURES.map((c) => {
    const projectedStars = c.stars.map(([ra, dec]) => {
      const h = equatorialToHorizontal(ra, dec, refDate, lat, lon);
      const p = projectAltAzToDome(h.altitude_deg, h.azimuth_deg);
      return { alt: h.altitude_deg, az: h.azimuth_deg, ...p };
    });
    const visibleCount = projectedStars.filter((s) => s.alt > 2).length;
    if (visibleCount < 2) return null;

    const avgNx = projectedStars.reduce((s, p) => s + p.nx, 0) / projectedStars.length;
    const avgNy = projectedStars.reduce((s, p) => s + p.ny, 0) / projectedStars.length;
    return {
      name: c.name,
      stars: projectedStars,
      lines: c.lines,
      labelPos: { nx: avgNx, ny: avgNy },
    };
  }).filter(Boolean);

  // Polaris anchor
  const polarisH = equatorialToHorizontal(2.5303 * 15, 89.2641, refDate, lat, lon);
  const polarisProj = projectAltAzToDome(polarisH.altitude_deg, polarisH.azimuth_deg);

  const catalog = getFovSimulatorTargets(refDate);
  const visibleMarkers = catalog.target_list
    .filter((t) => t.alt_deg >= 3)
    .map((t) => ({
      id: t.id,
      name: t.name.split('·')[0].split('&')[0].trim(),
      full_name: t.name,
      group: t.group,
      alt_deg: t.alt_deg,
      cardinal: t.cardinal,
      tonight_score: t.tonight_score,
      ...projectAltAzToDome(t.alt_deg, t.az_deg),
    }));

  return {
    timestamp: refDate.toISOString(),
    time_12h: formatEasternTime12h(refDate),
    sun: getSunPosition(refDate, lat, lon),
    moon: getMoonPosition(refDate, lat, lon),
    polaris: { name: 'Polaris', alt: polarisH.altitude_deg, ...polarisProj },
    constellations,
    markers: visibleMarkers,
  };
}

// ============================================================================
// 5. NEXSTAR 8SE OPTICS, THERMAL COOLDOWN, DEW & SKYALIGN TRIANGLE SOLVER
// ============================================================================

export function getSeeingMaxMagnification(seeingScore = 4) {
  const clamped = Math.max(1, Math.min(5, Math.round(seeingScore)));
  const map = {
    5: {
      max_useful_mag: 360,
      label: '360x Max',
      condition: '5/5 Crisp — Steady Atmosphere',
      recommendation: '9mm (226x) + Barlow on Saturn/Moon craters will look razor-sharp tonight!',
    },
    4: {
      max_useful_mag: 280,
      label: '280x Max',
      condition: '4/5 Steady — Great Planetary Night',
      recommendation: '9mm (226x) & 12mm (169x) are right in the sweet spot for Saturn & Jupiter.',
    },
    3: {
      max_useful_mag: 190,
      label: '190x Max',
      condition: '3/5 Moderate Shimmer',
      recommendation: 'Keep planets at 12mm (169x) or 25mm (81x) — higher power just magnifies air wobble.',
    },
    2: {
      max_useful_mag: 130,
      label: '130x Max',
      condition: '2/5 Jet Stream Wobble',
      recommendation: 'Skip high-power planets; use 25mm (81x) or 32mm for wide star clusters & nebulae!',
    },
    1: {
      max_useful_mag: 95,
      label: '95x Max',
      condition: '1/5 Heavy Turbulence',
      recommendation: 'Stick strictly to wide-field 25mm/32mm views (Pleiades, Orion, Andromeda).',
    },
  };
  return map[clamped];
}

export function computeEyepieceMatrix({
  reducerActive = false,
  barlowActive = false,
  customEyepieces = null,
  seeingRating = 4,
} = {}) {
  const reducerFactor = reducerActive ? 0.63 : 1.0;
  const barlowFactor = barlowActive ? 2.0 : 1.0;
  const combinedFactor = reducerFactor * barlowFactor;

  const effectiveFocalLengthMm = Math.round(
    NEXSTAR_8SE_SPECS.focal_length_mm * combinedFactor
  );
  const effectiveFocalRatioNum = Number(
    (NEXSTAR_8SE_SPECS.native_focal_ratio * combinedFactor).toFixed(1)
  );

  let configurationLabel = 'Native f/10 (2032mm)';
  if (reducerActive && !barlowActive) {
    configurationLabel = 'f/6.3 Reducer (1280mm Wide)';
  } else if (!reducerActive && barlowActive) {
    configurationLabel = '2x Barlow f/20 (4064mm)';
  } else if (reducerActive && barlowActive) {
    configurationLabel = 'f/6.3 + 2x Barlow f/12.6 (2560mm)';
  }

  const maxSeeingMag = getSeeingMaxMagnification(seeingRating).max_useful_mag;
  const list =
    Array.isArray(customEyepieces) && customEyepieces.length > 0
      ? customEyepieces
      : DEFAULT_EYEPIECES;

  const eyepieces = list.map((ep) => {
    const mag = Math.round(effectiveFocalLengthMm / ep.focal_length_mm);
    const tfovDegNum = ep.afov_deg / mag;
    const tfovArcmin = Math.round(tfovDegNum * 60);
    const exitPupilMm = Number((NEXSTAR_8SE_SPECS.aperture_mm / mag).toFixed(1));
    const exceedsSeeing = mag > maxSeeingMag;

    let opticalNote = ep.badge || ep.role || 'General Observing';
    if (exceedsSeeing) {
      opticalNote = `Above tonight's ${maxSeeingMag}x seeing cap`;
    } else if (exitPupilMm >= 2.2) {
      opticalNote = 'Bright DSO & Cluster Framing';
    } else if (exitPupilMm >= 0.8) {
      opticalNote = 'Sharp Planetary & Globular Sweet Spot';
    }

    return {
      ...ep,
      magnification: mag,
      magnification_display: `${mag}x`,
      tfov_deg: tfovDegNum.toFixed(2),
      tfov_arcmin: tfovArcmin,
      tfov_display: `${tfovDegNum.toFixed(2)}° (${tfovArcmin}')`,
      exit_pupil_mm: exitPupilMm.toFixed(1),
      exit_pupil_display: `${exitPupilMm.toFixed(1)}mm`,
      exceeds_seeing_limit: exceedsSeeing,
      optical_note: opticalNote,
    };
  });

  return {
    aperture_mm: NEXSTAR_8SE_SPECS.aperture_mm,
    effective_focal_length_mm: effectiveFocalLengthMm,
    effective_focal_ratio: `f/${effectiveFocalRatioNum}`,
    effective_focal_ratio_num: effectiveFocalRatioNum,
    configuration_label: configurationLabel,
    reducer_active: reducerActive,
    barlow_active: barlowActive,
    eyepieces,
  };
}

export function getNexStar8SETelemetry(weatherSummary = {}, userConfig = {}) {
  const ambientTempF = Number(
    weatherSummary.ambient_temp_f ?? weatherSummary.tempF ?? 52
  );
  const humidityPct = Number(
    weatherSummary.humidity_pct ?? weatherSummary.humidity ?? 62
  );

  let dewPointF = weatherSummary.dew_point_f ?? weatherSummary.dewPointF;
  if (typeof dewPointF !== 'number' || Number.isNaN(dewPointF)) {
    const tempC = ((ambientTempF - 32) * 5) / 9;
    const rh = Math.max(1, Math.min(100, humidityPct));
    const a = 17.625;
    const b = 243.04;
    const alpha = Math.log(rh / 100) + (a * tempC) / (b + tempC);
    const dewC = (b * alpha) / (a - alpha);
    dewPointF = Math.round((dewC * 9) / 5 + 32);
  }

  const seeingScore = Number(
    weatherSummary.seeing_score ?? weatherSummary.seeingScore ?? 4
  );

  // Closed-tube 8" SCT exponential thermal relaxation (tau = 24.5 min)
  const tauMinutes = 24.5;
  const indoorStartTempF = Number(userConfig.indoor_start_temp_f ?? 70);
  const cooldownStartTs = userConfig.cooldownStartTimestamp;
  const isTimerActive = typeof cooldownStartTs === 'number' && cooldownStartTs > 0;

  const elapsedMinutes = isTimerActive
    ? Math.max(0, (Date.now() - cooldownStartTs) / 60000)
    : 0;

  const initialDeltaF = Math.max(0, indoorStartTempF - ambientTempF);
  const currentDeltaF = isTimerActive
    ? initialDeltaF * Math.exp(-elapsedMinutes / tauMinutes)
    : initialDeltaF;

  const wideFieldThresholdF = 3.5; // 81x wide views look fine once ΔT <= 3.5°F
  const planetaryThresholdF = 0.9; // 170x-230x Airy disk sharp once ΔT <= 0.9°F

  const wideFieldRemainingMin =
    currentDeltaF > wideFieldThresholdF
      ? Math.ceil(tauMinutes * Math.log(currentDeltaF / wideFieldThresholdF))
      : 0;

  const planetaryRemainingMin =
    currentDeltaF > planetaryThresholdF
      ? Math.ceil(tauMinutes * Math.log(currentDeltaF / planetaryThresholdF))
      : 0;

  const progressPct =
    initialDeltaF <= planetaryThresholdF
      ? 100
      : Math.min(
          100,
          Math.max(
            0,
            Math.round(
              ((initialDeltaF - Math.max(0, currentDeltaF - planetaryThresholdF)) /
                Math.max(0.1, initialDeltaF - planetaryThresholdF)) *
                100
            )
          )
        );

  let thermalStatus = 'ACCLIMATED & CRISP';
  let familyAdvice = 'Mirror is thermally steady — go full power on Saturn, Jupiter, or Moon craters!';
  if (!isTimerActive && initialDeltaF > 2) {
    thermalStatus = `NEEDS ~${planetaryRemainingMin}M OUTSIDE`;
    familyAdvice = `Set your orange tube outside ~${planetaryRemainingMin} min before planet viewing (wide 25mm views work in ~${wideFieldRemainingMin}m).`;
  } else if (planetaryRemainingMin > 0 && wideFieldRemainingMin === 0) {
    thermalStatus = 'WIDE-FIELD READY NOW';
    familyAdvice = `Enjoy clusters & nebulae at 25mm (81x) right now! Wait ~${planetaryRemainingMin}m more for 200x planets.`;
  } else if (planetaryRemainingMin > 0) {
    thermalStatus = `COOLING (${planetaryRemainingMin}m left)`;
    familyAdvice = `Warm air plume inside tube (${currentDeltaF.toFixed(1)}°F above outdoor air). Wide-field ready in ~${wideFieldRemainingMin}m.`;
  }

  // Dew point & 8" glass Schmidt corrector risk
  const dewDepressionF = Number((ambientTempF - dewPointF).toFixed(1));
  let dewRiskLevel = 'LOW';
  let heaterRecommended = false;
  let dutyCyclePercent = 0;
  let dewSummary = `Dry margin (${dewDepressionF}°F spread) — passive dew shield is plenty tonight.`;

  if (dewDepressionF <= 4.5 || humidityPct >= 82) {
    dewRiskLevel = 'HIGH DEW RISK';
    heaterRecommended = true;
    dutyCyclePercent = Math.min(85, Math.max(55, Math.round(82 - dewDepressionF * 5)));
    dewSummary = `Humid NC air (${dewDepressionF}°F spread, ${humidityPct}% RH). Put on your Dew Shield + Heater Strap at ~${dutyCyclePercent}% so the front glass doesn't fog!`;
  } else if (dewDepressionF <= 8.5 || humidityPct >= 68) {
    dewRiskLevel = 'MODERATE DEW';
    heaterRecommended = true;
    dutyCyclePercent = Math.min(50, Math.max(25, Math.round(50 - (dewDepressionF - 4.5) * 5)));
    dewSummary = `8" glass corrector radiates heat to clear sky — slide on a Dew Shield (strap ~${dutyCyclePercent}% for sessions > 1 hr).`;
  }

  return {
    specs: NEXSTAR_8SE_SPECS,
    thermal: {
      is_timer_active: isTimerActive,
      elapsed_minutes: Math.round(elapsedMinutes),
      indoor_start_temp_f: Number(indoorStartTempF.toFixed(0)),
      ambient_temp_f: Number(ambientTempF.toFixed(0)),
      delta_t_f: Number(currentDeltaF.toFixed(1)),
      wide_field_minutes: wideFieldRemainingMin,
      estimated_cooldown_minutes: planetaryRemainingMin,
      progress_percent: progressPct,
      status: thermalStatus,
      family_advice: familyAdvice,
      is_acclimated: planetaryRemainingMin === 0 && (isTimerActive || initialDeltaF <= 2),
    },
    dew: {
      ambient_temp_f: Number(ambientTempF.toFixed(0)),
      dew_point_f: Number(dewPointF.toFixed(0)),
      dew_depression_f: dewDepressionF,
      humidity_pct: humidityPct,
      risk_level: dewRiskLevel,
      heater_recommended: heaterRecommended,
      duty_cycle_percent: dutyCyclePercent,
      recommendation_text: dewSummary,
    },
    seeing_limit: getSeeingMaxMagnification(seeingScore),
    eyepiece_matrix: computeEyepieceMatrix({
      reducerActive: Boolean(userConfig.reducerActive),
      barlowActive: Boolean(userConfig.barlowActive),
      seeingRating: seeingScore,
    }),
  };
}

export const SKYALIGN_STAR_CATALOG = [
  { name: 'Vega', constellation: 'Lyra', hint: 'Brilliant blue-white overhead/west', ra_hours: 18.6156, dec_deg: 38.7837, mag: 0.03 },
  { name: 'Altair', constellation: 'Aquila', hint: 'Flanked by two fainter guard stars', ra_hours: 19.8464, dec_deg: 8.8683, mag: 0.76 },
  { name: 'Deneb', constellation: 'Cygnus', hint: 'Top of the Northern Cross', ra_hours: 20.6905, dec_deg: 45.2803, mag: 1.25 },
  { name: 'Capella', constellation: 'Auriga', hint: 'Bright golden-yellow beacon', ra_hours: 5.2782, dec_deg: 45.9980, mag: 0.08 },
  { name: 'Arcturus', constellation: 'Boötes', hint: 'Fiery orange-gold ("arc to Arcturus")', ra_hours: 14.2610, dec_deg: 19.1824, mag: -0.05 },
  { name: 'Betelgeuse', constellation: 'Orion', hint: 'Red shoulder of Orion', ra_hours: 5.9195, dec_deg: 7.4071, mag: 0.42 },
  { name: 'Rigel', constellation: 'Orion', hint: 'Icy blue-white foot of Orion', ra_hours: 5.2423, dec_deg: -8.2016, mag: 0.13 },
  { name: 'Aldebaran', constellation: 'Taurus', hint: 'Orange eye of the Bull near Pleiades', ra_hours: 4.5987, dec_deg: 16.5093, mag: 0.86 },
  { name: 'Sirius', constellation: 'Canis Major', hint: 'Brightest star in the night sky', ra_hours: 6.7525, dec_deg: -16.7161, mag: -1.46 },
  { name: 'Procyon', constellation: 'Canis Minor', hint: 'Steady white star east of Orion', ra_hours: 7.6550, dec_deg: 5.2250, mag: 0.34 },
  { name: 'Regulus', constellation: 'Leo', hint: 'Bottom of the backwards question-mark', ra_hours: 10.1395, dec_deg: 11.9672, mag: 1.36 },
  { name: 'Spica', constellation: 'Virgo', hint: 'Crisp blue-white southern anchor', ra_hours: 13.4199, dec_deg: -11.1613, mag: 0.97 },
  { name: 'Antares', constellation: 'Scorpius', hint: 'Ruby-red heart of the Scorpion', ra_hours: 16.4901, dec_deg: -26.4320, mag: 1.06 },
  { name: 'Fomalhaut', constellation: 'Piscis Austrinus', hint: 'Solitary bright star in the south', ra_hours: 22.9608, dec_deg: -29.6222, mag: 1.16 },
  { name: 'Pollux', constellation: 'Gemini', hint: 'Warmer twin star of Gemini', ra_hours: 7.7553, dec_deg: 28.0262, mag: 1.14 },
  { name: 'Caph', constellation: 'Cassiopeia', hint: 'Right tip of the "W" of Cassiopeia', ra_hours: 0.1528, dec_deg: 59.1498, mag: 2.28 },
];

function angularAzimuthSeparation(az1, az2) {
  const diff = Math.abs(normalizeDegrees(az1) - normalizeDegrees(az2));
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Finds the best wide-spread 3-star SkyAlign triangle for a Burlington backyard
 * (Strictly avoids < 20° tree/roofline and > 74° fork-mount zenith lock, and avoids Polaris for SkyAlign!)
 */
export function getSkyAlignStars(
  date = new Date(),
  weatherSummary = {},
  lat = BURLINGTON_NC.lat,
  lon = BURLINGTON_NC.lon
) {
  const computedStars = SKYALIGN_STAR_CATALOG.map((star) => {
    const raDeg = star.ra_hours * 15.0;
    const horiz = equatorialToHorizontal(raDeg, star.dec_deg, date, lat, lon);
    const proj = projectAltAzToDome(horiz.altitude_deg, horiz.azimuth_deg);

    const inOptimalBand = horiz.altitude_deg >= 22 && horiz.altitude_deg <= 72;
    const isVisible = horiz.altitude_deg >= 14;

    return {
      ...star,
      ra_deg: raDeg,
      alt_deg: Math.round(horiz.altitude_deg),
      az_deg: Math.round(horiz.azimuth_deg),
      az_padded: String(Math.round(horiz.azimuth_deg)).padStart(3, '0'),
      cardinal: horiz.cardinal,
      in_optimal_band: inOptimalBand,
      is_visible: isVisible,
      ...proj,
    };
  });

  const pool = computedStars
    .filter((s) => s.in_optimal_band)
    .sort((a, b) => a.mag - b.mag);

  const fallbackPool = computedStars
    .filter((s) => s.is_visible)
    .sort((a, b) => a.mag - b.mag);

  const candidates = pool.length >= 3 ? pool : fallbackPool;

  // Search all triplets in candidates to maximize minimum pairwise azimuth separation + brightness
  let bestTriplet = candidates.slice(0, 3);
  let bestScore = -999;

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      for (let k = j + 1; k < candidates.length; k++) {
        const a = candidates[i];
        const b = candidates[j];
        const c = candidates[k];
        const sepAB = angularAzimuthSeparation(a.az_deg, b.az_deg);
        const sepBC = angularAzimuthSeparation(b.az_deg, c.az_deg);
        const sepCA = angularAzimuthSeparation(c.az_deg, a.az_deg);
        const minSep = Math.min(sepAB, sepBC, sepCA);
        const magBonus = (2.5 - a.mag) + (2.5 - b.mag) + (2.5 - c.mag);
        const optBonus = (a.in_optimal_band ? 8 : 0) + (b.in_optimal_band ? 8 : 0) + (c.in_optimal_band ? 8 : 0);
        const score = minSep * 1.4 + magBonus * 6 + optBonus;
        if (score > bestScore) {
          bestScore = score;
          bestTriplet = [a, b, c];
        }
      }
    }
  }

  const cloudPct = Number(weatherSummary.cloud_cover_pct ?? weatherSummary.cloudPct ?? 10);
  let alignmentQuality = 'WIDE 3-STAR TRIANGLE';
  if (cloudPct > 65) {
    alignmentQuality = 'USE SOLAR SYSTEM ALIGN (CLOUDS)';
  } else if (cloudPct > 30) {
    alignmentQuality = 'PICK CLEAR SKY GAPS';
  }

  return {
    observer: BURLINGTON_NC.name,
    lst: getLocalSiderealTime(date, lon).short,
    time_12h: formatEasternTime12h(date),
    alignment_quality: alignmentQuality,
    recommended_stars: bestTriplet,
    all_visible_stars: fallbackPool,
  };
}
