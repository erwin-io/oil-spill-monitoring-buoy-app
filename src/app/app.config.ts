import { ApplicationConfig } from "@angular/core";
import { RouteReuseStrategy } from "@angular/router";
import { IonicRouteStrategy } from "@ionic/angular/standalone";
import {
  provideRouter,
  withPreloading,
  PreloadAllModules,
} from "@angular/router";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { provideIonicAngular } from "@ionic/angular/standalone";
import { routes } from "./app.routes";
import { authInterceptor } from "./core/auth.interceptor";
export const appConfig: ApplicationConfig = {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
