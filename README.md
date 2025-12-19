# Focus Tracker

A full-stack focus time tracking application with a React TypeScript frontend hosted on GitHub Pages and a FastAPI + PostgreSQL backend running on AWS EC2 with Docker.

## Architecture

- **Frontend**: React + TypeScript static site hosted on GitHub Pages
- **Backend**: FastAPI running on AWS EC2 in Docker container
- **Database**: PostgreSQL running in Docker container alongside API

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
├── docker-compose.yml     # Docker orchestration
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
   git clone <your-repo-url>
   cd "App for Dad"
   ```

2. **Set up environment variables**
   ```bash
   cp backend/.env.example .env
   # Edit .env if needed
   ```

3. **Start the services**
   ```bash
   docker-compose up --build
   ```

4. **Access the API**
   - API: http://localhost:8000
   - API Docs: http://localhost:8000/docs
   - PostgreSQL: localhost:5432

5. **Start the frontend** (in a separate terminal)
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs
   - PostgreSQL: localhost:5432

## Features

### User Management
- User registration with hashed passwords (bcrypt)
- User authentication and login
- Session persistence

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

## Deployment to AWS EC2

### 1. Launch EC2 Instance

- Choose Amazon Linux 2 or Ubuntu
- Instance type: t2.micro (free tier) or larger
- Configure security group to allow:
  - SSH (port 22) from your IP
  - HTTP (port 80) from anywhere
  - HTTPS (port 443) from anywhere
  - Custom TCP (port 8000) from anywhere

### 2. Install Docker on EC2

```bash
# For Amazon Linux 2
sudo yum update -y
sudo yum install -y docker
sudo service docker start
sudo usermod -a -G docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 3. Deploy Application

```bash
# Clone your repository
git clone <your-repo-url>
cd "App for Dad"

# Create .env file
cp backend/.env.example .env
# Edit .env with production values

# Start services
docker-compose up -d --build
```

### 4. Configure CORS

Update `backend/app/main.py` to include your GitHub Pages URL:

```python
allow_origins=[
    "https://yourusername.github.io",  # Your GitHub Pages URL
]
```

### 5. Set Up HTTPS (Recommended)

Consider using:
- AWS Application Load Balancer with ACM certificate
- Nginx reverse proxy with Let's Encrypt
- Cloudflare as a proxy

## Deploying Frontend to GitHub Pages

1. **Update `frontend/vite.config.ts`:**
   ```typescript
   base: '/your-repo-name/', // e.g., '/focus-tracker/'
   ```

2. **Create `frontend/.env.production`:**
   ```env
   VITE_API_URL=http://your-ec2-ip:8000
   ```

3. **Build and deploy:**
   ```bash
   cd frontend
   npm run deploy
   ```

4. **Enable GitHub Pages:**
   - Go to repository Settings > Pages
   - Set source to "gh-pages" branch
   - Your site will be at `https://username.github.io/repo-name/`

5. **Update CORS in backend:**
   Edit `backend/app/main.py` to include your GitHub Pages URL:
   ```python
   allow_origins=[
       "https://username.github.io",
   ]
   ```

See `frontend/README.md` for detailed deployment instructions.

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
- AWS EC2 (backend)
- GitHub Pages (frontend)

## Next Steps

1. ✅ Frontend and backend templates created
2. Set up GitHub repository
3. Deploy backend to EC2
4. Deploy frontend to GitHub Pages
5. Set up custom domain (optional)
6. Add JWT authentication (optional upgrade)
7. Set up monitoring and logging
8. Configure automated backups

## License

MIT
