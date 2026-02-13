# Changelog

## 0.1.1 - 2026-02-13

- Fix: alias/private scope validation now resolves canonical module paths, preventing false positives with repeated folder names (e.g. `ScopeTrap`).
- Tests: expanded `tsserver` integration coverage, including alias in-scope completion and repeated-folder-name protection.
- Compatibility: Node minimum version aligned to `>=20`.
- CI: matrix coverage for Node `20` and `24`.
