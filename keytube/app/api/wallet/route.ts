import { z } from "zod";
import {
  db,
  requireCreator,
  proofSchema,
  networkSchema,
  consumeProof,
  sameOrigin,
  readJson,
  response,
  failure,
} from "@/lib/keytube-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const user = await requireCreator();
    const data = proofSchema
      .extend({ network: networkSchema })
      .parse(await readJson(req));
    await consumeProof(
      req,
      data,
      "wallet",
      user.userId,
      data.network,
      user.userId,
    );
    await db()
      .prepare("UPDATE profiles SET wallet=?, updated_at=? WHERE owner_id=?")
      .bind(data.wallet, Date.now(), user.userId)
      .run();
    return response({ wallet: data.wallet });
  } catch (e) {
    return failure(e);
  }
}

export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const user = await requireCreator();
    await db()
      .prepare("UPDATE profiles SET wallet='', updated_at=? WHERE owner_id=?")
      .bind(Date.now(), user.userId)
      .run();
    return response({ wallet: "" });
  } catch (e) {
    return failure(e);
  }
}
