# TypeScript Plugin Scoped Imports (VS Code)

Wrapper extension that loads `typescript-plugin-scoped-imports` in VS Code without depending on manually selecting "Use Workspace Version".

## What it does

Registers the `tsserver` plugin via `typescriptServerPlugins`, so VS Code loads it from the extension.

## Install (user)

1. Install the extension from VS Code Marketplace:
   - https://marketplace.visualstudio.com/items?itemName=nicovio.typescript-plugin-scoped-imports-vscode
2. Make sure your project has the plugin in `tsconfig.json`:

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

## Verification

1. Run `TypeScript: Open TS Server log`.
2. Look for `PLUGIN LOADING: typescript-plugin-scoped-imports`.

## Troubleshooting

If it does not load:

- reload VS Code (`Developer: Reload Window`)
- confirm the project has a valid `tsconfig.json`
- check the log for plugin loading errors

## For maintainers (publishing)

From this directory:

```bash
npm install
npm run package
```

This generates a self-contained `.vsix` (includes synced plugin files under `node_modules/typescript-plugin-scoped-imports/`).

Publish to Marketplace:

```bash
npx vsce login nicovio
npm run publish:vsce
```
