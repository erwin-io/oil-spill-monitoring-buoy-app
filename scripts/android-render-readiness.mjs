// Android screenshot readiness verification without optional image libraries.
// A valid PNG can be an entirely black startup frame while Capacitor/WebView
// is still painting. Sample decoded RGB pixels from inside the app viewport;
// status/navigation bars are excluded. This is visual smoke evidence only,
// not a claim that API data, pairing or all interactive controls are ready.
import {inflateSync} from 'node:zlib';
import {setTimeout as sleep} from 'node:timers/promises';
import {isPngScreenshot} from './android-launch.mjs';

const PNG_MAX_PIXELS=4096*8192;
const MAX_SCANLINE_BYTES=64*1024*1024;

export function inspectAndroidScreenshot(png) {
  const unknown=reason=>({
    rendered:false,visibleFraction:0,colorFraction:0,inkFraction:0,reason
  });
  if(!isPngScreenshot(png))return unknown('not a valid screenshot PNG');
  try {
    let cursor=8,width=0,height=0,depth=0,color=0,interlaced=0;
    const idats=[];
    while(cursor+12<=png.length) {
      const size=png.readUInt32BE(cursor);
      if(size>png.length-cursor-12) return unknown('truncated PNG chunk');
      const name=png.toString('ascii',cursor+4,cursor+8);
      const dataStart=cursor+8;
      if(name==='IHDR') {
        if(size!==13)return unknown('invalid PNG header');
        width=png.readUInt32BE(dataStart);
        height=png.readUInt32BE(dataStart+4);
        depth=png[dataStart+8];
        color=png[dataStart+9];
        interlaced=png[dataStart+12];
      } else if(name==='IDAT') {
        idats.push(png.subarray(dataStart,dataStart+size));
      } else if(name==='IEND') break;
      cursor+=size+12;
    }
    // Android screencap -p normally produces 8-bit RGB or RGBA.
    const channels=color===6?4:color===2?3:0;
    if(!width||!height||width*height>PNG_MAX_PIXELS||
       depth!==8||!channels||interlaced!==0||!idats.length)
      return unknown('unsupported PNG pixel format');
    const stride=width*channels;
    const expected=(stride+1)*height;
    if(expected>MAX_SCANLINE_BYTES)return unknown('screenshot too large');
    const bytes=inflateSync(Buffer.concat(idats),{maxOutputLength:expected+1});
    if(bytes.length!==expected)return unknown('invalid PNG pixel length');

    const previous=Buffer.alloc(stride);
    const current=Buffer.alloc(stride);
    let prev=previous,row=current,offset=0;
    const xStart=Math.floor(width*.08),xEnd=Math.ceil(width*.92);
    const yStart=Math.floor(height*.12),yEnd=Math.ceil(height*.88);
    const step=Math.max(1,Math.floor(Math.min(width,height)/100));
    let total=0,visible=0,colors=0,ink=0;
    for(let y=0;y<height;y++) {
      const filter=bytes[offset++];
      if(filter>4)return unknown('invalid PNG filter');
      for(let i=0;i<stride;i++) {
        const raw=bytes[offset++],left=i>=channels?row[i-channels]:0;
        const above=prev[i],upperLeft=i>=channels?prev[i-channels]:0;
        let predictor=0;
        if(filter===1)predictor=left;
        else if(filter===2)predictor=above;
        else if(filter===3)predictor=Math.floor((left+above)/2);
        else if(filter===4) {
          const p=left+above-upperLeft;
          const a=Math.abs(p-left),b=Math.abs(p-above),c=Math.abs(p-upperLeft);
          predictor=a<=b&&a<=c?left:b<=c?above:upperLeft;
        }
        row[i]=(raw+predictor)&255;
      }
      if(y>=yStart&&y<yEnd&&(y-yStart)%step===0) {
        for(let x=xStart;x<xEnd;x+=step) {
          const i=x*channels,r=row[i],g=row[i+1],b=row[i+2];
          // Most app surfaces are opaque; ignore transparent pixels.
          if(channels===4&&row[i+3]<128)continue;
          total++;
          const mean=(r+g+b)/3;
          if(mean>96)visible++;
          if(Math.max(r,g,b)-Math.min(r,g,b)>45&&Math.max(r,g,b)>105)colors++;
          if(mean<90)ink++;
        }
      }
      [prev,row]=[row,prev];
    }
    if(!total)return unknown('no screen pixels sampled');
    const visibleFraction=visible/total;
    const colorFraction=colors/total;
    const inkFraction=ink/total;
    // Reject blank black frames and a solid white loading page. BlueGuard
    // normally renders colored controls or text against a light surface.
    const rendered=visibleFraction>=.25 &&
      (colorFraction>=.002 || (visibleFraction>=.55&&inkFraction>=.006));
    return {
      rendered,width,height,visibleFraction,colorFraction,inkFraction,
      reason:rendered?'visible app content':'black, blank or unfinished screen'
    };
  } catch(error) {
    return unknown('unreadable PNG: '+error.message);
  }
}

export async function waitForRenderedScreenshot({
  capture,attempts=60,delayMs=2000,pause=sleep,log=()=>{}
}={}) {
  if(typeof capture!=='function'||!Number.isSafeInteger(attempts)||attempts<2)
    throw new TypeError('Screen capture function and at least two attempts are required');
  let consecutive=0,last=null;
  for(let attempt=1;attempt<=attempts;attempt++) {
    try{
      const png=await capture();
      last=inspectAndroidScreenshot(png);
      log('Android UI sample '+attempt+'/'+attempts+': '+
        Math.round(last.visibleFraction*100)+'% visible, '+
        Math.round(last.colorFraction*1000)/10+'% colored ('+last.reason+')');
      if(last.rendered) {
        consecutive++;
        if(consecutive>=2)return {png,evidence:last,attempts:attempt};
      } else consecutive=0;
    } catch(error) {
      consecutive=0;
      last={reason:'ADB screenshot failure: '+error.message};
      log('Android UI sample '+attempt+'/'+attempts+': '+last.reason);
    }
    if(attempt<attempts)await pause(delayMs);
  }
  throw new Error('Android activity opened but the visible BlueGuard UI was not confirmed: '+
    (last?.reason??'no screenshot')+'. Screenshot readiness timed out; inspect WebView/Logcat.');
}
