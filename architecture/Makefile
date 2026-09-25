.DEFAULT_GOAL := help

BOLD  := $(shell tput bold 2>/dev/null || echo "")
GREEN := $(shell tput setaf 2 2>/dev/null || echo "")
RESET := $(shell tput sgr0 2>/dev/null || echo "")

.PHONY: help
help: ## Architecture docs live under docs/
	@echo "$(BOLD)Architecture documentation$(RESET)"
	@echo "  $(GREEN)docs/c4.md$(RESET)                 C4 model"
	@echo "  $(GREEN)docs/concepts.md$(RESET)           Concepts"
	@echo "  $(GREEN)docs/technical.md$(RESET)          Technical reference"
	@echo "  $(GREEN)docs/workshop-tutorials.md$(RESET) Workshop & tutorials"
	@echo "  $(GREEN)mocks/$(RESET)                     UI design mocks"
	@echo ""
	@echo "Day-2 usage: ../docs/README.md"
