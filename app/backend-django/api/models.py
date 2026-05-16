import os
import uuid as uuid_lib

from django.db import models
from django.contrib.auth.models import User


def _prefix(profile) -> str:
    return 'BOT' if profile.type == 'ai' else 'HUMAN'


def _avatar_path(instance, filename):
    p = instance.profile
    ext = os.path.splitext(filename)[1].lower()
    return f"img_avatars/{_prefix(p)}_{p.uuid}_{instance.uuid}_{ext[1:].upper()}{ext}"


def _banner_path(instance, filename):
    p = instance.profile
    ext = os.path.splitext(filename)[1].lower()
    return f"img_banners/{_prefix(p)}_{p.uuid}_{instance.uuid}_{ext[1:].upper()}{ext}"


def _personal_path(instance, filename):
    p = instance.profile
    ext = os.path.splitext(filename)[1].lower()
    return f"img_personal/{_prefix(p)}_{p.uuid}_{instance.uuid}_{ext[1:].upper()}{ext}"


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    uuid = models.UUIDField(default=uuid_lib.uuid4, editable=False, unique=True)
    display_name = models.CharField(max_length=100, blank=True)
    age = models.IntegerField(default=20)
    gender = models.CharField(max_length=50, blank=True)
    bio = models.TextField(blank=True)
    active_avatar = models.ForeignKey(
        'BucketAvatarImage', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+'
    )
    avatar_x = models.FloatField(default=50.0)
    avatar_y = models.FloatField(default=50.0)
    active_banner = models.ForeignKey(
        'BucketBannerImage', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+'
    )
    banner_x = models.FloatField(default=50.0)
    banner_y = models.FloatField(default=50.0)
    location = models.CharField(max_length=100, blank=True)
    looking_for = models.CharField(max_length=100, blank=True)
    interests = models.JSONField(default=list)
    compatibility_score = models.FloatField(default=0)
    online_status = models.BooleanField(default=True)  # used for AI profiles only
    last_seen = models.DateTimeField(null=True, blank=True)  # human presence tracking
    type = models.CharField(
        max_length=10,
        default='human',
        choices=[('human', 'Human'), ('ai', 'AI')],
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.display_name or self.user.email}"


# ── Bucket image tables ───────────────────────────────────────────────────────

class BucketAvatarImage(models.Model):
    """img_avatars bucket — profile pictures."""
    uuid = models.UUIDField(default=uuid_lib.uuid4, editable=False, unique=True)
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='avatar_images')
    file = models.ImageField(upload_to=_avatar_path)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.file.name


class BucketBannerImage(models.Model):
    """img_banners bucket — profile banner/hero images."""
    uuid = models.UUIDField(default=uuid_lib.uuid4, editable=False, unique=True)
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='banner_images')
    file = models.ImageField(upload_to=_banner_path)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.file.name


class BucketPersonalImage(models.Model):
    """img_personal bucket — additional personal photos."""
    uuid = models.UUIDField(default=uuid_lib.uuid4, editable=False, unique=True)
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='personal_images')
    file = models.ImageField(upload_to=_personal_path)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.file.name


COMPAT_CATEGORIES = [
    ('interests',      'Interests Alignment'),
    ('communication',  'Communication Style'),
    ('values',         'Values Match'),
    ('lifestyle',      'Lifestyle Sync'),
]


class CompatibilityScore(models.Model):
    """Per-category AI-computed score for a profile."""
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='compat_scores')
    category = models.CharField(max_length=20, choices=COMPAT_CATEGORIES)
    ai_score = models.FloatField(default=50.0)
    ai_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('profile', 'category')

    def __str__(self):
        return f"{self.profile} — {self.category}: {self.ai_score}"


class CompatibilityVote(models.Model):
    """A human voter's 0-100 score for a profile's compatibility category."""
    score = models.ForeignKey(CompatibilityScore, on_delete=models.CASCADE, related_name='votes')
    voter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='compat_votes')
    value = models.IntegerField()  # 0–100
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('score', 'voter')


class GuestSession(models.Model):
    token = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    claimed_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name='claimed_sessions'
    )
    claimed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.token


class ChatMessage(models.Model):
    ROLE_USER = 'user'
    ROLE_ASSISTANT = 'assistant'
    ROLE_CHOICES = [(ROLE_USER, 'User'), (ROLE_ASSISTANT, 'Assistant')]

    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='chat_messages')
    user = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name='chat_messages'
    )
    guest_session = models.ForeignKey(
        GuestSession, null=True, blank=True, on_delete=models.SET_NULL, related_name='messages'
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
