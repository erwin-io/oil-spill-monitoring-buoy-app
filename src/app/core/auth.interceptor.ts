import {inject} from '@angular/core';import {HttpInterceptorFn} from '@angular/common/http';import {from,switchMap} from 'rxjs';import {AuthService} from './auth.service';import {environment} from '../../environments/environment';
export const authInterceptor:HttpInterceptorFn=(req,next)=>{
 if(!req.url.startsWith(environment.api)||req.url.endsWith('/auth/bootstrap'))return next(req);
 const auth=inject(AuthService);return from(auth.token()).pipe(switchMap(t=>next(req.clone({setHeaders:{Authorization:`Bearer ${t}`}}))));
};
