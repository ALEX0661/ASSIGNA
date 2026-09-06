import os

with open('packages/frontend/src/components/FacultyDetail/SpecializationModal.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix BrowseCourseRow background and border
content = content.replace(
    "border: 1.5px solid ,",
    "border: 1.5px solid ,"
)
content = content.replace(
    "background: staged ? lvl.bg : already ? '#FAFAFF' : hovered ? '#FDFBFF' : '#FDFDFF',",
    "background: staged ? lvl.bg : already ? (isDark ? 'rgba(124, 58, 237, 0.05)' : 'var(--hover)') : hovered ? 'var(--hover)' : 'var(--surface)',"
)
content = content.replace(
    "color: '#1a1a2e'",
    "color: 'var(--ink)'"
)

# Fix unmatched container background
content = content.replace(
    "background: '#F9F9FB'",
    "background: 'var(--bg)'"
)

# Fix unmatched card border
content = content.replace(
    "border: '1px solid #E5E7EB'",
    "border: '1px solid var(--border)'"
)

# Fix unmatched input style
content = content.replace(
    "border: '1.5px solid #D1D5DB', borderRadius: 6, padding: '4px 8px', width: 120, outline: 'none' }",
    "border: '1.5px solid var(--border)', background: 'transparent', borderRadius: 6, padding: '4px 8px', width: 120, outline: 'none' }"
)

# Fix unmatched chip style
content = content.replace(
    "color: '#9CA3AF', background: '#F3F4F6'",
    "color: 'var(--muted)', background: 'var(--hover)'"
)
content = content.replace(
    "color: '#9CA3AF'",
    "color: 'var(--muted)'"
)

with open('packages/frontend/src/components/FacultyDetail/SpecializationModal.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed BrowseCourseRow and unmatched panel backgrounds")
