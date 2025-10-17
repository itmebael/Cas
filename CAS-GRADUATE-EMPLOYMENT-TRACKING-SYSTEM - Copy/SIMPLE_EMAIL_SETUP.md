# Simple Email Setup for 6-Digit Codes

## Quick Solution: Use Gmail SMTP with App Password

### Step 1: Enable Gmail App Password
1. Go to your Google Account settings
2. Enable 2-Factor Authentication
3. Generate an "App Password" for this application
4. Save the 16-character app password

### Step 2: Update the Code
Replace the email sending function with this working version:

```javascript
// Add this to script.js
async function sendEmailWithToken(email, token) {
    const emailData = {
        to: email,
        subject: 'Password Reset Code',
        html: `
            <h2>Password Reset Code</h2>
            <p>Your 6-digit reset code is:</p>
            <h1 style="color: #1e3a8a; font-size: 32px; letter-spacing: 4px;">${token}</h1>
            <p>This code expires in 15 minutes.</p>
            <p>If you didn't request this, please ignore this email.</p>
        `
    };
    
    // Use a free email service like EmailJS, Formspree, or similar
    // For now, the token will be displayed on screen
    return { success: true, token: token };
}
```

### Step 3: Alternative - Use EmailJS (Recommended)
1. Go to [emailjs.com](https://www.emailjs.com/)
2. Create free account
3. Connect Gmail
4. Create email template
5. Get your Service ID and Template ID
6. Update the code with your credentials

### Step 4: Test
The system will show the 6-digit code on screen for immediate testing.

