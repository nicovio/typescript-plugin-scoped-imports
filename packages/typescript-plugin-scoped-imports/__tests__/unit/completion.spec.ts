import type * as ts from "typescript/lib/tsserverlibrary";

import {
  getImportPathAtPosition,
  isPathPrefixValidForPrivate,
  shouldAllowCompletionEntry,
} from "../../src/utils/completion";

function completionEntry(partial: Record<string, unknown>): ts.CompletionEntry {
  return {
    name: "Item",
    kind: "alias",
    kindModifiers: "",
    sortText: "0",
    ...partial,
  } as unknown as ts.CompletionEntry;
}

describe("completion utils", () => {
  test("getImportPathAtPosition reads path fragment being typed", () => {
    const fileName = "/repo/src/views/Home.tsx";
    const text = 'import X from "@/components/gallery/";\nexport const x = 1;';
    const position = text.indexOf('";');

    const languageService = {
      getProgram: () => ({
        getSourceFile: (currentFile: string) => {
          if (currentFile !== fileName) {
            return undefined;
          }

          return {
            getFullText: () => text,
          };
        },
      }),
    } as unknown as ts.LanguageService;

    expect(
      getImportPathAtPosition({
        languageService,
        fileName,
        position,
      }),
    ).toBe("@/components/gallery/");
  });

  test("blocks __private__ directory completion when typed path is out of scope", () => {
    const logs: string[] = [];

    const allowed = shouldAllowCompletionEntry({
      entry: completionEntry({ name: "__private__", kind: "directory" }),
      typedPath: "@/components/utils/",
      fileName: "/repo/src/views/Home.tsx",
      blockedNames: new Set<string>(),
      isPrivateImportAllowed: () => false,
      logInfo: (message) => {
        logs.push(message);
      },
    });

    expect(allowed).toBe(false);
    expect(
      logs.some((message) =>
        message.includes("BLOCKING __private__ directory (invalid path"),
      ),
    ).toBe(true);
  });

  test("builds candidate path using directory entry name", () => {
    const calls: string[] = [];

    const result = isPathPrefixValidForPrivate({
      pathPrefix: "@/components/gallery",
      directoryName: "__private__custom",
      currentFile: "/repo/src/views/Home.tsx",
      isPrivateImportAllowed: (importPath) => {
        calls.push(importPath);
        return true;
      },
    });

    expect(result).toBe(true);
    expect(calls).toEqual(["@/components/gallery/__private__custom"]);
  });

  test("does not treat similarly named directories as canonical __private__", () => {
    const isPrivateImportAllowed = jest.fn(() => true);

    const allowed = shouldAllowCompletionEntry({
      entry: completionEntry({ name: "__private__backup", kind: "directory" }),
      typedPath: "@/components/gallery/",
      fileName: "/repo/src/components/gallery/Parent.tsx",
      blockedNames: new Set<string>(),
      isPrivateImportAllowed,
      logInfo: () => {},
    });

    expect(allowed).toBe(false);
    expect(isPrivateImportAllowed).not.toHaveBeenCalled();
  });

  test("allows __private__ directory completion when typed path is in scope", () => {
    const allowed = shouldAllowCompletionEntry({
      entry: completionEntry({ name: "__private__", kind: "directory" }),
      typedPath: "@/components/gallery/",
      fileName: "/repo/src/components/gallery/Parent.tsx",
      blockedNames: new Set<string>(),
      isPrivateImportAllowed: () => true,
      logInfo: () => {},
    });

    expect(allowed).toBe(true);
  });

  test("blocks private source completion when source is out of scope", () => {
    const allowed = shouldAllowCompletionEntry({
      entry: completionEntry({
        name: "Item",
        source: "@/components/gallery/__private__/Item",
      }),
      typedPath: null,
      fileName: "/repo/src/views/Home.tsx",
      blockedNames: new Set<string>(),
      isPrivateImportAllowed: () => false,
      logInfo: () => {},
    });

    expect(allowed).toBe(false);
  });

  test("blocks entry without source when private marker appears in sourceDisplay", () => {
    const allowed = shouldAllowCompletionEntry({
      entry: completionEntry({
        name: "Item",
        sourceDisplay: [
          {
            text: "@/components/gallery/__private__/Item",
            kind: "text",
          },
        ],
      }),
      typedPath: null,
      fileName: "/repo/src/views/Home.tsx",
      blockedNames: new Set<string>(),
      isPrivateImportAllowed: () => false,
      logInfo: () => {},
    });

    expect(allowed).toBe(false);
  });

  test("allows non-private completion entries", () => {
    const allowed = shouldAllowCompletionEntry({
      entry: completionEntry({
        name: "Button",
        source: "@/components/public/Button",
      }),
      typedPath: null,
      fileName: "/repo/src/views/Home.tsx",
      blockedNames: new Set<string>(),
      isPrivateImportAllowed: () => false,
      logInfo: () => {},
    });

    expect(allowed).toBe(true);
  });
});
