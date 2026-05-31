from rest_framework import serializers
from django.contrib.auth.models import User
from .models import UserProfile, EmergencyContact, Alert, Complaint, SOSEvent


class UserSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(source='profile.phone', required=False)
    avatar = serializers.CharField(source='profile.avatar', required=False)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'phone', 'avatar']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        profile_data = validated_data.pop('profile', {})
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        UserProfile.objects.update_or_create(user=user, defaults=profile_data)
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()


class EmergencyContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmergencyContact
        fields = ['id', 'name', 'phone', 'relation', 'created_at']
        read_only_fields = ['id', 'created_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class AlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alert
        fields = ['id', 'alert_type', 'location_lat', 'location_lng',
                  'location_address', 'message', 'is_active', 'created_at']
        read_only_fields = ['id', 'is_active', 'created_at']


class ComplaintSerializer(serializers.ModelSerializer):
    class Meta:
        model = Complaint
        fields = ['id', 'title', 'description', 'incident_date',
                  'location_lat', 'location_lng', 'location_address',
                  'suspect_description', 'police_station', 'status',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'status', 'created_at', 'updated_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class SOSEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = SOSEvent
        fields = ['id', 'location_lat', 'location_lng', 'location_address',
                  'sms_sent', 'email_sent', 'notification_sent',
                  'resolved', 'resolved_at', 'created_at']
        read_only_fields = ['id', 'sms_sent', 'email_sent', 'notification_sent',
                            'resolved', 'resolved_at', 'created_at']


class SendSMSSerializer(serializers.Serializer):
    to = serializers.CharField()
    message = serializers.CharField()
    name = serializers.CharField(required=False, default='')


class SOSAlertSerializer(serializers.Serializer):
    contacts = serializers.ListField(child=serializers.DictField())
    message = serializers.CharField()
    location = serializers.CharField()

    def validate_contacts(self, value):
        for c in value:
            if 'phone' not in c:
                raise serializers.ValidationError('Each contact must have a phone field')
        return value
