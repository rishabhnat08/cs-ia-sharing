"""Verification code generation and validation."""
import os
import random
import smtplib
import string
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Optional

from dotenv import load_dotenv

load_dotenv()

# In-memory storage for verification codes (in production, use Redis or database)
verification_store: Dict[str, Dict[str, any]] = {}

def generate_verification_code() -> str:
    """Generate a 6-character alphanumeric code with 3 letters and 3 numbers."""
    letters = random.choices(string.ascii_uppercase, k=3)
    numbers = random.choices(string.digits, k=3)

    # Combine and shuffle
    chars = letters + numbers
    random.shuffle(chars)

    return ''.join(chars)

def store_verification_code(contact: str, code: str, verification_type: str) -> None:
    """Store verification code with expiry time (10 minutes)."""
    verification_store[contact] = {
        'code': code,
        'type': verification_type,
        'expires_at': datetime.utcnow() + timedelta(minutes=10),
        'attempts': 0
    }

def verify_code(contact: str, code: str) -> bool:
    """Verify the provided code against stored code."""
    stored = verification_store.get(contact)

    if not stored:
        return False

    # Check expiry
    if datetime.utcnow() > stored['expires_at']:
        del verification_store[contact]
        return False

    # Check attempts (max 5)
    if stored['attempts'] >= 5:
        del verification_store[contact]
        return False

    # Increment attempts
    stored['attempts'] += 1

    # Check code (case-insensitive)
    if stored['code'].upper() == code.upper():
        del verification_store[contact]  # Remove after successful verification
        return True

    return False

# Email-to-SMS gateways for major carriers
CARRIER_GATEWAYS = {
    'verizon': 'vtext.com',
    'att': 'txt.att.net',
    'tmobile': 'tmomail.net',
    'sprint': 'messaging.sprintpcs.com',
    'boost': 'smsmyboostmobile.com',
    'cricket': 'sms.cricketwireless.net',
    'uscellular': 'email.uscc.net',
}

def send_email_verification(email: str, code: str) -> bool:
    """Send verification code via email using Gmail SMTP."""
    gmail_email = os.getenv('GMAIL_EMAIL')
    gmail_password = os.getenv('GMAIL_APP_PASSWORD')

    if not gmail_email or not gmail_password:
        print(f"[EMAIL] Gmail credentials not configured. Code: {code}")
        return True  # Return True for development

    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'NextShot AI - Email Verification Code'
        msg['From'] = gmail_email
        msg['To'] = email

        # HTML email body
        html = f"""
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #581c87, #7c3aed); padding: 30px; border-radius: 10px; text-align: center;">
              <h1 style="color: white; margin: 0;">NextShot AI</h1>
              <p style="color: #e9d5ff; margin: 10px 0 0 0;">Badminton Performance Analytics</p>
            </div>
            <div style="background: #f9fafb; padding: 30px; border-radius: 10px; margin-top: 20px;">
              <h2 style="color: #1f2937; margin-top: 0;">Verify Your Email</h2>
              <p style="color: #4b5563; font-size: 16px;">Your verification code is:</p>
              <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; color: #581c87; letter-spacing: 8px;">{code}</span>
              </div>
              <p style="color: #6b7280; font-size: 14px;">This code will expire in 10 minutes.</p>
              <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">If you didn't request this code, please ignore this email.</p>
            </div>
          </body>
        </html>
        """

        # Plain text fallback
        text = f"""
        NextShot AI - Email Verification

        Your verification code is: {code}

        This code will expire in 10 minutes.

        If you didn't request this code, please ignore this email.
        """

        part1 = MIMEText(text, 'plain')
        part2 = MIMEText(html, 'html')
        msg.attach(part1)
        msg.attach(part2)

        # Send via Gmail SMTP
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(gmail_email, gmail_password)
            server.send_message(msg)

        print(f"[EMAIL] Successfully sent verification code to {email}")
        return True

    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send email: {str(e)}")
        return False

def send_sms_verification(phone: str, code: str, carrier: str = 'verizon') -> bool:
    """Send verification code via SMS using email-to-SMS gateway (FREE)."""
    gmail_email = os.getenv('GMAIL_EMAIL')
    gmail_password = os.getenv('GMAIL_APP_PASSWORD')

    if not gmail_email or not gmail_password:
        print(f"[SMS] Gmail credentials not configured. Code: {code}")
        return True  # Return True for development

    # Get carrier gateway
    gateway = CARRIER_GATEWAYS.get(carrier.lower())
    if not gateway:
        print(f"[SMS ERROR] Unknown carrier: {carrier}")
        return False

    # Construct SMS email address
    sms_email = f"{phone}@{gateway}"

    try:
        # Create simple text message (SMS only supports plain text)
        msg = MIMEText(f"NextShot AI verification code: {code}\n\nExpires in 10 minutes.")
        msg['Subject'] = 'Verification Code'
        msg['From'] = gmail_email
        msg['To'] = sms_email

        # Send via Gmail SMTP
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(gmail_email, gmail_password)
            server.send_message(msg)

        print(f"[SMS] Successfully sent verification code to {phone} via {carrier}")
        return True

    except Exception as e:
        print(f"[SMS ERROR] Failed to send SMS: {str(e)}")
        return False
