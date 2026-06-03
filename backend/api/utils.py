import logging
import json
import requests
from django.conf import settings

logger = logging.getLogger(__name__)


# ── SMS via Fast2SMS ──

def send_sms_fast2sms(to: str, body: str) -> dict:
    api_key = settings.FAST2SMS_API_KEY
    if not api_key:
        return {'success': False, 'error': 'Fast2SMS not configured'}
    try:
        resp = requests.post('https://www.fast2sms.com/dev/bulkV2', json={
            'sender_id': 'TXTMSG',
            'message': body,
            'language': 'english',
            'route': 'v3',
            'numbers': to,
        }, headers={
            'authorization': api_key,
            'Content-Type': 'application/json',
        })
        data = resp.json()
        return {'success': data.get('return', False), 'data': data}
    except Exception as e:
        return {'success': False, 'error': str(e)}


def send_sms(to: str, body: str) -> dict:
    return send_sms_fast2sms(to, body)


# ── Email via Gmail SMTP (fallback to SendGrid) ──

from django.core.mail import send_mail

def send_email_sendgrid(to_email: str, subject: str, body_text: str) -> dict:
    host_user = settings.EMAIL_HOST_USER
    host_pass = settings.EMAIL_HOST_PASSWORD.replace(' ', '') if settings.EMAIL_HOST_PASSWORD else ''
    if host_user and host_pass:
        try:
            send_mail(subject, body_text, settings.EMAIL_FROM, [to_email], fail_silently=True)
            return {'success': True}
        except BaseException:
            return {'success': False, 'error': 'SMTP failed'}
    api_key = settings.SENDGRID_API_KEY
    if not api_key:
        return {'success': False, 'error': 'Email not configured (set Gmail SMTP or SendGrid)'}
    try:
        resp = requests.post(
            'https://api.sendgrid.com/v3/mail/send',
            json={
                'personalizations': [{'to': [{'email': to_email}]}],
                'from': {'email': settings.EMAIL_FROM, 'name': 'SafeGuard'},
                'subject': subject,
                'content': [{'type': 'text/plain', 'value': body_text}],
            },
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            }
        )
        return {'success': resp.ok, 'status': resp.status_code}
    except Exception as e:
        return {'success': False, 'error': str(e)}


# ── Push Notification via Firebase ──

def send_fcm_notification(fcm_token: str, title: str, body: str, data: dict = None) -> dict:
    server_key = settings.FCM_SERVER_KEY
    if not server_key or not fcm_token:
        return {'success': False, 'error': 'FCM not configured or no token'}
    try:
        payload = {
            'to': fcm_token,
            'notification': {'title': title, 'body': body},
            'data': data or {},
            'priority': 'high',
        }
        resp = requests.post(
            'https://fcm.googleapis.com/fcm/send',
            json=payload,
            headers={
                'Authorization': f'key={server_key}',
                'Content-Type': 'application/json',
            }
        )
        return {'success': resp.ok, 'data': resp.json()}
    except Exception as e:
        return {'success': False, 'error': str(e)}


# ── Google Maps helpers ──

def geocode_address(address: str) -> dict:
    api_key = settings.GOOGLE_MAPS_API_KEY
    if not api_key:
        return {'success': False, 'error': 'Google Maps API key not configured'}
    try:
        resp = requests.get(
            'https://maps.googleapis.com/maps/api/geocode/json',
            params={'address': address, 'key': api_key}
        )
        data = resp.json()
        if data['status'] == 'OK' and data['results']:
            loc = data['results'][0]['geometry']['location']
            return {'success': True, 'lat': loc['lat'], 'lng': loc['lng'], 'address': data['results'][0]['formatted_address']}
        return {'success': False, 'error': data['status']}
    except Exception as e:
        return {'success': False, 'error': str(e)}


def find_nearby_places(lat: float, lng: float, place_type: str = 'police') -> list:
    api_key = settings.GOOGLE_MAPS_API_KEY
    if not api_key:
        return []
    try:
        resp = requests.get(
            'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
            params={
                'location': f'{lat},{lng}',
                'radius': 5000,
                'type': place_type,
                'key': api_key,
            }
        )
        data = resp.json()
        results = []
        for place in data.get('results', [])[:10]:
            results.append({
                'name': place.get('name'),
                'address': place.get('vicinity'),
                'rating': place.get('rating'),
                'lat': place['geometry']['location']['lat'],
                'lng': place['geometry']['location']['lng'],
            })
        return results
    except Exception:
        return []


def build_location_link(lat: float, lng: float) -> str:
    return f'https://www.google.com/maps?q={lat},{lng}'
