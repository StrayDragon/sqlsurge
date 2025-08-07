import type { SqlNode } from "../../../vsce/src/interface";

export interface CustomRawSqlQueryPyItem {
  functionName: string;
  sqlArgNo: number; // 1-based index
  isStringTemplate: boolean;
}

export type CustomRawSqlQueryPy = CustomRawSqlQueryPyItem[];

// Note: We no longer need to load Python modules since we use JavaScript implementation

// Simple Python-like AST parser for extracting SQL from Python code
// This is a lightweight alternative to Pyodide for VSCode extension environment
export async function extractSqlListPy(
  sourceTxt: string,
  configs?: CustomRawSqlQueryPy,
): Promise<SqlNode[]> {
  try {
    // Use a lightweight JavaScript implementation instead of Pyodide
    return extractSqlFromPython(sourceTxt, configs);
  } catch (error) {
    console.error("Error in extractSqlListPy:", error);
    return [];
  }
}

// Lightweight JavaScript implementation for Python SQL extraction
function extractSqlFromPython(
  sourceTxt: string,
  configs?: CustomRawSqlQueryPy,
): SqlNode[] {
  const sqlNodes: SqlNode[] = [];
  const lines = sourceTxt.split("\n");

  // Default configurations
  const defaultConfigs: CustomRawSqlQueryPyItem[] = [
    { functionName: "execute", sqlArgNo: 1, isStringTemplate: false },
    { functionName: "executemany", sqlArgNo: 1, isStringTemplate: false },
    { functionName: "query", sqlArgNo: 1, isStringTemplate: false },
    { functionName: "raw", sqlArgNo: 1, isStringTemplate: false },
    { functionName: "text", sqlArgNo: 1, isStringTemplate: false },
  ];

  const activeConfigs = configs || defaultConfigs;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]?.trim() || "";

    for (const config of activeConfigs) {
      // Look for function calls like: cursor.execute("SQL", params)
      const functionPattern = new RegExp(
        `\\.${config.functionName}\\s*\\(|^\\s*${config.functionName}\\s*\\(`,
      );

      if (functionPattern.test(line)) {
        const sqlResult = extractSqlFromLine(lines, lineIndex, config);
        if (sqlResult) {
          sqlNodes.push(sqlResult);
        }
      }
    }
  }

  return sqlNodes;
}

function extractSqlFromLine(
  lines: string[],
  startLineIndex: number,
  config: CustomRawSqlQueryPyItem,
): SqlNode | null {
  let currentLine = startLineIndex;
  let fullLine = "";
  let parenthesesCount = 0;
  let inString = false;
  let stringChar = "";
  let foundFunction = false;
  const lineOffsets: number[] = [0]; // Track character offsets for each line

  // Collect the full function call (might span multiple lines)
  while (currentLine < lines.length) {
    const line = lines[currentLine] || "";
    fullLine += line;

    for (let i = 0; i < line.length; i++) {
      const char = line[i] || "";
      const prevChar = i > 0 ? line[i - 1] || "" : "";

      if (!inString) {
        if (char === '"' || char === "'" || (char === "`" && !foundFunction)) {
          inString = true;
          stringChar = char;
        } else if (char === "(") {
          parenthesesCount++;
          foundFunction = true;
        } else if (char === ")") {
          parenthesesCount--;
        }
      } else {
        if (char === stringChar && prevChar !== "\\") {
          // Check for triple quotes
          if (stringChar === '"' || stringChar === "'") {
            if (
              i >= 2 &&
              line?.substring(i - 2, i + 1) === stringChar.repeat(3)
            ) {
              // This is a triple quote, need to find the closing triple quote
              continue;
            }
          }
          inString = false;
          stringChar = "";
        }
      }
    }

    if (foundFunction && parenthesesCount === 0) {
      break;
    }

    currentLine++;
    if (currentLine < lines.length) {
      fullLine += "\n";
      lineOffsets.push(fullLine.length);
    }
  }

  // Extract SQL string from the function call
  const sqlString = extractSqlString(fullLine, config);
  if (sqlString) {
    const { content, start, end } = sqlString;

    // Convert character positions back to line/character coordinates
    const startPos = convertPositionToLineChar(
      start.character,
      lineOffsets,
      startLineIndex,
    );
    const endPos = convertPositionToLineChar(
      end.character,
      lineOffsets,
      startLineIndex,
    );

    return {
      code_range: {
        start: startPos,
        end: endPos,
      },
      content: content,
      method_line: startLineIndex,
    };
  }

  return null;
}

function convertPositionToLineChar(
  charOffset: number,
  lineOffsets: number[],
  baseLineIndex: number,
): { line: number; character: number } {
  // Find which line the character offset belongs to
  let lineIndex = 0;
  for (let i = 0; i < lineOffsets.length - 1; i++) {
    const currentOffset = lineOffsets[i];
    const nextOffset = lineOffsets[i + 1];
    if (
      currentOffset !== undefined &&
      nextOffset !== undefined &&
      charOffset >= currentOffset &&
      charOffset < nextOffset
    ) {
      lineIndex = i;
      break;
    }
  }
  const lastOffset = lineOffsets[lineOffsets.length - 1];
  if (lastOffset !== undefined && charOffset >= lastOffset) {
    lineIndex = lineOffsets.length - 1;
  }

  const lineStartOffset = lineOffsets[lineIndex] || 0;
  const character = charOffset - lineStartOffset;

  return {
    line: baseLineIndex + lineIndex,
    character: character,
  };
}

function extractSqlString(
  functionCall: string,
  config: CustomRawSqlQueryPyItem,
): {
  content: string;
  start: { line: number; character: number };
  end: { line: number; character: number };
} | null {
  // More flexible patterns that work with any function name
  const functionName = config.functionName;
  const patterns = [
    // Single line string: functionName("SELECT * FROM users")
    new RegExp(`${functionName}\\s*\\(\\s*["']([^"']*?)["']`, "i"),
    // Multi-line string: functionName("""SELECT...""")
    new RegExp(
      `${functionName}\\s*\\(\\s*(?:"""([\\s\\S]*?)"""|'''([\\s\\S]*?)''')`,
      "i",
    ),
    // Raw string: functionName(r"SELECT...")
    new RegExp(`${functionName}\\s*\\(\\s*r["']([^"']*?)["']`, "i"),
    // F-string: functionName(f"SELECT...")
    new RegExp(`${functionName}\\s*\\(\\s*f["']([^"']*?)["']`, "i"),
  ];

  for (const pattern of patterns) {
    const match = functionCall.match(pattern);
    if (match) {
      const sqlContent = match[1] || match[2] || match[3];
      if (sqlContent && sqlContent.trim()) {
        // Find the actual position of the SQL content
        const matchStart = functionCall.indexOf(match[0]);
        const contentStart = functionCall.indexOf(sqlContent, matchStart);
        return {
          content: sqlContent.trim(),
          start: { line: 0, character: contentStart },
          end: { line: 0, character: contentStart + sqlContent.length },
        };
      }
    }
  }

  // Fallback: Try to extract any string that looks like SQL
  const sqlKeywords = [
    "SELECT",
    "INSERT",
    "UPDATE",
    "DELETE",
    "CREATE",
    "ALTER",
    "DROP",
    "WITH",
  ];

  // Look for quoted strings
  const stringMatches = functionCall.match(/["'`]([\s\S]*?)["'`]/g);

  if (stringMatches) {
    for (const stringMatch of stringMatches) {
      const content = stringMatch.slice(1, -1); // Remove quotes
      const upperContent = content.toUpperCase();

      // Check if it contains SQL keywords
      if (sqlKeywords.some((keyword) => upperContent.includes(keyword))) {
        const startPos = functionCall.indexOf(stringMatch) + 1; // +1 to skip opening quote
        return {
          content: content.trim(),
          start: { line: 0, character: startPos },
          end: { line: 0, character: startPos + content.length },
        };
      }
    }
  }

  return null;
}
