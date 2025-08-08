import * as vscode from "vscode";
import { ORIGINAL_SCHEME, type SqlNode } from "./interface";
import { createLogger } from "./outputChannel";

export async function hoverProvider(
  virtualDocuments: Map<string, string>,
  refresh: (
    document: vscode.TextDocument,
  ) => Promise<(SqlNode & { vFileName: string })[]>,
) {
  return {
    async provideHover(
      document: vscode.TextDocument,
      position: vscode.Position,
      _token: vscode.CancellationToken,
    ) {
      const logger = createLogger();

      logger.debug("[provideHover]", "Starting hover...");
      logger.debug("[provideHover]", "file: ", document.fileName);
      const sqlNodes = await refresh(document);
      const sqlNode = sqlNodes.find(({ code_range: { start, end } }) => {
        // in range
        return (
          (start.line < position.line && position.line < end.line) ||
          (start.line === position.line &&
            start.character <= position.character) ||
          (end.line === position.line && position.character <= end.character)
        );
      });
      if (!sqlNode) return null;

      // Delegate LSP
      // update virtual content with unique URI for each SQL block
      const offset = document.offsetAt(
        new vscode.Position(
          sqlNode.code_range.start.line,
          sqlNode.code_range.start.character,
        ),
      );

      // Find the actual SQL content start (skip leading whitespace/newlines)
      const sqlContentStart = sqlNode.content.search(/\S/);
      const adjustedOffset =
        offset + (sqlContentStart >= 0 ? sqlContentStart : 0);

      const prefix = document
        .getText()
        .slice(0, adjustedOffset)
        .replace(/[^\n]/g, " ");
      const trimmedSqlContent = sqlNode.content.substring(
        sqlContentStart >= 0 ? sqlContentStart : 0,
      );
      const vContent = prefix + trimmedSqlContent;

      // Create unique virtual document URI using index to avoid conflicts
      const sqlNodeWithIndex = sqlNode as SqlNode & {
        vFileName: string;
        index: number;
      };
      const uniqueVFileName = `${sqlNodeWithIndex.vFileName}_${sqlNodeWithIndex.index}`;
      virtualDocuments.set(uniqueVFileName, vContent);

      // Calculate the correct position in virtual document
      // The virtual document has the same line structure but with prefix spaces
      const virtualPosition = new vscode.Position(
        position.line,
        position.character,
      );

      // trigger hover on virtual file
      const vDocUriString = `${ORIGINAL_SCHEME}:${uniqueVFileName}`;
      const vDocUri = vscode.Uri.parse(vDocUriString);

      logger.debug(
        "[provideHover] Virtual position:",
        virtualPosition.line,
        virtualPosition.character,
      );
      logger.debug("[provideHover] Finished hover.");
      const hoverResults = await vscode.commands.executeCommand<vscode.Hover[]>(
        "vscode.executeHoverProvider",
        vDocUri,
        virtualPosition,
      );
      // Return the first hover result or null
      return hoverResults && hoverResults.length > 0 ? hoverResults[0] : null;
    },
  };
}
