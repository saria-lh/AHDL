# AHDL: A Digital Twin for Under Rubble Aerial Human Detection and Localization

Web-based digital twin simulator for under rubble aerial human detection and localization using Sionna-RT ray tracing. Configure drone positions, define motion paths, select a 3D scene, and compute the channel impulse response (CIR).

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  Frontend   │────>│   Database   │────>│  Simulation   │
│  (Next.js)  │     │  (FastAPI)   │     │  (Sionna-RT)  │
│  :3001      │     │  internal    │     │  internal     │
└─────────────┘     └──────┬───────┘     └───────┬───────┘
                           │                     │
                    ┌──────┴───────┐    ┌────────┴────────┐
                    │    Redis     │    │  3d_models vol  │
                    │  internal    │    │  (shared :z)    │
                    └──────────────┘    └─────────────────┘
```

| Service    | Host Port | Stack                              |
|------------|-----------|-------------------------------------|
| Frontend   | 3001      | Next.js, React Three Fiber, Tailwind |
| Database   | internal  | FastAPI, Redis                      |
| Simulation | internal  | FastAPI, Sionna-RT, Mitsuba 3 (LLVM) |
| Redis      | internal  | Redis Alpine                        |

Only the frontend is exposed. All backend services are accessed internally via the frontend's API proxy (`/api/db/...`).

## Running

Supports Docker (Ubuntu/Windows) and Podman (Fedora). The Makefile auto-detects your runtime.

```bash
make run       # Build and start all services
make status    # Check container status
make logs      # View logs
make clean     # Stop and remove containers
```

Open http://localhost:3001 after starting.

See [SETUP.md](SETUP.md) for platform-specific setup instructions.

## Workflow

1. Select a 3D scene model
2. Add drones and set positions
3. Optionally configure motion paths (line or circle)
4. Configure radio and antenna parameters
5. Submit a simulation job
6. Monitor job progress in the Job Queue section
7. View CIR results (magnitude + phase) when complete

## Tools

### Blender Export CLI (`misc/cli/export_blender.py`)

Converts `.blend` files to GLB (for the frontend 3D viewer) and/or Mitsuba XML (for Sionna-RT simulation). Output goes to `database/3d_models/<name>/` by default, which is where the running services expect scene files.

Requires Blender 4.x installed. The mitsuba-blender addon must be installed in Blender for XML export.

#### Blender path

The script auto-detects Blender in this order:
1. `~/apps/blender-4.2.16-linux-x64/blender`
2. `/usr/bin/blender`, `/usr/local/bin/blender`
3. macOS/Windows default install paths
4. `blender` on `PATH`

To override, pass `-b /path/to/blender`.

#### Flags

| Flag | Description |
|------|-------------|
| `files` | One or more `.blend` files to export |
| `-f`, `--format` | `glb` (default), `mitsuba`, or `both` |
| `-d`, `--directory DIR` | Export all `.blend` files in a directory |
| `-r`, `--recursive` | Search directories recursively (use with `-d`) |
| `-b`, `--blender PATH` | Path to Blender executable |
| `--out-dir DIR` | Output root directory (default: `database/3d_models`) |
| `-v`, `--verbose` | Print full Blender output |
| `-q`, `--quiet` | Suppress everything except errors |
| `--dry-run` | List files that would be exported, then exit |

#### Examples

```bash
# Single file to GLB
python misc/cli/export_blender.py model.blend

# Single file to both GLB and Mitsuba XML
python misc/cli/export_blender.py -f both model.blend

# All .blend files in a directory to Mitsuba XML
python misc/cli/export_blender.py -f mitsuba -d ./blender_files/

# Recursive directory scan, both formats, custom Blender path
python misc/cli/export_blender.py -f both -d ./blender_files/ -r -b ~/apps/blender-4.2.16-linux-x64/blender

# Preview what would be exported
python misc/cli/export_blender.py --dry-run -d ./blender_files/

# Export to a custom output directory
python misc/cli/export_blender.py --out-dir ./output -f both model.blend
```

GLB and Mitsuba exports are independent per file. If Mitsuba fails on a model (e.g. broken normals), the GLB is still kept.

### Surface Plotter (`misc/ui/plot_sphere.py`)

PySide6 + VisPy desktop app for visualizing 3D models with hemisphere/cube point grids overlaid. Load a `.glb`, adjust point density/radius/position, export points as `.npy`. Supports uploading external point clouds and binary labels for visualization.

Requires: `PySide6`, `vispy`, `trimesh`, `numpy`.
