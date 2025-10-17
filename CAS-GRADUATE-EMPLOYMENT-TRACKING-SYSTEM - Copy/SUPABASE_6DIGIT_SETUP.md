# Supabase 6-Digit Code Setup

## Implement Real 6-Digit Codes with Supabase

### Step 1: Create Database Table

Run this SQL in your Supabase SQL Editor:

```sql
-- Create reset_codes table for storing 6-digit codes
CREATE TABLE IF NOT EXISTS reset_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    used_at TIMESTAMP WITH TIME ZONE NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_reset_codes_email ON reset_codes(email);
CREATE INDEX IF NOT EXISTS idx_reset_codes_code ON reset_codes(code);
CREATE INDEX IF NOT EXISTS idx_reset_codes_expires ON reset_codes(expires_at);

-- Enable Row Level Security
ALTER TABLE reset_codes ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anonymous users to insert reset codes
CREATE POLICY "Allow anonymous users to insert reset codes" ON reset_codes
    FOR INSERT WITH CHECK (true);

-- Create policy to allow anonymous users to select reset codes
CREATE POLICY "Allow anonymous users to select reset codes" ON reset_codes
    FOR SELECT USING (true);
```

### Step 2: Create Supabase Edge Function

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions**
3. Click **"Create a new function"**
4. Name it `send-reset-code`
5. Copy the code from `supabase/functions/send-reset-code/index.ts`
6. Deploy the function

### Step 3: Update Email Template

In your Supabase Dashboard → **Authentication** → **Email Templates** → **Reset Password**:

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

### Step 4: Set Environment Variables

In your Supabase Dashboard → **Settings** → **API**:

- Set `SITE_URL` to your website URL
- Make sure `SUPABASE_SERVICE_ROLE_KEY` is available

### Step 5: Test the System

1. Go to forgot password screen
2. Enter your email address
3. Click "Send Reset Code"
4. Check your email for the 6-digit code
5. Enter the code on the website

### How It Works:

1. **User requests reset** → System generates 6-digit code
2. **Code stored in database** → `reset_codes` table
3. **Supabase sends email** → Using your custom template
4. **User receives email** → With 6-digit code
5. **User enters code** → System verifies against database
6. **Password reset allowed** → If code is valid and not expired

### Current Status:
The system is ready to send real 6-digit codes via Supabase. The Edge Function will handle the email sending, and the database will store the codes for verification.








