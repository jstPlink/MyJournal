package it.fplinio.myjournal;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // i plugin locali vanno registrati PRIMA di super.onCreate (Capacitor li carica lì)
        registerPlugin(AppPermissionsPlugin.class);
        registerPlugin(MyJournalWidgetPlugin.class);
        super.onCreate(savedInstanceState);
        widgetTick(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        widgetTick(intent);
    }

    /**
     * Feedback aptico per i tasti del widget. Un widget non può far vibrare al tocco (lo gestisce il launcher):
     * il tic parte appena l'app riceve il link del widget (https://localhost/...), cioè subito dopo il tocco.
     * Leggero, come il resto dell'app (10 ms, ampiezza ridotta).
     */
    private void widgetTick(Intent intent) {
        if (intent == null || intent.getData() == null || !"localhost".equals(intent.getData().getHost())) return;
        try {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null || !v.hasVibrator()) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                v.vibrate(VibrationEffect.createOneShot(10, 90));
            } else {
                v.vibrate(10);
            }
        } catch (Exception ignored) {
            // vibrazione non disponibile: niente
        }
    }
}
