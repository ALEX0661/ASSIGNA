import os
import re

with open('packages/frontend/src/pages/admin/RoomsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix room-chip
content = re.sub(
    r"(\.room-chip\s*\{[^}]*?)color:\s*\$\{G\.meadowDeep\};",
    r"\1color: ;",
    content
)

# Fix chip-del
content = re.sub(
    r"(\.chip-del\s*\{[^}]*?)color:\s*\$\{G\.meadow\};",
    r"\1color: ;",
    content
)

# Fix assign-trigger
content = re.sub(
    r"(\.assign-trigger\s*\{[^}]*?)color:\s*\$\{G\.meadowDeep\};([^}]*?)border:\s*1px dashed \$\{G\.meadow\};",
    r"\1color: ;\2border: 1px dashed ;",
    content
)

# Fix assigned-pill
content = re.sub(
    r"(\.assigned-pill\s*\{[^}]*?)color:\s*\$\{G\.meadowDeep\};",
    r"\1color: ;",
    content
)

with open('packages/frontend/src/pages/admin/RoomsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Injected targeted regex text color fixes into RoomsPage.jsx")
