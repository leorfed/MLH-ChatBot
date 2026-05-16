# Auth0 Configuration Guide

> Engineering Notebook · 2026-04-02
> This app uses **server-side Authorization Code Flow** — Django is the OAuth client.
> The frontend never touches Auth0 directly; it only talks to Django.

---

## Architecture Recap

```
Browser  ──── GET /api/auth/auth0/login/ ────▶  Django (Authlib)
                                                    │
                                                    ▼
Browser  ◀── 302 redirect ──────────────────  Auth0 /authorize
    │
    │  user logs in at Auth0
    ▼
Auth0  ──── GET /api/auth/auth0/callback/?code=... ──▶  Django
                                                            │  exchanges code for tokens
                                                            │  creates/merges User
                                                            │  issues simplejwt tokens
                                                            ▼
Browser  ◀── 302 /?access=JWT&refresh=JWT ──────────  Django
```

No Auth0 SDK on the frontend. Django stores nothing from Auth0 long-term — it uses the `sub` claim as `User.username` and issues its own simplejwt tokens.

---

## Step 1 — Create an Application in Auth0 Dashboard

1. Go to [manage.auth0.com](https://manage.auth0.com)
2. **Applications → Applications → Create Application**
3. Name: `CXC UW Crushes` (or anything)
4. Type: **Regular Web Application** (not SPA — Django is a server-side client)
5. Click **Create**

---

## Step 2 — Application Settings

Inside the new application's **Settings** tab, fill in:

### Basic Information

| Field | Value |
|---|---|
| Domain | `dev-82q507ad63f56xcn.us.auth0.com` |
| Client ID | `DsZlUfGuAY2MCulXZ1HA93s63TRyU2d5` |
| Client Secret | (copy from dashboard — keep secret) |

### Application URIs

These are the critical fields. Auth0 rejects any URL not on these lists.

#### Allowed Callback URLs
URLs Auth0 will redirect back to after login. Add **all** environments you use:

```
http://localhost:8000/api/auth/auth0/callback/,
https://mosquito-prompt-muskox.ngrok-free.app/api/auth/auth0/callback/
```

> If your ngrok URL changes, update this immediately — login will break with a "redirect_uri mismatch" error.

#### Allowed Logout URLs
URLs Auth0 will redirect back to after logout (`returnTo` param):

```
http://localhost:8000/,
https://mosquito-prompt-muskox.ngrok-free.app/
```

> If this is missing or wrong, logout will hit an Auth0 error page instead of returning to the app.

#### Allowed Web Origins
Used for CORS during the token exchange. Add your front-facing origins:

```
http://localhost:8000,
http://localhost:5173,
https://mosquito-prompt-muskox.ngrok-free.app
```

#### Allowed Origins (CORS)
Same as above — some Auth0 UI versions show this separately:

```
http://localhost:8000,
http://localhost:5173,
https://mosquito-prompt-muskox.ngrok-free.app
```

Click **Save Changes** at the bottom.

---

## Step 3 — Configure Social Connections (Google)

1. Go to **Authentication → Social**
2. Find **Google / Gmail** → click to configure
3. Add your Google OAuth2 credentials **or** use Auth0's built-in dev keys (fine for development)
4. Enable it and click **Save**
5. Go back to **Applications → your app → Connections** tab
6. Make sure **google-oauth2** is toggled ON

> Auth0's built-in dev Google keys work for development but show a warning to users. For production, create your own Google OAuth app at console.cloud.google.com.

---

## Step 4 — Environment Variables

Set these in your `.env` file (gitignored) and in `docker-compose.yml`:

```env
AUTH0_DOMAIN=dev-82q507ad63f56xcn.us.auth0.com
AUTH0_CLIENT_ID=DsZlUfGuAY2MCulXZ1HA93s63TRyU2d5
AUTH0_CLIENT_SECRET=<paste from Auth0 dashboard>
AGENT_SECRET=<any long random string for AI agent WS auth>
```

Django reads these in `config/settings.py`:

```python
AUTH0_DOMAIN = os.environ.get("AUTH0_DOMAIN", "")
AUTH0_CLIENT_ID = os.environ.get("AUTH0_CLIENT_ID", "")
AUTH0_CLIENT_SECRET = os.environ.get("AUTH0_CLIENT_SECRET", "")
```

And Authlib uses them in `api/views.py`:

```python
oauth.register(
    "auth0",
    client_id=settings.AUTH0_CLIENT_ID,
    client_secret=settings.AUTH0_CLIENT_SECRET,
    client_kwargs={"scope": "openid profile email"},
    server_metadata_url=f"https://{settings.AUTH0_DOMAIN}/.well-known/openid-configuration",
)
```

---

## Step 5 — Django Session & CSRF Settings

Authlib stores OAuth state in the Django session to prevent CSRF during the callback. Make sure these are set in `settings.py`:

```python
# Required for Authlib state storage through a proxy (ngrok, Heroku, etc.)
CSRF_TRUSTED_ORIGINS = [
    "https://mosquito-prompt-muskox.ngrok-free.app",
    "http://localhost:8000",
    "http://localhost:5173",
]

# Sessions must be enabled (Authlib uses them for state/PKCE)
SESSION_ENGINE = "django.contrib.sessions.backends.db"  # default, just be explicit
```

If sessions aren't working, the callback will fail with `mismatching_state` error.

---

## Step 6 — Django URL Registration

Confirm these three routes exist in `api/urls.py`:

```python
path('auth/auth0/login/',    views.auth0_login,    name='auth0_login'),
path('auth/auth0/callback/', views.auth0_callback, name='auth0_callback'),
path('auth/auth0/logout/',   views.auth0_logout,   name='auth0_logout'),
```

And that `api/` is mounted under `/api/` in the root `config/urls.py`:

```python
path('api/', include('api.urls')),
```

---

## Step 7 — Verify the Flow End-to-End

### Login test
1. Open an incognito window
2. Go to `https://<your-host>/api/auth/auth0/login/`
3. Auth0 login page should appear
4. Sign in with Google (or email)
5. Should redirect back to `/?access=<jwt>&refresh=<jwt>`
6. URL should immediately strip the tokens (frontend does `history.replaceState`)
7. You should be logged in — sidebar appears, profile loads

### Logout test
1. Click Sign Out in the sidebar
2. Should hit `/api/auth/auth0/logout/` → redirect to Auth0 → redirect back to `/`
3. You should be on the landing page, logged out
4. Re-clicking Sign In should **not** auto-login (Google SSO cleared)
5. If it still auto-logs in: check **Allowed Logout URLs** in Auth0 dashboard matches your host exactly (including protocol, no trailing slash issues)

### Account merge test (existing users)
If a user previously registered with `darcy@gmail.com` (email/password) and now logs in via Google OAuth:
- Auth0 callback receives `sub = google-oauth2|12345`, `email = darcy@gmail.com`
- Django looks up `User` by `sub` → not found
- Django looks up `User` by `email` → found (legacy account)
- Django updates `user.username = sub` → merged
- All old data (profile, images, chat history) is preserved

---

## Common Errors & Fixes

| Error | Cause | Fix |
|---|---|---|
| `redirect_uri_mismatch` | Callback URL not in Auth0 allowlist | Add exact URL to **Allowed Callback URLs** in dashboard |
| `mismatching_state` | Django session not persisting between login and callback | Check `SESSION_ENGINE`, `CSRF_TRUSTED_ORIGINS`, and that cookies aren't blocked |
| Auth0 error page on logout | `returnTo` URL not in allowlist | Add your host to **Allowed Logout URLs** |
| Auto-login after logout | Auth0 SSO session not cleared | Verify logout hits `/api/auth/auth0/logout/` (not just clearing localStorage) |
| `missing_sub` redirect | Auth0 didn't return a `sub` claim | Should not happen with standard connections; check Auth0 connection config |
| Google shows "unverified app" warning | Using Auth0's built-in dev Google keys | Normal for dev; for prod, register your own Google OAuth app |

---

## When Your ngrok URL Changes

ngrok free tier rotates the subdomain on every restart. When it changes:

1. **Auth0 Dashboard** → Application Settings → update both:
   - Allowed Callback URLs
   - Allowed Logout URLs
2. **`settings.py`** → update `CSRF_TRUSTED_ORIGINS`
3. Rebuild or restart the container (env var change needed if `NGROK_URL` is referenced anywhere)

> Consider pinning a static ngrok domain (ngrok paid) or switching to a fixed dev domain to avoid this churn.

---

## Adding a New Environment (e.g. Heroku / Production)

1. Auth0 Dashboard → add production URLs to all allowlists (comma-separated, don't remove dev URLs)
2. Set env vars on the new host:
   ```
   AUTH0_DOMAIN=dev-82q507ad63f56xcn.us.auth0.com
   AUTH0_CLIENT_ID=DsZlUfGuAY2MCulXZ1HA93s63TRyU2d5
   AUTH0_CLIENT_SECRET=<secret>
   ```
3. Add production host to `CSRF_TRUSTED_ORIGINS` in `settings.py`
4. For Heroku specifically: Auth0 automatically detects `X-Forwarded-Proto` so `build_absolute_uri` will produce `https://` URLs correctly — no extra config needed
