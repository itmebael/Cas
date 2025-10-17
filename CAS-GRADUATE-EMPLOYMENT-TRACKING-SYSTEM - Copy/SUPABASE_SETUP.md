# CAS Graduate Employment Tracking System - Supabase Setup Guide

## Database Configuration

### 1. Supabase Project Details
- **Project URL**: https://mcdkeoomndrwrapcrmch.supabase.co
- **API Key**: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGtlb29tbmRyd3JhcGNybWNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxOTM2MDAsImV4cCI6MjA3Mjc2OTYwMH0.QOrm-xmC7x_NVdLnVeo3hEH2MLoZqa5oRG9kjR79F5g

### 2. Database Tables Created

#### Main Tables:
1. **profiles** - Main table for all students (graduating and graduated)
2. **employment_records** - Employment history for graduated students
3. **admin_users** - System administrators
4. **system_logs** - Activity tracking
5. **notifications** - System notifications
6. **surveys** - Future survey functionality
7. **survey_responses** - Survey responses
8. **audit_logs** - System audit trail

### 3. Setup Instructions

#### Step 1: Run the SQL Schema
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `database_schema.sql`
4. Execute the SQL to create all tables and sample data

#### Step 2: Configure Row Level Security (RLS)
Run these commands in the SQL Editor:

```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust as needed)
CREATE POLICY "Allow public read access to profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to profiles" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to profiles" ON profiles FOR UPDATE USING (true);

CREATE POLICY "Allow public read access to employment_records" ON employment_records FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to employment_records" ON employment_records FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public insert access to system_logs" ON system_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert access to notifications" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert access to survey_responses" ON survey_responses FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert access to audit_logs" ON audit_logs FOR INSERT WITH CHECK (true);
```

#### Step 3: Verify Configuration
1. Check that all tables are created successfully
2. Verify sample data is inserted
3. Test the application by submitting a form

### 4. Sample Data Included

The database schema includes sample data:
- 5 sample student profiles (3 graduated, 2 graduating)
- 1 admin user (username: admin, password: admin123)
- Sample employment records

### 5. Form Integration

The application is now configured to:
- Submit graduating student forms to the `profiles` table with `user_type = 'graduating'`
- Submit graduated student forms to the `profiles` table with `user_type = 'graduated'`
- Create employment records for graduated students who are employed
- Log all activities in the `system_logs` table
- Track verification status for all profiles

### 6. Admin Dashboard Features

The admin dashboard will display:
- Total students (graduating + graduated)
- Graduated students count
- Employment statistics
- Pending verifications
- Employment rate calculation

### 7. Security Notes

- The API key is public and safe to use in frontend applications
- Row Level Security (RLS) should be configured based on your security requirements
- Consider implementing authentication for admin functions
- Regular backups are recommended

### 8. Troubleshooting

If you encounter issues:
1. Check the browser console for Supabase connection errors
2. Verify the API key and URL are correct
3. Ensure all tables are created successfully
4. Check RLS policies if data access is restricted

### 9. Next Steps

1. Test the complete flow with both graduating and graduated students
2. Configure additional RLS policies as needed
3. Set up regular database backups
4. Monitor system logs for any issues
5. Consider implementing user authentication for enhanced security


