export interface ProtectedQr {deviceId:string;claimCode:string}
export function parseProtectedQr(text:string):ProtectedQr{
 let value:unknown;
 try{value=JSON.parse(text)}catch{throw new Error('This is not a BlueGuard protected device QR code.')}
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('This is not a BlueGuard protected device QR code.');
 const qr=value as Record<string,unknown>;
 if(Object.keys(qr).sort().join('|')!=='claimCode|deviceId|v'||qr['v']!==1||typeof qr['deviceId']!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(qr['deviceId'])||
   typeof qr['claimCode']!=='string'||!/^[A-Za-z0-9_-]{32,128}$/.test(qr['claimCode']))throw new Error('This protected QR code is invalid or unsupported.');
 return {deviceId:qr['deviceId'],claimCode:qr['claimCode']};
}
