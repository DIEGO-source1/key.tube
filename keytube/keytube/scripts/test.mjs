import { spawnSync } from "node:child_process";
for (const suite of ["access", "media", "accounts-plans"]) {
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-transform-types",
      "--loader",
      "./tests/loader.mjs",
      `tests/${suite}.mjs`,
    ],
    { stdio: "inherit", env: {...process.env, KEYTUBE_REAL_AUTH: suite === "accounts-plans" ? "1" : "0"} },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
