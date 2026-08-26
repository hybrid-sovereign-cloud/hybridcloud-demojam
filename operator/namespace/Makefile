OPERATOR_IMAGE ?= $(OCI_HOST)/hybrid-sovereign/hybridsovereign-namespace-operator
OPERATOR_TAG ?= 0.1.10
CHART_NAME := hybridsovereign-namespace-operator
CHART_VERSION := $(shell grep '^version:' helm/Chart.yaml | awk '{print $$2}')

.PHONY: all operator-build operator-push upload-chart
all: operator-build-push upload-chart

operator-build:
	podman build -t $(OPERATOR_IMAGE):$(OPERATOR_TAG) -f namespace/Dockerfile ..

operator-push:
	podman push $(OPERATOR_IMAGE):$(OPERATOR_TAG)

operator-build-push: operator-build operator-push

upload-chart:
	helm package helm/ -d /tmp/
	helm registry login $(OCI_REGISTRY) -u '$$oauthtoken' --password-stdin <<< "$(OCI_REGISTRY_TOKEN)"
	helm push /tmp/$(CHART_NAME)-$(CHART_VERSION).tgz oci://$(OCI_HOST)/hybrid-sovereign
