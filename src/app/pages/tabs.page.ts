import {Component,inject} from '@angular/core';
import {IonTabs,IonTabBar,IonTabButton,IonIcon,IonLabel,IonModal} from '@ionic/angular/standalone';
import {addIcons} from 'ionicons';
import {homeOutline,waterOutline,notificationsOutline,personCircleOutline} from 'ionicons/icons';
import {createAnimation} from '@ionic/angular';
import {AddDeviceModalService} from '../core/add-device-modal.service';
import {AddDevicePage} from './add-device.page';
@Component({standalone:true,imports:[IonTabs,IonTabBar,IonTabButton,IonIcon,IonLabel,IonModal,AddDevicePage],
templateUrl:'./tabs.page.html',styleUrls:['./tabs.page.scss']})
export class TabsPage{
 readonly deviceModal=inject(AddDeviceModalService);
 constructor(){addIcons({homeOutline,waterOutline,notificationsOutline,personCircleOutline});}
 readonly enterAnimation=(baseEl:HTMLElement)=>{
  const target=baseEl.shadowRoot?.querySelector('.modal-wrapper')??baseEl;
  return createAnimation().addElement(target as HTMLElement).duration(350).easing('cubic-bezier(0.2,0,0,1)')
   .fromTo('transform','translateY(100%)','translateY(0)');
 };
 readonly leaveAnimation=(baseEl:HTMLElement)=>{
  const target=baseEl.shadowRoot?.querySelector('.modal-wrapper')??baseEl;
  return createAnimation().addElement(target as HTMLElement).duration(240).easing('ease-in')
   .fromTo('transform','translateY(0)','translateY(100%)');
 };
}
