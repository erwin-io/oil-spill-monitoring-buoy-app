// Secure Android intent fallback. Firebase code checks are read-only;
// email verification and password reset are applied ONLY by the native app.
import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,checkActionCode,verifyPasswordResetCode} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {parseFallbackAction,buildBlueGuardIntent,firebaseActionState,FIREBASE_PUBLIC_API_KEY,BLUEGUARD_HOST} from './firebase-native-open-core.mjs';
const message=document.getElementById('message');
const help=document.getElementById('help');
const button=document.getElementById('open-blueguard');
const path=window.location.pathname;
const unavailableText='This email link is expired, invalid or already used. If verification is already complete, return to BlueGuard and sign in. Otherwise request a fresh email in the app.';
function hideAction(text,more) {
  button.hidden=true;
  button.disabled=true;
  message.textContent=text;
  if(more)help.textContent=more;
}
if(path==='/open/auth-action') {
  const action=parseFallbackAction(window.location.href);
  // Keep the validated code only in script memory; scrub URL/history.
  window.history.replaceState(null,'','/open/auth-action');
  if(!action) {
    hideAction('This email link is invalid or incomplete. Request a new email from BlueGuard.');
  } else if(!/Android/i.test(navigator.userAgent)) {
    hideAction('Open the original email on your Android phone with BlueGuard installed.');
  } else {
    let auth, request=0, canOpen=false, launched=false;
    async function validateCode() {
      const seq=++request;
      canOpen=false;
      hideAction('Checking whether this email link is still valid…','Email action codes can only be used once.');
      try {
        if(!auth)auth=getAuth(initializeApp({apiKey:FIREBASE_PUBLIC_API_KEY,authDomain:BLUEGUARD_HOST,projectId:'oil-spill-monitoring-buoy'}));
        if(action.mode==='verifyEmail') {
          const info=await checkActionCode(auth,action.code);
          if(info.operation!=='VERIFY_EMAIL')throw Object.assign(Error('Wrong operation'),{code:'auth/invalid-action-code'});
        } else {
          await verifyPasswordResetCode(auth,action.code);
        }
        if(seq!==request)return;
        canOpen=true;
        button.disabled=false;
        button.hidden=false;
        message.textContent=action.mode==='verifyEmail'
          ? 'Complete email verification securely in the installed BlueGuard Buoy app.'
          : 'Reset your password securely in the installed BlueGuard Buoy app.';
        help.textContent='Tap Open BlueGuard Buoy. If the mail browser blocks app launch, open the original email link in Chrome on Android.';
      } catch(e) {
        if(seq!==request)return;
        if(firebaseActionState(e?.code)==='unavailable') {
          hideAction(unavailableText,'The Open BlueGuard button is hidden because Firebase does not accept this one-time link.');
        } else {
          hideAction('Unable to check the link. Check your internet connection and reopen the original email link.',
            'BlueGuard does not offer an app launch for a link it cannot validate.');
        }
      }
    }
    button.addEventListener('click',()=>{
      if(!canOpen||button.disabled||button.hidden)return;
      canOpen=false;
      launched=true;
      hideAction('Opening BlueGuard Buoy…','Complete the action inside the app. You may close this browser tab afterward.');
      // Android package-targeted intent is launched only on a user tap.
      window.location.href=buildBlueGuardIntent(action);
    });
    function onReturn() {
      if(!launched)return;
      launched=false;
      void validateCode();
    }
    window.addEventListener('pageshow',onReturn);
    window.addEventListener('focus',onReturn);
    document.addEventListener('visibilitychange',()=>{
      if(!document.hidden)onReturn();
    });
    void validateCode();
  }
} else if(path==='/open/email-verified') {
  hideAction('Return to BlueGuard Buoy and sign in after verifying your email.');
} else if(path==='/open/password-reset-complete') {
  hideAction('Return to BlueGuard Buoy and sign in with your new password.');
} else if(path==='/open/invite'||path==='/open/transfer') {
  hideAction('Open BlueGuard Buoy and sign in to review your pending buoy invitations.');
} else {
  hideAction('Open the installed BlueGuard Buoy app to continue.');
}
