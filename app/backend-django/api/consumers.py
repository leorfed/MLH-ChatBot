import json
import os

from channels.generic.websocket import AsyncWebsocketConsumer
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken


def _qs_param(scope, key: str) -> str | None:
    qs = scope.get("query_string", b"").decode()
    for part in qs.split("&"):
        if part.startswith(f"{key}="):
            return part[len(key) + 1:]
    return None


def _group(profile_id: str) -> str:
    return f"chat_{profile_id}"


class ChatConsumer(AsyncWebsocketConsumer):
    """
    Frontend connects here:
        ws://<host>/ws/chat/<profile_id>/?token=<jwt_access_token>

    Receives messages from the AI agent via the shared channel group
    and forwards frontend messages to the AI agent.
    """

    async def connect(self):
        token_str = _qs_param(self.scope, "token")
        if not token_str:
            await self.close(code=4001)
            return
        try:
            tok = AccessToken(token_str)
            self.user_id = tok["user_id"]
        except TokenError:
            await self.close(code=4001)
            return

        self.profile_id = self.scope["url_route"]["kwargs"]["profile_id"]
        self.group_name = _group(self.profile_id)

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        """Frontend → agent: broadcast to group so the AgentConsumer picks it up."""
        await self.channel_layer.group_send(self.group_name, {
            "type": "to_agent",
            "text": text_data,
        })

    # ── group message handlers ────────────────────────────────────────────────

    async def to_frontend(self, event):
        """Agent → frontend: relay to the connected browser."""
        if event.get("text"):
            await self.send(text_data=event["text"])

    async def to_agent(self, event):
        """Ignore — this consumer is not the agent."""
        pass


class AgentConsumer(AsyncWebsocketConsumer):
    """
    AI agents connect here:
        ws://<host>/ws/agent/<profile_id>/?secret=<AGENT_SECRET>

    One agent per profile_id. Receives messages from the frontend via the
    shared channel group and forwards agent responses back to the frontend.

    Set AGENT_SECRET env var to require authentication (recommended in prod).
    When AGENT_SECRET is not set, any connection is accepted (dev mode).
    """

    async def connect(self):
        expected = os.environ.get("AGENT_SECRET")
        if expected:
            provided = _qs_param(self.scope, "secret")
            if provided != expected:
                await self.close(code=4003)
                return

        self.profile_id = self.scope["url_route"]["kwargs"]["profile_id"]
        self.group_name = _group(self.profile_id)

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        """Agent → frontend: broadcast to group so the ChatConsumer picks it up."""
        await self.channel_layer.group_send(self.group_name, {
            "type": "to_frontend",
            "text": text_data,
        })

    # ── group message handlers ────────────────────────────────────────────────

    async def to_agent(self, event):
        """Frontend → agent: relay to the connected AI agent."""
        if event.get("text"):
            await self.send(text_data=event["text"])

    async def to_frontend(self, event):
        """Ignore — this consumer is not the frontend."""
        pass
