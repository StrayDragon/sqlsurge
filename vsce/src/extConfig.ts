import type { CustomRawSqlQueryPyItem } from "@senken/sql-extraction-py/src";
import { customRawSqlQueryTsSchema } from "@senken/sql-extraction-ts/src";
import * as v from "valibot";
import * as vscode from "vscode";
import { createLogger } from "./outputChannel";

const extConfigSchemas = v.object({
  formatOnSave: v.boolean(),
  "formatSql.indent": v.boolean(),
  customRawSqlQuery: v.union([
    v.object({
      language: v.literal("typescript"),
      configs: customRawSqlQueryTsSchema,
    }),
    v.object({
      language: v.literal("python"),
      configs: v.array(
        v.object({
          functionName: v.string(),
          sqlArgNo: v.pipe(v.number(), v.minValue(1)),
          isStringTemplate: v.boolean(),
        }),
      ),
    }),
  ]),
});

type ExtConfig = v.InferOutput<typeof extConfigSchemas>;
type ExtConfigKeys = keyof ExtConfig;

export function getWorkspaceConfig<T extends ExtConfigKeys>(
  extConfigKey: T,
): ExtConfig[T] | undefined {
  const logger = createLogger();

  const config = vscode.workspace
    .getConfiguration("sqlsurge")
    .get<ExtConfig[T]>(extConfigKey);
  const result = v.safeParse(extConfigSchemas.entries[extConfigKey], config);
  if (!result.success) {
    const flattenErrors = v.flatten(getIssuesRecursively(result.issues));
    const errors = flattenErrors.nested ?? flattenErrors.root;
    if (!errors) {
      throw new Error("Expected error but got undefined.");
    }
    logger.error(
      "[getWorkspaceConfig]",
      `sqlsurge: Invalid settings. ${JSON.stringify(errors, null, 2)}`,
    );
    vscode.window
      .showErrorMessage(
        "sqlsurge: Invalid settings. See output for details.",
        "Go to output",
      )
      .then((value) => {
        if (value === "Go to output") {
          logger.show();
        }
      });
    return undefined;
  }

  return result.output as any; // TODO: #75 Fix as assertion with using generics
}

function getIssuesRecursively<T extends v.BaseIssue<any>[]>(issues: T): T {
  let result: v.BaseIssue<any>[] = [];
  for (const issue of issues) {
    if (issue.issues) {
      result = result.concat(getIssuesRecursively(issue.issues));
    }
    result.push(issue);
  }
  return result as T;
}
