// Version is the single source of truth from package.json, embedded at build
// time by `bun build --compile` (the JSON import is statically bundled).
import pkg from "../../package.json" with { type: "json" };

export const VERSION = pkg.version as string;
