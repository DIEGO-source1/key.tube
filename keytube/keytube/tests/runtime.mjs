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
