import logging

logger = logging.getLogger(__name__)

def send_whatsapp_alert(location_link="", contacts=None):
    if not contacts:
        logger.warning('No emergency contacts to send WhatsApp alert to.')
        return

    message = f"🚨 EMERGENCY ALERT!\n\nI need immediate help.\n📍 Live Location: {location_link or 'Unknown'}\n\nPlease track and assist immediately."

    # WhatsApp alert disabled — install twilio and pywhatkit to enable
    logger.info('WhatsApp alert skipped (Twilio/pywhatkit not available)')
