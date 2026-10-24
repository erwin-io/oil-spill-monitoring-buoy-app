import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function trendsHarness(){
 const captured=[];
 class Chart {
  static register(){}
  constructor(element,config){this.config=config;captured.push(this);}
  destroy(){this.destroyed=true;}
 }
 class ApiService {}
 class ActivatedRoute {}
 const components=Object.fromEntries(
  ['IonContent','IonHeader','IonToolbar','IonTitle','IonButtons','IonBackButton','IonSelect','IonSelectOption']
   .map(x=>[x,class{}])
 );
 const modules={
  '@angular/core':{Component:()=>x=>x,inject:(type)=>{
   if(type===ActivatedRoute)return {snapshot:{paramMap:{get:()=> 'THESIS_TEST_01'}}};
   return {};
  }},
  '@angular/common':{CommonModule:class{}},
  '@angular/forms':{FormsModule:class{}},
  '@angular/router':{ActivatedRoute},
  'rxjs':{firstValueFrom:async x=>x},
  'chart.js':{Chart,registerables:[]},
  '@ionic/angular/standalone':components,
  '../core/api.service':{ApiService},
 };
 const exports={};
 vm.runInNewContext(ts.transpileModule(readFileSync('src/app/pages/trends.page.ts','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true},
 }).outputText,{
  exports,require:n=>{if(!(n in modules))throw Error('Unexpected module '+n);return modules[n];},
  console,
 });
 const page=new exports.TrendsPage();
 page.canvas={nativeElement:{}};
 page.items=[
  {measurementId:'new',measuredAt:'2026-10-24T02:00:00Z',classification:'PETROLEUM',
    totalFluorescence:110,confidence:0.91,batteryPercent:10,signalStrengthDbm:-95},
  {measurementId:'old',measuredAt:'2026-10-24T01:00:00Z',classification:'NORMAL',
    totalFluorescence:20,confidence:0.87,batteryPercent:80,signalStrengthDbm:-70},
 ];
 return {page,captured};
}
test('charts map newest-first API history to ascending chronological values for five supported metrics',()=>{
 const {page,captured}=trendsHarness();
 const expectations=[
  ['totalFluorescence',[20,110]],
  ['confidence',[.87,.91]],
  ['batteryPercent',[80,10]],
  ['signalStrengthDbm',[-70,-95]],
  ['classification',[0,3]],
 ];
 for(const [metric,expected] of expectations){
  page.metric=metric;page.render();
  const dataset=captured.at(-1).config.data.datasets[0].data;
  assert.deepEqual(Array.from(dataset),expected,`metric ${metric} mapped incorrectly`);
 }
 assert.equal(captured.length,5);
 assert.ok(captured.slice(0,-1).every(c=>c.destroyed),'chart redraw must destroy previous Chart.js instance');
 page.ngOnDestroy();
 assert.equal(captured.at(-1).destroyed,true);
});
test('chart keeps missing battery and GSM as gaps rather than inventing zeros',()=>{
 const {page,captured}=trendsHarness();
 delete page.items[0].batteryPercent;
 delete page.items[0].signalStrengthDbm;
 page.metric='batteryPercent';page.render();
 assert.deepEqual(Array.from(captured.at(-1).config.data.datasets[0].data),[80,null]);
 page.metric='signalStrengthDbm';page.render();
 assert.deepEqual(Array.from(captured.at(-1).config.data.datasets[0].data),[-70,null]);
});
