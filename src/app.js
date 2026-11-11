/**
 * @fileoverview Main Application Router & State Store
 * Burlington Dark Skies — Family Space Explorer & Celestron NexStar 8SE
 * Dedicated to Burlington, NC (36.096°N, -79.438°W · Bortle Class 4)
 */

import {
  getBurlingtonSkyForecast,
  buildFallbackForecastSnapshot,
} from './services/weatherService.js';

import {
  BURLINGTON_NC,
  getSolarLunarData,
} from './services/astronomyEngine.js';

import {
  getObservationLogs,
  saveObservationLog,
  deleteObservationLog,
  getAppSettings,
  saveAppSettings,
} from './services/storageService.js';

import { renderDashboardScreen } from './screens/dashboardScreen.js';
import { renderExploreSkyScreen } from './screens/exploreSkyScreen.js';
import { renderTelescopeOpticsScreen } from './screens/telescopeOpticsScreen.js';
import { renderFovSimulatorScreen } from './screens/fovSimulatorScreen.js';
import { renderSatelliteMapScreen } from './screens/satelliteMapScreen.js';
import { renderObservationLogScreen } from './screens/observationLogScreen.js';

/**
 * Normalizes screen identifiers across all screen modules and bottom nav buttons
 */
export function normalizeScreenId(rawId) {
  const key = String(rawId || 'dashboard').toLowerCase().trim();
  switch (key) {
    case 'dashboard':
    case 'tonight':
    case 'forecast':
    case 'home':
      return 'dashboard';
    case 'explore':
    case 'whats-up':
    case 'sky':
    case 'targets':
      return 'explore';
    case 'optics':
    case 'nexstar':
    case 'scope':
    case 'observatory':
      return 'optics';
    case 'fov':
    case 'fov-simulator':
    case 'eyepiece':
      return 'fov';
    case 'map':
    case 'satellites':
    case 'satellite':
      return 'map';
    case 'logbook':
    case 'journal':
    case 'log':
      return 'logbook';
    default:
      return 'dashboard';
  }
}

const initialSettings = getAppSettings();
const initialForecast = buildFallbackForecastSnapshot();
const initialEphemeris = getSolarLunarData(new Date(), BURLINGTON_NC.lat, BURLINGTON_NC.lon);
const initialLogs = getObservationLogs();
const defaultHourIdx = initialForecast.tonight_plan?.recommended_hour_index ?? 0;

export const state = {
  activeScreen: 'dashboard',
  fovReturnScreen: 'explore',
  navigationHistory: ['dashboard'],
  forecast: initialForecast,
  ephemeris: initialEphemeris,
  settings: initialSettings,
  nightVisionMode: Boolean(initialSettings.nightVisionMode),
  selectedHourIndex: defaultHourIdx,
  exploreCategory: 'best',
  exploreMinutesOffset: 0,
  selectedTargetId: 'saturn',
  selectedTarget: 'saturn',
  selectedEyepiece: Number(initialSettings.selectedEyepieceMm || 25),
  selectedFilter: initialSettings.selectedFilter || 'No Filter',
  hasReducer: Boolean(initialSettings.reducerActive),
  hasBarlow: Boolean(initialSettings.barlowActive),
  activeMapLayer: 'ir',
  logs: initialLogs,
  optics: {
    hasReducer: Boolean(initialSettings.reducerActive),
    hasBarlow: Boolean(initialSettings.barlowActive),
    selectedEyepiece: Number(initialSettings.selectedEyepieceMm || 25),
    selectedTarget: 'saturn',
    selectedFilter: initialSettings.selectedFilter || 'No Filter',
    indoorTempF: Number(initialSettings.nexstarIndoorTempF || 70),
    cooldownStartTimestamp: initialSettings.cooldownStartTimestamp ?? null,
    alignedStarNames: Array.isArray(initialSettings.alignedStarNames)
      ? initialSettings.alignedStarNames
      : [],
  },
  currentHour: {
    seeing: 4,
    transparency: 'Above Average',
    tempF: 54,
    humidity: 60,
    cloudCover: 10,
    nelm: '5.9',
    runLabel: `ClearDarkSky ${initialForecast.model_run || '06Z'}`,
  },
};

function syncCurrentHourTelemetry() {
  const timeline = state.forecast?.timeline_48h || [];
  const h = timeline[state.selectedHourIndex] || timeline[0] || {};
  const summary = state.forecast?.current_summary || {};
  const plan = state.forecast?.tonight_plan || {};

  state.currentHour = {
    seeing: h.seeing_rating ?? plan.evening_seeing ?? summary.seeing ?? 4,
    transparency: h.transparency_label || summary.transparency || 'Above Average',
    tempF: h.temp_f ?? plan.evening_temp_f ?? summary.temperature_f ?? 54,
    dewPointF: h.dew_point_f ?? summary.dew_point_f ?? 44,
    humidity: h.humidity_pct ?? summary.humidity_percent ?? 60,
    cloudCover: h.blended_cloud_pct ?? h.cloud_pct ?? summary.cloud_coverage_percent ?? 10,
    nelm: String(
      typeof h.darkness_numeric === 'number' && h.darkness_numeric > 0
        ? h.darkness_numeric
        : plan.peak_nelm ?? summary.limiting_magnitude ?? '5.9'
    ),
    runLabel: `${state.forecast?.data_source || 'ClearDarkSky'} · ${state.forecast?.model_run || '06Z'}`,
  };
}

function applyNightVisionClasses(enabled) {
  const isEnabled = Boolean(enabled);
  state.nightVisionMode = isEnabled;
  document.body.classList.toggle('night-vision', isEnabled);
  document.body.classList.toggle('night-vision-mode', isEnabled);
  saveAppSettings({ nightVisionMode: isEnabled });
}

export const actions = {
  navigate(screenId, params = {}) {
    const target = normalizeScreenId(screenId);

    if (target === 'fov' && state.activeScreen !== 'fov') {
      state.fovReturnScreen =
        params.fromScreen ||
        (state.activeScreen === 'explore' || state.activeScreen === 'optics'
          ? state.activeScreen
          : 'explore');
    }

    if (params && typeof params === 'object') {
      if (params.selectedHourIndex !== undefined) {
        state.selectedHourIndex = Math.max(0, Math.min(47, Number(params.selectedHourIndex) || 0));
      }
      if (params.selectedTargetId !== undefined) {
        const tKey = String(params.selectedTargetId).toLowerCase();
        state.selectedTargetId = tKey;
        state.selectedTarget = tKey;
        if (state.optics) state.optics.selectedTarget = tKey;
      }
      if (params.selectedEyepiece !== undefined) {
        actions.selectEyepiece(params.selectedEyepiece);
      }
      if (typeof params.hasReducer === 'boolean') {
        actions.toggleReducer(params.hasReducer);
      }
      if (typeof params.hasBarlow === 'boolean') {
        actions.toggleBarlow(params.hasBarlow);
      }
      if (params.layer) {
        state.activeMapLayer = params.layer;
      }
    }

    if (state.activeScreen !== target) {
      state.navigationHistory.push(target);
      if (state.navigationHistory.length > 20) state.navigationHistory.shift();
    }

    state.activeScreen = target;
    syncCurrentHourTelemetry();
    renderCurrentScreen();
    window.scrollTo({ top: 0, behavior: 'instant' });
  },

  setScreen(screenId, params = {}) {
    actions.navigate(screenId, params);
  },

  async refreshForecast() {
    const fresh = await getBurlingtonSkyForecast(true);
    if (fresh) {
      state.forecast = fresh;
      state.ephemeris = getSolarLunarData(new Date(), BURLINGTON_NC.lat, BURLINGTON_NC.lon);
      if (fresh.tonight_plan?.recommended_hour_index !== undefined && state.selectedHourIndex === 0) {
        state.selectedHourIndex = fresh.tonight_plan.recommended_hour_index;
      }
      syncCurrentHourTelemetry();
      renderCurrentScreen();
    }
    return fresh;
  },

  toggleNightVision(forceValue) {
    const nextVal =
      typeof forceValue === 'boolean'
        ? forceValue
        : !document.body.classList.contains('night-vision-mode');
    applyNightVisionClasses(nextVal);
    return nextVal;
  },

  updateSettings(patch = {}) {
    state.settings = saveAppSettings(patch);
    if (patch.nexstarIndoorTempF !== undefined) {
      state.optics.indoorTempF = Number(patch.nexstarIndoorTempF);
    }
    if (patch.cooldownStartTimestamp !== undefined) {
      state.optics.cooldownStartTimestamp = patch.cooldownStartTimestamp;
    }
    if (patch.alignedStarNames !== undefined) {
      state.optics.alignedStarNames = patch.alignedStarNames;
    }
    if (patch.nightVisionMode !== undefined) {
      applyNightVisionClasses(patch.nightVisionMode);
    }
    return state.settings;
  },

  saveLog(entry = {}) {
    const saved = saveObservationLog(entry);
    state.logs = getObservationLogs();
    return saved;
  },

  deleteLog(id) {
    if (id) {
      state.logs = deleteObservationLog(id);
    }
    return state.logs;
  },

  selectHour(hourIndex) {
    state.selectedHourIndex = Math.max(0, Math.min(47, Number(hourIndex) || 0));
    syncCurrentHourTelemetry();
  },

  selectTarget(targetKey) {
    const cleanKey = String(targetKey || 'saturn').toLowerCase();
    state.selectedTargetId = cleanKey;
    state.selectedTarget = cleanKey;
    if (state.optics) state.optics.selectedTarget = cleanKey;
  },

  selectEyepiece(mm) {
    const val = Number(mm) || 25;
    state.selectedEyepiece = val;
    if (state.optics) state.optics.selectedEyepiece = val;
    saveAppSettings({ selectedEyepieceMm: val });
  },

  toggleReducer(enabled) {
    const val = typeof enabled === 'boolean' ? enabled : !state.optics.hasReducer;
    state.hasReducer = val;
    if (state.optics) state.optics.hasReducer = val;
    saveAppSettings({ reducerActive: val });
  },

  toggleBarlow(enabled) {
    const val = typeof enabled === 'boolean' ? enabled : !state.optics.hasBarlow;
    state.hasBarlow = val;
    if (state.optics) state.optics.hasBarlow = val;
    saveAppSettings({ barlowActive: val });
  },
};

function updateBottomNavBar() {
  const navEl = document.getElementById('app-bottom-nav');
  if (!navEl) return;

  const activeTabKey =
    state.activeScreen === 'fov' ? state.fovReturnScreen || 'optics' : state.activeScreen;

  navEl.querySelectorAll('[data-nav]').forEach((btn) => {
    const btnScreen = normalizeScreenId(btn.getAttribute('data-nav'));
    const isActive = btnScreen === activeTabKey;
    const iconEl = btn.querySelector('.nav-tab-icon');
    const labelEl = btn.querySelector('.nav-tab-label');

    if (isActive) {
      btn.className =
        'nav-tab-btn flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl text-accent bg-accent/10 tap-scale';
      if (iconEl) iconEl.style.fontVariationSettings = "'FILL' 1";
      if (labelEl) {
        labelEl.classList.remove('font-medium');
        labelEl.classList.add('font-bold');
      }
    } else {
      btn.className =
        'nav-tab-btn flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl text-dark-on-surface-variant hover:text-accent tap-scale';
      if (iconEl) iconEl.style.fontVariationSettings = "'FILL' 0";
      if (labelEl) {
        labelEl.classList.remove('font-bold');
        labelEl.classList.add('font-medium');
      }
    }
  });
}

export function renderCurrentScreen() {
  const container = document.getElementById('screen-root');
  if (!container) return;

  updateBottomNavBar();

  switch (state.activeScreen) {
    case 'dashboard':
      renderDashboardScreen(container, state, actions);
      break;
    case 'explore':
      renderExploreSkyScreen(container, state, actions);
      break;
    case 'optics':
      renderTelescopeOpticsScreen(container, state, actions);
      break;
    case 'fov':
      renderFovSimulatorScreen(container, state, actions);
      break;
    case 'map':
      renderSatelliteMapScreen(container, state, actions);
      break;
    case 'logbook':
      renderObservationLogScreen(container, state, actions);
      break;
    default:
      renderDashboardScreen(container, state, actions);
      break;
  }

  if (state.nightVisionMode) {
    applyNightVisionClasses(true);
  }
}

function initApp() {
  if (state.nightVisionMode) {
    applyNightVisionClasses(true);
  }

  const navEl = document.getElementById('app-bottom-nav');
  if (navEl) {
    navEl.querySelectorAll('[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-nav');
        if (target) actions.navigate(target);
      });
    });
  }

  window.addEventListener('darkskies:navigate', (e) => {
    const detail = e.detail || {};
    if (detail.screen) actions.navigate(detail.screen, detail);
  });

  window.history.replaceState({ screen: 'dashboard' }, '');
  window.addEventListener('popstate', () => {
    if (state.activeScreen === 'fov') {
      const backTo = state.fovReturnScreen || 'explore';
      actions.navigate(backTo);
      window.history.pushState({ screen: backTo }, '');
    } else if (state.activeScreen !== 'dashboard') {
      actions.navigate('dashboard');
      window.history.pushState({ screen: 'dashboard' }, '');
    }
  });

  document.addEventListener('backbutton', (e) => {
    if (state.activeScreen === 'fov') {
      e.preventDefault?.();
      actions.navigate(state.fovReturnScreen || 'explore');
    } else if (state.activeScreen !== 'dashboard') {
      e.preventDefault?.();
      actions.navigate('dashboard');
    }
  });

  syncCurrentHourTelemetry();
  renderCurrentScreen();

  getBurlingtonSkyForecast(false)
    .then((liveForecast) => {
      if (liveForecast) {
        state.forecast = liveForecast;
        state.ephemeris = getSolarLunarData(new Date(), BURLINGTON_NC.lat, BURLINGTON_NC.lon);
        if (liveForecast.tonight_plan?.recommended_hour_index !== undefined) {
          state.selectedHourIndex = liveForecast.tonight_plan.recommended_hour_index;
        }
        syncCurrentHourTelemetry();
        if (state.activeScreen === 'dashboard' || state.activeScreen === 'map') {
          renderCurrentScreen();
        }
      }
    })
    .catch((err) => {
      console.warn('[DarkSkies] Using cached/offline Burlington forecast:', err?.message);
    });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
