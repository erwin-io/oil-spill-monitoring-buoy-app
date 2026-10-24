/** Safe, actionable network/session status text for monitoring pages. */
export function uiError(value:unknown):string{
 const error=value as {status?:number;message?:string;error?:{error?:{message?:string}}}|null;
 const status=error?.status;
 if(status===0)return 'Network unavailable. Check Wi-Fi or mobile data and retry.';
 if(status===401)return 'Your session has expired. Sign in again and retry.';
 if(status===403)return 'This account is not authorized to access the requested buoy or action.';
 if(status===404)return 'No data was found for this buoy yet.';
 if(status===429)return 'Too many requests. Please retry after a short delay.';
 if(typeof status==='number'&&status>=500)return 'Monitoring service is unavailable. Your last loaded data may be stale.';
 return error?.error?.error?.message||error?.message||'Unable to load monitoring data. Please retry.';
}
