// Keep all Firebase action-code parsing and return routing separate from HTML.
// No email/action codes/auth credentials are ever passed back to the Android app.
export const PROJECT_API_KEY='AIzaSyBRk6_gvKOuhc-lzPFCMiezBwl81aqXbP4';
export const RETURN_HOST='oil-spill-monitoring-buoy.firebaseapp.com';
export const ANDROID_PACKAGE='com.oilspillmonitoringbuoy.app';
const MODES=['verifyEmail','resetPassword','recoverEmail'];
const MAX_CODE_LENGTH=4096;
export function parseFirebaseEmailAction(locationHref){
  const url=new URL(locationHref);
  if(url.protocol!=='https:'||url.hostname!==RETURN_HOST||url.pathname!=='/auth/action'){
    throw Error('INVALID_ACTION_HOST');
  }
  const params=url.searchParams;
  for(const name of ['mode','oobCode','apiKey']){
    if(params.getAll(name).length!==1)throw Error('MISSING_OR_DUPLICATE_ACTION_PARAMETER');
  }
  const mode=params.get('mode'),code=params.get('oobCode'),apiKey=params.get('apiKey');
  if(!MODES.includes(mode)||apiKey!==PROJECT_API_KEY||
    !code||code.length>MAX_CODE_LENGTH||url.hash||url.username||url.password)throw Error('INVALID_ACTION_LINK');
  return {mode,code};
}
export function returnLinks(mode){
  if(!MODES.includes(mode))throw Error('UNSUPPORTED_EMAIL_ACTION');
  const path=mode==='verifyEmail'?'email-verified':'password-reset-complete';
  const https='https://'+RETURN_HOST+'/open/'+path;
  // Explicit user-activated intent anchor avoids the same-domain browser
  // navigation trap. The HTTPS link remains available on browsers without
  // Android Intent URI support. Neither link contains Firebase action codes.
  const intent='intent://'+RETURN_HOST+'/open/'+path+
   '#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package='+
   ANDROID_PACKAGE+';S.browser_fallback_url='+encodeURIComponent(https)+';end';
  return {https,intent};
}
export function validateNewPassword(first,second){
  if(typeof first!=='string'||first.length<8||first.length>128)
    return 'Choose a password between 8 and 128 characters.';
  if(first!==second)return 'Passwords do not match.';
  return null;
}
