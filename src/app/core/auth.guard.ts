import {inject} from '@angular/core';import {CanActivateFn,Router} from '@angular/router';import {AuthService} from './auth.service';
export const authGuard:CanActivateFn=async()=>{const a=inject(AuthService),router=inject(Router);return await a.ready()?true:router.parseUrl('/login')};
