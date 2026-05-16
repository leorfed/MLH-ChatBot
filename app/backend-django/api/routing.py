from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r"ws/chat/(?P<profile_id>\d+)/$", consumers.ChatConsumer.as_asgi()),
    re_path(r"ws/agent/(?P<profile_id>\d+)/$", consumers.AgentConsumer.as_asgi()),
]
