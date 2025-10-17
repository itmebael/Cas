# Email Behavior Explanation

## Why Emails Go to Your Email Instead of User's Email

### The Issue:
Web3Forms is designed to send form submissions to the **form owner** (you), not to the user who filled out the form. This is how most form services work for security reasons.

### Current Behavior:
1. **User enters email**: `user@example.com`
2. **System generates 6-digit code**: `123456`
3. **Web3Forms sends email to YOU** with:
   - Subject: "Password Reset Request for user@example.com"
   - Message: "Reset code: 123456"
   - You can then forward this to the user

### Solutions:

#### Option 1: Use EmailJS (Recommended)
EmailJS can send emails directly to the user's email address:

1. **Go to [EmailJS.com](https://www.emailjs.com/)**
2. **Set up Gmail service**
3. **Create email template**
4. **Update the code** with your EmailJS credentials
5. **Emails will go directly to users**

#### Option 2: Manual Process (Current)
1. **User requests reset**
2. **You receive email** with the reset code
3. **You forward the code** to the user
4. **User enters code** to reset password

#### Option 3: Show Code on Screen
The system also shows the code in the browser console (F12) for immediate testing.

### For Production Use:
Set up EmailJS to send emails directly to users. The current Web3Forms setup is good for testing and small-scale use where you can manually forward codes.

### Test It Now:
1. Go to forgot password screen
2. Enter any email
3. Check your email for the reset request
4. Or check browser console (F12) for the code
5. Enter the code to complete the reset







