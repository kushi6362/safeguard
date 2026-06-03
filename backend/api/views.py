import json
import logging
import threading
from django.conf import settings
from django.contrib.auth import authenticate, login
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.response import Response

from .models import UserProfile, EmergencyContact, Alert, Complaint, SOSEvent
from .serializers import (
    UserSerializer, LoginSerializer, EmergencyContactSerializer,
    AlertSerializer, ComplaintSerializer, SOSEventSerializer,
    SendSMSSerializer, SOSAlertSerializer,
)
from .alerts import send_whatsapp_alert
from .utils import (
    send_sms,
    send_email_sendgrid, send_fcm_notification,
    geocode_address, find_nearby_places, build_location_link,
)

logger = logging.getLogger(__name__)


# ════════════════════════════════════════
#  AUTHENTICATION
# ════════════════════════════════════════

@api_view(['POST'])
def register(request):
    serializer = UserSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    user = serializer.save()
    return Response({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'phone': user.profile.phone,
        'avatar': user.profile.avatar,
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    username = serializer.validated_data['username']
    password = serializer.validated_data['password']
    user = authenticate(username=username, password=password)
    if not user and '@' in username:
        try:
            u = User.objects.get(email=username)
            user = authenticate(username=u.username, password=password)
        except User.DoesNotExist:
            pass
    if not user:
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
    login(request._request, user)
    return Response({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'phone': user.profile.phone,
        'avatar': user.profile.avatar,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def me(request):
    user = request.user
    return Response({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'phone': user.profile.phone,
        'avatar': user.profile.avatar,
    })


# ════════════════════════════════════════
#  EMERGENCY CONTACTS
# ════════════════════════════════════════

@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def contacts_list(request):
    if request.method == 'GET':
        contacts = EmergencyContact.objects.filter(user=request.user)
        serializer = EmergencyContactSerializer(contacts, many=True)
        return Response(serializer.data)
    serializer = EmergencyContactSerializer(data=request.data, context={'request': request})
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    serializer.save()
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def contacts_detail(request, pk):
    try:
        contact = EmergencyContact.objects.get(pk=pk, user=request.user)
    except EmergencyContact.DoesNotExist:
        return Response({'error': 'Contact not found'}, status=status.HTTP_404_NOT_FOUND)
    if request.method == 'GET':
        return Response(EmergencyContactSerializer(contact).data)
    if request.method == 'PUT':
        serializer = EmergencyContactSerializer(contact, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data)
    contact.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ════════════════════════════════════════
#  ALERTS
# ════════════════════════════════════════

@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def alerts_list(request):
    if request.method == 'GET':
        alerts = Alert.objects.filter(user=request.user)[:50]
        return Response(AlertSerializer(alerts, many=True).data)
    serializer = AlertSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    serializer.save(user=request.user)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


# ════════════════════════════════════════
#  SOS EMERGENCY
# ════════════════════════════════════════

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def sos_trigger(request):
    data = request.data
    lat = data.get('lat')
    lng = data.get('lng')
    address = data.get('address', 'Unknown location')
    message = data.get('message', '🚨 EMERGENCY! I need help!')

    sos = SOSEvent.objects.create(
        user=request.user,
        location_lat=lat,
        location_lng=lng,
        location_address=address,
    )

    results = {'sms': False, 'email': False, 'notification': False, 'contacts': []}

    # 1. Send SMS to all contacts
    contacts = EmergencyContact.objects.filter(user=request.user)
    location_link = build_location_link(lat, lng) if lat and lng else ''
    sms_body = (
        f'🚨 EMERGENCY ALERT!\n'
        f'{request.user.username} may be in danger.\n'
        f'Location: {address}\n'
        f'Live: {location_link}\n'
        f'{message}\n'
        f'Please contact immediately.'
    )

    sms_sent_count = 0
    for contact in contacts:
        if contact.phone:
            result = send_sms(contact.phone, sms_body)
            results['contacts'].append({
                'name': contact.name,
                'phone': contact.phone,
                'sent': result.get('success', False),
            })
            if result.get('success'):
                sms_sent_count += 1
    if sms_sent_count > 0:
        results['sms'] = True
        sos.sms_sent = True

    # 2. Send email to all contacts (in background for instant response)
    def send_emails(contacts_list, user_name, body, sos_obj):
        sent = 0
        for c in contacts_list:
            if c.email:
                r = send_email_sendgrid(
                    c.email,
                    f'🚨 SOS EMERGENCY ALERT — {user_name} needs help!',
                    body,
                )
                if r.get('success'):
                    sent += 1
        if sent > 0:
            sos_obj.email_sent = True
            sos_obj.save(update_fields=['email_sent'])
    threading.Thread(target=send_emails, args=(list(contacts), request.user.username, sms_body, sos), daemon=True).start()
    results['email'] = True

    # 3. Send push notification via FCM
    fcm_token = request.user.profile.fcm_token
    if fcm_token:
        notif_result = send_fcm_notification(
            fcm_token,
            '🚨 SOS Activated!',
            f'Your emergency alert has been sent to {contacts.count()} contact(s).',
            {'lat': str(lat), 'lng': str(lng), 'type': 'sos'},
        )
        results['notification'] = notif_result.get('success', False)
        sos.notification_sent = results['notification']

    # 4. Create a dashboard alert
    Alert.objects.create(
        user=request.user,
        alert_type='SOS',
        location_lat=lat,
        location_lng=lng,
        location_address=address,
        message='🚨 SOS SENT — Emergency contacts notified.',
    )

    sos.save()

    return Response({
        'sos_id': sos.id,
        'status': 'dispatched',
        'contacts_notified': sms_sent_count,
        'results': results,
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def sos_resolve(request, pk):
    try:
        sos = SOSEvent.objects.get(pk=pk, user=request.user)
    except SOSEvent.DoesNotExist:
        return Response({'error': 'SOS event not found'}, status=status.HTTP_404_NOT_FOUND)
    from django.utils import timezone
    sos.resolved = True
    sos.resolved_at = timezone.now()
    sos.save()
    return Response({'status': 'resolved'})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def sos_history(request):
    events = SOSEvent.objects.filter(user=request.user)[:20]
    return Response(SOSEventSerializer(events, many=True).data)


# ════════════════════════════════════════
#  COMPLAINTS
# ════════════════════════════════════════

@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def complaints_list(request):
    if request.method == 'GET':
        complaints = Complaint.objects.filter(user=request.user)
        return Response(ComplaintSerializer(complaints, many=True).data)
    serializer = ComplaintSerializer(data=request.data, context={'request': request})
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    serializer.save()
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def complaints_detail(request, pk):
    try:
        complaint = Complaint.objects.get(pk=pk, user=request.user)
    except Complaint.DoesNotExist:
        return Response({'error': 'Complaint not found'}, status=status.HTTP_404_NOT_FOUND)
    if request.method == 'GET':
        return Response(ComplaintSerializer(complaint).data)
    complaint.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ════════════════════════════════════════
#  NEARBY PLACES
# ════════════════════════════════════════

@api_view(['GET'])
def nearby_places(request):
    lat = request.query_params.get('lat')
    lng = request.query_params.get('lng')
    place_type = request.query_params.get('type', 'police')
    if not lat or not lng:
        return Response({'error': 'lat and lng required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        places = find_nearby_places(float(lat), float(lng), place_type)
        return Response({'places': places})
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ════════════════════════════════════════
#  SAFE ROUTE / GEOCODE
# ════════════════════════════════════════

@api_view(['GET'])
def geocode(request):
    address = request.query_params.get('address', '')
    if not address:
        return Response({'error': 'address required'}, status=status.HTTP_400_BAD_REQUEST)
    result = geocode_address(address)
    if result['success']:
        return Response(result)
    return Response(result, status=status.HTTP_400_BAD_REQUEST)


# ════════════════════════════════════════
#  FCM TOKEN UPDATE
# ════════════════════════════════════════

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def update_fcm_token(request):
    token = request.data.get('fcm_token', '')
    if token:
        request.user.profile.fcm_token = token
        request.user.profile.save()
        return Response({'status': 'ok'})
    return Response({'error': 'fcm_token required'}, status=status.HTTP_400_BAD_REQUEST)


# ════════════════════════════════════════
#  SMS API (direct)
# ════════════════════════════════════════

@api_view(['POST'])
def send_sms_endpoint(request):
    serializer = SendSMSSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    data = serializer.validated_data
    result = send_sms(data['to'], data['message'])
    if result['success']:
        return Response(result)
    return Response(result, status=status.HTTP_502_BAD_GATEWAY)


@csrf_exempt
def trigger_alert(request):
    location_link = ''
    contacts = []
    if request.method == 'GET':
        location_link = request.GET.get('location_link', '')
        contacts_json = request.GET.get('contacts', '[]')
        try:
            contacts = json.loads(contacts_json)
        except json.JSONDecodeError:
            contacts = []
    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            location_link = data.get('location_link', '')
            contacts = data.get('contacts', [])
        except json.JSONDecodeError:
            pass
    send_whatsapp_alert(location_link=location_link, contacts=contacts)
    return JsonResponse({"message": "WhatsApp Alert Sent"})

@csrf_exempt
def send_alert(request):
    contacts = EmergencyContact.objects.all()
    email_list = [c.email for c in contacts if c.email]

    if not email_list:
        return JsonResponse({'message': 'No emergency contacts with email found.'})

    subject = '🚨 Emergency Alert - Women Safety System'
    body = '''
Emergency Alert!

I need help immediately.

Please contact me urgently.
Location:
https://maps.google.com
    '''
    sent = 0
    errors = []
    for email in email_list:
        result = send_email_sendgrid(email, subject, body)
        if result.get('success'):
            sent += 1
        else:
            errors.append(result.get('error'))
    return JsonResponse({'message': f'Email sent to {sent}/{len(email_list)} contact(s).', 'errors': errors})


@api_view(['POST'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def sos_alert_endpoint(request):
    user = request.user if request.user.is_authenticated else None
    user_name = request.data.get('user_name', user.username if user else 'Unknown User')
    serializer = SOSAlertSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    data = serializer.validated_data
    location = data.get('location', 'Unknown')
    lat = data.get('lat')
    lng = data.get('lng')
    now = timezone.now().strftime('%d-%b-%Y %I:%M %p')
    maps_link = f'https://www.google.com/maps?q={lat},{lng}' if lat and lng else 'Unknown'
    email_body = (
        f"🚨 EMERGENCY ALERT — {user_name}\n"
        f"{'='*40}\n\n"
        f"I am in danger and need immediate help.\n\n"
        f"👤 User: {user_name}\n"
        f"📧 Email: {user.email if user else 'N/A'}\n"
        f"📅 Date & Time: {now}\n"
        f"📍 Latitude: {lat or 'N/A'}\n"
        f"📍 Longitude: {lng or 'N/A'}\n"
        f"🗺️ Google Maps: {maps_link}\n\n"
        f"Please track and assist immediately.\n"
        f"— SafeGuard Emergency Alert System"
    )
    email_subject = f"🚨 SOS EMERGENCY ALERT — {user_name} needs immediate help!"
    contacts_copy = list(data['contacts'])
    def send_alert_emails():
        for c in contacts_copy:
            if c.get('email'):
                send_email_sendgrid(c['email'], email_subject, email_body)
    threading.Thread(target=send_alert_emails, daemon=True).start()
    return Response({
        'success': True,
        'total': len(data['contacts']),
        'emails_sent': 'pending (background)',
        'results': [{'name': c.get('name'), 'phone': c.get('phone'), 'email': c.get('email'), 'email_sent': 'pending'} for c in data['contacts']],
    })


@api_view(['GET'])
def health(request):
    return Response({
        'status': 'ok',
        'fast2sms_configured': bool(settings.FAST2SMS_API_KEY),
        'sendgrid_configured': bool(settings.SENDGRID_API_KEY),
        'fcm_configured': bool(settings.FCM_SERVER_KEY),
        'gmaps_configured': bool(settings.GOOGLE_MAPS_API_KEY),
    })
