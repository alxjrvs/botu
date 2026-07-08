// Config source is always a git remote (repo-only): `botu link`/`botu init` take a
// remote reference — `owner/repo`, `github:owner/repo`, a full git URL, optionally
// `@ref` — clone it into the botu-managed cache dir, and record the breadcrumb.
// engine/sync.ts owns the ongoing fetch/pull-and-report on every apply/verify/fix;
// this file owns only the initial (re-)clone.
import { mkdir, rm } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";
import type { Env } from "../engine/state.ts";
import { pathExists } from "../lib/fs.ts";
import { checkoutRef, cloneRepo, isAheadOfUpstream, isClean } from "../lib/git.ts";
import {
  BotuConfigError,
  CONFIG_FILE,
  type ConfigRemote,
  configRepoCacheDir,
  hasBotufile,
  writeConfigBreadcrumb,
} from "./load.ts";

export interface ParsedRemoteRef {
  readonly url: string;
  readonly ref?: string;
}

// An SSH shorthand (`git@github.com:owner/repo`) has an `@` with no `/` before it,
// immediately followed by a bare host and `:` — that's the one shape whose `@` isn't
// a ref pin. Everything else (owner/repo, github:owner/repo, https://, ssh://, and
// crucially a ref that itself contains a slash, e.g. `owner/repo@feature/foo`) splits
// on the last `@` unconditionally; a slash-position heuristic gets those wrong.
const SSH_SHORTHAND_RE = /^[^/\s@]+@[^/\s@:]+:/;

function splitRef(input: string): { base: string; ref?: string } {
  if (SSH_SHORTHAND_RE.test(input)) return { base: input };
  const at = input.lastIndexOf("@");
  if (at === -1) return { base: input };
  return { base: input.slice(0, at), ref: input.slice(at + 1) };
}

const GITHUB_SHORTHAND_RE = /^[\w.-]+\/[\w.-]+$/;

// Generic git under the hood — GitHub shorthand is sugar, not a hard dependency. A
// full URL (scheme, or `git@host:`) passes through untouched.
function expandUrl(base: string): string {
  if (base.startsWith("github:")) return `https://github.com/${base.slice("github:".length)}.git`;
  if (GITHUB_SHORTHAND_RE.test(base)) return `https://github.com/${base}.git`;
  return base;
}

export function parseRemoteRef(input: string): ParsedRemoteRef {
  const { base, ref } = splitRef(input);
  return { url: expandUrl(base), ref };
}

// (Re-)clone `refInput` into the managed cache dir and record it as the active
// config. Re-linking always wipes and re-clones — the cache dir is never meant to
// hold precious work, so refuse instead of silently clobbering one that has any
// (uncommitted changes, or commits made but not yet pushed) — push or clean it up
// first, then re-link.
export async function linkRemoteConfigRepo(env: Env, refInput: string): Promise<string> {
  const { url, ref } = parseRemoteRef(refInput);
  const dest = configRepoCacheDir(env);

  // configRepoCacheDir is state-dir-relative; state dir falls back to a *relative*
  // path when neither XDG_STATE_HOME nor HOME is set (see engine/state.ts:stateHome).
  // The rm below would then resolve against the process cwd — mirrors the same
  // guard engine/code.ts's materializeAgentsFarm takes before its own rebuild-via-rm.
  if (!isAbsolute(dest)) {
    throw new BotuConfigError(
      "botu's state dir resolved to a relative path (HOME and XDG_STATE_HOME both unset) — refusing to clone/wipe there",
    );
  }

  if (await pathExists(dest)) {
    if (!isClean(dest, env) || isAheadOfUpstream(dest, env)) {
      throw new BotuConfigError(
        `${dest} has uncommitted or unpushed changes — \`botu push\` or clean it up before re-linking`,
      );
    }
    await rm(dest, { recursive: true, force: true });
  }

  await mkdir(dirname(dest), { recursive: true });
  const clone = cloneRepo(url, dest, env);
  if (clone.code !== 0) {
    throw new BotuConfigError(`git clone ${url} failed: ${clone.stderr || "unknown error"}`);
  }
  if (ref) {
    const co = checkoutRef(dest, ref, env);
    if (co.code !== 0) {
      throw new BotuConfigError(`git checkout ${ref} failed: ${co.stderr || "unknown error"}`);
    }
  }
  if (!(await hasBotufile(dest))) {
    throw new BotuConfigError(`no ${CONFIG_FILE} at ${url} — doesn't look like a botu dotfiles repo`);
  }

  const remote: ConfigRemote = ref ? { url, ref } : { url };
  await writeConfigBreadcrumb(env, { path: dest, remote });
  return dest;
}
