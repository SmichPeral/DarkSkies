package com.burlington.darkskies;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Canvas;
import android.os.Handler;
import android.os.Looper;
import android.service.wallpaper.WallpaperService;
import android.view.SurfaceHolder;

import java.util.Calendar;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Native Android Lock Screen Live Wallpaper Service.
 * Renders an OLED deep-space backdrop and the 48-Hour Burlington Clear Sky Chart
 * cleanly below the phone's native system Lock Screen clock, with zero CPU usage while the screen is off.
 */
public class ClearSkyLockWallpaperService extends WallpaperService {

    public static final String PREFS_WALLPAPER = "burlington_lock_wallpaper_prefs";
    public static final String KEY_POSITION_MODE = "position_mode"; // 0 = Upper, 1 = Center (Default), 2 = Lower, 3 = Extra Low
    public static final String KEY_HOURS_SPAN = "hours_span";       // 24 (Default) or 48
    public static final String KEY_RED_MODE = "red_mode";           // 0 = Off, 1 = Auto Night (19-06), 2 = Always Red

    private static final ExecutorService FETCH_EXECUTOR = Executors.newSingleThreadExecutor();

    @Override
    public Engine onCreateEngine() {
        return new ClearSkyWallpaperEngine();
    }

    private class ClearSkyWallpaperEngine extends Engine
            implements SharedPreferences.OnSharedPreferenceChangeListener {

        private final Handler mainHandler = new Handler(Looper.getMainLooper());
        private volatile ClearSkyNativeForecastManager.ForecastSnapshot currentSnapshot;
        private boolean isVisible = false;
        private int surfaceWidth = 0;
        private int surfaceHeight = 0;

        private SharedPreferences wallpaperPrefs;

        private final Runnable refreshCheckRunnable = new Runnable() {
            @Override
            public void run() {
                if (isVisible) {
                    if (ClearSkyNativeForecastManager.isCacheStale(getApplicationContext())) {
                        refreshForecastAsync(false);
                    } else {
                        drawFrame();
                    }
                    mainHandler.postDelayed(this, 15L * 60_000L);
                }
            }
        };

        @Override
        public void onCreate(SurfaceHolder surfaceHolder) {
            super.onCreate(surfaceHolder);
            setTouchEventsEnabled(false);
            Context ctx = getApplicationContext();
            wallpaperPrefs = ctx.getSharedPreferences(PREFS_WALLPAPER, MODE_PRIVATE);
            wallpaperPrefs.registerOnSharedPreferenceChangeListener(this);
            currentSnapshot = ClearSkyNativeForecastManager.getCachedOrOfflineFast(ctx);
            refreshForecastAsync(false);
        }

        @Override
        public void onDestroy() {
            isVisible = false;
            mainHandler.removeCallbacksAndMessages(null);
            if (wallpaperPrefs != null) {
                wallpaperPrefs.unregisterOnSharedPreferenceChangeListener(this);
            }
            super.onDestroy();
        }

        @Override
        public void onVisibilityChanged(boolean visible) {
            this.isVisible = visible;
            if (visible) {
                currentSnapshot = ClearSkyNativeForecastManager.getCachedOrOfflineFast(getApplicationContext());
                drawFrame();
                if (ClearSkyNativeForecastManager.isCacheStale(getApplicationContext())) {
                    refreshForecastAsync(false);
                }
                mainHandler.removeCallbacks(refreshCheckRunnable);
                mainHandler.postDelayed(refreshCheckRunnable, 15L * 60_000L);
            } else {
                mainHandler.removeCallbacksAndMessages(null);
            }
        }

        @Override
        public void onSurfaceChanged(SurfaceHolder holder, int format, int width, int height) {
            super.onSurfaceChanged(holder, format, width, height);
            this.surfaceWidth = width;
            this.surfaceHeight = height;
            drawFrame();
        }

        @Override
        public void onSurfaceDestroyed(SurfaceHolder holder) {
            isVisible = false;
            mainHandler.removeCallbacksAndMessages(null);
            super.onSurfaceDestroyed(holder);
        }

        @Override
        public void onSharedPreferenceChanged(SharedPreferences sharedPreferences, String key) {
            if (isVisible) {
                drawFrame();
            }
        }

        private void refreshForecastAsync(final boolean forceNetwork) {
            final Context appCtx = getApplicationContext();
            FETCH_EXECUTOR.execute(() -> {
                ClearSkyNativeForecastManager.ForecastSnapshot fresh =
                        ClearSkyNativeForecastManager.getForecast(appCtx, forceNetwork);
                if (fresh != null) {
                    currentSnapshot = fresh;
                    mainHandler.post(() -> {
                        if (isVisible) {
                            drawFrame();
                        }
                    });
                }
            });
        }

        private boolean resolveRedNightMode(int redPref) {
            if (redPref == 2) return true;
            if (redPref == 1) {
                Calendar cal = Calendar.getInstance(TimeZone.getDefault());
                int hr = cal.get(Calendar.HOUR_OF_DAY);
                return (hr >= 19 || hr < 6);
            }
            return false;
        }

        private void drawFrame() {
            SurfaceHolder holder = getSurfaceHolder();
            if (holder == null) return;

            Canvas canvas = null;
            try {
                canvas = holder.lockCanvas();
                if (canvas != null) {
                    int w = (surfaceWidth > 0) ? surfaceWidth : canvas.getWidth();
                    int h = (surfaceHeight > 0) ? surfaceHeight : canvas.getHeight();

                    int posMode = wallpaperPrefs != null ? wallpaperPrefs.getInt(KEY_POSITION_MODE, 1) : 1;
                    int hoursSpan = wallpaperPrefs != null ? wallpaperPrefs.getInt(KEY_HOURS_SPAN, 24) : 24;
                    int redPref = wallpaperPrefs != null ? wallpaperPrefs.getInt(KEY_RED_MODE, 0) : 0;
                    boolean redNight = resolveRedNightMode(redPref);

                    if (currentSnapshot == null) {
                        currentSnapshot = ClearSkyNativeForecastManager.getCachedOrOfflineFast(getApplicationContext());
                    }

                    ClearSkyChartRenderer.renderLockWallpaperFrame(
                            canvas,
                            w,
                            h,
                            currentSnapshot,
                            posMode,
                            hoursSpan,
                            redNight
                    );
                }
            } catch (Exception ignored) {
                // Surface may transiently detach during lock/unlock transitions
            } finally {
                if (canvas != null) {
                    try {
                        holder.unlockCanvasAndPost(canvas);
                    } catch (Exception ignored) {
                    }
                }
            }
        }
    }
}
