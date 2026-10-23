import {Component,inject} from '@angular/core';import {Router,RouterLink} from '@angular/router';import {IonContent,IonButton} from '@ionic/angular/standalone';import {AuthService} from '../core/auth.service';
@Component({standalone:true,imports:[RouterLink,IonContent,IonButton],templateUrl:'./verify.page.html',styleUrls:['./login.page.scss']})export class VerifyPage{
 message='';private auth=inject(AuthService);private router=inject(Router);
 async resend(){try{await this.auth.resendVerification();this.message='Verification email sent.'}catch(e){this.message=(e as Error).message}}
 async check(){try{if(await this.auth.reloadVerified())await this.router.navigateByUrl('/tabs/overview');else this.message='Email not yet verified.'}catch(e){this.message=(e as Error).message}}
}
