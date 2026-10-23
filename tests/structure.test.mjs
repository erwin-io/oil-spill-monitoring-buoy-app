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

test('Ionic password visibility controls are present in login and register', () => {
  const login = read('src/app/pages/login.page.html');
  const register = read('src/app/pages/register.page.html');
  const loginComponent = read('src/app/pages/login.page.ts');
  const registerComponent = read('src/app/pages/register.page.ts');
  assert.equal((login.match(/<ion-input-password-toggle/g) || []).length, 1);
  assert.equal((register.match(/<ion-input-password-toggle/g) || []).length, 2);
  assert.ok(loginComponent.includes('IonInputPasswordToggle'));
  assert.ok(registerComponent.includes('IonInputPasswordToggle'));
});

test('Registration requires matching confirmation before Firebase registration', () => {
  const register = read('src/app/pages/register.page.ts');
  const template = read('src/app/pages/register.page.html');
  assert.ok(register.includes('confirmPassword'));
  assert.ok(register.includes('passwordsMatch'));
  assert.ok(register.includes('this.form.invalid'));
  assert.ok(template.includes('Passwords do not match'));
  assert.ok(template.includes('formControlName="confirmPassword"'));
});

test('All auth flows use the common Ionic card design', () => {
  for (const name of ['login', 'register', 'forgot', 'verify']) {
    const html = read('src/app/pages/' + name + '.page.html');
    assert.ok(html.includes('ion-card'));
    assert.ok(html.includes('no-shadow'));
  }
  const stylesheet = read('src/styles.scss');
  assert.ok(stylesheet.includes('ion-button.regular'));
  assert.ok(stylesheet.includes("ion-input[fill='outline']"));
});

test('SEEFIX-matched 2px/10px global controls, no-shadow auth, blue toolbars', () => {
  const styles = read('src/styles.scss');
  const theme = read('src/theme/variables.scss');
  const auth = read('src/app/pages/login.page.scss');
  assert.match(styles, /--border-width:\s*2px/);
  assert.match(styles, /--border-radius:\s*10px/);
  assert.match(theme, /--ion-color-primary:\s*#0054e9/);
  assert.match(auth, /box-shadow:\s*none/);
  for (const name of ['dashboard', 'devices', 'alerts', 'profile', 'config']) {
    const html = read('src/app/pages/' + name + '.page.html');
    assert.ok(html.includes('class="no-shadow"'), name + ' toolbar should not cast shadow');
    assert.ok(html.includes('<ion-toolbar color="primary">'), name + ' needs primary toolbar');
  }
});

test('native status filters use the same outlined Ionic alert-select pattern', () => {
  for (const name of ['devices', 'alerts']) {
    const html = read('src/app/pages/' + name + '.page.html');
    assert.ok(html.includes('ion-select'));
    assert.ok(html.includes('fill="outline"'));
    assert.ok(html.includes('interface="alert"'));
    assert.ok(html.includes('interfaceOptions'));
  }
});
