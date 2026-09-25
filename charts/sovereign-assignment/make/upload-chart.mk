CHART_NAME    ?= sovereign-assignment
CHART_VERSION ?= $(shell grep '^version:' Chart.yaml | awk '{print $$2}')
OCI_REGISTRY_HOST ?= quay.signal9.gg
OCI_CHART_REF ?= oci://$(OCI_REGISTRY_HOST)/hybrid-sovereign

.PHONY: upload-chart
upload-chart: ## Package and push the sovereign-assignment Helm chart to OCI
	@echo "── Logging in to Helm OCI registry ──"
	@echo "$(OCI_REGISTRY_TOKEN)" | helm registry login $(OCI_REGISTRY_HOST) -u '$$oauthtoken' --password-stdin
	@echo "── Linting chart ──"
	helm lint .
	@echo "── Packaging chart $(CHART_NAME) v$(CHART_VERSION) ──"
	helm package . --destination /tmp/
	@echo "── Pushing to $(OCI_CHART_REF) ──"
	helm push /tmp/$(CHART_NAME)-$(CHART_VERSION).tgz $(OCI_CHART_REF)
	@rm -f /tmp/$(CHART_NAME)-$(CHART_VERSION).tgz
	@echo "── Setting chart repository visibility to public ──"
	@curl -sS -X POST "https://$(OCI_REGISTRY_HOST)/api/v1/repository/hybrid-sovereign/$(CHART_NAME)/changevisibility" \
		-H "Authorization: Bearer $(OCI_REGISTRY_TOKEN)" \
		-H "Content-Type: application/json" \
		-d '{"visibility":"public"}' 2>/dev/null || true
	@echo "✓ Pushed $(OCI_CHART_REF)/$(CHART_NAME):$(CHART_VERSION)"
