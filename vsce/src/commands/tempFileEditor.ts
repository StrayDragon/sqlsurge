import * as vscode from "vscode";
import { getWorkspaceConfig } from "../extConfig";
import { ORIGINAL_SCHEME, type SqlNode } from "../interface";
import { createLogger } from "../outputChannel";

export async function editSqlInTempFile(
  refresh: (
    document: vscode.TextDocument,
  ) => Promise<(SqlNode & { vFileName: string })[]>,
) {
  const logger = createLogger();
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showErrorMessage("No active editor found");
    return;
  }

  const document = editor.document;
  const selection = editor.selection;

  // Check if the feature is enabled
  const isEnabled = getWorkspaceConfig("enableTempFileEdit");
  if (!isEnabled) {
    vscode.window.showInformationMessage(
      "Temporary file editing is disabled. Enable it in settings.",
    );
    return;
  }

  try {
    const sqlNodes = await refresh(document);
    let targetSqlNode: (SqlNode & { vFileName: string }) | undefined;

    if (selection.isEmpty) {
      // If no selection, find SQL node at cursor position
      const position = selection.active;
      targetSqlNode = sqlNodes.find(({ code_range: { start, end } }) => {
        return (
          (start.line < position.line && position.line < end.line) ||
          (start.line === position.line &&
            start.character <= position.character) ||
          (end.line === position.line && position.character <= end.character)
        );
      });
    } else {
      // If there's a selection, find SQL node that overlaps with selection
      targetSqlNode = sqlNodes.find(({ code_range: { start, end } }) => {
        const nodeRange = new vscode.Range(
          start.line,
          start.character,
          end.line,
          end.character,
        );
        return nodeRange.intersection(selection) !== undefined;
      });
    }

    if (!targetSqlNode) {
      vscode.window.showWarningMessage(
        "No SQL code found at cursor position or in selection",
      );
      return;
    }

    // Create temporary document with SQL content
    const tempUri = vscode.Uri.parse(`untitled:temp_sql_${Date.now()}.sql`);
    const tempDoc = await vscode.workspace.openTextDocument(tempUri);

    // Open the temporary document in a new editor
    const tempEditor = await vscode.window.showTextDocument(tempDoc, {
      viewColumn: vscode.ViewColumn.Beside,
      preview: false,
    });

    // Insert SQL content into temporary document
    await tempEditor.edit((editBuilder) => {
      editBuilder.insert(
        new vscode.Position(0, 0),
        targetSqlNode.content.trim(),
      );
    });

    // Store reference to original document and SQL node for later sync
    const originalDocUri = document.uri.toString();
    const sqlNodeInfo = {
      originalUri: originalDocUri,
      sqlNode: targetSqlNode,
      tempUri: tempUri.toString(),
    };

    // Store in global state for tracking
    const context = (global as any).sqlsurgeContext;
    if (context) {
      if (!context.globalState.get("tempSqlFiles")) {
        context.globalState.update("tempSqlFiles", new Map());
      }
      const tempFiles = context.globalState.get("tempSqlFiles") as Map<
        string,
        any
      >;
      tempFiles.set(tempUri.toString(), sqlNodeInfo);
    }

    // Set up auto-save listener for the temporary document
    const disposable = vscode.workspace.onDidSaveTextDocument(
      async (savedDoc) => {
        if (savedDoc.uri.toString() === tempUri.toString()) {
          await syncBackToOriginal(savedDoc, sqlNodeInfo, refresh);
        }
      },
    );

    // Clean up when temporary document is closed
    const closeDisposable = vscode.workspace.onDidCloseTextDocument(
      (closedDoc) => {
        if (closedDoc.uri.toString() === tempUri.toString()) {
          disposable.dispose();
          closeDisposable.dispose();

          // Clean up from global state
          if (context) {
            const tempFiles = context.globalState.get("tempSqlFiles") as Map<
              string,
              any
            >;
            if (tempFiles) {
              tempFiles.delete(tempUri.toString());
            }
          }
        }
      },
    );

    vscode.window.showInformationMessage(
      "SQL opened in temporary file. Save to sync changes back to original file.",
    );
  } catch (error) {
    logger.error("[editSqlInTempFile]", "Error:", error);
    vscode.window.showErrorMessage(
      `Failed to open SQL in temporary file: ${error}`,
    );
  }
}

async function syncBackToOriginal(
  tempDoc: vscode.TextDocument,
  sqlNodeInfo: any,
  refresh: (
    document: vscode.TextDocument,
  ) => Promise<(SqlNode & { vFileName: string })[]>,
) {
  const logger = createLogger();

  try {
    // Get the original document
    const originalUri = vscode.Uri.parse(sqlNodeInfo.originalUri);
    const originalDoc = await vscode.workspace.openTextDocument(originalUri);

    // Get updated SQL content from temp file
    const updatedSqlContent = tempDoc.getText();

    // Find the original editor
    const editors = vscode.window.visibleTextEditors;
    const originalEditor = editors.find(
      (editor) => editor.document.uri.toString() === originalUri.toString(),
    );

    if (!originalEditor) {
      vscode.window.showWarningMessage(
        "Original file is not open. Please open it to sync changes.",
      );
      return;
    }

    // Replace the SQL content in the original document
    const sqlNode = sqlNodeInfo.sqlNode;
    const replaceRange = new vscode.Range(
      sqlNode.code_range.start.line,
      sqlNode.code_range.start.character,
      sqlNode.code_range.end.line,
      sqlNode.code_range.end.character,
    );

    await originalEditor.edit((editBuilder) => {
      // Preserve the original indentation and quotes
      const originalText = originalDoc.getText(replaceRange);
      const leadingWhitespace = originalText.match(/^\s*/)?.[0] || "";
      const trailingQuotes = originalText.match(/["'`]+\s*$/)?.[0] || "";
      const leadingQuotes = originalText.match(/^\s*["'`]+/)?.[0] || "";

      // Reconstruct with proper formatting
      let newContent = leadingQuotes;
      const lines = updatedSqlContent.split("\n");
      lines.forEach((line, index) => {
        if (index > 0) {
          newContent += "\n" + leadingWhitespace;
        }
        newContent += line;
      });
      newContent += trailingQuotes;

      editBuilder.replace(replaceRange, newContent);
    });

    vscode.window.showInformationMessage(
      "SQL changes synced back to original file!",
    );
    logger.debug("[syncBackToOriginal]", "Successfully synced changes");
  } catch (error) {
    logger.error("[syncBackToOriginal]", "Error:", error);
    vscode.window.showErrorMessage(`Failed to sync changes: ${error}`);
  }
}

export function registerEditSqlInTempFileCommand(
  refresh: (
    document: vscode.TextDocument,
  ) => Promise<(SqlNode & { vFileName: string })[]>,
) {
  return vscode.commands.registerCommand("sqlsurge.editSqlInTempFile", () =>
    editSqlInTempFile(refresh),
  );
}
