import { z } from "zod";
import {
  db,
  requireCreator,
  sameOrigin,
  readJson,
  response,
  failure,
  AppError,
  getPost,
} from "@/lib/keytube-server";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const id = z
      .string()
      .min(1)
      .max(120)
      .parse(new URL(req.url).searchParams.get("post"));
    await getPost(id);
    const rows = await db()
      .prepare(
        "SELECT id,name,body,created_at FROM comments WHERE post_id = ? ORDER BY created_at DESC LIMIT 100",
      )
      .bind(id)
      .all();
    return response({ comments: rows.results });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const user = await requireCreator();
    const data = z
      .object({
        postId: z.string().min(1).max(120),
        body: z.string().trim().min(2).max(1000),
      })
      .parse(await readJson(req));
    if (
      !(await db()
        .prepare("SELECT id FROM posts WHERE id = ? AND status='published'")
        .bind(data.postId)
        .first())
    )
      throw new AppError(404, "La publicación no existe.");
    const count = await db()
      .prepare(
        "SELECT COUNT(*) AS n FROM comments WHERE owner_id = ? AND created_at > ?",
      )
      .bind(user.userId, Date.now() - 60000)
      .first<{ n: number }>();
    if ((count?.n || 0) >= 8)
      throw new AppError(
        429,
        "Espera un momento antes de comentar nuevamente.",
      );
    const profile = await db()
      .prepare("SELECT name FROM profiles WHERE owner_id = ?")
      .bind(user.userId)
      .first<{ name: string }>();
    const comment = {
      id: crypto.randomUUID(),
      name: profile?.name || user.fullName || "Miembro",
      body: data.body,
      created_at: Date.now(),
    };
    await db()
      .prepare(
        "INSERT INTO comments (id,owner_id,post_id,name,body,created_at) VALUES (?,?,?,?,?,?)",
      )
      .bind(
        comment.id,
        user.userId,
        data.postId,
        comment.name,
        comment.body,
        comment.created_at,
      )
      .run();
    return response({ comment }, 201);
  } catch (e) {
    return failure(e);
  }
}
