import path from "node:path";
import type * as ts from "typescript/lib/tsserverlibrary";

const PRIVATE_FOLDER = "__private__";
const PRIVATE_SEGMENT = `/${PRIVATE_FOLDER}/`;
const PRIVATE_SEGMENT_START = `/${PRIVATE_FOLDER}`;
const PRIVATE_FOLDER_REGEX = PRIVATE_FOLDER.replace(
  /[.*+?^${}()|[\]\\]/g,
  "\\$&",
);
const PRIVATE_IMPORT_PATTERN = new RegExp(
  `from\\s+["']([^"']*${PRIVATE_FOLDER_REGEX}[^"']*)["']`,
  "g",
);

function init(modules: { typescript: typeof ts }): ts.server.PluginModule {
  function create(info: ts.server.PluginCreateInfo) {
    info.project.projectService.logger.info(
      "===================================",
    );
    info.project.projectService.logger.info(
      "PLUGIN LOADING: typescript-plugin-scoped-imports",
    );
    info.project.projectService.logger.info(
      "===================================",
    );

    try {
      const config = info.config || {};

      info.project.projectService.logger.info(
        `typescript-plugin-scoped-imports: Config loaded - ${JSON.stringify(config)}`,
      );

      const tsApi = modules.typescript;

      function normalizePath(value: string): string {
        return value.replace(/\\/g, "/");
      }

      function toDirectoryPath(value: string): string {
        return value.endsWith("/") ? value : `${value}/`;
      }

      function toPosixAbsolute(value: string): string {
        return normalizePath(path.resolve(value));
      }

      function getCompilerOptions(): ts.CompilerOptions {
        const programOptions = oldLS.getProgram()?.getCompilerOptions();
        if (programOptions) {
          return programOptions;
        }
        return info.project.getCompilerOptions();
      }

      function getProjectBaseDir(compilerOptions: ts.CompilerOptions): string {
        const baseDir = compilerOptions.baseUrl
          ? path.resolve(
              info.project.getCurrentDirectory(),
              compilerOptions.baseUrl,
            )
          : info.project.getCurrentDirectory();
        return toPosixAbsolute(baseDir);
      }

      function buildPathPatternRegex(pattern: string): RegExp {
        const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
        const wildcardRegex = escaped.replace(/\*/g, "(.*)");
        return new RegExp(`^${wildcardRegex}$`);
      }

      function tryResolveWithPathsMapping(
        modulePath: string,
        compilerOptions: ts.CompilerOptions,
      ): string | null {
        const paths = compilerOptions.paths;
        if (!paths) {
          return null;
        }

        const baseDir = getProjectBaseDir(compilerOptions);

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
              : toPosixAbsolute(path.join(baseDir, replaced));
            return absolute;
          }
        }

        return null;
      }

      function resolveImportPathToAbsolute(
        importPath: string,
        currentFile: string,
      ): string | null {
        const normalizedImportPath = normalizePath(importPath);
        const normalizedCurrentFile = normalizePath(currentFile);

        if (normalizedImportPath.startsWith(".")) {
          const currentDir = path.dirname(normalizedCurrentFile);
          return toPosixAbsolute(
            path.resolve(currentDir, normalizedImportPath),
          );
        }

        if (normalizedImportPath.startsWith("/")) {
          return toPosixAbsolute(normalizedImportPath);
        }

        const compilerOptions = getCompilerOptions();
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

        return tryResolveWithPathsMapping(
          normalizedImportPath,
          compilerOptions,
        );
      }

      function getPrivateParentDirectory(
        importPath: string,
        currentFile: string,
      ): string | null {
        const resolvedImportPath = resolveImportPathToAbsolute(
          importPath,
          currentFile,
        );
        if (!resolvedImportPath) {
          return null;
        }

        const privateSegmentIndex = resolvedImportPath.indexOf(
          PRIVATE_SEGMENT_START,
        );
        if (privateSegmentIndex === -1) {
          return null;
        }

        return toDirectoryPath(
          resolvedImportPath.substring(0, privateSegmentIndex + 1),
        );
      }

      // Helper: Check if a file can access a __private__ folder
      // Rule: A file can access __private__ only if it's in the "scope" of that __private__ folder
      // The scope is: the parent directory of __private__ and all its subdirectories
      function isPrivateImportAllowed(
        importPath: string,
        currentFile: string,
      ): boolean {
        const normalizedImportPath = normalizePath(importPath);
        const normalizedCurrentFile = normalizePath(currentFile);

        // DEBUG: Log all calls to understand what TypeScript sends
        info.project.projectService.logger.info(
          `[DEBUG isPrivateImportAllowed] importPath="${normalizedImportPath}" currentFile="${normalizedCurrentFile}"`,
        );

        // If import doesn't contain __private__, allow
        if (!normalizedImportPath.includes(PRIVATE_FOLDER)) {
          return true;
        }

        // Case 1: Current file is inside __private__ - allow all
        if (normalizedCurrentFile.includes(PRIVATE_SEGMENT)) {
          info.project.projectService.logger.info(
            `typescript-plugin-scoped-imports: ALLOWING (file inside ${PRIVATE_FOLDER}): ${normalizedCurrentFile}`,
          );
          return true;
        }

        const privateParentDir = getPrivateParentDirectory(
          normalizedImportPath,
          normalizedCurrentFile,
        );
        if (!privateParentDir) {
          info.project.projectService.logger.info(
            `typescript-plugin-scoped-imports: BLOCKING import (cannot resolve private parent): "${normalizedImportPath}" from "${normalizedCurrentFile}"`,
          );
          return false;
        }

        const currentFileDir = toDirectoryPath(
          path.dirname(normalizedCurrentFile),
        );
        if (currentFileDir.startsWith(privateParentDir)) {
          info.project.projectService.logger.info(
            `typescript-plugin-scoped-imports: ALLOWING import (in scope): "${normalizedImportPath}" from "${normalizedCurrentFile}"`,
          );
          return true;
        }

        info.project.projectService.logger.info(
          `typescript-plugin-scoped-imports: BLOCKING import (out of scope): "${normalizedImportPath}" from "${normalizedCurrentFile}"`,
        );
        return false;
      }

      // Helper: Extract import paths containing __private__ from text changes
      function extractPrivateImportPaths(
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
            if (!newText) continue;

            // Reset regex state
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

      // Helper: Check if changes contain blocked private imports for a given file
      function hasBlockedPrivateImports(
        changes: readonly ts.FileTextChanges[],
        currentFile: string,
      ): boolean {
        const privatePaths = extractPrivateImportPaths(changes);
        return privatePaths.some(
          (path) => !isPrivateImportAllowed(path, currentFile),
        );
      }

      // Helper: Simple check if changes contain any __private__ import
      function containsPrivateImport(
        changes: readonly ts.FileTextChanges[],
      ): boolean {
        return changes.some((change) =>
          change.textChanges?.some((textChange) => {
            const newText = textChange.newText;
            return newText?.includes(PRIVATE_FOLDER) ?? false;
          }),
        );
      }

      // Create language service proxy
      const proxy = Object.create(null) as ts.LanguageService;
      const proxyObject = proxy as unknown as Record<string, unknown>;
      const oldLS = info.languageService;

      // Copy all methods from original LS
      for (const k in oldLS) {
        const key = k as keyof ts.LanguageService;
        const x = oldLS[key];
        if (typeof x === "function") {
          proxyObject[k] = (...args: unknown[]) =>
            (x as (...args: unknown[]) => unknown).apply(oldLS, args);
        } else {
          proxyObject[k] = x;
        }
      }

      // Helper: Extract the import path being typed at the given position
      function getImportPathAtPosition(
        fileName: string,
        position: number,
      ): string | null {
        try {
          const program = oldLS.getProgram();
          if (!program) return null;

          const sourceFile = program.getSourceFile(fileName);
          if (!sourceFile) return null;

          const text = sourceFile.getFullText();

          // Find the string literal containing the position
          // Look backwards from position to find the opening quote
          let start = position - 1;
          while (start >= 0 && text[start] !== '"' && text[start] !== "'") {
            start--;
          }

          if (start < 0) return null;

          const quote = text[start];
          // Extract the path from after the quote to the position
          const path = text.substring(start + 1, position);

          return path;
        } catch {
          return null;
        }
      }

      // Helper: Check if a typed path prefix allows access to __private__
      function isPathPrefixValidForPrivate(
        pathPrefix: string,
        currentFile: string,
      ): boolean {
        const normalizedPath = pathPrefix.replace(/\\/g, "/");
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

      // Intercept getCompletionsAtPosition
      proxy.getCompletionsAtPosition = (
        fileName: string,
        position: number,
        options: ts.GetCompletionsAtPositionOptions | undefined,
      ) => {
        const prior = oldLS.getCompletionsAtPosition(
          fileName,
          position,
          options,
        );

        if (!prior) {
          return prior;
        }

        info.project.projectService.logger.info(
          `[DEBUG getCompletionsAtPosition] fileName="${fileName}" entries=${prior.entries.length}`,
        );

        const originalCount = prior.entries.length;

        // Get the path being typed (for directory completion validation)
        const typedPath = getImportPathAtPosition(fileName, position);
        info.project.projectService.logger.info(
          `[DEBUG] typedPath="${typedPath}"`,
        );

        // Log entries that contain __private__ for debugging
        for (const entry of prior.entries) {
          if (
            entry.name?.includes(PRIVATE_FOLDER) ||
            entry.source?.includes(PRIVATE_FOLDER) ||
            entry.sourceDisplay?.some((p) => p.text.includes(PRIVATE_FOLDER))
          ) {
            info.project.projectService.logger.info(
              `[DEBUG entry] name="${entry.name}" source="${entry.source}" kind="${entry.kind}" sourceDisplay="${entry.sourceDisplay?.map((p) => p.text).join("")}"`,
            );
          }
        }

        // Find blocked names (from __private__ sources that are not allowed)
        const blockedNames = new Set<string>();
        for (const entry of prior.entries) {
          const source = entry.source;
          if (source?.includes(PRIVATE_FOLDER)) {
            if (!isPrivateImportAllowed(source, fileName)) {
              blockedNames.add(entry.name);
            }
          }
        }

        // Filter entries
        const filteredEntries = prior.entries.filter((entry) => {
          // Handle entries with __private__ in the name (usually directory suggestions)
          if (entry.name?.toLowerCase().includes(PRIVATE_FOLDER)) {
            // If there's a source, use isPrivateImportAllowed
            if (entry.source) {
              return isPrivateImportAllowed(entry.source, fileName);
            }
            // No source - this is a directory suggestion in path completion
            if (entry.kind === "directory") {
              // Check if the typed path allows access to __private__
              if (
                typedPath !== null &&
                isPathPrefixValidForPrivate(typedPath, fileName)
              ) {
                info.project.projectService.logger.info(
                  `typescript-plugin-scoped-imports: ALLOWING ${PRIVATE_FOLDER} directory (valid path: "${typedPath}")`,
                );
                return true;
              }
              info.project.projectService.logger.info(
                `typescript-plugin-scoped-imports: BLOCKING ${PRIVATE_FOLDER} directory (invalid path: "${typedPath}")`,
              );
              return false;
            }
            // For other kinds without source, block
            info.project.projectService.logger.info(
              `typescript-plugin-scoped-imports: BLOCKING entry by name (no source): ${entry.name}`,
            );
            return false;
          }

          // Block directories that match blocked import sources
          if (entry.kind === "directory" && blockedNames.has(entry.name)) {
            info.project.projectService.logger.info(
              `typescript-plugin-scoped-imports: BLOCKING directory: ${entry.name}`,
            );
            return false;
          }

          // If no source, check other fields for __private__
          if (!entry.source) {
            const entryText = (
              entry.name +
              (entry.insertText || "") +
              (entry.sourceDisplay?.map((p) => p.text).join("") || "") +
              JSON.stringify(entry.data || {})
            ).toLowerCase();

            if (entryText.includes(PRIVATE_FOLDER)) {
              // Try to extract a path from sourceDisplay to validate
              const sourceDisplayText =
                entry.sourceDisplay?.map((p) => p.text).join("") || "";
              if (sourceDisplayText.includes(PRIVATE_FOLDER)) {
                // Use sourceDisplay as the import path for validation
                return isPrivateImportAllowed(sourceDisplayText, fileName);
              }
              // Can't determine scope, block to be safe
              info.project.projectService.logger.info(
                `typescript-plugin-scoped-imports: BLOCKING entry without source: ${entry.name} (${entryText})`,
              );
              return false;
            }
            return true;
          }

          // Check source path
          const source = entry.source;
          if (source?.includes(PRIVATE_FOLDER)) {
            return isPrivateImportAllowed(source, fileName);
          }

          return true;
        });

        const filteredCount = filteredEntries.length;
        if (originalCount !== filteredCount) {
          info.project.projectService.logger.info(
            `typescript-plugin-scoped-imports: Filtered ${originalCount - filteredCount} completions (${originalCount} -> ${filteredCount})`,
          );
        }

        return {
          ...prior,
          entries: filteredEntries,
        };
      };

      // Intercept getCompletionEntryDetails
      proxy.getCompletionEntryDetails = (
        fileName: string,
        position: number,
        entryName: string,
        formatOptions: ts.FormatCodeOptions | ts.FormatCodeSettings | undefined,
        source: string | undefined,
        preferences: ts.UserPreferences | undefined,
        data: ts.CompletionEntryData | undefined,
      ): ts.CompletionEntryDetails | undefined => {
        if (source?.includes(PRIVATE_FOLDER)) {
          if (!isPrivateImportAllowed(source, fileName)) {
            info.project.projectService.logger.info(
              `typescript-plugin-scoped-imports: BLOCKING completion details for source: ${source}`,
            );
            return undefined;
          }
        }

        return oldLS.getCompletionEntryDetails(
          fileName,
          position,
          entryName,
          formatOptions,
          source,
          preferences,
          data,
        );
      };

      // Intercept getCodeFixesAtPosition
      proxy.getCodeFixesAtPosition = (
        fileName: string,
        start: number,
        end: number,
        errorCodes: readonly number[],
        formatOptions: ts.FormatCodeSettings,
        preferences: ts.UserPreferences,
      ): readonly ts.CodeFixAction[] => {
        const fixes = oldLS.getCodeFixesAtPosition(
          fileName,
          start,
          end,
          errorCodes,
          formatOptions,
          preferences,
        );

        const filteredFixes = fixes.filter((fix) => {
          if (containsPrivateImport(fix.changes)) {
            if (hasBlockedPrivateImports(fix.changes, fileName)) {
              info.project.projectService.logger.info(
                `typescript-plugin-scoped-imports: BLOCKING code fix "${fix.fixName}"`,
              );
              return false;
            }
          }
          return true;
        });

        if (fixes.length !== filteredFixes.length) {
          info.project.projectService.logger.info(
            `typescript-plugin-scoped-imports: Filtered ${fixes.length - filteredFixes.length} code fixes`,
          );
        }

        return filteredFixes;
      };

      // Intercept getCombinedCodeFix
      proxy.getCombinedCodeFix = (
        scope: ts.CombinedCodeFixScope,
        fixId: unknown,
        formatOptions: ts.FormatCodeSettings,
        preferences: ts.UserPreferences,
      ): ts.CombinedCodeActions => {
        const getCombinedCodeFix = oldLS.getCombinedCodeFix as (
          scope: ts.CombinedCodeFixScope,
          fixId: unknown,
          formatOptions: ts.FormatCodeSettings,
          preferences: ts.UserPreferences,
        ) => ts.CombinedCodeActions;
        const result = getCombinedCodeFix(
          scope,
          fixId,
          formatOptions,
          preferences,
        );
        const fileName = scope.fileName;

        const filteredChanges = result.changes.filter((change) => {
          if (containsPrivateImport([change])) {
            if (hasBlockedPrivateImports([change], fileName)) {
              info.project.projectService.logger.info(
                "typescript-plugin-scoped-imports: BLOCKING combined fix change",
              );
              return false;
            }
          }
          return true;
        });

        if (result.changes.length !== filteredChanges.length) {
          info.project.projectService.logger.info(
            `typescript-plugin-scoped-imports: Filtered ${result.changes.length - filteredChanges.length} combined fix changes`,
          );
        }

        return {
          ...result,
          changes: filteredChanges,
        };
      };

      // Intercept getEditsForRefactor
      proxy.getEditsForRefactor = (
        fileName: string,
        formatOptions: ts.FormatCodeSettings,
        positionOrRange: number | ts.TextRange,
        refactorName: string,
        actionName: string,
        preferences: ts.UserPreferences | undefined,
        interactiveRefactorArguments?: ts.InteractiveRefactorArguments,
      ): ts.RefactorEditInfo | undefined => {
        const result = oldLS.getEditsForRefactor(
          fileName,
          formatOptions,
          positionOrRange,
          refactorName,
          actionName,
          preferences,
          interactiveRefactorArguments,
        );

        if (!result) {
          return result;
        }

        const filteredEdits = result.edits.filter((edit) => {
          if (containsPrivateImport([edit])) {
            if (hasBlockedPrivateImports([edit], fileName)) {
              info.project.projectService.logger.info(
                "typescript-plugin-scoped-imports: BLOCKING refactor edit",
              );
              return false;
            }
          }
          return true;
        });

        if (result.edits.length !== filteredEdits.length) {
          info.project.projectService.logger.info(
            `typescript-plugin-scoped-imports: Filtered ${result.edits.length - filteredEdits.length} refactor edits`,
          );
        }

        return {
          ...result,
          edits: filteredEdits,
        };
      };

      info.project.projectService.logger.info(
        "typescript-plugin-scoped-imports: Plugin proxy created successfully",
      );
      info.project.projectService.logger.info(
        "===================================",
      );

      return proxy;
    } catch (error) {
      info.project.projectService.logger.info(
        `typescript-plugin-scoped-imports: ERROR loading plugin: ${error}`,
      );
      info.project.projectService.logger.info(
        "===================================",
      );
      throw error;
    }
  }

  return { create };
}

export = init;
