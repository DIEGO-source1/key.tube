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
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const user = await requireCreator();
    const data = z
      .object({
        kind: z.enum(["save", "follow", "like"]),
        target: z.string().min(1).max(120),
        active: z.boolean(),
      })
      .parse(await readJson(req));
    if (data.kind === "follow" && data.target === user.userId)
      throw new AppError(400, "No puedes seguir tu propia cuenta.");
    const exists =
      data.kind === "save" || data.kind === "like"
        ? await db()
            .prepare("SELECT id FROM posts WHERE id = ?")
            .bind(data.target)
            .first()
        : await db()
            .prepare("SELECT id FROM posts WHERE owner_id = ? LIMIT 1")
            .bind(data.target)
            .first();
    if (!exists) throw new AppError(404, "El contenido o creador no existe.");
    const table = data.kind === "save" ? "saved_posts" : data.kind === "like" ? "post_likes" : "follows",
      column = data.kind === "follow" ? "creator_id" : "post_id";
    if (data.active)
      await db()
        .prepare(
          `INSERT OR IGNORE INTO ${table} (id,owner_id,${column},created_at) VALUES (?,?,?,?)`,
        )
        .bind(crypto.randomUUID(), user.userId, data.target, Date.now())
        .run();
    else
      await db()
        .prepare(`DELETE FROM ${table} WHERE owner_id = ? AND ${column} = ?`)
        .bind(user.userId, data.target)
        .run();
    return response({ active: data.active });
  } catch (e) {
    return failure(e);
  }
}
