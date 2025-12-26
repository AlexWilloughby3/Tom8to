import smtplib
import random
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from typing import Optional


def generate_6_digit_code() -> str:
    """Generate a random 6-digit verification code"""
    return str(random.randint(100000, 999999))


def get_code_expiry() -> datetime:
    """Get expiry time for verification code (15 minutes from now)"""
    return datetime.utcnow() + timedelta(minutes=15)


def send_verification_code(email: str, code: str) -> bool:
    """
    Send verification code email via Gmail SMTP

    Args:
        email: Recipient email address
        code: 6-digit verification code

    Returns:
        True if email sent successfully, False otherwise
    """
    try:
        # Get SMTP configuration from environment variables
        smtp_host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
        smtp_port = int(os.getenv('SMTP_PORT', '587'))
        smtp_username = os.getenv('SMTP_USERNAME')
        smtp_password = os.getenv('SMTP_PASSWORD')
        smtp_from_email = os.getenv('SMTP_FROM_EMAIL', smtp_username)
        smtp_from_name = os.getenv('SMTP_FROM_NAME', 'Tomato Focus Tracker')

        # Validate SMTP configuration
        if not smtp_username or not smtp_password:
            print("ERROR: SMTP_USERNAME and SMTP_PASSWORD must be set in environment variables")
            return False

        # Create message
        message = MIMEMultipart('alternative')
        message['Subject'] = f'Your Tomato verification code: {code}'
        message['From'] = f'{smtp_from_name} <{smtp_from_email}>'
        message['To'] = email

        # Create HTML and plain text versions
        text_body = f"""
        Your verification code for Tomato Focus Tracker is: {code}

        This code will expire in 15 minutes.

        If you didn't request this code, please ignore this email.
        """

        html_body = f"""
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #FF6347;">Tomato Focus Tracker</h2>
              <p>Your verification code is:</p>
              <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
                {code}
              </div>
              <p>This code will expire in <strong>15 minutes</strong>.</p>
              <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
            </div>
          </body>
        </html>
        """

        # Attach both versions
        part1 = MIMEText(text_body, 'plain')
        part2 = MIMEText(html_body, 'html')
        message.attach(part1)
        message.attach(part2)

        # Connect to SMTP server and send email
        server = smtplib.SMTP(smtp_host, smtp_port)
        server.starttls()  # Enable TLS encryption
        server.login(smtp_username, smtp_password)
        server.sendmail(smtp_from_email, email, message.as_string())
        server.quit()

        print(f"Verification code sent successfully to {email}")
        return True

    except Exception as e:
        print(f"Failed to send verification code to {email}: {str(e)}")
        return False


def send_password_reset_link(email: str, token: str) -> bool:
    """
    Send password reset link email

    Args:
        email: Recipient email address
        token: Password reset token

    Returns:
        True if email sent successfully, False otherwise
    """
    try:
        # Get SMTP configuration and frontend URL from environment variables
        smtp_host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
        smtp_port = int(os.getenv('SMTP_PORT', '587'))
        smtp_username = os.getenv('SMTP_USERNAME')
        smtp_password = os.getenv('SMTP_PASSWORD')
        smtp_from_email = os.getenv('SMTP_FROM_EMAIL', smtp_username)
        smtp_from_name = os.getenv('SMTP_FROM_NAME', 'Tomato Focus Tracker')
        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')

        # Validate SMTP configuration
        if not smtp_username or not smtp_password:
            print("ERROR: SMTP_USERNAME and SMTP_PASSWORD must be set in environment variables")
            return False

        # Create reset link
        reset_link = f"{frontend_url}/reset-password?token={token}"

        # Create message
        message = MIMEMultipart('alternative')
        message['Subject'] = 'Reset your Tomato password'
        message['From'] = f'{smtp_from_name} <{smtp_from_email}>'
        message['To'] = email

        # Create HTML and plain text versions
        text_body = f"""
        You requested to reset your password for Tomato Focus Tracker.

        Click the link below to reset your password:
        {reset_link}

        This link will expire in 1 hour.

        If you didn't request this reset, please ignore this email.
        """

        html_body = f"""
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #FF6347;">Tomato Focus Tracker</h2>
              <p>You requested to reset your password.</p>
              <p>Click the button below to reset your password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="{reset_link}" style="background-color: #FF6347; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
              </div>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #666; font-size: 14px;">{reset_link}</p>
              <p>This link will expire in <strong>1 hour</strong>.</p>
              <p style="color: #666; font-size: 14px;">If you didn't request this reset, please ignore this email.</p>
            </div>
          </body>
        </html>
        """

        # Attach both versions
        part1 = MIMEText(text_body, 'plain')
        part2 = MIMEText(html_body, 'html')
        message.attach(part1)
        message.attach(part2)

        # Connect to SMTP server and send email
        server = smtplib.SMTP(smtp_host, smtp_port)
        server.starttls()
        server.login(smtp_username, smtp_password)
        server.sendmail(smtp_from_email, email, message.as_string())
        server.quit()

        print(f"Password reset link sent successfully to {email}")
        return True

    except Exception as e:
        print(f"Failed to send password reset link to {email}: {str(e)}")
        return False


def send_password_reset_confirmation(email: str) -> bool:
    """
    Send password reset confirmation email

    Args:
        email: Recipient email address

    Returns:
        True if email sent successfully, False otherwise
    """
    try:
        # Get SMTP configuration from environment variables
        smtp_host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
        smtp_port = int(os.getenv('SMTP_PORT', '587'))
        smtp_username = os.getenv('SMTP_USERNAME')
        smtp_password = os.getenv('SMTP_PASSWORD')
        smtp_from_email = os.getenv('SMTP_FROM_EMAIL', smtp_username)
        smtp_from_name = os.getenv('SMTP_FROM_NAME', 'Tomato Focus Tracker')

        # Validate SMTP configuration
        if not smtp_username or not smtp_password:
            print("ERROR: SMTP_USERNAME and SMTP_PASSWORD must be set in environment variables")
            return False

        # Create message
        message = MIMEMultipart('alternative')
        message['Subject'] = 'Your Tomato password has been changed'
        message['From'] = f'{smtp_from_name} <{smtp_from_email}>'
        message['To'] = email

        # Create HTML and plain text versions
        text_body = """
        Your Tomato Focus Tracker password has been successfully changed.

        If you didn't make this change, please contact support immediately.
        """

        html_body = """
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #FF6347;">Tomato Focus Tracker</h2>
              <p>Your password has been successfully changed.</p>
              <p style="color: #666; font-size: 14px;">If you didn't make this change, please contact support immediately.</p>
            </div>
          </body>
        </html>
        """

        # Attach both versions
        part1 = MIMEText(text_body, 'plain')
        part2 = MIMEText(html_body, 'html')
        message.attach(part1)
        message.attach(part2)

        # Connect to SMTP server and send email
        server = smtplib.SMTP(smtp_host, smtp_port)
        server.starttls()
        server.login(smtp_username, smtp_password)
        server.sendmail(smtp_from_email, email, message.as_string())
        server.quit()

        print(f"Password reset confirmation sent to {email}")
        return True

    except Exception as e:
        print(f"Failed to send password reset confirmation to {email}: {str(e)}")
        return False
