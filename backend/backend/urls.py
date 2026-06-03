import pathlib
from django.contrib import admin
from django.http import FileResponse, Http404
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from django.conf import settings
from api.views import send_alert, trigger_alert


def serve_frontend_asset(request, path, document_root):
    full_path = (pathlib.Path(document_root) / path).resolve()
    doc_root = pathlib.Path(document_root).resolve()
    if not str(full_path).startswith(str(doc_root)):
        raise Http404("Path outside document root")
    if not full_path.is_file():
        raise Http404("File not found")
    return FileResponse(full_path.open('rb'))


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    path('send-alert/', send_alert),
    path('trigger-alert/', trigger_alert),
]

# Serve frontend static files (css, js)
urlpatterns += [
    path('css/<path:path>', serve_frontend_asset, {'document_root': settings.FRONTEND_DIR / 'css'}),
    path('js/<path:path>', serve_frontend_asset, {'document_root': settings.FRONTEND_DIR / 'js'}),
]

# Serve frontend index.html for all other paths (SPA-style catch-all)
urlpatterns += [
    path('home/', TemplateView.as_view(template_name='home.html'), name='home-page'),
    re_path(r'^.*$', TemplateView.as_view(template_name='index.html'), name='home'),
]
