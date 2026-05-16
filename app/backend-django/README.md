# UW-Crushes — Django Backend

Pure REST API backend. Handles authentication, user profiles, and the database.

## Stack

- Django 5.1 + Django REST Framework
- JWT auth via `djangorestframework-simplejwt`
- SQLite (dev) / PostgreSQL (prod)
- `uv` for dependency management

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register/` | — | Create account |
| POST | `/api/auth/login/` | — | Get JWT tokens |
| POST | `/api/auth/refresh/` | — | Refresh access token |
| GET | `/api/auth/me/` | JWT | Current user |
| GET | `/api/profiles/` | JWT | All profiles |
| GET/PUT | `/api/profiles/me/` | JWT | Your profile |
| GET | `/api/profiles/<id>/` | JWT | Single profile |

## Schema

See [`docs/schema.md`](docs/schema.md) for full table definitions and API mapping.

Two tables: `auth_user` (Django built-in) and `api_profile` (one-to-one with user).

## Database

- **Development**: SQLite (`db.sqlite3` in project root, auto-created on first migrate)
- **Production**: PostgreSQL via `DATABASE_URL` env var

## Run

```bash
uv run --with-requirements requirements.txt python manage.py migrate
uv run --with-requirements requirements.txt python manage.py runserver
```

## Structure

```
config/         # Django project settings, urls, wsgi, asgi
api/            # App — models, views, serializers, urls, migrations
manage.py
requirements.txt
```
