import os

with open('packages/frontend/src/components/FacultyDetail/SpecializationModal.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the isDark from inside SpecializationModal
content = content.replace(
    "export default function SpecializationModal({ specializations, onSave, onClose, isSaving }) {\n  const isDark = document.documentElement.getAttribute('data-mode') === 'dark'",
    "export default function SpecializationModal({ specializations, onSave, onClose, isSaving }) {"
)

# Put a getter at the top level
content = content.replace(
    "//  Proficiency levels \n",
    "//  Proficiency levels \nconst isDark = document.documentElement.getAttribute('data-mode') === 'dark';\n"
)

with open('packages/frontend/src/components/FacultyDetail/SpecializationModal.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed SpecializationModal ReferenceError")
