import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Two things Next resolves that plain Node does not.
 *
 * `server-only` is a build-time marker with no runtime behaviour — Next resolves
 * it through its bundler to enforce that a file never reaches a client bundle.
 * Node cannot resolve it at all, which would make every server module here
 * untestable, so it is redirected to an empty module. Nothing with behaviour is
 * being stubbed.
 *
 * `@/…` is the tsconfig path alias for the project root. Mapping it here means
 * the tests import exactly the same specifiers the application does, rather than
 * a parallel set of relative paths that could drift. TypeScript imports carry no
 * file extension, so the candidates are tried in the order tsc would.
 */
const ROOT = path.resolve(import.meta.dirname, "..");

/** The extensions tsc would try, in its order. */
function withExtension(base) {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`,
                           path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (existsSync(candidate) && !candidate.endsWith(path.sep)) return candidate;
  }
  return null;
}

export function resolve(specifier, context, next) {
  if (specifier === "server-only" || specifier === "client-only") {
    return { url: new URL("./empty.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier.startsWith("@/")) {
    const found = withExtension(path.join(ROOT, specifier.slice(2)));
    if (found) return next(pathToFileURL(found).href, context);
  }

  // Relative TypeScript imports are extensionless too, and Node will not guess.
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
    const from = path.dirname(new URL(context.parentURL).pathname);
    const found = withExtension(path.resolve(from, specifier));
    if (found) return next(pathToFileURL(found).href, context);
  }
  return next(specifier, context);
}
