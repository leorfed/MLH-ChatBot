from django.conf import settings
from django.http import FileResponse, HttpResponseNotFound
from django.urls import include, path, re_path
from django.views.static import serve


def spa(request):
    """Serve index.html for all React Router paths."""
    index = settings.FRONTEND_DIST / "index.html"
    if index.exists():
        return FileResponse(open(index, "rb"), content_type="text/html")
    return HttpResponseNotFound("Frontend not built — run: ./app/run.sh prod")


urlpatterns = [
    path("api/", include("api.urls")),
    re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
    # SPA catch-all — must be last; excludes /api/, /media/, /ws/
    re_path(r"^(?!api/|media/|ws/).*$", spa),
]
