package it.fplinio.myjournal;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Locale;

/**
 * Widget 4x1 "MyJournal": tre blocchi CONCETTUALI (non separati da linee o riquadri) —
 *  1. a sinistra il mood degli ultimi 3 giorni (media dei mood giornalieri);
 *  2. al centro l'ultima nota: giorno e ora in cui è finita (l'orario di fine, senza altro testo);
 *  3. a destra il pulsante per scrivere una nota nuova (un tocco apre l'editor).
 *
 * I dati NON li legge da sé: li manda l'app (src/lib/widgetSync.js → MyJournalWidgetPlugin) ogni volta che si
 * apre, torna in primo piano o salva/elimina una nota, e restano in SharedPreferences. Qui si fanno solo i
 * calcoli che dipendono da "oggi" (finestra dei 3 giorni, "oggi"/"ieri"), così il widget resta giusto anche
 * a mezzanotte senza riaprire l'app: si ridisegna ogni ~30 minuti. Il colore del mood segue il gradiente
 * scelto dall'utente (mandato insieme ai dati).
 */
public class MyJournalSummaryWidget extends AppWidgetProvider {
    static final String PREFS = "myjournal_widget";
    static final String KEY_DATA = "data";

    private static final String[] MONTHS = { "gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic" };

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        render(context, manager, appWidgetIds, R.layout.widget_summary);
    }

    /** Ridisegna tutte le istanze (dopo nuovi dati dall'app). */
    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, MyJournalSummaryWidget.class));
        if (ids.length > 0) render(context, manager, ids, R.layout.widget_summary);
        // la variante verticale 1x3 (MyJournalSummaryVerticalWidget) ha gli stessi id con un altro layout
        int[] vIds = manager.getAppWidgetIds(new ComponentName(context, MyJournalSummaryVerticalWidget.class));
        if (vIds.length > 0) render(context, manager, vIds, R.layout.widget_summary_vertical);
    }

    private static PendingIntent open(Context context, String path, int code) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://localhost" + path));
        intent.setComponent(new ComponentName(context, MainActivity.class));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, code, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void render(Context context, AppWidgetManager manager, int[] ids, int layout) {
        JSONObject data = null;
        try {
            String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_DATA, null);
            if (raw != null) data = new JSONObject(raw);
        } catch (Exception ignored) {
            data = null;
        }

        String today = ymd(0);
        String weekStart = ymd(-2); // ultimi 3 giorni: oggi, ieri, l'altro ieri

        // ---- blocco centrale: mood degli ultimi 3 giorni ----
        String moodText = "—";
        int moodColor = Color.parseColor("#b9b4a8");
        if (data != null) {
            JSONArray days = data.optJSONArray("days");
            double sum = 0;
            int nDays = 0;
            for (int i = 0; days != null && i < days.length(); i++) {
                JSONObject d = days.optJSONObject(i);
                if (d == null) continue;
                String day = d.optString("d");
                if (day.compareTo(weekStart) < 0 || day.compareTo(today) > 0) continue;
                sum += d.optDouble("m", 0);
                nDays++;
            }
            if (nDays > 0) {
                double avg = sum / nDays;
                moodText = String.valueOf(Math.round(avg * 100)); // in centesimi (0–100)
                moodColor = gradientColor(data.optJSONArray("stops"), avg);
            }
        }

        // ---- blocco di destra: ultima nota (giorno e ora di fine) ----
        String lastDay = "—";
        String lastSub = data == null ? "apri l'app" : "nessuna nota";
        String lastPath = "/";
        JSONObject last = data == null ? null : data.optJSONObject("last");
        if (last != null && last.optString("date").length() == 10) {
            String date = last.optString("date");
            lastDay = dayLabel(date);
            String end = last.optString("end");
            lastSub = end;
            lastPath = "/day/" + date;
        }

        for (int id : ids) {
            RemoteViews v = new RemoteViews(context.getPackageName(), layout);
            v.setTextViewText(R.id.sum_mood_value, moodText);
            v.setInt(R.id.sum_mood_dot, "setColorFilter", moodColor);
            v.setTextViewText(R.id.sum_last_day, lastDay);
            v.setTextViewText(R.id.sum_last_sub, lastSub);

            PendingIntent newNote = open(context, "/note/new", 11);
            // il pulsante sono due copie che si alternano (animazione): il tocco vale su entrambe e sul contenitore
            v.setOnClickPendingIntent(R.id.sum_btn_new, newNote);
            v.setOnClickPendingIntent(R.id.sum_btn_new2, newNote);
            v.setOnClickPendingIntent(R.id.sum_flipper, newNote);
            v.setOnClickPendingIntent(R.id.sum_block_mood, open(context, "/dati", 12));
            v.setOnClickPendingIntent(R.id.sum_block_last, open(context, lastPath, 13));
            manager.updateAppWidget(id, v);
        }
    }

    /** "YYYY-MM-DD" di oggi + offset giorni. */
    private static String ymd(int offsetDays) {
        Calendar c = Calendar.getInstance();
        c.add(Calendar.DAY_OF_YEAR, offsetDays);
        return String.format(Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    /** "oggi", "ieri" oppure "x giorni fa" (giorni di calendario, non ore). */
    private static String dayLabel(String date) {
        if (date.equals(ymd(0))) return "oggi";
        if (date.equals(ymd(-1))) return "ieri";
        try {
            int y = Integer.parseInt(date.substring(0, 4));
            int m = Integer.parseInt(date.substring(5, 7));
            int d = Integer.parseInt(date.substring(8, 10));
            Calendar then = Calendar.getInstance();
            then.set(y, m - 1, d, 12, 0, 0);
            Calendar now = Calendar.getInstance();
            now.set(Calendar.HOUR_OF_DAY, 12);
            now.set(Calendar.MINUTE, 0);
            now.set(Calendar.SECOND, 0);
            long days = Math.round((now.getTimeInMillis() - then.getTimeInMillis()) / 86400000.0);
            if (days < 0) return "oggi"; // data nel futuro (orologi sfasati)
            return days + " giorni fa";
        } catch (Exception e) {
            return date;
        }
    }

    /** Colore del gradiente del mood (stop [{t, c:"#rrggbb"}]) per un valore 0–1. */
    private static int gradientColor(JSONArray stops, double v) {
        try {
            if (stops == null || stops.length() < 2) return Color.parseColor("#b9b4a8");
            v = Math.max(0, Math.min(1, v));
            JSONObject first = stops.getJSONObject(0);
            JSONObject lastStop = stops.getJSONObject(stops.length() - 1);
            if (v <= first.getDouble("t")) return Color.parseColor(first.getString("c"));
            if (v >= lastStop.getDouble("t")) return Color.parseColor(lastStop.getString("c"));
            for (int i = 0; i < stops.length() - 1; i++) {
                JSONObject lo = stops.getJSONObject(i);
                JSONObject hi = stops.getJSONObject(i + 1);
                double t0 = lo.getDouble("t");
                double t1 = hi.getDouble("t");
                if (v >= t0 && v <= t1) {
                    double k = t1 == t0 ? 0 : (v - t0) / (t1 - t0);
                    int a = Color.parseColor(lo.getString("c"));
                    int b = Color.parseColor(hi.getString("c"));
                    return Color.rgb(
                        (int) Math.round(Color.red(a) + (Color.red(b) - Color.red(a)) * k),
                        (int) Math.round(Color.green(a) + (Color.green(b) - Color.green(a)) * k),
                        (int) Math.round(Color.blue(a) + (Color.blue(b) - Color.blue(a)) * k));
                }
            }
        } catch (Exception ignored) {
            // gradiente non valido: colore neutro
        }
        return Color.parseColor("#b9b4a8");
    }
}
