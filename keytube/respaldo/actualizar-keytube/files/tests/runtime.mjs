import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
export const sqlite = new DatabaseSync(":memory:");
for (const name of readdirSync(new URL("../drizzle/", import.meta.url))
  .filter((x) => x.endsWith(".sql"))
  .sort())
  sqlite.exec(
    readFileSync(new URL("../drizzle/" + name, import.meta.url), "utf8"),
  );
class Prepared {
  constructor(sql, args = []) {
    this.sql = sql;
    this.args = args;
  }
  bind(...args) {
    return new Prepared(this.sql, args);
  }
  async first() {
    return sqlite.prepare(this.sql).get(...this.args) || null;
  }
  async all() {
    return { results: sqlite.prepare(this.sql).all(...this.args) };
  }
  async run() {
    return sqlite.prepare(this.sql).run(...this.args);
  }
}
const objects = new Map();
const uploads = new Map();
function multipart(key,id){
  const get=()=>{const u=uploads.get(id);if(!u||u.key!==key)throw new Error('Missing multipart upload');return u;};
  return {
    uploadId:id,key,
    async uploadPart(partNumber,bytes){const etag=crypto.randomUUID();get().parts.set(partNumber,{bytes:new Uint8Array(bytes),etag});return {partNumber,etag};},
    async abort(){uploads.delete(id);},
    async complete(parts){
      const u=get(),chunks=parts.map(p=>{const found=u.parts.get(p.partNumber);if(!found||found.etag!==p.etag)throw new Error('Invalid multipart ETag');return found.bytes;});
      const size=chunks.reduce((n,b)=>n+b.length,0),result=new Uint8Array(size);let at=0;for(const b of chunks){result.set(b,at);at+=b.length;}
      objects.set(key,result);uploads.delete(id);return {size};
    },
  };
}
export const env = {
  DB: {
    prepare(sql) {
      return new Prepared(sql);
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const s of statements) results.push(await s.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  },
  BUCKET: {
    async createMultipartUpload(key){const id=crypto.randomUUID();uploads.set(id,{key,parts:new Map()});return multipart(key,id);},
    resumeMultipartUpload:multipart,
    async head(key){const bytes=objects.get(key);return bytes?{size:bytes.length}:null;},
    async put(key, bytes) {
      objects.set(key, new Uint8Array(bytes));
    },
    async delete(key) {
      objects.delete(key);
    },
    async get(key, options) {
      const bytes = objects.get(key);
      if (!bytes) return null;
      const range = options?.range;
      return {
        body: range
          ? bytes.slice(range.offset, range.offset + range.length)
          : bytes,
      };
    },
  },
};
