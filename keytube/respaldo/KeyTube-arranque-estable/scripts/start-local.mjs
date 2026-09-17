// Serve the compiled application without file watchers or automatic reloads.
import { existsSync, readdirSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { projectRoot } from './sites-env.mjs';

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
  let runtime;
  try {
    const args=process.argv.slice(2);
    if(args.length&&!(args.length===2&&args[0]==='--port'))throw new Error('Uso: node scripts/start-local.mjs [--port 5173]');
    const port=Number(args[1]||5173);
    if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Puerto inválido.');
    runtime=await startLocal({port});
    let stopping=false;
    const stop=async()=>{if(stopping)return;stopping=true;await runtime.dispose();};
    process.once('SIGINT',stop);process.once('SIGTERM',stop);
    console.log(`\nKeyTube listo: http://127.0.0.1:${port}\nArranque estable, sin reinicios automáticos.\nDeja esta ventana abierta. Para detenerlo, pulsa Ctrl+C.\n`);
  }catch(error){console.error('No se pudo iniciar KeyTube:',error.message);if(runtime)await runtime.dispose();process.exitCode=1;}
}
