# Fix for "new row violates row-level security policy" Error

## Problem
The error "new row violates row-level security policy" occurs because Supabase Storage has Row Level Security (RLS) enabled, but the policies aren't properly configured for authenticated users to upload files.

## Solution

### Step 1: Run the Updated SQL Commands
Execute the updated SQL commands from `add_age_picture_columns.sql` in your Supabase SQL editor. The key changes are:

1. **Drop existing policies** to avoid conflicts
2. **Create proper RLS policies** for authenticated users
3. **Add verification queries** to check setup

### Step 2: Alternative Quick Fix (Temporary)
If you need an immediate fix for testing, you can temporarily disable RLS for storage:

```sql
-- TEMPORARY FIX (NOT RECOMMENDED FOR PRODUCTION)
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
```

### Step 3: Verify the Fix
Run these queries in Supabase SQL editor to verify:

```sql
-- Check if buckets exist
SELECT name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE name IN ('profile-pictures', 'student-documents');

-- Check storage policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';
```

## Expected Results

### Buckets Query Should Show:
- `profile-pictures` bucket with `public: true`
- `student-documents` bucket with `public: false`

### Policies Query Should Show:
- Multiple policies for `storage.objects` table
- Policies for SELECT, INSERT, UPDATE, DELETE operations
- All policies should have `auth.role() = 'authenticated'` condition

## Common Issues

### 1. Bucket Doesn't Exist
**Error**: Bucket not found in query results
**Fix**: Run the bucket creation commands from the SQL file

### 2. No Policies Found
**Error**: Empty policies query result
**Fix**: Run the policy creation commands from the SQL file

### 3. User Not Authenticated
**Error**: Still getting RLS violations
**Fix**: Ensure user is logged in before uploading

## Testing
After applying the fix:
1. Log in as a student
2. Try uploading a profile picture
3. Check browser console for success messages
4. Verify file appears in Supabase Storage dashboard

## Security Note
The policies allow any authenticated user to upload to the profile-pictures bucket. For production, you might want to add more specific user-based restrictions.




