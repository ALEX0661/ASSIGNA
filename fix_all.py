import os
import re

files = [
    'packages/frontend/src/pages/admin/SettingsPage.jsx',
    'packages/frontend/src/pages/admin/RoomsPage.jsx',
    'packages/frontend/src/components/FacultyEventsTable.jsx',
    'packages/frontend/src/components/FacultyDetail/SpecializationModal.jsx'
]

for filepath in files:
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace template literal interpolations first
        content = content.replace(
            "",
            "var(--meadow-text)"
        )
        content = content.replace(
            "",
            "var(--meadow-text-hover)"
        )
        
        # Replace inline styles and other js expressions
        content = content.replace(
            "isDark ? 'var(--mint)' : G.meadowDeep",
            "'var(--meadow-text)'"
        )
        content = content.replace(
            "isDark ? 'var(--mint)' : G.meadow",
            "'var(--meadow-text-hover)'"
        )
        content = content.replace(
            "isDark ? 'var(--mint)' : 'var(--meadow)'",
            "'var(--meadow-text-hover)'"
        )
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

print("Refactored inline isDark logic to use var(--meadow-text)")
