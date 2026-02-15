import type * as ts from "typescript/lib/tsserverlibrary";

export type PluginConfig = {
  debug?: boolean;
};

export function createPluginLogger(
  logger: ts.server.Logger,
  config: PluginConfig | undefined,
): {
  logInfo: (message: string) => void;
  logDebug: (message: string) => void;
} {
  const debugEnabled = config?.debug === true;

  const logInfo = (message: string): void => {
    logger.info(message);
  };

  const logDebug = (message: string): void => {
    if (debugEnabled) {
      logger.info(message);
    }
  };

  return {
    logInfo,
    logDebug,
  };
}
