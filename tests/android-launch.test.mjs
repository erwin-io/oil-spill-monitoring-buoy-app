import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  activityLaunchAccepted,isAndroidPidRunning,isAndroidActivityForeground,
  isPngScreenshot,waitForAndroidForeground
} from '../scripts/android-launch.mjs';

const packageId='com.oilspillmonitoringbuoy.app';
const activity=packageId+'/.MainActivity';
const samsungLog=[
  'Starting: Intent { cmp='+activity+' }',
  'Warning: Activity not started, intent has been delivered to currently running top-most instance.',
  'Status: ok',
  'LaunchState: UNKNOWN (0)',
  'Activity: '+activity,
  'TotalTime: 0',
  'WaitTime: 15',
  'Complete'
].join('\n');
const samsungForeground='    topResumedActivity=ActivityRecord{128072146 u0 '+activity+' t10575}';

test('Samsung am start -W output accepts already-running MainActivity',()=>{
  assert.equal(activityLaunchAccepted(samsungLog,activity),true);
  assert.equal(activityLaunchAccepted('Status: error\nActivity: '+activity,activity),false);
  assert.equal(activityLaunchAccepted('Status: ok\nActivity: other.package/.MainActivity',activity),false);
  assert.equal(activityLaunchAccepted('Events injected: 1\n## Network stats: elapsed time=17ms',activity),false);
});

test('foreground parser recognizes resumed Samsung activity, not a background or foreign app',()=>{
  assert.equal(isAndroidActivityForeground(samsungForeground,activity),true);
  assert.equal(isAndroidActivityForeground('mResumedActivity: ActivityRecord{u0 '+activity+'}',activity),true);
  assert.equal(isAndroidActivityForeground('ActivityRecord{u0 '+activity+'}',activity),false);
  assert.equal(isAndroidActivityForeground('topResumedActivity=ActivityRecord{u0 other.package/.MainActivity}',activity),false);
  assert.equal(isAndroidPidRunning('30504\r\n'),true);
  assert.equal(isAndroidPidRunning('30504 30505'),true);
  assert.equal(isAndroidPidRunning(''),false);
  assert.equal(isAndroidPidRunning('pid not found'),false);
});

test('foreground verification waits for selected device to become ready',async()=>{
  const calls=[];
  let polls=0;
  const result=await waitForAndroidForeground({
    serial:'R94XB050TZX',packageId,activity,
    execute:args=>{
      calls.push(args);
      assert.equal(args[1],'R94XB050TZX');
      if(args.includes('pidof')){polls++;return '30504\n';}
      if(polls===1)return 'topResumedActivity=ActivityRecord{u0 other.package/.MainActivity}';
      return samsungForeground;
    },
    pause:async()=>{}
  });
  assert.deepEqual(result,{pid:'30504',foreground:true,attempts:2});
  assert.equal(calls.filter(x=>x.includes('pidof')).length,2);
  assert.equal(calls.filter(x=>x.includes('dumpsys')).length,2);
});

test('foreground verification tolerates transient ADB failures without false PASS',async()=>{
  let tries=0;
  const result=await waitForAndroidForeground({
    serial:'emulator-5554',packageId,activity,attempts:3,
    execute:args=>{
      if(args.includes('pidof')){tries++;if(tries===1)throw new Error('temporarily offline');return '322';}
      return 'topResumedActivity=ActivityRecord{u0 different.package/.MainActivity}';
    },
    pause:async()=>{}
  });
  assert.deepEqual(result,{pid:'322',foreground:false,attempts:3});
  assert.equal(tries,3);
});

test('foreground verification rejects missing device selection and mismatched package',async()=>{
  await assert.rejects(waitForAndroidForeground({
    serial:'',packageId,execute:()=>'',pause:async()=>{}
  }),/explicit Android serial/);
  await assert.rejects(waitForAndroidForeground({
    serial:'emulator-5554',packageId,activity:'other/.MainActivity',
    execute:()=>'',pause:async()=>{}
  }),/explicit Android serial/);
});

test('only actual PNG screenshot bytes count as screenshot evidence',()=>{
  const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(1024)]);
  assert.equal(isPngScreenshot(png),true);
  assert.equal(isPngScreenshot(Buffer.alloc(1024)),false);
  assert.equal(isPngScreenshot(Buffer.from('PNG')),false);
});
