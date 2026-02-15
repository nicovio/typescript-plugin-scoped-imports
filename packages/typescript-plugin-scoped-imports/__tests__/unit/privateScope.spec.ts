import {
  getPrivateParentDirectory,
  isPrivateImportAllowed,
} from "../../src/utils/privateScope";

const NOOP_LOGGER = {
  logInfo: () => {},
  logDebug: () => {},
};

describe("privateScope utils", () => {
  const resolveImportPath = (importPath: string): string | null => {
    if (importPath.includes("@/components/gallery/__private__/Item")) {
      return "/repo/src/components/gallery/__private__/Item.tsx";
    }

    if (importPath.includes("@/components/gallery/__private__")) {
      return "/repo/src/components/gallery/__private__/index.ts";
    }

    return null;
  };

  test("getPrivateParentDirectory returns parent of __private__", () => {
    const parent = getPrivateParentDirectory({
      importPath: "@/components/gallery/__private__/Item",
      currentFile: "/repo/src/views/Home.tsx",
      resolveImportPathToAbsolute: resolveImportPath,
    });

    expect(parent).toBe("/repo/src/components/gallery/");
  });

  test("allows private import from parent directory", () => {
    const result = isPrivateImportAllowed({
      importPath: "@/components/gallery/__private__/Item",
      currentFile: "/repo/src/components/gallery/Parent.tsx",
      resolveImportPathToAbsolute: resolveImportPath,
      logging: NOOP_LOGGER,
    });

    expect(result).toBe(true);
  });

  test("allows private import from descendant directory", () => {
    const result = isPrivateImportAllowed({
      importPath: "@/components/gallery/__private__/Item",
      currentFile: "/repo/src/components/gallery/sibling/nephew/index.tsx",
      resolveImportPathToAbsolute: resolveImportPath,
      logging: NOOP_LOGGER,
    });

    expect(result).toBe(true);
  });

  test("blocks private import from out-of-scope file", () => {
    const result = isPrivateImportAllowed({
      importPath: "@/components/gallery/__private__/Item",
      currentFile: "/repo/src/views/Home.tsx",
      resolveImportPathToAbsolute: resolveImportPath,
      logging: NOOP_LOGGER,
    });

    expect(result).toBe(false);
  });

  test("allows any private import when current file is inside __private__", () => {
    const result = isPrivateImportAllowed({
      importPath: "@/components/gallery/__private__/Item",
      currentFile: "/repo/src/components/gallery/__private__/LocalFile.tsx",
      resolveImportPathToAbsolute: resolveImportPath,
      logging: NOOP_LOGGER,
    });

    expect(result).toBe(true);
  });

  test("allows non-private imports", () => {
    const result = isPrivateImportAllowed({
      importPath: "@/components/public/Button",
      currentFile: "/repo/src/views/Home.tsx",
      resolveImportPathToAbsolute: resolveImportPath,
      logging: NOOP_LOGGER,
    });

    expect(result).toBe(true);
  });

  test("handles windows-style separators consistently", () => {
    const windowsResolveImportPath = (importPath: string): string | null => {
      if (importPath.includes("@/components/gallery/__private__/Item")) {
        return "C:/repo/src/components/gallery/__private__/Item.tsx";
      }

      return null;
    };

    const result = isPrivateImportAllowed({
      importPath: "@/components/gallery/__private__/Item",
      currentFile:
        "C:\\repo\\src\\components\\gallery\\sibling\\nephew\\index.tsx",
      resolveImportPathToAbsolute: windowsResolveImportPath,
      logging: NOOP_LOGGER,
    });

    expect(result).toBe(true);
  });
});
