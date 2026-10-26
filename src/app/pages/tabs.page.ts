import {Component} from '@angular/core';
import {IonTabs,IonTabBar,IonTabButton,IonIcon,IonLabel} from '@ionic/angular/standalone';
import {addIcons} from 'ionicons';
import {homeOutline,waterOutline,notificationsOutline,personCircleOutline} from 'ionicons/icons';

@Component({standalone:true,imports:[IonTabs,IonTabBar,IonTabButton,IonIcon,IonLabel],
 templateUrl:'./tabs.page.html',styleUrls:['./tabs.page.scss']})
export class TabsPage{
 constructor(){addIcons({homeOutline,waterOutline,notificationsOutline,personCircleOutline});}
}
