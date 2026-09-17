import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers")
    return {
      url: pathToFileURL(path.join(root, "tests/runtime.mjs")).href,
      shortCircuit: true,
    };
  if ((specifier === "@/app/chatgpt-auth" || (specifier === "@/lib/auth" && process.env.KEYTUBE_REAL_AUTH !== "1")))
    return {
      url: pathToFileURL(path.join(root, "tests/auth.mjs")).href,
      shortCircuit: true,
    };
  if (
    specifier === "@/lib/unlock" ||
    (specifier === "./unlock" &&
      context.parentURL?.endsWith("/lib/keytube-server.ts"))
  )
    return {
      url: pathToFileURL(path.join(root, "tests/unlock.mjs")).href,
      shortCircuit: true,
    };
  if (specifier === "next/headers") return {url: pathToFileURL(path.join(root,"tests/headers.mjs")).href,shortCircuit:true};
  if (specifier === "./unlock" && context.parentURL?.endsWith("/lib/plans.ts")) return {url:pathToFileURL(path.join(root,"tests/unlock.mjs")).href,shortCircuit:true};
  if (specifier.startsWith("@/"))
    return {
      url: pathToFileURL(path.join(root, specifier.slice(2) + ".ts")).href,
      shortCircuit: true,
    };
  if (specifier.startsWith(".") && !path.extname(specifier))
    return {
      url: new URL(specifier + ".ts", context.parentURL).href,
      shortCircuit: true,
    };
  return nextResolve(specifier, context);
}
