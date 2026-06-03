from django.urls import path
from . import views

urlpatterns = [
    # Auth
    path('auth/register/', views.register, name='register'),
    path('auth/login/', views.login_view, name='login'),
    path('auth/me/', views.me, name='me'),

    # Emergency Contacts
    path('contacts/', views.contacts_list, name='contacts-list'),
    path('contacts/<int:pk>/', views.contacts_detail, name='contacts-detail'),

    # Alerts
    path('alerts/', views.alerts_list, name='alerts-list'),

    # SOS Emergency
    path('sos/trigger/', views.sos_trigger, name='sos-trigger'),
    path('sos/resolve/<int:pk>/', views.sos_resolve, name='sos-resolve'),
    path('sos/history/', views.sos_history, name='sos-history'),

    # Complaints
    path('complaints/', views.complaints_list, name='complaints-list'),
    path('complaints/<int:pk>/', views.complaints_detail, name='complaints-detail'),

    # Places & Routes
    path('places/nearby/', views.nearby_places, name='nearby-places'),
    path('geocode/', views.geocode, name='geocode'),

    # FCM Token
    path('fcm/update/', views.update_fcm_token, name='update-fcm-token'),

    # SMS API (direct)
    path('trigger-alert/', views.trigger_alert, name='trigger-alert'),
    path('send-sms/', views.send_sms_endpoint, name='send-sms'),
    path('sos-alert/', views.sos_alert_endpoint, name='sos-alert'),

    # Voice Notes
    path('voice-note/upload/', views.upload_voice_note, name='voice-note-upload'),

    # Health
    path('health/', views.health, name='health'),
]
