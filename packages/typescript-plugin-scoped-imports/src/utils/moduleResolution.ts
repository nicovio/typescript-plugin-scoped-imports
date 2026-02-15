import path from "node:path";
import type * as ts from "typescript/lib/tsserverlibrary";

import { normalizePath, toPosixAbsolute } from "./path";

type TsApiForResolution = Pick<typeof ts, "resolveModuleName" | "sys">;
type ResolveWithPathsMappingParams = {
  modulePath: string;
  compilerOptions: ts.CompilerOptions;
  projectBaseDir: string;
};
export type ResolveImportPathToAbsoluteParams = {
  tsApi: TsApiForResolution;
  importPath: string;
  currentFile: string;
  compilerOptions: ts.CompilerOptions;
  currentDirectory: string;
};

export function buildPathPatternRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const wildcardRegex = escaped.replace(/\*/g, "(.*)");
  return new RegExp(`^${wildcardRegex}$`);
}

export function getProjectBaseDir(
  currentDirectory: string,
  compilerOptions: ts.CompilerOptions,
): string {
  const baseDir = compilerOptions.baseUrl
    ? path.resolve(currentDirectory, compilerOptions.baseUrl)
    : currentDirectory;

  return toPosixAbsolute(baseDir);
}

export function tryResolveWithPathsMapping(
  params: ResolveWithPathsMappingParams,
): string | null {
  const { modulePath, compilerOptions, projectBaseDir } = params;
  const paths = compilerOptions.paths;
  if (!paths) {
    return null;
  }

  for (const [pattern, targets] of Object.entries(paths)) {
    const matcher = buildPathPatternRegex(pattern);
    const match = modulePath.match(matcher);
    if (!match) {
      continue;
    }

    const captures = match.slice(1);

    for (const target of targets) {
      let captureIndex = 0;
      const replaced = target.replace(/\*/g, () => {
        const value = captures[captureIndex] ?? "";
        captureIndex += 1;
        return value;
      });

      const absolute = path.isAbsolute(replaced)
        ? toPosixAbsolute(replaced)
        : toPosixAbsolute(path.join(projectBaseDir, replaced));

      return absolute;
    }
  }

  return null;
}

export function resolveImportPathToAbsolute(
  params: ResolveImportPathToAbsoluteParams,
): string | null {
  const { tsApi, importPath, currentFile, compilerOptions, currentDirectory } =
    params;
  const normalizedImportPath = normalizePath(importPath);
  const normalizedCurrentFile = normalizePath(currentFile);

  if (normalizedImportPath.startsWith(".")) {
    const currentDir = path.dirname(normalizedCurrentFile);
    return toPosixAbsolute(path.resolve(currentDir, normalizedImportPath));
  }

  if (normalizedImportPath.startsWith("/")) {
    return toPosixAbsolute(normalizedImportPath);
  }

  const host: ts.ModuleResolutionHost = {
    fileExists: tsApi.sys.fileExists,
    readFile: tsApi.sys.readFile,
    directoryExists: tsApi.sys.directoryExists,
    getDirectories: tsApi.sys.getDirectories,
    realpath: tsApi.sys.realpath,
  };

  const resolved = tsApi.resolveModuleName(
    normalizedImportPath,
    normalizedCurrentFile,
    compilerOptions,
    host,
  ).resolvedModule?.resolvedFileName;

  if (resolved) {
    return normalizePath(resolved);
  }

  const projectBaseDir = getProjectBaseDir(currentDirectory, compilerOptions);
  return tryResolveWithPathsMapping({
    modulePath: normalizedImportPath,
    compilerOptions,
    projectBaseDir,
  });
}
