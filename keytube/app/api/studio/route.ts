import { z } from "zod";
import {
  db,
  requireCreator,
  getPost,
  sameOrigin,
  response,
  failure,
  AppError,
} from "@/lib/keytube-server";
import { getAsset } from "@/lib/media";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const user = await requireCreator();
    const post = await getPost(
      z.string().uuid().parse(new URL(req.url).searchParams.get("post")),
    );
    if (post.owner_id !== user.userId)
      throw new AppError(403, "Esta publicación pertenece a otro creador.");
    const asset = post.asset_id ? await getAsset(post.asset_id) : null;
    return response({
      body: post.body,
      mediaUrl: asset ? `/api/media/${asset.id}?owner=1` : undefined,
      mime: asset?.mime,
      verifiedAt: Date.now(),
      creatorPreview: true,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const user = await requireCreator();
    const post = await getPost(
      z.string().uuid().parse(new URL(req.url).searchParams.get("post")),
    );
    if (post.owner_id !== user.userId)
      throw new AppError(403, "Esta publicación pertenece a otro creador.");
    await db().batch([
      db().prepare("DELETE FROM media_grants WHERE post_id = ?").bind(post.id),
      db().prepare("DELETE FROM saved_posts WHERE post_id = ?").bind(post.id),
      db().prepare("DELETE FROM comments WHERE post_id = ?").bind(post.id),
      db()
        .prepare("DELETE FROM posts WHERE id = ? AND owner_id = ?")
        .bind(post.id, user.userId),
    ]);
    return response({ deleted: true });
  } catch (e) {
    return failure(e);
  }
}
