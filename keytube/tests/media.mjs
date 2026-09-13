import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { POST as upload } from "../app/api/uploads/route.ts";
import { GET as media } from "../app/api/media/[id]/route.ts";
import { POST as challenge } from "../app/api/challenge/route.ts";
import { POST as publish, GET as list } from "../app/api/posts/route.ts";
import { POST as access } from "../app/api/access/route.ts";
import { POST as social } from "../app/api/social/route.ts";
import { GET as account, POST as profile } from "../app/api/account/route.ts";
import { POST as comment, GET as comments } from "../app/api/comments/route.ts";
import { DELETE as remove, GET as studio } from "../app/api/studio/route.ts";
import { setUser } from "./auth.mjs";
import { state } from "./unlock.mjs";
import { sqlite } from "./runtime.mjs";
const origin = "https://keytube.test",
  creator = { userId: "creator-1", fullName: "Creator One" },
  other = { userId: "creator-2", fullName: "Creator Two" };
const signer = privateKeyToAccount(generatePrivateKey()),
  wallet = signer.address.toLowerCase(),
  network = 84532;
const bytes = readFileSync(
  new URL("../public/images/mountain.jpg", import.meta.url),
);
function req(path, body, method = "POST") {
  return new Request(origin + path, {
    method,
    headers: { Origin: origin, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
function readMedia(path, headers = {}) {
  return media(new Request(origin + path, { headers }), {
    params: Promise.resolve({ id: path.split("/")[3].split("?")[0] }),
  });
}
function uploadReq(role, body = bytes, mime = "image/jpeg", extra = {}) {
  return new Request(origin + "/api/uploads?role=" + role, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": mime,
      "X-File-Name": "photo.jpg",
      ...extra,
    },
    body,
  });
}
async function proof(purpose, extra) {
  const r = await challenge(
    req("/api/challenge", { wallet, network, purpose, ...extra }),
  );
  assert.equal(r.status, 200, await r.clone().text());
  const p = await r.json();
  return {
    wallet,
    challengeId: p.challengeId,
    signature: await signer.signMessage({ message: p.message }),
  };
}
let checks = 0;
function ok(name) {
  console.log("PASS", name);
  checks++;
}
let r = await upload(uploadReq("full"));
assert.equal(r.status, 201);
const full = (await r.json()).asset;
r = await upload(uploadReq("preview"));
assert.equal(r.status, 201);
const preview = (await r.json()).asset;
ok(
  "Creator uploads full and preview assets with separate private storage roles",
);
r = await readMedia("/api/media/" + preview.id);
assert.equal(r.status, 404);
ok("Unpublished previews are not public");
r = await readMedia("/api/media/" + full.id);
assert.equal(r.status, 401);
ok("Guessing a full asset ID does not reveal its bytes");
r = await readMedia("/api/media/" + full.id + "?owner=1");
assert.equal(r.status, 200);
assert.equal((await r.arrayBuffer()).byteLength, bytes.length);
ok("Creator can inspect their own upload");
setUser(other);
r = await readMedia("/api/media/" + full.id + "?owner=1");
assert.equal(r.status, 403);
ok("Another account cannot use owner preview");
const draft = {
  creator: "Creator Two",
  title: "Protected photograph",
  intro:
    "This low resolution preview introduces a private collection of mountain photographs.",
  body: "Private notes that accompany the original image.",
  type: "image",
  category: "Arte",
  assetId: full.id,
  previewId: preview.id,
  lock: "0x1111111111111111111111111111111111111111",
  network,
};
let p = await proof("publish", { draft });
r = await publish(req("/api/posts", { ...p, draft }));
assert.equal(r.status, 403);
ok("A Lock manager cannot publish another account’s uploaded asset");
setUser(creator);
p = await proof("publish", { draft });
r = await publish(req("/api/posts", { ...p, draft }));
assert.equal(r.status, 201, await r.clone().text());
const post = (await r.json()).post;
r = await list(new Request(origin + "/api/posts"));
const publicJSON = await r.text();
assert.ok(!publicJSON.includes(full.id));
assert.ok(!publicJSON.includes(draft.body));
ok("Public metadata excludes the original asset ID and private text");
setUser(null);
r = await readMedia("/api/media/" + preview.id);
assert.equal(r.status, 200);
assert.equal((await r.arrayBuffer()).byteLength, bytes.length);
ok("Published preview is readable without a wallet or account");
state.valid = false;
p = await proof("read", { postId: post.id });
r = await access(req("/api/access", { ...p, postId: post.id }));
assert.equal(r.status, 403);
assert.ok(!(await r.text()).includes("ticket="));
ok("No media ticket is issued without a valid Key");
state.valid = true;
p = await proof("read", { postId: post.id });
r = await access(req("/api/access", { ...p, postId: post.id }));
assert.equal(r.status, 200);
const granted = await r.json();
assert.ok(granted.mediaUrl.includes("ticket="));
r = await readMedia(granted.mediaUrl, { Range: "bytes=0-15" });
assert.equal(r.status, 206);
assert.equal(r.headers.get("Content-Range"), "bytes 0-15/" + bytes.length);
assert.equal(r.headers.get("Cache-Control"), "private, no-store");
assert.deepEqual(Buffer.from(await r.arrayBuffer()), bytes.subarray(0, 16));
ok("Valid Key grants a short-lived media ticket and correct range bytes");
state.valid = false;
r = await readMedia(granted.mediaUrl);
assert.equal(r.status, 403);
ok("Membership is checked again on every protected file request");
state.valid = true;
state.rpcFailure = true;
r = await readMedia(granted.mediaUrl);
assert.equal(r.status, 503);
state.rpcFailure = false;
ok("RPC outage blocks protected files");
sqlite.prepare("UPDATE media_grants SET expires_at = 0").run();
r = await readMedia(granted.mediaUrl);
assert.equal(r.status, 401);
ok("Expired media tickets are rejected");
r = await upload(uploadReq("full"));
assert.equal(r.status, 401);
ok("Anonymous uploads are rejected");
setUser(creator);
r = await upload(
  uploadReq("thumbnail", new TextEncoder().encode("<script>alert(1)</script>")),
);
assert.equal(r.status, 400);
r = await upload(
  uploadReq("full", bytes, "image/jpeg", {
    "Content-Length": String(21 * 1024 * 1024),
  }),
);
assert.equal(r.status, 413);
ok("Invalid signatures and oversized uploads are rejected");
r = await profile(
  req("/api/account", {
    name: "Mi creador",
    bio: "Fotografía de viajes",
    avatar: "nico",
  }),
);
assert.equal(r.status, 200);
for (let i = 0; i < 2; i++) {
  r = await social(
    req("/api/social", { kind: "save", target: post.id, active: true }),
  );
  assert.equal(r.status, 200);
}
r = await social(
  req("/api/social", { kind: "follow", target: creator.userId, active: true }),
);
assert.equal(r.status, 200);
r = await account();
const a = await r.json();
assert.equal(a.profile.name, "Mi creador");
assert.deepEqual(a.saved, [post.id]);
assert.deepEqual(a.following, [creator.userId]);
ok("Profile, favorites and follows persist without duplicate rows");
r = await comment(
  req("/api/comments", {
    postId: post.id,
    body: "Una colección muy interesante.",
  }),
);
assert.equal(r.status, 201);
r = await comments(new Request(origin + "/api/comments?post=" + post.id));
assert.equal((await r.json()).comments.length, 1);
ok("Comments persist and can be read from the public post");
setUser(other);
r = await account();
assert.deepEqual((await r.json()).saved, []);
r = await studio(new Request(origin + "/api/studio?post=" + post.id));
assert.equal(r.status, 403);
r = await remove(req("/api/studio?post=" + post.id, undefined, "DELETE"));
assert.equal(r.status, 403);
ok("Accounts are isolated and cannot read or delete another creator’s content");
setUser(creator);
r = await remove(req("/api/studio?post=" + post.id, undefined, "DELETE"));
assert.equal(r.status, 200);
assert.equal(sqlite.prepare("SELECT count(*) AS n FROM comments").get().n, 0);
assert.equal(
  sqlite.prepare("SELECT count(*) AS n FROM saved_posts").get().n,
  0,
);
r = await readMedia("/api/media/" + preview.id);
assert.equal(r.status, 404);
ok("Deleting a post removes associated records and closes its public preview");
console.log(
  `${checks} media and persistence checks passed. R2 and chain are mocked; SQLite, HTTP routes and signatures are real.`,
);
