import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

type ImportPreference = "relative" | "non-relative";

type TsServerResponse = {
  seq: number;
  type: "response";
  request_seq: number;
  success: boolean;
  command: string;
  body?: unknown;
  message?: string;
};

type TsServerPending = {
  resolve: (value: TsServerResponse) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

const PRIVATE_FOLDER = "__private__";
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const PACKAGE_ROOT = path.join(
  REPO_ROOT,
  "packages",
  "typescript-plugin-scoped-imports",
);
const PROJECT_ROOT = path.join(REPO_ROOT, "examples", "test-project");
const TSSERVER_PATH = path.join(
  REPO_ROOT,
  "node_modules",
  "typescript",
  "lib",
  "tsserver.js",
);
const PLUGIN_DIST_PATH = path.join(PACKAGE_ROOT, "dist", "index.js");

class TsServerHarness {
  private process: ChildProcessWithoutNullStreams;
  private seq = 0;
  private readonly pending = new Map<number, TsServerPending>();
  private stdoutBuffer = "";

  constructor(private readonly logFilePath: string) {
    this.process = spawn(process.execPath, [
      TSSERVER_PATH,
      "--logVerbosity",
      "normal",
      "--logFile",
      this.logFilePath,
    ]);

    this.process.stdout.on("data", (chunk: Buffer) => {
      this.stdoutBuffer += chunk.toString("utf8");
      this.drainStdoutLines();
    });

    this.process.on("exit", (code) => {
      for (const [requestSeq, pending] of this.pending) {
        clearTimeout(pending.timer);
        pending.reject(
          new Error(
            `tsserver exited before request ${requestSeq} completed (code=${String(code)})`,
          ),
        );
      }
      this.pending.clear();
    });
  }

  async stop(): Promise<void> {
    if (this.process.killed) {
      return;
    }

    this.process.kill();
    await new Promise<void>((resolve) => {
      this.process.once("exit", () => resolve());
    });
  }

  async send(
    command: string,
    args: Record<string, unknown>,
    timeoutMs = 5000,
  ): Promise<TsServerResponse> {
    const requestSeq = ++this.seq;
    const payload = JSON.stringify({
      seq: requestSeq,
      type: "request",
      command,
      arguments: args,
    });

    return new Promise<TsServerResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestSeq);
        reject(
          new Error(
            `Timed out waiting response for ${command} (${requestSeq})`,
          ),
        );
      }, timeoutMs);

      this.pending.set(requestSeq, { resolve, reject, timer });
      this.process.stdin.write(`${payload}\n`);
    });
  }

  async waitForLog(pattern: RegExp, timeoutMs = 6000): Promise<boolean> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      if (existsSync(this.logFilePath)) {
        const content = readFileSync(this.logFilePath, "utf8");
        if (pattern.test(content)) {
          return true;
        }
      }

      await sleep(50);
    }

    return false;
  }

  private drainStdoutLines(): void {
    let newlineIndex = this.stdoutBuffer.indexOf("\n");

    while (newlineIndex !== -1) {
      const rawLine = this.stdoutBuffer.slice(0, newlineIndex).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);

      if (rawLine.length > 0) {
        this.handleStdoutLine(rawLine);
      }

      newlineIndex = this.stdoutBuffer.indexOf("\n");
    }
  }

  private handleStdoutLine(line: string): void {
    let parsed: TsServerResponse | undefined;

    try {
      parsed = JSON.parse(line) as TsServerResponse;
    } catch {
      return;
    }

    if (parsed.type !== "response") {
      return;
    }

    const pending = this.pending.get(parsed.request_seq);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timer);
    this.pending.delete(parsed.request_seq);
    pending.resolve(parsed);
  }
}

function fixturePath(relativePath: string): string {
  return path.join(PROJECT_ROOT, relativePath);
}

function codeFixSourceRange(
  lineText: string,
  token: string,
): {
  startLine: number;
  startOffset: number;
  endLine: number;
  endOffset: number;
} {
  const tokenStart = lineText.indexOf(token);
  if (tokenStart === -1) {
    throw new Error(`Token ${token} not found in line: ${lineText}`);
  }

  return {
    startLine: 2,
    startOffset: tokenStart + 1,
    endLine: 2,
    endOffset: tokenStart + token.length + 1,
  };
}

function containsPrivateCompletion(entries: unknown): boolean {
  if (!Array.isArray(entries)) {
    return false;
  }

  return entries.some((entry) => {
    if (!entry || typeof entry !== "object") {
      return false;
    }

    const name = (entry as { name?: unknown }).name;
    return typeof name === "string" && name.includes(PRIVATE_FOLDER);
  });
}

function collectFixDescriptions(fixes: unknown): string[] {
  if (!Array.isArray(fixes)) {
    return [];
  }

  return fixes
    .map((fix) => {
      if (!fix || typeof fix !== "object") {
        return "";
      }

      const description = (fix as { description?: unknown }).description;
      return typeof description === "string" ? description : "";
    })
    .filter((value) => value.length > 0);
}

function hasPrivateFix(fixes: unknown): boolean {
  return collectFixDescriptions(fixes).some((description) =>
    description.includes(PRIVATE_FOLDER),
  );
}

function combinedFixContainsPrivate(changes: unknown): boolean {
  if (!Array.isArray(changes)) {
    return false;
  }

  return changes.some((change) => {
    if (!change || typeof change !== "object") {
      return false;
    }

    const textChanges = (change as { textChanges?: unknown }).textChanges;
    if (!Array.isArray(textChanges)) {
      return false;
    }

    return textChanges.some((textChange) => {
      if (!textChange || typeof textChange !== "object") {
        return false;
      }

      const newText = (textChange as { newText?: unknown }).newText;
      return typeof newText === "string" && newText.includes(PRIVATE_FOLDER);
    });
  });
}

describe("tsserver integration: scoped private imports", () => {
  let harness: TsServerHarness;
  let logFilePath: string;

  beforeAll(async () => {
    expect(existsSync(TSSERVER_PATH)).toBe(true);
    expect(existsSync(PLUGIN_DIST_PATH)).toBe(true);

    logFilePath = path.join(
      "/tmp",
      `tsserver-scoped-imports-${Date.now().toString()}-${process.pid.toString()}.log`,
    );

    harness = new TsServerHarness(logFilePath);
    await sleep(200);
  });

  afterAll(async () => {
    await harness.stop();
  });

  async function configurePreference(
    preference: ImportPreference,
  ): Promise<void> {
    const response = await harness.send("configure", {
      preferences: {
        importModuleSpecifierPreference: preference,
      },
    });

    expect(response.success).toBe(true);
  }

  async function pathCompletions(
    filePath: string,
    importPrefix: string,
  ): Promise<unknown> {
    const lineText = `import X from "${importPrefix}";`;
    const fileContent = [
      'import React from "react";',
      lineText,
      "export const marker = 1;",
    ].join("\n");

    const openResponse = await harness.send("open", {
      file: filePath,
      fileContent,
    });
    expect(openResponse.success).toBe(true);

    const completionResponse = await harness.send("completions", {
      file: filePath,
      line: 2,
      offset: `import X from "${importPrefix}`.length + 1,
    });

    expect(completionResponse.success).toBe(true);
    return completionResponse.body;
  }

  async function codeFixesForMissingItem(
    filePath: string,
    preference: ImportPreference,
  ): Promise<unknown> {
    const lineText = "export const value = Item;";
    const fileContent = ['import React from "react";', lineText].join("\n");
    const range = codeFixSourceRange(lineText, "Item");

    await configurePreference(preference);

    const openResponse = await harness.send("open", {
      file: filePath,
      fileContent,
    });
    expect(openResponse.success).toBe(true);

    const diagnosticsResponse = await harness.send("semanticDiagnosticsSync", {
      file: filePath,
    });
    expect(diagnosticsResponse.success).toBe(true);

    const fixesResponse = await harness.send("getCodeFixes", {
      file: filePath,
      ...range,
      errorCodes: [2304],
    });

    expect(fixesResponse.success).toBe(true);
    return fixesResponse.body;
  }

  async function combinedFixForMissingImports(
    filePath: string,
    preference: ImportPreference,
  ): Promise<unknown> {
    const fileContent = [
      'import React from "react";',
      "export const first = Item;",
      "export const second = PrivateSibling;",
    ].join("\n");

    await configurePreference(preference);

    const openResponse = await harness.send("open", {
      file: filePath,
      fileContent,
    });
    expect(openResponse.success).toBe(true);

    const diagnosticsResponse = await harness.send("semanticDiagnosticsSync", {
      file: filePath,
    });
    expect(diagnosticsResponse.success).toBe(true);

    const combinedResponse = await harness.send("getCombinedCodeFix", {
      scope: {
        type: "file",
        args: { file: filePath },
      },
      fixId: "fixMissingImport",
    });

    expect(combinedResponse.success).toBe(true);
    return (combinedResponse.body as { changes?: unknown } | undefined)
      ?.changes;
  }

  test("loads plugin into tsserver", async () => {
    const filePath = fixturePath("src/views/Home.tsx");
    const openResponse = await harness.send("open", {
      file: filePath,
      fileContent: [
        'import React from "react";',
        "export const healthCheck = true;",
      ].join("\n"),
    });

    expect(openResponse.success).toBe(true);

    const loaded = await harness.waitForLog(
      /PLUGIN LOADING: typescript-plugin-scoped-imports/,
      7000,
    );

    expect(loaded).toBe(true);
  });

  test("path completion blocks __private__ from out-of-scope alias path", async () => {
    const body = await pathCompletions(
      fixturePath("src/views/Home.tsx"),
      "@/components/gallery/",
    );

    expect(containsPrivateCompletion(body)).toBe(false);
  });

  test("path completion allows __private__ from in-scope alias path", async () => {
    const body = await pathCompletions(
      fixturePath("src/components/gallery/silbing/nephew/index.tsx"),
      "@/components/gallery/",
    );

    expect(containsPrivateCompletion(body)).toBe(true);
  });

  test("path completion allows __private__ from parent scope", async () => {
    const body = await pathCompletions(
      fixturePath("src/components/gallery/ParentComponent.tsx"),
      "./",
    );

    expect(containsPrivateCompletion(body)).toBe(true);
  });

  test("path completion allows __private__ from descendant scope", async () => {
    const body = await pathCompletions(
      fixturePath("src/components/gallery/silbing/index.tsx"),
      "../",
    );

    expect(containsPrivateCompletion(body)).toBe(true);
  });

  test("path completion blocks __private__ from lateral relative path", async () => {
    const body = await pathCompletions(
      fixturePath("src/components/utils/UtilsComponent.tsx"),
      "../gallery/",
    );

    expect(containsPrivateCompletion(body)).toBe(false);
  });

  describe.each<ImportPreference>(["relative", "non-relative"])(
    "codefix policy with %s imports",
    (preference) => {
      test("missing import in out-of-scope file does not suggest __private__", async () => {
        const fixes = await codeFixesForMissingItem(
          fixturePath("src/views/Home.tsx"),
          preference,
        );

        expect(hasPrivateFix(fixes)).toBe(false);
      });

      test("missing import in parent scope suggests __private__", async () => {
        const fixes = await codeFixesForMissingItem(
          fixturePath("src/components/gallery/ParentComponent.tsx"),
          preference,
        );

        const descriptions = collectFixDescriptions(fixes);
        expect(descriptions.length).toBeGreaterThan(0);
        expect(hasPrivateFix(fixes)).toBe(true);
      });

      test("missing import in descendant scope suggests __private__", async () => {
        const fixes = await codeFixesForMissingItem(
          fixturePath("src/components/gallery/silbing/nephew/index.tsx"),
          preference,
        );

        const descriptions = collectFixDescriptions(fixes);
        expect(descriptions.length).toBeGreaterThan(0);
        expect(hasPrivateFix(fixes)).toBe(true);
      });

      test("combined fix blocks private imports out-of-scope", async () => {
        const changes = await combinedFixForMissingImports(
          fixturePath("src/views/Home.tsx"),
          preference,
        );

        expect(combinedFixContainsPrivate(changes)).toBe(false);
      });

      test("combined fix keeps private imports in-scope", async () => {
        const changes = await combinedFixForMissingImports(
          fixturePath("src/components/gallery/ParentComponent.tsx"),
          preference,
        );

        expect(combinedFixContainsPrivate(changes)).toBe(true);
      });
    },
  );

  test("completion entry details are blocked for private source out-of-scope", async () => {
    const filePath = fixturePath("src/views/Home.tsx");
    const fileContent = [
      'import React from "react";',
      "Ite",
      "export const x = 1;",
    ].join("\n");

    const openResponse = await harness.send("open", {
      file: filePath,
      fileContent,
    });
    expect(openResponse.success).toBe(true);

    const detailsResponse = await harness.send("completionEntryDetails", {
      file: filePath,
      line: 2,
      offset: 4,
      entryNames: [
        {
          name: "Item",
          source: "@/components/gallery/__private__/Item",
        },
      ],
    });

    expect(detailsResponse.success).toBe(true);
    expect(Array.isArray(detailsResponse.body)).toBe(true);
    expect((detailsResponse.body as unknown[]).length).toBe(0);

    const blockedLogged = await harness.waitForLog(
      /BLOCKING completion details for source: @\/components\/gallery\/__private__\/Item/,
      5000,
    );
    expect(blockedLogged).toBe(true);
  });

  test("refactor edits smoke test does not introduce private imports out-of-scope", async () => {
    const filePath = fixturePath("src/views/Home.tsx");
    const fileContent = [
      "function demo() {",
      "  return 1 + 2 + 3;",
      "}",
      "export { demo };",
    ].join("\n");

    const openResponse = await harness.send("open", {
      file: filePath,
      fileContent,
    });
    expect(openResponse.success).toBe(true);

    const applicableResponse = await harness.send("getApplicableRefactors", {
      file: filePath,
      startLine: 2,
      startOffset: 10,
      endLine: 2,
      endOffset: 19,
      triggerReason: "invoked",
    });

    expect(applicableResponse.success).toBe(true);

    const refactors = (applicableResponse.body ?? []) as Array<{
      name: string;
      actions?: Array<{ name: string; isInteractive?: boolean }>;
    }>;

    const firstAction = refactors
      .flatMap((refactor) =>
        (refactor.actions ?? [])
          .filter((action) => !action.isInteractive)
          .map((action) => ({ refactor: refactor.name, action: action.name })),
      )
      .at(0);

    expect(firstAction).toBeDefined();

    const editsResponse = await harness.send("getEditsForRefactor", {
      file: filePath,
      startLine: 2,
      startOffset: 10,
      endLine: 2,
      endOffset: 19,
      refactor: firstAction?.refactor,
      action: firstAction?.action,
      triggerReason: "invoked",
    });

    expect(editsResponse.success).toBe(true);

    const edits =
      (editsResponse.body as { edits?: unknown[] } | undefined)?.edits ?? [];
    const hasPrivateImport = JSON.stringify(edits).includes(PRIVATE_FOLDER);
    expect(hasPrivateImport).toBe(false);
  });

  test("alias heuristic does not leak private imports when folder name repeats", async () => {
    const fixes = await codeFixesForMissingItem(
      fixturePath("src/views/gallery/ScopeTrap.tsx"),
      "non-relative",
    );

    expect(hasPrivateFix(fixes)).toBe(false);
  });
});
