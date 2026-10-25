import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseFallbackAction,buildBlueGuardIntent,BLUEGUARD_HOST,BLUEGUARD_PACKAGE,FIREBASE_PUBLIC_API_KEY} from '../hosting/public/firebase-native-open-core.mjs';
const base = 'https://' + BLUEGUARD_HOST + '/open/auth-action';
const url = (mode='verifyEmail', code='DUMMY_CODE_123') => base + '?mode=' + mode + '&oobCode=' + code + '&apiKey=' + FIREBASE_PUBLIC_API_KEY;

test('P2-15 fallback accepts only exact Firebase action HTTPS host, mode, code, and project key',()=>{
  assert.deepEqual(parseFallbackAction(url()),{mode:'verifyEmail',code:'DUMMY_CODE_123'});
  assert.deepEqual(parseFallbackAction(url('resetPassword')),{mode:'resetPassword',code:'DUMMY_CODE_123'});
  const invalid = [
    url().replace('https:', 'http:'),
    url().replace(BLUEGUARD_HOST,'untrusted.example'),
    url().replace('/open/auth-action','/open/invite'),
    url().replace(FIREBASE_PUBLIC_API_KEY,'WRONG_API_KEY'),
    url('recoverEmail'),
    url('resetPassword','bad;code'),
    url('verifyEmail','A'.repeat(2049)),
    url()+'&mode=resetPassword',
    url()+'&oobCode=EXTRA',
    url()+'&apiKey=OTHER',
    url()+'&continueUrl=https://evil.invalid',
    url()+'#fragment',
    url().replace('https://','https://user:password@'),
    base,
    '',
    'x'.repeat(4097),
  ];
  for (const attempt of invalid) assert.equal(parseFallbackAction(attempt),null,attempt.slice(0,120));
});

test('P2-15 fallback intent targets installed BlueGuard package and retains exactly Firebase code',()=>{
  for (const mode of ['verifyEmail','resetPassword']) {
    const action=parseFallbackAction(url(mode));
    const intent=buildBlueGuardIntent(action);
    assert.ok(intent.startsWith('intent://' + BLUEGUARD_HOST + '/open/auth-action?mode=' + mode + '&oobCode=DUMMY_CODE_123&apiKey='));
    assert.ok(intent.endsWith('#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=' + BLUEGUARD_PACKAGE + ';end'));
    assert.ok(!intent.includes('browser_fallback_url'));
    assert.ok(!intent.includes('evil.invalid'));
  }
  assert.throws(()=>buildBlueGuardIntent({mode:'resetPassword',code:'BAD;code'}));
  assert.throws(()=>buildBlueGuardIntent({mode:'recoverEmail',code:'VALID'}));
});

test('P2-15 Hosting fallback clears browser URL and launches only after deliberate tap',()=>{
  const html=readFileSync('hosting/public/index.html','utf8');
  assert.match(html,/meta name="referrer" content="no-referrer"/);
  assert.match(html,/id="open-blueguard" type="button" hidden/);
  assert.match(html,/window\.history\.replaceState\(null, '', '\/open\/auth-action'\)/);
  assert.match(html,/button\.addEventListener\('click',/);
  assert.match(html,/window\.location\.href = buildBlueGuardIntent\(action\)/);
  assert.doesNotMatch(html,/setTimeout|setInterval|localStorage|sessionStorage|console\.log/);
});
