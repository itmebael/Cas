-- SQL ALTER statements to add age and picture columns to profiles table
-- Run these commands in your Supabase SQL editor or database management tool

-- Add age column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS age INTEGER;

-- Add picture column to profiles table (stores file path/URL)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS picture VARCHAR(500);

-- Add picture_url column as alternative (if you prefer storing URLs)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS picture_url TEXT;

-- Add constraints for age column (only if they don't exist)
DO $$ 
BEGIN
    -- Add age constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_age_range' 
        AND conrelid = 'profiles'::regclass
    ) THEN
        ALTER TABLE profiles 
        ADD CONSTRAINT check_age_range CHECK (age >= 16 AND age <= 100);
    END IF;
END $$;

-- Add comment to document the columns (only if they don't exist)
DO $$ 
BEGIN
    -- Add comments if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_description 
        WHERE objoid = 'profiles'::regclass 
        AND objsubid = (SELECT attnum FROM pg_attribute WHERE attname = 'age' AND attrelid = 'profiles'::regclass)
    ) THEN
        COMMENT ON COLUMN profiles.age IS 'Student age (16-100 years)';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_description 
        WHERE objoid = 'profiles'::regclass 
        AND objsubid = (SELECT attnum FROM pg_attribute WHERE attname = 'picture' AND attrelid = 'profiles'::regclass)
    ) THEN
        COMMENT ON COLUMN profiles.picture IS 'Profile picture filename or path';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_description 
        WHERE objoid = 'profiles'::regclass 
        AND objsubid = (SELECT attnum FROM pg_attribute WHERE attname = 'picture_url' AND attrelid = 'profiles'::regclass)
    ) THEN
        COMMENT ON COLUMN profiles.picture_url IS 'Profile picture URL (alternative to picture column)';
    END IF;
END $$;

-- Create index on age for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_age ON profiles(age);

-- ========================================
-- SUPABASE STORAGE BUCKET SETUP
-- ========================================

-- Create storage bucket for profile pictures
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'profile-pictures',
    'profile-pictures', 
    true, 
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for student documents (if needed)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'student-documents',
    'student-documents', 
    false, -- private bucket
    10485760, -- 10MB limit
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
) ON CONFLICT (id) DO NOTHING;

-- ========================================
-- STORAGE POLICIES (FIXED FOR RLS)
-- ========================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Profile pictures are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view student documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload student documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update student documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete student documents" ON storage.objects;

-- Policy for profile pictures bucket (public read, authenticated upload)
CREATE POLICY "Profile pictures are publicly readable" ON storage.objects
FOR SELECT USING (bucket_id = 'profile-pictures');

CREATE POLICY "Authenticated users can upload profile pictures" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'profile-pictures' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update profile pictures" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'profile-pictures' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete profile pictures" ON storage.objects
FOR DELETE USING (
    bucket_id = 'profile-pictures' 
    AND auth.role() = 'authenticated'
);

-- Policy for student documents bucket (private, authenticated access only)
CREATE POLICY "Authenticated users can view student documents" ON storage.objects
FOR SELECT USING (
    bucket_id = 'student-documents' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can upload student documents" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'student-documents' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update student documents" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'student-documents' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete student documents" ON storage.objects
FOR DELETE USING (
    bucket_id = 'student-documents' 
    AND auth.role() = 'authenticated'
);

-- ========================================
-- ALTERNATIVE: DISABLE RLS FOR STORAGE (IF NEEDED)
-- ========================================

-- If the above policies don't work, you can temporarily disable RLS for storage
-- (NOT RECOMMENDED for production, but useful for testing)
-- ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- ========================================
-- VERIFY STORAGE SETUP
-- ========================================

-- Check if buckets exist
SELECT name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE name IN ('profile-pictures', 'student-documents');

-- Check storage policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';

-- ========================================
-- HELPER FUNCTIONS
-- ========================================

-- Function to generate unique filename for profile pictures
CREATE OR REPLACE FUNCTION generate_profile_picture_filename()
RETURNS TEXT AS $$
BEGIN
    RETURN 'profile_' || extract(epoch from now())::bigint || '_' || substr(md5(random()::text), 1, 8) || '.jpg';
END;
$$ LANGUAGE plpgsql;

-- Function to get profile picture URL
CREATE OR REPLACE FUNCTION get_profile_picture_url(picture_filename TEXT)
RETURNS TEXT AS $$
BEGIN
    IF picture_filename IS NULL OR picture_filename = '' THEN
        RETURN NULL;
    END IF;
    
    RETURN 'https://your-project-ref.supabase.co/storage/v1/object/public/profile-pictures/' || picture_filename;
END;
$$ LANGUAGE plpgsql;

-- Optional: Update existing records with default values
-- UPDATE profiles SET age = NULL WHERE age IS NULL;
-- UPDATE profiles SET picture = NULL WHERE picture IS NULL;
-- UPDATE profiles SET picture_url = NULL WHERE picture_url IS NULL;
