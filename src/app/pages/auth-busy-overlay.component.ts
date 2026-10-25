import {Component,Input} from '@angular/core';
import {IonSpinner} from '@ionic/angular/standalone';
@Component({selector:'app-auth-busy-overlay',standalone:true,imports:[IonSpinner],
template:`<div class="auth-busy" role="status" aria-live="polite" aria-busy="true">
<svg viewBox="0 0 180 160" width="180" height="160" aria-hidden="true"><circle cx="90" cy="80" r="73" fill="#eaf3ff"/><circle cx="90" cy="80" r="62" fill="#f5faff"/><rect x="42" y="49" width="96" height="71" rx="8" fill="#fff" stroke="#0058db" stroke-width="4"/><path d="M44 57 L90 91 L136 57" fill="none" stroke="#0058db" stroke-width="4"/><circle cx="134" cy="44" r="21" fill="#0cbb89"/><path d="M125 44 L132 51 L144 37" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>
<ion-spinner name="crescent" aria-label="Working"></ion-spinner><h2>{{label}}</h2><p>Securely connecting to BlueGuard Buoy…</p>
</div>`,
styles:[`.auth-busy{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center;background:#fff;box-sizing:border-box;color:#123048}.auth-busy svg{max-width:55vw}.auth-busy h2{font-size:24px;margin:0}.auth-busy p{color:#64748b;margin:0}.auth-busy ion-spinner{width:32px;height:32px;color:#0058db}`]})
export class AuthBusyOverlayComponent{@Input()label='Processing your request';}
