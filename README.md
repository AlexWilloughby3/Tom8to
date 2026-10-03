# Focus Tracker

A full-stack focus time tracking application. Deployed as three containers
(Caddy + FastAPI + Postgres) on a single GCP VM, built and shipped by GitHub
Actions. See [`docs/DEPLOY.md`](docs/DEPLOY.md) for the full deployment
story.

## Architecture

- **Frontend**: React + TypeScript, served in production by Caddy as a
  static build (`frontend/Dockerfile`); `npm run dev` locally
- **Backend**: FastAPI, same Docker image in dev and prod (`backend/Dockerfile`)
- **Database**: PostgreSQL, same image in dev and prod

## Project Structure

```
.
├── frontend/              # React + TypeScript frontend
│   ├── src/
│   │   ├── api/          # API client & services
│   │   ├── components/   # React components
│   │   ├── contexts/     # React contexts
│   │   ├── pages/        # Page components
│   │   ├── types/        # TypeScript types
│   │   └── utils/        # Utility functions
│   ├── package.json
│   └── vite.config.ts
├── backend/               # FastAPI backend
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py       # FastAPI routes
│   │   ├── database.py   # Database connection
│   │   ├── models.py     # SQLAlchemy models
│   │   ├── schemas.py    # Pydantic schemas
│   │   └── crud.py       # Database operations
│   ├── db/
│   │   └── init.sql      # Database schema
│   ├── Dockerfile
│   └── requirements.txt
├── deploy/                # Production compose file, Caddyfile, VM/GCP setup scripts
├── .github/workflows/     # CI: test on PR/push, deploy to GCP on main
├── docker-compose.yml     # Local dev orchestration (db + api only)
├── Makefile
├── .gitignore
└── README.md
```

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Git

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/AlexWilloughby3/Tom8to.git
   cd Tom8to
   ```

2. **Set up environment variables**
   ```bash
   cp backend/.env.example .env
   # Edit .env if needed
   ```

3. **Start the backend** (either works)
   ```bash
   make backend-build backend-up
   # or: docker compose up --build
   ```

4. **Access the API**
   - API: http://localhost:8000
   - API Docs: http://localhost:8000/docs
   - PostgreSQL: localhost:5432

5. **Start the frontend** (in a separate terminal)
   ```bash
   make frontend-up
   # or: cd frontend && npm install && npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:3000 (Vite proxies `/api` to the backend)
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs
   - PostgreSQL: localhost:5432

## Features

### User Management
- User registration with hashed passwords (bcrypt)
- User authentication and login
- Session persistence
 - Settings page: change password and delete account

### Focus Timer
- Start/pause/resume timer
- Multiple focus categories (Work, Study, Reading, etc.)
- Custom category creation
- Automatic session saving

### Statistics & Analytics
- Weekly and all-time statistics
- Category breakdown
- Progress tracking
- Session history

### Goal Setting
- Set weekly focus goals per category
- Track progress against goals
- Visual progress indicators

### API Endpoints

#### Authentication
- `POST /api/users/register` - Register new user
- `POST /api/users/login` - Login user
 - `POST /api/users/{email}/change-password` - Change user password (requires current password)
 - `DELETE /api/users/{email}` - Delete user account

#### Focus Sessions
- `POST /api/users/{userid}/focus-sessions` - Create focus session
- `GET /api/users/{userid}/focus-sessions` - Get sessions (with filters)
- `DELETE /api/users/{userid}/focus-sessions/{timestamp}` - Delete session

#### Goals
- `POST /api/users/{userid}/focus-goals` - Create/update goal
- `GET /api/users/{userid}/focus-goals` - Get all goals
- `DELETE /api/users/{userid}/focus-goals/{category}` - Delete goal

#### Statistics
- `GET /api/users/{userid}/stats` - Get user stats
- `GET /api/users/{userid}/stats/weekly` - Get weekly stats

See the interactive API documentation at `http://localhost:8000/docs` after starting the backend.

## Deployment

Production runs as three containers (Caddy, FastAPI, Postgres) on a single
GCP VM, deployed automatically by GitHub Actions on every push to `main`.
There's no GitHub Pages step and no separate EC2/nginx setup anymore — the
frontend is built into a Caddy image and served same-origin with the API.

See [`docs/DEPLOY.md`](docs/DEPLOY.md) for the full runbook: one-time GCP
setup, the CI/CD pipeline, DNS cutover, backups, and restoring from backup.

## Database Management

### Access Database

```bash
docker-compose exec db psql -U postgres -d app_db
```

### Backup Database

```bash
docker-compose exec db pg_dump -U postgres app_db > backup.sql
```

### Restore Database

```bash
cat backup.sql | docker-compose exec -T db psql -U postgres app_db
```

## Development Commands

```bash
# Start services
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild containers
docker-compose up --build

# Remove volumes (deletes database data)
docker-compose down -v
```

## Development

### Backend Development
- Models: `backend/app/models.py`
- API Routes: `backend/app/main.py`
- Database Operations: `backend/app/crud.py`
- Schemas: `backend/app/schemas.py`
- Database Schema: `backend/db/init.sql`

### Frontend Development
- Pages: `frontend/src/pages/`
- Components: `frontend/src/components/`
- API Services: `frontend/src/api/services.ts`
- Types: `frontend/src/types/index.ts`
- Styles: CSS files next to components

## Security Notes

- Change default PostgreSQL password in production
- Use environment variables for sensitive data
- Enable HTTPS for production
- Restrict CORS origins to your specific domain
- Keep dependencies updated
- Use strong passwords and secure connection strings

## Troubleshooting

### Database connection errors
```bash
# Check if database is running
docker-compose ps

# Check database logs
docker-compose logs db
```

### API not accessible
```bash
# Check if API is running
docker-compose logs api

# Verify ports are exposed
docker-compose ps
```

## Tech Stack

### Frontend
- React 18
- TypeScript
- Vite
- React Router
- Vanilla CSS

### Backend
- FastAPI
- SQLAlchemy
- PostgreSQL
- Passlib (password hashing)
- Pydantic

### Infrastructure
- Docker & Docker Compose
- Caddy (TLS + static frontend + reverse proxy)
- Google Cloud Platform (Compute Engine VM, Artifact Registry)
- GitHub Actions (CI + deploy, via Workload Identity Federation)

## Next Steps

See [`docs/DEPLOY.md`](docs/DEPLOY.md) for the deployment rollout checklist.
Known gaps in the application itself (not yet addressed):
1. Real session-based authentication — user-scoped routes currently trust
   the email in the URL with no verification.
2. Cross-user frontend state leak — the timer/category provider isn't
   cleared or scoped per-user on logout.
3. Split `main.py`/`crud.py` into routers and introduce Alembic migrations.
4. Fix the failing backend/frontend test suites and remove `continue-on-error`
   from the CI workflow once they pass.

## License

MIT
