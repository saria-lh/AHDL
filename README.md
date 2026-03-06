# AHDL Drone Simulation

Web-based system for simulating radio wave propagation between drones using Sionna-RT ray tracing. Configure drone positions, define motion paths, select a 3D scene, and compute the channel impulse response (CIR).

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  Frontend   │────>│   Database   │────>│  Simulation   │
│  (Next.js)  │     │  (FastAPI)   │     │  (Sionna-RT)  │
│  :3002      │     │  internal    │     │  internal     │
└─────────────┘     └──────┬───────┘     └───────┬───────┘
                           │                     │
                    ┌──────┴───────┐    ┌────────┴────────┐
                    │    Redis     │    │  3d_models vol  │
                    │  internal    │    │  (shared :z)    │
                    └──────────────┘    └─────────────────┘
```

| Service    | Host Port | Stack                              |
|------------|-----------|-------------------------------------|
| Frontend   | 3002      | Next.js, React Three Fiber, Tailwind |
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

Open http://localhost:3002 after starting.

See [SETUP.md](SETUP.md) for platform-specific setup instructions.

## Workflow

1. Select a 3D scene model
2. Add drones and set positions
3. Optionally configure motion paths (line or circle)
4. Configure radio and antenna parameters
5. Submit a simulation job
6. Monitor job progress in the Job Queue section
7. View CIR results (magnitude + phase) when complete
