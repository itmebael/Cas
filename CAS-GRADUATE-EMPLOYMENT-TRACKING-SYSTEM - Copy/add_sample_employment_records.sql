-- Add sample employment records after profiles are created
-- Run this script AFTER running database_setup_simple.sql

-- Insert employment record for John Doe
INSERT INTO employment_records (profile_id, job_title, company_name, industry, employment_type, salary_range, start_date, is_current, job_relevance, location)
SELECT 
    id,
    'Software Developer',
    'Tech Solutions Inc.',
    'Information Technology',
    'Full-time',
    '25,000 - 35,000',
    '2023-06-01',
    true,
    'Highly Relevant',
    'Manila'
FROM profiles 
WHERE email = 'john.doe@ssu.edu.ph'
ON CONFLICT DO NOTHING;

-- Insert employment record for Mike Johnson
INSERT INTO employment_records (profile_id, job_title, company_name, industry, employment_type, salary_range, start_date, is_current, job_relevance, location)
SELECT 
    id,
    'Data Analyst',
    'Analytics Corp',
    'Data Science',
    'Full-time',
    '30,000 - 40,000',
    '2023-07-01',
    true,
    'Highly Relevant',
    'Cebu'
FROM profiles 
WHERE email = 'mike.johnson@ssu.edu.ph'
ON CONFLICT DO NOTHING;

