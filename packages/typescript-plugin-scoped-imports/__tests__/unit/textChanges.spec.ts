import type * as ts from "typescript/lib/tsserverlibrary";

import {
  containsPrivateImport,
  extractPrivateImportPaths,
  hasBlockedPrivateImports,
} from "../../src/utils/textChanges";

function fileChange(newText: string): ts.FileTextChanges {
  return {
    fileName: "/repo/src/views/Home.tsx",
    isNewFile: false,
    textChanges: [
      {
        span: { start: 0, length: 0 },
        newText,
      },
    ],
  };
}

describe("textChanges utils", () => {
  test("extractPrivateImportPaths collects private imports from changes", () => {
    const changes = [
      fileChange('import Item from "@/components/gallery/__private__/Item";'),
      fileChange('import Public from "@/components/public/Button";'),
    ];

    expect(extractPrivateImportPaths(changes)).toEqual([
      "@/components/gallery/__private__/Item",
    ]);
  });

  test("containsPrivateImport detects private marker in new text", () => {
    expect(
      containsPrivateImport([
        fileChange('import Item from "@/components/gallery/__private__/Item";'),
      ]),
    ).toBe(true);

    expect(
      containsPrivateImport([
        fileChange('import Public from "@/components/public/Button";'),
      ]),
    ).toBe(false);
  });

  test("hasBlockedPrivateImports delegates path-level allow check", () => {
    const changes = [
      fileChange('import Item from "@/components/gallery/__private__/Item";'),
    ];

    const allowNone = hasBlockedPrivateImports({
      changes,
      currentFile: "/repo/src/views/Home.tsx",
      isPrivateImportAllowed: () => false,
    });
    expect(allowNone).toBe(true);

    const allowAll = hasBlockedPrivateImports({
      changes,
      currentFile: "/repo/src/components/gallery/Parent.tsx",
      isPrivateImportAllowed: () => true,
    });
    expect(allowAll).toBe(false);
  });
});
