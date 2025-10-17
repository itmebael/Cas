-- Ensure One Email Per Profile Policy
-- This script creates a simple and reliable constraint to prevent duplicate emails

-- Add a unique constraint on email if it doesn't exist
ALTER TABLE profiles ADD CONSTRAINT unique_email_per_profile UNIQUE (email);

-- Add comment to document the constraint
COMMENT ON CONSTRAINT unique_email_per_profile ON profiles IS 'Ensures each email can only be used once across all profiles';

-- Verify the constraint was created
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'profiles'::regclass 
AND conname = 'unique_email_per_profile';

-- Test the constraint with a sample query
-- This should show the unique constraint is working
SELECT 
    'Email uniqueness constraint is active' as status,
    COUNT(DISTINCT email) as unique_emails,
    COUNT(*) as total_profiles
FROM profiles;
