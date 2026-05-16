# Database Schema

SQLite in development (`db.sqlite3`), PostgreSQL in production.

---

## User (Django built-in `auth_user`)

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | auto-increment |
| username | VARCHAR(150) | set to email on register |
| email | VARCHAR(254) | unique, used for login |
| password | VARCHAR(128) | bcrypt hashed |
| is_active | BOOLEAN | default true |

---

## Profile (`api_profile`)

One-to-one with User. Created automatically on register.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | auto-increment |
| user_id | INTEGER FK → auth_user.id | CASCADE delete, unique |
| display_name | VARCHAR(100) | blank allowed |
| age | INTEGER | default 20 |
| gender | VARCHAR(50) | blank allowed |
| bio | TEXT | blank allowed |
| avatar | VARCHAR(100) | relative path under `MEDIA_ROOT/avatars/`, blank allowed |
| location | VARCHAR(100) | blank allowed |
| looking_for | VARCHAR(100) | blank allowed |
| interests | JSON | array of strings, default [] |
| compatibility_score | REAL | 0–100, default 0 |
| online_status | BOOLEAN | default true |
| type | VARCHAR(10) | `human` or `ai`, default `human` |
| created_at | DATETIME | auto set on create |
| updated_at | DATETIME | auto updated on save |

---

## Relationships

```
auth_user ──< api_profile
  (1)           (1)
```

---

## API ↔ Schema Mapping

| Endpoint | Table(s) touched |
|----------|-----------------|
| POST `/api/profiles/me/avatar/` | api_profile (write avatar file, multipart/form-data field: `avatar`) |
| POST `/api/auth/register/` | auth_user + api_profile (insert both) |
| POST `/api/auth/login/` | auth_user (read, verify password) |
| GET `/api/auth/me/` | auth_user (read) |
| GET `/api/profiles/` | api_profile JOIN auth_user (read all) |
| GET/PUT `/api/profiles/me/` | api_profile (read/write own row) |
| GET `/api/profiles/<id>/` | api_profile (read single row) |

---

## WebSocket Endpoints

Django is the relay hub. All traffic passes through a shared channel group `chat_<profile_id>`.

| Path | Who connects | Auth |
|------|-------------|------|
| `ws://<host>/ws/chat/<profile_id>/?token=<jwt>` | Browser / frontend | JWT access token in query string |
| `ws://<host>/ws/agent/<profile_id>/?secret=<AGENT_SECRET>` | AI agents | `AGENT_SECRET` env var (optional; open in dev) |

### Message flow

```
Browser  →  Django ChatConsumer  →  group_send(type: "to_agent")
                                        ↓
                              AgentConsumer.to_agent()  →  AI agent

AI agent  →  AgentConsumer.receive()  →  group_send(type: "to_frontend")
                                            ↓
                                  ChatConsumer.to_frontend()  →  Browser
```

All messages are JSON strings. Structure is defined by the AI agent implementation.
