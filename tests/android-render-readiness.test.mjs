import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {
 inspectAndroidScreenshot,waitForRenderedScreenshot
} from '../scripts/android-render-readiness.mjs';

const signature=Buffer.from([137,80,78,71,13,10,26,10]);

function crc32(input) {
 let crc=0xffffffff;
 for(const byte of input){
  crc^=byte;
  for(let k=0;k<8;k++)crc=(crc>>>1)^(crc&1?0xedb88320:0);
 }
 return (crc^0xffffffff)>>>0;
}
function chunk(type,data){
 const tag=Buffer.from(type,'ascii');
 const header=Buffer.alloc(4);header.writeUInt32BE(data.length);
 const check=Buffer.alloc(4);check.writeUInt32BE(crc32(Buffer.concat([tag,data])));
 return Buffer.concat([header,tag,data,check]);
}
function pngFixture(kind,filter=0) {
 const width=96,height=160,channels=4,stride=width*channels;
 const ihdr=Buffer.alloc(13);
 ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);
 ihdr[8]=8;ihdr[9]=6;
 const raw=Buffer.alloc((stride+1)*height);
 let previous=null;
 for(let y=0;y<height;y++){
  const row=Buffer.alloc(stride);
  for(let x=0;x<width;x++){
   let rgb;
   if(kind==='black')rgb=y<9?[250,250,250]:[0,0,0]; // Android status bar
   else if(kind==='white')rgb=[255,255,255];
   else rgb=y>25&&y<66?[0,83,225]:x>10&&x<75&&y>75&&y<85?[20,30,40]:[255,255,255];
   const i=x*4;
   row[i]=rgb[0];row[i+1]=rgb[1];row[i+2]=rgb[2];row[i+3]=255;
  }
  const base=y*(stride+1);
  raw[base]=filter;
  for(let i=0;i<stride;i++){
   const left=i>=channels?row[i-channels]:0;
   const up=previous?previous[i]:0;
   const upperLeft=previous&&i>=channels?previous[i-channels]:0;
   let pred=0;
   if(filter===1)pred=left;
   else if(filter===2)pred=up;
   else if(filter===3)pred=Math.floor((left+up)/2);
   else if(filter===4){
    const p=left+up-upperLeft;
    const a=Math.abs(p-left),b=Math.abs(p-up),c=Math.abs(p-upperLeft);
    pred=a<=b&&a<=c?left:b<=c?up:upperLeft;
   }
   raw[base+1+i]=(row[i]-pred+256)&255;
  }
  previous=row;
 }
 // tEXt is a valid ancillary chunk; also makes the small fixture long
 // enough to satisfy the production screenshot transport check.
 return Buffer.concat([
  signature,chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),
  chunk('tEXt',Buffer.from('fixture\\0'+'F'.repeat(600))),
  chunk('IEND',Buffer.alloc(0))
 ]);
}

test('actual black startup pattern is not mistaken for a rendered screen',()=>{
 const evidence=inspectAndroidScreenshot(pngFixture('black'));
 assert.equal(evidence.rendered,false);
 assert.ok(evidence.visibleFraction<.1);
 assert.match(evidence.reason,/blank|unfinished/);
});

test('uniform white loading screen without UI details is not accepted',()=>{
 const evidence=inspectAndroidScreenshot(pngFixture('white'));
 assert.equal(evidence.rendered,false);
 assert.equal(evidence.colorFraction,0);
 assert.equal(evidence.inkFraction,0);
});

test('brand-colored header, light content and text counts as visible UI',()=>{
 const evidence=inspectAndroidScreenshot(pngFixture('rendered'));
 assert.equal(evidence.rendered,true);
 assert.ok(evidence.visibleFraction>.25);
 assert.ok(evidence.colorFraction>.002);
});

test('PNG filter types 0 through 4 decode the same visible UI',()=>{
 for(let filter=0;filter<=4;filter++){
  const evidence=inspectAndroidScreenshot(pngFixture('rendered',filter));
  assert.equal(evidence.rendered,true,'filter '+filter+': '+evidence.reason);
 }
});

test('invalid image bytes and incompatible screenshots cannot yield visual PASS',()=>{
 const evidence=inspectAndroidScreenshot(Buffer.alloc(1000));
 assert.equal(evidence.rendered,false);
 const malformed=pngFixture('rendered');
 malformed[25]=3; // PNG indexed color instead of RGBA
 assert.equal(inspectAndroidScreenshot(malformed).rendered,false);
});

test('runner waits for two consecutive rendered frames, skipping startup and loading',async()=>{
 const black=pngFixture('black'),white=pngFixture('white'),rendered=pngFixture('rendered');
 const sequence=[black,white,rendered,rendered];
 let i=0;
 const logs=[];
 const result=await waitForRenderedScreenshot({
  capture:()=>sequence[i++],attempts:4,pause:async()=>{},
  log:s=>logs.push(s)
 });
 assert.equal(result.attempts,4);
 assert.equal(result.evidence.rendered,true);
 assert.deepEqual(result.png,rendered);
 assert.equal(logs.length,4);
});

test('runner fails closed if rendered content never stabilizes',async()=>{
 const frames=[pngFixture('black'),pngFixture('rendered'),pngFixture('black'),pngFixture('rendered')];
 let i=0;
 await assert.rejects(waitForRenderedScreenshot({
  capture:()=>frames[i++],attempts:4,pause:async()=>{}
 }),/visible BlueGuard UI was not confirmed/);
});

test('transient ADB capture errors retry, but all-black frames still time out',async()=>{
 const rendered=pngFixture('rendered');let calls=0;
 const accepted=await waitForRenderedScreenshot({
  capture:()=>{calls++;if(calls===1)throw new Error('ADB temporarily disconnected');return rendered;},
  attempts:4,pause:async()=>{}
 });
 assert.equal(accepted.attempts,3);
 await assert.rejects(waitForRenderedScreenshot({
  capture:()=>pngFixture('black'),attempts:2,pause:async()=>{}
 }),/timed out/);
});
