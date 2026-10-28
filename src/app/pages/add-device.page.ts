import {Component,OnDestroy,inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Router} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {Capacitor} from '@capacitor/core';
import {BarcodeScanner,BarcodeFormat} from '@capacitor-mlkit/barcode-scanning';
import {IonContent,IonHeader,IonToolbar,IonTitle,IonButton,IonButtons,IonIcon,ModalController} from '@ionic/angular/standalone';
import {ApiService,PairState} from '../core/api.service';
import {AuthService} from '../core/auth.service';
import {parseDeviceQr} from '../core/pairing-code';
import {uiError} from '../core/ui-error';
import {AddDeviceModalService} from '../core/add-device-modal.service';
import {ScreenCacheService} from '../core/screen-cache.service';
import {addIcons} from 'ionicons';
import {closeOutline} from 'ionicons/icons';

@Component({selector:'app-add-device',standalone:true,imports:[CommonModule,IonContent,IonHeader,IonToolbar,IonTitle,IonButton,IonButtons,IonIcon],templateUrl:'./add-device.page.html',styleUrls:['./add-device.page.scss']})
export class AddDevicePage implements OnDestroy {
 readonly modal=inject(AddDeviceModalService);
 private readonly cache=inject(ScreenCacheService);
 private readonly modalController=inject(ModalController);
 private readonly api=inject(ApiService);
 private readonly auth=inject(AuthService);
 private readonly router=inject(Router);
 deviceId='';intentId='';state:PairState|''='';expiresAt='';
 busy=false;error='';networkInterrupted=false;
 private timer?:ReturnType<typeof setTimeout>;
 private generation=0;private claimantUid='';private finished=false;
 private readonly sessionEnded=()=>{void this.cancelCurrent()};
 constructor(){
  addIcons({closeOutline});
  if(typeof window!=='undefined')window.addEventListener('blueguard:session-ended',this.sessionEnded);
 }
 private stop():void{
  ++this.generation;
  if(this.timer)clearTimeout(this.timer);
  this.timer=undefined;
 }
 private valid(epoch:number):boolean{
  return epoch===this.generation&&!!this.claimantUid&&this.auth.currentUser()?.uid===this.claimantUid;
 }
 /** Abort local polling immediately, then best-effort revoke the precise remote intent. */
 private async cancelCurrent():Promise<void>{
  const id=this.deviceId,intent=this.intentId,uid=this.claimantUid,confirmed=this.state==='CONFIRMED';
  this.stop();this.intentId='';this.state='';this.claimantUid='';this.busy=false;
  if(intent&&!confirmed&&this.auth.currentUser()?.uid===uid){
   try{await firstValueFrom(this.api.cancelPairIntent(id,intent))}catch{/* Five-minute expiry is the server fallback. */}
  }
 }
 async close():Promise<void>{
  void this.cancelCurrent();
  const top=await this.modalController.getTop();
  if(top){await top.dismiss(undefined,'cancel');return}
  await this.router.navigateByUrl('/tabs/overview');
 }
 ionViewWillLeave():void{void this.cancelCurrent()}
 ngOnDestroy():void{
  if(typeof window!=='undefined')window.removeEventListener('blueguard:session-ended',this.sessionEnded);
  void this.cancelCurrent();
 }
 async scan():Promise<void>{
  this.error='';this.networkInterrupted=false;
  if(this.busy||this.intentId)return;
  if(!Capacitor.isNativePlatform()||!Capacitor.isPluginAvailable('BarcodeScanner')){
   this.error='QR scanning requires the installed Android app. No device key or claim code is needed.';return;
  }
  const epoch=this.generation;let found='';
  this.busy=true;
  try{
   if(!(await BarcodeScanner.isSupported()).supported)throw new Error('This device does not support QR scanning.');
   if(Capacitor.getPlatform()==='android'&&!(await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable()).available){
    await BarcodeScanner.installGoogleBarcodeScannerModule();
    throw new Error('The scanner is being set up. Scan again after setup completes.');
   }
   const result=await BarcodeScanner.scan({formats:[BarcodeFormat.QrCode]});
   if(epoch!==this.generation)return;
   if(result.barcodes.length)found=parseDeviceQr(result.barcodes[0].rawValue).deviceId;
   else this.error='No QR code detected. Try scanning again.';
  }catch(e){if(epoch===this.generation)this.error=uiError(e)}
  finally{if(epoch===this.generation)this.busy=false}
  if(found&&epoch===this.generation)await this.beginPairing(found);
 }
 /** Called only after a validated QR scan, or by the explicit Retry button. */
 async beginPairing(id:string):Promise<void>{
  if(this.busy)return;
  this.stop();
  const epoch=this.generation;
  this.deviceId=id;this.intentId='';this.state='';this.error='';this.expiresAt='';
  this.networkInterrupted=false;this.finished=false;this.busy=true;
  const user=this.auth.currentUser();
  if(!user){this.error='Sign in before adding a buoy.';this.busy=false;return}
  this.claimantUid=user.uid;
  try{
   const pending=await firstValueFrom(this.api.createPairIntent(id));
   if(!this.valid(epoch))return;
   if(pending.deviceId!==id||!pending.intentId)throw new Error('Pairing response did not match your buoy.');
   this.intentId=pending.intentId;this.state=pending.state;this.expiresAt=pending.expiresAt;
   if(['WAITING_FOR_PAIR','PENDING'].includes(pending.state))
    this.schedule(id,pending.intentId,epoch,1800);
  }catch(e:any){
   if(!this.valid(epoch))return;
   this.state=e?.status===409?(e?.error?.error?.code==='ALREADY_OWNED'?'ALREADY_OWNED':'CONFLICT'):'';
   this.error=this.state==='ALREADY_OWNED'?'This buoy already belongs to an account. The current owner must transfer it.':
    this.state==='CONFLICT'?'Another pairing attempt is active or conflicted. Try again after the current attempt is cancelled or expires.':uiError(e);
  }finally{if(this.valid(epoch))this.busy=false}
 }
 private schedule(id:string,intent:string,epoch:number,delay:number):void{
  if(!this.valid(epoch))return;
  this.timer=setTimeout(()=>void this.poll(id,intent,epoch),delay);
 }
 private async poll(id:string,intent:string,epoch:number):Promise<void>{
  if(!this.valid(epoch)||this.intentId!==intent)return;
  if(Date.now()>=Date.parse(this.expiresAt)){
   this.state='EXPIRED';this.error='The five-minute pairing window expired. Scan again or retry.';return;
  }
  try{
   const result=await firstValueFrom(this.api.pairIntentStatus(id,intent));
   if(!this.valid(epoch)||this.intentId!==intent)return;
   if(result.deviceId!==id||result.intentId!==intent)throw new Error('Pairing response did not match your session.');
   this.networkInterrupted=false;this.error='';this.state=result.state;
   if(result.state==='CONFIRMED'){await this.finish(id,epoch);return}
   if(['EXPIRED','CONFLICT','CANCELLED','ALREADY_OWNED'].includes(result.state))return;
  }catch(e:any){
   if(!this.valid(epoch))return;
   if(e?.status===401||e?.status===403||e?.status===404){
    this.error='The pairing session is no longer authorized. Sign in and retry.';this.state='CANCELLED';return;
   }
   this.networkInterrupted=true;
   this.error='Connection interrupted. Waiting for the API to reconnect before this pairing window expires.';
  }
  if(this.valid(epoch))this.schedule(id,intent,epoch,this.networkInterrupted?4500:2400);
 }
 private async finish(id:string,epoch:number):Promise<void>{
  if(!this.valid(epoch)||this.finished)return;
  this.finished=true;this.busy=true;
  try{
   await this.auth.bootstrap();
   if(!this.valid(epoch))return;
   this.cache.markStale(['devices','alerts','invitations','transfers']);
   await this.cache.fetch('devices',async()=>await firstValueFrom(this.api.devices(true)),true);
   if(!this.valid(epoch))return;
   await this.modal.close();
   await this.router.navigate(['/tabs/buoys',id]);
  }catch{
   if(this.valid(epoch)){
    this.error='Device connected on the server. Refresh My Buoys to load your new access.';
    this.finished=false;
   }
  }finally{if(this.valid(epoch))this.busy=false}
 }
 async retry():Promise<void>{
  if(this.busy||!this.deviceId)return;
  const id=this.deviceId;
  await this.cancelCurrent();
  await this.beginPairing(id);
 }
}
