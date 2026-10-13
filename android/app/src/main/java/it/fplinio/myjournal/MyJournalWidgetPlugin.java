package it.fplinio.myjournal;

import android.content.Context;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Ponte fra l'app e il widget 3x1 (MyJournalSummaryWidget): il frontend manda un riepilogo
 * (mood giornaliero degli ultimi giorni, ultima nota, gradiente del mood) e il widget lo mostra.
 * Vedi src/lib/widgetSync.js.
 */
@CapacitorPlugin(name = "MyJournalWidget")
public class MyJournalWidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        Context c = getContext();
        c.getSharedPreferences(MyJournalSummaryWidget.PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(MyJournalSummaryWidget.KEY_DATA, call.getData().toString())
            .apply();
        MyJournalSummaryWidget.updateAll(c);
        call.resolve();
    }
}
