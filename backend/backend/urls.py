from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from django.views.static import serve
from django.conf import settings
from api.views import send_alert, trigger_alert

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    path('send-alert/', send_alert),
    path('trigger-alert/', trigger_alert),
]

# Serve frontend static files (css, js)
urlpatterns += [
    path('css/<path:path>', serve, {'document_root': settings.FRONTEND_DIR / 'css'}),
    path('js/<path:path>', serve, {'document_root': settings.FRONTEND_DIR / 'js'}),
]

# Serve frontend index.html for all other paths (SPA-style catch-all)
urlpatterns += [
    re_path(r'^.*$', TemplateView.as_view(template_name='index.html'), name='home'),
]
