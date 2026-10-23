import {Component,inject} from '@angular/core';import {FormsModule} from '@angular/forms';import {RouterLink} from '@angular/router';import {IonContent,IonInput,IonButton} from '@ionic/angular/standalone';import {AuthService} from '../core/auth.service';
@Component({standalone:true,imports:[FormsModule,RouterLink,IonContent,IonInput,IonButton],templateUrl:'./forgot.page.html',styleUrls:['./login.page.scss']})export class ForgotPage{
 email='';message='';private auth=inject(AuthService);async reset(){try{await this.auth.resetPassword(this.email);this.message='If the address is eligible, reset instructions have been sent.'}catch{this.message='Unable to submit reset. Please try again.'}}
}
