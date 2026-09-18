import { z } from 'zod';
import { authDB, authRateLimit, checkPassword, passwordHash, createSession, getAppUser, googleConfig, cookieValue, SESSION_COOKIE, digest, sessionCookie, randomToken, ensurePasswordRecoverySchema, type UserRow } from '@/lib/auth';
import { recoveryEmailEnabled, sendRecoveryCode } from '@/lib/email';
import { sameOrigin, readJson, response, failure, AppError } from '@/lib/keytube-server';
export const dynamic = 'force-dynamic';

const emailSchema = z.string().trim().email().max(254).transform(x=>x.toLowerCase());
const passwordSchema = z.string().min(10,'Usa al menos 10 caracteres.').max(128);

function sixDigitCode() {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return String(value).padStart(6,'0');
}
function equalHash(a:string,b:string) {
  if (a.length !== b.length) return false;
  let diff=0;
  for(let i=0;i<a.length;i++) diff |= a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}

export async function GET(_req: Request, {params}: {params:Promise<{action:string}>}) {
  try {
    if ((await params).action !== 'session') throw new AppError(404,'Ruta no encontrada.');
    const user = await getAppUser(), g = googleConfig();
    return response({
      user: user ? {id:user.userId,name:user.fullName,email:user.email}:null,
      googleEnabled:!!(g.clientId&&g.secret&&g.origin),
      recoveryEnabled:recoveryEmailEnabled(),
    });
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

    if (action === 'recovery-start') {
      if(!recoveryEmailEnabled()) throw new AppError(503,'La recuperación por correo todavía no está configurada.');
      const data=z.object({email:emailSchema}).parse(await readJson(req));
      try {await authRateLimit(req,data.email);} catch(e){throw new AppError(429,(e as Error).message);}
      await ensurePasswordRecoverySchema();
      const user=await authDB().prepare('SELECT * FROM users WHERE email=?').bind(data.email).first<UserRow>();
      const flow=randomToken();
      if(user) {
        const code=sixDigitCode(),now=Date.now();
        await authDB().batch([
          authDB().prepare('DELETE FROM password_recovery_codes WHERE expires_at<? OR user_id=?').bind(now,user.id),
          authDB().prepare('INSERT INTO password_recovery_codes (flow_hash,user_id,code_hash,attempts,created_at,expires_at) VALUES (?,?,?,0,?,?)').bind(await digest(flow),user.id,await digest(`${flow}:${code}`),now,now+600000),
        ]);
        try { await sendRecoveryCode(user.email,user.name,code); }
        catch {
          await authDB().prepare('DELETE FROM password_recovery_codes WHERE flow_hash=?').bind(await digest(flow)).run();
          throw new AppError(502,'No pudimos enviar el código por correo. Vuelve a intentarlo en unos minutos.');
        }
      }
      return response({ok:true,flow,message:'Si el correo pertenece a una cuenta de KeyTube, recibirás un código de 6 dígitos.'});
    }

    if (action === 'recovery-reset') {
      const data=z.object({
        email:emailSchema,
        flow:z.string().regex(/^[a-f0-9]{64}$/,'La solicitud de recuperación no es válida.'),
        code:z.string().trim().regex(/^\d{6}$/,'Escribe el código de 6 dígitos.'),
        password:passwordSchema,
      }).parse(await readJson(req));
      try {await authRateLimit(req,data.email);} catch(e){throw new AppError(429,(e as Error).message);}
      await ensurePasswordRecoverySchema();
      const flowHash=await digest(data.flow),now=Date.now();
      const row=await authDB().prepare(`SELECT r.user_id,r.code_hash,r.attempts,u.id,u.email,u.name,u.password_hash,u.google_sub
        FROM password_recovery_codes r JOIN users u ON u.id=r.user_id
        WHERE r.flow_hash=? AND u.email=? AND r.expires_at>?`).bind(flowHash,data.email,now).first<UserRow&{user_id:string;code_hash:string;attempts:number}>();
      if(!row) throw new AppError(400,'El código expiró o la solicitud ya no es válida. Pide un código nuevo.');
      if(row.attempts>=5) {
        await authDB().prepare('DELETE FROM password_recovery_codes WHERE flow_hash=?').bind(flowHash).run();
        throw new AppError(429,'Se agotaron los intentos de este código. Pide uno nuevo.');
      }
      const expected=await digest(`${data.flow}:${data.code}`);
      if(!equalHash(expected,row.code_hash)) {
        const attempts=row.attempts+1;
        if(attempts>=5) await authDB().prepare('DELETE FROM password_recovery_codes WHERE flow_hash=?').bind(flowHash).run();
        else await authDB().prepare('UPDATE password_recovery_codes SET attempts=? WHERE flow_hash=?').bind(attempts,flowHash).run();
        throw new AppError(400,attempts>=5?'El código no es correcto y se agotaron los intentos. Pide uno nuevo.':'El código no es correcto. Revisa el correo e inténtalo otra vez.');
      }
      const hash=await passwordHash(data.password);
      await authDB().batch([
        authDB().prepare('UPDATE users SET password_hash=? WHERE id=?').bind(hash,row.user_id),
        authDB().prepare('DELETE FROM sessions WHERE user_id=?').bind(row.user_id),
        authDB().prepare('DELETE FROM password_recovery_codes WHERE user_id=?').bind(row.user_id),
      ]);
      const r=response({user:{id:row.id,name:row.name,email:row.email},ok:true});
      r.headers.set('Set-Cookie',await createSession(req,row.user_id));
      return r;
    }

    if (!['register','login'].includes(action)) throw new AppError(404,'Ruta no encontrada.');
    const data = z.object({email:emailSchema,password:passwordSchema,name:z.string().trim().min(2).max(65).optional()}).parse(await readJson(req));
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
