-- CAS Graduate Employment Tracking System Database Setup (Simplified)
-- Run this script in your Supabase SQL editor

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    student_number VARCHAR UNIQUE,
    full_name VARCHAR NOT NULL,
    middle_name VARCHAR,
    email VARCHAR NOT NULL,
    phone VARCHAR,
    birth_date DATE,
    gender VARCHAR,
    address TEXT,
    program VARCHAR NOT NULL, -- BSIS, BSIT, BSS, BSPSYCH
    graduation_year INTEGER NOT NULL,
    gpa DECIMAL,
    thesis_title TEXT,
    profile_picture TEXT,
    facebook VARCHAR,
    instagram VARCHAR,
    twitter VARCHAR,
    other_social VARCHAR,
    father_name VARCHAR,
    mother_name VARCHAR,
    father_contact VARCHAR,
    mother_contact VARCHAR,
    father_occupation VARCHAR,
    mother_occupation VARCHAR,
    emergency_name VARCHAR,
    emergency_email VARCHAR,
    emergency_relationship VARCHAR,
    emergency_facebook VARCHAR,
    emergency_phone VARCHAR,
    emergency_other VARCHAR,
    suggestions TEXT,
    employment_status VARCHAR,
    job_title VARCHAR,
    company_name VARCHAR,
    industry VARCHAR,
    employment_type VARCHAR,
    salary_range VARCHAR,
    start_date DATE,
    location VARCHAR,
    job_relevance VARCHAR,
    user_type VARCHAR NOT NULL, -- 'graduating' or 'graduated'
    verification_status VARCHAR DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create employment_records table
CREATE TABLE IF NOT EXISTS employment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id),
    job_title VARCHAR NOT NULL,
    company_name VARCHAR NOT NULL,
    industry VARCHAR,
    employment_type VARCHAR NOT NULL,
    salary_range VARCHAR,
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN DEFAULT true,
    job_relevance VARCHAR,
    location VARCHAR,
    description TEXT,
    verification_status VARCHAR DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create surveys table
CREATE TABLE IF NOT EXISTS surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR NOT NULL,
    description TEXT,
    type VARCHAR NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

-- Create survey_questions table
CREATE TABLE IF NOT EXISTS survey_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID REFERENCES surveys(id),
    question_text TEXT NOT NULL,
    question_type VARCHAR NOT NULL,
    options JSONB,
    is_required BOOLEAN DEFAULT true,
    order_index INTEGER
);

-- Create survey_responses table
CREATE TABLE IF NOT EXISTS survey_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID REFERENCES surveys(id),
    profile_id UUID REFERENCES profiles(id),
    responses JSONB NOT NULL,
    submitted_at TIMESTAMP DEFAULT NOW(),
    ip_address VARCHAR
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id),
    type VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    sent_at TIMESTAMP DEFAULT NOW()
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action VARCHAR NOT NULL,
    table_name VARCHAR NOT NULL,
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create storage bucket for profile pictures
INSERT INTO storage.buckets (id, name, public) 
VALUES ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) DO NOTHING;

-- Set up Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (true);

-- Create RLS policies for employment_records
CREATE POLICY "Employment records are viewable by everyone" ON employment_records
    FOR SELECT USING (true);

CREATE POLICY "Users can insert employment records" ON employment_records
    FOR INSERT WITH CHECK (true);

-- Create RLS policies for surveys
CREATE POLICY "Surveys are viewable by everyone" ON surveys
    FOR SELECT USING (true);

-- Create RLS policies for survey_questions
CREATE POLICY "Survey questions are viewable by everyone" ON survey_questions
    FOR SELECT USING (true);

-- Create RLS policies for survey_responses
CREATE POLICY "Users can insert survey responses" ON survey_responses
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their own survey responses" ON survey_responses
    FOR SELECT USING (true);

-- Create RLS policies for notifications
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (true);

-- Create RLS policies for audit_logs
CREATE POLICY "Audit logs are viewable by everyone" ON audit_logs
    FOR SELECT USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_profiles_verification_status ON profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_profiles_graduation_year ON profiles(graduation_year);
CREATE INDEX IF NOT EXISTS idx_profiles_program ON profiles(program);
CREATE INDEX IF NOT EXISTS idx_employment_records_profile_id ON employment_records(profile_id);
CREATE INDEX IF NOT EXISTS idx_employment_records_employment_type ON employment_records(employment_type);
CREATE INDEX IF NOT EXISTS idx_survey_responses_profile_id ON survey_responses(profile_id);
CREATE INDEX IF NOT EXISTS idx_notifications_profile_id ON notifications(profile_id);

-- Insert sample data for testing
INSERT INTO profiles (full_name, email, program, graduation_year, user_type, verification_status) VALUES
('John Doe', 'john.doe@ssu.edu.ph', 'BSIS', 2023, 'graduated', 'verified'),
('Jane Smith', 'jane.smith@ssu.edu.ph', 'BSIT', 2024, 'graduating', 'pending'),
('Mike Johnson', 'mike.johnson@ssu.edu.ph', 'BSS', 2023, 'graduated', 'verified'),
('Sarah Wilson', 'sarah.wilson@ssu.edu.ph', 'BSPSYCH', 2024, 'graduating', 'pending')
ON CONFLICT (email) DO NOTHING;
