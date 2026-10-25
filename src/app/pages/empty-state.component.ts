import {Component,Input} from '@angular/core';
@Component({selector:'app-empty-state',standalone:true,
template:`<div class="bg-empty-illustration" aria-hidden="true">
<svg viewBox="0 0 240 210" width="240" height="210" focusable="false">
<circle cx="120" cy="102" r="90" fill="#edf5ff"/>
<circle cx="120" cy="102" r="74" fill="#f6faff"/>
@if(kind==='alerts'){
<path d="M87 146h66l-10-16v-34c0-24-9-37-23-37s-23 13-23 37v34z" fill="#fff" stroke="#0058db" stroke-width="5" stroke-linejoin="round"/>
<path d="M111 157q9 14 18 0" stroke="#0058db" fill="none" stroke-width="5" stroke-linecap="round"/>
<circle cx="159" cy="62" r="18" fill="#12ba8c"/><path d="m151 62 6 6 11-12" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
}@else{
<path d="M24 158q24-16 48 0t48 0t48 0t48 0" fill="none" stroke="#68aceb" stroke-width="5" stroke-linecap="round"/>
<path d="M24 176q24-16 48 0t48 0t48 0t48 0" fill="none" stroke="#b6d9f7" stroke-width="5" stroke-linecap="round"/>
<rect x="103" y="91" width="34" height="55" rx="10" fill="#fff" stroke="#0058db" stroke-width="5"/>
<rect x="99" y="76" width="42" height="20" rx="6" fill="#0058db"/>
<path d="M120 76V52m-14 10q14-12 28 0" stroke="#0058db" stroke-width="4" stroke-linecap="round" fill="none"/>
<circle cx="120" cy="52" r="6" fill="#0cbb89"/>
}
<path d="M43 62l9-5M188 142l9 5" stroke="#83b4eb" stroke-width="4" stroke-linecap="round"/>
</svg></div><h2>{{title}}</h2><p>{{description}}</p>`,
styles:[`:host{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:8px;width:100%}
.bg-empty-illustration{max-width:65vw;width:220px}.bg-empty-illustration svg{width:100%;height:auto;display:block}
h2{font-size:22px;line-height:1.35;color:#123048;margin:5px 0;font-weight:700}
p{max-width:330px;font-size:14px;line-height:1.6;color:#64748b;margin:0 0 12px}
@media(max-height:600px){.bg-empty-illustration{width:130px}}`]})
export class EmptyStateComponent{@Input()kind:'overview'|'buoys'|'alerts'='buoys';@Input()title='Nothing here yet';@Input()description='';}
