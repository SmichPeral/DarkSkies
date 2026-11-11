package com.burlington.darkskies;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.util.DisplayMetrics;
import android.widget.RemoteViews;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Real Android Home Screen Widget: Digital Clock + 48-Hour Burlington Clear Sky Chart.
 */
public class ClearSkyHomeWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_MANUAL_REFRESH = "com.burlington.darkskies.ACTION_REFRESH_HOME_WIDGET";
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        // 1. Render immediately from cache/ephemeris so widget never lags on placement
        ClearSkyNativeForecastManager.ForecastSnapshot fastSnap =
                ClearSkyNativeForecastManager.getCachedOrOfflineFast(context);
        pushViewsToWidgets(context, appWidgetManager, appWidgetIds, fastSnap);

        // 2. Refresh live Open-Meteo GEM/ECMWF data asynchronously
        refreshAllAsync(context, false);
    }

    @Override
    public void onAppWidgetOptionsChanged(
            Context context,
            AppWidgetManager appWidgetManager,
            int appWidgetId,
            Bundle newOptions
    ) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions);
        ClearSkyNativeForecastManager.ForecastSnapshot snap =
                ClearSkyNativeForecastManager.getCachedOrOfflineFast(context);
        pushViewsToWidgets(context, appWidgetManager, new int[]{appWidgetId}, snap);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (intent == null) return;
        String action = intent.getAction();
        if (ACTION_MANUAL_REFRESH.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)
                || Intent.ACTION_DATE_CHANGED.equals(action)) {
            refreshAllAsync(context, ACTION_MANUAL_REFRESH.equals(action));
        }
    }

    public static void refreshAllAsync(final Context context, final boolean forceNetwork) {
        final Context appCtx = context.getApplicationContext();
        EXECUTOR.execute(() -> {
            ClearSkyNativeForecastManager.ForecastSnapshot fresh =
                    ClearSkyNativeForecastManager.getForecast(appCtx, forceNetwork);
            AppWidgetManager mgr = AppWidgetManager.getInstance(appCtx);
            int[] homeIds = mgr.getAppWidgetIds(new ComponentName(appCtx, ClearSkyHomeWidgetProvider.class));
            if (homeIds != null && homeIds.length > 0) {
                pushViewsToWidgets(appCtx, mgr, homeIds, fresh);
            }
            int[] lockIds = mgr.getAppWidgetIds(new ComponentName(appCtx, ClearSkyLockWidgetProvider.class));
            if (lockIds != null && lockIds.length > 0) {
                ClearSkyLockWidgetProvider.pushCompactViews(appCtx, mgr, lockIds, fresh);
            }
        });
    }

    public static void pushViewsToWidgets(
            Context context,
            AppWidgetManager mgr,
            int[] widgetIds,
            ClearSkyNativeForecastManager.ForecastSnapshot snap
    ) {
        if (widgetIds == null || widgetIds.length == 0 || snap == null) return;

        // Tap anywhere on widget -> Open Burlington Dark Skies
        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent launchPending = PendingIntent.getActivity(
                context,
                1001,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Tap refresh icon -> Immediate native weather sync
        Intent refreshIntent = new Intent(context, ClearSkyHomeWidgetProvider.class);
        refreshIntent.setAction(ACTION_MANUAL_REFRESH);
        PendingIntent refreshPending = PendingIntent.getBroadcast(
                context,
                1002,
                refreshIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        DisplayMetrics dm = context.getResources().getDisplayMetrics();
        float density = Math.max(1.5f, dm.density);

        for (int id : widgetIds) {
            Bundle opts = mgr.getAppWidgetOptions(id);
            int minWdp = (opts != null) ? opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 320) : 320;
            int maxHdp = (opts != null) ? opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 155) : 155;
            int chartHdp = Math.max(85, maxHdp - 56);

            int targetWpx = (int) (Math.max(260, minWdp - 24) * density);
            int targetHpx = (int) (chartHdp * density);
            Bitmap chartBitmap = ClearSkyChartRenderer.renderWidgetChartBitmap(snap, targetWpx, targetHpx);

            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_clear_sky_home);
            views.setTextViewText(R.id.widget_verdict_badge, snap.verdict);
            views.setTextColor(R.id.widget_verdict_badge, snap.isPrimeClear ? 0xFF00E5FF : 0xFFFFB74D);
            views.setImageViewBitmap(R.id.widget_chart_image, chartBitmap);

            views.setOnClickPendingIntent(R.id.widget_root_container, launchPending);
            views.setOnClickPendingIntent(R.id.widget_chart_image, launchPending);
            views.setOnClickPendingIntent(R.id.widget_btn_refresh, refreshPending);

            mgr.updateAppWidget(id, views);
        }
    }
}
