# Do NOT use IMAGE_REGISTRY — that env var is often registry.redhat.io on bastions.
DE_REGISTRY ?= $(if $(OCI_HOST),$(OCI_HOST),quay.io/gauravshankar)
DE_NAME = de-cloudoso
DE_TAG ?= 0.1.9
DE_IMAGE = $(DE_REGISTRY)/$(DE_NAME):$(DE_TAG)

.PHONY: de-cloudoso-build-push de-cloudoso-build de-cloudoso-push

de-cloudoso-build:
	ansible-builder create -f decision-environment.yml
	sed -i '/^RUN \/output\/scripts\/assemble/i RUN sed -i '"'"'/openshift-clients/d'"'"' /tmp/src/bindep.txt' context/Containerfile
	sed -i '/^RUN \/output\/scripts\/assemble/i RUN sed -i '"'"'/^systemd-python/d'"'"' /tmp/src/requirements.txt' context/Containerfile
	podman build -f context/Containerfile context/ -t $(DE_IMAGE)

de-cloudoso-push:
	podman push $(DE_IMAGE)

de-cloudoso-build-push: de-cloudoso-build de-cloudoso-push
