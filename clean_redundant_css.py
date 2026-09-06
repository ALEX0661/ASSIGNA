import os

files = {
    'packages/frontend/src/pages/admin/SettingsPage.jsx': [
        '[data-mode="dark"] .day-btn.active { color: var(--mint) !important; }\n    '
    ],
    'packages/frontend/src/pages/admin/RoomsPage.jsx': [
        '[data-mode="dark"] .room-chip { color: var(--mint) !important; }\n    ',
        '[data-mode="dark"] .chip-del { color: var(--mint) !important; }\n      ',
        '[data-mode="dark"] .assign-trigger { color: var(--mint) !important; border-color: var(--mint) !important; }\n      ',
        '    [data-mode="dark"] .assigned-pill { color: var(--mint) !important; }'
    ]
}

for filepath, strings_to_remove in files.items():
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        for s in strings_to_remove:
            content = content.replace(s, '')
            
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

print("Cleaned up redundant CSS overrides")
