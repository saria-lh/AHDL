IMAGE = database
CONTAINER = database
BE
.PHONY: build run attach stop clean logs rebuild

build:
	docker build -t ${IMAGE} .

run:
	docker run -d --name ${CONTAINER} -p 8000:8000 ${IMAGE}


attach:
	docker exec -it ${CONTAINER} /bin/bash

stop:
	-@docker stop ${CONTAINER}

clean:
	-@docker rm -f ${CONTAINER}

logs:
	docker logs ${CONTAINER} -f

rebuild: stop clean build run