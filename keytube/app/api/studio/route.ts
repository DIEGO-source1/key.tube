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
import { getAsset, deleteStorageKey } from "@/lib/media";
import { ensureV10Schema } from "@/lib/v10";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    await ensureV10Schema();
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
    await ensureV10Schema();
    sameOrigin(req);
    const user = await requireCreator();
    const post = await getPost(
      z.string().uuid().parse(new URL(req.url).searchParams.get("post")),
    );
    if (post.owner_id !== user.userId)
      throw new AppError(403, "Esta publicación pertenece a otro creador.");
    const assetIds = [post.thumbnail_id, post.preview_id, post.asset_id].filter(
      (id): id is string => !!id,
    );
    const assets = [] as { id: string; storage_key: string }[];
    for (const id of assetIds) {
      const asset = await db()
        .prepare("SELECT id,storage_key FROM assets WHERE id=? AND owner_id=?")
        .bind(id, user.userId)
        .first<{ id: string; storage_key: string }>();
      if (asset) assets.push(asset);
    }

    await db().batch([
      db().prepare("DELETE FROM media_grants WHERE post_id = ?").bind(post.id),
      db().prepare("DELETE FROM saved_posts WHERE post_id = ?").bind(post.id),
      db().prepare("DELETE FROM comments WHERE post_id = ?").bind(post.id),
      db()
        .prepare("DELETE FROM posts WHERE id = ? AND owner_id = ?")
        .bind(post.id, user.userId),
    ]);

    for (const asset of assets) {
      const stillUsed = await db()
        .prepare(
          "SELECT id FROM posts WHERE thumbnail_id=? OR preview_id=? OR asset_id=? LIMIT 1",
        )
        .bind(asset.id, asset.id, asset.id)
        .first();
      if (!stillUsed) {
        await db().prepare("DELETE FROM assets WHERE id=?").bind(asset.id).run();
        await deleteStorageKey(asset.storage_key);
      }
    }
    return response({ deleted: true });
  } catch (e) {
    return failure(e);
  }
}
