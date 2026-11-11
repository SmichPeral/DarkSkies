package com.burlington.darkskies;

import android.app.Activity;
import android.app.WallpaperManager;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.widget.Toast;

/**
 * Zero-UI Native Android OS Launcher Shortcut Handler.
 * Triggered when long-pressing the Burlington Dark Skies app icon on the Home Screen:
 *  - "Pin Sky Widget": Opens Android's native Pin Widget sheet for the Digital Clock + 48h Clear Sky Widget
 *  - "Set Lock Screen": Opens Android's native Live Wallpaper picker directly to Burlington Clear Sky Lock Screen
 */
public class NativeSkyShortcutActivity extends Activity {

    public static final String ACTION_PIN_HOME_WIDGET = "com.burlington.darkskies.SHORTCUT_PIN_HOME_WIDGET";
    public static final String ACTION_SET_LOCK_SCREEN = "com.burlington.darkskies.SHORTCUT_SET_LOCK_SCREEN";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Intent incoming = getIntent();
        String action = incoming != null ? incoming.getAction() : null;

        if (ACTION_PIN_HOME_WIDGET.equals(action)) {
            handlePinWidget();
        } else if (ACTION_SET_LOCK_SCREEN.equals(action)) {
            handleOpenLockWallpaperPicker();
        }

        finish();
    }

    private void handlePinWidget() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AppWidgetManager mgr = AppWidgetManager.getInstance(this);
            if (mgr != null && mgr.isRequestPinAppWidgetSupported()) {
                ComponentName provider = new ComponentName(this, ClearSkyHomeWidgetProvider.class);
                boolean requested = mgr.requestPinAppWidget(provider, null, null);
                if (requested) return;
            }
        }
        Toast.makeText(
                this,
                "Long-press your Home Screen → Widgets → Burlington Dark Skies to place the widget.",
                Toast.LENGTH_LONG
        ).show();
    }

    private void handleOpenLockWallpaperPicker() {
        try {
            Intent wpIntent = new Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER);
            wpIntent.putExtra(
                    WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT,
                    new ComponentName(this, ClearSkyLockWallpaperService.class)
            );
            wpIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(wpIntent);
            Toast.makeText(
                    this,
                    "Tap 'Set wallpaper' → choose 'Lock screen'",
                    Toast.LENGTH_LONG
            ).show();
        } catch (Exception firstErr) {
            try {
                Intent chooser = new Intent(WallpaperManager.ACTION_LIVE_WALLPAPER_CHOOSER);
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(chooser);
            } catch (Exception secondErr) {
                Toast.makeText(
                        this,
                        "Open Settings → Wallpaper & style → Live wallpapers → Burlington Clear Sky Lock Screen",
                        Toast.LENGTH_LONG
                ).show();
            }
        }
    }
}
