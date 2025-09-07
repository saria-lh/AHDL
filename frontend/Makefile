IMAGE = frontend
CONTAINER = frontend
.PHONY: build run attach stop clean rebuild
VOLUME_DIR ?= ../database/3d_models

build:
	docker build -t ${IMAGE} .

run:
	docker run -d --name ${CONTAINER} -p 3001:3001 -v ${VOLUME_DIR}:/3d_models ${IMAGE}

attach:
	docker exec -it ${CONTAINER} /bin/bash

stop:
	-@docker stop ${CONTAINER}

clean:
	-@docker rm -f ${CONTAINER}

logs:
	docker logs ${CONTAINER} -f 

rebuild: stop clean build run
