package com.burlington.darkskies;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;

/**
 * High-DPI Native Canvas Renderer for:
 * 1. Android Home Screen Widget (48-Hour Clear Sky Chart Bitmap)
 * 2. Native Android Lock Screen Live Wallpaper & Compact Lock Widget (24-Hour Clear Sky Chart with larger time markers)
 */
public class ClearSkyChartRenderer {

    private static final String[] ROW_LABELS = {"Clouds", "Clarity", "Steady", "Dark", "Temp"};

    /**
     * Renders a crisp ARGB_8888 Bitmap (safely under Android RemoteViews Binder parcel limits)
     * adapted to the widget's aspect ratio and requested hour span (24h or 48h).
     */
    public static Bitmap renderWidgetChartBitmap(
            ClearSkyNativeForecastManager.ForecastSnapshot snap,
            int targetWidthPx,
            int targetHeightPx,
            int hoursToRender
    ) {
        int width = Math.max(640, Math.min(920, targetWidthPx));
        int height = Math.max(200, Math.min(400, targetHeightPx));
        if (width * height > 260_000) {
            height = 260_000 / width;
        }
        Bitmap bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bmp);
        drawChartMatrix(canvas, new RectF(0, 0, width, height), snap, hoursToRender, false);
        return bmp;
    }

    public static Bitmap renderWidgetChartBitmap(
            ClearSkyNativeForecastManager.ForecastSnapshot snap,
            int targetWidthPx,
            int targetHeightPx
    ) {
        return renderWidgetChartBitmap(snap, targetWidthPx, targetHeightPx, 48);
    }

    public static Bitmap renderWidgetChartBitmap(ClearSkyNativeForecastManager.ForecastSnapshot snap) {
        return renderWidgetChartBitmap(snap, 860, 245, 48);
    }

    /**
     * Draws the 24-Hour or 48-Hour Clear Sky Matrix inside `bounds` on any Canvas
     * with resolution-independent typography (no raw-pixel font caps on high-DPI screens).
     */
    public static void drawChartMatrix(
            Canvas canvas,
            RectF bounds,
            ClearSkyNativeForecastManager.ForecastSnapshot snap,
            int requestedHours,
            boolean redNightMode
    ) {
        if (snap == null || snap.hours == null) return;

        final int numHours = (requestedHours <= 24) ? 24 : 48;
        final boolean is24h = (numHours == 24);

        Paint textPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        textPaint.setTypeface(Typeface.create(Typeface.MONOSPACE, Typeface.BOLD));

        Paint cellPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        cellPaint.setStyle(Paint.Style.FILL);

        Paint strokePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        strokePaint.setStyle(Paint.Style.STROKE);

        float labelColWidth = Math.max(66f, bounds.width() * 0.112f);
        float headerHeight = Math.max(32f, bounds.height() * (is24h ? 0.195f : 0.175f));
        float legendFooterHeight = Math.max(22f, bounds.height() * 0.115f);

        float gridLeft = bounds.left + labelColWidth;
        float gridRight = bounds.right - 4f;
        float gridTop = bounds.top + headerHeight;
        float gridBottom = bounds.bottom - legendFooterHeight;

        float totalGridW = Math.max(100f, gridRight - gridLeft);
        float totalGridH = Math.max(40f, gridBottom - gridTop);

        float colStep = totalGridW / (float) numHours;
        float colGap = Math.max(1.5f, colStep * (is24h ? 0.10f : 0.11f));
        float cellW = Math.max(2f, colStep - colGap);

        int numRows = ROW_LABELS.length;
        float rowStep = totalGridH / numRows;
        float rowGap = Math.max(2.5f, rowStep * 0.13f);
        float cellH = Math.max(4f, rowStep - rowGap);

        float cornerR = Math.max(3f, Math.min(7.5f, cellW * 0.22f));

        // 1. Row Labels on the Left (scaled proportionally to screen/bitmap dimensions)
        float rowLabelSize = Math.min(cellH * 0.58f, labelColWidth * 0.205f);
        textPaint.setTextSize(rowLabelSize);
        textPaint.setColor(tint(0xFFCBD5E1, redNightMode));
        textPaint.setTextAlign(Paint.Align.LEFT);
        Paint.FontMetrics fm = textPaint.getFontMetrics();
        float textCenterOffset = (fm.descent + fm.ascent) / 2f;

        for (int r = 0; r < numRows; r++) {
            float cy = gridTop + r * rowStep + (cellH / 2f);
            canvas.drawText(ROW_LABELS[r], bounds.left + 2f, cy - textCenterOffset, textPaint);
        }

        // Locate midnight columns inside the visible window to prevent time marker collisions
        int firstMidnightIdx = -1;
        int secondMidnightIdx = -1;
        for (int i = 1; i < numHours; i++) {
            if (snap.hours[i] != null && snap.hours[i].hour24 == 0) {
                if (firstMidnightIdx == -1) firstMidnightIdx = i;
                else secondMidnightIdx = i;
            }
        }

        // 2. Hourly Columns + Larger, High-Visibility Time Markers
        RectF rect = new RectF();
        Paint headerPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        headerPaint.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD));

        float baseMarkerSize = is24h
                ? Math.min(headerHeight * 0.56f, bounds.width() * 0.0315f)
                : Math.min(headerHeight * 0.50f, bounds.width() * 0.0235f);

        float headerBaseline = bounds.top + headerHeight * 0.67f;
        int hourStepInterval = is24h ? 3 : 6;
        int minStartGap = is24h ? 2 : 4;
        int minMidnightGap = is24h ? 2 : 3;

        for (int i = 0; i < numHours; i++) {
            ClearSkyNativeForecastManager.HourCell h = snap.hours[i];
            if (h == null) continue;

            float x0 = gridLeft + i * colStep;
            float x1 = x0 + cellW;
            float cx = (x0 + x1) * 0.5f;

            // Midnight day divider line
            if (h.hour24 == 0 && i > 0) {
                strokePaint.setColor(tint(0x8800E5FF, redNightMode));
                strokePaint.setStrokeWidth(Math.max(1.8f, bounds.width() * 0.0022f));
                canvas.drawLine(x0 - colGap * 0.5f, bounds.top + 4f, x0 - colGap * 0.5f, gridBottom, strokePaint);
            }

            if (i == 0 && (firstMidnightIdx == -1 || firstMidnightIdx >= minStartGap)) {
                headerPaint.setTextAlign(Paint.Align.LEFT);
                headerPaint.setTextSize(baseMarkerSize);
                headerPaint.setColor(tint(0xFF00E5FF, redNightMode));
                canvas.drawText("Now", gridLeft, headerBaseline, headerPaint);
            } else if (h.hour24 == 0 && i > 0 && i <= numHours - 2) {
                headerPaint.setTextAlign(Paint.Align.LEFT);
                headerPaint.setTextSize(baseMarkerSize * 1.03f);
                headerPaint.setColor(tint(0xFF00E5FF, redNightMode));
                canvas.drawText(h.dayShort, x0 + 3f, headerBaseline, headerPaint);
            } else if (h.hour24 % hourStepInterval == 0 && i >= minStartGap && i <= numHours - 2) {
                boolean nearFirstMid = (firstMidnightIdx != -1 && Math.abs(i - firstMidnightIdx) < minMidnightGap);
                boolean nearSecondMid = (secondMidnightIdx != -1 && Math.abs(i - secondMidnightIdx) < minMidnightGap);
                if (!nearFirstMid && !nearSecondMid) {
                    headerPaint.setTextAlign(Paint.Align.CENTER);
                    headerPaint.setTextSize(baseMarkerSize);
                    boolean isEveningPrime = (h.hour24 == 18 || h.hour24 == 21);
                    headerPaint.setColor(tint(isEveningPrime ? 0xFFFFCA28 : 0xFFF1F5F9, redNightMode));
                    canvas.drawText(h.hourCompact, cx, headerBaseline, headerPaint);
                }
            }

            // Highlight dot above Tonight's prime clear dark hours
            if (i < 16 && h.isNight && h.cloudPct <= 25) {
                cellPaint.setColor(tint(0xFF00E676, redNightMode));
                float dotR = Math.max(2.0f, Math.min(4.2f, cellW * 0.13f));
                canvas.drawCircle(cx, gridTop - dotR * 1.6f, dotR, cellPaint);
            }

            int[] rowColors = new int[]{
                    h.cloudColor,
                    h.clarityColor,
                    h.seeingColor,
                    h.darknessColor,
                    h.tempColor
            };

            for (int r = 0; r < numRows; r++) {
                float y0 = gridTop + r * rowStep;
                float y1 = y0 + cellH;
                rect.set(x0, y0, x1, y1);

                cellPaint.setColor(tint(rowColors[r], redNightMode));
                canvas.drawRoundRect(rect, cornerR, cornerR, cellPaint);

                // Subtle border on deep astronomical night cells so black cells stand out crisply
                if (r == 3 && h.isNight) {
                    strokePaint.setColor(tint(0x5038BDF8, redNightMode));
                    strokePaint.setStrokeWidth(Math.max(1f, bounds.width() * 0.0014f));
                    canvas.drawRoundRect(rect, cornerR, cornerR, strokePaint);
                }
            }
        }

        // 3. Proportional Collision-Free Legend Footer
        Paint legPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        legPaint.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL));
        float legTextSize = Math.min(legendFooterHeight * 0.62f, totalGridW * 0.0235f);
        legPaint.setTextSize(legTextSize);
        float legY = bounds.bottom - 3f;
        float swatchSize = Math.max(8f, legTextSize * 0.78f);

        // Swatch 1: Deep Blue = Clear
        cellPaint.setColor(tint(0xFF003E7E, redNightMode));
        canvas.drawRoundRect(new RectF(gridLeft, legY - swatchSize, gridLeft + swatchSize, legY), 3f, 3f, cellPaint);
        legPaint.setTextAlign(Paint.Align.LEFT);
        legPaint.setColor(tint(0xFF94A3B8, redNightMode));
        String s1Label = "Deep Blue = Clear";
        float s1TextX = gridLeft + swatchSize + 6f;
        canvas.drawText(s1Label, s1TextX, legY - 1f, legPaint);

        // Swatch 2: Pale = Cloudy
        float s2X = s1TextX + legPaint.measureText(s1Label) + Math.max(14f, totalGridW * 0.028f);
        cellPaint.setColor(tint(0xFF95D5D5, redNightMode));
        canvas.drawRoundRect(new RectF(s2X, legY - swatchSize, s2X + swatchSize, legY), 3f, 3f, cellPaint);
        canvas.drawText("Pale = Cloudy", s2X + swatchSize + 6f, legY - 1f, legPaint);

        // Right-aligned window summary
        legPaint.setTextAlign(Paint.Align.RIGHT);
        legPaint.setTypeface(Typeface.create(Typeface.MONOSPACE, Typeface.BOLD));
        legPaint.setColor(tint(0xFF00E5FF, redNightMode));
        canvas.drawText(snap.windowSummary + " · ☾" + snap.moonIllumPct + "%", gridRight, legY - 1f, legPaint);
    }

    /**
     * Renders the Native Lock Screen Live Wallpaper surface:
     * OLED Deep Space backdrop + 24-Hour Clear Sky Chart Card positioned cleanly below the system Lock Screen clock.
     */
    public static void renderLockWallpaperFrame(
            Canvas canvas,
            int w,
            int h,
            ClearSkyNativeForecastManager.ForecastSnapshot snap,
            int positionMode,
            int hoursToRender,
            boolean redNightMode
    ) {
        final int spanHours = (hoursToRender == 48) ? 48 : 24;

        // 1. Pure OLED Deep Space Background
        Paint bgPaint = new Paint();
        bgPaint.setShader(new LinearGradient(
                0, 0, 0, h,
                new int[]{
                        tint(0xFF03060E, redNightMode),
                        tint(0xFF070E1E, redNightMode),
                        tint(0xFF020409, redNightMode)
                },
                new float[]{0f, 0.55f, 1f},
                Shader.TileMode.CLAMP
        ));
        canvas.drawRect(0, 0, w, h, bgPaint);

        // 2. Subtle Cosmic Starfield (deterministic, zero idle battery cost)
        Paint starPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        for (int i = 0; i < 64; i++) {
            float sx = ((i * 197 + 43) % 997) / 997f * w;
            float sy = ((i * 131 + 19) % 991) / 991f * (h * 0.88f);
            float r = (i % 7 == 0) ? 2.1f : 1.15f;
            int alpha = 50 + ((i * 29) % 135);
            int baseStar = redNightMode ? 0xFFFF3B30 : 0xFFE2E8F0;
            starPaint.setColor((alpha << 24) | (baseStar & 0x00FFFFFF));
            canvas.drawCircle(sx, sy, r, starPaint);
        }

        float sidePad = w * 0.046f;
        float contentW = w - sidePad * 2f;

        // Vertical anchor positioned below the phone's native Lock Screen clock and above the fingerprint sensor
        float cursorY;
        if (positionMode == 0) {
            cursorY = h * 0.34f; // Upper (below compact system clock)
        } else if (positionMode == 2) {
            cursorY = h * 0.50f; // Lower (below tall/stacked system clock)
        } else if (positionMode == 3) {
            cursorY = h * 0.56f; // Extra low
        } else {
            cursorY = h * 0.42f; // Default Center: clears standard system clock (~35%) & fingerprint (~80%)
        }

        // 3. Astral Glass 24-Hour Clear Sky Chart Card
        float cardHeight = Math.min(h * 0.295f, w * 0.57f);
        RectF cardRect = new RectF(sidePad, cursorY, sidePad + contentW, cursorY + cardHeight);

        Paint cardBg = new Paint(Paint.ANTI_ALIAS_FLAG);
        cardBg.setColor(redNightMode ? 0xEB120202 : 0xEB09101D);
        canvas.drawRoundRect(cardRect, 36f, 36f, cardBg);

        Paint cardStroke = new Paint(Paint.ANTI_ALIAS_FLAG);
        cardStroke.setStyle(Paint.Style.STROKE);
        cardStroke.setStrokeWidth(2.2f);
        cardStroke.setColor(tint(0xFF23344D, redNightMode));
        canvas.drawRoundRect(cardRect, 36f, 36f, cardStroke);

        // Card Header Row: Title + Tonight Verdict Badge
        float innerPad = w * 0.036f;
        Paint cardTitle = new Paint(Paint.ANTI_ALIAS_FLAG);
        cardTitle.setTypeface(Typeface.create(Typeface.MONOSPACE, Typeface.BOLD));
        cardTitle.setTextSize(w * 0.030f);
        cardTitle.setColor(tint(0xFFE2E8F0, redNightMode));
        float titleY = cardRect.top + innerPad + w * 0.024f;
        canvas.drawText(spanHours + "H CLEAR SKY · BURLINGTON", cardRect.left + innerPad, titleY, cardTitle);

        if (snap != null) {
            cardTitle.setTextAlign(Paint.Align.RIGHT);
            cardTitle.setColor(tint(snap.isPrimeClear ? 0xFF00E676 : 0xFFFFB74D, redNightMode));
            canvas.drawText(snap.verdict + " · " + snap.eveningTempF + "°F", cardRect.right - innerPad, titleY, cardTitle);
        }

        // Matrix inside Card
        RectF matrixBounds = new RectF(
                cardRect.left + innerPad,
                titleY + w * 0.018f,
                cardRect.right - innerPad,
                cardRect.bottom - innerPad * 0.72f
        );
        drawChartMatrix(canvas, matrixBounds, snap, spanHours, redNightMode);
    }

    /**
     * Converts any ARGB color to scotopic eye-safe deep red when Red Night Mode is enabled.
     */
    private static int tint(int argb, boolean redMode) {
        if (!redMode) return argb;
        int a = (argb >>> 24) & 0xFF;
        int r = (argb >>> 16) & 0xFF;
        int g = (argb >>> 8) & 0xFF;
        int b = argb & 0xFF;
        int lum = (int) (0.299f * r + 0.587f * g + 0.114f * b);
        int redOut = Math.min(255, Math.max(18, (int) (lum * 0.92f)));
        return (a << 24) | (redOut << 16);
    }
}
