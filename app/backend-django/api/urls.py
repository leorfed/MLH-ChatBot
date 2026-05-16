from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path('health/', views.health, name='health'),

    # Local Auth
    path('auth/login/', views.local_login, name='local_login'),

    # Auth0 OAuth — Django is the OAuth client (no Auth0 SDK on the frontend)
    path('auth/auth0/login/', views.auth0_login, name='auth0_login'),
    path('auth/auth0/callback/', views.auth0_callback, name='auth0_callback'),
    path('auth/auth0/logout/', views.auth0_logout, name='auth0_logout'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', views.me, name='me'),

    path('profiles/', views.profiles_list, name='profiles_list'),
    path('profiles/me/', views.my_profile, name='my_profile'),
    path('profiles/me/avatar/', views.my_avatar, name='my_avatar'),
    path('profiles/me/avatar/<int:pk>/', views.my_avatar_detail, name='my_avatar_detail'),
    path('profiles/me/banner/', views.my_banner, name='my_banner'),
    path('profiles/me/banner/<int:pk>/', views.my_banner_detail, name='my_banner_detail'),
    path('profiles/me/images/', views.my_personal_image, name='my_personal_image'),
    path('profiles/me/images/<int:pk>/', views.my_personal_image_detail, name='my_personal_image_detail'),
    path('profiles/<int:pk>/', views.profile_detail, name='profile_detail'),
    path('profiles/me/heartbeat/', views.heartbeat, name='heartbeat'),
    path('guest-session/', views.guest_session, name='guest_session'),
    path('profiles/<int:pk>/compatibility/', views.profile_compatibility, name='profile_compatibility'),
    path('profiles/<int:pk>/compatibility/<str:category>/vote/', views.profile_compatibility_vote, name='profile_compatibility_vote'),
    path('profiles/<int:pk>/chat/', views.profile_chat, name='profile_chat'),
    path('chat/claim/', views.claim_guest_session, name='claim_guest_session'),
]
