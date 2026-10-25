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

function pushHarness({ native, pluginAvailable = true, removalFails = false, registerToken } = {}) {
  const calls = { remove: 0, unregister: 0, request: 0, register: 0,sessionStart:0,sessionEnd:0,sessionRefresh:0 };
  const listeners = {};
  const api = {
    registerToken: (token) => { calls.register++; return registerToken ? registerToken(token) : Promise.resolve(); },
    unregisterToken: () => { calls.unregister++; return Promise.resolve(); },
    startPushSession: () => {calls.sessionStart++;return Promise.resolve({sessionId:'session-one',sessionSecret:'test-push-secret',expiresAt:'2099-01-01T00:00:00Z'})},
    refreshPushSession: () => {calls.sessionRefresh++;return Promise.resolve({expiresAt:'2099-01-01T00:00:00Z'})},
    endPushSession: () => {calls.sessionEnd++;return Promise.resolve({revoked:true})},
  };
  const router = { navigate: () => Promise.resolve(true) };
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
  const exports = {};
  const modules = {
    '@angular/core': { Injectable: () => (cls) => cls, inject: (token) => token === ApiService ? api : token === AuthService ? auth : router },
    '@angular/router': { Router },
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

test('ProfilePage signs out even when push cleanup rejects', async () => {
  const calls = { disconnect: 0, push: 0, logout: 0, redirect: 0 };
  const auth = { logout: async () => { calls.logout++; }, profile: () => null };
  const realtime = { disconnect: () => { calls.disconnect++; } };
  const push = { stop: async () => { calls.push++; throw new Error('plugin unavailable'); } };
  const router = { navigateByUrl: async () => { calls.redirect++; return true; } };
  class AuthService {}
  class RealtimeService {}
  class PushService {}
  class Router {}
  const exports = {};
  const ionic = Object.fromEntries(
    ['IonAvatar', 'IonBadge', 'IonButton', 'IonContent', 'IonHeader', 'IonIcon',
     'IonItem', 'IonLabel', 'IonList', 'IonListHeader', 'IonNote', 'IonTitle', 'IonToolbar'
    ].map((n) => [n, class {}]),
  );
  const modules = {
    '@angular/common': { CommonModule: class {} },
    '@angular/core': {
      Component: () => (cls) => cls,
      inject: (token) => {
        if (token === AuthService) return auth;
        if (token === RealtimeService) return realtime;
        if (token === PushService) return push;
        if (token === Router) return router;
        throw new Error('Unknown injection token');
      },
    },
    '@angular/router': { Router },
    '@ionic/angular/standalone': ionic,
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
    '../core/push.service': { PushService },
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
  assert.deepEqual(calls, { disconnect: 1, push: 1, logout: 1, redirect: 1 });
  assert.equal(page.error, '');
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
