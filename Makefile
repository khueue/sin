__default:
	@ cat ./Makefile

SHELL=/usr/bin/env bash

# UPGRADE_POINT.
# NOTE: Search through the repo for mentions of previous version when bumping.
VERSION=1.0.0-beta3
IMAGE_TAG=khueue/sin:$(VERSION)

# The Docker image installs its own dependencies and works without this, but
# there are two reasons to do this:
#
# - To expose dependencies and types to your editor.
# - When running a shell that bind mounts the /app folder, the node_modules
#   folder inside the container gets overridden by what you have locally.
#
# NOTE: The rm is not strictly necessary, but avoids headaches when switching
# between architectures.
install_local:
	rm -rf ./app/node_modules/
	make shell cmd="npm install"

pretty:
	make shell cmd="npm run pretty"

test:
	make shell cmd="npm run test"

release: build_image test
	docker login --username khueue
	docker push $(IMAGE_TAG)

cmd := bash
shell: create_dirs build_image
	docker run --interactive --tty --rm --init \
		--mount type="bind",source="$(PWD)/app",target="/app",consistency="delegated" \
		--mount type="bind",source="$(PWD)/examples/repos",target="/data/src",readonly \
		--mount type="bind",source="$(PWD)/examples/data/db",target="/data/db",consistency="delegated" \
		--mount type="bind",source="$(PWD)/examples/data/tmp",target="/data/tmp",consistency="delegated" \
		$(IMAGE_TAG) \
		-c "$(cmd)"

create_dirs:
	mkdir -p ./examples/data/db
	mkdir -p ./examples/data/tmp

build_image:
	docker build \
		--tag $(IMAGE_TAG) \
		--file ./docker/Dockerfile.x86 \
		./
