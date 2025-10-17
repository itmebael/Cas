-- SUPABASE STORAGE FIX (Permission-Safe)
-- Run these commands in Supabase SQL Editor

-- ========================================
-- OPTION 1: CREATE PROPER STORAGE POLICIES
-- ========================================

-- First, let's check what buckets exist
SELECT name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE name IN ('profile-pictures', 'student-documents');

-- Create the profile-pictures bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'profile-pictures',
    'profile-pictures', 
    true, 
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Create the student-documents bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'student-documents',
    'student-documents', 
    false, -- private bucket
    10485760, -- 10MB limit
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
) ON CONFLICT (id) DO NOTHING;

-- ========================================
-- OPTION 2: CREATE PERMISSIVE STORAGE POLICIES
-- ========================================

-- Drop existing policies first
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete profile pictures" ON storage.objects;

-- Create very permissive policies for profile pictures
CREATE POLICY "Public Access" ON storage.objects
FOR ALL USING (bucket_id = 'profile-pictures');

-- Alternative: Create policies for authenticated users only
-- CREATE POLICY "Authenticated users can upload profile pictures" ON storage.objects
-- FOR INSERT WITH CHECK (
--     bucket_id = 'profile-pictures' 
--     AND auth.role() = 'authenticated'
-- );

-- CREATE POLICY "Authenticated users can update profile pictures" ON storage.objects
-- FOR UPDATE USING (
--     bucket_id = 'profile-pictures' 
--     AND auth.role() = 'authenticated'
-- );

-- CREATE POLICY "Authenticated users can delete profile pictures" ON storage.objects
-- FOR DELETE USING (
--     bucket_id = 'profile-pictures' 
--     AND auth.role() = 'authenticated'
-- );

-- ========================================
-- OPTION 3: CHECK CURRENT POLICIES
-- ========================================

-- Check what policies currently exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';

-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'objects' AND schemaname = 'storage';

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Verify buckets exist and are configured correctly
SELECT name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE name IN ('profile-pictures', 'student-documents');

-- Test if we can list files in the bucket (this will show if permissions work)
-- SELECT * FROM storage.objects WHERE bucket_id = 'profile-pictures' LIMIT 5;
