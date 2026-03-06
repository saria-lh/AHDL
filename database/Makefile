# Auto-detect container engine
CONTAINER_ENGINE := $(shell \
  if command -v docker >/dev/null 2>&1; then echo "docker"; \
  elif command -v podman >/dev/null 2>&1; then echo "podman"; \
  fi \
)

IMAGE = database
CONTAINER = database

.PHONY: build run attach stop clean logs rebuild

build:
	$(CONTAINER_ENGINE) build -t $(IMAGE) .

run:
	$(CONTAINER_ENGINE) run -d --name $(CONTAINER) -p 8000:8000 $(IMAGE)

attach:
	$(CONTAINER_ENGINE) exec -it $(CONTAINER) /bin/bash

stop:
	-@$(CONTAINER_ENGINE) stop $(CONTAINER)

clean:
	-@$(CONTAINER_ENGINE) rm -f $(CONTAINER)

logs:
	$(CONTAINER_ENGINE) logs $(CONTAINER) -f

rebuild: stop clean build run
