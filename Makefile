__default:
	@ cat ./Makefile

SHELL=/usr/bin/env bash

# UPGRADE_POINT.
# NOTE: Search through the repo for mentions of previous version when bumping.
VERSION=1.0.0
IMAGE_TAG=khueue/sin:$(VERSION)

install:
	make shell cmd="yarn install"

pretty:
	make shell cmd="yarn pretty"

test:
	make shell cmd="yarn test"

coverage:
	make shell cmd="yarn cov"

release: build_image
	docker login --username khueue
	docker push $(IMAGE_TAG)

# export DOCKER_DEFAULT_PLATFORM := linux/amd64

cmd := bash
shell: create_dirs build_image
	docker run --interactive --tty --rm --init \
		--mount type="bind",source="$(PWD)/app",target="/app",consistency="delegated" \
		--mount type="bind",source="$(PWD)/data/src",target="/data/src",readonly \
		--mount type="bind",source="$(PWD)/data/db",target="/data/db",consistency="delegated" \
		--mount type="bind",source="$(PWD)/data/tmp",target="/data/tmp",consistency="delegated" \
		$(IMAGE_TAG) \
		-c "$(cmd)"

create_dirs:
	mkdir -p ./data/src
	mkdir -p ./data/db
	mkdir -p ./data/tmp

build_image:
	docker build \
		--tag $(IMAGE_TAG) \
		--file ./Dockerfile \
		./
