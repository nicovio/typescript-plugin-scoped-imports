# typescript-plugin-scoped-imports

TypeScript Language Service plugin that filters auto-imports from private folders (`__private__`) based on file scope.

## What it does

When TypeScript proposes imports (completions, quick fixes, refactors), this plugin blocks imports from `__private__` when the current file is out of scope.

Current scope rule:

- Allowed: parent directory of `__private__` and descendants
- Blocked: any file outside that subtree

## Installation

```bash
npm i -D typescript
npm i typescript-plugin-scoped-imports
```

## Configuration

In `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "typescript-plugin-scoped-imports"
      }
    ]
  }
}
```

## Quick example

Structure:

```text
src/components/gallery/__private__/Item.ts
src/components/gallery/silbing/nephew/InScope.ts
src/views/Home.ts
```

- In `InScope.ts`: importing `Item` from `__private__` is allowed
- In `Home.ts`: importing `Item` from `__private__` is blocked

## VS Code

If you use only the npm plugin, VS Code may require using the workspace TypeScript version to load it.

To avoid that, use the wrapper extension:

- `packages/typescript-plugin-scoped-imports-vscode`
- Marketplace: https://marketplace.visualstudio.com/items?itemName=nicovio.typescript-plugin-scoped-imports-vscode

## Compatibility

- Node.js: `>=20`
- TypeScript: `>=4.0.0`

## Troubleshooting

If it does not load:

1. Open `TypeScript: Open TS Server log`.
2. Look for `PLUGIN LOADING: typescript-plugin-scoped-imports`.
3. If missing, check:
   - plugin is installed in the project
   - `tsconfig.json` includes it under `compilerOptions.plugins`

## Known limitations

- Privacy convention is based on folder name `__private__`
- No custom private-pattern configuration yet

## Automated validation

Main integration coverage lives in:

- `packages/typescript-plugin-scoped-imports/__tests__/integration/tsserver.scoped-imports.spec.ts`

Run:

```bash
pnpm run build
pnpm run test
```

## Changelog

See `CHANGELOG.md`.
