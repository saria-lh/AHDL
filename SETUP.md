# Setup

## Prerequisites

- Git
- Docker or Podman
- `make` (optional)
- ~4 GB free RAM
- ~6 GB free disk space

## Quick Start

```bash
git clone <repo-url> && cd AHDL-paper
./setup.sh          # Linux
.\setup.ps1         # Windows (PowerShell)
make run
```

Open http://localhost:3001

---

## Linux — Fedora / RHEL (Podman)

```bash
# Podman is pre-installed on Fedora
systemctl --user enable --now podman.socket
sudo chcon -Rt svirt_sandbox_file_t ./database/3d_models
make run
```

### Troubleshooting

**Permission denied on volume mounts:**
```bash
sudo chcon -Rt svirt_sandbox_file_t ./database/3d_models
chmod -R a+rX ./database/3d_models
```

**`:Z` vs `:z` volume flags:** This project uses `:z` (shared). Both `database` and `simulation` mount `./database/3d_models`. Do not change to `:Z`.

**Cannot connect to Podman:**
```bash
systemctl --user enable --now podman.socket
```

**podman compose not found:**
```bash
sudo dnf install podman-compose
```

---

## Linux — Ubuntu / Debian (Docker)

```bash
# Install Docker: https://docs.docker.com/engine/install/ubuntu/
sudo usermod -aG docker $USER
newgrp docker
make run
```

### Troubleshooting

**Permission denied on Docker socket:**
```bash
sudo usermod -aG docker $USER
# Log out and back in
```

**docker compose vs docker-compose:**
```bash
sudo apt-get install docker-compose-plugin
```

---

## Windows (Docker Desktop + WSL2)

1. Install WSL2:
   ```powershell
   wsl --install
   wsl --set-default-version 2
   ```

2. Install Docker Desktop: https://docs.docker.com/desktop/install/windows-install/

3. Enable "Use WSL 2 based engine" in Docker Desktop settings.

4. Start services:
   ```powershell
   docker compose up --build -d
   ```

### Troubleshooting

**No `make` command:**
```powershell
winget install GnuWin32.Make
```
Or use `docker compose up --build -d` directly.

**Slow builds:** Place the project on the WSL2 filesystem (`\\wsl$\Ubuntu\home\<user>\`) for better performance.

---

## Volume Sharing

- `database` and `simulation` share `./database/3d_models`
- `simulation` mounts at `/3d_models` (reads scene XML + mesh files)
- `database` mounts at `/app/3d_models` (serves GLB files via HTTP)
- Simulation runs CPU-only ray tracing (Mitsuba 3 LLVM variant)
