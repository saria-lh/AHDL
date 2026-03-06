#!/usr/bin/env python3
"""CLI tool for exporting Blender .blend files to GLB and Mitsuba XML formats.

Usage examples:
    # Export single file to GLB
    python export_from_blender_cli.py model.blend

    # Export multiple files to GLB
    python export_from_blender_cli.py model1.blend model2.blend model3.blend

    # Export to Mitsuba XML format
    python export_from_blender_cli.py -f mitsuba model.blend

    # Export all .blend files in a directory
    python export_from_blender_cli.py -d ./my_models/

    # Specify custom Blender path
    python export_from_blender_cli.py -b /path/to/blender model.blend
"""

import argparse
import os
import sys
import tempfile
import subprocess
from pathlib import Path


def find_blender_executable():
    """Try to locate Blender executable automatically across OSes.

    Returns:
        str: Path to the Blender executable or 'blender' if not found in common locations.
    """
    candidates = [
        r"C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe",
        r"C:\\Program Files\\Blender Foundation\\Blender 4.1\\blender.exe",
        r"C:\\Program Files\\Blender Foundation\\Blender 4.0\\blender.exe",
        r"C:\\Program Files\\Blender Foundation\\Blender 3.6\\blender.exe",
        r"/usr/bin/blender",
        r"/usr/local/bin/blender",
        "/Applications/Blender.app/Contents/MacOS/Blender",
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    return "blender"


# Get the path to database/3d_models relative to this script
THREE_D_MODELS_DIR = Path(__file__).parent.parent / "database" / "3d_models"


def export_blend_to_glb(blend_path: str, output_basename: str | None = None, blender_path: str | None = None, verbose: bool = False) -> str:
    """Export a .blend file to .glb (GLTF binary) in database/3d_models/<filename>/.

    Args:
        blend_path: Path to the input .blend file.
        output_basename: Optional base name for output file. If None, uses the input file name.
        blender_path: Optional path to the Blender executable. If None, tries to find it automatically.
        verbose: If True, print Blender output.

    Returns:
        str: Path to the written .glb file.

    Raises:
        FileNotFoundError: If the input blend file does not exist.
        RuntimeError: If the Blender export process fails.
    """
    if blender_path is None:
        blender_path = find_blender_executable()

    if not os.path.exists(blend_path):
        raise FileNotFoundError(f"Blend file not found: {blend_path}")

    base = os.path.splitext(os.path.basename(blend_path))[0]
    if output_basename is None:
        output_basename = base

    # Create output directory in database/3d_models/<filename>/
    output_dir = THREE_D_MODELS_DIR / base
    output_dir.mkdir(parents=True, exist_ok=True)

    output_glb = str(output_dir / f"{output_basename}.glb")

    script_lines = [
        "import bpy, sys",
        f"blend_path = r'{os.path.abspath(blend_path)}'",
        f"glb_path = r'{os.path.abspath(output_glb)}'",
        "print('Loading:', blend_path)",
        "bpy.ops.wm.open_mainfile(filepath=blend_path)",
        "bpy.ops.object.select_all(action='SELECT')",
        "bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)",
        "try:",
        "    bpy.ops.export_scene.gltf(",
        f"        filepath=glb_path,",
        "        export_format='GLB',",
        "        use_selection=False,",
        "        export_apply=True,",
        "        export_texcoords=True,",
        "        export_normals=True,",
        "        export_materials='EXPORT',",
        "        export_yup=True,",
        "        export_animations=False,",
        "    )",
        "    print('Exported GLB: ' + glb_path)",
        "except Exception as e:",
        "    print('GLB export failed: ' + str(e))",
        "    sys.exit(1)",
        "print('\\nDone exporting GLB!\\n')"
    ]
    script = "\n".join(script_lines)

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as tmp:
        tmp.write(script)
        script_path = tmp.name

    try:
        cmd = [blender_path, "--background", "--python", script_path]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if verbose and result.stdout:
            print(result.stdout)
        if result.returncode != 0:
            if result.stderr:
                print(result.stderr, file=sys.stderr)
            raise RuntimeError(f"Blender export failed for {blend_path}")
        # Verify output file was created
        if not os.path.exists(output_glb):
            raise RuntimeError(f"Export completed but output file not found: {output_glb}")
        return output_glb
    finally:
        try:
            os.unlink(script_path)
        except Exception:
            pass


def export_blend_to_mitsuba(blend_path: str, output_basename: str | None = None, blender_path: str | None = None, verbose: bool = False) -> str:
    """Export a .blend file to Mitsuba XML in database/3d_models/<filename>/.

    Args:
        blend_path: Path to the input .blend file.
        output_basename: Optional base name for output file. If None, uses the input file name.
        blender_path: Optional path to the Blender executable. If None, tries to find it automatically.
        verbose: If True, print Blender output.

    Returns:
        str: Path to the written .xml file.

    Raises:
        FileNotFoundError: If the input blend file does not exist.
        RuntimeError: If the Blender export process fails.
    """
    if blender_path is None:
        blender_path = find_blender_executable()

    if not os.path.exists(blend_path):
        raise FileNotFoundError(f"Blend file not found: {blend_path}")

    base = os.path.splitext(os.path.basename(blend_path))[0]
    if output_basename is None:
        output_basename = base

    # Create output directory in database/3d_models/<filename>/
    output_dir = THREE_D_MODELS_DIR / base
    output_dir.mkdir(parents=True, exist_ok=True)

    output_xml = str(output_dir / f"{output_basename}.xml")

    script_lines = [
        "import bpy, sys, os, addon_utils",
        "# Initialize mitsuba before enabling addon",
        "os.environ['DRJIT_NO_RTLD_DEEPBIND'] = 'True'",
        "import mitsuba",
        "mitsuba.set_variant('scalar_rgb')",
        "print('Mitsuba initialized:', mitsuba.__version__)",
        f"blend_path = r'{os.path.abspath(blend_path)}'",
        f"xml_path = r'{os.path.abspath(output_xml)}'",
        "print('Loading:', blend_path)",
        "bpy.ops.wm.open_mainfile(filepath=blend_path)",
        "# Enable addon (will auto-register with mitsuba available)",
        "addon_utils.enable('mitsuba-blender', default_set=True)",
        "print('Mitsuba addon enabled')",
        "bpy.ops.object.select_all(action='SELECT')",
        "bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)",
        "try:",
        "    bpy.ops.export_scene.mitsuba(filepath=xml_path)",
        "    print('Exported Mitsuba XML: ' + xml_path)",
        "except Exception as e:",
        "    print('Mitsuba XML export failed: ' + str(e))",
        "    sys.exit(1)",
        "print('\\nDone exporting Mitsuba XML!\\n')",
    ]
    script = "\n".join(script_lines)

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as tmp:
        tmp.write(script)
        script_path = tmp.name

    try:
        cmd = [blender_path, "--background", "--python", script_path]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if verbose and result.stdout:
            print(result.stdout)
        if result.returncode != 0:
            if result.stderr:
                print(result.stderr, file=sys.stderr)
            raise RuntimeError(f"Blender export failed for {blend_path}")
        # Verify output file was created
        if not os.path.exists(output_xml):
            raise RuntimeError(f"Export completed but output file not found: {output_xml}")
        return output_xml
    finally:
        try:
            os.unlink(script_path)
        except Exception:
            pass


def collect_blend_files(paths: list[str], recursive: bool = False) -> list[str]:
    """Collect all .blend files from the given paths.

    Args:
        paths: List of file paths or directory paths.
        recursive: If True, search directories recursively.

    Returns:
        List of .blend file paths.
    """
    blend_files = []
    for path in paths:
        p = Path(path)
        if p.is_file() and p.suffix.lower() == ".blend":
            blend_files.append(str(p))
        elif p.is_dir():
            pattern = "**/*.blend" if recursive else "*.blend"
            blend_files.extend(str(f) for f in p.glob(pattern))
    return blend_files


def main():
    parser = argparse.ArgumentParser(
        description="Export Blender .blend files to GLB or Mitsuba XML format.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s model.blend                     Export single file to GLB
  %(prog)s *.blend                         Export multiple files to GLB
  %(prog)s -d ./models/                    Export all .blend files in directory
  %(prog)s -d ./models/ -r                 Export recursively from directory
  %(prog)s -f mitsuba model.blend          Export to Mitsuba XML format
  %(prog)s -f both model.blend             Export to both GLB and Mitsuba
  %(prog)s -b /usr/bin/blender model.blend Use specific Blender executable
        """
    )

    parser.add_argument(
        "files",
        nargs="*",
        help="Input .blend file(s) to export"
    )

    parser.add_argument(
        "-d", "--directory",
        metavar="DIR",
        help="Directory containing .blend files to export"
    )

    parser.add_argument(
        "-r", "--recursive",
        action="store_true",
        help="Search directories recursively for .blend files"
    )

    parser.add_argument(
        "-f", "--format",
        choices=["glb", "mitsuba", "both"],
        default="glb",
        help="Output format: glb (default), mitsuba, or both"
    )

    parser.add_argument(
        "-b", "--blender",
        metavar="PATH",
        help="Path to Blender executable (auto-detected if not specified)"
    )

    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Show detailed Blender output"
    )

    parser.add_argument(
        "-q", "--quiet",
        action="store_true",
        help="Suppress all output except errors"
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be exported without actually exporting"
    )

    args = parser.parse_args()

    # Collect all input files
    input_paths = args.files or []
    if args.directory:
        input_paths.append(args.directory)

    if not input_paths:
        parser.error("No input files specified. Provide .blend files or use -d to specify a directory.")

    blend_files = collect_blend_files(input_paths, recursive=args.recursive)

    if not blend_files:
        print("No .blend files found.", file=sys.stderr)
        sys.exit(1)

    # Get Blender path
    blender_path = args.blender or find_blender_executable()

    if not args.quiet:
        print(f"Using Blender: {blender_path}")
        print(f"Found {len(blend_files)} .blend file(s) to export")
        print(f"Output format: {args.format}")
        print(f"Output directory: {THREE_D_MODELS_DIR}")
        print()

    if args.dry_run:
        print("Dry run - files that would be exported:")
        for f in blend_files:
            print(f"  {f}")
        sys.exit(0)

    # Export files
    success_count = 0
    fail_count = 0

    for idx, blend_file in enumerate(blend_files, start=1):
        if not args.quiet:
            print(f"[{idx}/{len(blend_files)}] Exporting: {blend_file}")

        try:
            if args.format in ("glb", "both"):
                glb_path = export_blend_to_glb(blend_file, blender_path=blender_path, verbose=args.verbose)
                if not args.quiet:
                    print(f"  -> GLB: {glb_path}")

            if args.format in ("mitsuba", "both"):
                xml_path = export_blend_to_mitsuba(blend_file, blender_path=blender_path, verbose=args.verbose)
                if not args.quiet:
                    print(f"  -> Mitsuba XML: {xml_path}")

            success_count += 1

        except Exception as ex:
            fail_count += 1
            print(f"  ERROR: {ex}", file=sys.stderr)

    # Summary
    if not args.quiet:
        print()
        print(f"Done: {success_count} succeeded, {fail_count} failed")

    sys.exit(0 if fail_count == 0 else 1)


if __name__ == "__main__":
    main()
