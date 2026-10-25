import { Component, inject } from "@angular/core";
import { Router } from "@angular/router";
import { AuthService } from "./core/auth.service";
import { appLinkDestination,clearAppLink,peekAppLink,parseNativeEmailAction } from "./core/app-links";
import { IonApp, IonRouterOutlet } from "@ionic/angular/standalone";
import { RealtimeService } from "./core/realtime.service";
import { PushService } from "./core/push.service";
@Component({
  selector: "app-root",
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
  template: "<ion-app><ion-router-outlet></ion-router-outlet></ion-app>",
})
export class AppComponent {
  private realtime = inject(RealtimeService);
  private push = inject(PushService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  constructor(){
    if(typeof window==='undefined')return;
    window.addEventListener('blueguard:app-link',()=>{void this.openPendingLink()});
    // Read the native cold-start link stored before Angular was initialized.
    queueMicrotask(()=>{void this.openPendingLink()});
  }
  private async openPendingLink():Promise<void>{
    const raw=peekAppLink();
    if(!raw)return;
    const action=parseNativeEmailAction(raw);
    if(action){
      // Clear the raw bearer URL BEFORE routing, and put the code only into
      // volatile AuthService memory. Navigation and history have NO code.
      clearAppLink();
      this.auth.stageNativeEmailAction(action);
      await this.router.navigateByUrl('/email-action',{replaceUrl:true});
      return;
    }
    const target=appLinkDestination(raw);
    if(!target){clearAppLink();return}
    if(target==='/verify-email'){
      // Legacy token-free Firebase browser-return links cannot verify an
      // account or bypass the native-only Gmail→App Firebase action route.
      clearAppLink();
      await this.router.navigateByUrl(
        this.auth.currentUser()?'/verify-email':'/login',
        {replaceUrl:true}
      );
      return;
    }
    if(target==='/login'){
      clearAppLink();
      await this.router.navigateByUrl('/login');
      return;
    }
    // Retain pending device-invitation link until a verified Firebase sign-in completes.
    if(!(await this.auth.ready())){
      await this.router.navigateByUrl('/login');
      return;
    }
    clearAppLink();
    await this.router.navigateByUrl(target);
  }
}
