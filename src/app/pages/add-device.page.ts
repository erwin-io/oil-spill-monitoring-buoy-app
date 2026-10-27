import {Component,OnDestroy,inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Router,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {Capacitor} from '@capacitor/core';
import {BarcodeScanner,BarcodeFormat} from '@capacitor-mlkit/barcode-scanning';
import {IonContent,IonHeader,IonToolbar,IonTitle,IonButton,IonInput,IonItem,IonButtons,IonIcon,ModalController} from '@ionic/angular/standalone';
import {ApiService} from '../core/api.service';
import {AuthService} from '../core/auth.service';
import {parseProtectedQr} from '../core/pairing-code';
import {uiError} from '../core/ui-error';
import {AddDeviceModalService} from '../core/add-device-modal.service';
import {ScreenCacheService} from '../core/screen-cache.service';
import {addIcons} from 'ionicons';
import {closeOutline} from 'ionicons/icons';

@Component({selector:'app-add-device',standalone:true,imports:[CommonModule,FormsModule,RouterLink,IonContent,IonHeader,IonToolbar,IonTitle,IonButton,IonInput,IonItem,IonButtons,IonIcon],templateUrl:'./add-device.page.html',styleUrls:['./add-device.page.scss']})
export class AddDevicePage implements OnDestroy{
 readonly modal=inject(AddDeviceModalService);
 private cache=inject(ScreenCacheService);
 private readonly modalController=inject(ModalController);
 constructor(){addIcons({closeOutline});}
 async close():Promise<void>{
  const top=await this.modalController.getTop();
  if(top){await top.dismiss(undefined,'cancel');return;}
  this.ionViewWillLeave();
  await this.router.navigateByUrl('/tabs/overview');
 }
 ngOnDestroy():void{this.ionViewWillLeave();}
 private api=inject(ApiService);private auth=inject(AuthService);private router=inject(Router);
 deviceId='';claimCode='';challengeId='';state:''|'PENDING'|'EXPIRED'|'CONFIRMED'='';busy=false;error='';
 private timer?:ReturnType<typeof setTimeout>;private claimantUid='';
 ionViewWillLeave(){this.stop();this.state='';this.claimantUid='';this.claimCode='';this.busy=false;}
 private stop(){if(this.timer)clearTimeout(this.timer);this.timer=undefined}
 async scan(){
  this.error='';
  if(!Capacitor.isNativePlatform()||!Capacitor.isPluginAvailable('BarcodeScanner')){this.error='QR scanning requires the installed Android app. You can enter the protected code below.';return}
  this.busy=true;
  try{
   if(!(await BarcodeScanner.isSupported()).supported)throw new Error('This device does not support QR scanning.');
   if(Capacitor.getPlatform()==='android'&&!(await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable()).available){
    await BarcodeScanner.installGoogleBarcodeScannerModule();
    throw new Error('The scanner is being set up. Try scanning again when setup completes.');
   }
   const result=await BarcodeScanner.scan({formats:[BarcodeFormat.QrCode]});
   if(result.barcodes.length){const qr=parseProtectedQr(result.barcodes[0].rawValue);this.deviceId=qr.deviceId;this.claimCode=qr.claimCode}
   else this.error='No QR code detected. Try scanning again.';
  }catch(e){this.error=uiError(e)}finally{this.busy=false}
 }
 async claim(){
  if(this.busy)return;
  this.stop();this.state='';this.error='';this.busy=true;
  const id=this.deviceId.trim(),code=this.claimCode.trim();
  if(!/^[A-Za-z0-9_-]{1,80}$/.test(id)||!/^[A-Za-z0-9_-]{32,128}$/.test(code)){
   this.error='Enter a valid device ID and protected claim code.';this.busy=false;return;
  }
  try{
   const user=this.auth.currentUser();if(!user)throw new Error('Sign in before adding your buoy.');
   this.claimantUid=user.uid;
   const pending=await firstValueFrom(this.api.requestClaim(id,code));
   this.claimCode='';this.challengeId=pending.challengeId;this.state='PENDING';
   this.timer=setTimeout(()=>void this.poll(id,pending.challengeId),1800);
  }catch(e:any){this.error=e?.status===409?'Press PAIR on the buoy again, then retry within five minutes.':uiError(e);this.claimCode=''}finally{this.busy=false}
 }
 private async poll(id:string,challengeId:string){
  if(this.state!=='PENDING'||this.auth.currentUser()?.uid!==this.claimantUid)return;
  try{
   const result=await firstValueFrom(this.api.claimStatus(id,challengeId));
   if(this.auth.currentUser()?.uid!==this.claimantUid)return;
   this.state=result.state;
   if(result.state==='CONFIRMED'){
    try{
      await this.auth.bootstrap();
      this.cache.markStale(['devices','alerts','invitations','transfers']);
      await this.cache.fetch('devices',async()=>await firstValueFrom(this.api.devices(true)),true);
      await this.modal.close();await this.router.navigate(['/tabs/buoys',id]);
     }
    catch{this.error='Device claimed. Refresh My Buoys to load your new access.'}
    return;
   }
  }catch(e){this.error=uiError(e)+' You can retry the claim if the pairing window has ended.';this.state='EXPIRED'}
  if(this.state==='PENDING')this.timer=setTimeout(()=>void this.poll(id,challengeId),2500);
 }
}
