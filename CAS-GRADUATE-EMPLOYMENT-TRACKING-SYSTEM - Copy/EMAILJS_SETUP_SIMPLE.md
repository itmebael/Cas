# EmailJS Setup - Send 6-Digit Codes to User Email

## Quick Setup (5 minutes)

### Step 1: Create EmailJS Account
1. Go to [https://www.emailjs.com/](https://www.emailjs.com/)
2. Click "Sign Up" (free account)
3. Verify your email

### Step 2: Connect Gmail
1. In EmailJS dashboard → "Email Services"
2. Click "Add New Service"
3. Choose "Gmail"
4. Connect your Gmail account
5. Copy your **Service ID** (starts with `service_`)

### Step 3: Create Email Template
1. Go to "Email Templates"
2. Click "Create New Template"
3. Use this exact template:

**Template Name:** Password Reset

**Subject:** Password Reset Code

**Content:**
```
Your password reset code is: {{reset_code}}

This code will expire in 15 minutes.

If you did not request this reset, please ignore this email.

Best regards,
CAS Graduate Employment Tracking System
```

4. Save the template
5. Copy your **Template ID** (starts with `template_`)

### Step 4: Get User ID
1. Go to "Account" → "General"
2. Copy your **Public Key** (starts with `user_`)

### Step 5: Update Code
Replace these values in `script.js`:

**Line 3850:** Replace `"user_1234567890abcdef"` with your User ID
**Line 3854:** Replace `"service_1234567"` with your Service ID  
**Line 3855:** Replace `"template_1234567"` with your Template ID

### Step 6: Test
1. Go to forgot password screen
2. Enter your email address
3. Click "Send Reset Code"
4. Check your email for the 6-digit code
5. Enter the code on the website

## Example:
If your credentials are:
- User ID: `user_abc123def456`
- Service ID: `service_xyz789`
- Template ID: `template_mno456`

Update the code to:
```javascript
await window.emailjs.init("user_abc123def456");
const result = await window.emailjs.send(
    'service_xyz789',
    'template_mno456',
    // ... rest of the code
);
```

## Free Tier Limits:
- 200 emails per month
- Perfect for development and testing
