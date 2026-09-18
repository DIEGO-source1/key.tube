import { z } from "zod";
import { db, requireCreator, sameOrigin, readJson, response, failure, AppError } from "@/lib/keytube-server";
import { ensureV10Schema, requireAdmin } from "@/lib/v10";

export const dynamic = "force-dynamic";

export async function GET(){
  try{
    const admin=await requireAdmin();
    const rows=await db().prepare(`SELECT r.*,COALESCE(p.name,u.name,'Usuario') AS reporter_name
      FROM reports r LEFT JOIN profiles p ON p.owner_id=r.reporter_id LEFT JOIN users u ON u.id=r.reporter_id
      ORDER BY CASE WHEN r.status='open' THEN 0 ELSE 1 END,r.created_at DESC LIMIT 200`).all();
    return response({admin:admin.email,reports:rows.results});
  }catch(e){
    if(e instanceof Error&&e.message==="AUTH_REQUIRED")return response({error:"Inicia sesión."},401);
    if(e instanceof Error&&e.message==="ADMIN_REQUIRED")return response({error:"Solo administradores."},403);
    return failure(e);
  }
}

export async function POST(req:Request){
  try{
    sameOrigin(req);await ensureV10Schema();const user=await requireCreator();
    const data=z.discriminatedUnion("action",[
      z.object({action:z.literal("report"),targetType:z.enum(["post","comment","creator"]),targetId:z.string().min(1).max(120),reason:z.enum(["spam","abuse","copyright","adult","fraud","other"]),details:z.string().trim().max(1000).default("")}),
      z.object({action:z.literal("block"),userId:z.string().min(1).max(120),active:z.boolean()}),
    ]).parse(await readJson(req));
    if(data.action==="block"){
      if(data.userId===user.userId)throw new AppError(400,"No puedes bloquearte a ti mismo.");
      if(data.active)await db().prepare("INSERT OR IGNORE INTO blocks (id,owner_id,blocked_user_id,created_at) VALUES (?,?,?,?)").bind(crypto.randomUUID(),user.userId,data.userId,Date.now()).run();
      else await db().prepare("DELETE FROM blocks WHERE owner_id=? AND blocked_user_id=?").bind(user.userId,data.userId).run();
      return response({active:data.active});
    }
    await db().prepare("INSERT INTO reports (id,reporter_id,target_type,target_id,reason,details,status,created_at,resolved_at) VALUES (?,?,?,?,?,?,'open',?,NULL)")
      .bind(crypto.randomUUID(),user.userId,data.targetType,data.targetId,data.reason,data.details,Date.now()).run();
    return response({reported:true},201);
  }catch(e){return failure(e);}
}

export async function PATCH(req:Request){
  try{
    sameOrigin(req);await ensureV10Schema();await requireAdmin();
    const data=z.object({id:z.string().uuid(),status:z.enum(["open","resolved","dismissed"]),verifyCreator:z.string().optional(),verified:z.boolean().optional()}).parse(await readJson(req));
    await db().prepare("UPDATE reports SET status=?,resolved_at=? WHERE id=?").bind(data.status,data.status==="open"?null:Date.now(),data.id).run();
    if(data.verifyCreator&&typeof data.verified==="boolean")await db().prepare("UPDATE profiles SET verified=? WHERE owner_id=?").bind(data.verified?1:0,data.verifyCreator).run();
    return response({ok:true});
  }catch(e){
    if(e instanceof Error&&e.message==="AUTH_REQUIRED")return response({error:"Inicia sesión."},401);
    if(e instanceof Error&&e.message==="ADMIN_REQUIRED")return response({error:"Solo administradores."},403);
    return failure(e);
  }
}
