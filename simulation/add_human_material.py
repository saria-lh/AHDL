# add_human_material.py
"""
Adds a 'human' material entry to Sionna's ITU material color map and
ITU_MATERIALS_PROPERTIES with plausible RF parameters for human tissue.

Model form (matching Sionna/ITU code):
  epsilon_r = a * f_GHz^b
  sigma     = c * f_GHz^d

We add two frequency ranges chosen to join smoothly near 10 GHz:
  (0.5–10 GHz):  a=43.0, b=-0.16, c=0.8, d=0.7
  (10–100 GHz):  a=60.0, b=-0.30, c=1.2, d=0.5

Visualization color (preview only): (0.91, 0.76, 0.65)
"""

from pathlib import Path
import re
import sys
# /usr/local/lib/python3.12/site-packages/sionna/rt/radio_materials/itu_material.py
def find_site_packages(base=Path("/usr/local/lib")) -> Path:
    cands = sorted(base.glob("python*/site-packages"))
    if not cands:
        sys.exit("ERROR: Could not locate site-packages under /usr/local/lib")
    return cands[0]

def patch_colors(itu_material_py: Path) -> None:
    text = itu_material_py.read_text(encoding="utf-8")
    if '"human"' in text:
        print("colors: 'human' already present; skipping")
        return

    m = re.search(r'(ITU_MATERIAL_COLORS\s*=\s*{\s*)(.*?)(\n\s*}\s*)', text, flags=re.S)
    if not m:
        sys.exit("ERROR: Could not find ITU_MATERIAL_COLORS block")

    head, inner, tail = m.groups()
    inner = inner.rstrip()
    if not inner.endswith(','):
        inner += ','
    # neutral skin-like preview color; values in [0,1]
    inner += '\n        "human" : (0.91, 0.76, 0.65)'

    patched = text[:m.start()] + head + inner + tail + text[m.end():]
    itu_material_py.write_text(patched, encoding="utf-8")
    print("colors: added 'human' to ITU_MATERIAL_COLORS")

def patch_properties(itu_py: Path) -> None:
    text = itu_py.read_text(encoding="utf-8")
    if '"human"' in text:
        print("props: 'human' already present; skipping")
        return

    m = re.search(r'(ITU_MATERIALS_PROPERTIES\s*=\s*{\s*)(.*?)(\n\s*}\s*)', text, flags=re.S)
    if not m:
        sys.exit("ERROR: Could not find ITU_MATERIALS_PROPERTIES block")

    head, inner, tail = m.groups()
    inner = inner.rstrip()
    if not inner.endswith(','):
        inner += ','

    human_block = (
        '\n\n    "human"            :   { (0.5, 10.)    :   (43.0, -0.16, 0.8, 0.7),\n'
        '                              (10., 100.)   :   (60.0, -0.30, 1.2, 0.5) },'
    )

    patched = text[:m.start()] + head + inner + human_block + tail + text[m.end():]
    itu_py.write_text(patched, encoding="utf-8")
    print("props: added 'human' to ITU_MATERIALS_PROPERTIES")

def main():
    sp = find_site_packages()
    rt_dir = sp / "sionna" / "rt" / "radio_materials"
    itu_material_py = rt_dir / "itu_material.py"
    itu_py = rt_dir / "itu.py"

    if not itu_material_py.exists() or not itu_py.exists():
        sys.exit(f"ERROR: Expected files not found in {rt_dir}")

    patch_colors(itu_material_py)
    patch_properties(itu_py)

if __name__ == "__main__":
    main()
