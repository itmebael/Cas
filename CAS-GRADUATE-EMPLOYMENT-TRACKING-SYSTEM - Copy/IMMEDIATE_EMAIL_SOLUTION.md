# Immediate Email Solution - Send 6-Digit Codes

## Quick Setup (2 minutes)

### Option 1: Web3Forms (Recommended - Works Immediately)

1. **Go to [Web3Forms.com](https://web3forms.com/)**
2. **Get your access key** (free, no signup required)
3. **Update the code** in `script.js` line 3856:
   ```javascript
   access_key: 'YOUR_ACTUAL_WEB3FORMS_KEY', // Replace with your key
   ```
4. **Test immediately** - emails will be sent to your inbox

### Option 2: Use Current System (Works Now)

The system is already working! Here's how to test:

1. **Go to forgot password screen**
2. **Enter your email**
3. **Click "Send Reset Code"**
4. **Open browser console** (F12) to see the 6-digit code
5. **Enter that code** on the website

### Option 3: EmailJS (5 minutes setup)

1. **Go to [EmailJS.com](https://www.emailjs.com/)**
2. **Sign up for free account**
3. **Connect your Gmail**
4. **Create email template** with this content:
   ```
   Subject: Password Reset Code
   
   Your 6-digit reset code is: {{reset_code}}
   
   This code will expire in 15 minutes.
   ```
5. **Get your credentials** and update the code

## Test It Right Now

1. **Go to forgot password screen**
2. **Enter any email** (like `test@example.com`)
3. **Click "Send Reset Code"**
4. **Check browser console** (F12) for the 6-digit code
5. **Enter that code** on the website

## What You'll See in Console:
```
📧 EMAIL SIMULATION (All services failed):
To: test@example.com
Subject: Password Reset Code - CAS Graduate Tracking System
Message: Your password reset code is: 265845
This code expires in 15 minutes.
```

## For Real Email Delivery:
Set up Web3Forms (2 minutes) or EmailJS (5 minutes) following the steps above.

## Current Status:
The system works immediately for testing. For real email delivery, set up one of the email services above.








