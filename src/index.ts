import type * as ts from 'typescript/lib/tsserverlibrary'

function init(modules: { typescript: typeof ts }): ts.server.PluginModule {
  function create(info: ts.server.PluginCreateInfo) {
    info.project.projectService.logger.info('===================================')
    info.project.projectService.logger.info('PLUGIN LOADING: typescript-plugin-scoped-imports')
    info.project.projectService.logger.info('===================================')

    try {
      const config = info.config || {}

      info.project.projectService.logger.info(
        `typescript-plugin-scoped-imports: Config loaded - ${JSON.stringify(config)}`,
      )

      // Helper: Check if a file can access a __private__ folder
      // Rule: A file can access __private__ only if it's in the "scope" of that __private__ folder
      // The scope is: the parent directory of __private__ and all its subdirectories
      function isPrivateImportAllowed(importPath: string, currentFile: string): boolean {
        const normalizedImportPath = importPath.replace(/\\/g, '/')
        const normalizedCurrentFile = currentFile.replace(/\\/g, '/')

        // DEBUG: Log all calls to understand what TypeScript sends
        info.project.projectService.logger.info(
          `[DEBUG isPrivateImportAllowed] importPath="${normalizedImportPath}" currentFile="${normalizedCurrentFile}"`,
        )

        // If import doesn't contain __private__, allow
        if (!normalizedImportPath.includes('__private__')) {
          return true
        }

        // Case 1: Current file is inside __private__ - allow all
        if (normalizedCurrentFile.includes('/__private__/')) {
          info.project.projectService.logger.info(
            `typescript-plugin-scoped-imports: ALLOWING (file inside __private__): ${normalizedCurrentFile}`,
          )
          return true
        }

        // Case 2: Relative import ./__private__ - sibling access, always allowed
        if (normalizedImportPath.startsWith('./__private__')) {
          info.project.projectService.logger.info(
            `typescript-plugin-scoped-imports: ALLOWING ./__private__ import: ${normalizedImportPath}`,
          )
          return true
        }

        // Case 3: Relative import with only ../ before __private__
        // Valid: ../__private__, ../../__private__, etc.
        // Invalid: ../foo/__private__, ../../bar/__private__
        const relativePrivatePattern = /^(\.\.\/)+__private__(\/|$)/
        if (relativePrivatePattern.test(normalizedImportPath)) {
          info.project.projectService.logger.info(
            `typescript-plugin-scoped-imports: ALLOWING relative ../__private__ import: ${normalizedImportPath}`,
          )
          return true
        }

        // Case 4: Absolute filesystem path (starts with /)
        // Check if current file is inside the parent directory of __private__
        if (normalizedImportPath.startsWith('/')) {
          const privateIndex = normalizedImportPath.indexOf('/__private__')
          if (privateIndex !== -1) {
            // Get the parent directory of __private__ (the scope)
            const privateParentDir = normalizedImportPath.substring(0, privateIndex + 1)
            const currentFileDir = normalizedCurrentFile.substring(0, normalizedCurrentFile.lastIndexOf('/') + 1)

            if (currentFileDir.startsWith(privateParentDir)) {
              info.project.projectService.logger.info(
                `typescript-plugin-scoped-imports: ALLOWING absolute path (in scope): ${normalizedImportPath}`,
              )
              return true
            }
          }
          info.project.projectService.logger.info(
            `typescript-plugin-scoped-imports: BLOCKING absolute path (out of scope): "${normalizedImportPath}" from "${normalizedCurrentFile}"`,
          )
          return false
        }

        // Case 5: Alias or module path (doesn't start with . or /)
        // Use heuristic: find the folder containing __private__ and check if current file is in that folder
        const privateFolderMatch = normalizedImportPath.match(/([^/]+)\/__private__(\/|$)/)
        if (privateFolderMatch) {
          const parentFolderName = privateFolderMatch[1]
          const currentFileDir = normalizedCurrentFile.substring(0, normalizedCurrentFile.lastIndexOf('/'))

          // Check if current file is inside a folder with this name
          // Pattern: the current path should contain /{parentFolderName}/ and the current file should be inside it
          const folderPattern = `/${parentFolderName}/`
          const folderIndex = currentFileDir.indexOf(folderPattern)

          if (folderIndex !== -1) {
            info.project.projectService.logger.info(
              `typescript-plugin-scoped-imports: ALLOWING alias path (in scope "${parentFolderName}"): ${normalizedImportPath}`,
            )
            return true
          }

          // Also check if current file's immediate parent is the scope folder
          const pathParts = currentFileDir.split('/')
          const immediateParent = pathParts[pathParts.length - 1]
          if (immediateParent === parentFolderName) {
            info.project.projectService.logger.info(
              `typescript-plugin-scoped-imports: ALLOWING alias path (direct child of "${parentFolderName}"): ${normalizedImportPath}`,
            )
            return true
          }
        }

        // Block everything else
        info.project.projectService.logger.info(
          `typescript-plugin-scoped-imports: BLOCKING import: "${normalizedImportPath}" from "${normalizedCurrentFile}"`,
        )
        return false
      }

      // Helper: Extract import paths containing __private__ from text changes
      function extractPrivateImportPaths(changes: readonly ts.FileTextChanges[]): string[] {
        const paths: string[] = []
        const importPattern = /from\s+["']([^"']*__private__[^"']*)["']/g

        for (const change of changes) {
          for (const textChange of change.textChanges || []) {
            const newText = textChange.newText
            if (!newText) continue

            let match
            // Reset regex state
            importPattern.lastIndex = 0
            while ((match = importPattern.exec(newText)) !== null) {
              paths.push(match[1])
            }
          }
        }

        return paths
      }

      // Helper: Check if changes contain blocked private imports for a given file
      function hasBlockedPrivateImports(changes: readonly ts.FileTextChanges[], currentFile: string): boolean {
        const privatePaths = extractPrivateImportPaths(changes)
        return privatePaths.some((path) => !isPrivateImportAllowed(path, currentFile))
      }

      // Helper: Simple check if changes contain any __private__ import
      function containsPrivateImport(changes: readonly ts.FileTextChanges[]): boolean {
        return changes.some((change) =>
          change.textChanges?.some((textChange) => {
            const newText = textChange.newText
            return newText && newText.includes('__private__')
          }),
        )
      }

      // Create language service proxy
      const proxy: ts.LanguageService = Object.create(null)
      const oldLS = info.languageService

      // Copy all methods from original LS
      for (const k in oldLS) {
        const x = (oldLS as any)[k]
        proxy[k as keyof ts.LanguageService] = (...args: any[]) => x.apply(oldLS, args)
      }

      // Helper: Extract the import path being typed at the given position
      function getImportPathAtPosition(fileName: string, position: number): string | null {
        try {
          const program = oldLS.getProgram()
          if (!program) return null

          const sourceFile = program.getSourceFile(fileName)
          if (!sourceFile) return null

          const text = sourceFile.getFullText()

          // Find the string literal containing the position
          // Look backwards from position to find the opening quote
          let start = position - 1
          while (start >= 0 && text[start] !== '"' && text[start] !== "'") {
            start--
          }

          if (start < 0) return null

          const quote = text[start]
          // Extract the path from after the quote to the position
          const path = text.substring(start + 1, position)

          return path
        } catch {
          return null
        }
      }

      // Helper: Check if a relative path prefix allows access to __private__
      function isPathPrefixValidForPrivate(pathPrefix: string, currentFile: string): boolean {
        // Normalize
        const normalizedPath = pathPrefix.replace(/\\/g, '/')
        const normalizedFile = currentFile.replace(/\\/g, '/')

        // If path starts with ./ - user is in the parent directory of __private__, valid
        if (normalizedPath === '.' || normalizedPath === './') {
          return true
        }

        // If path is only ../ segments, user is in a subdirectory, valid
        // e.g., ../ or ../../ means going up to parent levels
        if (/^(\.\.\/)+$/.test(normalizedPath) || normalizedPath === '..') {
          return true
        }

        // If path goes outside and then into another directory, it's invalid
        // e.g., ../other/ or ../../foo/bar/
        // The pattern: starts with ../ and then has a non-.. directory
        if (/^(\.\.\/)+[^.]/.test(normalizedPath)) {
          // Going up and then into a different subtree - not valid for __private__
          return false
        }

        // Absolute paths or aliases - not valid for directory completion
        if (!normalizedPath.startsWith('.')) {
          return false
        }

        return false
      }

      // Intercept getCompletionsAtPosition
      proxy.getCompletionsAtPosition = (
        fileName: string,
        position: number,
        options: ts.GetCompletionsAtPositionOptions | undefined,
      ) => {
        const prior = oldLS.getCompletionsAtPosition(fileName, position, options)

        if (!prior) {
          return prior
        }

        info.project.projectService.logger.info(
          `[DEBUG getCompletionsAtPosition] fileName="${fileName}" entries=${prior.entries.length}`,
        )

        const originalCount = prior.entries.length

        // Get the path being typed (for directory completion validation)
        const typedPath = getImportPathAtPosition(fileName, position)
        info.project.projectService.logger.info(`[DEBUG] typedPath="${typedPath}"`)

        // Log entries that contain __private__ for debugging
        prior.entries.forEach((entry) => {
          if (
            entry.name?.includes('__private__') ||
            entry.source?.includes('__private__') ||
            entry.sourceDisplay?.some((p) => p.text.includes('__private__'))
          ) {
            info.project.projectService.logger.info(
              `[DEBUG entry] name="${entry.name}" source="${entry.source}" kind="${entry.kind}" sourceDisplay="${entry.sourceDisplay?.map((p) => p.text).join('')}"`,
            )
          }
        })

        // Find blocked names (from __private__ sources that are not allowed)
        const blockedNames = new Set<string>()
        prior.entries.forEach((entry) => {
          if (entry.source && entry.source.includes('__private__')) {
            if (!isPrivateImportAllowed(entry.source, fileName)) {
              blockedNames.add(entry.name)
            }
          }
        })

        // Filter entries
        const filteredEntries = prior.entries.filter((entry) => {
          // Handle entries with __private__ in the name (usually directory suggestions)
          if (entry.name && entry.name.toLowerCase().includes('__private__')) {
            // If there's a source, use isPrivateImportAllowed
            if (entry.source) {
              return isPrivateImportAllowed(entry.source, fileName)
            }
            // No source - this is a directory suggestion in path completion
            if (entry.kind === 'directory') {
              // Check if the typed path allows access to __private__
              if (typedPath !== null && isPathPrefixValidForPrivate(typedPath, fileName)) {
                info.project.projectService.logger.info(
                  `typescript-plugin-scoped-imports: ALLOWING __private__ directory (valid path: "${typedPath}")`,
                )
                return true
              }
              info.project.projectService.logger.info(
                `typescript-plugin-scoped-imports: BLOCKING __private__ directory (invalid path: "${typedPath}")`,
              )
              return false
            }
            // For other kinds without source, block
            info.project.projectService.logger.info(
              `typescript-plugin-scoped-imports: BLOCKING entry by name (no source): ${entry.name}`,
            )
            return false
          }

          // Block directories that match blocked import sources
          if (entry.kind === 'directory' && blockedNames.has(entry.name)) {
            info.project.projectService.logger.info(
              `typescript-plugin-scoped-imports: BLOCKING directory: ${entry.name}`,
            )
            return false
          }

          // If no source, check other fields for __private__
          if (!entry.source) {
            const entryText = (
              entry.name +
              (entry.insertText || '') +
              (entry.sourceDisplay?.map((p) => p.text).join('') || '') +
              JSON.stringify(entry.data || {})
            ).toLowerCase()

            if (entryText.includes('__private__')) {
              // Try to extract a path from sourceDisplay to validate
              const sourceDisplayText = entry.sourceDisplay?.map((p) => p.text).join('') || ''
              if (sourceDisplayText.includes('__private__')) {
                // Use sourceDisplay as the import path for validation
                return isPrivateImportAllowed(sourceDisplayText, fileName)
              }
              // Can't determine scope, block to be safe
              info.project.projectService.logger.info(
                `typescript-plugin-scoped-imports: BLOCKING entry without source: ${entry.name} (${entryText})`,
              )
              return false
            }
            return true
          }

          // Check source path
          if (entry.source.includes('__private__')) {
            return isPrivateImportAllowed(entry.source, fileName)
          }

          return true
        })

        const filteredCount = filteredEntries.length
        if (originalCount !== filteredCount) {
          info.project.projectService.logger.info(
            `typescript-plugin-scoped-imports: Filtered ${originalCount - filteredCount} completions (${originalCount} -> ${filteredCount})`,
          )
        }

        return {
          ...prior,
          entries: filteredEntries,
        }
      }

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
        if (source && source.includes('__private__')) {
          if (!isPrivateImportAllowed(source, fileName)) {
            info.project.projectService.logger.info(
              `typescript-plugin-scoped-imports: BLOCKING completion details for source: ${source}`,
            )
            return undefined
          }
        }

        return oldLS.getCompletionEntryDetails(fileName, position, entryName, formatOptions, source, preferences, data)
      }

      // Intercept getCodeFixesAtPosition
      proxy.getCodeFixesAtPosition = (
        fileName: string,
        start: number,
        end: number,
        errorCodes: readonly number[],
        formatOptions: ts.FormatCodeSettings,
        preferences: ts.UserPreferences,
      ): readonly ts.CodeFixAction[] => {
        const fixes = oldLS.getCodeFixesAtPosition(fileName, start, end, errorCodes, formatOptions, preferences)

        const filteredFixes = fixes.filter((fix) => {
          if (containsPrivateImport(fix.changes)) {
            if (hasBlockedPrivateImports(fix.changes, fileName)) {
              info.project.projectService.logger.info(
                `typescript-plugin-scoped-imports: BLOCKING code fix "${fix.fixName}"`,
              )
              return false
            }
          }
          return true
        })

        if (fixes.length !== filteredFixes.length) {
          info.project.projectService.logger.info(
            `typescript-plugin-scoped-imports: Filtered ${fixes.length - filteredFixes.length} code fixes`,
          )
        }

        return filteredFixes
      }

      // Intercept getCombinedCodeFix
      proxy.getCombinedCodeFix = (
        scope: ts.CombinedCodeFixScope,
        fixId: {},
        formatOptions: ts.FormatCodeSettings,
        preferences: ts.UserPreferences,
      ): ts.CombinedCodeActions => {
        const result = oldLS.getCombinedCodeFix(scope, fixId, formatOptions, preferences)
        const fileName = scope.fileName

        const filteredChanges = result.changes.filter((change) => {
          if (containsPrivateImport([change])) {
            if (hasBlockedPrivateImports([change], fileName)) {
              info.project.projectService.logger.info(`typescript-plugin-scoped-imports: BLOCKING combined fix change`)
              return false
            }
          }
          return true
        })

        if (result.changes.length !== filteredChanges.length) {
          info.project.projectService.logger.info(
            `typescript-plugin-scoped-imports: Filtered ${result.changes.length - filteredChanges.length} combined fix changes`,
          )
        }

        return {
          ...result,
          changes: filteredChanges,
        }
      }

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
        )

        if (!result) {
          return result
        }

        const filteredEdits = result.edits.filter((edit) => {
          if (containsPrivateImport([edit])) {
            if (hasBlockedPrivateImports([edit], fileName)) {
              info.project.projectService.logger.info(`typescript-plugin-scoped-imports: BLOCKING refactor edit`)
              return false
            }
          }
          return true
        })

        if (result.edits.length !== filteredEdits.length) {
          info.project.projectService.logger.info(
            `typescript-plugin-scoped-imports: Filtered ${result.edits.length - filteredEdits.length} refactor edits`,
          )
        }

        return {
          ...result,
          edits: filteredEdits,
        }
      }

      info.project.projectService.logger.info('typescript-plugin-scoped-imports: Plugin proxy created successfully')
      info.project.projectService.logger.info('===================================')

      return proxy
    } catch (error) {
      info.project.projectService.logger.info(`typescript-plugin-scoped-imports: ERROR loading plugin: ${error}`)
      info.project.projectService.logger.info('===================================')
      throw error
    }
  }

  return { create }
}

export = init
