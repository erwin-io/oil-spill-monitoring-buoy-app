import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('Ionic CLI recognizes the Angular project',()=>{const ionic=JSON.parse(read('ionic.config.json')),angular=JSON.parse(read('angular.json'));assert.equal(ionic.type,'angular');assert.ok(angular.projects.app.architect.serve);assert.equal(angular.projects.app.architect.serve.configurations.development.buildTarget,'app:build:development')});
test('no legacy monolithic app.ts',()=>assert.equal(existsSync('src/app/app.ts'),false));
test('all checklist pages have dedicated TS and HTML',()=>{for(const p of ['login','register','verify','forgot','tabs','dashboard','devices','device-detail','history','trends','alerts','alert-detail','health','config','profile']){assert.ok(existsSync(`src/app/pages/${p}.page.ts`));assert.ok(existsSync(`src/app/pages/${p}.page.html`))}});
test('no private server credentials in mobile environment',()=>{const s=read('src/environments/environment.ts')+read('src/environments/environment.prod.ts');for(const name of ['FIREBASE_PRIVATE_KEY','PUSHER_SECRET','DEVICE_KEY_PEPPER'])assert.ok(!s.includes(name))});

test('Email/Password remains available alongside native and web Google Sign-In', () => {
  const pkg = JSON.parse(read('package.json'));
  const auth = read('src/app/core/auth.service.ts');
  const login = read('src/app/pages/login.page.html');
  const cap = read('capacitor.config.ts');
  const gradle = read('android/variables.gradle');
  assert.equal(pkg.dependencies['@capacitor-firebase/authentication'], '7.5.0');
  assert.equal(pkg.dependencies.firebase, '11.10.0');
  assert.ok(auth.includes('signInWithEmailAndPassword'), 'password login preserved');
  assert.ok(auth.includes('signInWithPopup'), 'browser popup supported');
  assert.match(auth, /FirebaseAuthentication\.signInWithGoogle\(\s*\{\s*useCredentialManager:\s*false\s*\}\s*\)/, 'native legacy Google account flow');
  assert.ok(auth.includes('GoogleAuthProvider.credential(googleIdToken)'), 'native Google token exchanged for Firebase JS session');
  assert.ok(login.includes('(click)="googleLogin()"'));
  assert.ok(login.includes('Continue with Google'));
  assert.ok(login.includes('class="google-icon"'));
  assert.ok(login.includes('<svg viewBox="0 0 24 24"'));
  for (const color of ['#4285F4', '#34A853', '#FBBC05', '#EA4335']) {
    assert.ok(login.includes('fill="' + color + '"'), 'Google mark must contain ' + color);
  }
  assert.ok(!login.includes('class="google-g"'), 'Do not approximate the logo with styled text');
  const logoStyles = read('src/app/pages/login.page.scss');
  assert.ok(logoStyles.includes('.google-icon svg'));
  assert.ok(!logoStyles.includes('.google-g {'));
  assert.ok(cap.includes('skipNativeAuth: true'));
  assert.ok(cap.includes('"google.com"'));
  assert.ok(gradle.includes('rgcfaIncludeGoogle = true'));
});
test('Capacitor Android identity and Angular output paths agree', () => {
  const angular = JSON.parse(read('angular.json'));
  const cap = read('capacitor.config.ts');
  assert.equal(angular.projects.app.architect.build.options.outputPath.base, 'www');
  assert.equal(angular.projects.app.architect.build.options.outputPath.browser, '');
  assert.match(cap, /webDir:\s*["']www["']/);
  // App identity must match the installed native Android package and Firebase client.
  assert.match(cap, /appId:\s*["']com\.oilspillmonitoringbuoy\.app["']/);
  const gradle = read('android/app/build.gradle');
  assert.match(gradle, /applicationId\s+["']com\.oilspillmonitoringbuoy\.app["']/);
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
  assert.ok(stylesheet.includes('ion-input, ion-textarea, ion-select'));
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

test('buoy list retains outlined native filter while personal Notifications has no status filters', () => {
 const devices=read('src/app/pages/devices.page.html');
 for(const needle of ['ion-select','fill="outline"','interface="alert"','interfaceOptions'])
  assert.ok(devices.includes(needle));
 const inbox=read('src/app/pages/alerts.page.html');
 assert.ok(!inbox.includes('ion-select'), 'P2-DEC-003 requires no inbox filters');
 assert.ok(inbox.includes('Mark All Read'));
 assert.ok(inbox.includes('<ion-title>Notifications</ion-title>'));
});

test('Login has one branded welcome section, compact form and scroll-safe mobile layout', () => {
  const login = read('src/app/pages/login.page.html');
  const register = read('src/app/pages/register.page.html');
  const style = read('src/app/pages/login.page.scss');
  assert.ok(login.includes('<main class="login-layout">'));
  assert.ok(login.includes('class="brand-mark"'));
  assert.ok(login.includes('<p class="brand-eyebrow">BlueGuard Buoy</p>'));
  assert.ok(login.includes('<h1>Welcome back</h1>'));
  assert.ok(login.includes('Sign in to monitor coastal waters and follow buoy alerts.'));
  assert.ok(login.indexOf('class="brand"') < login.indexOf('<ion-card class="card no-shadow">'));
  assert.equal(login.includes('<ion-card-title>BlueGuard Buoy</ion-card-title>'), false,
    'Product branding must not be repeated above the form');
  assert.equal(register.includes('class="brand-mark"'), false);
  assert.match(style, /\.login-layout\s*\{/);
  assert.match(style, /max-width:\s*420px/);
  assert.match(style, /@media \(max-height:\s*700px\)/);
  assert.ok(style.includes('box-shadow: none !important'));
  assert.ok(login.includes('routerLink="/forgot-password"'));
  assert.ok(login.includes('routerLink="/register"'));
});

test('Only the correct product name appears in user-facing mobile source', () => {
  const files = ['src/app/pages/login.page.html', 'src/app/pages/register.page.html',
    'src/app/pages/dashboard.page.html', 'src/app/pages/profile.page.html',
    'src/index.html', 'capacitor.config.ts'];
  for(const path of files) assert.ok(!/BlueWatch/i.test(read(path)), path);
  assert.ok(read('src/app/pages/login.page.html').includes('BlueGuard Buoy'));
  assert.ok(read('src/app/pages/dashboard.page.html').includes('<ion-title>Overview</ion-title>'));
  assert.ok(read('capacitor.config.ts').includes('appName: "BlueGuard Buoy"'));
});

test('SEEFIX search toolbar and separation from classification filter', () => {
  const html=read('src/app/pages/devices.page.html');
  const css=read('src/app/pages/devices.page.scss');
  const ts=read('src/app/pages/devices.page.ts');
  assert.match(html, /<ion-toolbar class="search">/);
  assert.match(html, /\[debounce\]="200"/);
  assert.match(html, /\(ionInput\)="onSearch\(\$event.detail.value\)"/);
  assert.ok(html.indexOf('</ion-header>')<html.indexOf('class="classification-filter"'));
  assert.match(css, /--border-radius:\s*16px/);
  assert.match(css, /margin-top:\s*12px/);
  assert.ok(ts.includes('onSearch(value: string | null | undefined)'));
});

test('Profile hides role and keeps log out sticky inside content', () => {
  const html=read('src/app/pages/profile.page.html');
  const css=read('src/app/pages/profile.page.scss');
  assert.ok(!html.includes('<ion-label>Role</ion-label>'));
  assert.ok(!html.includes('{{ p.role | titlecase }} account'));
  assert.ok(html.includes('profile-layout'));
  assert.ok(html.includes('profile-actions'));
  assert.ok(html.indexOf('profile-actions')<html.indexOf('</ion-content>'));
  assert.match(css, /position:\s*sticky/);
  assert.match(css, /bottom:\s*0/);
  assert.match(css, /margin-top:\s*auto/);
});

test('P2-14 password change requires Firebase reauthentication and confirmation without affecting Google Sign-In',()=>{
 const auth=read('src/app/core/auth.service.ts'),profile=read('src/app/pages/profile.page.ts'),html=read('src/app/pages/profile.page.html');
 assert.ok(auth.includes('reauthenticateWithCredential'));
 assert.ok(auth.includes('updatePassword'));
 assert.ok(auth.includes('EmailAuthProvider.credential'));
 assert.ok(auth.includes('FirebaseAuthentication.signInWithGoogle'));
 assert.ok(profile.includes('this.newPassword!==this.confirmPassword'));
 assert.ok(html.includes('Current password'));
 assert.ok(html.includes('Confirm new password'));
});
