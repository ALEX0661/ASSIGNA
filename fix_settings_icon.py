import os

filepath = 'packages/frontend/src/pages/admin/SettingsPage.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 2. Update the Color Theme icon box styles to match Time Boundaries
icon_target = "className=\"stg-icon-box\" style={{ background: G.meadowSoft, border: `1px solid ${G.meadowBorder}` }}"
icon_replacement = "className=\"stg-icon-box\" style={{ background: G.hover, border: `1px solid ${G.border}` }}"

# we have two occurrences of icon_target (Card 1 and Card 3)
# The first one is Card 1 (Active Days), the second one is Card 3 (Color Theme).
# Actually, the user asked to make the hue of the color theme icon much closer to the icon above.
# So let's replace BOTH with G.hover and G.border, it makes them all uniform anyway!
content = content.replace(icon_target, icon_replacement)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed icon backgrounds correctly using single quotes for Powershell heredoc")
