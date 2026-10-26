import {Component,Input,OnInit,OnDestroy,inject} from '@angular/core';
import {IonSpinner} from '@ionic/angular/standalone';
import {AuthStatusBarService} from '../core/auth-status-bar.service';

@Component({selector:'app-auth-busy-overlay',standalone:true,imports:[IonSpinner],
template:`
<div class="auth-busy" role="status" aria-live="polite" aria-busy="true">
 <div class="auth-art" aria-hidden="true">
  @if(kind==='google'){
   <svg viewBox="0 0 180 180" width="180" height="180">
    <circle cx="90" cy="90" r="78" fill="#edf4ff"/>
    <circle cx="90" cy="90" r="62" fill="#fff" stroke="#e3ecfa" stroke-width="2"/>
    <g transform="translate(57 56) scale(2.75)">
     <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.15 3.57-8.64Z"/>
     <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.44 1.15-4.06 1.15-3.12 0-5.77-2.1-6.71-4.93H1.3v3.09A11.99 11.99 0 0 0 12 24Z"/>
     <path fill="#FBBC05" d="M5.29 14.31A7.2 7.2 0 0 1 4.91 12c0-.8.14-1.58.38-2.31V6.6H1.3A12 12 0 0 0 0 12c0 1.93.46 3.76 1.3 5.4l3.99-3.09Z"/>
     <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.94 1.19 15.24 0 12 0A11.99 11.99 0 0 0 1.3 6.6l3.99 3.09c.94-2.83 3.59-4.92 6.71-4.92Z"/>
    </g>
   </svg>
  }@else if(kind==='logout'){
   <svg viewBox="0 0 180 180" width="180" height="180">
    <circle cx="90" cy="90" r="76" fill="#edf4ff"/><rect x="49" y="43" width="76" height="98" rx="12" fill="#fff" stroke="#0054e9" stroke-width="5"/>
    <path d="M90 78h48m-13-13 13 13-13 13" stroke="#0054e9" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="66" cy="91" r="4" fill="#0cbb89"/>
   </svg>
  }@else{
   <svg viewBox="0 0 180 180" width="180" height="180">
    <circle cx="90" cy="90" r="76" fill="#eaf3ff"/><circle cx="90" cy="90" r="64" fill="#f6faff"/>
    <rect x="42" y="59" width="96" height="73" rx="10" fill="#fff" stroke="#0054e9" stroke-width="4"/>
    <path d="M45 68 90 100 135 68" fill="none" stroke="#0054e9" stroke-width="4" stroke-linejoin="round"/>
    <circle cx="131" cy="54" r="20" fill="#0cbb89"/><path d="m122 54 7 7 13-16" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
   </svg>
  }
 </div>
 <ion-spinner name="crescent" aria-label="Working"></ion-spinner>
 <h2>{{label}}</h2>
 <p>{{kind==='google'?'Signing in securely with your Google account…':kind==='logout'?'Securing your session and disconnecting notifications…':kind==='verify'?'Confirming your email securely…':'Securely connecting to BlueGuard Buoy…'}}</p>
</div>`,
styles:[`.auth-busy{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;background:#fff;box-sizing:border-box;color:#123048}.auth-art{width:180px;height:180px;max-width:55vw;display:flex;align-items:center}.auth-art svg{width:100%;height:auto}.auth-busy h2{font-size:24px;font-weight:600;margin:0}.auth-busy p{color:#64748b;font-size:14px;line-height:1.55;max-width:320px;margin:0}.auth-busy ion-spinner{width:32px;height:32px;color:#0054e9}`]})
export class AuthBusyOverlayComponent implements OnInit,OnDestroy{
 @Input()label='Processing your request';
 @Input()kind:'default'|'google'|'register'|'verify'|'logout'='default';
 private readonly statusBar=inject(AuthStatusBarService);
 ngOnInit(){void this.statusBar.setBusy(true);}
 ngOnDestroy(){void this.statusBar.setBusy(false);}
}
