import type * as ts from "typescript/lib/tsserverlibrary";

import {
  buildPathPatternRegex,
  resolveImportPathToAbsolute,
  tryResolveWithPathsMapping,
} from "../../src/utils/moduleResolution";

function createTsApi(
  resolveModuleNameResult: string | undefined,
): Pick<typeof ts, "resolveModuleName" | "sys"> {
  return {
    resolveModuleName: () => ({
      resolvedModule: resolveModuleNameResult
        ? ({ resolvedFileName: resolveModuleNameResult } as ts.ResolvedModule)
        : undefined,
    }),
    sys: {
      fileExists: () => false,
      readFile: () => undefined,
      directoryExists: () => false,
      getDirectories: () => [],
      realpath: (p: string) => p,
    },
  } as unknown as Pick<typeof ts, "resolveModuleName" | "sys">;
}

describe("moduleResolution utils", () => {
  test("buildPathPatternRegex supports wildcard captures", () => {
    const regex = buildPathPatternRegex("@/features/*/components/*");
    const match = "@/features/gallery/components/Card".match(regex);

    expect(match).not.toBeNull();
    expect(match?.[1]).toBe("gallery");
    expect(match?.[2]).toBe("Card");
  });

  test("tryResolveWithPathsMapping resolves aliased target", () => {
    const resolved = tryResolveWithPathsMapping({
      modulePath: "@/components/Button",
      compilerOptions: {
        paths: {
          "@/*": ["src/*"],
        },
      },
      projectBaseDir: "/repo",
    });

    expect(resolved).toBe("/repo/src/components/Button");
  });

  test("resolveImportPathToAbsolute resolves relative paths", () => {
    const resolved = resolveImportPathToAbsolute({
      tsApi: createTsApi(undefined),
      importPath: "./utils/file",
      currentFile: "/repo/src/views/Home.tsx",
      compilerOptions: {},
      currentDirectory: "/repo",
    });

    expect(resolved).toBe("/repo/src/views/utils/file");
  });

  test("resolveImportPathToAbsolute uses TypeScript resolution first", () => {
    const resolved = resolveImportPathToAbsolute({
      tsApi: createTsApi(
        "/repo/src/components\\gallery\\__private__\\Item.tsx",
      ),
      importPath: "@/components/gallery/__private__/Item",
      currentFile: "/repo/src/views/Home.tsx",
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@/*": ["src/*"],
        },
      },
      currentDirectory: "/repo",
    });

    expect(resolved).toBe("/repo/src/components/gallery/__private__/Item.tsx");
  });

  test("resolveImportPathToAbsolute falls back to paths mapping", () => {
    const resolved = resolveImportPathToAbsolute({
      tsApi: createTsApi(undefined),
      importPath: "@/components/gallery/__private__/Item",
      currentFile: "/repo/src/views/Home.tsx",
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@/*": ["src/*"],
        },
      },
      currentDirectory: "/repo",
    });

    expect(resolved).toBe("/repo/src/components/gallery/__private__/Item");
  });
});
