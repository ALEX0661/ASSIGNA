import os

filepath = 'packages/frontend/src/pages/LoginPage.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Make the disabled button explicitly retain its gradient, with enough specificity to beat the global hover reset.
content = content.replace(
    '.login-btn:disabled { opacity: .6; cursor: default; box-shadow: none; }',
    '.login-root .login-btn:disabled { background: linear-gradient(135deg, var(--meadow) 0%, var(--meadow-deep) 100%); opacity: .6; cursor: default; box-shadow: none; color: #fff; }'
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed disappearing login button bug!")
