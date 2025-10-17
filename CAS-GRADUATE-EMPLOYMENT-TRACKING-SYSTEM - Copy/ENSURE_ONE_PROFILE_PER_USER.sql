-- Ensure One Profile Per User
-- This script adds constraints to prevent duplicate profiles for the same user

-- Add unique constraint on user_id to ensure one profile per user
ALTER TABLE profiles ADD CONSTRAINT unique_user_profile UNIQUE (user_id);

-- Add unique constraint on email to prevent duplicate emails
ALTER TABLE profiles ADD CONSTRAINT unique_email UNIQUE (email);

-- Add unique constraint on student_id to prevent duplicate student IDs
ALTER TABLE profiles ADD CONSTRAINT unique_student_id UNIQUE (student_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id_unique ON profiles (user_id);

-- Add comment to document the constraint
COMMENT ON CONSTRAINT unique_user_profile ON profiles IS 'Ensures each user can only have one profile';
COMMENT ON CONSTRAINT unique_email ON profiles IS 'Ensures each email can only be used once';
COMMENT ON CONSTRAINT unique_student_id ON profiles IS 'Ensures each student ID is unique';

-- Verify the constraints were added
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'profiles'::regclass 
AND conname IN ('unique_user_profile', 'unique_email', 'unique_student_id');




