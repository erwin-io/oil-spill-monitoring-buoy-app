import {uiError} from '../core/ui-error';
import {Component,inject} from '@angular/core';import {CommonModule} from '@angular/common';import {ActivatedRoute} from '@angular/router';import {firstValueFrom} from 'rxjs';import {IonContent,IonHeader,IonToolbar,IonTitle,IonButtons,IonBackButton,IonButton} from '@ionic/angular/standalone';import {ApiService} from '../core/api.service';import {Measurement} from '../core/models';
@Component({standalone:true,imports:[CommonModule,IonContent,IonHeader,IonToolbar,IonTitle,IonButtons,IonBackButton,IonButton],templateUrl:'./history.page.html',styleUrls:['./history.page.scss']})export class HistoryPage{
 private api=inject(ApiService);id=inject(ActivatedRoute).snapshot.paramMap.get('id')??'';items:Measurement[]=[];cursor:string|null=null;busy=false;error='';
 async ionViewWillEnter(){this.items=[];this.cursor=null;await this.more()}
 async more(){this.busy=true;this.error='';try{const page=await firstValueFrom(this.api.history(this.id,this.cursor??undefined));this.items.push(...page.items);this.cursor=page.nextCursor}catch(e){this.error=uiError(e)}finally{this.busy=false}}
}
