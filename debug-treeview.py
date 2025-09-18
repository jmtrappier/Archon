#!/usr/bin/env python3

import requests
import subprocess
import json
import time

def check_compilation_errors():
    """Check for TypeScript compilation errors"""
    print("🔍 Checking compilation errors...")

    try:
        result = subprocess.run([
            'npx', 'tsc', '--noEmit', '--skipLibCheck'
        ], capture_output=True, text=True, timeout=30, cwd='/home/jmtrappier/Archon/archon-ui-main')

        if result.returncode != 0:
            errors = result.stderr
            if 'TreeView' in errors:
                print("❌ TreeView compilation errors:")
                print(errors)
                return False
            else:
                print("⚠️  Other compilation errors (not TreeView related)")
                return True
        else:
            print("✅ No compilation errors")
            return True
    except Exception as e:
        print(f"❌ Could not check compilation: {e}")
        return False

def check_missing_imports():
    """Check for missing import statements"""
    print("🔍 Checking TreeView imports...")

    files_to_check = [
        '/home/jmtrappier/Archon/archon-ui-main/src/features/projects/tasks/views/TreeView.tsx',
        '/home/jmtrappier/Archon/archon-ui-main/src/features/projects/tasks/TasksTab.tsx',
        '/home/jmtrappier/Archon/archon-ui-main/src/features/projects/tasks/views/index.ts'
    ]

    missing_items = []

    for file_path in files_to_check:
        try:
            with open(file_path, 'r') as f:
                content = f.read()

            if file_path.endswith('TreeView.tsx'):
                required_imports = [
                    'React', 'useState', 'useEffect', 'useMemo',
                    'ChevronRight', 'ChevronDown', 'GitBranch',
                    'cn', 'glassmorphism'
                ]

                for imp in required_imports:
                    if imp not in content:
                        missing_items.append(f"{file_path}: Missing {imp}")

            elif file_path.endswith('TasksTab.tsx'):
                if 'TreeView' not in content:
                    missing_items.append(f"{file_path}: TreeView not imported")
                if 'GitBranch' not in content:
                    missing_items.append(f"{file_path}: GitBranch icon not imported")

            elif file_path.endswith('index.ts'):
                if 'TreeView' not in content:
                    missing_items.append(f"{file_path}: TreeView not exported")

        except Exception as e:
            missing_items.append(f"{file_path}: Could not read file - {e}")

    if missing_items:
        print("❌ Missing imports/exports:")
        for item in missing_items:
            print(f"  - {item}")
        return False
    else:
        print("✅ All imports/exports look good")
        return True

def check_component_structure():
    """Check TreeView component structure"""
    print("🔍 Checking TreeView component structure...")

    tree_view_path = '/home/jmtrappier/Archon/archon-ui-main/src/features/projects/tasks/views/TreeView.tsx'

    try:
        with open(tree_view_path, 'r') as f:
            content = f.read()

        required_elements = [
            'export const TreeView',
            'TreeNode',
            'expand',
            'collapse',
            'localStorage',
            'glassmorphism',
            'onTaskClick',
            'onEpicClick',
            'onStoryClick',
            'filteredTree'
        ]

        missing_elements = []
        for element in required_elements:
            if element not in content:
                missing_elements.append(element)

        if missing_elements:
            print("❌ Missing component elements:")
            for element in missing_elements:
                print(f"  - {element}")
            return False
        else:
            print("✅ TreeView component structure looks good")
            return True

    except Exception as e:
        print(f"❌ Could not check TreeView structure: {e}")
        return False

def check_tasktab_integration():
    """Check TasksTab integration"""
    print("🔍 Checking TasksTab integration...")

    tasktab_path = '/home/jmtrappier/Archon/archon-ui-main/src/features/projects/tasks/TasksTab.tsx'

    try:
        with open(tasktab_path, 'r') as f:
            content = f.read()

        required_integrations = [
            'tree',
            'TreeView',
            'GitBranch',
            'subtasks',
            'topLevelTasks',
            'viewMode === "tree"'
        ]

        missing_integrations = []
        for integration in required_integrations:
            if integration not in content:
                missing_integrations.append(integration)

        if missing_integrations:
            print("❌ Missing TasksTab integrations:")
            for integration in missing_integrations:
                print(f"  - {integration}")
            return False
        else:
            print("✅ TasksTab integration looks good")
            return True

    except Exception as e:
        print(f"❌ Could not check TasksTab integration: {e}")
        return False

def fix_common_issues():
    """Fix common issues we can detect"""
    print("🔧 Attempting to fix common issues...")

    fixes_applied = []

    # Check if Badge import is missing in TreeView
    tree_view_path = '/home/jmtrappier/Archon/archon-ui-main/src/features/projects/tasks/views/TreeView.tsx'
    try:
        with open(tree_view_path, 'r') as f:
            content = f.read()

        # Check for Badge import
        if 'Badge' in content and 'from "@/features/ui/primitives/badge"' not in content:
            print("🔧 Adding Badge import to TreeView...")
            if 'import { Badge }' not in content:
                # Add Badge import
                import_line = 'import { Badge } from "@/features/ui/primitives/badge";'
                lines = content.split('\n')

                # Find the right place to add the import
                import_index = -1
                for i, line in enumerate(lines):
                    if line.startswith('import') and '@/features/ui' in line:
                        import_index = i + 1
                        break

                if import_index > 0:
                    lines.insert(import_index, import_line)
                    with open(tree_view_path, 'w') as f:
                        f.write('\n'.join(lines))
                    fixes_applied.append("Added Badge import to TreeView")

        # Check for Tooltip imports
        if 'Tooltip' in content and 'from "@/features/ui/primitives/tooltip"' not in content:
            print("🔧 Tooltip import may be missing...")
            fixes_applied.append("Identified missing Tooltip import")

    except Exception as e:
        print(f"⚠️  Could not apply fixes: {e}")

    if fixes_applied:
        print("✅ Fixes applied:")
        for fix in fixes_applied:
            print(f"  - {fix}")
        return True
    else:
        print("ℹ️  No fixes needed or applied")
        return False

def run_diagnostics():
    """Run all diagnostics"""
    print("🚀 Running TreeView diagnostics...\n")

    results = []

    # Check server
    try:
        response = requests.get("http://localhost:3737", timeout=5)
        if response.status_code == 200:
            print("✅ Server is running")
            results.append(True)
        else:
            print(f"❌ Server responded with {response.status_code}")
            results.append(False)
    except Exception as e:
        print(f"❌ Server not accessible: {e}")
        results.append(False)

    # Check compilation
    results.append(check_compilation_errors())

    # Check imports
    results.append(check_missing_imports())

    # Check component structure
    results.append(check_component_structure())

    # Check integration
    results.append(check_tasktab_integration())

    # Try to fix issues
    fix_common_issues()

    print(f"\n📊 Results: {sum(results)}/{len(results)} checks passed")

    if all(results):
        print("🎉 All checks passed! TreeView should be working.")
    else:
        print("💥 Some issues found. Check the output above for details.")

        # Suggest next steps
        print("\n🔧 Suggested fixes:")
        if not results[1]:  # Compilation
            print("  - Fix TypeScript compilation errors")
        if not results[2]:  # Imports
            print("  - Add missing imports in TreeView.tsx")
        if not results[3]:  # Component
            print("  - Check TreeView component implementation")
        if not results[4]:  # Integration
            print("  - Fix TasksTab integration")

if __name__ == "__main__":
    run_diagnostics()