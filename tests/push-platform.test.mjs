import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function transpile(path) {
  return ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true,
    },
    fileName: path,
  }).outputText;
}

function pushHarness({ native, pluginAvailable = true, removalFails = false, registerToken, endSession } = {}) {
  const calls = { remove: 0, unregister: 0, request: 0, register: 0,sessionStart:0,sessionEnd:0,sessionRefresh:0,toastCreated:0,toastPresented:0,toastDismissed:0,navigations:[] };
  const listeners = {};
  const api = {
    registerToken: (token) => { calls.register++; return registerToken ? registerToken(token) : Promise.resolve(); },
    unregisterToken: () => { calls.unregister++; return Promise.resolve(); },
    startPushSession: () => {calls.sessionStart++;return Promise.resolve({sessionId:'session-one',sessionSecret:'test-push-secret',expiresAt:'2099-01-01T00:00:00Z'})},
    refreshPushSession: () => {calls.sessionRefresh++;return Promise.resolve({expiresAt:'2099-01-01T00:00:00Z'})},
    endPushSession: () => {calls.sessionEnd++;return endSession ? endSession() : Promise.resolve({revoked:true})},
  };
  const router = {navigate:route=>{calls.navigations.push(Array.from(route));return Promise.resolve(true);}};
  const toastController={create:async options=>{calls.toastCreated++;calls.lastToast=options;return {present:async()=>{calls.toastPresented++;},dismiss:async()=>{calls.toastDismissed++;}};}};
  const PushNotifications = {
    requestPermissions: async () => { calls.request++; return { receive: 'granted' }; },
    addListener: async (name, callback) => { listeners[name] = callback; return { remove: async () => {} }; },
    register: async () => {},
    removeAllListeners: async () => {
      calls.remove++;
      if (removalFails) throw new Error('native listener cleanup failed');
    },
  };
  class ApiService {}
  class AuthService {}
  const auth={currentUser:()=>({uid:'test-user',emailVerified:true})};
  class Router {}
  class ToastController {}
  const exports = {};
  const modules = {
    '@angular/core': { Injectable: () => (cls) => cls, inject: (token) => token === ApiService ? api : token === AuthService ? auth : token === ToastController ? toastController : router },
    '@angular/router': { Router },
    '@ionic/angular/standalone': {ToastController},
    './notification-destination': {notificationDestination: d=>d?.alertId ? ['/tabs/alerts',d.alertId] : d?.deviceId ? ['/tabs/buoys',d.deviceId] : ['/tabs/alerts']},
    '@capacitor/core': { Capacitor: { isNativePlatform: () => native, isPluginAvailable: () => pluginAvailable } },
    '@capacitor/push-notifications': { PushNotifications },
    'rxjs': { firstValueFrom: async (promise) => promise },
    './api.service': { ApiService },
    './auth.service': { AuthService },
  };
  vm.runInNewContext(transpile('src/app/core/push.service.ts'), {
    exports,
    require: (name) => {
      if (!(name in modules)) throw new Error('Unexpected import: ' + name);
      return modules[name];
    },
    console,
    crypto:{randomUUID:()=> '12345678-1234-1234-1234-123456789012'},
    localStorage:{getItem:()=>null,setItem:()=>{}},
  });
  return { service: new exports.PushService(), calls, listeners };
}

test('web logout push.stop never accesses native-only PushNotifications', async () => {
  const { service, calls } = pushHarness({ native: false });
  service.token = 'unused-browser-token';
  await service.start();
  await service.stop();
  assert.equal(calls.request, 0);
  assert.equal(calls.remove, 0);
  assert.equal(calls.unregister, 0);
});

test('a missing native push plugin is safely ignored', async () => {
  const { service, calls } = pushHarness({ native: true, pluginAvailable: false });
  await service.start();
  await service.stop();
  assert.equal(calls.request, 0);
  assert.equal(calls.remove, 0);
});

test('native logout unregisters token and removes listeners', async () => {
  const { service, calls } = pushHarness({ native: true });
  service.token = 'device-token';
  await service.stop();
  assert.equal(calls.unregister, 1);
  assert.equal(calls.remove, 1);
  assert.equal(service.token, undefined);
});

test('native listener cleanup errors are contained', async () => {
  const { service, calls } = pushHarness({ native: true, removalFails: true });
  await service.stop();
  assert.equal(calls.remove, 1);
});

test('ProfilePage blocks sign-out when server push revocation rejects', async () => {
  const calls = { disconnect: 0, push: 0, logout: 0, redirect: 0 };
  const auth = { logout: async () => { calls.logout++; }, profile: () => null };
  const realtime = { disconnect: () => { calls.disconnect++; } };
  const push = { stop: async () => { calls.push++; throw new Error('plugin unavailable'); } };
  const router = { navigateByUrl: async () => { calls.redirect++; return true; } };
  class AuthService {}
  class RealtimeService {}
  class ScreenCacheService {}
  class PushService {}
  class ModalController {}
  class Router {}
  const exports = {};
  const ionic = Object.fromEntries(
    ['IonAvatar', 'IonBadge', 'IonButton', 'IonContent', 'IonHeader', 'IonIcon',
     'IonInput', 'IonItem', 'IonLabel', 'IonList', 'IonListHeader', 'IonNote', 'IonTitle', 'IonToolbar'
    ].map((n) => [n, class {}]),
  );
  const modules = {
    '@angular/common': { CommonModule: class {} },
    '@angular/forms': { FormsModule: class {} },
    '@angular/core': {
      Component: () => (cls) => cls,
      ViewChild: () => () => {},
      inject: (token) => {
        if (token === AuthService) return auth;
        if (token === RealtimeService) return realtime;
        if (token === ScreenCacheService) return {clearOnLogout:async()=>{}};
        if (token === PushService) return push;
        if (token === Router) return router;
        if (token === ModalController) return {create:async()=>({present:async()=>{},onDidDismiss:async()=>{}})};
        throw new Error('Unknown injection token');
      },
    },
    '@angular/router': { Router },
    '@ionic/angular/standalone': {...ionic,ModalController},
    'ionicons': { addIcons: () => {} },
    'ionicons/icons': {
      alertCircleOutline: 'alert-circle-outline',
      checkmarkCircleOutline: 'checkmark-circle-outline',
      hardwareChipOutline: 'hardware-chip-outline',
      idCardOutline: 'id-card-outline',
      informationCircleOutline: 'information-circle-outline',
      logOutOutline: 'log-out-outline',
      mailOutline: 'mail-outline',
    },
    '../core/auth.service': { AuthService },
    '../core/realtime.service': { RealtimeService },
    '../core/screen-cache.service': { ScreenCacheService },
    '../core/push.service': { PushService },
    './auth-busy-overlay.component': { AuthBusyOverlayComponent: class {} },
  };
  vm.runInNewContext(transpile('src/app/pages/profile.page.ts'), {
    exports,
    require: (name) => {
      if (!(name in modules)) throw new Error('Unexpected import: ' + name);
      return modules[name];
    },
    console,
  });
  const page = new exports.ProfilePage();
  await page.logout();
  assert.deepEqual(calls, { disconnect: 0, push: 1, logout: 0, redirect: 0 });
  assert.match(page.error,/plugin unavailable/);
  assert.equal(page.signingOut, false);
});

test('native FCM token refresh retires old token and skips duplicate callbacks', async () => {
  const { service, calls, listeners } = pushHarness({ native: true });
  await service.start();
  listeners.registration({ value: 'first-token' });
  await service.registrationTask;
  listeners.registration({ value: 'first-token' });
  await service.registrationTask;
  assert.equal(calls.register, 1);
  listeners.registration({ value: 'rotated-token' });
  await service.registrationTask;
  assert.equal(calls.register, 2);
  assert.equal(calls.unregister, 1, 'rotation revokes previous token');
  await service.stop();
  assert.equal(calls.unregister, 2, 'logout revokes latest token');
});

test('logout waits for an in-flight registration and revokes late token', async () => {
  let entered;
  const started = new Promise((resolve) => { entered = resolve; });
  let release;
  const delayed = new Promise((resolve) => { release = resolve; });
  const { service, calls, listeners } = pushHarness({
    native: true,
    registerToken: () => { entered(); return delayed; },
  });
  await service.start();
  listeners.registration({ value: 'late-registration-token' });
  await started;
  const stopping = service.stop();
  release();
  await stopping;
  assert.equal(calls.register, 1);
  assert.equal(calls.sessionEnd, 1, 'revoked installation session suppresses late FCM registration');
  assert.equal(service.token, undefined);
  listeners.registration({ value: 'callback-after-logout' });
  await service.registrationTask;
  assert.equal(calls.register, 1, 'old callback must not register after logout');
});

test('old FCM notification callbacks cannot navigate after sign-out', async () => {
  const { service, listeners } = pushHarness({ native: true });
  await service.start();
  const oldAction = listeners.pushNotificationActionPerformed;
  await service.stop();
  await oldAction({ notification: { data: { alertId: 'old-alert' } } });
  assert.equal(service.token, undefined);
});

test('P2-12 offline logout retains revocation proof for retry, then clears it after server confirmation',async()=>{
 let offline=true;
 const {service,calls}=pushHarness({native:true,endSession:()=>{
  if(offline)return Promise.reject(new Error('Network unavailable'));
  return Promise.resolve({revoked:true});
 }});
 await service.start();
 assert.equal(service.session?.sessionId,'session-one');
 await assert.rejects(service.stop(true),/Cannot sign out securely while offline/);
 assert.equal(service.session?.sessionId,'session-one','session credentials must remain in memory for retry');
 assert.equal(calls.sessionEnd,1);
 offline=false;
 await service.stop(true);
 assert.equal(calls.sessionEnd,2);
 assert.equal(service.session,undefined);
});

test('Foreground notification shows actionable toast; sign-out dismisses and disables View',async()=>{
 const {service,calls,listeners}=pushHarness({native:true});
 await service.start();
 listeners.pushNotificationReceived({title:'Alert',body:'Buoy status',data:{alertId:'alert_one'}});
 await service.foregroundTask;
 assert.equal(calls.toastCreated,1);
 assert.equal(calls.toastPresented,1);
 const view=calls.lastToast.buttons.find(x=>x.text==='View');
 view.handler();
 assert.deepEqual(calls.navigations,[['/tabs/alerts','alert_one']]);
 await service.stop();
 assert.equal(calls.toastDismissed,1);
 view.handler();
 assert.equal(calls.navigations.length,1);
});
test('Background notification tap navigates to buoy; stale callback blocked after sign-out',async()=>{
 const {service,calls,listeners}=pushHarness({native:true});
 await service.start();
 const onTap=listeners.pushNotificationActionPerformed;
 onTap({notification:{data:{deviceId:'buoy_one'}}});
 assert.deepEqual(calls.navigations,[['/tabs/buoys','buoy_one']]);
 await service.stop();
 onTap({notification:{data:{alertId:'old'}}});
 assert.equal(calls.navigations.length,1);
});

test('repeat Overview tab entry never renews a still-valid push session',async()=>{
 const {service,calls}=pushHarness({native:true});
 await service.start();
 assert.equal(calls.sessionStart,1);
 assert.equal(calls.sessionRefresh,0);
 await service.start();
 await service.start();
 assert.equal(calls.sessionStart,1);
 assert.equal(calls.sessionRefresh,0,'Valid push session should not cause network requests on tab switches');
 await service.stop();
});
