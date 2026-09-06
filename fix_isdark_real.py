import os

with open('packages/frontend/src/pages/admin/RoomsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "import { useEffect, useRef, useState, useMemo, useCallback } from 'react'",
    "import { useEffect, useRef, useState, useMemo, useCallback } from 'react'\n\nconst isDark = document.documentElement.getAttribute('data-mode') === 'dark';"
)

with open('packages/frontend/src/pages/admin/RoomsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Actually injected isDark")
