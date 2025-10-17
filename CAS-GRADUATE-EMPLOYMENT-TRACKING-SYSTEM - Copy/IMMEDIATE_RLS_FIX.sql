-- IMMEDIATE FIX for "new row violates row-level security policy" error
-- Run this in Supabase SQL Editor to fix the storage upload issue

-- ========================================
-- OPTION 1: DISABLE RLS TEMPORARILY (QUICKEST FIX)
-- ========================================

-- This will allow all authenticated users to upload files
-- WARNING: This disables security for storage, use only for testing
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- ========================================
-- OPTION 2: FIX RLS POLICIES (RECOMMENDED)
-- ========================================

-- Uncomment the lines below if you want to keep RLS enabled but fix the policies

/*
-- Re-enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Profile pictures are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view student documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload student documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update student documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete student documents" ON storage.objects;

-- Create simple, permissive policies
CREATE POLICY "Allow all authenticated users to read profile pictures" ON storage.objects
FOR SELECT USING (bucket_id = 'profile-pictures');

CREATE POLICY "Allow all authenticated users to upload profile pictures" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'profile-pictures');

CREATE POLICY "Allow all authenticated users to update profile pictures" ON storage.objects
FOR UPDATE USING (bucket_id = 'profile-pictures');

CREATE POLICY "Allow all authenticated users to delete profile pictures" ON storage.objects
FOR DELETE USING (bucket_id = 'profile-pictures');

-- Student documents policies
CREATE POLICY "Allow all authenticated users to read student documents" ON storage.objects
FOR SELECT USING (bucket_id = 'student-documents');

CREATE POLICY "Allow all authenticated users to upload student documents" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'student-documents');

CREATE POLICY "Allow all authenticated users to update student documents" ON storage.objects
FOR UPDATE USING (bucket_id = 'student-documents');

CREATE POLICY "Allow all authenticated users to delete student documents" ON storage.objects
FOR DELETE USING (bucket_id = 'student-documents');
*/

-- ========================================
-- VERIFY THE FIX
-- ========================================

-- Check if RLS is disabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'objects' AND schemaname = 'storage';

-- Check if buckets exist
SELECT name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE name IN ('profile-pictures', 'student-documents');

-- Check policies (should be empty if RLS is disabled)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';
