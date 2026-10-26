import type {ActionCodeSettings} from 'firebase/auth';
import {environment} from '../../environments/environment';

// Firebase's native Hosting email links open directly in installed BlueGuard
// on Android with a verified domain. Its browser action is a fallback if the
// app is absent. The one-time code is verified by Firebase inside the app.
const authDomain=environment.firebase.authDomain;
const packageName='com.oilspillmonitoringbuoy.app';
export function firebaseEmailActionSettings(kind:'verify'|'reset'):ActionCodeSettings {
  if(!/^[a-z0-9-]+\.firebaseapp\.com$/.test(authDomain)) {
    throw new Error('Firebase email return domain is not configured');
  }
  const action=kind==='verify'?'email-verified':'password-reset-complete';
  return {
    url:'https://'+authDomain+'/open/'+action,
    handleCodeInApp:true,
    android:{packageName,installApp:false},
  };
}
