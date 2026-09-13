import { authDB,authRateLimit,googleConfig,randomToken,digest,cookieValue,createSession,getAppUser,type UserRow } from '@/lib/auth';
import { googleIdentity } from '@/lib/google-auth';
import { AppError,failure } from '@/lib/keytube-server';
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:Promise<{step:string}>}) {
  const g=googleConfig(),url=new URL(req.url);
  const errorRedirect=(code:string)=>Response.redirect(new URL('/?authError='+code,url.origin),303);
  try {
    if(!g.clientId||!g.secret||!g.origin)return errorRedirect('google_unavailable');
    const origin=new URL(g.origin).origin;
    if(origin!==url.origin)throw new AppError(400,'El origen de Google no coincide con el sitio.');
    const redirectUri=origin+'/api/auth/google/callback';
    const {step}=await params;
    if(step==='start') {
      await authRateLimit(req);
      const linking=url.searchParams.get('link')==='1',current=linking?await getAppUser():null;
      if(linking&&!current)return errorRedirect('use_password');
      const state=randomToken(),verifier=randomToken(),nonce=randomToken();
      const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
      const challenge=btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
      await authDB().batch([
        authDB().prepare('DELETE FROM oauth_states WHERE expires_at<?').bind(Date.now()),
        authDB().prepare('INSERT INTO oauth_states (state_hash,verifier,nonce,expires_at,user_id) VALUES (?,?,?,?,?)').bind(await digest(state),verifier,nonce,Date.now()+300000,current?.userId||null),
      ]);
      const target=new URL('https://accounts.google.com/o/oauth2/v2/auth');
      target.search=new URLSearchParams({client_id:g.clientId,redirect_uri:redirectUri,response_type:'code',scope:'openid email profile',state,nonce,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'}).toString();
      return new Response(null,{status:303,headers:{Location:target.toString(),'Cache-Control':'no-store','Set-Cookie':`keytube_oauth=${state}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=300${url.protocol==='https:'?'; Secure':''}`}});
    }
    if(step!=='callback')throw new AppError(404,'Ruta no encontrada.');
    const state=url.searchParams.get('state')||'',code=url.searchParams.get('code');
    if(!/^[a-f0-9]{64}$/.test(state)||cookieValue(req.headers.get('cookie'),'keytube_oauth')!==state||!code)return errorRedirect('google_cancelled');
    const flow=await authDB().prepare('DELETE FROM oauth_states WHERE state_hash=? AND expires_at>? RETURNING verifier,nonce,user_id').bind(await digest(state),Date.now()).first<{verifier:string;nonce:string;user_id:string|null}>();
    if(!flow)return errorRedirect('google_expired');
    const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:g.clientId,client_secret:g.secret,redirect_uri:redirectUri,code,code_verifier:flow.verifier,grant_type:'authorization_code'}),signal:AbortSignal.timeout(10000),redirect:'error'});
    if(!tokenResponse.ok)return errorRedirect('google_failed');
    const tokens=await tokenResponse.json() as {id_token:string};
    const identity=await googleIdentity(tokens.id_token,flow.nonce);
    let user=await authDB().prepare('SELECT * FROM users WHERE google_sub=?').bind(identity.sub).first<UserRow>();
    if(flow.user_id) {
      const current=await getAppUser();
      if(!current||current.userId!==flow.user_id||current.email!==identity.email||(user&&user.id!==current.userId))return errorRedirect('google_link_failed');
      await authDB().prepare('UPDATE users SET google_sub=? WHERE id=? AND (google_sub IS NULL OR google_sub=?)').bind(identity.sub,current.userId,identity.sub).run();
      user=await authDB().prepare('SELECT * FROM users WHERE id=? AND google_sub=?').bind(current.userId,identity.sub).first<UserRow>();
      if(!user)return errorRedirect('google_link_failed');
    }
    if(!user) {
      // Never silently link a password account by an unverified email address.
      const collision=await authDB().prepare('SELECT id FROM users WHERE email=?').bind(identity.email).first();
      if(collision)return errorRedirect('use_password');
      const id=crypto.randomUUID(),now=Date.now();
      await authDB().batch([
        authDB().prepare('INSERT INTO users (id,email,name,google_sub,created_at) VALUES (?,?,?,?,?)').bind(id,identity.email,identity.name,identity.sub,now),
        authDB().prepare("INSERT INTO profiles (owner_id,name,bio,avatar,updated_at) VALUES (?,?,'','nico',?)").bind(id,identity.name,now),
      ]);
      user={id,email:identity.email,name:identity.name,google_sub:identity.sub,password_hash:null};
    }
    const headers=new Headers({Location:origin+'/','Cache-Control':'no-store'});
    headers.append('Set-Cookie',await createSession(req,user.id));
    headers.append('Set-Cookie',`keytube_oauth=; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=0${url.protocol==='https:'?'; Secure':''}`);
    return new Response(null,{status:303,headers});
  }catch(error){console.error('Google sign-in failed',error instanceof Error?error.message:'unknown');return errorRedirect('google_failed');}
}
