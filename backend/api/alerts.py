import logging

logger = logging.getLogger(__name__)

def send_whatsapp_alert(location_link="", contacts=None):
    if not contacts:
        logger.warning('No emergency contacts to send WhatsApp alert to.')
        return

    message = f"🚨 EMERGENCY ALERT!\n\nI need immediate help.\n📍 Live Location: {location_link or 'Unknown'}\n\nPlease track and assist immediately."

    # Try Twilio WhatsApp API first
    try:
        from django.conf import settings
        sid = settings.TWILIO_ACCOUNT_SID
        token = settings.TWILIO_AUTH_TOKEN
        from_number = settings.TWILIO_PHONE_NUMBER
        if sid and token and from_number:
            from twilio.rest import Client
            client = Client(sid, token)
            from_wa = 'whatsapp:' + from_number
            for c in contacts:
                to_wa = 'whatsapp:' + c['phone']
                try:
                    msg = client.messages.create(body=message, from_=from_wa, to=to_wa)
                    logger.info('WhatsApp sent to %s — sid: %s', c['phone'], msg.sid)
                except Exception as e:
                    logger.error('Twilio WhatsApp error for %s: %s', c['phone'], e)
            return
    except Exception as e:
        logger.error('Twilio WhatsApp init error: %s', e)

    # Fallback: pywhatkit (requires Chrome + WhatsApp Web logged in)
    try:
        import pywhatkit as kit
        import time
        for c in contacts:
            try:
                kit.sendwhatmsg_instantly(c['phone'], message, wait_time=10, tab_close=True)
                time.sleep(5)
            except Exception as e:
                logger.error('pywhatkit error for %s: %s', c['phone'], e)
    except ImportError:
        logger.error('pywhatkit not installed — WhatsApp not sent')
