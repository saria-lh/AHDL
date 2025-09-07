# Makefile for Drone Simulation System

# Default target
.PHONY: run clean logs help build rebuild

# Run all services
run:
	docker-compose up --build -d
	@echo "Services started successfully!"
	@echo "Frontend: http://localhost:3001"
	@echo "Database API: http://localhost:8001"
	@echo "Simulation API: http://localhost:8002"

# Stop and remove all containers
clean:
	docker-compose down
	@echo "All services stopped and containers removed."

# Show logs for all services
logs:
	docker-compose logs -f
	@echo "Showing logs for all services (Ctrl+C to exit)"

# Build all services
build:
	docker-compose build
	@echo "All services built successfully!"

# Rebuild all services (clean and then build)
rebuild: clean build run logs
	@echo "All services rebuilt successfully!"

# Show help
help:
	@echo "Drone Simulation System Makefile"
	@echo ""
	@echo "Usage:"
	@echo "  make run    - Start all services in detached mode"
	@echo "  make clean  - Stop and remove all containers"
	@echo "  make logs   - Show logs for all services"
	@echo "  make build  - Build all services"
	@echo "  make rebuild- Rebuild all services (clean and then build)"
	@echo ""
	@echo "Services:"
	@echo "  Frontend (Next.js):       http://localhost:3001"
	@echo "  Database (Job Queue):     http://localhost:8001"
	@echo "  Simulation (Backend):     http://localhost:8002"
	@echo "  Redis:                    redis://localhost:6379"
	@echo ""
	@echo "To use the application:"
	@echo "  1. Run 'make run' to start all services"
	@echo "  2. Open http://localhost:3001 in your browser"
	@echo "  3. Click the gear icon to open settings"
	@echo "  4. Click '3D Models' to see available models"
	@echo "  5. Click 'Submit Job' to submit a simulation job"
	@echo "  6. Click 'View Jobs' to monitor job progress"