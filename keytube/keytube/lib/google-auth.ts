import { googleConfig } from './auth';
const decode = (value:string) => Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')), c=>c.charCodeAt(0));
let cachedKeys: {keys:JsonWebKey[];until:number}|null=null;
export async function googleIdentity(token:string,nonce:string) {
  const parts=token.split('.');
  if(parts.length!==3)throw new Error('Respuesta de Google inválida.');
  const header=JSON.parse(new TextDecoder().decode(decode(parts[0])));
  const payload=JSON.parse(new TextDecoder().decode(decode(parts[1])));
  if(header.alg!=='RS256'||typeof header.kid!=='string')throw new Error('Firma de Google inválida.');
  if(!cachedKeys||cachedKeys.until<Date.now()||!cachedKeys.keys.some(k=>(k as JsonWebKey&{kid:string}).kid===header.kid)) {
    const r=await fetch('https://www.googleapis.com/oauth2/v3/certs',{signal:AbortSignal.timeout(10000),redirect:'error'});
    if(!r.ok)throw new Error('No se pudo verificar Google.');
    const body=await r.json() as {keys:JsonWebKey[]};
    cachedKeys={keys:body.keys,until:Date.now()+300000};
  }
  const jwk=cachedKeys.keys.find(k=>(k as JsonWebKey&{kid:string}).kid===header.kid);
  if(!jwk)throw new Error('Firma de Google desconocida.');
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const signature=decode(parts[2]);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,signature,new TextEncoder().encode(parts[0]+'.'+parts[1])))throw new Error('Firma de Google inválida.');
  const now=Math.floor(Date.now()/1000),g=googleConfig();
  if(!['accounts.google.com','https://accounts.google.com'].includes(payload.iss)||payload.aud!==g.clientId||payload.azp&&payload.azp!==g.clientId||typeof payload.exp!=='number'||payload.exp<=now||typeof payload.iat!=='number'||payload.iat>now+60||payload.nonce!==nonce||payload.email_verified!==true||typeof payload.sub!=='string'||typeof payload.email!=='string')throw new Error('La identidad de Google no es válida para KeyTube.');
  return {sub:payload.sub as string,email:(payload.email as string).toLowerCase(),name:String(payload.name||payload.email).slice(0,65)};
}
