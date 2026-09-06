import os

with open('packages/frontend/src/pages/admin/SettingsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

if 'const isDark =' not in content:
    content = content.replace(
        "import { useEffect, useRef, useState, useMemo, useCallback } from 'react'",
        "import { useEffect, useRef, useState, useMemo, useCallback } from 'react'\n\nconst isDark = document.documentElement.getAttribute('data-mode') === 'dark';"
    )

content = content.replace(
    "background: ${G.meadowSoft}; border-color: ${G.meadowBorder}; color: ${G.meadowDeep};",
    "background: ${G.meadowSoft}; border-color: ${G.meadowBorder}; color: ${isDark ? 'var(--mint)' : G.meadowDeep};"
)

with open('packages/frontend/src/pages/admin/SettingsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Injected text color fix for active days into SettingsPage.jsx")
