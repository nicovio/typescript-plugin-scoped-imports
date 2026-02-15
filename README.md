# typescript-plugin-scoped-imports

Monorepo for the `typescript-plugin-scoped-imports` plugin and its VS Code wrapper extension.

## Packages

- `packages/typescript-plugin-scoped-imports`: TypeScript (`tsserver`) plugin
- `packages/typescript-plugin-scoped-imports-vscode`: VS Code wrapper extension (loads the plugin without requiring manual "Use Workspace Version")
- `examples/test-project`: integration/manual validation fixture

## What it solves

It controls auto-import suggestions so files outside scope cannot import modules inside `__private__` folders.

Current scope rule:

- In scope: parent directory of `__private__` and all descendants
- Out of scope: any file outside that subtree

## Public links

- npm package: https://www.npmjs.com/package/typescript-plugin-scoped-imports
- VS Code Marketplace: https://marketplace.visualstudio.com/items?itemName=nicovio.typescript-plugin-scoped-imports-vscode
- Source repository: https://github.com/nicovio/typescript-plugin-scoped-imports

## Quick start (development)

```bash
pnpm install
pnpm run typecheck
pnpm run build
pnpm run test
```

## Documentation

- Plugin docs: `packages/typescript-plugin-scoped-imports/README.md`
- VS Code extension docs: `packages/typescript-plugin-scoped-imports-vscode/README.md`
- Release checklist: `RELEASING.md`
