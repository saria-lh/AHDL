# Auto-detect container runtime
COMPOSE := $(shell \
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then \
    echo "docker compose"; \
  elif command -v podman >/dev/null 2>&1 && podman compose version >/dev/null 2>&1; then \
    echo "podman compose"; \
  elif command -v docker-compose >/dev/null 2>&1; then \
    echo "docker-compose"; \
  fi \
)

ifeq ($(COMPOSE),)
  $(error No container runtime found. Install Docker or Podman, then try again. See SETUP.md)
endif

.PHONY: run clean logs help build rebuild status

run:
	$(COMPOSE) up --build -d
	@echo ""
	@echo "Services started successfully!"
	@echo "  Frontend:       http://localhost:3001"
	@echo "  Database API:   http://localhost:8001"
	@echo "  Simulation API: http://localhost:8002"

clean:
	$(COMPOSE) down
	@echo "All services stopped and containers removed."

logs:
	$(COMPOSE) logs -f

build:
	$(COMPOSE) build
	@echo "All services built successfully!"

rebuild: clean build run

status:
	$(COMPOSE) ps

help:
	@echo "Drone Simulation System"
	@echo ""
	@echo "Detected runtime: $(COMPOSE)"
	@echo ""
	@echo "Usage:"
	@echo "  make run      - Build and start all services (detached)"
	@echo "  make clean    - Stop and remove all containers"
	@echo "  make logs     - Tail logs for all services"
	@echo "  make build    - Build all container images"
	@echo "  make rebuild  - Clean, build, and restart everything"
	@echo "  make status   - Show running container status"
	@echo ""
	@echo "Services:"
	@echo "  Frontend (Next.js):       http://localhost:3001"
	@echo "  Database (Job Queue):     http://localhost:8001"
	@echo "  Simulation (Backend):     http://localhost:8002"
	@echo "  Redis:                    redis://localhost:6379"
	@echo ""
	@echo "First time? Run ./setup.sh (Linux) or .\\setup.ps1 (Windows)"
