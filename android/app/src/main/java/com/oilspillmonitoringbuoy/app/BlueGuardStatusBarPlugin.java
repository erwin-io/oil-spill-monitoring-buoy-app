package com.oilspillmonitoringbuoy.app;

import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.view.Window;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Native status bar switches to white/dark icons only while a fullscreen
 * BlueGuard authentication progress surface is visible. */
@CapacitorPlugin(name = "BlueGuardStatusBar")
public class BlueGuardStatusBarPlugin extends Plugin {
    @PluginMethod
    public void setBusy(PluginCall call) {
        final boolean busy = Boolean.TRUE.equals(call.getBoolean("busy", false));
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            // Android 15 may enforce edge-to-edge, but light status icons
            // still need explicit appearance changes for a white surface.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                View decor = window.getDecorView();
                int flags = decor.getSystemUiVisibility();
                flags = busy
                    ? flags | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
                    : flags & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                decor.setSystemUiVisibility(flags);
            }
            window.setStatusBarColor(busy ? Color.WHITE : Color.rgb(0, 84, 233));
            call.resolve();
        });
    }
}
