import {uiError} from '../core/ui-error';
import {Component,inject} from '@angular/core';import {CommonModule} from '@angular/common';import {RouterLink,ActivatedRoute} from '@angular/router';import {firstValueFrom} from 'rxjs';import {IonContent,IonHeader,IonToolbar,IonTitle,IonButtons,IonBackButton,IonButton} from '@ionic/angular/standalone';import {ApiService} from '../core/api.service';import {AuthService} from '../core/auth.service';import {Alert} from '../core/models';
@Component({standalone:true,imports:[CommonModule,RouterLink,IonContent,IonHeader,IonToolbar,IonTitle,IonButtons,IonBackButton,IonButton],templateUrl:'./alert-detail.page.html',styleUrls:['./alert-detail.page.scss']})export class AlertDetailPage{
 private api=inject(ApiService);readonly auth=inject(AuthService);id=inject(ActivatedRoute).snapshot.paramMap.get('id')??'';alert?:Alert;error='';busy=false;
 async ionViewWillEnter(){await this.load()}async load(){try{this.alert=await firstValueFrom(this.api.alert(this.id));try{await firstValueFrom(this.api.markRead(this.id))}catch{/* Viewing remains possible if read receipt cannot save. */}}catch(e){this.error=uiError(e)}}
 async ack(){this.busy=true;try{await firstValueFrom(this.api.acknowledge(this.id));await this.load()}catch(e){this.error=uiError(e)}finally{this.busy=false}}
}
