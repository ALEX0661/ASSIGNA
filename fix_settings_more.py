import os

with open('packages/frontend/src/pages/admin/SettingsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "color: activeTheme === t.id ? G.meadow : G.muted",
    "color: activeTheme === t.id ? (isDark ? 'var(--mint)' : G.meadow) : G.muted"
)

# And fix the strokes for icons
content = content.replace(
    "stroke={G.meadow}",
    "stroke={isDark ? 'var(--mint)' : G.meadow}"
)


with open('packages/frontend/src/pages/admin/SettingsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Injected additional fixes for SettingsPage.jsx")
