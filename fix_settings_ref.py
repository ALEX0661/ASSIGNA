import os
import re

with open('packages/frontend/src/pages/admin/SettingsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Insert isDark after the first import safely
if 'const isDark =' not in content:
    content = re.sub(
        r"^(import [^\n]+)",
        r"\1\n\nconst isDark = document.documentElement.getAttribute('data-mode') === 'dark';",
        content,
        count=1
    )

with open('packages/frontend/src/pages/admin/SettingsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Injected isDark to module scope in SettingsPage.jsx")
