.PHONY: backend-up backend-build backend-logs frontend-up reset-db

backend-up:
	docker compose up -d db api

backend-build:
	docker compose build api

backend-logs:
	docker compose logs -f api

frontend-up:
	cd frontend && npm run dev

reset-db:
	docker compose down -v
	docker compose up -d db
