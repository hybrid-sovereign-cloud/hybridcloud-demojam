##@ Build Artifacts

SOVEREIGN_ASSIGNMENT_CHART_REPO ?= ../charts/sovereign-assignment

.PHONY: upload-sovereign-assignment-chart
upload-sovereign-assignment-chart: check-env ## Package and push sovereign-assignment chart to OCI registry
	@echo "$(BOLD)Ensuring Quay repository for sovereign-assignment chart...$(RESET)"
	@curl -sf -X POST \
	  -H "Authorization: Bearer $(OCI_REGISTRY_TOKEN)" \
	  -H "Content-Type: application/json" \
	  -d '{"repository":"sovereign-assignment","visibility":"private","description":"Sovereign assignment spoke cluster chart","namespace":"$(OCI_NAMESPACE)"}' \
	  "https://$(OCI_HOST)/api/v1/repository" > /dev/null 2>&1 \
	  && printf "  $(GREEN)✓$(RESET)  Repository created (or exists)\n" \
	  || printf "  $(GREEN)✓$(RESET)  Repository already exists\n"
	@echo "$(BOLD)Logging in to OCI registry...$(RESET)"
	@echo "$(OCI_REGISTRY_TOKEN)" | helm registry login "$(OCI_HOST)" \
	  --username='$$oauthtoken' --password-stdin > /dev/null 2>&1
	$(call ok,Logged in to $(OCI_HOST))
	@echo "$(BOLD)Packaging and pushing sovereign-assignment chart...$(RESET)"
	@helm package $(SOVEREIGN_ASSIGNMENT_CHART_REPO) -d /tmp/helm-pkg > /dev/null
	@CHART_VER=$$(grep '^version:' $(SOVEREIGN_ASSIGNMENT_CHART_REPO)/Chart.yaml | awk '{print $$2}'); \
	 helm push /tmp/helm-pkg/sovereign-assignment-$${CHART_VER}.tgz oci://$(OCI_HOST)/$(OCI_NAMESPACE)
	$(call ok,sovereign-assignment chart pushed to oci://$(OCI_HOST)/$(OCI_NAMESPACE)/sovereign-assignment)
