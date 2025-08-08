import { delimiter } from "node:path";
import * as vscode from "vscode";
import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
  State,
} from "vscode-languageclient/node";
import { createLogger } from "./outputChannel";

interface LanguageServerConfig {
  flags: string[];
}

export let client: LanguageClient | undefined = undefined;

const logger = createLogger();

export async function startSqlsClient() {
  logger.debug("[startSqlsClient]", "Starting sqls client...");
  const sqlsConfig = vscode.workspace.getConfiguration("sqlsurge");
  const config: LanguageServerConfig = {
    flags: sqlsConfig.languageServerFlags || [],
  };

  const sqlsInPATH = await findSqlsInPath();
  if (!sqlsInPATH) {
    showSqlsNotFoundMessage();
    return;
  }

  // Add config file path for sqls
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const configArgs = [];
  if (workspaceFolder) {
    const configPath = vscode.Uri.joinPath(workspaceFolder.uri, ".sqlsurge");
    try {
      await vscode.workspace.fs.stat(configPath);
      configArgs.push("-c", configPath.fsPath);
      logger.debug(
        "[startSqlsClient]",
        `Using config file: ${configPath.fsPath}`,
      );
    } catch {
      logger.debug(
        "[startSqlsClient]",
        "No .sqlsurge config file found in workspace",
      );
    }
  }

  const serverOptions: ServerOptions = {
    command: sqlsInPATH.fsPath,
    args: [...configArgs, ...config.flags],
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { language: "sql", pattern: "**/*.sql" },
      { language: "python", pattern: "**/*.py" },
    ],
  };

  client = new LanguageClient("sqls", serverOptions, clientOptions);
  client.start();

  logger.info("[startSqlsClient]", "Started sqls client.");
}

export async function restartLanguageServer() {
  logger.debug("[restartLanguageServer]", "Restarting SQL language server...");
  if (!client) {
    await startSqlsClient();
    return;
  }

  const sqlsInPATH = await findSqlsInPath();
  if (!sqlsInPATH) {
    showSqlsNotFoundMessage();
    return;
  }

  if (client.state === State.Stopped) {
    await client.start();
    logger.debug("[restartLanguageServer]", "Started SQL language server.");
  }
  if (client.state === State.Running) {
    await client.restart();
    logger.debug("[restartLanguageServer]", "Restarted SQL language server.");
  }

  vscode.window.showInformationMessage(
    "Successfully restarted SQL language server.",
  );
  logger.info(
    "[restartLanguageServer]",
    "Successfully restarted SQL language server.",
  );
}

export async function findSqlsInPath(): Promise<vscode.Uri | undefined> {
  const path = process.env.PATH;
  if (!path) {
    throw new Error("PATH environment variable is not set");
  }

  const sqlsFileName = process.platform === "win32" ? "sqls.exe" : "sqls";
  for (const dir of path.split(delimiter)) {
    const sqls = vscode.Uri.joinPath(vscode.Uri.file(dir), sqlsFileName);
    if (await existsFile(sqls)) {
      return sqls;
    }
  }

  return;
}

async function existsFile(path: vscode.Uri) {
  return vscode.workspace.fs.stat(path).then(
    () => true,
    (err) => {
      logger.debug("[existsFile]", err);
      if (err.code === "ENOENT" || err.code === "FileNotFound") {
        return false;
      }
      throw err;
    },
  );
}

async function showSqlsNotFoundMessage() {
  // not found sqls, install sqls automatically
  const action = await vscode.window.showInformationMessage(
    "sqls is not installed yet or not found in PATH. Install sqls to enable SQL language features.",
    "Install with command",
    "Install manually (Jump to the installation guide)",
  );
  switch (action) {
    case "Install with command":
      await vscode.commands.executeCommand("sqlsurge.installSqls");
      break;
    case "Install manually (Jump to the installation guide)":
      await vscode.commands.executeCommand(
        "vscode.open",
        vscode.Uri.parse(
          "https://github.com/sqls-server/sqls?tab=readme-ov-file#installation",
        ),
      );
      logger.info("[startSqlsClient]", "sqls is not installed.");
      return;
    default:
      logger.info("[startSqlsClient]", "sqls is not installed.");
      return;
  }
}
