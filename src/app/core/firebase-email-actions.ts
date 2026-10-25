import type {ActionCodeSettings} from 'firebase/auth';
import {environment} from '../../environments/environment';

// Firebase hosted action pages complete sensitive operations in the browser.
// Only then may a user choose to return to the app with this non-secret URL.
// No oobCode, email, password or bearer token is ever included here.
const authDomain=environment.firebase.authDomain;
const packageName='com.oilspillmonitoringbuoy.app';
export function firebaseEmailActionSettings(kind:'verify'|'reset'):ActionCodeSettings {
  if(!/^[a-z0-9-]+\.firebaseapp\.com$/.test(authDomain)) {
    throw new Error('Firebase email return domain is not configured');
  }
  const action=kind==='verify'?'email-verified':'password-reset-complete';
  return {
    url:'https://'+authDomain+'/open/'+action,
    handleCodeInApp:false,
    android:{packageName,installApp:false},
  };
}
