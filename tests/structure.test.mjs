import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('Ionic CLI recognizes the Angular project',()=>{const ionic=JSON.parse(read('ionic.config.json')),angular=JSON.parse(read('angular.json'));assert.equal(ionic.type,'angular');assert.ok(angular.projects.app.architect.serve);assert.equal(angular.projects.app.architect.serve.configurations.development.buildTarget,'app:build:development')});
test('no legacy monolithic app.ts',()=>assert.equal(existsSync('src/app/app.ts'),false));
test('all checklist pages have dedicated TS and HTML',()=>{for(const p of ['login','register','verify','forgot','tabs','dashboard','devices','device-detail','history','trends','alerts','alert-detail','health','config','profile']){assert.ok(existsSync(`src/app/pages/${p}.page.ts`));assert.ok(existsSync(`src/app/pages/${p}.page.html`))}});
test('no private server credentials in mobile environment',()=>{const s=read('src/environments/environment.ts')+read('src/environments/environment.prod.ts');for(const name of ['FIREBASE_PRIVATE_KEY','PUSHER_SECRET','DEVICE_KEY_PEPPER'])assert.ok(!s.includes(name))});
