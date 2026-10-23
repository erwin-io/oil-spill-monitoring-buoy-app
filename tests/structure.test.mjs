import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('Ionic CLI recognizes the Angular project',()=>{const ionic=JSON.parse(read('ionic.config.json')),angular=JSON.parse(read('angular.json'));assert.equal(ionic.type,'angular');assert.ok(angular.projects.app.architect.serve);assert.equal(angular.projects.app.architect.serve.configurations.development.buildTarget,'app:build:development')});
test('no legacy monolithic app.ts',()=>assert.equal(existsSync('src/app/app.ts'),false));
test('all checklist pages have dedicated TS and HTML',()=>{for(const p of ['login','register','verify','forgot','tabs','dashboard','devices','device-detail','history','trends','alerts','alert-detail','health','config','profile']){assert.ok(existsSync(`src/app/pages/${p}.page.ts`));assert.ok(existsSync(`src/app/pages/${p}.page.html`))}});
test('no private server credentials in mobile environment',()=>{const s=read('src/environments/environment.ts')+read('src/environments/environment.prod.ts');for(const name of ['FIREBASE_PRIVATE_KEY','PUSHER_SECRET','DEVICE_KEY_PEPPER'])assert.ok(!s.includes(name))});

test('Email/Password-only auth has no native Google dependency or action', () => {
  const pkg = JSON.parse(read('package.json'));
  const auth = read('src/app/core/auth.service.ts');
  const login = read('src/app/pages/login.page.html');
  assert.equal(Object.hasOwn(pkg.dependencies, '@capacitor-firebase/authentication'), false);
  assert.equal(auth.includes('FirebaseAuthentication'), false);
  assert.equal(auth.includes('signInGoogle'), false);
  assert.equal(login.includes('Continue with Google'), false);
  assert.ok(auth.includes('signInWithEmailAndPassword'));
});
test('Capacitor Android identity and Angular output paths agree', () => {
  const angular = JSON.parse(read('angular.json'));
  const cap = read('capacitor.config.ts');
  assert.equal(angular.projects.app.architect.build.options.outputPath.base, 'www');
  assert.equal(angular.projects.app.architect.build.options.outputPath.browser, '');
  assert.match(cap, /webDir:\s*["']www["']/);
  assert.match(cap, /appId:\s*["']io\.erwin\.oilspillbuoy["']/);
});
test('Angular and Capacitor major-version compatibility guardrails', () => {
  const pkg = JSON.parse(read('package.json'));
  const ts = JSON.parse(read('tsconfig.json'));
  assert.match(pkg.dependencies.ionicons, /^\^8\./);
  assert.match(pkg.dependencies['@capacitor/core'], /^\^7\./);
  assert.ok(ts.compilerOptions.esModuleInterop);
  assert.ok(ts.compilerOptions.isolatedModules);
  assert.ok(pkg.scripts.check);
});
