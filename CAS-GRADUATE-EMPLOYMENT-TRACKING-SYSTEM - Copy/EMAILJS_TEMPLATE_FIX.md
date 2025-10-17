# Fix EmailJS Template - Send to User's Email

## The Problem:
EmailJS is failing, so it falls back to Web3Forms which sends emails to YOUR account instead of the user's email.

## The Solution:
Your EmailJS template needs to be configured correctly to send emails to the user's email address.

## Step 1: Check Your EmailJS Template

1. **Go to your EmailJS dashboard**
2. **Go to "Email Templates"**
3. **Click on your template** (`template_1nagdyk`)
4. **Make sure the template is configured like this:**

### Template Settings:
- **Template Name**: `Password Reset Code`
- **Subject**: `Password Reset Code`

### Template Content:
```
Hello,

Your password reset code is: {{reset_code}}

This code expires in 15 minutes.

If you did not request this reset, please ignore this email.

Best regards,
CAS Graduate Employment Tracking System
```

### Template Variables (IMPORTANT):
Make sure your template uses these exact variable names:
- `{{reset_code}}` - for the 6-digit code
- `{{to_email}}` - for the recipient email
- `{{from_name}}` - for sender name

## Step 2: Check Gmail Service Connection

1. **Go to "Email Services"** in EmailJS
2. **Click on your Gmail service** (`service_ckalzp8`)
3. **Make sure it's connected and active**
4. **If not connected, reconnect it**

## Step 3: Test the Template

1. **Go to**: `http://localhost:8000/test_emailjs.html`
2. **Click "Test EmailJS"**
3. **Check your Gmail inbox**
4. **If you receive the email, EmailJS is working!**

## Step 4: If Still Not Working

The issue might be that your Gmail service is not properly configured to send emails to external addresses. In that case, we can use a different approach.

## Alternative Solution:
If EmailJS continues to fail, I can modify the system to use a different email service or method that will send emails directly to users.

## Current Status:
- ❌ EmailJS failing (emails go to your account)
- ✅ Web3Forms working (but sends to your account)
- 🔧 Need to fix EmailJS template/service configuration

Try the test page first and let me know what happens!
