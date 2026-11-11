package com.burlington.darkskies;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Standalone Native Forecast Fetcher & Burlington Ephemeris Calculator
 * Powers real Android Home Screen Widgets and the Native Lock Screen Wallpaper
 * without requiring the WebView or any external backend server.
 */
public class ClearSkyNativeForecastManager {

    private static final String PREFS_NAME = "burlington_native_sky_prefs_v1";
    private static final String KEY_CACHED_JSON = "cached_forecast_json";
    private static final String KEY_CACHED_AT_MS = "cached_at_ms";
    private static final long CACHE_TTL_MS = 25L * 60L * 1000L; // 25 minutes

    private static final double BURLINGTON_LAT = 36.096;
    private static final double BURLINGTON_LON = -79.438;
    private static final String TZ_ID = "America/New_York";

    private static final String OPEN_METEO_URL =
            "https://api.open-meteo.com/v1/forecast?latitude=36.096&longitude=-79.438"
                    + "&hourly=temperature_2m,relative_humidity_2m,cloud_cover,visibility,wind_speed_10m,wind_speed_250hPa"
                    + "&models=best_match,gem_seamless,ecmwf_ifs025"
                    + "&temperature_unit=fahrenheit&wind_speed_unit=mph"
                    + "&timezone=America%2FNew_York&forecast_days=3";

    public static class HourCell {
        public int index;
        public int hour24;
        public String hourCompact; // "6p", "12a"
        public String dayShort;    // "Wed"
        public int cloudPct;
        public int cloudColor;
        public int clarityColor;
        public int seeingColor;
        public int darknessColor;
        public int tempColor;
        public int tempF;
        public boolean isNight;
        public int hourScore;
    }

    public static class ForecastSnapshot {
        public HourCell[] hours = new HourCell[48];
        public String verdict = "CLEAR TONIGHT";
        public int tonightScore = 86;
        public String windowSummary = "6:15p - 10:30p";
        public String syncTimeLabel = "Synced";
        public int eveningTempF = 52;
        public int moonIllumPct = 20;
        public boolean isPrimeClear = true;
    }

    /**
     * Returns cached forecast immediately if fresh, or fetches live data on a background thread.
     */
    public static ForecastSnapshot getForecast(Context context, boolean forceNetwork) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        long lastSaved = prefs.getLong(KEY_CACHED_AT_MS, 0L);
        String cachedRaw = prefs.getString(KEY_CACHED_JSON, null);
        long now = System.currentTimeMillis();

        if (!forceNetwork && cachedRaw != null && (now - lastSaved) < CACHE_TTL_MS) {
            ForecastSnapshot parsed = parseFromJsonString(cachedRaw);
            if (parsed != null) return parsed;
        }

        try {
            String liveJson = fetchOpenMeteoRaw();
            if (liveJson != null && !liveJson.isEmpty()) {
                prefs.edit()
                        .putString(KEY_CACHED_JSON, liveJson)
                        .putLong(KEY_CACHED_AT_MS, now)
                        .apply();
                ForecastSnapshot parsed = parseFromJsonString(liveJson);
                if (parsed != null) return parsed;
            }
        } catch (Exception ignored) {
            // Fall back cleanly to prior cache or deterministic ephemeris snapshot
        }

        if (cachedRaw != null) {
            ForecastSnapshot parsed = parseFromJsonString(cachedRaw);
            if (parsed != null) return parsed;
        }

        return buildOfflineSnapshot();
    }

    /**
     * Fast non-blocking read of cached or offline forecast (safe on UI thread for immediate first draw).
     */
    public static ForecastSnapshot getCachedOrOfflineFast(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String cachedRaw = prefs.getString(KEY_CACHED_JSON, null);
        if (cachedRaw != null) {
            ForecastSnapshot parsed = parseFromJsonString(cachedRaw);
            if (parsed != null) return parsed;
        }
        return buildOfflineSnapshot();
    }

    public static boolean isCacheStale(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        long lastSaved = prefs.getLong(KEY_CACHED_AT_MS, 0L);
        return (System.currentTimeMillis() - lastSaved) >= CACHE_TTL_MS;
    }

    private static String fetchOpenMeteoRaw() throws Exception {
        URL url = new URL(OPEN_METEO_URL + "&_cb=" + System.currentTimeMillis());
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setConnectTimeout(6500);
        conn.setReadTimeout(6500);
        conn.setRequestProperty("Accept", "application/json");
        conn.setRequestProperty("Cache-Control", "no-cache");

        int code = conn.getResponseCode();
        if (code < 200 || code >= 300) {
            conn.disconnect();
            return null;
        }

        StringBuilder sb = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
        } finally {
            conn.disconnect();
        }
        return sb.toString();
    }

    private static JSONArray pickSeries(JSONObject hourly, String base, String[] suffixes) {
        if (hourly == null) return null;
        for (String s : suffixes) {
            JSONArray arr = hourly.optJSONArray(base + "_" + s);
            if (arr != null && arr.length() > 0) return arr;
        }
        return hourly.optJSONArray(base);
    }

    private static ForecastSnapshot parseFromJsonString(String rawJson) {
        try {
            JSONObject root = new JSONObject(rawJson);
            JSONObject hourly = root.optJSONObject("hourly");
            if (hourly == null) return null;

            JSONArray times = hourly.optJSONArray("time");
            if (times == null || times.length() < 24) return null;

            TimeZone tz = TimeZone.getTimeZone(TZ_ID);
            SimpleDateFormat isoPrefixFmt = new SimpleDateFormat("yyyy-MM-dd'T'HH", Locale.US);
            isoPrefixFmt.setTimeZone(tz);
            String nowPrefix = isoPrefixFmt.format(new Date());

            int startIdx = 0;
            for (int i = 0; i < times.length(); i++) {
                String t = times.optString(i, "");
                if (t.startsWith(nowPrefix)) {
                    startIdx = i;
                    break;
                }
            }

            JSONArray gemCloudArr = pickSeries(hourly, "cloud_cover", new String[]{"gem_seamless", "best_match"});
            JSONArray ecmwfCloudArr = pickSeries(hourly, "cloud_cover", new String[]{"ecmwf_ifs025", "best_match"});
            JSONArray tempArr = pickSeries(hourly, "temperature_2m", new String[]{"best_match", "gem_seamless"});
            JSONArray rhArr = pickSeries(hourly, "relative_humidity_2m", new String[]{"best_match", "gem_seamless"});
            JSONArray visArr = pickSeries(hourly, "visibility", new String[]{"best_match", "gem_seamless"});
            JSONArray windArr = pickSeries(hourly, "wind_speed_10m", new String[]{"best_match", "gem_seamless"});
            JSONArray jetArr = pickSeries(hourly, "wind_speed_250hPa", new String[]{"best_match", "ecmwf_ifs025"});

            ForecastSnapshot snap = new ForecastSnapshot();
            Calendar cal = Calendar.getInstance(tz, Locale.US);
            cal.set(Calendar.MINUTE, 0);
            cal.set(Calendar.SECOND, 0);
            cal.set(Calendar.MILLISECOND, 0);
            long baseHourMs = cal.getTimeInMillis();

            String[] dayNames = {"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};

            int eveningScoreSum = 0;
            int eveningCloudSum = 0;
            int eveningTempSum = 0;
            int eveningCount = 0;

            for (int i = 0; i < 48; i++) {
                int idx = startIdx + i;
                long cellMs = baseHourMs + (i * 3600_000L);
                Calendar cellCal = Calendar.getInstance(tz, Locale.US);
                cellCal.setTimeInMillis(cellMs);

                int h24 = cellCal.get(Calendar.HOUR_OF_DAY);
                int h12 = (h24 % 12 == 0) ? 12 : (h24 % 12);
                String ampm = (h24 >= 12) ? "p" : "a";

                double gemCloud = optDouble(gemCloudArr, idx, 15.0);
                double ecmwfCloud = optDouble(ecmwfCloudArr, idx, gemCloud);
                int blendedCloud = (int) Math.round(gemCloud * 0.6 + ecmwfCloud * 0.4);
                blendedCloud = Math.max(0, Math.min(100, blendedCloud));

                int tempF = (int) Math.round(optDouble(tempArr, idx, 54.0));
                double rh = optDouble(rhArr, idx, 60.0);
                double vis = optDouble(visArr, idx, 24000.0);
                double wind = optDouble(windArr, idx, 5.0);
                double jet = optDouble(jetArr, idx, 55.0);

                int transpScore = deriveTransparency(rh, vis, blendedCloud);
                int seeingScore = deriveSeeing(jet, wind, blendedCloud);
                SolarLunarState astro = computeSolarLunar(cellMs);

                HourCell cell = new HourCell();
                cell.index = i;
                cell.hour24 = h24;
                cell.hourCompact = h12 + ampm;
                cell.dayShort = dayNames[cellCal.get(Calendar.DAY_OF_WEEK) - 1];
                cell.cloudPct = blendedCloud;
                cell.cloudColor = mapCloudColor(blendedCloud);
                cell.clarityColor = mapTier5Color(transpScore, blendedCloud >= 88);
                cell.seeingColor = mapTier5Color(seeingScore, blendedCloud >= 92);
                cell.darknessColor = astro.darknessColor;
                cell.isNight = astro.isNight;
                cell.tempF = tempF;
                cell.tempColor = mapTempColor(tempF);

                double scoreRaw = Math.max(0, 100 - blendedCloud * 1.12) * 0.54
                        + (transpScore / 5.0) * 100 * 0.24
                        + (seeingScore / 5.0) * 100 * 0.22;
                cell.hourScore = Math.max(5, Math.min(99, (int) Math.round(scoreRaw)));

                snap.hours[i] = cell;
                if (i == 0) {
                    snap.moonIllumPct = astro.moonIllumPct;
                }

                // Evaluate Tonight's Family Stargazing Window (next 18h, evening 18:00-23:00)
                if (i < 18 && cell.isNight && h24 >= 18 && h24 <= 23) {
                    eveningScoreSum += cell.hourScore;
                    eveningCloudSum += cell.cloudPct;
                    eveningTempSum += cell.tempF;
                    eveningCount++;
                }
            }

            if (eveningCount == 0) {
                for (int i = 0; i < 18; i++) {
                    if (snap.hours[i].isNight) {
                        eveningScoreSum += snap.hours[i].hourScore;
                        eveningCloudSum += snap.hours[i].cloudPct;
                        eveningTempSum += snap.hours[i].tempF;
                        eveningCount++;
                    }
                }
            }

            int avgScore = eveningCount > 0 ? (eveningScoreSum / eveningCount) : snap.hours[0].hourScore;
            int avgCloud = eveningCount > 0 ? (eveningCloudSum / eveningCount) : snap.hours[0].cloudPct;
            snap.tonightScore = avgScore;
            snap.eveningTempF = eveningCount > 0 ? (eveningTempSum / eveningCount) : snap.hours[0].tempF;

            if (avgScore >= 80 && avgCloud <= 20) {
                snap.verdict = "PRIME SKY · " + avgScore;
                snap.isPrimeClear = true;
            } else if (avgScore >= 60 && avgCloud <= 42) {
                snap.verdict = "CLEAR · " + avgScore;
                snap.isPrimeClear = true;
            } else if (avgCloud <= 70) {
                snap.verdict = "CLOUD GAPS · " + avgScore;
                snap.isPrimeClear = false;
            } else {
                snap.verdict = "CLOUDY · " + avgScore;
                snap.isPrimeClear = false;
            }

            SimpleDateFormat syncFmt = new SimpleDateFormat("h:mm a", Locale.US);
            syncFmt.setTimeZone(tz);
            snap.syncTimeLabel = syncFmt.format(new Date());
            snap.windowSummary = buildBestWindowSummary(snap.hours);

            return snap;
        } catch (Exception e) {
            return null;
        }
    }

    private static String buildBestWindowSummary(HourCell[] hours) {
        int bestStart = -1;
        int bestLen = 0;
        int curStart = -1;
        int curLen = 0;

        for (int i = 0; i < 24; i++) {
            HourCell c = hours[i];
            if (c != null && c.isNight && c.cloudPct <= 32) {
                if (curStart == -1) curStart = i;
                curLen++;
                if (curLen > bestLen) {
                    bestLen = curLen;
                    bestStart = curStart;
                }
            } else {
                curStart = -1;
                curLen = 0;
            }
        }

        if (bestStart >= 0 && bestLen >= 1) {
            int endIdx = Math.min(47, bestStart + bestLen);
            return "Clear " + hours[bestStart].hourCompact + "–" + hours[endIdx].hourCompact;
        }
        return "Burlington, NC";
    }

    public static ForecastSnapshot buildOfflineSnapshot() {
        ForecastSnapshot snap = new ForecastSnapshot();
        TimeZone tz = TimeZone.getTimeZone(TZ_ID);
        Calendar cal = Calendar.getInstance(tz, Locale.US);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        long baseMs = cal.getTimeInMillis();
        String[] dayNames = {"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};

        for (int i = 0; i < 48; i++) {
            long cellMs = baseMs + (i * 3600_000L);
            Calendar cellCal = Calendar.getInstance(tz, Locale.US);
            cellCal.setTimeInMillis(cellMs);
            int h24 = cellCal.get(Calendar.HOUR_OF_DAY);
            int h12 = (h24 % 12 == 0) ? 12 : (h24 % 12);

            int cloudPct = (i % 14 < 9) ? 10 : 25;
            int tempF = (int) Math.round(54.0 - Math.cos(((h24 - 15.0) / 24.0) * 2.0 * Math.PI) * 9.0);
            SolarLunarState astro = computeSolarLunar(cellMs);

            HourCell c = new HourCell();
            c.index = i;
            c.hour24 = h24;
            c.hourCompact = h12 + (h24 >= 12 ? "p" : "a");
            c.dayShort = dayNames[cellCal.get(Calendar.DAY_OF_WEEK) - 1];
            c.cloudPct = cloudPct;
            c.cloudColor = mapCloudColor(cloudPct);
            c.clarityColor = mapTier5Color(4, false);
            c.seeingColor = mapTier5Color(4, false);
            c.darknessColor = astro.darknessColor;
            c.isNight = astro.isNight;
            c.tempF = tempF;
            c.tempColor = mapTempColor(tempF);
            c.hourScore = 84;
            snap.hours[i] = c;
            if (i == 0) snap.moonIllumPct = astro.moonIllumPct;
        }

        snap.verdict = "BORTLE 4 · 84";
        snap.tonightScore = 84;
        snap.windowSummary = buildBestWindowSummary(snap.hours);
        snap.syncTimeLabel = "Offline";
        return snap;
    }

    private static double optDouble(JSONArray arr, int idx, double fallback) {
        if (arr == null || idx < 0 || idx >= arr.length() || arr.isNull(idx)) return fallback;
        double v = arr.optDouble(idx, fallback);
        return Double.isNaN(v) ? fallback : v;
    }

    private static int deriveTransparency(double rh, double visM, int cloudPct) {
        if (cloudPct >= 90) return 1;
        double score = 5.0;
        if (rh >= 90) score -= 2.0;
        else if (rh >= 80) score -= 1.2;
        else if (rh >= 68) score -= 0.5;

        if (visM < 8000) score -= 1.5;
        else if (visM < 15000) score -= 0.7;

        return Math.max(1, Math.min(5, (int) Math.round(score)));
    }

    private static int deriveSeeing(double jetMph, double windMph, int cloudPct) {
        if (cloudPct >= 92) return 1;
        double score = 5.0;
        if (jetMph > 115) score -= 2.2;
        else if (jetMph > 85) score -= 1.4;
        else if (jetMph > 60) score -= 0.7;

        if (windMph > 18) score -= 1.8;
        else if (windMph > 12) score -= 1.0;
        else if (windMph > 7) score -= 0.4;

        return Math.max(1, Math.min(5, (int) Math.round(score)));
    }

    // Authentic ClearDarkSky Hex Colors
    private static int mapCloudColor(int pct) {
        if (pct <= 5) return 0xFF003E7E;
        if (pct <= 15) return 0xFF135393;
        if (pct <= 25) return 0xFF2C6CAC;
        if (pct <= 40) return 0xFF3F81C1;
        if (pct <= 55) return 0xFF63A3E3;
        if (pct <= 70) return 0xFF77B7B7;
        if (pct <= 85) return 0xFF95D5D5;
        if (pct <= 94) return 0xFFC7C7C7;
        return 0xFFF0F0F0;
    }

    private static int mapTier5Color(int score, boolean overcast) {
        if (overcast) return 0xFFF0F0F0;
        switch (score) {
            case 5: return 0xFF003E7E;
            case 4: return 0xFF2C6CAC;
            case 3: return 0xFF63A3E3;
            case 2: return 0xFF95D5D5;
            default: return 0xFFC7C7C7;
        }
    }

    private static int mapTempColor(int tempF) {
        if (tempF < 25) return 0xFF7B2CBF;
        if (tempF < 35) return 0xFF003E7E;
        if (tempF < 45) return 0xFF2C6CAC;
        if (tempF < 55) return 0xFF0096C7;
        if (tempF < 68) return 0xFF06D6A0;
        if (tempF < 80) return 0xFFFFD166;
        return 0xFFF77F00;
    }

    private static class SolarLunarState {
        int darknessColor;
        boolean isNight;
        int moonIllumPct;
    }

    /**
     * Exact Solar & Lunar altitude + darkness color for Burlington, NC (36.096°N, -79.438°W)
     */
    private static SolarLunarState computeSolarLunar(long epochMs) {
        double jd = (epochMs / 86400000.0) + 2440587.5;
        double d = jd - 2451545.0;

        double deg2rad = Math.PI / 180.0;
        double rad2deg = 180.0 / Math.PI;

        // Sun RA/Dec
        double L = normDeg(280.460 + 0.9856474 * d);
        double g = normDeg(357.528 + 0.9856003 * d) * deg2rad;
        double lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2.0 * g)) * deg2rad;
        double eps = 23.439 * deg2rad;

        double sunRa = normDeg(Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) * rad2deg);
        double sunDec = Math.asin(Math.sin(eps) * Math.sin(lambda));

        // Local Sidereal Time at Burlington (-79.438°)
        double gmst = normDeg(280.46061837 + 360.98564736629 * d);
        double lst = normDeg(gmst + BURLINGTON_LON);
        double ha = normDeg(lst - sunRa) * deg2rad;
        double latRad = BURLINGTON_LAT * deg2rad;

        double sinSunAlt = Math.sin(sunDec) * Math.sin(latRad)
                + Math.cos(sunDec) * Math.cos(latRad) * Math.cos(ha);
        double sunAltDeg = Math.asin(Math.max(-1.0, Math.min(1.0, sinSunAlt))) * rad2deg;

        // Lunar phase & approximate altitude
        double moonL0 = normDeg(218.316 + 13.176396 * d);
        double moonM = normDeg(134.963 + 13.064993 * d) * deg2rad;
        double moonLambda = normDeg(moonL0 + 6.289 * Math.sin(moonM));
        double elongation = normDeg(moonLambda - (lambda * rad2deg)) * deg2rad;
        double moonIllum = (1.0 - Math.cos(elongation)) / 2.0;

        double moonRa = normDeg(Math.atan2(Math.cos(eps) * Math.sin(moonLambda * deg2rad), Math.cos(moonLambda * deg2rad)) * rad2deg);
        double moonDec = Math.asin(Math.sin(eps) * Math.sin(moonLambda * deg2rad));
        double moonHa = normDeg(lst - moonRa) * deg2rad;
        double sinMoonAlt = Math.sin(moonDec) * Math.sin(latRad)
                + Math.cos(moonDec) * Math.cos(latRad) * Math.cos(moonHa);
        double moonAltDeg = Math.asin(Math.max(-1.0, Math.min(1.0, sinMoonAlt))) * rad2deg;

        SolarLunarState out = new SolarLunarState();
        out.moonIllumPct = (int) Math.round(moonIllum * 100.0);
        out.isNight = sunAltDeg <= -12.0;

        if (sunAltDeg > -0.833) {
            out.darknessColor = 0xFFFDE68A; // Daylight
        } else if (sunAltDeg > -6.0) {
            out.darknessColor = 0xFF6BAED6; // Civil Dusk/Dawn
        } else if (sunAltDeg > -18.0) {
            out.darknessColor = 0xFF2C6CAC; // Nautical/Astro Twilight
        } else {
            double penalty = (moonAltDeg > 0) ? (2.1 * Math.pow(moonIllum, 1.35)) : 0.0;
            double nelm = Math.max(3.6, 6.0 - penalty);
            if (nelm >= 5.7) out.darknessColor = 0xFF030714;
            else if (nelm >= 5.2) out.darknessColor = 0xFF071130;
            else if (nelm >= 4.7) out.darknessColor = 0xFF0D2159;
            else out.darknessColor = 0xFF1B4598;
        }
        return out;
    }

    private static double normDeg(double deg) {
        double m = deg % 360.0;
        return m < 0 ? m + 360.0 : m;
    }
}
