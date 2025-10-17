# REAL EMAIL CONFIGURATION

## Quick Setup for Real Email Sending

### Option 1: EmailJS (Recommended - Free)
1. Go to [https://www.emailjs.com/](https://www.emailjs.com/)
2. Sign up for free account
3. Connect your Gmail account
4. Create email template with this content:

**Template:**
```
Subject: Password Reset Code

Your password reset code is: {{reset_code}}

This code will expire in 15 minutes.

If you did not request this reset, please ignore this email.

Best regards,
CAS Graduate Employment Tracking System
```

5. Get your credentials:
   - Service ID: `service_xxxxx`
   - Template ID: `template_xxxxx`
   - User ID: `user_xxxxx`

6. Update `script.js` line 3850, 3863, 3864 with your credentials

### Option 2: Formspree (Alternative)
1. Go to [https://formspree.io/](https://formspree.io/)
2. Create free account
3. Create new form
4. Get your form ID: `YOUR_FORM_ID`
5. Update `script.js` line 3880 with your form ID

### Option 3: Use Your Own SMTP
Replace the email sending function with your SMTP configuration.

## Current Status
The system is ready to send REAL emails once you configure one of the above services.

