# Focus Tracker Frontend

React + TypeScript frontend for the Focus Tracker application.

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
cd frontend
npm install
```

### Development

```bash
# Start development server
npm run dev
```

The app will run at `http://localhost:3000` with hot module replacement.

### Environment Variables

Create a `.env` file in the frontend directory:

```env
VITE_API_URL=http://localhost:8000
```

For production, update this to your EC2 instance URL.

### Building for Production

```bash
npm run build
```

This creates an optimized production build in the `dist/` directory.

## Deploying to GitHub Pages

### Option 1: Manual Deployment

1. **Update `vite.config.ts`:**
   ```typescript
   base: '/your-repo-name/', // e.g., '/focus-tracker/'
   ```

2. **Update API URL in `.env`:**
   ```env
   VITE_API_URL=http://your-ec2-ip:8000
   ```

3. **Build and deploy:**
   ```bash
   npm run deploy
   ```

### Option 2: GitHub Actions (Automated)

Create `.github/workflows/deploy.yml` in your repository root:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: cd frontend && npm ci

      - name: Build
        run: cd frontend && npm run build
        env:
          VITE_API_URL: ${{ secrets.API_URL }}

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./frontend/dist
```

Then in your GitHub repository settings:
1. Go to Settings > Secrets and variables > Actions
2. Add a secret `API_URL` with your EC2 API URL
3. Go to Settings > Pages
4. Set source to "gh-pages" branch

## Project Structure

```
frontend/
├── src/
│   ├── api/              # API client and services
│   │   ├── client.ts     # Base API client
│   │   └── services.ts   # Service functions
│   ├── components/       # Reusable components
│   │   └── Layout.tsx    # App layout with navigation
│   ├── contexts/         # React contexts
│   │   └── AuthContext.tsx  # Authentication state
│   ├── pages/            # Page components
│   │   ├── Dashboard.tsx
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── Timer.tsx
│   │   ├── Stats.tsx
│   │   └── Goals.tsx
│   ├── types/            # TypeScript types
│   │   └── index.ts
│   ├── utils/            # Utility functions
│   │   └── formatters.ts
│   ├── App.tsx           # Main app component
│   ├── main.tsx          # Entry point
│   └── index.css         # Global styles
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Features

### Authentication
- User registration and login
- Client-side session persistence with localStorage
- Protected routes

### Timer
- Start/pause/resume timer
- Custom categories
- Save completed focus sessions to backend

### Dashboard
- Weekly stats overview
- Recent sessions
- Category progress with goals

### Stats
- All-time and weekly statistics
- Category breakdown
- Session history with filtering
- Delete sessions

### Goals
- Set weekly focus goals per category
- Track progress against goals
- Manage goals (create/delete)

## API Integration

The frontend communicates with the FastAPI backend through:

- `/api/users/register` - User registration
- `/api/users/login` - User authentication
- `/api/users/{userid}/focus-sessions` - CRUD for focus sessions
- `/api/users/{userid}/focus-goals` - CRUD for focus goals
- `/api/users/{userid}/stats` - Get user statistics

See `src/api/services.ts` for all API endpoints.

## License

MIT
