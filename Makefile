# Gridyard monorepo — common developer targets.
# Run `make help` for the list.

.DEFAULT_GOAL := help

.PHONY: help install \
	fmt fmt-check clippy test-rust lint-rust \
	lint-js test-js build-js \
	lint test build check ci \
	mock-server up down clean

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "Usage: make <target>\n\n"} \
		/^[a-zA-Z0-9_-]+:.*?##/ { printf "  %-14s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

install: ## Install JS/TS workspace dependencies
	npm install

# --- Rust -------------------------------------------------------------------

fmt: ## Format Rust sources
	cargo fmt --all

fmt-check: ## Check Rust formatting (CI)
	cargo fmt --all -- --check

clippy: ## Lint Rust with clippy (CI)
	cargo clippy --workspace --all-targets -- -D warnings

test-rust: ## Run Rust workspace tests (CI)
	cargo test --workspace

lint-rust: fmt-check clippy ## Rust fmt-check + clippy

# --- JS/TS ------------------------------------------------------------------

lint-js: ## Lint JS/TS workspaces (CI)
	npm run lint --workspaces --if-present

test-js: ## Run JS/TS workspace tests (CI)
	npm test --workspaces --if-present

build-js: ## Build JS/TS workspaces (CI)
	npm run build --workspaces --if-present

# --- Combined ---------------------------------------------------------------

lint: lint-rust lint-js ## Lint Rust and JS/TS

test: test-rust test-js ## Test Rust and JS/TS

build: build-js ## Build JS/TS workspaces

check: lint test build ## Full local check (matches CI)
ci: check ## Alias for check

mock-server: ## Start the mock REST server on :4000 (local npm)
	npm start --workspace=mock-server

up: ## Start docker compose services (mock-server on :4000)
	docker compose up --build

down: ## Stop docker compose services
	docker compose down

clean: ## Remove Rust and Node build artifacts
	cargo clean
	rm -rf node_modules packages/*/node_modules apps/*/node_modules
	rm -rf packages/*/dist apps/*/dist
