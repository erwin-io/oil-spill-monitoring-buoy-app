import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Test the real AuthService implementation with controlled Firebase callbacks;
// a source-string assertion cannot detect late bootstrap/profile identity races.
function harness({native = false, pluginAvailable = true, nativeGoogleToken = 'valid-native-google-id-token', verifiedGoogle = true} = {}) {
  let observer;
  let nextProfile;
  let nativeCalls = 0;
  let nativeOptions;
  let popupCalls = 0;
  let lastNativeToken;
  let reauthentication,updatedPassword;
  const emails=[];
  const auth = { currentUser: null };
  const takeProfile = () => {
    if (!nextProfile) throw new Error('Profile response not configured');
    const p = nextProfile;nextProfile = undefined;return p;
  };
  const http = {post:takeProfile, patch:takeProfile, put:takeProfile, delete:takeProfile};
  const signal = (initial) => {
    let state = initial;
    const value = () => state;
    value.set = (next) => { state = next; };
    return value;
  };
  class HttpClient {}
  const exports = {};
  const modules = {
    '@angular/core': {
      Injectable: () => (cls) => cls, signal,
      inject: (token) => { if (token !== HttpClient) throw new Error('Unknown injection'); return http; },
    },
    '@angular/common/http': { HttpClient },
    'rxjs': { firstValueFrom: async (p) => p },
    'firebase/app': { getApps: () => [], initializeApp: () => ({}), getApp: () => ({}) },
    '@capacitor/core': { Capacitor: {
      isNativePlatform: () => native,
      isPluginAvailable: name => name === 'FirebaseAuthentication' && pluginAvailable
    } },
    '@capacitor-firebase/authentication': { FirebaseAuthentication: {
      signInWithGoogle: async (options) => {
        nativeOptions = options;
        nativeCalls++;
        return {credential: {idToken: nativeGoogleToken}};
      }
    } },
    'firebase/auth': {
      getAuth: () => auth,
      GoogleAuthProvider: class {static credential(token) {return {idToken: token};}},
      signInWithPopup: async () => {
        popupCalls++;
        auth.currentUser = {uid:'google-account',emailVerified:verifiedGoogle,getIdToken:async()=> 'firebase-google-id-token'};
        observer(auth.currentUser);
      },
      signInWithCredential: async (_auth, credential) => {
        lastNativeToken = credential.idToken;
        auth.currentUser = {uid:'google-account',emailVerified:verifiedGoogle,getIdToken:async()=> 'firebase-google-id-token'};
        observer(auth.currentUser);
      },
      onAuthStateChanged: (_auth, callback) => { observer = callback; callback(auth.currentUser); return () => {}; },
      signInWithEmailAndPassword: async () => ({ user: auth.currentUser }),
      createUserWithEmailAndPassword: async () => ({ user: auth.currentUser }),
      sendEmailVerification: async (_user, settings) => {emails.push({type:'verification',settings});},
      sendPasswordResetEmail: async (_auth,_email, settings) => {emails.push({type:'reset',settings});},
      EmailAuthProvider: {credential: (email,password)=>({email,password})},
      reauthenticateWithCredential: async (_user,credential)=>{reauthentication=credential;},
      updatePassword: async (_user,password)=>{updatedPassword=password;},
      signOut: async () => { auth.currentUser = null; observer(null); },
    },
    '../../environments/environment': { environment: { api: 'https://example.test/api/v1', firebase: {} } },
    './firebase-email-actions': { firebaseEmailActionSettings:kind=>({url:'https://oil-spill-monitoring-buoy.firebaseapp.com/open/'+(kind==='verify'?'email-verified':'password-reset-complete'),handleCodeInApp:false,android:{packageName:'com.oilspillmonitoringbuoy.app',installApp:false}}) },
  };
  const source = readFileSync('src/app/core/auth.service.ts', 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
  }).outputText, {
    exports, require: (name) => {
      if (!(name in modules)) throw new Error('Unexpected import: ' + name);
      return modules[name];
    }, console,
  });
  const service = new exports.AuthService();
  const setUser = (user) => { auth.currentUser = user; observer(user); };
  const queueProfile = (profile) => { nextProfile = profile; };
  return { service, setUser, queueProfile,
    getGoogleCalls: () => ({nativeCalls,nativeOptions,popupCalls,lastNativeToken}),
    getPasswordCalls: () => ({reauthentication,updatedPassword}),
    getEmailActions: () => emails };
}

const user = (uid) => ({ uid, emailVerified: true, getIdToken: async () => 'test-token-' + uid });
const profile = (uid) => ({ uid, role: 'VIEWER', status: 'ACTIVE', email: uid + '@example.test', displayName: uid, allowedDeviceIds: [] });

test('account switching clears old authorization profile before next REST bootstrap', async () => {
  const { service, setUser, queueProfile } = harness();
  setUser(user('account-A'));
  queueProfile(Promise.resolve(profile('account-A')));
  assert.equal((await service.bootstrap()).uid, 'account-A');
  setUser(user('account-B'));
  assert.equal(service.profile(), null, 'old account role must not be visible to new session');
  queueProfile(Promise.resolve(profile('account-B')));
  assert.equal(await service.ready(), true);
  assert.equal(service.profile().uid, 'account-B');
});

test('a late bootstrap for the previous account cannot repopulate the new account profile', async () => {
  const { service, setUser, queueProfile } = harness();
  setUser(user('account-A'));
  let resolveResponse;
  queueProfile(new Promise((resolve) => { resolveResponse = resolve; }));
  const stale = service.bootstrap();
  await Promise.resolve();
  setUser(user('account-B'));
  resolveResponse(profile('account-A'));
  await assert.rejects(stale, /Session changed during profile bootstrap/);
  assert.equal(service.profile(), null);
});

test('logout invalidates any bootstrap response arriving after sign-out', async () => {
  const { service, setUser, queueProfile } = harness();
  setUser(user('account-A'));
  let resolveResponse;
  queueProfile(new Promise((resolve) => { resolveResponse = resolve; }));
  const stale = service.bootstrap();
  await Promise.resolve();
  await service.logout();
  resolveResponse(profile('account-A'));
  await assert.rejects(stale, /Session changed during profile bootstrap/);
  assert.equal(service.profile(), null);
});

test('API profile identity mismatch does not update current account state', async () => {
  const { service, setUser, queueProfile } = harness();
  setUser(user('account-B'));
  queueProfile(Promise.resolve(profile('account-A')));
  await assert.rejects(service.bootstrap(), /Profile identity mismatch/);
  assert.equal(service.profile(), null);
});


test('browser Google login creates the same Firebase JS session and bootstraps a VIEWER profile', async () => {
  const {service,queueProfile,getGoogleCalls}=harness();
  queueProfile(Promise.resolve(profile('google-account')));
  assert.equal((await service.signInWithGoogle()).uid,'google-account');
  assert.equal(service.currentUser().uid,'google-account');
  assert.equal(service.profile().role,'VIEWER');
  assert.equal(getGoogleCalls().popupCalls,1);
  assert.equal(getGoogleCalls().nativeCalls,0);
});

test('Android Google credential is exchanged for a Firebase JS token before calling bootstrap', async () => {
  const {service,queueProfile,getGoogleCalls}=harness({native:true});
  queueProfile(Promise.resolve(profile('google-account')));
  assert.equal((await service.signInWithGoogle()).uid,'google-account');
  assert.equal(getGoogleCalls().nativeCalls,1);
  assert.equal(getGoogleCalls().nativeOptions?.useCredentialManager,false,
    'Android Google login must bypass Credential Manager when using the compatibility path');
  assert.equal(getGoogleCalls().popupCalls,0);
  assert.equal(getGoogleCalls().lastNativeToken,'valid-native-google-id-token');
  assert.equal(await service.token(),'firebase-google-id-token',
    'API must use Firebase JS ID token, not the Google provider ID token');
  await service.logout();
  assert.equal(service.profile(),null);
  assert.equal(service.currentUser(),null);
});

test('native Google login rejects missing plugin or token without calling the API', async () => {
  const missing = harness({native:true,pluginAvailable:false});
  await assert.rejects(missing.service.signInWithGoogle(),/unavailable/);
  const noToken = harness({native:true,nativeGoogleToken:null});
  await assert.rejects(noToken.service.signInWithGoogle(),/did not return an identity token/);
  assert.equal(noToken.service.profile(),null);
});

test('unverified Google email cannot bootstrap a profile', async () => {
  const {service}=harness({verifiedGoogle:false});
  await assert.rejects(service.signInWithGoogle(),/Google account email must be verified/);
  assert.equal(service.profile(),null);
});

test('Google login cannot accept a profile for a different Firebase user', async () => {
  const {service,queueProfile}=harness({native:true});
  queueProfile(Promise.resolve(profile('old-account')));
  await assert.rejects(service.signInWithGoogle(),/Profile identity mismatch/);
  assert.equal(service.profile(),null);
});

test('P2-14 password change demands current credentials, validates next password, preserves Google identity',async()=>{
 const {service,setUser,getPasswordCalls}=harness();
 setUser({...user('password-user'),email:'person@example.test',providerData:[{providerId:'password'}]});
 await assert.rejects(service.changePassword('old','tiny'),/8–128/);
 await assert.rejects(service.changePassword('same-password','same-password'),/different/);
 await service.changePassword('old-password','new-password-123');
 assert.equal(getPasswordCalls().reauthentication.email,'person@example.test');
 assert.equal(getPasswordCalls().reauthentication.password,'old-password');
 assert.equal(getPasswordCalls().updatedPassword,'new-password-123');
 setUser({...user('google-user'),email:'google@example.test',providerData:[{providerId:'google.com'}]});
 await assert.rejects(service.changePassword('unused','new-password-123'),/Google/);
});

test('P2-13 own display name updates the authenticated profile without mixing accounts', async () => {
 const {service,setUser,queueProfile}=harness();
 setUser(user('account-A'));
 queueProfile(Promise.resolve({...profile('account-A'),displayName:'BlueGuard A'}));
 assert.equal((await service.updateDisplayName('BlueGuard A')).displayName,'BlueGuard A');
 assert.equal(service.profile().displayName,'BlueGuard A');
 let resolveLate;
 queueProfile(new Promise(resolve=>{resolveLate=resolve}));
 const stale=service.updateDisplayName('Old Account');
 await Promise.resolve();
 setUser(user('account-B'));
 resolveLate({...profile('account-A'),displayName:'Old Account'});
 await assert.rejects(stale,/Account changed during profile update/);
 assert.equal(service.profile(),null);
});

test('P2-13 signed avatar proxy updates only the active account and preserves profile authorization',async()=>{
 const {service,setUser,queueProfile}=harness();
 setUser(user('account-A'));
 queueProfile(Promise.resolve(profile('account-A')));
 await service.bootstrap();
 const file=new Blob([new Uint8Array(64)],{type:'image/png'});
 queueProfile(Promise.resolve({uid:'account-A',avatarUrl:'https://res.cloudinary.com/blueguard/image/upload/v1/a'}));
 const updated=await service.uploadAvatar(file);
 assert.equal(updated.uid,'account-A');
 assert.equal(updated.role,'VIEWER');
 assert.equal(updated.avatarUrl,'https://res.cloudinary.com/blueguard/image/upload/v1/a');
 queueProfile(Promise.resolve({uid:'account-A',avatarUrl:null}));
 assert.equal((await service.removeAvatar()).avatarUrl,null);
 assert.equal(service.profile().role,'VIEWER');
 await assert.rejects(service.uploadAvatar(new Blob([new Uint8Array(30)],{type:'image/svg+xml'})),/Choose a JPG/);
 await assert.rejects(service.uploadAvatar(new Blob([new Uint8Array(2*1024*1024+1)],{type:'image/png'})),/Choose a JPG/);
});
test('P2-13 avatar response from switched-out user cannot alter new account',async()=>{
 const {service,setUser,queueProfile}=harness();
 setUser(user('account-A'));
 let release;
 queueProfile(new Promise(resolve=>{release=resolve}));
 const file=new Blob([new Uint8Array(64)],{type:'image/webp'});
 const stale=service.uploadAvatar(file);
 await Promise.resolve();
 setUser(user('account-B'));
 release({uid:'account-A',avatarUrl:'https://res.cloudinary.com/demo/image/upload/v1/a'});
 await assert.rejects(stale,/Account changed during avatar upload/);
 assert.equal(service.profile(),null);
});

test('P2-15 registration, resend verification and password reset supply Firebase web-first Android return links',async()=>{
 const {service,setUser,getEmailActions}=harness();
 const firebaseUser={...user('firebase-new'),email:'new@example.test',reload:async()=>{}};
 setUser(firebaseUser);
 await service.register('new@example.test','SafeNewPassword123!');
 await service.resendVerification();
 await service.resetPassword('new@example.test');
 const actions=getEmailActions();
 assert.deepEqual(Array.from(actions,a=>a.type),['verification','verification','reset']);
 for(const action of actions){
  assert.equal(action.settings.handleCodeInApp,false);
  assert.equal(action.settings.android.packageName,'com.oilspillmonitoringbuoy.app');
  assert.equal(action.settings.android.installApp,false);
  assert.ok(action.settings.url.startsWith('https://oil-spill-monitoring-buoy.firebaseapp.com/open/'));
  assert.equal(action.settings.url.includes('oobCode='),false);
 }
 assert.match(actions[0].settings.url,/\/open\/email-verified$/);
 assert.match(actions[2].settings.url,/\/open\/password-reset-complete$/);
});
