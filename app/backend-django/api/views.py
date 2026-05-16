import secrets
import urllib.parse

from authlib.integrations.django_client import OAuth
from django.conf import settings
from django.contrib.auth.models import User
from django.shortcuts import redirect as http_redirect
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from django.db.models import Prefetch
from .models import Profile, BucketAvatarImage, BucketBannerImage, BucketPersonalImage, GuestSession, ChatMessage, CompatibilityScore, CompatibilityVote, COMPAT_CATEGORIES
from .serializers import UserSerializer, ProfileSerializer


def _ctx(request):
    return {'request': request}


def _tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


# ── Authlib OAuth client (Auth0) ──────────────────────────────────────────────

oauth = OAuth()
oauth.register(
    "auth0",
    client_id=settings.AUTH0_CLIENT_ID,
    client_secret=settings.AUTH0_CLIENT_SECRET,
    client_kwargs={"scope": "openid profile email"},
    server_metadata_url=f"https://{settings.AUTH0_DOMAIN}/.well-known/openid-configuration",
)


@api_view(['GET'])
@permission_classes([AllowAny])
def health(request):
    return Response({'status': 'ok'})


@api_view(['POST'])
@permission_classes([AllowAny])
def local_login(request):
    """
    Local login fallback: find or create a user by email and return JWT tokens.
    In a real app, you'd check a password, but for this self-contained dev setup
    we'll allow passwordless 'login' by email for ease of use.
    """
    email = request.data.get('email', '').strip().lower()
    if not email:
        return Response({'detail': 'Email required.'}, status=status.HTTP_400_BAD_REQUEST)

    # Use email as username for local users
    user = User.objects.filter(email=email).first()
    if not user:
        user = User.objects.create_user(username=email, email=email)

    Profile.objects.get_or_create(user=user)
    tokens = _tokens_for_user(user)
    return Response(tokens)


# ── Auth0 OAuth views (plain Django — authlib handles state/PKCE internally) ──

def auth0_login(request):
    """Redirect browser to Auth0 Universal Login."""
    callback_uri = request.build_absolute_uri('/api/auth/auth0/callback/')
    return oauth.auth0.authorize_redirect(request, callback_uri)


def auth0_callback(request):
    """
    Auth0 redirects here after login.
    Authlib exchanges the code, fetches userinfo, then we:
      • find-or-create the Django User (username = Auth0 sub)
      • ensure a Profile exists
      • issue simplejwt tokens
      • redirect the SPA with tokens in query params (stripped immediately by the frontend)
    """
    try:
        token = oauth.auth0.authorize_access_token(request)
    except Exception as exc:
        return http_redirect(f"/?auth_error={urllib.parse.quote(str(exc))}")

    userinfo = token.get("userinfo", {})
    sub = userinfo.get("sub", "")
    email = userinfo.get("email", "")

    if not sub:
        return http_redirect("/?auth_error=missing_sub")

    # Try to find an existing user by Auth0 sub first, then fall back to email
    # so legacy email/password accounts are automatically linked to the Auth0 identity.
    user = User.objects.filter(username=sub).first()
    if user is None and email:
        user = User.objects.filter(email=email).first()
        if user is not None:
            # Migrate this account: update username to Auth0 sub so future
            # logins hit the fast path directly.
            user.username = sub
            user.save(update_fields=["username"])

    if user is None:
        user = User.objects.create_user(username=sub, email=email)
    elif email and user.email != email:
        user.email = email
        user.save(update_fields=["email"])

    Profile.objects.get_or_create(user=user)

    tokens = _tokens_for_user(user)
    return http_redirect(f"/?access={tokens['access']}&refresh={tokens['refresh']}")


def auth0_logout(request):
    """
    Clear Django session, then redirect to Auth0's logout endpoint so it
    clears its own SSO session (Google / social cookies included).
    After Auth0 logs the user out it sends them back to the app root.
    """
    request.session.flush()
    return_to = request.build_absolute_uri('/')
    logout_url = (
        f"https://{settings.AUTH0_DOMAIN}/v2/logout?"
        + urllib.parse.urlencode({
            "client_id": settings.AUTH0_CLIENT_ID,
            "returnTo": return_to,
        })
    )
    return http_redirect(logout_url)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    profile, _ = Profile.objects.get_or_create(user=request.user)
    return Response({
        'user': UserSerializer(request.user).data,
        'profile': ProfileSerializer(profile, context=_ctx(request)).data,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def profiles_list(request):
    profiles = Profile.objects.select_related('user', 'active_avatar', 'active_banner').prefetch_related('avatar_images', 'banner_images').all()
    return Response(ProfileSerializer(profiles, many=True, context=_ctx(request)).data)


@api_view(['GET'])
@permission_classes([AllowAny])
def profile_detail(request, pk):
    try:
        profile = Profile.objects.select_related('active_avatar', 'active_banner').prefetch_related('avatar_images', 'banner_images').get(pk=pk)
    except Profile.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
    return Response(ProfileSerializer(profile, context=_ctx(request)).data)


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def my_profile(request):
    profile, _ = Profile.objects.get_or_create(user=request.user)

    if request.method == 'GET':
        return Response(ProfileSerializer(profile, context=_ctx(request)).data)

    serializer = ProfileSerializer(profile, data=request.data, partial=True, context=_ctx(request))
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    serializer.save()
    return Response(serializer.data)


def _avatar_list(profile, request):
    return [
        {
            'id': img.id,
            'url': request.build_absolute_uri(img.file.url),
            'active': profile.active_avatar_id == img.id,
        }
        for img in profile.avatar_images.all().order_by('-uploaded_at')
    ]


def _banner_list(profile, request):
    return [
        {
            'id': img.id,
            'url': request.build_absolute_uri(img.file.url),
            'active': profile.active_banner_id == img.id,
        }
        for img in profile.banner_images.all().order_by('-uploaded_at')
    ]


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def my_avatar(request):
    """GET: list all avatar images. POST: upload new (field: 'avatar')."""
    profile, _ = Profile.objects.get_or_create(user=request.user)

    if request.method == 'GET':
        return Response(_avatar_list(profile, request))

    file = request.FILES.get('avatar')
    if not file:
        return Response({'detail': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)
    img = BucketAvatarImage.objects.create(profile=profile, file=file)
    profile.active_avatar = img
    profile.save(update_fields=['active_avatar'])
    profile.refresh_from_db()
    return Response(_avatar_list(profile, request))


@api_view(['DELETE', 'POST'])
@permission_classes([IsAuthenticated])
def my_avatar_detail(request, pk):
    """DELETE: remove avatar image. POST (activate): set as active avatar."""
    profile, _ = Profile.objects.get_or_create(user=request.user)
    try:
        img = BucketAvatarImage.objects.get(pk=pk, profile=profile)
    except BucketAvatarImage.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        if profile.active_avatar_id == img.id:
            profile.active_avatar = None
            profile.save(update_fields=['active_avatar'])
        img.file.delete(save=False)
        img.delete()
    else:  # POST = activate
        profile.active_avatar = img
        profile.save(update_fields=['active_avatar'])

    profile.refresh_from_db()
    return Response(_avatar_list(profile, request))


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def my_banner(request):
    """GET: list all banner images. POST: upload new (field: 'banner')."""
    profile, _ = Profile.objects.get_or_create(user=request.user)

    if request.method == 'GET':
        return Response(_banner_list(profile, request))

    file = request.FILES.get('banner')
    if not file:
        return Response({'detail': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)
    img = BucketBannerImage.objects.create(profile=profile, file=file)
    profile.active_banner = img
    profile.save(update_fields=['active_banner'])
    profile.refresh_from_db()
    return Response(_banner_list(profile, request))


@api_view(['DELETE', 'POST'])
@permission_classes([IsAuthenticated])
def my_banner_detail(request, pk):
    """DELETE: remove banner image. POST (activate): set as active banner."""
    profile, _ = Profile.objects.get_or_create(user=request.user)
    try:
        img = BucketBannerImage.objects.get(pk=pk, profile=profile)
    except BucketBannerImage.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        if profile.active_banner_id == img.id:
            profile.active_banner = None
            profile.save(update_fields=['active_banner'])
        img.file.delete(save=False)
        img.delete()
    else:  # POST = activate
        profile.active_banner = img
        profile.save(update_fields=['active_banner'])

    profile.refresh_from_db()
    return Response(_banner_list(profile, request))


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def my_personal_image(request):
    """GET: list personal photos. POST: upload one (field: 'image')."""
    profile, _ = Profile.objects.get_or_create(user=request.user)

    if request.method == 'GET':
        imgs = profile.personal_images.all().order_by('-uploaded_at')
        return Response([
            {'id': img.id, 'url': request.build_absolute_uri(img.file.url)}
            for img in imgs
        ])

    file = request.FILES.get('image')
    if not file:
        return Response({'detail': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)
    img = BucketPersonalImage.objects.create(profile=profile, file=file)
    return Response({'id': img.id, 'url': request.build_absolute_uri(img.file.url)},
                    status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def my_personal_image_detail(request, pk):
    """DELETE a personal image."""
    profile, _ = Profile.objects.get_or_create(user=request.user)
    try:
        img = BucketPersonalImage.objects.get(pk=pk, profile=profile)
    except BucketPersonalImage.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
    img.file.delete(save=False)
    img.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ── Compatibility scoring ─────────────────────────────────────────────────────

_POSITIVE = ['love', 'enjoy', 'passion', 'fun', 'creat', 'kind', 'adventur', 'curio', 'excit', 'inspir', 'motivat', 'amaz', 'wonder', 'brillian']
_VALUES_KW = ['honest', 'loyal', 'trust', 'genuine', 'real', 'connect', 'meaning', 'deep', 'authentic', 'care', 'respect', 'commit']
_LIFESTYLE_KW = ['active', 'travel', 'outdoor', 'fitness', 'cook', 'music', 'art', 'read', 'game', 'sport', 'gym', 'yoga', 'hike', 'danc']


def _sentiment_score(text, keywords):
    """Count how many keyword stems appear in text. Returns 0-1 saturation."""
    words = text.lower().split()
    hits = sum(1 for w in words for kw in keywords if kw in w)
    return min(hits / max(len(words), 1) * 20, 1.0)


def _compute_ai_scores(profile):
    bio = profile.bio or ''
    interests = profile.interests or []
    n_interests = len(interests)
    bio_words = bio.split()
    n_bio = len(bio_words)

    interests_score = min(n_interests * 13, 95)

    pos_sat = _sentiment_score(bio, _POSITIVE)
    comm_score = min(35 + n_bio * 1.2 + pos_sat * 40, 95)

    val_sat = _sentiment_score(bio, _VALUES_KW)
    lf_bonus = 25 if profile.looking_for else 0
    values_score = min(30 + lf_bonus + val_sat * 50, 95)

    ls_sat = _sentiment_score(' '.join(interests) + ' ' + bio, _LIFESTYLE_KW)
    loc_bonus = 20 if profile.location else 0
    lifestyle_score = min(25 + loc_bonus + ls_sat * 50 + n_interests * 4, 95)

    return {
        'interests':     round(interests_score),
        'communication': round(comm_score),
        'values':        round(values_score),
        'lifestyle':     round(lifestyle_score),
    }


def _ensure_compat_scores(profile):
    """Create or refresh AI scores for all categories."""
    ai_scores = _compute_ai_scores(profile)
    for category, ai_score in ai_scores.items():
        CompatibilityScore.objects.update_or_create(
            profile=profile, category=category,
            defaults={'ai_score': ai_score},
        )


def _compat_breakdown(profile, viewer):
    """Return the full breakdown dict for a profile."""
    _ensure_compat_scores(profile)
    rows = CompatibilityScore.objects.prefetch_related('votes').filter(profile=profile)
    label_map = dict(COMPAT_CATEGORIES)
    result = []
    for row in rows:
        votes = list(row.votes.values_list('value', flat=True))
        human_avg = round(sum(votes) / len(votes)) if votes else None
        my_vote = None
        if viewer and viewer.is_authenticated:
            try:
                my_vote = row.votes.get(voter=viewer).value
            except CompatibilityVote.DoesNotExist:
                pass
        combined = round(row.ai_score * 0.5 + human_avg * 0.5) if human_avg is not None else round(row.ai_score)
        result.append({
            'category':   row.category,
            'label':      label_map.get(row.category, row.category),
            'ai_score':   round(row.ai_score),
            'human_score': human_avg,
            'vote_count': len(votes),
            'my_vote':    my_vote,
            'combined':   combined,
        })
    # Stable order
    order = [c for c, _ in COMPAT_CATEGORIES]
    result.sort(key=lambda r: order.index(r['category']) if r['category'] in order else 99)
    return result


@api_view(['GET'])
@permission_classes([AllowAny])
def profile_compatibility(request, pk):
    try:
        profile = Profile.objects.get(pk=pk)
    except Profile.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
    return Response(_compat_breakdown(profile, request.user))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def profile_compatibility_vote(request, pk, category):
    """Body: { value: 0-100 }"""
    try:
        profile = Profile.objects.get(pk=pk)
    except Profile.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    valid_cats = [c for c, _ in COMPAT_CATEGORIES]
    if category not in valid_cats:
        return Response({'detail': 'Invalid category.'}, status=status.HTTP_400_BAD_REQUEST)

    value = request.data.get('value')
    if value is None or not isinstance(value, int) or not (0 <= value <= 100):
        return Response({'detail': 'value must be an integer 0–100.'}, status=status.HTTP_400_BAD_REQUEST)

    _ensure_compat_scores(profile)
    score_row = CompatibilityScore.objects.get(profile=profile, category=category)
    CompatibilityVote.objects.update_or_create(
        score=score_row, voter=request.user,
        defaults={'value': value},
    )
    return Response(_compat_breakdown(profile, request.user))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def heartbeat(request):
    """Mark the authenticated user as online (update last_seen)."""
    profile, _ = Profile.objects.get_or_create(user=request.user)
    profile.last_seen = timezone.now()
    profile.save(update_fields=['last_seen'])
    return Response({'status': 'ok'})


@api_view(['POST'])
@permission_classes([AllowAny])
def guest_session(request):
    """Issue a guest session token for unauthenticated users."""
    token = secrets.token_urlsafe(32)
    session = GuestSession.objects.create(token=token)
    return Response({'token': session.token}, status=status.HTTP_201_CREATED)


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def profile_chat(request, pk):
    """
    GET  — return message history for this profile.
           Auth: messages for request.user
           Anon: messages for guest_session matching X-Guest-Token header
    POST — save a message { role, content }.
           Auth: saved under user FK
           Anon: saved under guest_session from X-Guest-Token header
    """
    try:
        profile = Profile.objects.get(pk=pk)
    except Profile.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    def _serialize(msgs):
        return [
            {'id': m.id, 'role': m.role, 'content': m.content, 'created_at': m.created_at.isoformat()}
            for m in msgs
        ]

    def _get_guest(req):
        token = req.headers.get('X-Guest-Token', '')
        if not token:
            return None
        try:
            return GuestSession.objects.get(token=token, claimed_by__isnull=True)
        except GuestSession.DoesNotExist:
            return None

    if request.method == 'GET':
        if request.user.is_authenticated:
            msgs = ChatMessage.objects.filter(profile=profile, user=request.user)
        else:
            gs = _get_guest(request)
            msgs = ChatMessage.objects.filter(profile=profile, guest_session=gs) if gs else ChatMessage.objects.none()
        return Response(_serialize(msgs))

    # POST
    # Anonymous users may only chat with AI profiles
    if not request.user.is_authenticated and profile.type != 'ai':
        return Response({'detail': 'Sign in to chat with human profiles.'}, status=status.HTTP_403_FORBIDDEN)

    role = request.data.get('role')
    content = (request.data.get('content') or '').strip()
    if role not in (ChatMessage.ROLE_USER, ChatMessage.ROLE_ASSISTANT) or not content:
        return Response({'detail': 'role and content required.'}, status=status.HTTP_400_BAD_REQUEST)

    if request.user.is_authenticated:
        msg = ChatMessage.objects.create(profile=profile, user=request.user, role=role, content=content)
    else:
        gs = _get_guest(request)
        if not gs:
            return Response({'detail': 'Valid X-Guest-Token required.'}, status=status.HTTP_401_UNAUTHORIZED)
        msg = ChatMessage.objects.create(profile=profile, guest_session=gs, role=role, content=content)

    return Response(
        {'id': msg.id, 'role': msg.role, 'content': msg.content, 'created_at': msg.created_at.isoformat()},
        status=status.HTTP_201_CREATED,
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def claim_guest_session(request):
    """
    Called immediately after login to merge guest chat history into the user account.
    Body: { token: '<guest_token>' }
    """
    token = request.data.get('token', '')
    if not token:
        return Response({'detail': 'token required.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        gs = GuestSession.objects.get(token=token, claimed_by__isnull=True)
    except GuestSession.DoesNotExist:
        return Response({'detail': 'Invalid or already claimed token.'}, status=status.HTTP_404_NOT_FOUND)

    # Migrate all messages from guest session to this user
    migrated = ChatMessage.objects.filter(guest_session=gs, user__isnull=True)
    count = migrated.count()
    migrated.update(user=request.user, guest_session=None)

    # Mark session as claimed
    gs.claimed_by = request.user
    gs.claimed_at = timezone.now()
    gs.save(update_fields=['claimed_by', 'claimed_at'])

    return Response({'merged': count})
