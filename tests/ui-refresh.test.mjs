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
 assert.match(profile,/<canvas #cropCanvas width="512"/);
 assert.match(profile,/Edit photo/);
 assert.match(profile,/class="photo-picker-actions"/);
 assert.match(profile,/capture="user"/);
 assert.match(profile,/aria-label="Clear selected photo"/);
 assert.match(code,/file.size>20\*1024\*1024/);
 assert.match(profile,/clearSelectedAvatar/);
 assert.match(profile,/<ion-footer class="ion-no-border photo-save-footer"/);
 assert.match(profile,/Crop and save photo/);
 assert.match(profile,/openSettings\('name'\)/);
 assert.match(profile,/openSettings\('password'\)/);
 assert.doesNotMatch(profile,/Current password|Confirm new password/);
 assert.doesNotMatch(profile,/Save display name/);
 assert.match(profile,/confirmSignOut=true/);
 assert.match(code,/text:'No',role:'cancel'/);
 assert.match(code,/text:'Yes',role:'confirm'/);
 assert.match(code,/canvas\.toBlob/);
 assert.match(code,/await this\.auth\.uploadAvatar\(blob\)/);
 assert.match(read('profile-password.page.ts'),/await this\.auth\.resetPassword\(email\)/);
 assert.match(read('profile-password.page.ts'),/app-auth-busy-overlay/);
 assert.match(read('profile.page.ts'),/this\.modals\.create/);
 assert.match(readFileSync('src/styles.scss','utf8'),/ion-modal\.blueguard-settings-modal\{\s*--width:100%;--height:100%/);
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
 assert.doesNotMatch(tabs,/ion-modal/,'Add Device must use Ionic controller, not tabs template modal');
 const modalService=readFileSync('src/app/core/add-device-modal.service.ts','utf8');
 assert.match(modalService,/this\.modals\.create/);
 assert.match(modalService,/await modal\.present\(\)/);
 assert.match(modalService,/await modal\.onDidDismiss\(\)/);
 assert.doesNotMatch(tabTs,/enterAnimation|leaveAnimation/);
 assert.match(add,/parseDeviceQr/);
 assert.match(add,/this\.api\.createPairIntent/);
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
