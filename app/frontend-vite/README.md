# UW-Crushes — CXC 2026

Voice-first speed dating app for Waterloo Tech Week. Connect with humans and AI companions.

## Monorepo Structure

```
├── CXC2026_Django_Backend/   # REST API — auth, profiles, database
├── CXC2026_Vite_Frontend/    # React/Vite SPA
├── docs/                     # Project-level documentation
└── engineering_notebook/     # Dev journal, decisions, retrospectives
```

## Quick Start

**Backend**
```bash
cd CXC2026_Django_Backend
uv run --with-requirements requirements.txt python manage.py migrate
uv run --with-requirements requirements.txt python manage.py runserver
```

**Frontend**
```bash
cd CXC2026_Vite_Frontend
npm install
npm run dev
```

Backend runs at `http://localhost:8000/api/`
Frontend runs at `http://localhost:5173/`
