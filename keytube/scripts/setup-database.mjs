// Development-only: apply versioned migrations to the local D1 emulator.
import "./sites-env.mjs";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
const root = process.cwd();
const hosting = JSON.parse(readFileSync(".openai/hosting.json", "utf8"));
if (!hosting.d1) throw new Error("Configure the logical D1 binding first.");
mkdirSync(".sites-runtime", { recursive: true });
const config = path.join(root, ".sites-runtime/local-d1.json");
writeFileSync(
  config,
  JSON.stringify(
    {
      name: "keytube-local",
      compatibility_date: "2026-05-15",
      d1_databases: [
        {
          binding: hosting.d1,
          database_name: "site-creator-d1",
          database_id: "00000000-0000-4000-8000-000000000000",
          migrations_dir: path.join(root, "drizzle"),
        },
      ],
    },
    null,
    2,
  ),
);
const result = spawnSync(
  process.execPath,
  [
    path.join(root, "node_modules/wrangler/bin/wrangler.js"),
    "d1",
    "migrations",
    "apply",
    hosting.d1,
    "--local",
    "--config",
    config,
    "--persist-to",
    path.join(root, ".wrangler/state"),
  ],
  { stdio: "inherit" },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
