import {Injectable,inject} from '@angular/core';
import {ModalController} from '@ionic/angular/standalone';

/** SEEFIX-style programmatic Ionic modal. This avoids the tabs outlet
 * overlay/animation race that made the old declarative modal invisible. */
@Injectable({providedIn:'root'})
export class AddDeviceModalService {
 private readonly modals=inject(ModalController);
 private active?:HTMLIonModalElement;
 private opening=false;

 async open():Promise<void>{
  if(this.opening||this.active)return;
  this.opening=true;
  try{
   const {AddDevicePage}=await import('../pages/add-device.page');
   const modal=await this.modals.create({
    component:AddDevicePage,
    cssClass:'add-device-fullscreen',
    backdropDismiss:true,
    animated:true
   });
   this.active=modal;
   await modal.present();
   this.opening=false;
   await modal.onDidDismiss();
  }catch(error){
   console.error('Add Device modal failed to open',error);
  }finally{
   this.active=undefined;
   this.opening=false;
  }
 }

 async close():Promise<void>{
  // Dismiss the presented modal directly, even if this service's previous
  // instance lost the active reference during a tab lifecycle change.
  const top=await this.modals.getTop();
  if(top)await top.dismiss(undefined,'cancel');
 }
}
