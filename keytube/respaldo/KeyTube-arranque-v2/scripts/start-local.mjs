// Serve the compiled application without file watchers or automatic reloads.
import { existsSync, readdirSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { projectRoot } from './sites-env.mjs';

// Keep the CLI alive independently of platform-specific workerd handles. A
// pending Promise or signal listener alone does not keep Node's event loop alive.
export function monitorLocalServer(url,{signal,intervalMs=5000,timeoutMs=5000}={}) {
  let timer,checking=false,failures=0,finished=false;
  const controller=new AbortController();
  let resolveDone,rejectDone;
  const done=new Promise((resolve,reject)=>{resolveDone=resolve;rejectDone=reject;});
  const finish=(error)=>{
    if(finished)return;
    finished=true;clearInterval(timer);controller.abort();
    signal?.removeEventListener('abort',stop);
    if(error)rejectDone(error);else resolveDone();
  };
  const stop=()=>finish();
  const probe=async()=>{
    const response=await fetch(new URL('/favicon.svg',url),{
      signal:AbortSignal.any([controller.signal,AbortSignal.timeout(timeoutMs)]),
      redirect:'error',cache:'no-store',
    });
    await response.arrayBuffer();
    if(response.status!==200)throw new Error(`HTTP ${response.status}`);
  };
  signal?.addEventListener('abort',stop,{once:true});
  if(signal?.aborted)stop();
  // Explicitly referenced: the process must not silently return to PowerShell.
  timer=setInterval(async()=>{
    if(checking||finished)return;
    checking=true;
    try{await probe();failures=0;}
    catch(error){
      if(!finished&&++failures>=2)finish(new Error(
        `El servidor local dejó de responder (${error.cause?.code||error.message}).`,{cause:error}));
    }finally{checking=false;}
  },intervalMs);
  timer.ref();
  if(finished)clearInterval(timer);
  const ready=finished?Promise.resolve():probe().catch(error=>{
    stop();throw new Error(`No se pudo comprobar la conexión local (${error.cause?.code||error.message}).`,{cause:error});
  });
  return {ready,done,stop};
}

export async function startLocal({port=5173,persistTo=path.join(projectRoot,'.wrangler/state')}={}) {
  const config=path.join(projectRoot,'dist/server/wrangler.json');
  if(!existsSync(config))throw new Error('Primero ejecuta pnpm.cmd build en la carpeta keytube.');
  const require=createRequire(realpathSync(path.join(projectRoot,'node_modules/wrangler/package.json')));
  const {unstable_getMiniflareWorkerOptions}=require('wrangler');
  const {Miniflare}=require('miniflare');
  const {workerOptions,main,externalWorkers}=unstable_getMiniflareWorkerOptions(config);
  if(externalWorkers.length)throw new Error('Este arranque local requiere una configuración sin servicios externos.');
  const directory=path.dirname(main);
  const paths=readdirSync(directory,{recursive:true}).filter(p=>/\.m?js$/.test(p)&&path.join(directory,p)!==main);
  // Preserve Wrangler's binding IDs and v3 persistence layout exactly.
  // Explicit modules support the compiled application's dynamic imports.
  const runtime=new Miniflare({...workerOptions,host:'127.0.0.1',port,cf:false,
    modulesRoot:directory,
    modules:[main,...paths.map(p=>path.join(directory,p))].map(p=>({type:'ESModule',path:p})),
    defaultPersistRoot:persistTo===false?undefined:path.join(persistTo,'v3'),
    ...(persistTo===false?{d1Persist:false,r2Persist:false,cachePersist:false,kvPersist:false,durableObjectsPersist:false}:{})
  });
  try{await runtime.ready;return runtime;}catch(error){await runtime.dispose();throw error;}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  let runtime,monitor;
  const shutdown=new AbortController();
  const stop=()=>shutdown.abort();
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  try {
    const args=process.argv.slice(2);
    if(args.length&&!(args.length===2&&args[0]==='--port'))throw new Error('Uso: node scripts/start-local.mjs [--port 5173]');
    const port=Number(args[1]||5173);
    if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Puerto inválido.');
    runtime=await startLocal({port});
    monitor=monitorLocalServer(await runtime.ready,{signal:shutdown.signal});
    await monitor.ready;
    console.log(`\nKeyTube listo: http://127.0.0.1:${port}\nConexión HTTP comprobada. Arranque estable v2.\nDeja esta ventana abierta. Para detenerlo, pulsa Ctrl+C.\n`);
    await monitor.done;
  }catch(error){console.error('KeyTube no está disponible:',error.message);process.exitCode=1;}
  finally{
    monitor?.stop();
    process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);
    if(runtime)await runtime.dispose();
  }
}
