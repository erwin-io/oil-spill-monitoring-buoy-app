import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,checkActionCode,applyActionCode,verifyPasswordResetCode,confirmPasswordReset} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {PROJECT_API_KEY,RETURN_HOST,parseFirebaseEmailAction,returnLinks,validateNewPassword} from './firebase-email-action-core.mjs';

const el=id=>document.getElementById(id);
const heading=el('heading'),message=el('message'),verify=el('verify-button'),
      resetForm=el('reset-form'),recover=el('recover-button'),returns=el('return-panel');
const state=(title,description,{error=false,success=false}={})=>{
  heading.textContent=title;
  message.textContent=description;
  message.className=error?'error':success?'success':'';
};
function showReturn(mode){
 const links=returnLinks(mode);
 const intent=el('open-app'),web=el('open-https');
 intent.href=links.intent;
 web.href=links.https;
 returns.hidden=false;
}
function failed(){
 state('Link unavailable','This email link is invalid, expired or already used. Open BlueGuard Buoy to request a new one.',{error:true});
 // Only non-secret Login navigation is available for failed/replayed links.
 showReturn('resetPassword');
}
function pending(button){
 button.disabled=true;
 state('Completing your request','Communicating securely with Firebase Authentication.');
}
let action;
try{
 action=parseFirebaseEmailAction(window.location.href);
 // The one-time action code should not remain in screenshots, copied browser
 // URLs or navigation/referrer history. We have retained it only in JS memory.
 window.history.replaceState(null,'','/auth/action');
}catch{failed();throw Error('INVALID_EMAIL_ACTION_URL')}
const auth=getAuth(initializeApp({apiKey:PROJECT_API_KEY,authDomain:RETURN_HOST,projectId:'oil-spill-monitoring-buoy'}));
if(action.mode==='verifyEmail'){
 try{
  const info=await checkActionCode(auth,action.code);
  if(info.operation!=='VERIFY_EMAIL')throw Error('ACTION_TYPE_MISMATCH');
  state('Verify your email','Confirm that you want to verify this BlueGuard Buoy account.');
  verify.hidden=false;
  verify.addEventListener('click',async()=>{
   if(verify.disabled)return;
   pending(verify);
   try{
    await applyActionCode(auth,action.code);
    verify.hidden=true;
    state('Email verified','Firebase has verified your email. You can now return to BlueGuard Buoy.',{success:true});
    showReturn('verifyEmail');
   }catch{verify.hidden=true;failed()}
  });
 }catch{failed()}
}else if(action.mode==='resetPassword'){
 try{
  await verifyPasswordResetCode(auth,action.code);
  state('Reset your password','Choose a new BlueGuard Buoy account password. Your current password is never requested.');
  resetForm.hidden=false;
  resetForm.addEventListener('submit',async event=>{
   event.preventDefault();
   const submit=el('reset-submit');
   if(submit.disabled)return;
   const first=el('new-password').value,second=el('confirm-password').value;
   const issue=validateNewPassword(first,second);
   if(issue){state('Check your password',issue,{error:true});return}
   pending(submit);
   try{
    await confirmPasswordReset(auth,action.code,first);
    resetForm.reset();
    resetForm.hidden=true;
    state('Password updated','Your new password has been saved. Open BlueGuard Buoy and sign in with it.',{success:true});
    showReturn('resetPassword');
   }catch{
    submit.disabled=false;
    state('Unable to reset password','The code expired or Firebase rejected the password. Request a new reset link or try a stronger password.',{error:true});
   }
  });
 }catch{failed()}
}else if(action.mode==='recoverEmail'){
 // If the template's action URL is shared with all Firebase Auth emails,
 // handle security-sensitive recovery instead of leaving email recovery broken.
 try{
  const info=await checkActionCode(auth,action.code);
  if(info.operation!=='RECOVER_EMAIL')throw Error('ACTION_TYPE_MISMATCH');
  state('Restore your email address','An email address change was requested. Restore your previous address only if you recognize this account.');
  recover.hidden=false;
  recover.addEventListener('click',async()=>{
   if(recover.disabled)return;
   pending(recover);
   try{
    await applyActionCode(auth,action.code);
    recover.hidden=true;
    state('Email address restored','Firebase restored the previous email address. Check your account security after signing in.',{success:true});
    showReturn('resetPassword');
   }catch{recover.hidden=true;failed()}
  });
 }catch{failed()}
}
