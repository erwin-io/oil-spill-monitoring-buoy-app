import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const file=path=>readFileSync('src/app/'+path,'utf8');
test('Pusher accepts private-user and private-device data.changed and preserves fallback',()=>{
 const src=file('core/realtime.service.ts');
 assert.match(src,/userChannel\.bind\('data\.changed',refresh\)/);
 assert.match(src,/'alert\.acknowledged','data\.changed'/);
 assert.match(src,/private-device-/);
 assert.match(src,/private-user-/);
 assert.match(src,/FALLBACK_POLL_MS = 60_000/);
});
test('Overview listens even when user has no buoys yet',()=>{
 const src=file('pages/dashboard.page.ts');
 assert.match(src,/this\.realtime\.connect\(d\.items\.map\(v=>v\.id\)/);
 assert.doesNotMatch(src,/if\(d\.items\.length\)\{[^}]*this\.realtime\.connect/);
});
test('Buoys and notifications subscribe only while active and handle user-scoped refresh',()=>{
 for(const page of ['devices.page.ts','alerts.page.ts']){
  const src=file('pages/'+page);
  assert.match(src,/this\.active=true/);
  assert.match(src,/this\.realtime\.connect/);
  assert.match(src,/this\.active&&!this\.loading/);
  assert.match(src,/this\.realtime\.disconnect\(\)/);
  assert.match(src,/ionViewWillLeave\(\)/);
 }
});
