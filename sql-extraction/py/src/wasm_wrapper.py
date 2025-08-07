"""
WASM wrapper for Python SQL extractor.
This module provides a JavaScript-compatible interface.
"""

import json
from typing import List, Dict, Any, Optional

try:
    from py.sql_extractor import extract_sql_list as _extract_sql_list
except ImportError:
    from sql_extractor import extract_sql_list as _extract_sql_list


def extract_sql_list(source_txt: str, configs: Optional[str] = None) -> str:
    """
    Extract SQL queries from Python source code (WASM-compatible version).

    Args:
        source_txt: Python source code as string
        configs: JSON string of configuration list (optional)

    Returns:
        JSON string of serialized SqlNode list
    """
    try:
        parsed_configs = None
        if configs:
            parsed_configs = json.loads(configs)

        results = _extract_sql_list(source_txt, parsed_configs)
        return json.dumps(results)

    except Exception as e:
        print(f"Error in extract_sql_list: {e}")
        return json.dumps([])


# Export for JavaScript
__all__ = ["extract_sql_list"]
