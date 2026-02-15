# Changelog

## 0.1.3 - 2026-02-15

- Completions hardening: private directory validation by `typedPath` now applies only to exact `__private__` directory entries.
- Completions hardening: candidate import path is built from the evaluated directory entry name (no hardcoded private folder suffix in helper).
- Tests: added unit coverage for similarly named private-like directories (for example `__private__backup`) and candidate path construction.

## 0.1.2 - 2026-02-15

- Refactor: split plugin internals into `utils/` modules and keep `src/index.ts` focused on tsserver interceptor orchestration.
- Internal API: adopted parameter-signature convention (`3+` args use typed object params, `1-2` args stay positional) across touched utilities and wiring.
- Tests: added and expanded unit coverage for module resolution, text change parsing edge cases, and path/scope normalization behavior.
- Behavior: no public API changes and no scope-rule changes (`parent + descendientes` remains intact).

## 0.1.1 - 2026-02-13

- Fix: alias/private scope validation now resolves canonical module paths, preventing false positives with repeated folder names (e.g. `ScopeTrap`).
- Tests: expanded `tsserver` integration coverage, including alias in-scope completion and repeated-folder-name protection.
- Compatibility: Node minimum version aligned to `>=20`.
- CI: matrix coverage for Node `20` and `24`.
