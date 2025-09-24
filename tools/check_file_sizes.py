#!/usr/bin/env python3
"""
File Size Monitor - Enforce 500 line limit across codebase
Part of STORY 5.4 refactoring to prevent file size bloat
"""

import os
import sys
from pathlib import Path
from typing import List, Tuple

# Configuration
MAX_LINES = 500
EXCLUDED_PATTERNS = [
    '__pycache__',
    '.git',
    'node_modules',
    '.pytest_cache',
    'backup',
    'test_',
    '_test.py',
    'tests/',
    'migrations/',
    '__init__.py',
    '.venv/',
    'venv/',
    'site-packages/',
    'dist/',
    'build/',
    '.egg-info/'
]

def should_exclude(file_path: str) -> bool:
    """Check if file should be excluded from size check"""
    for pattern in EXCLUDED_PATTERNS:
        if pattern in str(file_path):
            return True
    return False

def count_lines(file_path: Path) -> int:
    """Count lines in a file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return sum(1 for _ in f)
    except (UnicodeDecodeError, PermissionError):
        return 0

def check_python_files(root_dir: str) -> List[Tuple[str, int]]:
    """Check all Python files and return violations"""
    violations = []
    root_path = Path(root_dir)

    for file_path in root_path.rglob("*.py"):
        if should_exclude(str(file_path)):
            continue

        line_count = count_lines(file_path)
        if line_count > MAX_LINES:
            relative_path = file_path.relative_to(root_path)
            violations.append((str(relative_path), line_count))

    return violations

def main():
    """Main entry point"""
    if len(sys.argv) > 1:
        root_dir = sys.argv[1]
    else:
        # Default to project root
        script_dir = Path(__file__).parent
        root_dir = script_dir.parent

    print(f"🔍 Checking Python files for size violations (max {MAX_LINES} lines)")
    print(f"📁 Scanning: {root_dir}")
    print()

    violations = check_python_files(root_dir)

    if not violations:
        print("✅ All files comply with the 500-line limit!")
        return 0

    print(f"❌ Found {len(violations)} file(s) exceeding {MAX_LINES} lines:")
    print()

    for file_path, line_count in sorted(violations, key=lambda x: x[1], reverse=True):
        multiplier = line_count / MAX_LINES
        print(f"  📄 {file_path}: {line_count} lines ({multiplier:.1f}x limit)")

    print()
    print("💡 Consider refactoring these files into smaller modules:")
    print("   - Extract utility functions")
    print("   - Split by responsibility (CRUD, Analytics, etc.)")
    print("   - Use delegation pattern like TaskService")
    print("   - Move complex logic to separate services")

    return 1

if __name__ == "__main__":
    sys.exit(main())