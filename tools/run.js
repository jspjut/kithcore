import {spawn} from 'node:child_process';
import {rm} from 'node:fs/promises';
import path from 'node:path';
import {ROOT,prepareRuntime,selectedWorld} from './worlds.js';

let runtime;
try {
  runtime = await prepareRuntime(selectedWorld());
  const data = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data', runtime.manifest.id));
  console.log(`${runtime.manifest.name} ${runtime.manifest.version} · content ${runtime.contentHash.slice(0,12)}`);
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: runtime.directory, stdio: 'inherit',
    env: {...process.env, DATA_DIR:data}
  });
  const signals = ['SIGINT','SIGTERM'];
  const forward = signal => child.kill(signal);
  const listeners = signals.map(signal => {const fn=()=>forward(signal);process.on(signal,fn);return fn;});
  child.on('error', error => console.error(error.message));
  const code = await new Promise(resolve => {
    child.once('exit', (code,signal) => resolve(code ?? (signal==='SIGINT'?130:143)));
    child.once('error', () => resolve(1));
  });
  signals.forEach((signal,index)=>process.off(signal,listeners[index]));
  await rm(runtime.directory, {recursive:true,force:true});
  process.exitCode = code;
} catch (error) {
  if (runtime) await rm(runtime.directory, {recursive:true,force:true});
  console.error(error.message);
  process.exitCode = 1;
}
