__default:
	@ cat ./Makefile

VERSION=0.0.5
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

cmd := bash
shell: create_dirs build_image
	docker run --interactive --tty --rm --init \
		--mount type="bind",source="$(PWD)/app",target="/app",consistency="delegated" \
		--mount type="bind",source="$(PWD)/data/db",target="/data/db",consistency="delegated" \
		--mount type="bind",source="$(PWD)/data/src",target="/data/src",readonly \
		--mount type="bind",source="$(PWD)/data/tmp",target="/data/tmp",consistency="delegated" \
		--hostname sin \
		--entrypoint bash \
		$(IMAGE_TAG) \
		-c "$(cmd)"

create_dirs:
	mkdir -p ./data/db
	mkdir -p ./data/src
	mkdir -p ./data/tmp

build_image:
	docker build \
		--tag $(IMAGE_TAG) \
		--file ./Dockerfile \
		./
