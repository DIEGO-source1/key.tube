import { z } from "zod";
import { db, requireCreator, sameOrigin, readJson, response, failure, AppError } from "@/lib/keytube-server";
import { ensureV10Schema } from "@/lib/v10";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user=await requireCreator();
    await ensureV10Schema();
    const collections=await db().prepare(`SELECT c.id,c.name,c.created_at,c.updated_at,COUNT(cp.post_id) AS item_count
      FROM collections c LEFT JOIN collection_posts cp ON cp.collection_id=c.id
      WHERE c.owner_id=? GROUP BY c.id,c.name,c.created_at,c.updated_at ORDER BY c.updated_at DESC`).bind(user.userId).all();
    const items=await db().prepare(`SELECT cp.collection_id,cp.post_id,p.title,p.creator,p.type,p.category,p.thumbnail_id,p.preview_id,p.asset_id,p.visibility
      FROM collection_posts cp JOIN collections c ON c.id=cp.collection_id JOIN posts p ON p.id=cp.post_id
      WHERE c.owner_id=? ORDER BY cp.created_at DESC`).bind(user.userId).all();
    return response({collections:collections.results,items:items.results});
  } catch(e){return failure(e);}
}

export async function POST(req:Request){
  try{
    sameOrigin(req);const user=await requireCreator();await ensureV10Schema();
    const data=z.discriminatedUnion("action",[
      z.object({action:z.literal("create"),name:z.string().trim().min(1).max(60)}),
      z.object({action:z.literal("add"),collectionId:z.string().uuid(),postId:z.string().uuid()}),
      z.object({action:z.literal("remove"),collectionId:z.string().uuid(),postId:z.string().uuid()}),
      z.object({action:z.literal("rename"),collectionId:z.string().uuid(),name:z.string().trim().min(1).max(60)}),
    ]).parse(await readJson(req));
    const now=Date.now();
    if(data.action==="create"){
      const id=crypto.randomUUID();
      await db().prepare("INSERT INTO collections (id,owner_id,name,created_at,updated_at) VALUES (?,?,?,?,?)").bind(id,user.userId,data.name,now,now).run();
      return response({collection:{id,name:data.name,item_count:0}},201);
    }
    const own=await db().prepare("SELECT id FROM collections WHERE id=? AND owner_id=?").bind(data.collectionId,user.userId).first();
    if(!own)throw new AppError(404,"La colección no existe.");
    if(data.action==="rename"){
      await db().prepare("UPDATE collections SET name=?,updated_at=? WHERE id=? AND owner_id=?").bind(data.name,now,data.collectionId,user.userId).run();
      return response({ok:true});
    }
    const post=await db().prepare("SELECT id FROM posts WHERE id=?").bind(data.postId).first();
    if(!post)throw new AppError(404,"La publicación no existe.");
    if(data.action==="add")await db().prepare("INSERT OR IGNORE INTO collection_posts (id,collection_id,post_id,created_at) VALUES (?,?,?,?)").bind(crypto.randomUUID(),data.collectionId,data.postId,now).run();
    else await db().prepare("DELETE FROM collection_posts WHERE collection_id=? AND post_id=?").bind(data.collectionId,data.postId).run();
    await db().prepare("UPDATE collections SET updated_at=? WHERE id=?").bind(now,data.collectionId).run();
    return response({ok:true});
  }catch(e){return failure(e);}
}

export async function DELETE(req:Request){
  try{sameOrigin(req);const user=await requireCreator();await ensureV10Schema();const id=z.string().uuid().parse(new URL(req.url).searchParams.get("id"));
    const own=await db().prepare("SELECT id FROM collections WHERE id=? AND owner_id=?").bind(id,user.userId).first();if(!own)throw new AppError(404,"La colección no existe.");
    await db().batch([db().prepare("DELETE FROM collection_posts WHERE collection_id=?").bind(id),db().prepare("DELETE FROM collections WHERE id=? AND owner_id=?").bind(id,user.userId)]);return response({deleted:true});
  }catch(e){return failure(e);}
}
