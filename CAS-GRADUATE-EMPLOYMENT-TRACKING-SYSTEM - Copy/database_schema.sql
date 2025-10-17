-- CAS Graduate Employment Tracking System Database Schema
-- Supabase PostgreSQL Database

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE (User authentication and registration)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    user_type VARCHAR(20) NOT NULL, -- 'admin', 'graduating', 'graduated'
    student_id VARCHAR(50) UNIQUE, -- for students only
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. PROFILES TABLE (Main table for all students)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    student_id VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    birth_date DATE,
    program VARCHAR(50) NOT NULL, -- BSIS, BSIT, BSS, BSPSYCH
    user_type VARCHAR(20) NOT NULL, -- 'graduating' or 'graduated'
    
    -- Academic Information (for both types)
    graduation_year INTEGER, -- for graduated students
    expected_graduation DATE, -- for graduating students
    current_gpa DECIMAL(3,2),
    final_gpa DECIMAL(3,2),
    thesis_title TEXT,
    thesis_status VARCHAR(50), -- for graduating students
    thesis_advisor VARCHAR(255),
    
    -- Academic Progress (for graduating students)
    remaining_units INTEGER,
    current_semester VARCHAR(50),
    academic_year VARCHAR(20),
    scholarship VARCHAR(255),
    academic_achievements TEXT,
    
    -- Employment Information (for graduated students)
    employment_status VARCHAR(50),
    job_title VARCHAR(255),
    company_name VARCHAR(255),
    industry VARCHAR(100),
    start_date DATE,
    salary_range VARCHAR(50),
    job_description TEXT,
    job_relevance VARCHAR(50),
    
    -- Career Progression (for graduated students)
    first_job VARCHAR(255),
    first_company VARCHAR(255),
    job_search_time VARCHAR(50),
    promotions VARCHAR(50),
    career_goals TEXT,
    
    -- Career Planning (for graduating students)
    career_plans VARCHAR(50),
    preferred_industry VARCHAR(100),
    preferred_position VARCHAR(255),
    preferred_location VARCHAR(100),
    expected_salary VARCHAR(50),
    
    -- Skills and Competencies (for graduating students)
    technical_skills TEXT,
    soft_skills TEXT,
    certifications VARCHAR(500),
    internships VARCHAR(500),
    
    -- Job Search Preparation (for graduating students)
    resume_status VARCHAR(50),
    portfolio_status VARCHAR(50),
    job_search_start VARCHAR(50),
    support_needed VARCHAR(100),
    additional_info TEXT,
    
    -- University Feedback (for graduated students)
    program_preparation VARCHAR(50),
    recommend_program VARCHAR(50),
    suggestions TEXT,
    
    -- System fields
    verification_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. EMPLOYMENT RECORDS TABLE (for graduated students)
CREATE TABLE IF NOT EXISTS employment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    employment_type VARCHAR(50) NOT NULL, -- 'employed', 'unemployed', 'self-employed', 'further-studies'
    job_title VARCHAR(255),
    company_name VARCHAR(255),
    industry VARCHAR(100),
    start_date DATE,
    end_date DATE,
    salary_range VARCHAR(50),
    job_description TEXT,
    job_relevance VARCHAR(50),
    description TEXT, -- for unemployed or further studies
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ADMIN USERS TABLE (Legacy - now use users table with user_type='admin')
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'admin',
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. SYSTEM LOGS TABLE
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(50),
    record_id UUID,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'info', -- 'info', 'success', 'warning', 'error'
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. SURVEYS TABLE (for future surveys)
CREATE TABLE IF NOT EXISTS surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- 7. SURVEY RESPONSES TABLE
CREATE TABLE IF NOT EXISTS survey_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    responses JSONB NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address VARCHAR(45)
);

-- 8. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_student_id ON profiles(student_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_profiles_verification_status ON profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_profiles_program ON profiles(program);
CREATE INDEX IF NOT EXISTS idx_profiles_graduation_year ON profiles(graduation_year);

CREATE INDEX IF NOT EXISTS idx_employment_records_profile_id ON employment_records(profile_id);
CREATE INDEX IF NOT EXISTS idx_employment_records_employment_type ON employment_records(employment_type);

CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_action ON system_logs(action);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

CREATE INDEX IF NOT EXISTS idx_survey_responses_survey_id ON survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_profile_id ON survey_responses(profile_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample users (using base64 encoded passwords to match login system)
INSERT INTO users (username, email, password_hash, full_name, user_type, student_id, is_verified) 
VALUES 
('admin', 'admin@ssu.edu.ph', 'YWRtaW4xMjM=', 'System Administrator', 'admin', NULL, TRUE),
('juan.cruz', 'juan.cruz@student.ssu.edu.ph', 'cGFzc3dvcmQxMjM=', 'Juan Cruz', 'graduated', '2021-12345', TRUE),
('maria.santos', 'maria.santos@student.ssu.edu.ph', 'cGFzc3dvcmQxMjM=', 'Maria Santos', 'graduated', '2021-12346', TRUE),
('carlos.reyes', 'carlos.reyes@student.ssu.edu.ph', 'cGFzc3dvcmQxMjM=', 'Carlos Reyes', 'graduated', '2022-12347', TRUE),
('sandra.park', 'sandra.park@student.ssu.edu.ph', 'cGFzc3dvcmQxMjM=', 'Sandra Park', 'graduating', '2023-12348', TRUE),
('james.blue', 'james.blue@student.ssu.edu.ph', 'cGFzc3dvcmQxMjM=', 'James Blue', 'graduating', '2023-12349', TRUE)
ON CONFLICT (username) DO NOTHING;

-- Insert admin user record
INSERT INTO admin_users (user_id, role, permissions) 
SELECT id, 'admin', '{"all": true}' FROM users WHERE username = 'admin'
ON CONFLICT DO NOTHING;

-- Insert sample data for testing
INSERT INTO profiles (user_id, student_id, full_name, email, phone, address, birth_date, program, user_type, graduation_year, expected_graduation, employment_status, start_date, job_title, company_name, salary_range, job_relevance, verification_status) 
SELECT 
    u.id,
    u.student_id,
    u.full_name,
    u.email,
    CASE u.student_id
        WHEN '2021-12345' THEN '+639123456789'
        WHEN '2021-12346' THEN '+639123456790'
        WHEN '2022-12347' THEN '+639123456791'
        WHEN '2023-12348' THEN '+639123456792'
        WHEN '2023-12349' THEN '+639123456793'
    END,
    CASE u.student_id
        WHEN '2021-12345' THEN 'Catbalogan City, Samar'
        WHEN '2021-12346' THEN 'Calbayog City, Samar'
        WHEN '2022-12347' THEN 'Basey, Samar'
        WHEN '2023-12348' THEN 'Tacloban City, Leyte'
        WHEN '2023-12349' THEN 'Ormoc City, Leyte'
    END,
    CASE u.student_id
        WHEN '2021-12345' THEN '2000-05-15'::DATE
        WHEN '2021-12346' THEN '2000-08-22'::DATE
        WHEN '2022-12347' THEN '2001-03-10'::DATE
        WHEN '2023-12348' THEN '2002-01-18'::DATE
        WHEN '2023-12349' THEN '2002-07-05'::DATE
    END,
    CASE u.student_id
        WHEN '2021-12345' THEN 'BSIS'
        WHEN '2021-12346' THEN 'BSIT'
        WHEN '2022-12347' THEN 'BSS'
        WHEN '2023-12348' THEN 'BSPSYCH'
        WHEN '2023-12349' THEN 'BSIS'
    END,
    u.user_type,
    CASE u.student_id
        WHEN '2021-12345' THEN 2023
        WHEN '2021-12346' THEN 2023
        WHEN '2022-12347' THEN 2024
        ELSE NULL
    END,
    CASE u.student_id
        WHEN '2023-12348' THEN '2025-06-15'::DATE
        WHEN '2023-12349' THEN '2025-06-15'::DATE
        ELSE NULL
    END,
    CASE u.student_id
        WHEN '2021-12345' THEN 'employed'
        WHEN '2021-12346' THEN 'employed'
        WHEN '2022-12347' THEN 'unemployed'
        ELSE NULL
    END,
    CASE u.student_id
        WHEN '2021-12345' THEN '2023-06-01'::DATE
        WHEN '2021-12346' THEN '2023-07-15'::DATE
        ELSE NULL
    END,
    CASE u.student_id
        WHEN '2021-12345' THEN 'Software Developer'
        WHEN '2021-12346' THEN 'Web Developer'
        ELSE NULL
    END,
    CASE u.student_id
        WHEN '2021-12345' THEN 'Tech Solutions Inc.'
        WHEN '2021-12346' THEN 'Digital Innovations'
        ELSE NULL
    END,
    CASE u.student_id
        WHEN '2021-12345' THEN '25001-35000'
        WHEN '2021-12346' THEN '25001-35000'
        ELSE NULL
    END,
    CASE u.student_id
        WHEN '2021-12345' THEN 'highly-relevant'
        WHEN '2021-12346' THEN 'highly-relevant'
        ELSE NULL
    END,
    CASE u.student_id
        WHEN '2021-12345' THEN 'verified'
        WHEN '2021-12346' THEN 'verified'
        WHEN '2022-12347' THEN 'verified'
        WHEN '2023-12348' THEN 'pending'
        WHEN '2023-12349' THEN 'pending'
    END
FROM users u 
WHERE u.user_type IN ('graduating', 'graduated')
ON CONFLICT (student_id) DO NOTHING;

-- Insert sample employment records
INSERT INTO employment_records (profile_id, employment_type, job_title, company_name, industry, start_date, salary_range, job_relevance) 
SELECT 
    p.id,
    'employed',
    p.job_title,
    p.company_name,
    p.industry,
    CASE p.student_id
        WHEN '2021-12345' THEN '2023-06-01'::DATE
        WHEN '2021-12346' THEN '2023-07-15'::DATE
        ELSE NULL
    END,
    CASE p.student_id
        WHEN '2021-12345' THEN '25001-35000'
        WHEN '2021-12346' THEN '25001-35000'
        ELSE NULL
    END,
    CASE p.student_id
        WHEN '2021-12345' THEN 'highly-relevant'
        WHEN '2021-12346' THEN 'highly-relevant'
        ELSE NULL
    END
FROM profiles p 
WHERE p.user_type = 'graduated' AND p.employment_status = 'employed'
ON CONFLICT DO NOTHING;

-- Alter existing tables if they exist (for updates)
-- Add user_type column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'user_type') THEN
        ALTER TABLE users ADD COLUMN user_type VARCHAR(20) DEFAULT 'graduating';
    END IF;
END $$;

-- Update existing users to have proper user_type if NULL
UPDATE users SET user_type = 'graduating' WHERE user_type IS NULL;

-- Add constraint to ensure user_type is not null
ALTER TABLE users ALTER COLUMN user_type SET NOT NULL;

-- Add check constraint for valid user types
ALTER TABLE users ADD CONSTRAINT check_user_type 
CHECK (user_type IN ('admin', 'graduating', 'graduated'));

-- Grant necessary permissions (adjust based on your Supabase setup)
-- These are typically handled by Supabase automatically, but included for reference
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
-- GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
