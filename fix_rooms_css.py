import os
import re

with open('packages/frontend/src/pages/admin/RoomsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix .room-chip
content = content.replace(
    "color: ;",
    "color: ;"
)
content = content.replace(
    ".room-chip:hover",
    "[data-mode=\"dark\"] .room-chip { color: var(--mint); }\n    .room-chip:hover"
)

# Fix .chip-del
content = content.replace(
    "color: ; cursor: pointer;",
    "color: ; cursor: pointer;"
)
content = content.replace(
    ".chip-del:hover",
    "[data-mode=\"dark\"] .chip-del { color: var(--mint); }\n    .chip-del:hover"
)

# Fix .assign-trigger
content = content.replace(
    "color: ; border: 1px dashed ;",
    "color: ; border: 1px dashed ;"
)
content = content.replace(
    ".assign-trigger:hover",
    "[data-mode=\"dark\"] .assign-trigger { color: var(--mint); border-color: var(--mint); }\n    .assign-trigger:hover"
)

# Fix .assigned-pill
content = content.replace(
    ".assigned-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; background: ; color: ; border: 1px solid ; }",
    ".assigned-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; background: ; color: ; border: 1px solid ; }\n    [data-mode=\"dark\"] .assigned-pill { color: var(--mint); }"
)

with open('packages/frontend/src/pages/admin/RoomsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed RoomsPage CSS")
