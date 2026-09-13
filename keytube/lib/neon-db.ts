import { neon } from "@neondatabase/serverless";

function connectionString() {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error("DATABASE_URL no está configurada.");
  }
  return value;
}

let cachedUrl = "";
let cachedSql: ReturnType<typeof neon> | null = null;

function sqlClient() {
  const url = connectionString();
  if (!cachedSql || cachedUrl !== url) {
    cachedSql = neon(url);
    cachedUrl = url;
  }
  return cachedSql;
}

function normalizeSql(source: string) {
  let text = source.trim();
  const insertOrIgnore = /^INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(text);
  if (insertOrIgnore) {
    text = text.replace(/^INSERT\s+OR\s+IGNORE\s+INTO\b/i, "INSERT INTO");
    const semicolon = text.endsWith(";");
    if (semicolon) text = text.slice(0, -1);
    if (!/\bON\s+CONFLICT\b/i.test(text)) text += " ON CONFLICT DO NOTHING";
    if (semicolon) text += ";";
  }

  let index = 0;
  return text.replace(/\?/g, () => `$${++index}`);
}

function normalizeValue(key: string, value: unknown) {
  if (typeof value !== "string" || !/^-?\d+$/.test(value)) return value;
  if (
    key === "n" ||
    key === "count" ||
    key === "size" ||
    key === "network" ||
    key === "duration_days" ||
    key.endsWith("_at")
  ) {
    const n = Number(value);
    if (Number.isSafeInteger(n)) return n;
  }
  return value;
}

function normalizeRow<T>(row: Record<string, unknown>): T {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, normalizeValue(key, value)]),
  ) as T;
}

class PreparedStatement {
  private values: unknown[] = [];

  constructor(readonly source: string) {}

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async first<T = Record<string, unknown>>() {
    const rows = (await sqlClient().query(
      normalizeSql(this.source),
      this.values,
    )) as unknown as Record<string, unknown>[];
    return rows[0] ? normalizeRow<T>(rows[0]) : null;
  }

  async all<T = Record<string, unknown>>() {
    const rows = (await sqlClient().query(
      normalizeSql(this.source),
      this.values,
    )) as unknown as Record<string, unknown>[];
    return { results: rows.map((row) => normalizeRow<T>(row)) };
  }

  async run() {
    const result = (await sqlClient().query(
      normalizeSql(this.source),
      this.values,
      { fullResults: true },
    )) as unknown as { rowCount?: number; rows?: Record<string, unknown>[] };
    return {
      success: true,
      meta: { changes: result.rowCount ?? 0 },
      results: (result.rows ?? []).map((row) => normalizeRow(row)),
    };
  }
}

class NeonCompatDatabase {
  prepare(source: string) {
    return new PreparedStatement(source);
  }

  async batch(statements: PreparedStatement[]) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }
}

const database = new NeonCompatDatabase();

export function getDatabase() {
  connectionString();
  return database;
}
