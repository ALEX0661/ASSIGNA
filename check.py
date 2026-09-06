import os

with open('packages/frontend/src/pages/admin/RoomsPage.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, l in enumerate(lines):
    if 'isDark' in l or i in range(65, 75):
        print(f"{i+1}: {l.rstrip()}")
