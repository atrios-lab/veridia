// Loader hook for `pnpm test`: resolves the `@/x` alias from `tsconfig.json`
// to `src/x`, the only thing Node's own resolver does not already do for
// this project's tests. Node itself strips the TypeScript syntax the source
// uses (target ES2017, no emit-only constructs); this file only teaches it
// the one path alias.
//
// Registered via `--import ./scripts/test-resolve.mjs`. `register()` loads
// the `resolve` hook exported below into a separate loader realm, using this
// same file as both the registrar and the hook module — no second file
// needed.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const projectRoot = pathToFileURL(`${process.cwd()}/`);

register(import.meta.url, projectRoot);

const ALIAS_PREFIX = "@/";
const srcRoot = new URL("src/", projectRoot);

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(ALIAS_PREFIX)) {
    const target = new URL(specifier.slice(ALIAS_PREFIX.length), srcRoot);
    return nextResolve(target.href, context);
  }
  return nextResolve(specifier, context);
}
