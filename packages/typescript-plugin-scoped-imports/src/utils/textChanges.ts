import type * as ts from "typescript/lib/tsserverlibrary";

import { PRIVATE_FOLDER, PRIVATE_IMPORT_PATTERN } from "../constants";
export type HasBlockedPrivateImportsParams = {
  changes: readonly ts.FileTextChanges[];
  currentFile: string;
  isPrivateImportAllowed: (importPath: string, currentFile: string) => boolean;
};

export function extractPrivateImportPaths(
  changes: readonly ts.FileTextChanges[],
): string[] {
  const paths: string[] = [];
  const importPattern = new RegExp(
    PRIVATE_IMPORT_PATTERN.source,
    PRIVATE_IMPORT_PATTERN.flags,
  );

  for (const change of changes) {
    for (const textChange of change.textChanges || []) {
      const newText = textChange.newText;
      if (!newText) {
        continue;
      }

      importPattern.lastIndex = 0;
      let match: RegExpExecArray | null = importPattern.exec(newText);
      while (match !== null) {
        paths.push(match[1]);
        match = importPattern.exec(newText);
      }
    }
  }

  return paths;
}

export function containsPrivateImport(
  changes: readonly ts.FileTextChanges[],
): boolean {
  return changes.some((change) =>
    change.textChanges?.some((textChange) => {
      const newText = textChange.newText;
      return newText?.includes(PRIVATE_FOLDER) ?? false;
    }),
  );
}

export function hasBlockedPrivateImports(
  params: HasBlockedPrivateImportsParams,
): boolean {
  const { changes, currentFile, isPrivateImportAllowed } = params;
  const privatePaths = extractPrivateImportPaths(changes);
  return privatePaths.some(
    (importPath) => !isPrivateImportAllowed(importPath, currentFile),
  );
}
