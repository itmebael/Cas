# Supabase Auth Email Setup - Send 6-Digit Codes

## Configure Supabase Auth as Email Sender

### Step 1: Configure Supabase Email Template

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Email Templates**
3. Click on **"Reset Password"** template
4. Replace the template content with this:

```html
<h2>Password Reset Code</h2>
<p>You requested a password reset for your CAS Graduate Tracking System account.</p>

<div style="background: #f0f9ff; border: 2px solid #0ea5e9; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
    <p style="margin: 0; font-size: 18px; color: #0c4a6e;">Your 6-digit reset code is:</p>
    <p style="font-size: 32px; font-weight: bold; color: #0c4a6e; letter-spacing: 4px; margin: 10px 0;">{{ .Token }}</p>
</div>

<p><strong>Important:</strong> This code will expire in 15 minutes.</p>
<p>Enter this code on the website to reset your password.</p>

<p>If you didn't request this reset, please ignore this email.</p>

<hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
<p style="color: #64748b; font-size: 12px; text-align: center;">
    Samar State University - College of Arts and Sciences<br>
    Graduate Tracking System
</p>
```

### Step 2: Configure Email Settings

1. In Supabase Dashboard → **Authentication** → **Settings**
2. Make sure **"Enable email confirmations"** is enabled
3. Set up your **SMTP settings** (optional - can use Supabase's default)
4. Configure **Site URL** to match your domain

### Step 3: Test the System

1. Go to forgot password screen
2. Enter your email address
3. Click "Send Reset Code"
4. Check your email for the Supabase Auth email
5. The email will contain the 6-digit code
6. Enter the code on the website

### Step 4: How It Works

- **Supabase Auth** sends the email
- **6-digit code** is included in the email template
- **User receives email** from Supabase Auth
- **User enters code** on the website
- **System verifies code** and allows password reset

### Important Notes:

- The `{{ .Token }}` variable in the template will be replaced with the 6-digit code
- Supabase Auth handles all email delivery
- No additional email service setup required
- Emails come from Supabase's email system

## Current Status
The system is configured to use Supabase Auth as the email sender. The 6-digit code will be included in the email template and sent via Supabase's email system.



