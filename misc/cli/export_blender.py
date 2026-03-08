#!/usr/bin/env python3
"""Export Blender .blend files to GLB and/or Mitsuba XML.

Output lands in database/3d_models/<stem>/ by default (matching what the
simulation + frontend expect), but can be overridden with --out-dir.

Usage:
    python export_blender.py model.blend                  # GLB only
    python export_blender.py -f both model.blend          # GLB + Mitsuba XML
    python export_blender.py -f mitsuba *.blend           # Mitsuba XML for all
    python export_blender.py -d ./models/ -f both         # directory batch
    python export_blender.py -b ~/apps/blender/blender model.blend
"""

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

# ── Blender discovery ───────────────────────────────────────────────

_BLENDER_CANDIDATES = [
    Path.home() / "apps" / "blender-4.2.16-linux-x64" / "blender",
    Path("/usr/bin/blender"),
    Path("/usr/local/bin/blender"),
    Path("/Applications/Blender.app/Contents/MacOS/Blender"),
    Path(r"C:\Program Files\Blender Foundation\Blender 4.2\blender.exe"),
    Path(r"C:\Program Files\Blender Foundation\Blender 4.1\blender.exe"),
    Path(r"C:\Program Files\Blender Foundation\Blender 4.0\blender.exe"),
]

DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent.parent.parent / "database" / "3d_models"


def find_blender() -> str:
    """Return the first existing Blender binary, or fall back to 'blender'."""
    # Also check PATH via shutil.which
    which = shutil.which("blender")
    candidates = list(_BLENDER_CANDIDATES)
    if which:
        candidates.insert(0, Path(which))
    for p in candidates:
        if p.is_file():
            return str(p)
    return "blender"


# ── Blender script templates ───────────────────────────────────────

_GLB_SCRIPT = """\
import bpy, sys

blend_path = {blend!r}
glb_path = {glb!r}

print("Loading:", blend_path)
bpy.ops.wm.open_mainfile(filepath=blend_path)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

try:
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials='EXPORT',
        export_yup=True,
        export_animations=False,
    )
    print("Exported GLB:", glb_path)
except Exception as e:
    print("GLB export failed:", e, file=sys.stderr)
    sys.exit(1)
"""

_MITSUBA_SCRIPT = """\
import bpy, sys, addon_utils

blend_path = {blend!r}
xml_path = {xml!r}

print("Loading:", blend_path)
bpy.ops.wm.open_mainfile(filepath=blend_path)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Fix normals: clear custom split normals and recalculate to avoid
# mitsuba-blender "invalid normals" errors.
for obj in bpy.data.objects:
    if obj.type != 'MESH':
        continue
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    if obj.data.has_custom_normals:
        try:
            bpy.ops.mesh.customdata_custom_splitnormals_clear()
        except Exception:
            pass
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.select_set(False)

bpy.ops.object.select_all(action='SELECT')

try:
    addon_utils.enable('mitsuba-blender', default_set=True)
    print("mitsuba-blender addon enabled")
except Exception as e:
    print("mitsuba-blender addon enable failed:", e, file=sys.stderr)
    sys.exit(1)

try:
    bpy.ops.export_scene.mitsuba(filepath=xml_path)
    print("Exported Mitsuba XML:", xml_path)
except Exception as e:
    print("Mitsuba XML export failed:", e, file=sys.stderr)
    sys.exit(1)
"""


# ── Export functions ────────────────────────────────────────────────

def _run_blender_script(blender: str, script: str, verbose: bool) -> None:
    """Write *script* to a temp file and execute it with Blender --background."""
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".py", delete=False, encoding="utf-8"
    ) as tmp:
        tmp.write(script)
        script_path = tmp.name
    try:
        cmd = [blender, "--background", "--python", script_path]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if verbose:
            if result.stdout:
                print(result.stdout, end="")
        if result.returncode != 0:
            stderr = result.stderr or ""
            stdout = result.stdout or ""
            # Pull the most informative error line
            for line in (stderr + stdout).splitlines():
                if "failed" in line.lower() or "error" in line.lower():
                    raise RuntimeError(line.strip())
            raise RuntimeError(f"Blender exited with code {result.returncode}")
    finally:
        try:
            os.unlink(script_path)
        except OSError:
            pass


def export_glb(
    blend_path: str, output_dir: Path, blender: str, verbose: bool = False
) -> str:
    """Export *blend_path* to GLB inside *output_dir*. Returns the GLB path."""
    stem = Path(blend_path).stem
    out = output_dir / stem
    out.mkdir(parents=True, exist_ok=True)
    glb_path = str(out / f"{stem}.glb")
    script = _GLB_SCRIPT.format(
        blend=os.path.abspath(blend_path), glb=os.path.abspath(glb_path)
    )
    _run_blender_script(blender, script, verbose)
    if not os.path.exists(glb_path):
        raise RuntimeError(f"Output not created: {glb_path}")
    return glb_path


def export_mitsuba(
    blend_path: str, output_dir: Path, blender: str, verbose: bool = False
) -> str:
    """Export *blend_path* to Mitsuba XML inside *output_dir*. Returns the XML path."""
    stem = Path(blend_path).stem
    out = output_dir / stem
    out.mkdir(parents=True, exist_ok=True)
    xml_path = str(out / f"{stem}.xml")
    script = _MITSUBA_SCRIPT.format(
        blend=os.path.abspath(blend_path), xml=os.path.abspath(xml_path)
    )
    try:
        _run_blender_script(blender, script, verbose)
    except Exception:
        # Clean up empty/partial output
        for p in (xml_path,):
            if os.path.exists(p) and os.path.getsize(p) == 0:
                os.unlink(p)
        raise
    if not os.path.exists(xml_path) or os.path.getsize(xml_path) == 0:
        if os.path.exists(xml_path):
            os.unlink(xml_path)
        raise RuntimeError(f"Output not created or empty: {xml_path}")
    return xml_path


# ── File collection ─────────────────────────────────────────────────

def collect_blend_files(paths: list[str], recursive: bool = False) -> list[str]:
    """Gather .blend files from the given file/directory paths."""
    out: list[str] = []
    for p in paths:
        pp = Path(p)
        if pp.is_file() and pp.suffix.lower() == ".blend":
            out.append(str(pp.resolve()))
        elif pp.is_dir():
            pattern = "**/*.blend" if recursive else "*.blend"
            out.extend(str(f.resolve()) for f in sorted(pp.glob(pattern)))
    return out


# ── CLI ──────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export .blend files to GLB and/or Mitsuba XML.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
examples:
  %(prog)s model.blend                     Export to GLB (default)
  %(prog)s -f both model.blend             Export to GLB + Mitsuba XML
  %(prog)s -f mitsuba -d ./blends/         Batch Mitsuba export
  %(prog)s -f both -d ./blends/ -r         Recursive batch, both formats
  %(prog)s --out-dir ./output model.blend   Custom output directory
  %(prog)s --dry-run -d ./blends/          Preview without exporting
""",
    )
    parser.add_argument("files", nargs="*", help=".blend file(s)")
    parser.add_argument("-d", "--directory", metavar="DIR", help="Directory of .blend files")
    parser.add_argument("-r", "--recursive", action="store_true", help="Search directories recursively")
    parser.add_argument(
        "-f", "--format", choices=["glb", "mitsuba", "both"], default="glb",
        help="Output format (default: glb)",
    )
    parser.add_argument("-b", "--blender", metavar="PATH", help="Blender executable path")
    parser.add_argument("--out-dir", metavar="DIR", help=f"Output root (default: database/3d_models)")
    parser.add_argument("-v", "--verbose", action="store_true", help="Show Blender output")
    parser.add_argument("-q", "--quiet", action="store_true", help="Errors only")
    parser.add_argument("--dry-run", action="store_true", help="List files without exporting")
    args = parser.parse_args()

    # Collect inputs
    inputs = args.files or []
    if args.directory:
        inputs.append(args.directory)
    if not inputs:
        parser.error("Provide .blend files or use -d DIR")

    blend_files = collect_blend_files(inputs, recursive=args.recursive)
    if not blend_files:
        print("No .blend files found.", file=sys.stderr)
        sys.exit(1)

    blender = args.blender or find_blender()
    output_dir = Path(args.out_dir) if args.out_dir else DEFAULT_OUTPUT_DIR

    if not args.quiet:
        print(f"Blender:    {blender}")
        print(f"Format:     {args.format}")
        print(f"Output dir: {output_dir}")
        print(f"Files:      {len(blend_files)}")
        print()

    if args.dry_run:
        for f in blend_files:
            print(f"  {f}")
        sys.exit(0)

    ok = 0
    fail = 0
    for idx, bf in enumerate(blend_files, 1):
        if not args.quiet:
            print(f"[{idx}/{len(blend_files)}] {Path(bf).name}")

        file_ok = True

        if args.format in ("glb", "both"):
            try:
                glb = export_glb(bf, output_dir, blender, verbose=args.verbose)
                if not args.quiet:
                    print(f"  GLB:     {glb}")
            except Exception as e:
                file_ok = False
                print(f"  GLB ERROR: {e}", file=sys.stderr)

        if args.format in ("mitsuba", "both"):
            try:
                xml = export_mitsuba(bf, output_dir, blender, verbose=args.verbose)
                if not args.quiet:
                    print(f"  Mitsuba: {xml}")
            except Exception as e:
                file_ok = False
                print(f"  Mitsuba ERROR: {e}", file=sys.stderr)

        if file_ok:
            ok += 1
        else:
            fail += 1

    if not args.quiet:
        print(f"\nDone: {ok} succeeded, {fail} failed")

    sys.exit(0 if fail == 0 else 1)


if __name__ == "__main__":
    main()
