import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync('src/app/pages/'+p,'utf8');

test('BlueGuard password reset sends then displays centered inbox screen and keeps Firebase security inside app',()=>{
 const ts=read('forgot.page.ts'),html=read('forgot.page.html');
 assert.match(ts,/await this\.auth\.resetPassword/);
 assert.match(ts,/this\.sent=true/);
 assert.match(html,/class="verify-wait-layout"/);
 assert.match(html,/Check your inbox/);
 assert.match(html,/Resend reset email/);
 assert.doesNotMatch(html,/Back to sign in<\/ion-button>/);
 const native=read('native-email-action.page.ts');
 assert.match(native,/this\.progressMessage='Updating your password/);
 assert.match(native,/finishNativePasswordReset/);
 assert.match(native,/this\.success=true/);
});
test('Profile settings have separate screens, avatar click crop, and Yes-No sign-out confirmation',()=>{
 const profile=read('profile.page.html'),code=read('profile.page.ts');
 assert.match(profile,/class="avatar-trigger"/);
 assert.match(profile,/\(click\)="openPhotoEditor\(\)"/);
 assert.match(profile,/id="blueguard-crop-canvas"/);
 assert.match(profile,/Crop and save photo/);
 assert.match(profile,/routerLink="\/tabs\/profile\/edit-name"/);
 assert.match(profile,/routerLink="\/tabs\/profile\/password"/);
 assert.doesNotMatch(profile,/Current password|Confirm new password/);
 assert.doesNotMatch(profile,/Save display name/);
 assert.match(profile,/confirmSignOut=true/);
 assert.match(code,/text:'No',role:'cancel'/);
 assert.match(code,/text:'Yes',role:'confirm'/);
 assert.match(code,/canvas\.toBlob/);
 assert.match(code,/await this\.auth\.uploadAvatar\(blob\)/);
 assert.match(read('profile-password.page.ts'),/await this\.auth\.resetPassword\(email\)/);
});
test('Empty illustrations and FAB/pairing modal preserve existing authorized device routes',()=>{
 const dashboard=read('dashboard.page.html'),buoys=read('devices.page.html'),alerts=read('alerts.page.html');
 const tabs=read('tabs.page.html'),tabTs=read('tabs.page.ts'),add=read('add-device.page.ts');
 assert.match(dashboard,/app-empty-state kind="overview"/);
 assert.match(dashboard,/View invitations <ion-icon/);
 assert.match(dashboard,/class="invitations-pill"/);
 assert.doesNotMatch(dashboard,/>Add Device<\/ion-button>/);
 assert.match(buoys,/app-empty-state kind="buoys"/);
 assert.match(alerts,/app-empty-state kind="alerts"/);
 assert.match(dashboard,/ion-fab-button aria-label="Add buoy"/);
 assert.match(buoys,/ion-fab-button aria-label="Add buoy"/);
 assert.match(tabs,/ion-modal \[isOpen\]="deviceModal\.opened\(\)"/);
 assert.match(tabTs,/translateY\(100%\)/);
 assert.match(add,/parseProtectedQr/);
 assert.match(add,/this\.api\.requestClaim/);
 const routes=readFileSync('src/app/app.routes.ts','utf8');
 assert.match(routes,/path: "add-device"/);
});
test('Authentication pending states are full-screen and Android Back is intercepted on root sign-in',()=>{
 for(const p of ['login.page.html','register.page.html']){
  assert.match(read(p),/app-auth-busy-overlay/);
 }
 assert.match(read('login.page.ts'),/subscribeWithPriority\(1000,\(\)=>\{\}\)/);
 assert.match(read('login.page.ts'),/ionViewWillLeave/);
 assert.doesNotMatch(read('register.page.html'),/>Back to sign in<\/ion-button>/);
});
