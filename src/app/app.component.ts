import { Component, inject } from "@angular/core";
import { Router } from "@angular/router";
import { AuthService } from "./core/auth.service";
import { appLinkDestination,clearAppLink,peekAppLink } from "./core/app-links";
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
    const raw=peekAppLink(),target=raw?appLinkDestination(raw):null;
    if(!raw)return;
    if(!target){clearAppLink();return}
    // Retain pending link until a verified Firebase sign-in completes.
    if(!(await this.auth.ready())){
      await this.router.navigateByUrl('/login');
      return;
    }
    clearAppLink();
    await this.router.navigateByUrl(target);
  }
}
