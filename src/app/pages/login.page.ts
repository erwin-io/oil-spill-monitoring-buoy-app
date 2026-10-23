import {Component,inject} from '@angular/core';import {FormsModule} from '@angular/forms';import {Router,RouterLink} from '@angular/router';import {IonContent,IonInput,IonButton,IonSpinner} from '@ionic/angular/standalone';import {AuthService} from '../core/auth.service';
@Component({standalone:true,imports:[FormsModule,RouterLink,IonContent,IonInput,IonButton,IonSpinner],templateUrl:'./login.page.html',styleUrls:['./login.page.scss']})export class LoginPage{
 email='';password='';busy=false;error='';private auth=inject(AuthService);private router=inject(Router);
 async login(){this.busy=true;this.error='';try{await this.auth.signIn(this.email,this.password);await this.router.navigateByUrl('/tabs/overview',{replaceUrl:true})}catch(e){this.error=(e as Error).message;if(this.error.includes('Verify'))await this.router.navigateByUrl('/verify-email')}finally{this.busy=false}}
 async google(){this.busy=true;this.error='';try{await this.auth.signInGoogle();await this.router.navigateByUrl('/tabs/overview',{replaceUrl:true})}catch(e){this.error=(e as Error).message}finally{this.busy=false}}
}
