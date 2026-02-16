# Changelog

All notable changes to this extension are documented in this file.

## 0.1.8

- Added a short before/after demo GIF to the Marketplace README.
- Packaged the demo asset in the VSIX so documentation renders consistently.

## 0.1.7

- Updated Marketplace description to focus on the user-facing problem solved.
- Updated README opening copy to explain the extension value before implementation details.

## 0.1.6

- Bundled core plugin updated to `typescript-plugin-scoped-imports@0.1.3`.
- Includes completion hardening for exact `__private__` directory matching and improved ambiguity handling for similarly named directories.

## 0.1.5

- Fixed plugin sync packaging to include the full core plugin `dist/` output (`constants` and `utils` modules), not only `index.js`.
- Bundled core plugin updated to `typescript-plugin-scoped-imports@0.1.2`.

## 0.1.4

- Improved Marketplace README copy (goal, behavior, setup, troubleshooting).
- Added changelog file for Marketplace release notes tab.

## 0.1.3

- Fixed plugin loading reliability in tsserver.
- Bundled the core plugin under `node_modules/typescript-plugin-scoped-imports` in the VSIX.
- Registered plugin by package name (`typescript-plugin-scoped-imports`) for stable resolution.

## 0.1.2

- Added extension icon and packaged it inside the VSIX.
- Updated Marketplace-facing metadata.

## 0.1.1

- Initial stable Marketplace release of the VS Code wrapper extension.
