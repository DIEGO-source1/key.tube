// Distributed as actualizar-keytube/instalar.mjs. No packages or network required.
import {readFileSync,writeFileSync,existsSync,mkdirSync,cpSync,copyFileSync,unlinkSync,lstatSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
const updateDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(updateDir,'..');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function safePath(base,name){
  if(typeof name!=='string'||name.includes('\\')||name.startsWith('/')||name.split('/').some(p=>!p||p==='.'||p==='..'))throw new Error('Ruta de actualización inválida.');
  const target=path.resolve(base,...name.split('/'));
  if(!target.startsWith(base+path.sep))throw new Error('Ruta fuera del proyecto.');
  let current=base;
  for(const part of name.split('/')){current=path.join(current,part);if(existsSync(current)&&lstatSync(current).isSymbolicLink())throw new Error('No se actualizan rutas enlazadas: '+name);}
  return target;
}
try {
  const project=JSON.parse(readFileSync(path.join(root,'package.json'),'utf8'));
  if(project.name!=='keytube'||!existsSync(path.join(root,'app/keytube-v2.tsx')))throw new Error('Coloca la carpeta actualizar-keytube dentro de tu carpeta keytube actual, junto a package.json.');
  if(!existsSync(path.join(root,'node_modules/wrangler/bin/wrangler.js')))throw new Error('Esta carpeta no tiene las dependencias instaladas. Copia actualizar-keytube dentro de la carpeta KeyTube-cuentas-y-planes/keytube que ya funciona.');
  const manifest=JSON.parse(readFileSync(path.join(updateDir,'manifest.json'),'utf8'));
  if(manifest.format!==1||!Array.isArray(manifest.files)||!Array.isArray(manifest.remove))throw new Error('Manifiesto de actualización inválido.');
  const allowed=name=>name==='README.md'||/^(app|components|lib|drizzle|db|scripts|public|tests)\//.test(name);
  const entries=[];
  for(const item of manifest.files){
    if(!allowed(item.path))throw new Error('Archivo no permitido: '+item.path);
    const source=safePath(path.join(updateDir,'files'),item.path),target=safePath(root,item.path);
    const bytes=readFileSync(source);
    if(digest(bytes)!==item.sha256)throw new Error('El archivo está incompleto: '+item.path+'. Extrae de nuevo el ZIP.');
    entries.push({path:item.path,target,bytes});
  }
  for(const name of manifest.remove){if(!allowed(name))throw new Error('Ruta no permitida.');safePath(root,name);}
  const backup=path.join(root,'respaldo-keytube-'+new Date().toISOString().replace(/[:.]/g,'-'));
  mkdirSync(backup,{recursive:true});
  console.log('[1/3] Guardando respaldo de tus archivos y de la base local…');
  const oldFiles=[];
  for(const name of new Set([...entries.map(x=>x.path),...manifest.remove])){
    const source=safePath(root,name);
    if(existsSync(source)){const target=safePath(backup,name);mkdirSync(path.dirname(target),{recursive:true});copyFileSync(source,target);oldFiles.push(name);}
  }
  const localDB=path.join(root,'.wrangler/state/v3/d1');
  if(existsSync(localDB))cpSync(localDB,path.join(backup,'base-local-d1'),{recursive:true});
  writeFileSync(path.join(backup,'respaldo.json'),JSON.stringify({files:oldFiles,newFiles:entries.filter(e=>!oldFiles.includes(e.path)).map(e=>e.path)},null,2));
  console.log('[2/3] Actualizando KeyTube y sus nuevas funciones…');
  for(const entry of entries){mkdirSync(path.dirname(entry.target),{recursive:true});writeFileSync(entry.target,entry.bytes);}
  for(const name of manifest.remove){const target=safePath(root,name);if(existsSync(target))unlinkSync(target);}
  console.log('[3/3] Actualización aplicada. Las dependencias y los archivos subidos se conservan.');
  console.log('Respaldo: '+backup);
  console.log('Ahora ejecuta pnpm.cmd db:setup (confirma con Y) y después pnpm.cmd dev.');
}catch(error){
  console.error('No se completó la actualización: '+error.message);
  console.error('Conserva la carpeta de respaldo si se creó. No borres tu base de datos ni node_modules.');
  process.exitCode=1;
}
