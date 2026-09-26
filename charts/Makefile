OCI_REGISTRY_HOST ?= $(OCI_HOST)
OCI_CHART_REF    ?= oci://$(OCI_REGISTRY_HOST)

MCE_CHART_NAME    = mce-cluster-build
MCE_CHART_VERSION = $(shell grep '^version:' charts/$(MCE_CHART_NAME)/Chart.yaml | awk '{print $$2}')

OCP_BASE_CHART_NAME    = ocp-base
OCP_BASE_CHART_VERSION = $(shell grep '^version:' charts/$(OCP_BASE_CHART_NAME)/Chart.yaml | awk '{print $$2}')

.PHONY: upload-mce-chart
upload-mce-chart: ## Package and push mce-cluster-build Helm chart to OCI
	@echo "── Logging in to Helm OCI registry ──"
	@echo "$(OCI_REGISTRY_TOKEN)" | helm registry login $(OCI_REGISTRY_HOST) -u '$$oauthtoken' --password-stdin
	@echo "── Packaging $(MCE_CHART_NAME) v$(MCE_CHART_VERSION) ──"
	helm package charts/$(MCE_CHART_NAME)/ --destination /tmp/
	@echo "── Pushing to $(OCI_CHART_REF) ──"
	helm push /tmp/$(MCE_CHART_NAME)-$(MCE_CHART_VERSION).tgz $(OCI_CHART_REF)
	@rm -f /tmp/$(MCE_CHART_NAME)-$(MCE_CHART_VERSION).tgz
	@echo "── Setting chart repository visibility to public ──"
	@curl -sS -X POST "https://$(OCI_REGISTRY_HOST)/api/v1/repository/gauravshankar/$(MCE_CHART_NAME)/changevisibility" \
		-H "Authorization: Bearer $(OCI_REGISTRY_TOKEN)" \
		-H "Content-Type: application/json" \
		-d '{"visibility":"public"}' 2>/dev/null || true
	@echo "✓ Pushed $(OCI_CHART_REF)/$(MCE_CHART_NAME):$(MCE_CHART_VERSION)"

.PHONY: upload-ocp-base-chart
upload-ocp-base-chart: ## Package and push ocp-base Helm chart to OCI (public visibility)
	@echo "── Logging in to Helm OCI registry ──"
	@echo "$(OCI_REGISTRY_TOKEN)" | helm registry login $(OCI_REGISTRY_HOST) -u '$$oauthtoken' --password-stdin
	@echo "── Packaging $(OCP_BASE_CHART_NAME) v$(OCP_BASE_CHART_VERSION) ──"
	helm package charts/$(OCP_BASE_CHART_NAME)/ --destination /tmp/
	@echo "── Pushing to $(OCI_CHART_REF) ──"
	helm push /tmp/$(OCP_BASE_CHART_NAME)-$(OCP_BASE_CHART_VERSION).tgz $(OCI_CHART_REF)
	@rm -f /tmp/$(OCP_BASE_CHART_NAME)-$(OCP_BASE_CHART_VERSION).tgz
	@echo "── Setting chart repository visibility to public ──"
	@curl -sS -X POST "https://$(OCI_REGISTRY_HOST)/api/v1/repository/gauravshankar/$(OCP_BASE_CHART_NAME)/changevisibility" \
		-H "Authorization: Bearer $(OCI_REGISTRY_TOKEN)" \
		-H "Content-Type: application/json" \
		-d '{"visibility":"public"}' 2>/dev/null || true
	@echo "✓ Pushed $(OCI_CHART_REF)/$(OCP_BASE_CHART_NAME):$(OCP_BASE_CHART_VERSION)"

.PHONY: upload-all-charts
upload-all-charts: upload-mce-chart upload-ocp-base-chart ## Upload all charts to OCI
