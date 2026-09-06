import os
import re

with open('packages/frontend/src/components/FacultyDetail/SpecializationModal.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Manual tab background
content = content.replace(
    "background: '#FAFAFF', border: '1px solid \ncolor-mix(in srgb, #6D28D9 15%, transparent)'",
    "background: isDark ? 'rgba(124, 58, 237, 0.05)' : '#FAFAFF', border: '1px solid \ncolor-mix(in srgb, #6D28D9 15%, transparent)'"
)
# Note: Actually it's probably on the same line, let's use regex.
content = re.sub(
    r"background:\s*'#FAFAFF',\s*border:\s*'1px solid color-mix",
    r"background: isDark ? 'rgba(124, 58, 237, 0.05)' : '#FAFAFF', border: '1px solid color-mix",
    content
)

# 2. Input field border
content = re.sub(
    r"\? '#FCA5A5' : '#E5E7EB'\}",
    r"? '#FCA5A5' : 'var(--border)'}",
    content
)

# 3. Manual rating buttons
content = re.sub(
    r": '#EDE9FA'\}",
    r": 'var(--border)'}",
    content
)
content = re.sub(
    r": '#FAFAFE'",
    r": 'var(--surface)'",
    content
)
content = re.sub(
    r": '#C4BFDF'",
    r": 'var(--muted)'",
    content
)

# 4. BrowseCourseRow border
content = re.sub(
    r"hovered \? '#E8E3F8' : '#F3F0FE'",
    r"hovered ? 'var(--meadow-border)' : 'var(--border)'",
    content
)

# 5. RatingPips inactive background that was '#F8F7FC'
content = re.sub(
    r": '#F8F7FC'",
    r": 'var(--surface)'",
    content
)


with open('packages/frontend/src/components/FacultyDetail/SpecializationModal.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed remaining hex color hardcodes")
