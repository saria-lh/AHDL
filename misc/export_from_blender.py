import flet as ft
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


def export_blend_to_glb(blend_path: str, output_basename: str | None = None, blender_path: str | None = None) -> str:
    """Export a .blend file to .glb (GLTF binary) in database/3d_models/<filename>/.
    
    Args:
        blend_path: Path to the input .blend file.
        output_basename: Optional base name for output file. If None, uses the input file name.
        blender_path: Optional path to the Blender executable. If None, tries to find it automatically.
        
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
        "import bpy, os",
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
        "    raise",
        "print('\\nDone exporting GLB!\\n')"
    ]
    script = "\n".join(script_lines)

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as tmp:
        tmp.write(script)
        script_path = tmp.name

    try:
        cmd = [blender_path, "--background", "--python", script_path]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.stdout:
            print(result.stdout)
        if result.returncode != 0:
            if result.stderr:
                print(result.stderr)
            raise RuntimeError(f"Blender export failed for {blend_path}")
        return output_glb
    finally:
        try:
            os.unlink(script_path)
        except Exception:
            pass




def export_blend_to_mitsuba(blend_path: str, output_basename: str | None = None, blender_path: str | None = None) -> str:
    """Export a .blend file to Mitsuba XML in database/3d_models/<filename>/.
    
    Args:
        blend_path: Path to the input .blend file.
        output_basename: Optional base name for output file. If None, uses the input file name.
        blender_path: Optional path to the Blender executable. If None, tries to find it automatically.
        
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
        "import bpy, os, addon_utils",
        f"blend_path = r'{os.path.abspath(blend_path)}'",
        f"xml_path = r'{os.path.abspath(output_xml)}'",
        "print('Loading:', blend_path)",
        "bpy.ops.wm.open_mainfile(filepath=blend_path)",
        "bpy.ops.object.select_all(action='SELECT')",
        "bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)",
        "try:",
        "    addon_utils.enable('io_scene_mitsuba', default=True)",
        "except Exception as e:",
        "    print('Mitsuba addon enable failed: ' + str(e))",
        "try:",
        "    bpy.ops.export_scene.mitsuba(filepath=xml_path)",
        "    print('Exported Mitsuba XML: ' + xml_path)",
        "except Exception as e:",
        "    print('Mitsuba XML export failed: ' + str(e))",
        "    raise",
        "print('\\nDone exporting Mitsuba XML!\\n')",
    ]
    script = "\n".join(script_lines)

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as tmp:
        tmp.write(script)
        script_path = tmp.name

    try:
        cmd = [blender_path, "--background", "--python", script_path]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.stdout:
            print(result.stdout)
        if result.returncode != 0:
            if result.stderr:
                print(result.stderr)
            raise RuntimeError(f"Blender export failed for {blend_path}")
        return output_xml
    finally:
        try:
            os.unlink(script_path)
        except Exception:
            pass
def main(page: ft.Page):
    """Initialize and run the Flet GUI application for batch exporting .blend files to .glb.
    
    Args:
        page: The Flet page object to which UI elements will be added.
    """
    page.title = "Blender → GLB Batch Exporter"
    page.padding = 16
    page.scroll = ft.ScrollMode.AUTO

    selected_paths: set[str] = set()

    log = ft.Text(value="Ready.", selectable=True)
    files_list = ft.ListView(expand=1, spacing=6, padding=0, auto_scroll=True)

    def append_log(msg: str):
        log.value += f"\n{msg}"
        page.update()

    def on_picker_result(e: ft.FilePickerResultEvent):
        """Handle file picker result when user selects a .blend file.
        
        Args:
            e: The file picker result event containing selected files.
        """
        if not e.files:
            return
        f = e.files[0]
        path = f.path or f.name
        if path and path.lower().endswith(".blend"):
            if path not in selected_paths:
                selected_paths.add(path)
                files_list.controls.append(
                    ft.Row([
                        ft.Icon(name=ft.Icons.INSERT_DRIVE_FILE_OUTLINED, size=18),
                        ft.Text(path, selectable=True),
                        ft.IconButton(
                            ft.Icons.DELETE_OUTLINE,
                            tooltip="Remove",
                            on_click=lambda _e, p=path: remove_path(p),
                        ),
                    ], alignment=ft.MainAxisAlignment.SPACE_BETWEEN)
                )
                page.update()
            else:
                append_log(f"Skipped duplicate: {path}")
        else:
            append_log("Please select a .blend file.")

    picker = ft.FilePicker(on_result=on_picker_result)
    page.overlay.append(picker)

    def browse_click(_):
        """Handle click event for the browse button to open file picker."""
        picker.pick_files(
            allow_multiple=False,
            allowed_extensions=["blend"],
            dialog_title="Choose a .blend file",
        )

    def remove_path(path: str):
        """Remove a file path from the selected paths list and update the UI.
        
        Args:
            path: The file path to remove from the selection.
        """
        if path in selected_paths:
            selected_paths.remove(path)
            files_list.controls = [
                row for row in files_list.controls
                if not (isinstance(row, ft.Row) and any(isinstance(c, ft.Text) and c.value == path for c in row.controls))
            ]
            page.update()

    def clear_list(_):
        """Clear all selected files from the list and update the UI."""
        selected_paths.clear()
        files_list.controls.clear()
        append_log("Cleared selection.")

    def export_click(_):
        """Handle click event for the export button to convert all selected .blend files to .glb."""
        if not selected_paths:
            append_log("Nothing to export. Add .blend files first.")
            return
        blender_path = find_blender_executable()
        append_log(f"Using Blender: {blender_path}")
        for idx, blend in enumerate(list(selected_paths), start=1):
            try:
                append_log(f"[{idx}/{len(selected_paths)}] Exporting: {blend}")
                glb_path = export_blend_to_glb(blend, blender_path=blender_path)
                append_log(f"   ✅ Wrote: {glb_path}")
            except Exception as ex:
                append_log(f"   ❌ Failed: {blend} — {ex}")
        append_log("All done.")

    def export_mitsuba_click(_):
        if not selected_paths:
            append_log("Nothing to export. Add .blend files first.")
            return
        blender_path = find_blender_executable()
        append_log(f"Using Blender: {blender_path}")
        for idx, blend in enumerate(list(selected_paths), start=1):
            try:
                append_log(f"[{idx}/{len(selected_paths)}] Exporting Mitsuba: {blend}")
                xml_path = export_blend_to_mitsuba(blend, blender_path=blender_path)
                append_log(f"   ✅ Wrote: {xml_path}")
            except Exception as ex:
                append_log(f"   ❌ Failed: {blend} — {ex}")
        append_log("All done.")

    actions = ft.Row([
        ft.ElevatedButton("Browse .blend", icon=ft.Icons.FOLDER_OPEN, on_click=browse_click, tooltip="Pick one .blend per click"),
        ft.ElevatedButton("Export to GLB", icon=ft.Icons.SAVE_ALT, on_click=export_click),
        ft.ElevatedButton("Export to Mitsuba", icon=ft.Icons.SAVE, on_click=export_mitsuba_click),
        ft.OutlinedButton("Clear list", icon=ft.Icons.CLEAR_ALL, on_click=clear_list),
    ], spacing=12)

    page.add(actions, ft.Text("Selected files:"), files_list, ft.Divider(), ft.Text("Log:"), log)


if __name__ == "__main__":
    ft.app(target=main)
