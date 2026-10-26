// A notification payload can be modified by its sender.
// Only accept bounded route identifiers; API pages enforce user authorization.
const id=/^[A-Za-z0-9_-]{1,120}$/;
export function notificationDestination(data:unknown):string[]{
 if(!data||typeof data!=='object')return ['/tabs/alerts'];
 const entry=data as Record<string,unknown>;
 const alertId=entry['alertId'],deviceId=entry['deviceId'];
 if(typeof alertId==='string'&&id.test(alertId))return ['/tabs/alerts',alertId];
 if(typeof deviceId==='string'&&id.test(deviceId))return ['/tabs/buoys',deviceId];
 return ['/tabs/alerts'];
}
