// Firebase Hosting-only recovery path for verified Android App Links.
// Firebase action codes are parsed only in memory and handed to the installed
// BlueGuard package. This module never applies codes or authorizes accounts.
export const BLUEGUARD_HOST = 'oil-spill-monitoring-buoy.firebaseapp.com';
export const BLUEGUARD_PACKAGE = 'com.oilspillmonitoringbuoy.app';
export const FIREBASE_PUBLIC_API_KEY = 'AIzaSyBRk6_gvKOuhc-lzPFCMiezBwl81aqXbP4';
const PATH = '/open/auth-action';
const MODES = new Set(['verifyEmail', 'resetPassword']);
const CODE = /^[A-Za-z0-9_-]{1,2048}$/;

export function parseFallbackAction(raw) {
  if (typeof raw !== 'string' || raw.length > 4096) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.host !== BLUEGUARD_HOST || u.pathname !== PATH ||
        u.username || u.password || u.hash) return null;
    const p = u.searchParams;
    let count = 0;
    p.forEach(() => count++);
    if (count !== 3 || ['mode', 'oobCode', 'apiKey'].some(k => p.getAll(k).length !== 1)) return null;
    const mode = p.get('mode');
    const code = p.get('oobCode');
    if (!MODES.has(mode) || !CODE.test(code ?? '') || p.get('apiKey') !== FIREBASE_PUBLIC_API_KEY) return null;
    return {mode, code};
  } catch {
    return null;
  }
}

export function buildBlueGuardIntent(action) {
  if (!action || !MODES.has(action.mode) || !CODE.test(action.code ?? '')) {
    throw new Error('INVALID_BLUEGUARD_ACTION');
  }
  const params = new URLSearchParams({mode: action.mode, oobCode: action.code, apiKey: FIREBASE_PUBLIC_API_KEY});
  // Explicit package targets only the installed BlueGuard app. A browser must
  // trigger this on a real user tap; no timer, automatic redirect or iframe.
  return 'intent://' + BLUEGUARD_HOST + PATH + '?' + params.toString() +
    '#Intent;scheme=https;action=android.intent.action.VIEW;' +
    'category=android.intent.category.BROWSABLE;package=' + BLUEGUARD_PACKAGE + ';end';
}
