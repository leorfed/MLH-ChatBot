# AI Agent Chat — Architecture Brainstorm

> Engineering Notebook · 2026-04-02

---

## 1. What Already Exists

The relay layer is already wired up. There are two WebSocket consumers sharing a Django Channels group:

```
Browser  ──ws──▶  ChatConsumer  ──group(chat_{id})──▶  AgentConsumer  ──ws──▶  AI process
Browser  ◀──ws──  ChatConsumer  ◀──group(chat_{id})──  AgentConsumer  ◀──ws──  AI process
```

| Endpoint | Auth | Purpose |
|---|---|---|
| `ws://.../ws/chat/<profile_id>/?token=<jwt>` | simplejwt access token | Browser ↔ relay |
| `ws://.../ws/agent/<profile_id>/?secret=<AGENT_SECRET>` | shared env secret | AI agent ↔ relay |
| `GET /api/profiles/<id>/chat/` | jwt or guest token | Load message history |
| `POST /api/profiles/<id>/chat/` | jwt or guest token | Persist a message |

So the Django side is mostly done. What's **missing** is the AI agent process itself — the thing that actually connects to `/ws/agent/<id>/`, reads incoming messages, calls an LLM, and sends responses back.

---

## 2. Agent Authentication — What We Have & What We Need

### Current: shared `AGENT_SECRET`

The `AgentConsumer` checks `?secret=<AGENT_SECRET>` against the `AGENT_SECRET` env var. Any process that knows the secret can connect as any profile's agent.

```python
# consumers.py
expected = os.environ.get("AGENT_SECRET")
if expected:
    provided = _qs_param(self.scope, "secret")
    if provided != expected:
        await self.close(code=4003)
        return
```

**Pros:** Dead simple. One secret for all agents.
**Cons:** No per-profile isolation. A compromised agent can impersonate any profile. No rotation without restarting all agents.

### Option A: Keep shared secret, add profile ownership check (easy win)

Add a DB lookup inside `AgentConsumer.connect()` to verify the profile exists and `type == 'ai'`. Rejects connections for human profiles immediately.

```python
from api.models import Profile
profile = await Profile.objects.aget(pk=self.profile_id)
if profile.type != 'ai':
    await self.close(code=4003)
    return
```

### Option B: Per-agent API keys stored in the DB (recommended for production)

Add an `AgentKey` model:

```python
class AgentKey(models.Model):
    profile = models.OneToOneField(Profile, on_delete=models.CASCADE, related_name='agent_key')
    key = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

`AgentConsumer.connect()` does a DB lookup instead of env comparison. Each AI profile gets its own rotatable key. Expose a Django admin action to regenerate keys.

### Option C: simplejwt tokens for agents (most consistent with the rest of the stack)

Create agent users in Django (same `User` model, just with `type='ai'` profile). Issue them JWT access tokens the same way humans get them. The `AgentConsumer` validates the token and checks the profile matches.

- Agents call `POST /api/auth/agent-token/` with their API key → get a short-lived JWT
- JWT carries `profile_id` claim
- Consumer validates JWT + profile_id match

This is the most elegant because the same auth infrastructure covers everything, and tokens expire automatically.

---

## 3. Agent Process Design

### Option A: One long-running process per AI profile

A Python script (or Docker service) per profile that:
1. Connects to `ws://.../ws/agent/<profile_id>/?secret=...` on startup
2. Maintains the connection with a ping/keepalive loop
3. On `to_agent` message: calls LLM API → streams response → sends back

```python
# agent_runner.py (sketch)
import asyncio, websockets, json
from anthropic import Anthropic

client = Anthropic()
SYSTEM_PROMPT = "You are Aria, a witty AI on a dating app..."

async def run(profile_id, secret, ws_url):
    async with websockets.connect(f"{ws_url}/ws/agent/{profile_id}/?secret={secret}") as ws:
        async for raw in ws:
            payload = json.loads(raw)
            user_message = payload.get("message", "")

            # Stream tokens back as they arrive
            with client.messages.stream(
                model="claude-opus-4-6",
                max_tokens=500,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_message}],
            ) as stream:
                full_response = ""
                for text in stream.text_stream:
                    full_response += text
                    # Option: send partial tokens for streaming UI
                    await ws.send(json.dumps({"type": "chunk", "content": text}))

                # Final complete message
                await ws.send(json.dumps({"type": "done", "message": full_response}))
```

**Pros:** Simple, stateful (can hold conversation history in memory), easy to debug.
**Cons:** One process per profile doesn't scale well. If profile count grows to 20+, you're running 20+ idle processes.

### Option B: One multiplexed agent process for all AI profiles

A single process manages all `profile_id`s by maintaining a dict of open WebSocket connections:

```python
connections: dict[int, websockets.WebSocketClientProtocol] = {}

async def connect_all():
    ai_profiles = fetch_ai_profiles_from_db()  # REST call to /api/profiles/?type=ai
    for profile in ai_profiles:
        conn = await websockets.connect(f"{WS_URL}/ws/agent/{profile.id}/?secret={SECRET}")
        connections[profile.id] = conn
        asyncio.create_task(listen(profile, conn))
```

**Pros:** One process to deploy and monitor.
**Cons:** Single point of failure. More complex error handling.

### Option C: HTTP polling agent (no persistent WebSocket)

Instead of a persistent WebSocket, the agent polls the REST endpoint:

```
GET /api/profiles/<id>/chat/?since=<timestamp>  →  new messages
POST /api/profiles/<id>/chat/  →  persist response
```

No real-time relay needed. The frontend just polls the REST endpoint too (or uses a lightweight SSE stream).

**Pros:** Extremely simple. Stateless. Easy to scale horizontally.
**Cons:** Latency. Not truly real-time. Polling overhead.

### Option D: Webhook / task queue (Celery + Redis) — best for scale

When a user message is persisted via `POST /api/profiles/<id>/chat/`, Django enqueues a Celery task:

```python
# views.py
@api_view(['POST'])
def profile_chat(request, pk):
    msg = ChatMessage.objects.create(...)
    generate_agent_response.delay(profile_id=pk, message_id=msg.id)
    return Response(serializer.data)

# tasks.py
@shared_task
def generate_agent_response(profile_id, message_id):
    history = ChatMessage.objects.filter(profile_id=profile_id).order_by('created_at')
    response = call_llm(history)
    msg = ChatMessage.objects.create(role='assistant', content=response, ...)
    # Push to channel group so the WebSocket delivers it in real time
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"chat_{profile_id}",
        {"type": "to_frontend", "text": json.dumps({"message": response})}
    )
```

**Pros:** Decoupled. Agent "work" is retryable. Can be distributed. Scales independently of Django.
**Cons:** Requires Redis + Celery. More moving parts. Streaming tokens back is harder (need SSE or WS for partials).

---

## 4. Conversation History & Context

Every AI response needs conversation history injected into the system prompt. The history is already in `ChatMessage`. The agent needs to:

1. Load recent history from DB (or receive it in the WebSocket message)
2. Convert to LLM message format
3. Keep the context window under the model's limit

### History delivery options

**Option A: Agent fetches from REST on each message**
```
User sends message → Django persists it → relays to agent WS
Agent receives message → calls GET /api/profiles/<id>/chat/ → gets full history
Agent calls LLM with history → sends response
```
Simple. Always fresh. But adds an HTTP round-trip per message.

**Option B: Django includes history in the WS message**
```json
{
  "message": "Hey, what do you think about hiking?",
  "history": [
    {"role": "user", "content": "Hi there!"},
    {"role": "assistant", "content": "Hey! I'm Aria..."}
  ]
}
```
Agent gets everything in one payload. No extra HTTP call. Django controls what history window to send (last N messages, or last K tokens).

**Option C: Agent holds history in memory (stateful)**
Agent maintains its own in-memory history per user session. Fastest — no DB call. Risky if agent restarts (loses state). Needs a fallback to reload from DB on reconnect.

**Recommended:** Option B for simplicity. Django sends the last 20 messages with each user message. Agent doesn't need DB access at all.

---

## 5. Per-Profile Personality / System Prompts

Each AI profile needs a distinct personality. Options:

### Store system prompt in the Profile model

```python
# Add to Profile model
system_prompt = models.TextField(blank=True, help_text="System prompt for the AI agent")
```

Include it in the WS message payload (Option B above). The agent uses it verbatim.

### Construct dynamically from profile fields

```python
def build_system_prompt(profile: Profile) -> str:
    return f"""You are {profile.display_name}, a {profile.age}-year-old living in {profile.location}.
Bio: {profile.bio}
Looking for: {profile.looking_for}
Interests: {', '.join(profile.interests)}

You are chatting with someone on a dating app. Stay in character. Be warm, witty, and genuine.
Never break character or reveal you are an AI unless directly asked."""
```

**Recommended:** Dynamic construction from existing profile fields — no new DB columns needed, always in sync with the profile.

---

## 6. Channel Layer — InMemory vs Redis

Currently using `InMemoryChannelLayer`. This works for a single-process server but has a critical limitation:

> **Messages only route correctly if both the `ChatConsumer` (browser) and `AgentConsumer` (AI) are in the same process.**

With a single Daphne process this is fine. But if you ever run multiple workers or a separate agent process on a different host, the channel group won't bridge them.

**For production:** Switch to `channels-redis`:

```toml
# pyproject.toml
"channels-redis>=4.2,<5"
```

```python
# settings.py
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [os.environ.get("REDIS_URL", "redis://localhost:6379")]},
    }
}
```

This lets the agent run as a completely separate process or even a separate container and still communicate with browser consumers through Redis pub/sub.

---

## 7. Streaming Responses (Token-by-Token)

The current `ChatWindow.tsx` waits for a single complete message from the agent. To display a typing stream (like ChatGPT):

### Backend: agent sends chunk events + done event

```json
{ "type": "chunk", "content": "Hey" }
{ "type": "chunk", "content": " there" }
{ "type": "chunk", "content": "!" }
{ "type": "done",  "message": "Hey there!" }
```

### Frontend: handle chunk events

In `ChatWindow.tsx`, track a `streamingContent` state that appends chunks, then commit it to `profileMessages` on `done`:

```tsx
const [streaming, setStreaming] = useState("");

// in onMessage handler:
if (data.type === "chunk") {
  setStreaming(prev => prev + (data.content as string));
} else if (data.type === "done") {
  setStreaming("");
  await persistMessage(profile.id, "assistant", data.message as string);
}
```

Render the `streaming` string as a live assistant bubble above the typing indicator.

---

## 8. Rate Limiting & Cost Control

Each LLM call costs money. Mitigations:

- **Per-user message rate limit:** e.g. 10 messages/minute via `django-ratelimit` or middleware
- **Context window cap:** only send last 20 messages to LLM (not full history)
- **Token budget per conversation:** track total tokens used per `(user, profile)` pair, block after limit
- **Model tiering:** use Haiku for short replies, Sonnet for longer ones, reserve Opus for premium

```python
# Simple token budget check in the agent
DAILY_TOKEN_LIMIT = 10_000

def check_budget(user_id: int, profile_id: int) -> bool:
    used = get_tokens_used_today(user_id, profile_id)
    return used < DAILY_TOKEN_LIMIT
```

---

## 9. Recommended Implementation Path

### Phase 1 — MVP (works today, minimal new code)

1. Add `system_prompt` field to `Profile` model (or build it dynamically)
2. Write a single `agent_runner.py` script that:
   - Connects to `/ws/agent/<profile_id>/?secret=<AGENT_SECRET>`
   - On message: fetches history via REST, calls Claude, sends response
3. Run one instance per AI profile (docker-compose `agent-aria`, `agent-nova`, etc.)
4. Channel layer stays InMemory (single Daphne process, agents on same host)

**This is deployable in a day.**

### Phase 2 — Proper architecture

1. Switch channel layer to Redis
2. Move agent process to a single multiplexed runner (all profiles, one process)
3. Send history in the WS message payload (eliminate per-message REST call)
4. Add per-agent API key auth (`AgentKey` model, Option B above)
5. Add streaming chunk support in both agent and `ChatWindow.tsx`

### Phase 3 — Scale & polish

1. Move LLM calls to Celery tasks (decouple from WS connection lifecycle)
2. Per-user rate limiting and token budgets
3. Admin UI for system prompts and agent key rotation
4. Structured logging per conversation for quality review

---

## 10. Open Questions

- **Which LLM?** Claude is the obvious choice (Anthropic stack). `claude-haiku-4-5` for low latency, `claude-sonnet-4-6` for quality.
- **Where do agents run?** Same container as Django (simplest) vs separate service (cleaner).
- **Guest users:** currently guests can chat (via `X-Guest-Token`). Should AI agents respond to guests? Yes — it's a demo context. Guests should get responses but with a shorter history window.
- **Fallback when agent is offline?** The frontend shows "CONNECTED" vs "CONNECTING" but if no agent is listening on `/ws/agent/<id>/`, the user's message just sits in the channel group forever. Need a timeout + graceful "agent unavailable" message.
- **Conversation persistence across sessions:** currently `ChatMessage` persists everything. The agent needs to load this from DB on startup (or receive it in the WS payload) to maintain continuity.
