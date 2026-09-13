import { z } from 'zod';
import { authDB, authRateLimit, checkPassword, passwordHash, createSession, getAppUser, googleConfig, cookieValue, SESSION_COOKIE, digest, sessionCookie, type UserRow } from '@/lib/auth';
import { sameOrigin, readJson, response, failure, AppError } from '@/lib/keytube-server';
export const dynamic = 'force-dynamic';
export async function GET(_req: Request, {params}: {params:Promise<{action:string}>}) {
  try {
    if ((await params).action !== 'session') throw new AppError(404,'Ruta no encontrada.');
    const user = await getAppUser(), g = googleConfig();
    return response({user: user ? {id:user.userId,name:user.fullName,email:user.email}:null, googleEnabled:!!(g.clientId&&g.secret&&g.origin)});
  } catch(e) { return failure(e); }
}
export async function POST(req: Request, {params}: {params:Promise<{action:string}>}) {
  try {
    sameOrigin(req);
    const {action} = await params;
    if (action === 'logout') {
      await authDB().prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(cookieValue(req.headers.get('cookie'),SESSION_COOKIE))).run();
      const r=response({ok:true});r.headers.set('Set-Cookie',sessionCookie(req,'',0));return r;
    }
    if (!['register','login'].includes(action)) throw new AppError(404,'Ruta no encontrada.');
    const data = z.object({email:z.string().trim().email().max(254).transform(x=>x.toLowerCase()),password:z.string().min(10,'Usa al menos 10 caracteres.').max(128),name:z.string().trim().min(2).max(65).optional()}).parse(await readJson(req));
    try {await authRateLimit(req,data.email);} catch(e){throw new AppError(429,(e as Error).message);}
    let user=await authDB().prepare('SELECT * FROM users WHERE email=?').bind(data.email).first<UserRow>();
    if(action==='register') {
      if(!data.name) throw new AppError(400,'Escribe tu nombre.');
      if(user) throw new AppError(409,'No se pudo crear la cuenta con ese correo. Prueba iniciar sesión.');
      const id=crypto.randomUUID(), hash=await passwordHash(data.password),now=Date.now();
      try {
        await authDB().batch([
          authDB().prepare('INSERT INTO users (id,email,name,password_hash,created_at) VALUES (?,?,?,?,?)').bind(id,data.email,data.name,hash,now),
          authDB().prepare("INSERT INTO profiles (owner_id,name,bio,avatar,updated_at) VALUES (?,?,'','nico',?)").bind(id,data.name,now),
        ]);
      } catch {throw new AppError(409,'No se pudo crear la cuenta con ese correo. Prueba iniciar sesión.');}
      user={id,email:data.email,name:data.name,password_hash:hash,google_sub:null};
    } else if(!await checkPassword(data.password,user?.password_hash||null)) {
      throw new AppError(401,'El correo o la contraseña no son correctos.');
    }
    if(!user)throw new AppError(401,'El correo o la contraseña no son correctos.');
    const r=response({user:{id:user.id,name:user.name,email:user.email}},action==='register'?201:200);
    r.headers.set('Set-Cookie',await createSession(req,user.id));return r;
  }catch(e){return failure(e);}
}
