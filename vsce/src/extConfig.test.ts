import * as vscode from "vscode";
import { getWorkspaceConfig } from "../src/extConfig";
import * as outputChannel from "../src/outputChannel";

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetAllMocks();
});

describe("extConfig", () => {
  describe("getWorkspaceConfig", () => {
    it.each`
      key                    | expected
      ${"formatOnSave"}      | ${true}
      ${"formatSql.indent"}  | ${false}
      ${"customRawSqlQuery"} | ${{ language: "python", configs: [{ functionName: "functionName", sqlArgNo: 1, isStringTemplate: true }] }}
    `("Should return workspace config: sqlsurge.$key", ({ key, expected }) => {
      jest.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
        get: jest.fn().mockReturnValue(expected),
      } as unknown as vscode.WorkspaceConfiguration);

      const config = getWorkspaceConfig(key);
      expect(config).toStrictEqual(expected);
    });

    it.each`
      key                    | expected
      ${"formatOnSave"}      | ${"true"}
      ${"formatSql.indent"}  | ${"false"}
      ${"customRawSqlQuery"} | ${{ language: "unknown", configs: [{ functionName: "functionName", sqlArgNo: 0, isStringTemplate: true }] }}
    `(
      "Should return undefined with invalid config: sqlsurge.$key",
      ({ key, expected }) => {
        jest.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
          get: jest.fn().mockReturnValue(expected),
        } as unknown as vscode.WorkspaceConfiguration);
        jest.spyOn(outputChannel, "createLogger").mockReturnValue({
          error: jest.fn(),
        } as unknown as vscode.LogOutputChannel);
        jest
          .spyOn(vscode.window, "showErrorMessage")
          .mockResolvedValue(undefined);

        const config = getWorkspaceConfig(key);
        expect(config).toBeUndefined();
      },
    );
  });
});
