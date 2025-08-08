import { extractSqlListPy } from "@senken/sql-extraction-py/src";
import { ORIGINAL_SCHEME, type SqlNode } from "./interface";

import * as ts from "typescript";
import * as vscode from "vscode";

import { registerEditSqlInTempFileCommand } from "./commands/tempFileEditor";
import { completionProvider } from "./completion";
import { getWorkspaceConfig } from "./extConfig";
import { hoverProvider } from "./hover";
import {
  type IncrementalLanguageService,
  createIncrementalLanguageService,
  createIncrementalLanguageServiceHost,
} from "./languageService";
import { linkedEditingRangeProvider } from "./linkedEditingRange";
import { createLogger } from "./outputChannel";
import { client, startSqlsClient } from "./startSqlsClient";

export async function activate(context: vscode.ExtensionContext) {
  const logger = createLogger();

  await startSqlsClient().catch((err) => {
    logger.error(err, "[startSqlsClient] Failed to start sqls client.");
    vscode.window.showErrorMessage("sqlsurge: Failed to start sqls client.");
  });

  const virtualContents = new Map<string, string[]>(); // TODO: #58 May not be needed
  const services = new Map<string, IncrementalLanguageService>();
  const registry = ts.createDocumentRegistry();

  // virtual sql files
  const virtualDocuments = new Map<string, string>();
  vscode.workspace.registerTextDocumentContentProvider(ORIGINAL_SCHEME, {
    provideTextDocumentContent: (uri) => {
      return virtualDocuments.get(uri.fsPath);
    },
  });

  const completion = vscode.languages.registerCompletionItemProvider(
    ["python"],
    await completionProvider(virtualDocuments, refresh),
  );
  const hover = vscode.languages.registerHoverProvider(
    ["python"],
    await hoverProvider(virtualDocuments, refresh),
  );
  const linkedEditing = vscode.languages.registerLinkedEditingRangeProvider(
    ["python"],
    await linkedEditingRangeProvider(virtualDocuments, refresh),
  );
  const commandEditSqlInTempFile = registerEditSqlInTempFileCommand(refresh);

  // Store context globally for temp file tracking
  (global as any).sqlsurgeContext = context;

  context.subscriptions.push(
    logger,
    completion,
    hover,
    linkedEditing,
    commandEditSqlInTempFile,
  );

  vscode.workspace.onDidChangeConfiguration(() => {
    // validate customRawSqlQuery
    getWorkspaceConfig("customRawSqlQuery");
  });

  function getOrCreateLanguageService(uri: vscode.Uri) {
    const workspace = vscode.workspace.getWorkspaceFolder(uri);
    const roodDir = workspace?.uri.fsPath!;
    if (services.has(roodDir)) {
      return services.get(roodDir);
    }
    const service = createLanguageService(roodDir);
    services.set(roodDir, service);
    return service;
  }

  function createLanguageService(rootDir: string) {
    const configFile = ts.findConfigFile(rootDir, ts.sys.fileExists);

    let fileNames: string[] = [];
    if (configFile) {
      const tsconfig = ts.readConfigFile(configFile, ts.sys.readFile);
      const options = ts.parseJsonConfigFileContent(
        tsconfig.config,
        ts.sys,
        rootDir,
      );
      fileNames = options.fileNames;
    }

    const getWorkspaceContent = (filePath: string) => {
      return vscode.workspace.textDocuments
        .find((doc) => doc.uri.fsPath.endsWith(filePath))
        ?.getText();
    };
    const host = createIncrementalLanguageServiceHost(
      rootDir,
      fileNames,
      undefined,
      getWorkspaceContent,
    );
    return createIncrementalLanguageService(host, registry);
  }

  async function refresh(
    document: vscode.TextDocument,
  ): Promise<(SqlNode & { vFileName: string })[]> {
    logger.debug("[refresh]", "Refreshing...");
    try {
      const service = getOrCreateLanguageService(document.uri)!;
      const fileName = document.fileName;
      const rawContent = document.getText();
      let sqlNodes: SqlNode[] = [];
      let config = getWorkspaceConfig("customRawSqlQuery");
      switch (document.languageId) {
        case "python": {
          if (config?.language !== document.languageId) {
            config = undefined;
          }
          const result = await extractSqlListPy(rawContent, config?.configs);
          sqlNodes = result || [];
          break;
        }
        default:
          return [];
      }

      const lastVirtualFileNames = virtualContents.get(fileName) ?? [];
      // update virtual files
      const vFileNames =
        sqlNodes?.map((sqlNode, index) => {
          const virtualFileName = `${fileName}@${index}.sql`;
          const offset = document.offsetAt(
            new vscode.Position(
              sqlNode.code_range.start.line,
              sqlNode.code_range.start.character,
            ),
          );
          const prefix = rawContent.slice(0, offset).replace(/[^\n]/g, " ");
          service.writeSnapshot(
            virtualFileName,
            ts.ScriptSnapshot.fromString(prefix + sqlNode.content),
          );
          return virtualFileName;
        }) ?? [];

      // remove unused virtual files
      lastVirtualFileNames
        .filter((vFileName) => !(vFileNames ?? []).includes(vFileName))
        .map((vFileName) => {
          service.deleteSnapshot(vFileName);
        });
      virtualContents.set(fileName, vFileNames);
      const sqlNodesWithVirtualDoc = (sqlNodes || []).map((block, idx) => {
        if (vFileNames[idx] === undefined) {
          throw new Error(`vFileName[${idx}] is undefined.`);
        }
        return {
          ...block,
          vFileName: vFileNames[idx],
          index: idx,
        };
      });
      logger.debug("[refresh]", "Refreshed.");
      return sqlNodesWithVirtualDoc;
    } catch (e) {
      logger.error("[refresh]", `${e}`);

      // show error notification
      vscode.window.showErrorMessage(`[refresh] ${e}`);
      return [];
    }
  }
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
