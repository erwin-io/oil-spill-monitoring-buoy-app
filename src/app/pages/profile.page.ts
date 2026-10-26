import {CommonModule} from '@angular/common';
import {Component,ElementRef,OnDestroy,ViewChild,inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Router,RouterLink} from '@angular/router';
import {IonAlert,IonAvatar,IonBadge,IonButton,IonContent,IonHeader,IonFooter,IonIcon,IonItem,IonLabel,IonList,IonListHeader,IonModal,ModalController,IonNote,IonSpinner,IonTitle,IonToolbar} from '@ionic/angular/standalone';
import {addIcons} from 'ionicons';
import {alertCircleOutline,checkmarkCircleOutline,informationCircleOutline,logOutOutline,mailOutline,createOutline,lockClosedOutline,chevronForwardOutline,cameraOutline,imagesOutline,trashOutline,closeOutline} from 'ionicons/icons';
import {AuthService} from '../core/auth.service';
import {RealtimeService} from '../core/realtime.service';
import {PushService} from '../core/push.service';
import {AuthBusyOverlayComponent} from './auth-busy-overlay.component';
@Component({standalone:true,
 imports:[CommonModule,FormsModule,RouterLink,IonAlert,IonAvatar,IonBadge,IonButton,IonContent,IonHeader,IonFooter,IonIcon,IonItem,IonLabel,IonList,IonListHeader,IonModal,IonNote,IonSpinner,IonTitle,IonToolbar,AuthBusyOverlayComponent],
 templateUrl:'./profile.page.html',styleUrls:['./profile.page.scss']})
export class ProfilePage implements OnDestroy {
 readonly auth=inject(AuthService);
 private readonly realtime=inject(RealtimeService);
 private readonly push=inject(PushService);
 private readonly router=inject(Router);
 private readonly modals=inject(ModalController);
 private openingSettings=false;
 error='';signingOut=false;confirmSignOut=false;
 editingPhoto=false;savingAvatar=false;avatarFeedback='';
 photoSrc='';photoZoom=1;photoX=0;photoY=0;
 @ViewChild('cropCanvas') cropCanvas?:ElementRef<HTMLCanvasElement>;
 photoImage?:HTMLImageElement;
 private photoUrl='';
 readonly signOutButtons=[
  {text:'No',role:'cancel'},
  {text:'Yes',role:'confirm',handler:()=>{void this.logout();}}
 ];
 constructor(){addIcons({alertCircleOutline,checkmarkCircleOutline,informationCircleOutline,logOutOutline,mailOutline,createOutline,lockClosedOutline,chevronForwardOutline,cameraOutline,imagesOutline,trashOutline,closeOutline});}
 initials(name?:string):string{
  return (name??'BG').trim().split(/\s+/).slice(0,2)
   .map(part=>part[0]?.toUpperCase()??'').join('')||'BG';
 }
 async openSettings(kind:'name'|'password'):Promise<void>{
  if(this.openingSettings||this.signingOut)return;
  this.openingSettings=true;
  try{
   const component=kind==='name'
    ?(await import('./edit-display-name.page')).EditDisplayNamePage
    :(await import('./profile-password.page')).ProfilePasswordPage;
   const modal=await this.modals.create({component,cssClass:'blueguard-settings-modal',backdropDismiss:false});
   await modal.present();
   // No nested tab routes: all controls render above the tab bar.
   await modal.onDidDismiss();
  }catch(e){this.error='Unable to open account settings. Please try again.';}
  finally{this.openingSettings=false;}
 }
 openPhotoEditor():void{this.avatarFeedback='';this.editingPhoto=true;}
 clearSelectedAvatar():void{
  if(this.savingAvatar)return;
  if(this.photoUrl)URL.revokeObjectURL(this.photoUrl);
  this.photoUrl='';this.photoSrc='';this.photoImage=undefined;
  this.photoZoom=1;this.photoX=0;this.photoY=0;this.avatarFeedback='';
  const canvas=this.cropCanvas?.nativeElement;
  canvas?.getContext('2d')?.clearRect(0,0,canvas.width,canvas.height);
 }

 closePhotoEditor():void{
  if(this.savingAvatar)return;
  this.editingPhoto=false;
  this.clearSelectedAvatar();
 }
 async selectAvatar(event:Event):Promise<void>{
  const input=event.target as HTMLInputElement;
  const file=input.files?.[0];
  input.value='';
  if(!file||this.savingAvatar)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20*1024*1024||file.size<12){
   this.avatarFeedback='Choose a JPG, PNG or WebP photo up to 20 MB. BlueGuard compresses the saved crop.';return;
  }
  this.avatarFeedback='';
  if(this.photoUrl)URL.revokeObjectURL(this.photoUrl);
  this.photoUrl=URL.createObjectURL(file);
  this.photoSrc=this.photoUrl;
  this.photoZoom=1;this.photoX=0;this.photoY=0;
  const image=new Image();
  image.onload=()=>{if(this.photoImage===image)this.drawPreview();};
  image.onerror=()=>{if(this.photoImage===image)this.avatarFeedback='Cannot read this image. Choose another photo.';};
  this.photoImage=image;
  image.src=this.photoUrl;
 }
 drawPreview():void{
  const canvas=this.cropCanvas?.nativeElement;
  const img=this.photoImage;
  if(!canvas||!img||!img.complete||!img.naturalWidth||!img.naturalHeight)return;
  const size=canvas.width;
  const zoom=Math.max(1,Math.min(3,this.photoZoom));
  const scale=Math.max(size/img.naturalWidth,size/img.naturalHeight)*zoom;
  const width=img.naturalWidth*scale,height=img.naturalHeight*scale;
  const extraX=Math.max(0,width-size),extraY=Math.max(0,height-size);
  const x=-extraX/2+(this.photoX/100)*(extraX/2);
  const y=-extraY/2+(this.photoY/100)*(extraY/2);
  const context=canvas.getContext('2d');
  if(!context)return;
  context.clearRect(0,0,size,size);
  context.drawImage(img,x,y,width,height);
 }
 async saveAvatar():Promise<void>{
  if(this.savingAvatar||!this.photoImage?.naturalWidth)return;
  this.drawPreview();
  const canvas=this.cropCanvas?.nativeElement;
  if(!canvas){this.avatarFeedback='Choose a photo first.';return}
  this.savingAvatar=true;this.avatarFeedback='';
  try{
   const blob=await new Promise<Blob>((resolve,reject)=>{
    canvas.toBlob(value=>value?resolve(value):reject(Error('Photo crop failed')),'image/jpeg',0.85);
   });
   await this.auth.uploadAvatar(blob);
   this.savingAvatar=false;this.closePhotoEditor();
  }catch(error){
   this.avatarFeedback=(error as Error).message||'Unable to save profile photo.';
   this.savingAvatar=false;
  }
 }
 async removeAvatar():Promise<void>{
  if(this.savingAvatar)return;
  this.savingAvatar=true;this.avatarFeedback='';
  try{await this.auth.removeAvatar();this.savingAvatar=false;this.closePhotoEditor();}
  catch(error){this.avatarFeedback=(error as Error).message||'Unable to remove photo';this.savingAvatar=false;}
 }
 async logout():Promise<void>{
  if(this.signingOut)return;
  this.confirmSignOut=false;this.signingOut=true;this.error='';
  let progress:HTMLIonModalElement|undefined;
  try{
   // Render above the router outlet AND the tab bar. A page-local fixed
   // overlay cannot intercept interactions with the sibling ion-tab-bar.
   progress=await this.modals.create({
    component:AuthBusyOverlayComponent,
    componentProps:{label:'Signing out',kind:'logout'},
    cssClass:'blueguard-progress-modal',
    backdropDismiss:false,animated:false,
    canDismiss:async (_data,role)=>role==='complete'
   });
   await progress.present();
   await this.push.stop(true);this.realtime.disconnect();
   await this.auth.logout();
   await this.router.navigateByUrl('/login',{replaceUrl:true});
  }catch(error){this.error=(error as Error).message||'Unable to sign out. Please try again.';}
  finally{
   try{await progress?.dismiss(undefined,'complete');}catch{}
   this.signingOut=false;
  }
 }
 ngOnDestroy():void{if(this.photoUrl)URL.revokeObjectURL(this.photoUrl);}
}
