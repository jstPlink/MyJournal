package it.fplinio.myjournal;

import android.appwidget.AppWidgetManager;
import android.content.Context;

/**
 * Widget 1x3 verticale "MyJournal": gli stessi dati e gli stessi tocchi del 4x1
 * ({@link MyJournalSummaryWidget}), con i tre blocchi impilati (res/layout/widget_summary_vertical.xml).
 * Il disegno lo fa MyJournalSummaryWidget.render, che qui riceve il layout verticale.
 */
public class MyJournalSummaryVerticalWidget extends MyJournalSummaryWidget {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        render(context, manager, appWidgetIds, R.layout.widget_summary_vertical);
    }
}
