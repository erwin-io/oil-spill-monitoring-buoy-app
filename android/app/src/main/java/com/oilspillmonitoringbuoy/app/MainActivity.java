package com.oilspillmonitoringbuoy.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import org.json.JSONObject;
import com.getcapacitor.BridgeActivity;

// HTTPS App Links are verified by Android against the Hosting assetlinks.json.
// Only the trusted Angular Firebase SDK consumes email-action codes. Native
// code forwards an exact verified-host App Link, never validates or logs codes.
public class MainActivity extends BridgeActivity {
    private static final String APP_LINK_HOST = "oil-spill-monitoring-buoy.firebaseapp.com";
    private String lastDeliveredAppLink = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        deliverAppLink(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        lastDeliveredAppLink = null; // A new explicit tap may intentionally repeat a previous link.
        deliverAppLink(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        deliverAppLink(getIntent());
    }

    private void deliverAppLink(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return;
        final Uri uri = intent.getData();
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme())
                || !APP_LINK_HOST.equalsIgnoreCase(uri.getHost())) return;
        final String path = uri.getPath();
        if (!"/open/invite".equals(path) && !"/open/transfer".equals(path)
                && !"/open/email-verified".equals(path)
                && !"/open/password-reset-complete".equals(path)
                && !"/open/auth-action".equals(path)) return;
        if (uri.toString().length() > ("/open/auth-action".equals(path) ? 4096 : 1024)) return;
        if (uri.toString().equals(lastDeliveredAppLink)) return; // Prevent onCreate/onResume duplicates.
        lastDeliveredAppLink = uri.toString();
        final String value = JSONObject.quote(uri.toString());
        // Store the pending link before dispatch. Cold-start JS may not have subscribed.
        // JSON quoting prevents script injection from URL content.
        final String js = "window.sessionStorage.setItem('blueguard.pending-link.v1'," + value
                + ");window.dispatchEvent(new CustomEvent('blueguard:app-link',{detail:" + value + "}));";
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().postDelayed(() ->
                bridge.getWebView().evaluateJavascript(js, null), 900);
        }
    }
}
