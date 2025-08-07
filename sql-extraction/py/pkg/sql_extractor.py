"""
SQL extraction from Python source code using AST parsing.
"""

import ast
import json
from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel


class Position(BaseModel):
    """Position in source code (0-based)."""

    line: int
    character: int


class Range(BaseModel):
    """Range in source code."""

    start: Position
    end: Position


class SqlNode(BaseModel):
    """SQL node extracted from source code."""

    code_range: Range
    content: str
    method_line: int  # 0-based


class CustomRawSqlQueryPy(BaseModel):
    """Configuration for custom SQL query extraction."""

    functionName: str
    sqlArgNo: int = 1  # 1-based index, first argument is 1
    isStringTemplate: bool = False  # For f-strings or template strings


class SqlExtractor(ast.NodeVisitor):
    """AST visitor to extract SQL queries from Python code."""

    def __init__(self, source_lines: List[str], configs: List[CustomRawSqlQueryPy]):
        self.source_lines = source_lines
        self.configs = configs
        self.sql_nodes: List[SqlNode] = []

    def visit_Call(self, node: ast.Call) -> None:
        """Visit function call nodes."""
        # Handle direct function calls (e.g., execute("SELECT ..."))
        if isinstance(node.func, ast.Name):
            func_name = node.func.id
            self._process_function_call(node, func_name)

        # Handle method calls (e.g., cursor.execute("SELECT ..."))
        elif isinstance(node.func, ast.Attribute):
            func_name = node.func.attr
            self._process_function_call(node, func_name)

        self.generic_visit(node)

    def _process_function_call(self, node: ast.Call, func_name: str) -> None:
        """Process a function call that might contain SQL."""
        for config in self.configs:
            if func_name == config.functionName:
                if len(node.args) >= config.sqlArgNo:
                    sql_arg_index = config.sqlArgNo - 1
                    sql_arg = node.args[sql_arg_index]

                    # Handle string literals
                    if isinstance(sql_arg, ast.Constant) and isinstance(
                        sql_arg.value, str
                    ):
                        self._extract_sql_from_constant(sql_arg, node)

                    # Handle formatted strings (f-strings)
                    elif isinstance(sql_arg, ast.JoinedStr) and config.isStringTemplate:
                        self._extract_sql_from_fstring(sql_arg, node)

                    # Handle string concatenation
                    elif isinstance(sql_arg, ast.BinOp) and isinstance(
                        sql_arg.op, ast.Add
                    ):
                        self._extract_sql_from_binop(sql_arg, node)

    def _extract_sql_from_constant(
        self, sql_arg: ast.Constant, call_node: ast.Call
    ) -> None:
        """Extract SQL from a string constant."""
        sql_content = sql_arg.value

        # Calculate positions
        start_line = sql_arg.lineno - 1  # Convert to 0-based
        start_col = sql_arg.col_offset
        end_line = sql_arg.end_lineno - 1 if sql_arg.end_lineno else start_line
        end_col = (
            sql_arg.end_col_offset
            if sql_arg.end_col_offset
            else start_col + len(str(sql_content))
        )

        # Adjust for quotes
        if self.source_lines[start_line][start_col : start_col + 3] in ['"""', "'''"]:
            # Triple quoted string
            start_col += 3
            end_col -= 3
        elif self.source_lines[start_line][start_col] in ['"', "'"]:
            # Single or double quoted string
            start_col += 1
            end_col -= 1

        # Method line (function call line)
        method_line = call_node.lineno - 1

        sql_node = SqlNode(
            code_range=Range(
                start=Position(line=start_line, character=start_col),
                end=Position(line=end_line, character=end_col),
            ),
            content=sql_content,
            method_line=method_line,
        )

        self.sql_nodes.append(sql_node)

    def _extract_sql_from_fstring(
        self, sql_arg: ast.JoinedStr, call_node: ast.Call
    ) -> None:
        """Extract SQL from an f-string."""
        # For f-strings, we need to reconstruct the template
        sql_parts = []
        for value in sql_arg.values:
            if isinstance(value, ast.Constant):
                sql_parts.append(value.value)
            elif isinstance(value, ast.FormattedValue):
                # Add placeholder for formatted values
                sql_parts.append("{}")

        sql_content = "".join(sql_parts)

        # Calculate positions
        start_line = sql_arg.lineno - 1
        start_col = sql_arg.col_offset + 2  # Skip 'f"'
        end_line = sql_arg.end_lineno - 1 if sql_arg.end_lineno else start_line
        end_col = (
            sql_arg.end_col_offset - 1
            if sql_arg.end_col_offset
            else start_col + len(sql_content)
        )

        method_line = call_node.lineno - 1

        sql_node = SqlNode(
            code_range=Range(
                start=Position(line=start_line, character=start_col),
                end=Position(line=end_line, character=end_col),
            ),
            content=sql_content,
            method_line=method_line,
        )

        self.sql_nodes.append(sql_node)

    def _extract_sql_from_binop(self, sql_arg: ast.BinOp, call_node: ast.Call) -> None:
        """Extract SQL from binary operations (string concatenation)."""
        # This is a simplified version - could be extended for complex concatenations
        if isinstance(sql_arg.left, ast.Constant) and isinstance(
            sql_arg.right, ast.Constant
        ):
            if isinstance(sql_arg.left.value, str) and isinstance(
                sql_arg.right.value, str
            ):
                sql_content = sql_arg.left.value + sql_arg.right.value

                start_line = sql_arg.lineno - 1
                start_col = sql_arg.col_offset
                end_line = sql_arg.end_lineno - 1 if sql_arg.end_lineno else start_line
                end_col = (
                    sql_arg.end_col_offset
                    if sql_arg.end_col_offset
                    else start_col + len(sql_content)
                )

                method_line = call_node.lineno - 1

                sql_node = SqlNode(
                    code_range=Range(
                        start=Position(line=start_line, character=start_col),
                        end=Position(line=end_line, character=end_col),
                    ),
                    content=sql_content,
                    method_line=method_line,
                )

                self.sql_nodes.append(sql_node)


def extract_sql_list(
    source_txt: str, configs: Optional[List[Dict[str, Any]]] = None
) -> List[Dict[str, Any]]:
    """
    Extract SQL queries from Python source code.

    Args:
        source_txt: Python source code as string
        configs: List of configuration dictionaries for custom SQL extraction

    Returns:
        List of serialized SqlNode objects
    """
    # Default configurations for common Python SQL libraries
    default_configs = [
        CustomRawSqlQueryPy(functionName="execute", sqlArgNo=1),
        CustomRawSqlQueryPy(functionName="executemany", sqlArgNo=1),
        CustomRawSqlQueryPy(functionName="query", sqlArgNo=1),
        CustomRawSqlQueryPy(functionName="raw", sqlArgNo=1),  # Django ORM
        CustomRawSqlQueryPy(functionName="text", sqlArgNo=1),  # SQLAlchemy
    ]

    # Parse custom configurations if provided
    parsed_configs = default_configs
    if configs:
        try:
            parsed_configs = [
                CustomRawSqlQueryPy(**config)
                if isinstance(config, dict)
                else CustomRawSqlQueryPy.parse_obj(json.loads(config))
                for config in configs
            ]
        except Exception as e:
            print(f"Failed to parse configurations: {e}")
            parsed_configs = default_configs

    try:
        # Parse the source code
        tree = ast.parse(source_txt)
        source_lines = source_txt.splitlines()

        # Extract SQL nodes
        extractor = SqlExtractor(source_lines, parsed_configs)
        extractor.visit(tree)

        # Return serialized SQL nodes
        return [node.dict() for node in extractor.sql_nodes]

    except SyntaxError as e:
        print(f"Failed to parse Python source code: {e}")
        return []
    except Exception as e:
        print(f"Error during SQL extraction: {e}")
        return []
