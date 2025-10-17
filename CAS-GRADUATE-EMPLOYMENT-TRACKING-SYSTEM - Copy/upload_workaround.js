// UPLOAD WORKAROUND FOR SUPABASE STORAGE
// Add this to your script.js or run in browser console

// Enhanced upload function with better error handling
async function uploadProfilePictureWithWorkaround(file, bucketName = 'profile-pictures') {
    console.log('Starting upload workaround...');
    
    // Check if Supabase client exists
    if (!window.supabaseClient) {
        console.error('Supabase client not found');
        return { success: false, error: 'Supabase client not initialized' };
    }
    
    try {
        // Check authentication status
        const { data: { user }, error: authError } = await window.supabaseClient.auth.getUser();
        console.log('Auth check result:', { user: !!user, error: authError });
        
        if (authError) {
            console.error('Authentication error:', authError);
            return { success: false, error: 'Authentication failed: ' + authError.message };
        }
        
        if (!user) {
            console.error('No authenticated user');
            return { success: false, error: 'Please log in to upload files' };
        }
        
        console.log('User authenticated:', user.email);
        
        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `profile_${Date.now()}_${Math.random().toString(36).substr(2, 8)}.${fileExt}`;
        
        console.log('Uploading file:', fileName);
        console.log('File details:', {
            name: file.name,
            size: file.size,
            type: file.type
        });
        
        // Try upload with different approaches
        let uploadResult;
        
        // Approach 1: Direct upload
        try {
            console.log('Attempting direct upload...');
            uploadResult = await window.supabaseClient.storage
                .from(bucketName)
                .upload(fileName, file);
            
            console.log('Direct upload result:', uploadResult);
            
            if (uploadResult.error) {
                throw uploadResult.error;
            }
            
        } catch (directError) {
            console.log('Direct upload failed:', directError);
            
            // Approach 2: Try with upsert
            try {
                console.log('Attempting upload with upsert...');
                uploadResult = await window.supabaseClient.storage
                    .from(bucketName)
                    .upload(fileName, file, {
                        upsert: true
                    });
                
                console.log('Upsert upload result:', uploadResult);
                
                if (uploadResult.error) {
                    throw uploadResult.error;
                }
                
            } catch (upsertError) {
                console.log('Upsert upload failed:', upsertError);
                
                // Approach 3: Try with different filename
                const altFileName = `img_${Date.now()}.${fileExt}`;
                console.log('Attempting with alternative filename:', altFileName);
                
                uploadResult = await window.supabaseClient.storage
                    .from(bucketName)
                    .upload(altFileName, file);
                
                console.log('Alternative filename upload result:', uploadResult);
                
                if (uploadResult.error) {
                    throw uploadResult.error;
                }
                
                // Update filename for URL generation
                fileName = altFileName;
            }
        }
        
        // Get public URL
        const { data: urlData } = window.supabaseClient.storage
            .from(bucketName)
            .getPublicUrl(fileName);
        
        console.log('Upload successful! URL:', urlData.publicUrl);
        
        return {
            success: true,
            fileName: fileName,
            url: urlData.publicUrl,
            data: uploadResult.data
        };
        
    } catch (error) {
        console.error('Upload workaround failed:', error);
        return {
            success: false,
            error: error.message || 'Upload failed'
        };
    }
}

// Test function
window.testUploadWorkaround = async function() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    
    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        console.log('Testing upload workaround with file:', file.name);
        const result = await uploadProfilePictureWithWorkaround(file);
        
        if (result.success) {
            console.log('✅ Upload successful!');
            console.log('File URL:', result.url);
            alert('Upload successful! Check console for details.');
        } else {
            console.log('❌ Upload failed:', result.error);
            alert('Upload failed: ' + result.error);
        }
    };
    
    fileInput.click();
};

// Make function globally available
window.uploadProfilePictureWithWorkaround = uploadProfilePictureWithWorkaround;

console.log('Upload workaround loaded. Run testUploadWorkaround() to test.');




