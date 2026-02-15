import type * as ts from "typescript/lib/tsserverlibrary";

import { PRIVATE_FOLDER } from "./constants";
import {
  getImportPathAtPosition,
  shouldAllowCompletionEntry,
} from "./utils/completion";
import { type PluginConfig, createPluginLogger } from "./utils/logging";
import { resolveImportPathToAbsolute } from "./utils/moduleResolution";
import { isPrivateImportAllowed } from "./utils/privateScope";
import {
  containsPrivateImport,
  hasBlockedPrivateImports,
} from "./utils/textChanges";

type ShouldAllowChangesParams = {
  changes: readonly ts.FileTextChanges[];
  currentFile: string;
  blockedLogMessage: string;
};

function init(modules: { typescript: typeof ts }): ts.server.PluginModule {
  function create(info: ts.server.PluginCreateInfo) {
    const config = (info.config ?? {}) as PluginConfig;
    const { logInfo, logDebug } = createPluginLogger(
      info.project.projectService.logger,
      config,
    );

    logInfo("===================================");
    logInfo("PLUGIN LOADING: typescript-plugin-scoped-imports");
    logInfo("===================================");

    try {
      logInfo(
        `typescript-plugin-scoped-imports: Config loaded - ${JSON.stringify(config)}`,
      );

      const tsApi = modules.typescript;
      const oldLS = info.languageService;

      function getCompilerOptions(): ts.CompilerOptions {
        const programOptions = oldLS.getProgram()?.getCompilerOptions();
        if (programOptions) {
          return programOptions;
        }

        return info.project.getCompilerOptions();
      }

      const resolveImportPath = (
        importPath: string,
        currentFile: string,
      ): string | null => {
        return resolveImportPathToAbsolute({
          tsApi,
          importPath,
          currentFile,
          compilerOptions: getCompilerOptions(),
          currentDirectory: info.project.getCurrentDirectory(),
        });
      };

      const isPrivateImportAllowedForFile = (
        importPath: string,
        currentFile: string,
      ): boolean => {
        return isPrivateImportAllowed({
          importPath,
          currentFile,
          resolveImportPathToAbsolute: resolveImportPath,
          logging: {
            logInfo,
            logDebug,
          },
        });
      };

      function shouldAllowChanges(params: ShouldAllowChangesParams): boolean {
        const { changes, currentFile, blockedLogMessage } = params;
        if (!containsPrivateImport(changes)) {
          return true;
        }

        if (
          hasBlockedPrivateImports({
            changes,
            currentFile,
            isPrivateImportAllowed: isPrivateImportAllowedForFile,
          })
        ) {
          logInfo(blockedLogMessage);
          return false;
        }

        return true;
      }

      const proxy = Object.create(null) as ts.LanguageService;
      const proxyObject = proxy as unknown as Record<string, unknown>;

      for (const key in oldLS) {
        const serviceKey = key as keyof ts.LanguageService;
        const serviceMember = oldLS[serviceKey];
        if (typeof serviceMember === "function") {
          proxyObject[key] = (...args: unknown[]) =>
            (serviceMember as (...args: unknown[]) => unknown).apply(
              oldLS,
              args,
            );
        } else {
          proxyObject[key] = serviceMember;
        }
      }

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

        logDebug(
          `[DEBUG getCompletionsAtPosition] fileName="${fileName}" entries=${prior.entries.length.toString()}`,
        );

        const typedPath = getImportPathAtPosition({
          languageService: oldLS,
          fileName,
          position,
        });
        logDebug(`[DEBUG] typedPath="${typedPath}"`);

        for (const entry of prior.entries) {
          if (
            entry.name?.includes(PRIVATE_FOLDER) ||
            entry.source?.includes(PRIVATE_FOLDER) ||
            entry.sourceDisplay?.some((part) =>
              part.text.includes(PRIVATE_FOLDER),
            )
          ) {
            logDebug(
              `[DEBUG entry] name="${entry.name}" source="${entry.source}" kind="${entry.kind}" sourceDisplay="${entry.sourceDisplay?.map((part) => part.text).join("")}"`,
            );
          }
        }

        const blockedNames = new Set<string>();
        for (const entry of prior.entries) {
          const source = entry.source;
          if (
            source?.includes(PRIVATE_FOLDER) &&
            !isPrivateImportAllowedForFile(source, fileName)
          ) {
            blockedNames.add(entry.name);
          }
        }

        const filteredEntries = prior.entries.filter((entry) =>
          shouldAllowCompletionEntry({
            entry,
            typedPath,
            fileName,
            blockedNames,
            isPrivateImportAllowed: isPrivateImportAllowedForFile,
            logInfo,
          }),
        );

        if (prior.entries.length !== filteredEntries.length) {
          logInfo(
            `typescript-plugin-scoped-imports: Filtered ${(prior.entries.length - filteredEntries.length).toString()} completions (${prior.entries.length.toString()} -> ${filteredEntries.length.toString()})`,
          );
        }

        return {
          ...prior,
          entries: filteredEntries,
        };
      };

      proxy.getCompletionEntryDetails = (
        fileName: string,
        position: number,
        entryName: string,
        formatOptions: ts.FormatCodeOptions | ts.FormatCodeSettings | undefined,
        source: string | undefined,
        preferences: ts.UserPreferences | undefined,
        data: ts.CompletionEntryData | undefined,
      ): ts.CompletionEntryDetails | undefined => {
        if (
          source?.includes(PRIVATE_FOLDER) &&
          !isPrivateImportAllowedForFile(source, fileName)
        ) {
          logInfo(
            `typescript-plugin-scoped-imports: BLOCKING completion details for source: ${source}`,
          );
          return undefined;
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

        const filteredFixes = fixes.filter((fix) =>
          shouldAllowChanges({
            changes: fix.changes,
            currentFile: fileName,
            blockedLogMessage: `typescript-plugin-scoped-imports: BLOCKING code fix "${fix.fixName}"`,
          }),
        );

        if (fixes.length !== filteredFixes.length) {
          logInfo(
            `typescript-plugin-scoped-imports: Filtered ${(fixes.length - filteredFixes.length).toString()} code fixes`,
          );
        }

        return filteredFixes;
      };

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

        const filteredChanges = result.changes.filter((change) =>
          shouldAllowChanges({
            changes: [change],
            currentFile: scope.fileName,
            blockedLogMessage:
              "typescript-plugin-scoped-imports: BLOCKING combined fix change",
          }),
        );

        if (result.changes.length !== filteredChanges.length) {
          logInfo(
            `typescript-plugin-scoped-imports: Filtered ${(result.changes.length - filteredChanges.length).toString()} combined fix changes`,
          );
        }

        return {
          ...result,
          changes: filteredChanges,
        };
      };

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

        const filteredEdits = result.edits.filter((edit) =>
          shouldAllowChanges({
            changes: [edit],
            currentFile: fileName,
            blockedLogMessage:
              "typescript-plugin-scoped-imports: BLOCKING refactor edit",
          }),
        );

        if (result.edits.length !== filteredEdits.length) {
          logInfo(
            `typescript-plugin-scoped-imports: Filtered ${(result.edits.length - filteredEdits.length).toString()} refactor edits`,
          );
        }

        return {
          ...result,
          edits: filteredEdits,
        };
      };

      logInfo(
        "typescript-plugin-scoped-imports: Plugin proxy created successfully",
      );
      logInfo("===================================");

      return proxy;
    } catch (error) {
      logInfo(
        `typescript-plugin-scoped-imports: ERROR loading plugin: ${error}`,
      );
      logInfo("===================================");
      throw error;
    }
  }

  return { create };
}

export = init;
