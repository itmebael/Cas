# EmailJS Setup Guide

To enable 6-digit code sending to Gmail, you need to set up EmailJS:

## Step 1: Create EmailJS Account
1. Go to [https://www.emailjs.com/](https://www.emailjs.com/)
2. Sign up for a free account
3. Verify your email

## Step 2: Create Email Service
1. In EmailJS dashboard, go to "Email Services"
2. Click "Add New Service"
3. Choose "Gmail" as your email service
4. Connect your Gmail account
5. Note down your **Service ID** (e.g., `service_abc123`)

## Step 3: Create Email Template
1. Go to "Email Templates"
2. Click "Create New Template"
3. Use this template:

**Subject:** Password Reset Code

**Content:**
```
Hello,

Your password reset code is: {{reset_code}}

This code will expire in 15 minutes.

If you did not request this reset, please ignore this email.

Best regards,
CAS Graduate Employment Tracking System
```

4. Note down your **Template ID** (e.g., `template_xyz789`)

## Step 4: Get User ID
1. Go to "Account" → "General"
2. Copy your **Public Key** (User ID)

## Step 5: Update the Code
Replace these values in `script.js`:

```javascript
// Line 240: Replace YOUR_EMAILJS_USER_ID
window.emailjs.init("YOUR_ACTUAL_USER_ID");

// Line 3852: Replace YOUR_SERVICE_ID  
'YOUR_ACTUAL_SERVICE_ID',

// Line 3853: Replace YOUR_TEMPLATE_ID
'YOUR_ACTUAL_TEMPLATE_ID',
```

## Step 6: Test
1. Go to forgot password screen
2. Enter your email
3. Click "Send Reset Code"
4. Check your Gmail for the 6-digit code

## Free Tier Limits
- 200 emails per month
- Perfect for development and small projects

## Alternative: Use Fallback Mode
If you don't want to set up EmailJS, the system will automatically show the 6-digit code on the screen as a fallback.

