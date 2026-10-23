import {Component,inject} from '@angular/core';import {CommonModule} from '@angular/common';import {Router} from '@angular/router';import {IonContent,IonHeader,IonToolbar,IonTitle,IonButton} from '@ionic/angular/standalone';import {AuthService} from '../core/auth.service';import {RealtimeService} from '../core/realtime.service';import {PushService} from '../core/push.service';
@Component({standalone:true,imports:[CommonModule,IonContent,IonHeader,IonToolbar,IonTitle,IonButton],templateUrl:'./profile.page.html',styleUrls:['./profile.page.scss']})export class ProfilePage{
 readonly auth=inject(AuthService);private realtime=inject(RealtimeService);private push=inject(PushService);private router=inject(Router);error='';
 async logout(){this.realtime.disconnect();await this.push.stop();try{await this.auth.logout();await this.router.navigateByUrl('/login',{replaceUrl:true})}catch(e){this.error=(e as Error).message}}
}
