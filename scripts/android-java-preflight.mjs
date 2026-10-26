// Keep JDK selection process-local: never modify the operator's system
// settings, Android keystore, Gradle user properties or installed APK.
import {existsSync,readdirSync} from 'node:fs';
import {delimiter,join} from 'node:path';
import {spawnSync} from 'node:child_process';

export function isJava21Version(output) {
  return /\b(?:javac\s+|java\s+version\s+["']?)(21)(?:[.\s"']|$)/i.test(String(output));
}

export function gradleUsesJava21(output) {
  const text=String(output);
  const launcher=text.match(/^\s*Launcher JVM:\s*(\d+)(?:\.|\s|$)/m);
  const legacy=text.match(/^\s*JVM:\s*(\d+)(?:\.|\s|$)/m);
  const daemon=text.match(/^\s*Daemon JVM:\s*(.+)$/m);
  const major=Number(launcher?.[1]??legacy?.[1]);
  // Gradle's daemon can be overridden by user-level gradle.properties.
  // A detected JDK-17 path is a hard error, even if the launcher is 21.
  const daemonJava17=/(?:jdk[-_]?17|java[\\/]jdk[-_]?17)(?:[\\/\s.\-]|$)/i.test(daemon?.[1]??'');
  return major===21 && !daemonJava17;
}

export function candidateJdks(env=process.env,{windows=process.platform==='win32',listChildren}={}) {
  const enumerate=listChildren??((dir)=>{
    if(!existsSync(dir))return [];
    return readdirSync(dir,{withFileTypes:true})
      .filter(item=>item.isDirectory()).map(item=>item.name);
  });
  const roots=[
    env['ProgramFiles'],env['PROGRAMFILES'],
    windows?'C:\\Program Files':undefined
  ].filter(Boolean);
  const parents=[...roots.flatMap(root=>[join(root,'Java'),join(root,'Eclipse Adoptium'),join(root,'Microsoft')])];
  const direct=[env.JAVA_HOME,env.JDK21_HOME,env.JAVA21_HOME,env.GRADLE_JAVA_HOME].filter(Boolean);
  for(const parent of parents){
    let children=[];
    try{children=enumerate(parent);}catch{};
    for(const child of children){
      if(/^jdk[-_]?21(?:[.\-_+]|$)/i.test(child)) direct.push(join(parent,child));
    }
  }
  const seen=new Set();
  return direct.filter(p=>{
    const key=windows?p.toLowerCase():p;
    if(seen.has(key))return false;
    seen.add(key);return true;
  });
}

export function chooseJdk21(env=process.env,{
  candidates=candidateJdks(env),validate=validJdk21
}={}) {
  for(const dir of candidates) {
    if(typeof dir==='string'&&validate(dir))return dir;
  }
  return null;
}

export function validJdk21(dir) {
  const javac=join(dir,'bin',process.platform==='win32'?'javac.exe':'javac');
  if(!existsSync(javac))return false;
  const res=spawnSync(javac,['-version'],{encoding:'utf8',timeout:10000,windowsHide:true});
  return !res.error&&res.status===0&&isJava21Version((res.stdout??'')+' '+(res.stderr??''));
}

export function useJava21(env=process.env,options={}) {
  const selected=chooseJdk21(env,options);
  if(!selected)throw new Error(
    'JDK 21 not found or javac -version is not 21. On Windows, install JDK 21 '+
    'or set JAVA_HOME to C:\\Program Files\\Java\\jdk-21 in this same PowerShell terminal.');
  env.JAVA_HOME=selected;
  const pathKey=Object.keys(env).find(k=>k.toUpperCase()==='PATH')??'PATH';
  env[pathKey]=join(selected,'bin')+(env[pathKey]?delimiter+env[pathKey]:'');
  return selected;
}

export function gradleVersionForJavaCheck({androidDir,env=process.env,win=process.platform==='win32',invoke}={}) {
  const run=invoke??(()=>spawnSync(win?'gradlew.bat':'./gradlew',['--version'],{
    cwd:androidDir,env,encoding:'utf8',shell:win,timeout:60000,windowsHide:true
  }));
  const result=run();
  if(result.error||result.status!==0)throw new Error('Unable to check Gradle JVM: '+
    (result.error?.message??result.stderr?.slice(0,500)??'exit '+result.status));
  const versionText=(result.stdout??'')+'\n'+(result.stderr??'');
  if(!gradleUsesJava21(versionText))throw new Error(
    'Gradle still does not use Java 21. JAVA_HOME='+env.JAVA_HOME+'\n'+
    versionText.split('\n').filter(s=>/^(Launcher JVM:|Daemon JVM:|JVM:)/.test(s.trim())).join('\n')+'\n'+
    'Inspect android/gradle.properties and %USERPROFILE%\\.gradle\\gradle.properties '+
    'for org.gradle.java.home or Java toolchain overrides.');
  return versionText;
}
