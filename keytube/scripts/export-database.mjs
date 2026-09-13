// Generates a clean, empty distribution database. Never reads production data.
import { DatabaseSync } from "node:sqlite";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  existsSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url),
  directory = new URL("../database/", import.meta.url);
mkdirSync(directory, { recursive: true });
const target = new URL("keytube.sqlite", directory);
if (existsSync(target)) unlinkSync(target);
const db = new DatabaseSync(fileURLToPath(target));
for (const file of readdirSync(new URL("drizzle/", root))
  .filter((f) => f.endsWith(".sql"))
  .sort())
  db.exec(readFileSync(new URL("drizzle/" + file, root), "utf8"));
const statements = db
  .prepare(
    "SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END,name",
  )
  .all();
writeFileSync(
  new URL("keytube.sql", directory),
  "-- KeyTube: empty SQLite schema. Import once into a new database.\n-- Full files live in private R2 storage; this database holds their metadata.\nPRAGMA foreign_keys=ON;\nBEGIN TRANSACTION;\n" +
    statements.map((row) => row.sql + ";").join("\n\n") +
    "\nCOMMIT;\n",
);
const integrity = db.prepare("PRAGMA integrity_check").get();
if (integrity.integrity_check !== "ok")
  throw new Error("Database integrity failed");
console.log(
  "Generated database/keytube.sqlite and database/keytube.sql (13 empty application tables).",
);
db.close();
