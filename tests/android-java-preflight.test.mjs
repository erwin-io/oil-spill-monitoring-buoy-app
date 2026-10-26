import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {delimiter,join} from 'node:path';
import assert from 'node:assert/strict';
import {candidateJdks,chooseJdk21,gradleUsesJava21,isJava21Version,useJava21,gradleVersionForJavaCheck} from '../scripts/android-java-preflight.mjs';

test('Java 21 version recognition does not confuse JDK 17 or 210',()=>{
 assert.equal(isJava21Version('javac 21.0.6'),true);
 assert.equal(isJava21Version('javac 17.0.10'),false);
 assert.equal(isJava21Version('javac 210.0.1'),false);
});

test('JDK selector ignores JAVA_HOME 17 and selects verified 21 candidate',()=>{
 const choices=['C:/Program Files/Java/jdk-17','C:/Program Files/Java/jdk-21'];
 const result=chooseJdk21({}, {candidates:choices,validate:dir=>dir.endsWith('jdk-21')});
 assert.equal(result,choices[1]);
});

test('candidate generator includes known Java 21 folders',()=>{
 const choices=candidateJdks({JAVA_HOME:'C:/jdk-17',ProgramFiles:'C:/Program Files'},
  {windows:true,listChildren:p=>p.endsWith('Java')?['jdk-17','jdk-21','jdk-21.0.6']:[]});
 assert.ok(choices.some(x=>x.endsWith('jdk-21')));
 assert.ok(choices.some(x=>x.endsWith('jdk-21.0.6')));
});

test('Java preflight modifies only process-supplied environment',()=>{
 const env={JAVA_HOME:'/jdk-17',PATH:'/usr/local/bin'};
 const jdk=useJava21(env,{candidates:['/jdk-17','/jdk-21'],validate:p=>p==='/jdk-21'});
 assert.equal(jdk,'/jdk-21');
 assert.equal(env.JAVA_HOME,'/jdk-21');
 assert.equal(env.PATH.split(delimiter)[0],join('/jdk-21','bin'));
});

test('Gradle requires launcher Java 21 and rejects JDK-17 daemon overrides',()=>{
 assert.equal(gradleUsesJava21('Gradle 8.11.1\nLauncher JVM: 21.0.6\nDaemon JVM: C:\\Program Files\\Java\\jdk-21'),true);
 assert.equal(gradleUsesJava21('Launcher JVM: 17.0.10\nDaemon JVM: C:\\Program Files\\Java\\jdk-17'),false);
 assert.equal(gradleUsesJava21('Launcher JVM: 21.0.6\nDaemon JVM: C:\\Program Files\\Java\\jdk-17'),false);
});

test('Gradle diagnostic aborts before APK compilation when JVM mismatch remains',()=>{
 assert.throws(()=>gradleVersionForJavaCheck({androidDir:'/repo/android',env:{JAVA_HOME:'/jdk21'},invoke:()=>({status:0,stdout:'Launcher JVM: 17.0.10\nDaemon JVM: JDK-17'})}),/Gradle still does not use Java 21/);
 assert.match(gradleVersionForJavaCheck({androidDir:'/repo/android',env:{JAVA_HOME:'/jdk21'},invoke:()=>({status:0,stdout:'Launcher JVM: 21.0.6\nDaemon JVM: JDK-21'})}),/21\.0\.6/);
});

test('verify:android preflights Java 21 before npm or Gradle builds while verify:local remains unchanged',()=>{
 const runner=readFileSync('scripts/verify-local.mjs','utf8');
 assert.ok(runner.indexOf("if(flags.has('--android')&&!dryRun)")>=0);
 assert.ok(runner.indexOf("useJava21(process.env)")<runner.indexOf("run('Locked dependencies'"));
 assert.ok(runner.indexOf('gradleVersionForJavaCheck')<runner.indexOf("run('Locked dependencies'"));
});
