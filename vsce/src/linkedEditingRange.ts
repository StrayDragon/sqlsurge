import * as vscode from "vscode";
import { ORIGINAL_SCHEME, type SqlNode } from "./interface";
import { createLogger } from "./outputChannel";

export async function linkedEditingRangeProvider(
  virtualDocuments: Map<string, string>,
  refresh: (
    document: vscode.TextDocument,
  ) => Promise<(SqlNode & { vFileName: string })[]>,
) {
  return {
    async provideLinkedEditingRanges(
      document: vscode.TextDocument,
      position: vscode.Position,
      _token: vscode.CancellationToken,
    ): Promise<vscode.LinkedEditingRanges | null> {
      const logger = createLogger();

      logger.debug(
        "[provideLinkedEditingRanges]",
        "Starting linked editing...",
      );
      logger.debug("[provideLinkedEditingRanges]", "file: ", document.fileName);

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
      const virtualPosition = new vscode.Position(
        position.line,
        position.character,
      );

      // trigger linked editing on virtual file
      const vDocUriString = `${ORIGINAL_SCHEME}:${uniqueVFileName}`;
      const vDocUri = vscode.Uri.parse(vDocUriString);

      logger.debug(
        "[provideLinkedEditingRanges] Virtual position:",
        virtualPosition.line,
        virtualPosition.character,
      );

      try {
        const linkedEditingRanges =
          await vscode.commands.executeCommand<vscode.LinkedEditingRanges>(
            "vscode.executeLinkedEditingRangeProvider",
            vDocUri,
            virtualPosition,
          );

        if (!linkedEditingRanges || !linkedEditingRanges.ranges) {
          return null;
        }

        // Map virtual ranges back to original document
        const mappedRanges = linkedEditingRanges.ranges.map((range) => {
          // Adjust ranges back to original document coordinates
          return new vscode.Range(
            range.start.line,
            range.start.character,
            range.end.line,
            range.end.character,
          );
        });

        logger.debug("[provideLinkedEditingRanges] Finished linked editing.");
        return new vscode.LinkedEditingRanges(
          mappedRanges,
          linkedEditingRanges.wordPattern,
        );
      } catch (error) {
        logger.debug("[provideLinkedEditingRanges] Error:", error);
        return null;
      }
    },
  };
}
