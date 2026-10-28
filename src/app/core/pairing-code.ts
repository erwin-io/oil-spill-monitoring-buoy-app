/** QR v2 is a public identifier, never an authorization credential. */
export interface DeviceQr {deviceId:string}
export function parseDeviceQr(text:string):DeviceQr{
 let value:unknown;
 try{value=JSON.parse(text)}catch{throw new Error('This is not a BlueGuard device QR code.')}
 if(!value||typeof value!=='object'||Array.isArray(value))
  throw new Error('This is not a BlueGuard device QR code.');
 const qr=value as Record<string,unknown>;
 if(Object.keys(qr).sort().join('|')!=='deviceId|v'||qr['v']!==2||
   typeof qr['deviceId']!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(qr['deviceId']))
  throw new Error('This QR code is invalid or unsupported. Scan a BlueGuard version 2 Device ID QR.');
 return {deviceId:qr['deviceId']};
}
