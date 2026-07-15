// Config modules (`use`): compose a machine from other boom config repos — vetted, shared
// section sets — instead of authoring every section by hand. A module ref is a local path
// (relative to this repo, or absolute/`~`) or a git remote (`owner/repo[@ref]`, a URL); its
// sections are merged in *before* this repo's own, so your repo can still override a module.
//
// Resolution runs during reconcile (not at every config load — `where`/`doctor` shouldn't clone).
// Remotes clone once into a modules cache and are reused; a clone that fails (offline, typo)
// degrades to a warning that skips that module, never a failed reconcile. Nesting is one level:
// a module's own `use` is not followed, keeping resolution finite and legible.
import { isAbsolute, join } from "node:path";
import { type Env, stateHome } from "../engine/state.ts";
import { expandTilde, mkdir, rm } from "../lib/fs.ts";
import { checkoutRef, cloneRepo } from "../lib/git.ts";
import { hasBoomfile, loadConfig } from "./load.ts";
import { parseRemoteRef } from "./remote.ts";
import type { Section } from "./schema.ts";

export function modulesCacheDir(env: Env): string {
  return join(stateHome(env), "boom", "modules");
}

// A ref that names a filesystem path (rather than a remote): explicit `.`/`/`/`~`, or a bare
// relative path that actually resolves to a module dir under the repo — both are treated local.
function isPathRef(ref: string): boolean {
  return ref.startsWith(".") || ref.startsWith("/") || ref.startsWith("~");
}

// Stable cache-dir name for a remote ref (so re-resolving reuses the same clone).
function moduleSlug(ref: string): string {
  return ref.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "module";
}

export interface ResolvedModule {
  readonly ref: string;
  readonly dir?: string; // the resolved local directory (present on success)
  readonly cloned?: boolean; // a fresh clone happened this call (for `boom module` reporting)
  readonly error?: string; // why it didn't resolve (present on failure)
}

// Resolve one module ref to a local directory holding a boomfile.toml. A remote is cloned into
// the cache on first use (or when `update` forces a re-clone); an already-cached module is reused.
export async function resolveModule(
  env: Env,
  repo: string,
  ref: string,
  update = false,
): Promise<ResolvedModule> {
  // Local path (explicit `.`/`/`/`~`, or a bare repo-relative subdir that exists) — no network,
  // the testable case. A `~`/absolute path is used as-is; anything else resolves under the repo.
  if (isPathRef(ref)) {
    const expanded = expandTilde(ref, env);
    const dir = isAbsolute(expanded) ? expanded : join(repo, expanded);
    return (await hasBoomfile(dir)) ? { ref, dir } : { ref, error: `no boomfile.toml at ${dir}` };
  }
  const asRepoRel = join(repo, ref);
  if (await hasBoomfile(asRepoRel)) return { ref, dir: asRepoRel };

  // Otherwise a git remote — clone into the cache (once, or on --update).
  const { url, ref: gitRef } = parseRemoteRef(ref);
  const dir = join(modulesCacheDir(env), moduleSlug(ref));
  const cached = await hasBoomfile(dir);
  if (cached && !update) return { ref, dir };

  await mkdir(modulesCacheDir(env), { recursive: true });
  await rm(dir, { recursive: true, force: true });
  const clone = cloneRepo(url, dir, env);
  if (clone.code !== 0) return { ref, error: `clone ${url} failed: ${clone.stderr || "unknown error"}` };
  if (gitRef) {
    const co = checkoutRef(dir, gitRef, env);
    if (co.code !== 0) return { ref, error: `checkout ${gitRef} failed: ${co.stderr || "unknown error"}` };
  }
  if (!(await hasBoomfile(dir))) return { ref, error: `no boomfile.toml in module ${ref}` };
  return { ref, dir, cloned: true };
}

// Resolve every `use` module to its sections, in order, for reconcile to compose before the base
// repo's own. A module that fails to resolve (or whose config is invalid) is reported via
// `onError` and skipped — one bad module never sinks the whole reconcile.
export async function resolveModuleSections(
  env: Env,
  repo: string,
  uses: readonly string[],
  onError: (ref: string, why: string) => void,
): Promise<Section[]> {
  const out: Section[] = [];
  for (const ref of uses) {
    try {
      // resolveModule can itself throw on a genuine filesystem error (e.g. the modules cache dir
      // isn't writable) — catch here too, so "one bad module never sinks the reconcile" holds for
      // an I/O failure, not just a clean clone/parse error.
      const m = await resolveModule(env, repo, ref);
      if (!m.dir) {
        onError(ref, m.error ?? "unresolved");
        continue;
      }
      const cfg = await loadConfig(m.dir);
      out.push(...cfg.section);
    } catch (e) {
      onError(ref, (e as Error).message);
    }
  }
  return out;
}
