# Email Troubleshooting Guide

## Why Emails Might Not Be Sending

### Step 1: Check Browser Console
1. **Open your browser** (http://localhost:8000)
2. **Press F12** to open Developer Tools
3. **Go to Console tab**
4. **Try sending a reset code**
5. **Look for error messages**

### Step 2: Common Issues and Solutions

#### Issue 1: EmailJS Template Parameters
**Problem**: Template expects different parameter names
**Solution**: Check your EmailJS template and make sure it uses:
- `{{reset_code}}` for the code
- `{{to_email}}` for recipient email
- `{{from_name}}` for sender name

#### Issue 2: EmailJS Service Not Connected
**Problem**: Gmail service not properly connected
**Solution**: 
1. Go to EmailJS dashboard
2. Check "Email Services" 
3. Make sure Gmail service is connected and active

#### Issue 3: Template Not Published
**Problem**: Template exists but not published
**Solution**:
1. Go to EmailJS dashboard
2. Go to "Email Templates"
3. Make sure your template is published (not draft)

#### Issue 4: CORS Issues
**Problem**: Browser blocking requests
**Solution**: Make sure you're testing on localhost (not file://)

### Step 3: Test with Debug Mode
The code now includes detailed logging. Check console for:
- "EmailJS available: true/false"
- "EmailJS initialized successfully"
- "Sending with params: {...}"
- Any error messages

### Step 4: Fallback Testing
If EmailJS fails, the system will:
1. Try Web3Forms (sends to your email)
2. Show code in console as fallback

### Step 5: Quick Test
1. **Go to forgot password screen**
2. **Enter any email**
3. **Click "Send Reset Code"**
4. **Check console (F12)** for detailed logs
5. **Look for the 6-digit code** in console

### Expected Console Output:
```
Trying EmailJS...
EmailJS available: true
Initializing with key: Oo7ua9u6nvBECsa3d
EmailJS initialized successfully
Sending with params: {to_email: "test@example.com", reset_code: "123456", ...}
✅ Email sent via EmailJS, result: {status: 200, text: "OK"}
```

### If You See Errors:
Copy the error message and let me know what it says!







