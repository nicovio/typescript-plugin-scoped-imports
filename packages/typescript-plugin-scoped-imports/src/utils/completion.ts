import type * as ts from "typescript/lib/tsserverlibrary";

import { PRIVATE_FOLDER } from "../constants";
import { normalizePath } from "./path";
export type GetImportPathAtPositionParams = {
  languageService: ts.LanguageService;
  fileName: string;
  position: number;
};
export type IsPathPrefixValidForPrivateParams = {
  pathPrefix: string;
  currentFile: string;
  isPrivateImportAllowed: (importPath: string, currentFile: string) => boolean;
};

export function getImportPathAtPosition(
  params: GetImportPathAtPositionParams,
): string | null {
  const { languageService, fileName, position } = params;
  try {
    const program = languageService.getProgram();
    if (!program) {
      return null;
    }

    const sourceFile = program.getSourceFile(fileName);
    if (!sourceFile) {
      return null;
    }

    const text = sourceFile.getFullText();

    let start = position - 1;
    while (start >= 0 && text[start] !== '"' && text[start] !== "'") {
      start -= 1;
    }

    if (start < 0) {
      return null;
    }

    return text.substring(start + 1, position);
  } catch {
    return null;
  }
}

export function isPathPrefixValidForPrivate(
  params: IsPathPrefixValidForPrivateParams,
): boolean {
  const { pathPrefix, currentFile, isPrivateImportAllowed } = params;
  const normalizedPath = normalizePath(pathPrefix);
  if (!normalizedPath) {
    return false;
  }

  let basePath = normalizedPath;
  if (basePath === ".") {
    basePath = "./";
  } else if (basePath === "..") {
    basePath = "../";
  }

  if (!basePath.endsWith("/")) {
    basePath += "/";
  }

  const candidateImportPath = `${basePath}${PRIVATE_FOLDER}`;
  return isPrivateImportAllowed(candidateImportPath, currentFile);
}

export type CompletionDecisionOptions = {
  entry: ts.CompletionEntry;
  typedPath: string | null;
  fileName: string;
  blockedNames: ReadonlySet<string>;
  isPrivateImportAllowed: (importPath: string, currentFile: string) => boolean;
  logInfo: (message: string) => void;
};

export function shouldAllowCompletionEntry({
  entry,
  typedPath,
  fileName,
  blockedNames,
  isPrivateImportAllowed,
  logInfo,
}: CompletionDecisionOptions): boolean {
  if (entry.name?.toLowerCase().includes(PRIVATE_FOLDER)) {
    if (entry.source) {
      return isPrivateImportAllowed(entry.source, fileName);
    }

    if (entry.kind === "directory") {
      if (
        typedPath !== null &&
        isPathPrefixValidForPrivate({
          pathPrefix: typedPath,
          currentFile: fileName,
          isPrivateImportAllowed,
        })
      ) {
        logInfo(
          `typescript-plugin-scoped-imports: ALLOWING ${PRIVATE_FOLDER} directory (valid path: "${typedPath}")`,
        );
        return true;
      }

      logInfo(
        `typescript-plugin-scoped-imports: BLOCKING ${PRIVATE_FOLDER} directory (invalid path: "${typedPath}")`,
      );
      return false;
    }

    logInfo(
      `typescript-plugin-scoped-imports: BLOCKING entry by name (no source): ${entry.name}`,
    );
    return false;
  }

  if (entry.kind === "directory" && blockedNames.has(entry.name)) {
    logInfo(
      `typescript-plugin-scoped-imports: BLOCKING directory: ${entry.name}`,
    );
    return false;
  }

  if (!entry.source) {
    const sourceDisplayText =
      entry.sourceDisplay?.map((p) => p.text).join("") || "";
    const entryText = (
      entry.name +
      (entry.insertText || "") +
      sourceDisplayText +
      JSON.stringify(entry.data || {})
    ).toLowerCase();

    if (entryText.includes(PRIVATE_FOLDER)) {
      if (sourceDisplayText.includes(PRIVATE_FOLDER)) {
        return isPrivateImportAllowed(sourceDisplayText, fileName);
      }

      logInfo(
        `typescript-plugin-scoped-imports: BLOCKING entry without source: ${entry.name} (${entryText})`,
      );
      return false;
    }

    return true;
  }

  if (entry.source.includes(PRIVATE_FOLDER)) {
    return isPrivateImportAllowed(entry.source, fileName);
  }

  return true;
}
