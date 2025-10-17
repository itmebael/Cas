# Working Email Solution - Send 6-Digit Codes

## Problem: Supabase doesn't send 6-digit codes
Supabase's `resetPasswordForEmail` sends reset **links**, not 6-digit **codes**. The `{{ .Token }}` is a long URL token, not a 6-digit number.

## Solution: Use a Working Email Service

### Option 1: EmailJS (Recommended - 5 minutes setup)

1. **Go to [EmailJS.com](https://www.emailjs.com/)**
2. **Sign up for free account**
3. **Connect your Gmail**
4. **Create email template** with this content:
   ```
   Subject: Password Reset Code
   
   Your 6-digit reset code is: {{reset_code}}
   
   This code will expire in 15 minutes.
   ```
5. **Get your credentials** and update `script.js`:
   - Replace the email sending function with EmailJS code
   - Use your Service ID, Template ID, and User ID

### Option 2: Use Current System (Works Now)

The current system is set up to work immediately:

1. **Go to forgot password screen**
2. **Enter your email**
3. **Click "Send Reset Code"**
4. **Check browser console** for the 6-digit code
5. **Enter that code** on the website

### Option 3: Quick EmailJS Integration

Replace the email sending function in `script.js` with this:

```javascript
// Use EmailJS to send the 6-digit code
if (window.emailjs) {
    await window.emailjs.init("YOUR_USER_ID");
    const result = await window.emailjs.send(
        'YOUR_SERVICE_ID',
        'YOUR_TEMPLATE_ID',
        {
            to_email: email,
            reset_code: token,
            subject: 'Password Reset Code'
        }
    );
    return { success: true, token: token, emailSent: true };
}
```

## Current Status
The system works immediately - it will show the 6-digit code in the browser console for testing. For real email delivery, set up EmailJS following the steps above.

## Test It Now
1. Go to forgot password screen
2. Enter any email
3. Click "Send Reset Code"
4. Check browser console (F12) for the 6-digit code
5. Enter that code on the website





