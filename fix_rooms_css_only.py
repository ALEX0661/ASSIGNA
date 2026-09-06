import os

with open('packages/frontend/src/pages/admin/RoomsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    ".room-chip-idx {",
    "[data-mode=\"dark\"] .room-chip { color: var(--mint) !important; }\n    .room-chip-idx {"
)

content = content.replace(
    ".chip-del:hover {",
    "[data-mode=\"dark\"] .chip-del { color: var(--mint) !important; }\n      .chip-del:hover {"
)

content = content.replace(
    ".assign-trigger:hover {",
    "[data-mode=\"dark\"] .assign-trigger { color: var(--mint) !important; border-color: var(--mint) !important; }\n      .assign-trigger:hover {"
)

content = content.replace(
    ".assigned-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; background: ; color: ; border: 1px solid ; }",
    ".assigned-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; background: ; color: ; border: 1px solid ; }\n    [data-mode=\"dark\"] .assigned-pill { color: var(--mint) !important; }"
)

with open('packages/frontend/src/pages/admin/RoomsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Injected [data-mode=\"dark\"] overrides into RoomsPage.jsx")
