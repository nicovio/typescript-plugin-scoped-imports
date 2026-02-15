import path from "node:path";

import {
  PRIVATE_FOLDER,
  PRIVATE_SEGMENT,
  PRIVATE_SEGMENT_START,
} from "../constants";
import { normalizePath, toDirectoryPath } from "./path";

type ResolveImportPath = (
  importPath: string,
  currentFile: string,
) => string | null;

type ScopeLogging = {
  logInfo: (message: string) => void;
  logDebug: (message: string) => void;
};
export type GetPrivateParentDirectoryParams = {
  importPath: string;
  currentFile: string;
  resolveImportPathToAbsolute: ResolveImportPath;
};
export type IsPrivateImportAllowedParams = {
  importPath: string;
  currentFile: string;
  resolveImportPathToAbsolute: ResolveImportPath;
  logging: ScopeLogging;
};

export function getPrivateParentDirectory(
  params: GetPrivateParentDirectoryParams,
): string | null {
  const { importPath, currentFile, resolveImportPathToAbsolute } = params;
  const resolvedImportPath = resolveImportPathToAbsolute(
    importPath,
    currentFile,
  );
  if (!resolvedImportPath) {
    return null;
  }

  const privateSegmentIndex = resolvedImportPath.indexOf(PRIVATE_SEGMENT_START);
  if (privateSegmentIndex === -1) {
    return null;
  }

  return toDirectoryPath(
    resolvedImportPath.substring(0, privateSegmentIndex + 1),
  );
}

export function isPrivateImportAllowed(
  params: IsPrivateImportAllowedParams,
): boolean {
  const { importPath, currentFile, resolveImportPathToAbsolute, logging } =
    params;
  const normalizedImportPath = normalizePath(importPath);
  const normalizedCurrentFile = normalizePath(currentFile);

  logging.logDebug(
    `[DEBUG isPrivateImportAllowed] importPath="${normalizedImportPath}" currentFile="${normalizedCurrentFile}"`,
  );

  if (!normalizedImportPath.includes(PRIVATE_FOLDER)) {
    return true;
  }

  if (normalizedCurrentFile.includes(PRIVATE_SEGMENT)) {
    logging.logInfo(
      `typescript-plugin-scoped-imports: ALLOWING (file inside ${PRIVATE_FOLDER}): ${normalizedCurrentFile}`,
    );
    return true;
  }

  const privateParentDir = getPrivateParentDirectory({
    importPath: normalizedImportPath,
    currentFile: normalizedCurrentFile,
    resolveImportPathToAbsolute,
  });

  if (!privateParentDir) {
    logging.logInfo(
      `typescript-plugin-scoped-imports: BLOCKING import (cannot resolve private parent): "${normalizedImportPath}" from "${normalizedCurrentFile}"`,
    );
    return false;
  }

  const currentFileDir = toDirectoryPath(path.dirname(normalizedCurrentFile));
  if (currentFileDir.startsWith(privateParentDir)) {
    logging.logInfo(
      `typescript-plugin-scoped-imports: ALLOWING import (in scope): "${normalizedImportPath}" from "${normalizedCurrentFile}"`,
    );
    return true;
  }

  logging.logInfo(
    `typescript-plugin-scoped-imports: BLOCKING import (out of scope): "${normalizedImportPath}" from "${normalizedCurrentFile}"`,
  );
  return false;
}
