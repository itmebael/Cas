# Supabase Email Setup for 6-Digit Codes

## Configure Supabase to Send 6-Digit Codes to Gmail

### Step 1: Configure Supabase Email Templates

1. Go to your Supabase Dashboard
2. Navigate to Authentication → Email Templates
3. Edit the "Reset Password" template
4. Replace the template with this content:

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

1. In Supabase Dashboard → Authentication → Settings
2. Set up your SMTP settings or use Supabase's default email service
3. Make sure email sending is enabled

### Step 3: Test the System

1. Go to forgot password screen
2. Enter your email address
3. Click "Send Reset Code"
4. Check your Gmail for the email with 6-digit code
5. Enter the code on the website

### Step 4: Alternative - Use Custom Email Function

If the default template doesn't work, you can create a custom Edge Function in Supabase to send emails with the 6-digit code.

## Current Status
The system is configured to send emails via Supabase. The 6-digit code will be included in the email template.
