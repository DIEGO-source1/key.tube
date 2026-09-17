import assert from "node:assert/strict";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { POST as challenge } from "../app/api/challenge/route.ts";
import { POST as publish, GET as list } from "../app/api/posts/route.ts";
import { POST as access } from "../app/api/access/route.ts";
import { state } from "./unlock.mjs";
import { setUser } from "./auth.mjs";
import { sqlite } from "./runtime.mjs";
const account = privateKeyToAccount(generatePrivateKey()),
  other = privateKeyToAccount(generatePrivateKey());
const wallet = account.address.toLowerCase(),
  network = 84532;
const draft = {
  creator: "Test Creator",
  title: "Private learning guide",
  intro:
    "Public introduction that can be read by every visitor to the content portal.",
  body: "PRIVATE_BODY_SENTINEL. This full lesson must only be delivered to a wallet holding a valid membership key.",
  lock: "0x1111111111111111111111111111111111111111",
  network,
};
function req(path, body, origin = "https://revela.test") {
  return new Request("https://revela.test" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
}
async function proof(purpose, extra, signer = account) {
  const r = await challenge(
    req("/api/challenge", { purpose, wallet, network, ...extra }),
  );
  assert.equal(r.status, 200);
  const data = await r.json();
  return {
    wallet,
    challengeId: data.challengeId,
    signature: await signer.signMessage({ message: data.message }),
  };
}
let checks = 0;
function ok(name) {
  checks++;
  console.log("PASS", name);
}
const p = await proof("publish", { draft });
const published = await publish(req("/api/posts", { ...p, draft }));
assert.equal(published.status, 201);
const post = (await published.json()).post;
assert.ok(post.id);
ok("Authorized creator publishes a durable guide");
const publicResult = await list(new Request("https://revela.test/api/posts"));
const publicText = await publicResult.text();
assert.ok(publicText.includes(draft.intro));
assert.ok(!publicText.includes("PRIVATE_BODY_SENTINEL"));
assert.ok(!publicText.includes("owner_id"));
ok("Public listing excludes private body and creator identity");
let signed = await proof("read", { postId: post.id });
let r = await access(req("/api/access", { ...signed, postId: post.id }));
assert.equal(r.status, 403);
assert.equal((await r.json()).code, "MEMBERSHIP_REQUIRED");
ok("Wallet without a Key is denied");
state.valid = true;
signed = await proof("read", { postId: post.id });
r = await access(req("/api/access", { ...signed, postId: post.id }));
assert.equal(r.status, 200);
assert.equal((await r.json()).body, draft.body);
assert.equal(r.headers.get("Cache-Control"), "private, no-store");
ok("Valid membership grants only the requested private body");
r = await access(req("/api/access", { ...signed, postId: post.id }));
assert.equal(r.status, 401);
ok("Replayed nonce is rejected");
signed = await proof("read", { postId: post.id }, other);
r = await access(req("/api/access", { ...signed, postId: post.id }));
assert.equal(r.status, 401);
ok("Signature from another wallet is rejected");
signed = await proof("read", { postId: post.id });
sqlite
  .prepare("UPDATE challenges SET expires_at = 0 WHERE id = ?")
  .run(signed.challengeId);
r = await access(req("/api/access", { ...signed, postId: post.id }));
assert.equal(r.status, 401);
ok("Expired challenge is rejected");
state.valid = false;
signed = await proof("read", { postId: post.id });
r = await access(req("/api/access", { ...signed, postId: post.id }));
assert.equal(r.status, 403);
ok("Membership expiry or transfer denies the next read");
state.valid = true;
state.rpcFailure = true;
signed = await proof("read", { postId: post.id });
r = await access(req("/api/access", { ...signed, postId: post.id }));
assert.equal(r.status, 503);
assert.ok(!(await r.text()).includes("PRIVATE_BODY_SENTINEL"));
state.rpcFailure = false;
ok("RPC failure fails closed");
state.manager = false;
const denied = await proof("publish", { draft });
r = await publish(req("/api/posts", { ...denied, draft }));
assert.equal(r.status, 403);
state.manager = true;
ok("Non-manager cannot publish against a creator Lock");
const mismatched = await proof("publish", { draft });
r = await publish(
  req("/api/posts", {
    ...mismatched,
    draft: { ...draft, title: "Tampered title" },
  }),
);
assert.equal(r.status, 401);
ok("Signed publication cannot be changed after authorization");
const cross = await proof("read", { postId: post.id });
r = await access(
  req("/api/access", { ...cross, postId: post.id }, "https://attacker.invalid"),
);
assert.equal(r.status, 403);
ok("Cross-origin submission is rejected");
setUser(null);
r = await publish(req("/api/posts", { ...p, draft }));
assert.equal(r.status, 401);
ok("Anonymous creator publication is rejected");
console.log(
  `${checks} access-control checks passed. Chain state is mocked; signatures and SQLite are real.`,
);
