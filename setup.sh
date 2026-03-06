#!/usr/bin/env bash
set -euo pipefail

# ─── Colors ───────────────────────────────────────────────────────────────────
if [ -t 1 ] && [ "${NO_COLOR:-}" = "" ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'
  BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; BOLD=''; RESET=''
fi

info()    { echo -e "${BLUE}[INFO]${RESET} $*"; }
success() { echo -e "${GREEN}[OK]${RESET}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET} $*"; }
error()   { echo -e "${RED}[ERR]${RESET}  $*"; }

# ─── OS Detection ─────────────────────────────────────────────────────────────
DISTRO="unknown"
if [ -f /etc/os-release ]; then
  . /etc/os-release
  case "$ID" in
    fedora|rhel|centos|rocky|alma)
      DISTRO="fedora"
      ;;
    ubuntu|debian|pop|mint|elementary)
      DISTRO="debian"
      ;;
    *)
      if echo "${ID_LIKE:-}" | grep -qi fedora; then
        DISTRO="fedora"
      elif echo "${ID_LIKE:-}" | grep -qi debian; then
        DISTRO="debian"
      fi
      ;;
  esac
fi

echo ""
echo -e "${BOLD}AHDL Drone Simulation - Linux Setup${RESET}"
echo "────────────────────────────────────"
info "Detected OS: ${PRETTY_NAME:-$DISTRO}"
echo ""

# ─── Check make ───────────────────────────────────────────────────────────────
if command -v make >/dev/null 2>&1; then
  success "make is installed"
else
  warn "make is not installed"
  if [ "$DISTRO" = "fedora" ]; then
    info "Installing make..."
    sudo dnf install -y make
  elif [ "$DISTRO" = "debian" ]; then
    info "Installing make..."
    sudo apt-get update && sudo apt-get install -y make
  fi
fi

# ─── Container Runtime ────────────────────────────────────────────────────────
COMPOSE=""

if [ "$DISTRO" = "fedora" ]; then
  echo ""
  info "Fedora detected - setting up Podman"
  echo ""

  # Check podman
  if command -v podman >/dev/null 2>&1; then
    success "podman is installed ($(podman --version))"
  else
    warn "podman not found, installing..."
    sudo dnf install -y podman
  fi

  # Check podman compose support
  if podman compose version >/dev/null 2>&1; then
    success "podman compose is available"
    COMPOSE="podman compose"
  else
    warn "podman compose not available, installing podman-compose..."
    sudo dnf install -y podman-compose
    COMPOSE="podman-compose"
  fi

  # Start podman socket (required for compose)
  if systemctl --user is-active podman.socket >/dev/null 2>&1; then
    success "podman socket is running"
  else
    info "Starting podman socket..."
    systemctl --user enable --now podman.socket
    success "podman socket started"
  fi

  # SELinux fixes
  echo ""
  info "Checking SELinux..."
  if command -v getenforce >/dev/null 2>&1 && [ "$(getenforce)" = "Enforcing" ]; then
    warn "SELinux is enforcing - fixing volume labels"
    MODELS_DIR="$(cd "$(dirname "$0")" && pwd)/database/3d_models"
    if [ -d "$MODELS_DIR" ]; then
      sudo chcon -Rt svirt_sandbox_file_t "$MODELS_DIR" 2>/dev/null || true
      chmod -R a+rX "$MODELS_DIR" 2>/dev/null || true
      success "SELinux labels fixed on 3d_models directory"
    else
      warn "3d_models directory not found at $MODELS_DIR - skipping SELinux fix"
    fi
    echo ""
    info "Note: The docker-compose.yml uses ':z' (shared) volume flags."
    info "This tells Podman to relabel volumes for SELinux compatibility."
    info "If you still get permission errors, run:"
    echo "  sudo chcon -Rt svirt_sandbox_file_t ./database/3d_models"
  else
    success "SELinux is not enforcing - no fixes needed"
  fi

elif [ "$DISTRO" = "debian" ]; then
  echo ""
  info "Debian/Ubuntu detected - setting up Docker"
  echo ""

  # Check docker
  if command -v docker >/dev/null 2>&1; then
    success "docker is installed ($(docker --version 2>/dev/null | head -1))"
  else
    error "Docker is not installed"
    echo ""
    echo "  Install Docker Engine:"
    echo "    https://docs.docker.com/engine/install/ubuntu/"
    echo ""
    echo "  Quick install (Ubuntu):"
    echo "    curl -fsSL https://get.docker.com | sudo sh"
    echo ""
    exit 1
  fi

  # Check docker daemon
  if docker info >/dev/null 2>&1; then
    success "Docker daemon is running"
  else
    error "Docker daemon is not running or you don't have permission"
    echo ""
    if ! groups | grep -q docker; then
      warn "Your user is NOT in the 'docker' group"
      echo ""
      echo "  Fix with:"
      echo "    sudo usermod -aG docker \$USER"
      echo "    newgrp docker   # or log out and back in"
    else
      echo "  Try starting Docker:"
      echo "    sudo systemctl start docker"
    fi
    echo ""
    exit 1
  fi

  # Check docker compose
  if docker compose version >/dev/null 2>&1; then
    success "docker compose v2 is available"
    COMPOSE="docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    warn "Only docker-compose v1 found (v2 recommended)"
    echo "  Install v2: sudo apt-get install docker-compose-plugin"
    COMPOSE="docker-compose"
  else
    error "docker compose is not available"
    echo "  Install: sudo apt-get install docker-compose-plugin"
    exit 1
  fi

  # Check docker group
  if groups | grep -q docker; then
    success "User is in docker group"
  else
    warn "User is NOT in docker group - you may need sudo for docker commands"
    echo "  Fix: sudo usermod -aG docker \$USER && newgrp docker"
  fi

else
  echo ""
  warn "Unsupported distro: $DISTRO"
  info "Trying to detect any available container runtime..."

  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    COMPOSE="docker compose"
  elif command -v podman >/dev/null 2>&1 && podman compose version >/dev/null 2>&1; then
    COMPOSE="podman compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE="docker-compose"
  fi

  if [ -z "$COMPOSE" ]; then
    error "No container runtime found. Install Docker or Podman."
    exit 1
  fi
  success "Found: $COMPOSE"
fi

# ─── Validate ─────────────────────────────────────────────────────────────────
echo ""
info "Validating docker-compose.yml..."
cd "$(dirname "$0")"
if $COMPOSE config >/dev/null 2>&1; then
  success "docker-compose.yml is valid"
else
  error "docker-compose.yml validation failed"
  $COMPOSE config
  exit 1
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "────────────────────────────────────"
echo -e "${BOLD}Setup complete!${RESET}"
echo ""
echo "  Runtime:  $COMPOSE"
echo "  Platform: ${PRETTY_NAME:-$DISTRO}"
echo ""
echo "  Next steps:"
echo "    make run      # Build and start all services"
echo "    make status   # Check container status"
echo "    make logs     # View service logs"
echo ""

# ─── Offer to start ──────────────────────────────────────────────────────────
read -rp "Start services now? [y/N] " answer
if [[ "${answer,,}" =~ ^y ]]; then
  make run
fi
