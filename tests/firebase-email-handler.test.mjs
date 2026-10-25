import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  PROJECT_API_KEY,RETURN_HOST,ANDROID_PACKAGE,
  parseFirebaseEmailAction,returnLinks,validateNewPassword
} from '../hosting/public/firebase-email-action-core.mjs';

const root='https://'+RETURN_HOST+'/auth/action';
const action=(mode,extra='')=>root+'?mode='+mode+'&oobCode=SANDBOX_TEST_CODE_123&apiKey='+PROJECT_API_KEY+extra;

test('P2-15 Firebase handler accepts only BlueGuard action codes for current Firebase project',()=>{
 for(const mode of ['verifyEmail','resetPassword','recoverEmail']){
  const out=parseFirebaseEmailAction(action(mode));
  assert.equal(out.mode,mode);
  assert.equal(out.code,'SANDBOX_TEST_CODE_123');
 }
 for(const url of [
  action('verifyEmail').replace('https:','http:'),
  action('verifyEmail').replace(RETURN_HOST,'attacker.example.com'),
  action('verifyEmail').replace('/auth/action','/open/invite'),
  action('verifyEmail').replace(PROJECT_API_KEY,'WRONG_KEY'),
  action('badOperation'),
  action('verifyEmail','&oobCode=SECOND'),
  action('verifyEmail','&mode=resetPassword'),
  action('verifyEmail','&apiKey=other'),
  root+'?mode=verifyEmail&apiKey='+PROJECT_API_KEY,
  action('verifyEmail')+'#access_token=secret',
 ])assert.throws(()=>parseFirebaseEmailAction(url),url);
});
test('P2-15 after successful web Firebase action send ONLY secret-free app return targets',()=>{
 for(const mode of ['verifyEmail','resetPassword','recoverEmail']){
  const urls=returnLinks(mode);
  assert.ok(urls.https.startsWith('https://'+RETURN_HOST+'/open/'));
  assert.ok(urls.intent.startsWith('intent://'+RETURN_HOST+'/open/'));
  assert.ok(urls.intent.includes('package='+ANDROID_PACKAGE));
  assert.ok(urls.intent.includes('scheme=https;'));
  assert.ok(!urls.intent.includes('oobCode'));
  assert.ok(!urls.https.includes('SANDBOX_TEST_CODE'));
 }
 assert.equal(returnLinks('verifyEmail').https,'https://'+RETURN_HOST+'/open/email-verified');
 assert.equal(returnLinks('resetPassword').https,'https://'+RETURN_HOST+'/open/password-reset-complete');
 assert.throws(()=>returnLinks('idToken'),/UNSUPPORTED_EMAIL_ACTION/);
});
test('P2-15 reset form rejects weak/mismatched password without exposing it to the return URL',()=>{
 assert.match(validateNewPassword('abc','abc'),/8 and 128/);
 assert.match(validateNewPassword('strongPassword123','incorrect123'),/do not match/);
 assert.equal(validateNewPassword('StrongPassword123','StrongPassword123'),null);
});
test('P2-15 Hosting and page are wired without overriding Firebase reserved authentication paths',()=>{
 const cfg=JSON.parse(readFileSync('firebase.json','utf8'));
 assert.deepEqual(cfg.hosting.rewrites[0],{source:'/auth/action',destination:'/email-action.html'});
 assert.deepEqual(cfg.hosting.rewrites[1],{source:'/open/**',destination:'/index.html'});
 assert.ok(!cfg.hosting.rewrites.some(v=>v.source.startsWith('/__/auth')));
 const html=readFileSync('hosting/public/email-action.html','utf8');
 const handler=readFileSync('hosting/public/firebase-email-action.mjs','utf8');
 assert.match(html,/id="open-app"/);
 assert.match(html,/id="reset-form"/);
 assert.match(html,/id="verify-button"/);
 assert.match(html,/referrer" content="no-referrer"/);
 assert.match(handler,/applyActionCode\(auth,action\.code\)/);
 assert.match(handler,/confirmPasswordReset\(auth,action\.code,first\)/);
 assert.match(handler,/verifyPasswordResetCode\(auth,action\.code\)/);
 assert.match(handler,/await checkActionCode\(auth,action\.code\)/);
 assert.match(handler,/window\.history\.replaceState\(null,'','\/auth\/action'\)/);
 assert.ok(!handler.includes('localStorage'));
});
