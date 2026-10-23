import {Component,inject} from '@angular/core';import {FormsModule} from '@angular/forms';import {Router,RouterLink} from '@angular/router';import {IonContent,IonInput,IonButton} from '@ionic/angular/standalone';import {AuthService} from '../core/auth.service';
@Component({standalone:true,imports:[FormsModule,RouterLink,IonContent,IonInput,IonButton],templateUrl:'./register.page.html',styleUrls:['./login.page.scss']})export class RegisterPage{
 email='';password='';message='';busy=false;private auth=inject(AuthService);private router=inject(Router);
 async submit(){this.busy=true;try{await this.auth.register(this.email,this.password);await this.router.navigateByUrl('/verify-email')}catch(e){this.message=(e as Error).message}finally{this.busy=false}}
}
