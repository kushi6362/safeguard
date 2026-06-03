from django.db import models
from django.contrib.auth.models import User
from django.conf import settings


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    phone = models.CharField(max_length=20, blank=True)
    avatar = models.CharField(max_length=10, default='👤')
    created_at = models.DateTimeField(auto_now_add=True)
    fcm_token = models.CharField(max_length=500, blank=True, help_text='Firebase Cloud Messaging device token')

    def __str__(self):
        return self.user.username


class EmergencyContact(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='contacts')
    name = models.CharField(max_length=100)
    phone = models.CharField(max_length=20)
    email = models.EmailField(max_length=254, blank=True)
    relation = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} ({self.phone})'


class Alert(models.Model):
    ALERT_TYPES = [
        ('SOS', 'Emergency SOS'),
        ('CHECK_IN', 'Safe Check-In'),
        ('LOW_BATTERY', 'Low Battery'),
        ('FALL', 'Fall Detected'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='alerts')
    alert_type = models.CharField(max_length=20, choices=ALERT_TYPES)
    location_lat = models.FloatField(null=True, blank=True)
    location_lng = models.FloatField(null=True, blank=True)
    location_address = models.TextField(blank=True)
    message = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.alert_type} - {self.user.username} - {self.created_at}'


class Complaint(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('IN_PROGRESS', 'In Progress'),
        ('RESOLVED', 'Resolved'),
        ('DISMISSED', 'Dismissed'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='complaints')
    title = models.CharField(max_length=200)
    description = models.TextField()
    incident_date = models.DateTimeField()
    location_lat = models.FloatField(null=True, blank=True)
    location_lng = models.FloatField(null=True, blank=True)
    location_address = models.TextField(blank=True)
    suspect_description = models.TextField(blank=True)
    police_station = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.title} - {self.user.username}'


def voice_note_upload_path(instance, filename):
    import time
    ts = int(instance.created_at.timestamp()) if instance.created_at else int(time.time())
    uid = instance.user_id or 0
    return f'voice_notes/{uid}_{ts}.webm'


class VoiceNote(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='voice_notes')
    audio_file = models.FileField(upload_to=voice_note_upload_path)
    duration = models.FloatField(default=0, help_text='Duration in seconds')
    filesize = models.IntegerField(default=0, help_text='File size in bytes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'VoiceNote {self.id} by {self.user or "anonymous"}'


class SOSEvent(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sos_events')
    voice_note = models.ForeignKey(VoiceNote, on_delete=models.SET_NULL, null=True, blank=True, related_name='sos_events')
    location_lat = models.FloatField(null=True, blank=True)
    location_lng = models.FloatField(null=True, blank=True)
    location_address = models.TextField(blank=True)
    sms_sent = models.BooleanField(default=False)
    email_sent = models.BooleanField(default=False)
    notification_sent = models.BooleanField(default=False)
    resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'SOS {self.user.username} - {self.created_at}'
