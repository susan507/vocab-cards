#!/usr/bin/env python3
"""
PostToolUse hook: Auto-format JS/TS files with oxfmt.

Triggers after Write/Edit operations on JS/TS files.
Runs the repo's local oxfmt binary.
Silent on success, only outputs on error.
"""

import json
import os
import subprocess
import sys

EXTENSIONS = {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'}


def get_repo_root():
    """Get the repo root from this script's location."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # Script is at .claude/hooks/oxfmt-format.py, repo root is 2 levels up
    return os.path.dirname(os.path.dirname(script_dir))


def main():
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, Exception):
        sys.exit(0)

    file_path = data.get('tool_input', {}).get('file_path', '')
    if not file_path:
        sys.exit(0)

    _, ext = os.path.splitext(file_path)
    if ext.lower() not in EXTENSIONS:
        sys.exit(0)

    repo_root = get_repo_root()

    if not os.path.isabs(file_path):
        file_path = os.path.join(repo_root, file_path)

    if not file_path.startswith(repo_root + os.sep):
        sys.exit(0)

    oxfmt = os.path.join(repo_root, 'node_modules', '.bin', 'oxfmt')
    if not os.path.isfile(oxfmt) or not os.access(oxfmt, os.X_OK):
        sys.exit(0)

    if not os.path.isfile(file_path):
        sys.exit(0)

    try:
        result = subprocess.run(
            [oxfmt, '--write', file_path],
            cwd=repo_root,
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode != 0:
            basename = os.path.basename(file_path)
            print(f'oxfmt failed: {basename}')
            if result.stderr:
                print(result.stderr.split('\n')[0])
    except subprocess.TimeoutExpired:
        print('oxfmt timeout')
    except Exception as e:
        print(f'oxfmt error: {e}')

    sys.exit(0)


if __name__ == '__main__':
    main()
