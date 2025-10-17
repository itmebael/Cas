# Supabase Built-in Reset Password Setup

## Use Supabase's Built-in System with Your Custom Template

### Step 1: Configure Email Template in Supabase

1. Go to your **Supabase Dashboard**
2. Navigate to **Authentication** → **Email Templates**
3. Click on **"Reset Password"** template
4. Replace the template content with your custom template:

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

### Step 3: How It Works

**Important Note:** The `{{ .Token }}` in Supabase templates is a **long URL token**, not a 6-digit code. However, the system will:

1. **Send the email** using your custom template
2. **Display the long token** in the styled box
3. **User can copy the token** from the email
4. **System verifies the token** when user enters it

### Step 4: Test the System

1. Go to forgot password screen
2. Enter your email address
3. Click "Send Reset Code"
4. Check your email for the Supabase email
5. The email will contain the long token in your styled template
6. Copy the token and enter it on the website

### Step 5: Alternative - Modify Template for 6-Digit Display

If you want to show a 6-digit code instead of the long token, you can modify the template to extract the first 6 characters:

```html
<h2>Password Reset Code</h2>
<p>You requested a password reset for your CAS Graduate Tracking System account.</p>

<div style="background: #f0f9ff; border: 2px solid #0ea5e9; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
    <p style="margin: 0; font-size: 18px; color: #0c4a6e;">Your reset code is:</p>
    <p style="font-size: 32px; font-weight: bold; color: #0c4a6e; letter-spacing: 4px; margin: 10px 0;">{{ .Token | truncate 6 }}</p>
</div>

<p><strong>Important:</strong> This code will expire in 15 minutes.</p>
<p>Enter this code on the website to reset your password.</p>
```

### Current Status
The system uses Supabase's built-in reset password functionality with your custom email template. The email will be sent via Supabase's email system.








