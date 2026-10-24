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
  const auth = { currentUser: null };
  const http = { post: () => {
    if (!nextProfile) throw new Error('Profile response not configured');
    const p = nextProfile;
    nextProfile = undefined;
    return p;
  } };
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
      sendEmailVerification: async () => {},
      sendPasswordResetEmail: async () => {},
      signOut: async () => { auth.currentUser = null; observer(null); },
    },
    '../../environments/environment': { environment: { api: 'https://example.test/api/v1', firebase: {} } },
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
    getGoogleCalls: () => ({nativeCalls,nativeOptions,popupCalls,lastNativeToken}) };
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
