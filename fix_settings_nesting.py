import os

filepath = 'packages/frontend/src/pages/admin/SettingsPage.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix the missing closing tags before Card 3
target_str = "        {/* Card 3 - Color Theme */}"
replacement_str = """          </div>
        </div>

        {/* Card 3 - Color Theme */}"""

if "          </div>\n        </div>\n\n        {/* Card 3 - Color Theme */}" not in content:
    content = content.replace(target_str, replacement_str)

# 2. Update the Color Theme icon box styles to match Time Boundaries
icon_target = "className=\"stg-icon-box\" style={{ background: G.meadowSoft, border: 1px solid  }}"
icon_replacement = "className=\"stg-icon-box\" style={{ background: G.hover, border: 1px solid  }}"
content = content.replace(icon_target, icon_replacement)

# 3. Update the SVG stroke to var(--meadow) instead of var(--meadow-text-hover) to match the clock icon hue
svg_target = "stroke={'var(--meadow-text-hover)'} strokeWidth=\"2.5\" strokeLinecap=\"round\" strokeLinejoin=\"round\"><circle cx=\"13.5\""
svg_replacement = "stroke={'var(--meadow)'} strokeWidth=\"2.5\" strokeLinecap=\"round\" strokeLinejoin=\"round\"><circle cx=\"13.5\""
content = content.replace(svg_target, svg_replacement)

# Let's also fix the Dark Mode toggle icon box to match while we're at it (it was using G.meadowSoft)
dark_mode_box_target = "width: 36, height: 36, borderRadius: '50%', background: G.meadowSoft, display: 'flex'"
dark_mode_box_replacement = "width: 36, height: 36, borderRadius: '50%', background: G.hover, border: 1px solid , display: 'flex'"
content = content.replace(dark_mode_box_target, dark_mode_box_replacement)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed nesting and Color Theme icon styles in SettingsPage.jsx")
