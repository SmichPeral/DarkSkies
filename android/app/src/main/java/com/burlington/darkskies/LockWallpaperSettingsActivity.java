package com.burlington.darkskies;

import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

/**
 * Native Android Settings Activity for the Burlington Clear Sky Lock Screen Live Wallpaper.
 * Accessible directly from the "Settings" gear inside Android's Live Wallpaper preview.
 */
public class LockWallpaperSettingsActivity extends AppCompatActivity {

    private SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences(ClearSkyLockWallpaperService.PREFS_WALLPAPER, MODE_PRIVATE);
        rebuildSettingsUi();
    }

    private void rebuildSettingsUi() {
        int hoursSpan = prefs.getInt(ClearSkyLockWallpaperService.KEY_HOURS_SPAN, 24);
        int posMode = prefs.getInt(ClearSkyLockWallpaperService.KEY_POSITION_MODE, 1);
        int redMode = prefs.getInt(ClearSkyLockWallpaperService.KEY_RED_MODE, 0);

        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(0xFF050912);
        scroll.setFillViewport(true);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        int padH = dp(20);
        int padV = dp(28);
        root.setPadding(padH, padV, padH, padV);

        // Title
        TextView title = new TextView(this);
        title.setText("Lock Screen Sky Settings");
        title.setTextColor(0xFFF8FAFC);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        title.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD));
        root.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText("Position the 24-Hour Burlington Clear Sky Chart cleanly beneath your phone's system Lock Screen clock.");
        subtitle.setTextColor(0xFF94A3B8);
        subtitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13.5f);
        subtitle.setPadding(0, dp(6), 0, dp(18));
        root.addView(subtitle);

        // Section 0: Forecast Window Span (24h Default vs 48h)
        root.addView(makeSectionLabel("FORECAST TIMELINE SPAN"));
        root.addView(makeOptionButton(
                "24-Hour Clear Sky Chart (Default)",
                "Wider hourly blocks and larger 3-hour time markers built for Lock Screen readability.",
                hoursSpan == 24,
                v -> {
                    prefs.edit().putInt(ClearSkyLockWallpaperService.KEY_HOURS_SPAN, 24).apply();
                    rebuildSettingsUi();
                }
        ));
        root.addView(makeOptionButton(
                "48-Hour Clear Sky Chart",
                "Full two-day hourly forecast grid.",
                hoursSpan == 48,
                v -> {
                    prefs.edit().putInt(ClearSkyLockWallpaperService.KEY_HOURS_SPAN, 48).apply();
                    rebuildSettingsUi();
                }
        ));

        // Section 1: Vertical Position
        root.addView(makeSectionLabel("CHART VERTICAL POSITION"));
        String[][] posOptions = {
                {"Upper Position", "Best when using a compact single-line system clock."},
                {"Center Position (Default)", "Sits cleanly below standard system clocks and above the fingerprint sensor."},
                {"Lower Position", "Best when using a tall or stacked double-line system clock."},
                {"Extra Low Position", "Extra clearance for large lock screen widgets above."}
        };
        for (int i = 0; i < posOptions.length; i++) {
            final int modeVal = i;
            root.addView(makeOptionButton(
                    posOptions[i][0],
                    posOptions[i][1],
                    posMode == modeVal,
                    v -> {
                        prefs.edit().putInt(ClearSkyLockWallpaperService.KEY_POSITION_MODE, modeVal).apply();
                        rebuildSettingsUi();
                    }
            ));
        }

        // Section 2: Eye-Safe Red Night Vision
        root.addView(makeSectionLabel("EYE-SAFE RED NIGHT VISION"));
        String[][] redOptions = {
                {"Standard ClearDarkSky Colors", "Authentic deep-blue Clear Sky Chart palette."},
                {"Auto Red Mode at Night (7 PM – 6 AM)", "Automatically switches to scotopic red at night."},
                {"Always Eye-Safe Red", "Preserves dark adaptation around your NexStar 8SE."}
        };
        for (int i = 0; i < redOptions.length; i++) {
            final int redVal = i;
            root.addView(makeOptionButton(
                    redOptions[i][0],
                    redOptions[i][1],
                    redMode == redVal,
                    v -> {
                        prefs.edit().putInt(ClearSkyLockWallpaperService.KEY_RED_MODE, redVal).apply();
                        rebuildSettingsUi();
                    }
            ));
        }

        // Actions Row: Sync Weather + Done
        LinearLayout actionRow = new LinearLayout(this);
        actionRow.setOrientation(LinearLayout.HORIZONTAL);
        actionRow.setGravity(Gravity.CENTER_VERTICAL);
        actionRow.setPadding(0, dp(22), 0, dp(12));

        Button refreshBtn = new Button(this);
        refreshBtn.setAllCaps(false);
        refreshBtn.setText("Sync 48h Forecast Now");
        refreshBtn.setTextColor(0xFF00E5FF);
        refreshBtn.setBackground(makeRoundedBg(0xFF0E1A2E, 0xFF00E5FF, 14));
        LinearLayout.LayoutParams rLp = new LinearLayout.LayoutParams(0, dp(48), 1f);
        rLp.setMarginEnd(dp(10));
        refreshBtn.setLayoutParams(rLp);
        refreshBtn.setOnClickListener(v -> {
            ClearSkyHomeWidgetProvider.refreshAllAsync(getApplicationContext(), true);
            Toast.makeText(this, "Syncing Burlington 48h Clear Sky forecast…", Toast.LENGTH_SHORT).show();
        });
        actionRow.addView(refreshBtn);

        Button doneBtn = new Button(this);
        doneBtn.setAllCaps(false);
        doneBtn.setText("Done");
        doneBtn.setTextColor(0xFF040812);
        doneBtn.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD));
        doneBtn.setBackground(makeRoundedBg(0xFF00E5FF, 0xFF00E5FF, 14));
        LinearLayout.LayoutParams dLp = new LinearLayout.LayoutParams(dp(110), dp(48));
        doneBtn.setLayoutParams(dLp);
        doneBtn.setOnClickListener(v -> finish());
        actionRow.addView(doneBtn);

        root.addView(actionRow);
        scroll.addView(root);
        setContentView(scroll);
    }

    private TextView makeSectionLabel(String label) {
        TextView tv = new TextView(this);
        tv.setText(label);
        tv.setTextColor(0xFF00E5FF);
        tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11.5f);
        tv.setTypeface(Typeface.create(Typeface.MONOSPACE, Typeface.BOLD));
        tv.setPadding(0, dp(16), 0, dp(8));
        return tv;
    }

    private View makeOptionButton(String titleText, String descText, boolean selected, View.OnClickListener listener) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(14), dp(12), dp(14), dp(12));
        card.setBackground(makeRoundedBg(
                selected ? 0xFF10223A : 0xFF0B1220,
                selected ? 0xFF00E5FF : 0xFF22324A,
                14
        ));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        lp.bottomMargin = dp(8);
        card.setLayoutParams(lp);
        card.setClickable(true);
        card.setFocusable(true);
        card.setOnClickListener(listener);

        TextView t = new TextView(this);
        t.setText((selected ? "●  " : "○  ") + titleText);
        t.setTextColor(selected ? Color.WHITE : 0xFFCBD5E1);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f);
        t.setTypeface(Typeface.create(Typeface.SANS_SERIF, selected ? Typeface.BOLD : Typeface.NORMAL));
        card.addView(t);

        if (descText != null && !descText.isEmpty()) {
            TextView d = new TextView(this);
            d.setText(descText);
            d.setTextColor(0xFF94A3B8);
            d.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f);
            d.setPadding(dp(20), dp(3), 0, 0);
            card.addView(d);
        }
        return card;
    }

    private GradientDrawable makeRoundedBg(int fillArgb, int strokeArgb, int radiusDp) {
        GradientDrawable gd = new GradientDrawable();
        gd.setColor(fillArgb);
        gd.setCornerRadius(dp(radiusDp));
        gd.setStroke(dp(1), strokeArgb);
        return gd;
    }

    private int dp(int val) {
        return Math.round(TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP,
                val,
                getResources().getDisplayMetrics()
        ));
    }
}
