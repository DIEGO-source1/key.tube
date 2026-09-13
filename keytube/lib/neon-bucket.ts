import { getDatabase } from "./neon-db";

function toBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (typeof value === "string" && value.startsWith("\\x")) {
    const hex = value.slice(2);
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return out;
  }
  if (Array.isArray(value)) return Uint8Array.from(value as number[]);
  throw new Error("Formato binario inesperado desde Neon.");
}

type Range = { offset: number; length: number };

const store = {
  async put(
    storageKey: string,
    data: Uint8Array,
    options?: { httpMetadata?: { contentType?: string } },
  ) {
    await getDatabase()
      .prepare(
        `INSERT INTO media_objects (storage_key,data,content_type,size,updated_at)
         VALUES (?,?,?,?,?)
         ON CONFLICT(storage_key) DO UPDATE SET
           data=excluded.data,
           content_type=excluded.content_type,
           size=excluded.size,
           updated_at=excluded.updated_at`,
      )
      .bind(
        storageKey,
        data,
        options?.httpMetadata?.contentType || "application/octet-stream",
        data.byteLength,
        Date.now(),
      )
      .run();
  },

  async delete(storageKey: string) {
    await getDatabase()
      .prepare("DELETE FROM media_objects WHERE storage_key=?")
      .bind(storageKey)
      .run();
  },

  async get(storageKey: string, options?: { range?: Range }) {
    const row = options?.range
      ? await getDatabase()
          .prepare(
            "SELECT substring(data FROM ? + 1 FOR ?) AS data FROM media_objects WHERE storage_key=?",
          )
          .bind(options.range.offset, options.range.length, storageKey)
          .first<{ data: unknown }>()
      : await getDatabase()
          .prepare("SELECT data FROM media_objects WHERE storage_key=?")
          .bind(storageKey)
          .first<{ data: unknown }>();

    if (!row) return null;
    return { body: toBytes(row.data) };
  },
};

export function getMediaStore() {
  return store;
}
