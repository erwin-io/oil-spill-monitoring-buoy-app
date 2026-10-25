import {CommonModule} from '@angular/common';
import {Component,OnDestroy,inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Router,RouterLink} from '@angular/router';
import {IonAlert,IonAvatar,IonBadge,IonButton,IonContent,IonHeader,IonIcon,IonItem,IonLabel,IonList,IonListHeader,IonModal,IonNote,IonSpinner,IonTitle,IonToolbar} from '@ionic/angular/standalone';
import {addIcons} from 'ionicons';
import {alertCircleOutline,checkmarkCircleOutline,informationCircleOutline,logOutOutline,mailOutline,createOutline,lockClosedOutline,chevronForwardOutline,cameraOutline} from 'ionicons/icons';
import {AuthService} from '../core/auth.service';
import {RealtimeService} from '../core/realtime.service';
import {PushService} from '../core/push.service';
@Component({standalone:true,
 imports:[CommonModule,FormsModule,RouterLink,IonAlert,IonAvatar,IonBadge,IonButton,IonContent,IonHeader,IonIcon,IonItem,IonLabel,IonList,IonListHeader,IonModal,IonNote,IonSpinner,IonTitle,IonToolbar],
 templateUrl:'./profile.page.html',styleUrls:['./profile.page.scss']})
export class ProfilePage implements OnDestroy {
 readonly auth=inject(AuthService);
 private readonly realtime=inject(RealtimeService);
 private readonly push=inject(PushService);
 private readonly router=inject(Router);
 error='';signingOut=false;confirmSignOut=false;
 editingPhoto=false;savingAvatar=false;avatarFeedback='';
 photoSrc='';photoZoom=1;photoX=0;photoY=0;
 private photoImage?:HTMLImageElement;
 private photoUrl='';
 readonly signOutButtons=[
  {text:'No',role:'cancel'},
  {text:'Yes',role:'confirm',handler:()=>{void this.logout();}}
 ];
 constructor(){addIcons({alertCircleOutline,checkmarkCircleOutline,informationCircleOutline,logOutOutline,mailOutline,createOutline,lockClosedOutline,chevronForwardOutline,cameraOutline});}
 initials(name?:string):string{
  return (name??'BG').trim().split(/\s+/).slice(0,2)
   .map(part=>part[0]?.toUpperCase()??'').join('')||'BG';
 }
 openPhotoEditor():void{this.avatarFeedback='';this.editingPhoto=true;}
 closePhotoEditor():void{
  if(this.savingAvatar)return;
  this.editingPhoto=false;
  if(this.photoUrl)URL.revokeObjectURL(this.photoUrl);
  this.photoUrl='';this.photoSrc='';this.photoImage=undefined;
  this.photoZoom=1;this.photoX=0;this.photoY=0;
 }
 async selectAvatar(event:Event):Promise<void>{
  const input=event.target as HTMLInputElement;
  const file=input.files?.[0];
  input.value='';
  if(!file||this.savingAvatar)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>2*1024*1024||file.size<12){
   this.avatarFeedback='Select a JPG, PNG or WebP image up to 2 MB.';return;
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
  const canvas=(document.getElementById('blueguard-crop-canvas') as HTMLCanvasElement | null);
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
  const canvas=(document.getElementById('blueguard-crop-canvas') as HTMLCanvasElement | null);
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
  try{
   await this.push.stop(true);this.realtime.disconnect();
   await this.auth.logout();
   await this.router.navigateByUrl('/login',{replaceUrl:true});
  }catch(error){this.error=(error as Error).message||'Unable to sign out. Please try again.';}
  finally{this.signingOut=false;}
 }
 ngOnDestroy():void{if(this.photoUrl)URL.revokeObjectURL(this.photoUrl);}
}
