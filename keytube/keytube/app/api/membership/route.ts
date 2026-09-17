import { z } from "zod";
import {
  getPost,
  addressSchema,
  response,
  failure,
} from "@/lib/keytube-server";
import { getMembership } from "@/lib/unlock";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const post = await getPost(
      z.string().uuid().parse(url.searchParams.get("post")),
    );
    const raw = url.searchParams.get("wallet");
    const wallet = raw ? addressSchema.parse(raw) : undefined;
    return response(await getMembership(post.lock, post.network, wallet));
  } catch (e) {
    return failure(e);
  }
}
