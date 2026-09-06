import os
import re

directories = ['packages/frontend/src/pages', 'packages/frontend/src/components']

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    
    # We want to find "color: " followed by anything up to a comma or closing brace
    # and replace G.meadowDeep, G.meadow, G.meadowMid inside that chunk.
    def replacer(match):
        chunk = match.group(0)
        chunk = chunk.replace('G.meadowDeep', "'var(--meadow-text)'")
        chunk = chunk.replace('', "var(--meadow-text)")
        chunk = chunk.replace('G.meadowMid', "'var(--meadow-text-hover)'")
        chunk = chunk.replace('', "var(--meadow-text-hover)")
        # Be careful not to replace G.meadowSoft etc
        chunk = re.sub(r'G\.meadow(?!\w)', "'var(--meadow-text-hover)'", chunk)
        chunk = re.sub(r'\$\{G\.meadow\}(?!\w)', "var(--meadow-text-hover)", chunk)
        # Also clean up "'var(--meadow-text)'" inside a template string if it happens
        chunk = chunk.replace("", "var(--meadow-text)")
        chunk = chunk.replace("", "var(--meadow-text-hover)")
        return chunk

    # Matches color: followed by whitespace, then any characters except } or , or ;, then closing.
    # Wait, if there are nested objects or function calls, it might have commas.
    # A safer way: just match lines that contain "color:" and replace only AFTER "color:".
    
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'color:' in line or 'color=' in line:
            # find all occurrences of G.meadow... in this line and check if they come after 'color'
            # (Assuming one styling per line mostly)
            # Actually, just regex replace all G.meadow variants IF "color" is in the line? No, the line might have "background: G.meadow, color: G.ink"
            # Let's split the line by "color:"
            parts = line.split('color:')
            new_line = parts[0]
            for part in parts[1:]:
                # part contains the value of color: up to the next CSS property or end of object
                # It's a bit hacky but we can just replace G.meadow etc in the first few words of part?
                # Actually, let's just do a manual replace on the whole part if it's an inline style or CSS block!
                # Wait, if part has ackground: G.meadow, it will replace that too.
                # Let's split by , or ; and only replace in the first segment!
                
                # We need to find the boundary of the color value.
                # In inline styles: color: isMine ? G.meadowDeep : G.ink, background: G.meadow
                # So the boundary is , or }.
                
                # In CSS strings: color: ; background: 
                # Boundary is ; or }.
                
                match = re.search(r'^([^,;\}]+)', part)
                if match:
                    color_val = match.group(1)
                    new_color_val = color_val.replace('G.meadowDeep', "'var(--meadow-text)'")
                    new_color_val = new_color_val.replace('', "var(--meadow-text)")
                    new_color_val = new_color_val.replace('G.meadowMid', "'var(--meadow-text-hover)'")
                    new_color_val = new_color_val.replace('', "var(--meadow-text-hover)")
                    new_color_val = re.sub(r'G\.meadow(?!\w)', "'var(--meadow-text-hover)'", new_color_val)
                    new_color_val = re.sub(r'\$\{G\.meadow\}(?!\w)', "var(--meadow-text-hover)", new_color_val)
                    
                    part = new_color_val + part[len(color_val):]
                
                new_line += 'color:' + part
            
            # Also handle color={
            parts2 = new_line.split('color={')
            new_line2 = parts2[0]
            for part in parts2[1:]:
                match = re.search(r'^([^\}]+)', part)
                if match:
                    color_val = match.group(1)
                    new_color_val = color_val.replace('G.meadowDeep', "'var(--meadow-text)'")
                    new_color_val = new_color_val.replace('G.meadowMid', "'var(--meadow-text-hover)'")
                    new_color_val = re.sub(r'G\.meadow(?!\w)', "'var(--meadow-text-hover)'", new_color_val)
                    
                    part = new_color_val + part[len(color_val):]
                new_line2 += 'color={' + part

            lines[i] = new_line2

    content = '\n'.join(lines)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

for d in directories:
    for root, dirs, files in os.walk(d):
        for file in files:
            if file.endswith('.jsx'):
                process_file(os.path.join(root, file))

print("Done advanced replace!")
