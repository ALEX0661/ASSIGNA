import os
import re

with open('packages/frontend/src/pages/admin/SettingsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix .day-btn.active in SettingsPage.jsx
content = content.replace(
    "color: ;",
    "color: ;"
)
content = content.replace(
    ".day-btn-title { font-size: 13px; font-weight: 700; }",
    "[data-mode=\"dark\"] .day-btn.active { color: var(--mint); }\n    .day-btn-title { font-size: 13px; font-weight: 700; }"
)

with open('packages/frontend/src/pages/admin/SettingsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed SettingsPage CSS")
