import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=path=>readFileSync(resolve(root,path),'utf8');

test('mobile one-command launcher delegates all tests to the API sibling without cloud changes',()=>{
 assert.equal(existsSync(resolve(root,'test-blueguard.cmd')),true);
 assert.equal(existsSync(resolve(root,'test-blueguard.ps1')),true);
 const batch=read('test-blueguard.cmd'),ps=read('test-blueguard.ps1');
 const pkg=JSON.parse(read('package.json'));
 assert.match(batch,/-File "%~dp0test-blueguard\.ps1" %\*/i);
 assert.match(batch,/exit \/b %errorlevel%/i);
 assert.match(ps,/oil-spill-monitoring-buoy-api/);
 assert.match(ps,/test-blueguard\.ps1/);
 assert.match(ps,/& \$sharedRunner @PSBoundParameters/);
 assert.match(pkg.scripts['verify:all'],/test-blueguard\.ps1/);
 assert.doesNotMatch(ps,/git\s+(reset|clean|push|pull)/i);
});

test('mobile Windows PowerShell launcher parses without syntax errors',()=>{
 if(process.platform!=='win32')return;
 const path=resolve(root,'test-blueguard.ps1').replaceAll("'","''");
 const shell=[
  '$tokens=$null;$errors=$null;',
  '[System.Management.Automation.Language.Parser]::ParseFile(\''+path+'\',[ref]$tokens,[ref]$errors)|Out-Null;',
  'if($errors.Count){$errors|ForEach-Object{Write-Error $_.Message};exit 1}'
 ].join('');
 const r=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',shell],{
  cwd:root,encoding:'utf8',timeout:30000
 });
 assert.equal(r.status,0,r.stderr||r.stdout||r.error?.message);
});
