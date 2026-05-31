from django.contrib import admin
from .models import UserProfile, EmergencyContact, Alert, Complaint, SOSEvent


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'phone', 'created_at']
    search_fields = ['user__username', 'phone']


@admin.register(EmergencyContact)
class EmergencyContactAdmin(admin.ModelAdmin):
    list_display = ['name', 'phone', 'relation', 'user', 'created_at']
    search_fields = ['name', 'phone', 'user__username']


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ['alert_type', 'user', 'is_active', 'created_at']
    list_filter = ['alert_type', 'is_active']


@admin.register(Complaint)
class ComplaintAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'status', 'created_at']
    list_filter = ['status']


@admin.register(SOSEvent)
class SOSEventAdmin(admin.ModelAdmin):
    list_display = ['user', 'sms_sent', 'email_sent', 'notification_sent', 'resolved', 'created_at']
