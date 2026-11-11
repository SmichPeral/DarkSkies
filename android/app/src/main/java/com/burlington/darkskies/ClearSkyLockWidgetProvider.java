package com.burlington.darkskies;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.util.DisplayMetrics;
import android.widget.RemoteViews;

/**
 * Compact 48-Hour Clear Sky Chart Widget (Home Screen & Lock Screen Keyguard Widget).
 * Designed for placing directly beneath an existing Lock Screen or Home Screen clock.
 */
public class ClearSkyLockWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_REFRESH_COMPACT = "com.burlington.darkskies.ACTION_REFRESH_LOCK_WIDGET";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        ClearSkyNativeForecastManager.ForecastSnapshot fastSnap =
                ClearSkyNativeForecastManager.getCachedOrOfflineFast(context);
        pushCompactViews(context, appWidgetManager, appWidgetIds, fastSnap);
        ClearSkyHomeWidgetProvider.refreshAllAsync(context, false);
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
        pushCompactViews(context, appWidgetManager, new int[]{appWidgetId}, snap);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (intent != null && ACTION_REFRESH_COMPACT.equals(intent.getAction())) {
            ClearSkyHomeWidgetProvider.refreshAllAsync(context, true);
        }
    }

    public static void pushCompactViews(
            Context context,
            AppWidgetManager mgr,
            int[] widgetIds,
            ClearSkyNativeForecastManager.ForecastSnapshot snap
    ) {
        if (widgetIds == null || widgetIds.length == 0 || snap == null) return;

        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent launchPending = PendingIntent.getActivity(
                context,
                2001,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent refreshIntent = new Intent(context, ClearSkyLockWidgetProvider.class);
        refreshIntent.setAction(ACTION_REFRESH_COMPACT);
        PendingIntent refreshPending = PendingIntent.getBroadcast(
                context,
                2002,
                refreshIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        DisplayMetrics dm = context.getResources().getDisplayMetrics();
        float density = Math.max(1.5f, dm.density);

        for (int id : widgetIds) {
            Bundle opts = mgr.getAppWidgetOptions(id);
            int minWdp = (opts != null) ? opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 320) : 320;
            int maxHdp = (opts != null) ? opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 115) : 115;
            int chartHdp = Math.max(76, maxHdp - 28);

            int targetWpx = (int) (Math.max(260, minWdp - 22) * density);
            int targetHpx = (int) (chartHdp * density);
            Bitmap chartBitmap = ClearSkyChartRenderer.renderWidgetChartBitmap(snap, targetWpx, targetHpx, 24);

            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_clear_sky_compact);
            views.setTextViewText(R.id.widget_compact_verdict, snap.verdict + "  ↻");
            views.setTextColor(R.id.widget_compact_verdict, snap.isPrimeClear ? 0xFF00E5FF : 0xFFFFB74D);
            views.setImageViewBitmap(R.id.widget_compact_chart_image, chartBitmap);

            views.setOnClickPendingIntent(R.id.widget_compact_root, launchPending);
            views.setOnClickPendingIntent(R.id.widget_compact_chart_image, launchPending);
            views.setOnClickPendingIntent(R.id.widget_compact_verdict, refreshPending);

            mgr.updateAppWidget(id, views);
        }
    }
}
