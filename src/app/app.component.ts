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
}
