import { z } from "zod";
import {
  db,
  requireCreator,
  sameOrigin,
  readJson,
  response,
  failure,
  AppError,
} from "@/lib/keytube-server";
import { ensureV10Schema, notify, displayName } from "@/lib/v10";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await ensureV10Schema();
    const id = z.string().min(1).max(120).parse(new URL(req.url).searchParams.get("post"));
    const rows = await db().prepare(`SELECT c.id,c.owner_id,c.name,c.body,c.parent_id,c.created_at,
      COALESCE(p.avatar,'') AS avatar,COALESCE(p.verified,0) AS verified
      FROM comments c LEFT JOIN profiles p ON p.owner_id=c.owner_id
      WHERE c.post_id=? ORDER BY c.created_at ASC LIMIT 200`).bind(id).all();
    return response({ comments: rows.results });
  } catch (e) { return failure(e); }
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    await ensureV10Schema();
    const user = await requireCreator();
    const data = z.object({
      postId: z.string().min(1).max(120),
      body: z.string().trim().min(2).max(1000),
      parentId: z.string().uuid().nullable().optional(),
    }).parse(await readJson(req));
    const post = await db().prepare("SELECT id,owner_id,title FROM posts WHERE id=?").bind(data.postId).first<{id:string;owner_id:string;title:string}>();
    if (!post) throw new AppError(404,"La publicación no existe.");
    if (data.parentId) {
      const parent = await db().prepare("SELECT id FROM comments WHERE id=? AND post_id=?").bind(data.parentId,data.postId).first();
      if (!parent) throw new AppError(400,"La respuesta ya no tiene un comentario padre válido.");
    }
    const count = await db().prepare("SELECT COUNT(*) AS n FROM comments WHERE owner_id=? AND created_at>?").bind(user.userId,Date.now()-60000).first<{n:number}>();
    if ((count?.n||0)>=8) throw new AppError(429,"Espera un momento antes de comentar nuevamente.");
    const name=await displayName(user.userId);
    const comment={id:crypto.randomUUID(),owner_id:user.userId,name,body:data.body,parent_id:data.parentId||null,created_at:Date.now()};
    await db().prepare("INSERT INTO comments (id,owner_id,post_id,name,body,parent_id,created_at) VALUES (?,?,?,?,?,?,?)")
      .bind(comment.id,user.userId,data.postId,name,data.body,comment.parent_id,comment.created_at).run();
    await notify({ownerId:post.owner_id,actorId:user.userId,type:"comment",targetId:post.id,message:`${name} comentó en «${post.title}».`});
    if (data.parentId) {
      const parent = await db().prepare("SELECT owner_id FROM comments WHERE id=?").bind(data.parentId).first<{owner_id:string}>();
      if (parent) await notify({ownerId:parent.owner_id,actorId:user.userId,type:"reply",targetId:post.id,message:`${name} respondió a tu comentario.`});
    }
    return response({comment},201);
  } catch(e) { return failure(e); }
}

export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    await ensureV10Schema();
    const user=await requireCreator();
    const id=z.string().uuid().parse(new URL(req.url).searchParams.get("comment"));
    const comment=await db().prepare(`SELECT c.owner_id,c.post_id,p.owner_id AS post_owner FROM comments c JOIN posts p ON p.id=c.post_id WHERE c.id=?`).bind(id).first<{owner_id:string;post_id:string;post_owner:string}>();
    if(!comment) throw new AppError(404,"El comentario no existe.");
    if(comment.owner_id!==user.userId&&comment.post_owner!==user.userId) throw new AppError(403,"No puedes eliminar este comentario.");
    await db().prepare("DELETE FROM comments WHERE id=? OR parent_id=?").bind(id,id).run();
    return response({deleted:true});
  } catch(e){return failure(e);}
}
