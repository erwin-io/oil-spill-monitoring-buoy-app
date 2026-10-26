import {Injectable} from '@angular/core';
import {Capacitor,registerPlugin} from '@capacitor/core';

interface NativeAuthStatusBar {
 setBusy(options:{busy:boolean}):Promise<void>;
}
const nativeBar=registerPlugin<NativeAuthStatusBar>('BlueGuardStatusBar');

/** A white full-screen progress page must have a matching Android status bar,
 * with dark system icons. Restore primary blue when it closes. */
@Injectable({providedIn:'root'})
export class AuthStatusBarService {
 async setBusy(busy:boolean):Promise<void>{
  if(!Capacitor.isNativePlatform())return;
  try{await nativeBar.setBusy({busy})}catch{
   // Never block authentication if a web-only or stale native build lacks this plugin.
  }
 }
}
