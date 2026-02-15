import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionRoot = path.resolve(__dirname, "..");
const pluginRoot = path.resolve(
  extensionRoot,
  "..",
  "typescript-plugin-scoped-imports",
);
const pluginPackagePath = path.join(pluginRoot, "package.json");
const pluginPackage = JSON.parse(readFileSync(pluginPackagePath, "utf8"));

const targetRoot = path.join(
  extensionRoot,
  "node_modules",
  "typescript-plugin-scoped-imports",
);

if (existsSync(targetRoot)) {
  rmSync(targetRoot, { recursive: true, force: true });
}

mkdirSync(targetRoot, { recursive: true });
cpSync(path.join(pluginRoot, "dist"), path.join(targetRoot, "dist"), {
  recursive: true,
});
cpSync(path.join(pluginRoot, "README.md"), path.join(targetRoot, "README.md"));
cpSync(path.join(pluginRoot, "LICENSE"), path.join(targetRoot, "LICENSE"));

writeFileSync(
  path.join(targetRoot, "package.json"),
  `${JSON.stringify(
    {
      name: "typescript-plugin-scoped-imports",
      version: pluginPackage.version,
      main: "dist/index.js",
      types: "dist/index.d.ts",
      license: pluginPackage.license,
    },
    null,
    2,
  )}\n`,
);

console.log(
  `Synced typescript-plugin-scoped-imports@${pluginPackage.version} into ${targetRoot}`,
);
