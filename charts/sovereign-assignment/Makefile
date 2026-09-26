OCI_REGISTRY_HOST ?= quay.io/gauravshankar

include make/upload-chart.mk

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nSovereign Assignment Chart — Make Targets\n\n  \033[36m%-25s\033[0m %s\n\n", "TARGET", "DESCRIPTION"} \
		/^[a-zA-Z_0-9-]+:.*?##/ { printf "  \033[36m%-25s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

.PHONY: template-test
template-test: ## Render chart with test values to verify output
	helm template . \
		--set entity=acme-corp \
		--set team=platform-engineering \
		--set "projects={website-redesign,data-pipeline}" \
		--set toolRbac.assignmentAdminGroup="acme-corp/platform-admins" \
		--set toolRbac.assignmentDeveloperGroup="acme-corp/platform-devs" \
		--set toolRbac.assignmentViewerGroup="acme-corp/platform-viewers" \
		--set toolRbac.assignmentOpsGroup="acme-corp/platform-ops"
