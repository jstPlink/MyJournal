package it.fplinio.myjournal;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

// Widget "Nuova nota": un tocco apre l'app direttamente sull'editor di una
// nuova nota (il frontend gestisce l'URL, vedi WidgetLinks in App.jsx).
public class NewNoteWidget extends AppWidgetProvider {
    // Layout del widget: la variante 1x1 (NewNoteSmallWidget) ne usa un altro.
    protected int layoutId() {
        return R.layout.widget_new_note;
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://localhost/note/new"));
        intent.setComponent(new ComponentName(context, MainActivity.class));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(
            context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        for (int id : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), layoutId());
            views.setOnClickPendingIntent(R.id.widget_root, pending);
            manager.updateAppWidget(id, views);
        }
    }
}
