# Supabase Setup Guide for CAS Graduate Employment Tracking System

## 1. Database Setup

1. **Open Supabase Dashboard**
   - Go to [supabase.com](https://supabase.com)
   - Sign in to your account
   - Open your project

2. **Run Database Setup Scripts**
   - Go to SQL Editor in your Supabase dashboard
   - **First**: Copy and paste the contents of `database_setup_simple.sql`
   - Click "Run" to execute the script
   - **Then**: Copy and paste the contents of `add_sample_employment_records.sql`
   - Click "Run" to execute the second script

3. **Verify Tables Created**
   - Go to Table Editor
   - You should see these tables:
     - `profiles`
     - `employment_records`
     - `surveys`
     - `survey_questions`
     - `survey_responses`
     - `notifications`
     - `audit_logs`

## 2. Storage Setup

1. **Create Storage Bucket**
   - Go to Storage in your Supabase dashboard
   - Create a new bucket named `profile-pictures`
   - Set it as public

2. **Set Storage Policies**
   - Go to Storage > Policies
   - Add policy for `profile-pictures` bucket:
     - Policy name: "Public Access"
     - Operation: SELECT
     - Target roles: public
     - Policy definition: `true`

## 3. Authentication Setup

1. **Enable Email Authentication**
   - Go to Authentication > Settings
   - Enable "Email" provider
   - Configure email templates if needed

2. **Set up Email Templates**
   - Go to Authentication > Email Templates
   - Customize the templates for your university branding

## 4. Environment Configuration

The application is already configured with the Supabase credentials:
- **URL**: `https://mcdkeoomndrwrapcrmch.supabase.co`
- **Anon Key**: Already embedded in the code

## 5. Testing the Integration

1. **Test Form Submission**
   - Open `screens/gradtuating-form.html` or `screens/graduated-form.html`
   - Fill out the form and submit
   - Check the `profiles` table in Supabase to see the data

2. **Test Dashboard Data Loading**
   - Open `screens/dashboard1.html` or `screens/dashboard2.html`
   - The dashboards should load data from the database

## 6. Features Included

### ✅ **Form Integration**
- Graduating student form saves to `profiles` table
- Graduated student form saves to `profiles` and `employment_records` tables
- Profile picture upload to Supabase Storage
- Form validation and error handling

### ✅ **Dashboard Integration**
- Dashboard 1 loads graduating students from database
- Dashboard 2 loads graduated students from database
- Year-based filtering for graduated students
- Real-time data display

### ✅ **Database Schema**
- Complete database schema with all necessary tables
- Row Level Security (RLS) policies
- Proper indexing for performance
- Sample data for testing

### ✅ **Storage Integration**
- Profile picture upload and storage
- Public URL generation for images
- File type validation

## 7. Troubleshooting

### Common Issues:

1. **"Failed to fetch" errors**
   - Check if Supabase URL and key are correct
   - Verify CORS settings in Supabase

2. **Storage upload errors**
   - Ensure `profile-pictures` bucket exists and is public
   - Check storage policies

3. **RLS policy errors**
   - Verify Row Level Security policies are set up correctly
   - Check if policies allow the operations you're trying to perform

4. **Form submission errors**
   - Check browser console for detailed error messages
   - Verify all required fields are filled
   - Check database constraints

## 8. Next Steps

1. **Customize the database schema** if needed
2. **Add more validation** to the forms
3. **Implement user authentication** for secure access
4. **Add email notifications** for form submissions
5. **Create admin panel** for managing submissions

## 9. Support

If you encounter any issues:
1. Check the browser console for error messages
2. Verify your Supabase project settings
3. Ensure all database tables and policies are set up correctly
4. Test with the sample data provided in the setup script
