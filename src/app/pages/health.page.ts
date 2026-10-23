import {Component,inject} from '@angular/core';import {CommonModule} from '@angular/common';import {ActivatedRoute} from '@angular/router';import {firstValueFrom} from 'rxjs';import {IonContent,IonHeader,IonToolbar,IonTitle,IonButtons,IonBackButton} from '@ionic/angular/standalone';import {ApiService} from '../core/api.service';import {Health} from '../core/models';
@Component({standalone:true,imports:[CommonModule,IonContent,IonHeader,IonToolbar,IonTitle,IonButtons,IonBackButton],templateUrl:'./health.page.html',styleUrls:['./health.page.scss']})export class HealthPage{
 private api=inject(ApiService);id=inject(ActivatedRoute).snapshot.paramMap.get('id')??'';health?:Health;error='';
 async ionViewWillEnter(){try{this.health=(await firstValueFrom(this.api.health(this.id))).items[0]}catch(e){this.error=(e as Error).message}}
}
