# Include from root Makefile or: make -f Makefile.ztp-images.mk push-ztp-images
OCI_HOST ?= quay.io/gauravshankar
OCI_REGISTRY_TOKEN ?=

.PHONY: push-ztp-images push-ansible-operator push-iaac-git-sync push-ui-images upload-mce-ztp

push-ansible-operator: ## Build+push hybridsovereign-ansible-operator:latest
	@test -n "$(OCI_REGISTRY_TOKEN)" || (echo "Set OCI_REGISTRY_TOKEN"; exit 1)
	echo "$(OCI_REGISTRY_TOKEN)" | podman login quay.io -u '$$oauthtoken' --password-stdin
	podman build -t $(OCI_HOST)/hybridsovereign-ansible-operator:latest src/custom-operators/base
	podman push $(OCI_HOST)/hybridsovereign-ansible-operator:latest

push-iaac-git-sync: ## Build+push iaac-git-sync:latest
	@test -n "$(OCI_REGISTRY_TOKEN)" || (echo "Set OCI_REGISTRY_TOKEN"; exit 1)
	echo "$(OCI_REGISTRY_TOKEN)" | podman login quay.io -u '$$oauthtoken' --password-stdin
	podman build -t $(OCI_HOST)/iaac-git-sync:latest iaac
	podman push $(OCI_HOST)/iaac-git-sync:latest
	@echo "Now set gitops values iaac.image.override=$(OCI_HOST)/iaac-git-sync:latest"
	@echo "The repo must be PUBLIC, like the other $(OCI_HOST) images — the"
	@echo "cluster pulls it with no pull secret."

push-ui-images: ## Build+push four UI images as :latest
	$(MAKE) -C ui push-images REGISTRY=$(OCI_HOST) \
	  ADMIN_DASH_TAG=latest TENANT_DASH_TAG=latest \
	  ADMIN_PLUGIN_TAG=latest TENANT_PLUGIN_TAG=latest

upload-mce-ztp: ## Push mce-cluster-build chart to OCI_HOST (flat)
	$(MAKE) -C charts upload-mce-chart OCI_REGISTRY_HOST=$(OCI_HOST) OCI_REGISTRY_TOKEN=$(OCI_REGISTRY_TOKEN)

push-ztp-images: push-ansible-operator push-iaac-git-sync push-ui-images upload-mce-ztp ## All Day-0 Quay artifacts
	@echo "✓ Pushed ZTP images/charts to $(OCI_HOST)"
