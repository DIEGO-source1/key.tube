import { z } from "zod";
import { db, requireCreator, sameOrigin, readJson, response, failure } from "@/lib/keytube-server";
import { ensureV10Schema } from "@/lib/v10";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireCreator();
    await ensureV10Schema();
    const rows = await db().prepare(`SELECT n.id,n.type,n.target_id,n.message,n.read_at,n.created_at,
      COALESCE(p.name,u.name,'Miembro') AS actor_name
      FROM notifications n
      LEFT JOIN profiles p ON p.owner_id=n.actor_id
      LEFT JOIN users u ON u.id=n.actor_id
      WHERE n.owner_id=? ORDER BY n.created_at DESC LIMIT 80`).bind(user.userId).all<{
        id:string;type:string;target_id:string|null;message:string;read_at:number|null;created_at:number;actor_name:string;
      }>();
    const unread = rows.results.filter(x => !x.read_at).length;
    return response({ notifications: rows.results, unread });
  } catch (e) { return failure(e); }
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const user = await requireCreator();
    await ensureV10Schema();
    const data = z.object({ id: z.string().uuid().optional(), all: z.boolean().optional() }).parse(await readJson(req));
    if (data.all) await db().prepare("UPDATE notifications SET read_at=? WHERE owner_id=? AND read_at IS NULL").bind(Date.now(), user.userId).run();
    else if (data.id) await db().prepare("UPDATE notifications SET read_at=? WHERE id=? AND owner_id=?").bind(Date.now(), data.id, user.userId).run();
    return response({ ok: true });
  } catch (e) { return failure(e); }
}
