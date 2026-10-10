# Pertly developer + operator commands. Run `make` (or `make help`) for a list.
#
# Local development needs: uv, Node 22 + npm. Docker targets need Docker
# with the Compose plugin (`docker compose`).

.DEFAULT_GOAL := help
SHELL := /bin/sh

BACKEND_DIR  := backend
FRONTEND_DIR := frontend
COMPOSE      := docker compose

.PHONY: help install install-browser \
        dev dev-backend dev-frontend \
        test test-backend test-frontend lint format typecheck check \
        migrate migration \
        create-admin docker-create-admin import-json docker-import-json backup \
        up down logs build ps \
        clean clean-data docker-reset

##@ General

help: ## Show this help
	@awk 'BEGIN { FS = ":.*## "; printf "\nUsage: make \033[36m<target>\033[0m [VAR=value ...]\n" } \
		/^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } \
		/^[a-zA-Z0-9_-]+:.*## / { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo

##@ Setup

install: ## Install backend (uv sync) and frontend (npm ci) dependencies
	cd $(BACKEND_DIR) && uv sync
	cd $(FRONTEND_DIR) && npm ci

install-browser: ## Download Chromium for local PDF rendering (Playwright)
	cd $(BACKEND_DIR) && uv run playwright install chromium

##@ Development

dev: migrate ## Run backend (:8000) and frontend (:5173) with hot reload
	@$(MAKE) --no-print-directory -j2 dev-backend dev-frontend

dev-backend: ## Run only the backend with auto-reload on :8000
	cd $(BACKEND_DIR) && uv run uvicorn pertly.main:app --reload --port 8000

dev-frontend: ## Run only the Vite dev server on :5173 (proxies /api to :8000)
	cd $(FRONTEND_DIR) && npm run dev

##@ Quality

test: test-backend test-frontend ## Run all tests

test-backend: ## Run backend tests (pytest)
	cd $(BACKEND_DIR) && uv run pytest

test-frontend: ## Run frontend tests (vitest)
	cd $(FRONTEND_DIR) && npm run test

lint: ## Lint + format-check the backend (ruff)
	cd $(BACKEND_DIR) && uv run ruff check . && uv run ruff format --check .

format: ## Auto-fix lint issues and format the backend (ruff)
	cd $(BACKEND_DIR) && uv run ruff check --fix . && uv run ruff format .

typecheck: ## Type-check the frontend (tsc)
	cd $(FRONTEND_DIR) && npm run typecheck

check: lint typecheck test ## Everything CI runs (minus the Docker build)

##@ Database (local)

migrate: ## Apply database migrations (alembic upgrade head)
	cd $(BACKEND_DIR) && uv run alembic upgrade head

migration: ## Create a new migration: make migration m="add foo table"
	$(if $(strip $(m)),,$(error m is required, e.g. make migration m="add foo table"))
	cd $(BACKEND_DIR) && uv run alembic revision -m "$(m)"

##@ Accounts & data

create-admin: ## Create an admin locally: EMAIL= FIRST= LAST= (prompts for password; Docker: make docker-create-admin)
	$(if $(and $(EMAIL),$(FIRST),$(LAST)),,$(error EMAIL, FIRST and LAST are required, e.g. make create-admin EMAIL=a@b.c FIRST=Ada LAST=Lovelace))
	cd $(BACKEND_DIR) && uv run pertly create-admin --email "$(EMAIL)" --first-name "$(FIRST)" --last-name "$(LAST)"

# `docker compose exec` allocates a TTY and keeps stdin open by default (the
# equivalent of `docker exec -it`), which the password prompt needs.
docker-create-admin: ## Create an admin in the running container: EMAIL= FIRST= LAST=
	$(if $(and $(EMAIL),$(FIRST),$(LAST)),,$(error EMAIL, FIRST and LAST are required, e.g. make docker-create-admin EMAIL=a@b.c FIRST=Ada LAST=Lovelace))
	$(COMPOSE) exec backend pertly create-admin --email "$(EMAIL)" --first-name "$(FIRST)" --last-name "$(LAST)"

import-json: ## Import a desktop estimates.json locally: FILE= EMAIL= [REPLACE_SETTINGS=1]
	$(if $(and $(FILE),$(EMAIL)),,$(error FILE and EMAIL are required, e.g. make import-json FILE=path/to/estimates.json EMAIL=a@b.c))
	cd $(BACKEND_DIR) && uv run pertly import-json --file "$(abspath $(FILE))" --email "$(EMAIL)" $(if $(REPLACE_SETTINGS),--replace-settings)

docker-import-json: ## Import a desktop estimates.json into the container: FILE= EMAIL= [REPLACE_SETTINGS=1]
	$(if $(and $(FILE),$(EMAIL)),,$(error FILE and EMAIL are required, e.g. make docker-import-json FILE=path/to/estimates.json EMAIL=a@b.c))
	$(COMPOSE) cp "$(FILE)" backend:/tmp/import.json
	$(COMPOSE) exec -T backend pertly import-json --file /tmp/import.json --email "$(EMAIL)" $(if $(REPLACE_SETTINGS),--replace-settings); \
		status=$$?; $(COMPOSE) exec -T -u root backend rm -f /tmp/import.json; exit $$status

backup: TS := $(shell date +%Y%m%d-%H%M%S)
backup: ## Snapshot the running container's database to ./backups/
	@mkdir -p backups
	$(COMPOSE) exec -T backend pertly backup --out /data/backup-$(TS).db
	$(COMPOSE) cp backend:/data/backup-$(TS).db backups/pertly-$(TS).db
	$(COMPOSE) exec -T backend rm -f /data/backup-$(TS).db
	@echo "Backup written to backups/pertly-$(TS).db"

##@ Docker

up: ## Build and start the stack in the background
	$(COMPOSE) up -d --build
	@port=$$($(COMPOSE) port frontend 8080 2>/dev/null | sed 's/.*://'); \
		echo "Pertly is running at http://localhost:$${port:-$${PERTLY_PORT:-8080}}"

down: ## Stop and remove the containers (data volume is kept)
	$(COMPOSE) down

logs: ## Follow container logs
	$(COMPOSE) logs -f

build: ## Build the Docker images
	$(COMPOSE) build

ps: ## Show container status
	$(COMPOSE) ps

##@ Cleanup

clean: ## Remove local build artifacts and dependency dirs (keeps data)
	rm -rf $(BACKEND_DIR)/.venv $(BACKEND_DIR)/.pytest_cache $(BACKEND_DIR)/.ruff_cache
	find $(BACKEND_DIR) -type d -name __pycache__ -prune -exec rm -rf {} +
	rm -rf $(FRONTEND_DIR)/node_modules $(FRONTEND_DIR)/dist

clean-data: ## DELETE the local development database (backend/data)
	@echo "WARNING: deleting $(BACKEND_DIR)/data (local development database). Docker volumes are not touched."
	rm -rf $(BACKEND_DIR)/data

docker-reset: ## DELETE the Docker stack INCLUDING the data volume (docker compose down -v)
	@echo "WARNING: removing containers AND the pertly-data volume. All Docker-hosted data will be lost."
	$(COMPOSE) down -v
