package it.fplinio.myjournal;

import android.Manifest;
import android.app.AlarmManager;
import android.content.Context;
import android.content.Intent;
import android.hardware.Sensor;
import android.hardware.SensorManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Stato dei permessi dell'app per Impostazioni → Permessi (src/lib/permissions.js
 * + src/components/PermissionsSettings.jsx): microfono (dettatura), notifiche e
 * allarmi precisi (promemoria), esclusione dal risparmio batteria. Legge lo stato
 * vero di Android — non quello che la WebView crede — e apre le schermate di
 * sistema dove il permesso si cambia a mano.
 */
@CapacitorPlugin(
    name = "AppPermissions",
    permissions = { @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone") }
)
public class AppPermissionsPlugin extends Plugin {

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(readStatus());
    }

    private JSObject readStatus() {
        Context c = getContext();
        JSObject r = new JSObject();
        // "granted" | "denied" | "prompt" | "prompt-with-rationale"
        r.put("microphone", String.valueOf(getPermissionState("microphone")));
        r.put("notifications", NotificationManagerCompat.from(c).areNotificationsEnabled());
        // dall'Android 12 le notifiche all'orario esatto richiedono un permesso a parte
        r.put("exactAlarmsNeeded", Build.VERSION.SDK_INT >= Build.VERSION_CODES.S);
        boolean exact = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            exact = am != null && am.canScheduleExactAlarms();
        }
        r.put("exactAlarms", exact);
        // sensori di movimento (foto che oscillano, src/lib/tilt.js): nessun permesso da concedere, si rileva solo se ci sono
        SensorManager sm = (SensorManager) c.getSystemService(Context.SENSOR_SERVICE);
        r.put("gyroscope", sm != null && (sm.getDefaultSensor(Sensor.TYPE_GYROSCOPE) != null || sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR) != null));
        PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
        r.put("batteryUnrestricted", pm != null && pm.isIgnoringBatteryOptimizations(c.getPackageName()));
        return r;
    }

    @PluginMethod
    public void requestMicrophone(PluginCall call) {
        if ("granted".equals(String.valueOf(getPermissionState("microphone")))) {
            call.resolve(readStatus());
        } else {
            requestPermissionForAlias("microphone", call, "microphoneCallback");
        }
    }

    @PermissionCallback
    private void microphoneCallback(PluginCall call) {
        call.resolve(readStatus());
    }

    /** Schermata dell'app in Impostazioni di Android (tutti i permessi). */
    @PluginMethod
    public void openSettings(PluginCall call) {
        open(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName())));
        call.resolve();
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
            .putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        open(i);
        call.resolve();
    }

    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            open(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getContext().getPackageName())));
        } else {
            open(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName())));
        }
        call.resolve();
    }

    /** Elenco delle app con risparmio batteria: lì si sceglie "Nessuna restrizione" per MyJournal. */
    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        open(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
        call.resolve();
    }

    private void open(Intent intent) {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
        } catch (Exception e) {
            // schermata non disponibile su questo telefono: ripiego sulle impostazioni dell'app
            Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
            fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(fallback);
        }
    }
}
