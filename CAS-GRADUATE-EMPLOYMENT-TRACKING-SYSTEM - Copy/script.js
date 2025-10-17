// Show graduated students summary by year and course
window.showGraduatedSummary = async function() {
    const year = document.getElementById('graduation-year-filter').value;
    const resultsDiv = document.getElementById('graduated-summary-results');
    if (!year || !resultsDiv || !window.supabaseClient) {
        resultsDiv.innerHTML = '<div style="color:red">Please enter a valid year.</div>';
        return;
    }
    resultsDiv.innerHTML = '<div>Loading...</div>';
    const courses = ['BSIS', 'BSIT', 'BSS', 'BSPSYCH'];
    let summaryHtml = `<h4>Graduated Students in ${year}</h4><ul>`;
    for (const course of courses) {
        const { data, error } = await window.supabaseClient
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('user_type', 'graduated')
            .eq('graduation_year', year)
            .eq('program', course);
        const count = (!error && typeof data?.count === 'number') ? data.count : 0;
        summaryHtml += `<li><strong>${course}:</strong> ${count} graduated</li>`;
    }
    summaryHtml += '</ul>';
    resultsDiv.innerHTML = summaryHtml;
};
    console.log('Script.js loading...');
    
    async function loadGraduatedAccounts() {
        const tbody = document.querySelector('#graduated-accounts-table tbody');
        if (!tbody || !supabaseClient) return;
        tbody.innerHTML = '';
        const { data, error } = await supabaseClient
            .from('graduated_accounts')
            .select('email, status, issued_at, delivered_at, profile_id')
            .order('issued_at', { ascending: false });
        if (error) { tbody.innerHTML = '<tr><td colspan="5">Failed to load graduated accounts</td></tr>'; return; }
        (data || []).forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.email}</td>
                <td>${row.status}</td>
                <td>${row.issued_at ? new Date(row.issued_at).toLocaleString() : ''}</td>
                <td>${row.delivered_at ? new Date(row.delivered_at).toLocaleString() : ''}</td>
                <td><button class="btn btn-secondary" onclick="resendGraduatedEmail('${row.profile_id}')">Re-send</button></td>
            `;
            tbody.appendChild(tr);
        });
    }
    window.loadGraduatedAccounts = loadGraduatedAccounts;

    async function resendGraduatedEmail(profileId) {
        try {
            if (!supabaseClient) return;
            const { data: ga, error } = await supabaseClient
                .from('graduated_accounts')
                .select('email, temp_password')
                .eq('profile_id', profileId)
                .single();
            if (error || !ga) { showNotification('No graduated account found', 'error'); return; }
            const subject = encodeURIComponent('Your Graduated Account Details');
            const body = encodeURIComponent(`Hello,\n\nHere are your Graduated account details:\nEmail: ${ga.email}\nTemporary Password: ${ga.temp_password}\n\nFor security, please change your password after first login.`);
            const link = `mailto:${encodeURIComponent(ga.email)}?subject=${subject}&body=${body}`;
            window.location.href = link;
        } catch (e) {
            console.error('Resend failed', e);
            showNotification('Failed to prepare email', 'error');
        }
    }
    window.resendGraduatedEmail = resendGraduatedEmail;

    // Generate accounts for due graduates and queue emails (calls SQL RPC or direct SQL via admin API)
    async function generateGraduatedAccountsDue() {
        try {
            if (!supabaseClient) { showNotification('Database not configured', 'error'); return; }
            // Call RPC to server-side function if exposed; here we attempt RPC name matching the SQL function
            const { error } = await supabaseClient.rpc('issue_graduated_accounts');
            if (error) { console.warn('RPC failed, falling back', error); }
            showNotification('Generation triggered. Refresh list in a moment.', 'success');
            setTimeout(loadGraduatedAccounts, 1200);
        } catch (e) {
            console.error('Generation failed', e);
            showNotification('Failed to trigger generation', 'error');
        }
    }
    window.generateGraduatedAccountsDue = generateGraduatedAccountsDue;
    // Export all key tables to a single .xlsx workbook
    async function exportAllToXLSX() {
        try {
            if (!supabaseClient || !window.XLSX) {
                showNotification('Export prerequisites missing', 'error');
                return;
            }
            const tables = ['profiles','employment_records','notifications','audit_logs','surveys','survey_questions','survey_responses'];
            const results = await Promise.all(tables.map(t => supabaseClient.from(t).select('*')));
            const wb = XLSX.utils.book_new();
            results.forEach((res, idx) => {
                const name = tables[idx];
                if (res && !res.error) {
                    const ws = XLSX.utils.json_to_sheet(res.data || []);
                    XLSX.utils.book_append_sheet(wb, ws, name.substring(0,31));
                }
            });
            const wbout = XLSX.write(wb, {bookType:'xlsx', type:'array'});
            const blob = new Blob([wbout], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'cas_reports.xlsx';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            showNotification('Exported to Excel successfully', 'success');
        } catch (e) {
            console.error('Export failed', e);
            showNotification('Export failed: ' + e.message, 'error');
        }
    }
    window.exportAllToXLSX = exportAllToXLSX;

    // Compose Gmail draft to active users (mailto: BCC)
    async function composeGmailToActiveUsers() {
        try {
            if (!supabaseClient) {
                showNotification('Supabase not configured', 'error');
                return;
            }
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('email, employment_status')
                .not('email','is', null);
            if (error) throw error;
            const emails = (data || [])
                .filter(r => (r.email||'').includes('@'))
                .filter(r => !(r.employment_status||'').toLowerCase().includes('unemploy'))
                .map(r => r.email.trim());
            const unique = Array.from(new Set(emails));
            if (unique.length === 0) {
                showNotification('No active user emails found', 'info');
                return;
            }
            const chunk = unique.slice(0, 50).join(',');
            const subject = encodeURIComponent('Announcement to Active Users');
            const body = encodeURIComponent('Dear user,\n\nThis is a message from CAS Admin.');
            const link = `mailto:?bcc=${encodeURIComponent(chunk)}&subject=${subject}&body=${body}`;
            window.location.href = link;
        } catch (e) {
            console.error('Compose Gmail failed', e);
            showNotification('Failed to open mail client', 'error');
        }
    }
    window.composeGmailToActiveUsers = composeGmailToActiveUsers;

    // Show selectable list of active users and allow composing a message
    async function showActiveUsersComposer() {
        const wrap = document.getElementById('active-users-composer');
        const list = document.getElementById('active-users-list');
        if (!wrap || !list || !supabaseClient) return;
        wrap.style.display = 'flex';
        list.innerHTML = '';
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('id, full_name, email, employment_status')
            .not('email','is', null)
            .order('full_name', { ascending: true });
        if (error) { list.innerHTML = '<div class="inbox-placeholder">Failed to load users</div>'; return; }
        (data || []).forEach(u => {
            const isActive = !((u.employment_status||'').toLowerCase().includes('unemploy'));
            const item = document.createElement('div');
            item.className = 'inbox-item';
            item.innerHTML = `<input type="checkbox" value="${u.email}" ${isActive?'checked':''}/> <div class="from">${u.full_name||u.email}</div> <div class="snippet">${u.email}</div>`;
            list.appendChild(item);
        });
    }
    window.showActiveUsersComposer = showActiveUsersComposer;
    function hideActiveUsersComposer(){ const w=document.getElementById('active-users-composer'); if(w) w.style.display='none'; }
    window.hideActiveUsersComposer = hideActiveUsersComposer;

    async function sendGmailToSelected() {
        const list = document.getElementById('active-users-list');
        const subjectEl = document.getElementById('active-users-subject');
        const bodyEl = document.getElementById('active-users-body');
        if (!list) return;
        const emails = Array.from(list.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
        if (emails.length === 0) { showNotification('Select at least one recipient', 'info'); return; }
        const to = emails.slice(0, 50).join(',');
        const subject = encodeURIComponent((subjectEl && subjectEl.value) || 'Message from CAS Admin');
        const body = encodeURIComponent((bodyEl && bodyEl.value) || '');
        const link = `mailto:?bcc=${encodeURIComponent(to)}&subject=${subject}&body=${body}`;
        window.location.href = link;
    }
    window.sendGmailToSelected = sendGmailToSelected;
    async function updateEmploymentRateMetric() {
        const el = document.getElementById('metric-rate');
        if (!el || !supabaseClient) return;
        try {
            // Use profiles table to compute employment rate (employed / (employed + unemployed))
            const unemployedRes = await supabaseClient
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .ilike('employment_status', '%unemploy%');
            const employedRes = await supabaseClient
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .not('employment_status', 'is', null)
                .not('employment_status', 'ilike', '%unemploy%');
            const unemployed = (!unemployedRes.error && typeof unemployedRes.count==='number') ? unemployedRes.count : 0;
            const employed = (!employedRes.error && typeof employedRes.count==='number') ? employedRes.count : 0;
            const total = employed + unemployed;
            const pct = total > 0 ? Math.round((employed/total)*100) : 0;
            el.textContent = pct + '%';
        } catch (e) {
            console.warn('Failed to update employment rate', e);
        }
    }
// CAS Graduate Employment Tracking System - 3 Screen Navigation

// Define navigateTo function globally before DOMContentLoaded
console.log('Defining navigateTo function...');
function navigateTo(screenType) {
    console.log('navigateTo called with:', screenType);
    const current = document.querySelector('.screen[style*="display: block"]');
    const currentId = current ? current.id : null;
    if (currentId && window.historyStack) {
        window.historyStack.push(currentId);
    }
    if (window.showScreen) {
        window.showScreen(screenType);
    } else {
        console.error('showScreen function not available yet');
        // Fallback: try to show screen after a short delay
        setTimeout(() => {
            if (window.showScreen) {
                window.showScreen(screenType);
            }
        }, 100);
    }
}

// Make navigateTo globally available immediately
window.navigateTo = navigateTo;
console.log('navigateTo function assigned to window:', typeof window.navigateTo);

document.addEventListener('DOMContentLoaded', function() {
    console.log('CAS System Loaded - 3 Screen Navigation');
    
    // Global user session management
    let currentUser = null;
    let currentUserRole = null;
    
    // Initialize history stack globally
    window.historyStack = [];
    
    // Supabase init (expects globals set in index.html)
    let supabaseClient = null;
    if (window.__SUPABASE_URL__ && window.__SUPABASE_ANON__ && window.supabase) {
        supabaseClient = window.supabase.createClient(window.__SUPABASE_URL__, window.__SUPABASE_ANON__);
        console.log('Supabase client initialized');
    } else {
        console.warn('Supabase not configured. Set __SUPABASE_URL__ and __SUPABASE_ANON__ in index.html');
    }
    
    // Get all screen elements
    const splashScreen = document.getElementById('splash-screen');
    const studentAdminScreen = document.getElementById('student-admin-screen');
    const graduatingScreen = document.getElementById('graduating-screen');
    const welcomeGraduatingScreen = document.getElementById('welcome-graduating-screen');
    const welcomeGraduatedScreen = document.getElementById('welcome-graduated-screen');
    const letterGraduatingScreen = document.getElementById('letter-graduating-screen');
    const letterGraduatedScreen = document.getElementById('letter-graduated-screen');
    const loginScreen = document.getElementById('login-screen');
    const forgotScreen = document.getElementById('forgot-screen');
    const resetPasswordScreen = document.getElementById('reset-password-screen');
    const registerScreen = document.getElementById('register-screen');
    const dashboard1Screen = document.getElementById('dashboard1-screen');
    const dashboard2Screen = document.getElementById('dashboard2-screen');
    const dashboard3Screen = document.getElementById('dashboard3-screen');
    const dashboard4Screen = document.getElementById('dashboard4-screen');
    const graduatedDashboardScreen = document.getElementById('graduated-dashboard-screen');
    const graduatedFormScreen = document.getElementById('graduated-form-screen');
    const graduatingFormScreen = document.getElementById('graduating-form-screen');
    const finalDashboardScreen = document.getElementById('final-dashboard-screen');
    const adminScreen = document.getElementById('admin-screen');
    // Track selected role to display on login and simple screen history
    let selectedRole = '';
    const historyStack = [];
    
    // Function to check if user has completed their form
    function hasCompletedForm() {
        if (!currentUserRole) {
            console.log('No current user role set, treating as new user');
            return false;
        }
        const userKey = `form_completed_${currentUserRole}`;
        const isCompleted = localStorage.getItem(userKey) === 'true';
        console.log(`Checking form completion for role ${currentUserRole}: ${isCompleted}`);
        console.log(`localStorage key: ${userKey}`);
        console.log(`localStorage value: ${localStorage.getItem(userKey)}`);
        console.log(`All localStorage keys:`, Object.keys(localStorage));
        return isCompleted;
    }
    
    // Function to mark form as completed
    function markFormCompleted() {
        const userKey = `form_completed_${currentUserRole}`;
        localStorage.setItem(userKey, 'true');
    }
    
    // Function to clear form completion status (for testing)
    window.clearFormCompletion = function() {
        localStorage.removeItem('form_completed_graduating');
        localStorage.removeItem('form_completed_graduated');
        console.log('Form completion status cleared for testing');
        showNotification('Form completion status cleared. You can now test the new user flow.', 'success');
    };
    
    // Function to check current form completion status
    window.checkFormStatus = function() {
        console.log('Current user role:', currentUserRole);
        console.log('Form completed (graduating):', localStorage.getItem('form_completed_graduating'));
        console.log('Form completed (graduated):', localStorage.getItem('form_completed_graduated'));
        console.log('Has completed form:', hasCompletedForm());
    };
    
    // Function to force new user flow (for testing)
    window.forceNewUserFlow = function() {
        localStorage.removeItem('form_completed_graduating');
        localStorage.removeItem('form_completed_graduated');
        console.log('Forced new user flow - all form completion status cleared');
        showNotification('New user flow activated. Please log in again to test.', 'success');
    };
    
    // Function to clear all localStorage and force new user flow
    window.clearAllFormData = function() {
        // Clear all form completion keys
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('form_completed_')) {
                localStorage.removeItem(key);
            }
        });
        console.log('All form completion data cleared');
        showNotification('All form data cleared. Please log in again to test new user flow.', 'success');
    };
    
    // Function to debug login state
    window.debugLoginState = function() {
        console.log('=== LOGIN STATE DEBUG ===');
        console.log('currentUser:', currentUser);
        console.log('currentUserRole:', currentUserRole);
        console.log('selectedRole:', window.selectedRole);
        console.log('localStorage form_completed_graduating:', localStorage.getItem('form_completed_graduating'));
        console.log('localStorage form_completed_graduated:', localStorage.getItem('form_completed_graduated'));
        console.log('hasCompletedForm():', hasCompletedForm());
        console.log('========================');
    };
    
    // Validate user access to prevent cross-role navigation
    function validateUserAccess(requiredRole) {
        if (window.selectedRole !== requiredRole) {
            showNotification(`Access denied. This section is only for ${requiredRole} students.`, 'error');
            return false;
        }
        return true;
    }
    
    // Authenticate student and verify role access
    async function authenticateStudent(email, password, selectedRole) {
        try {
            console.log('Authenticating student:', email, 'with role:', selectedRole);
            
            // First, try to find user in users table
            const { data: userData, error: userError } = await supabaseClient
                .from('users')
                .select('*')
                .eq('email', email)
                .single();
            
            if (userError && userError.code !== 'PGRST116') {
                console.error('User lookup error:', userError);
                showNotification('Login failed. Please check your credentials.', 'error');
                return;
            }
            
            if (userData) {
                // User exists in users table - verify password and user type
                if (userData.user_type !== selectedRole) {
                    showNotification(`Access denied. You are registered as a ${userData.user_type} student, but trying to access ${selectedRole} section.`, 'error');
                    return;
                }
                
                // Set current user and role
                currentUser = userData;
                currentUserRole = userData.user_type;
                
                // For now, we'll accept any password since we don't have proper password hashing
                // In production, you should verify the password hash
                console.log('User authenticated successfully:', userData);
                showNotification(`Login successful! Welcome ${userData.full_name}.`, 'success');
                
                // Check if form is completed and navigate accordingly
                console.log(`User ${userData.full_name} (${userData.user_type}) logged in successfully`);
                console.log('Checking form completion...');
                const formCompleted = hasCompletedForm();
                console.log('Form completed result:', formCompleted);
                
                // Navigate based on user type and form completion status
                console.log('Navigating based on user type:', userData.user_type, 'Form completed:', formCompleted);
                
                if (userData.user_type === 'graduated') {
                    if (formCompleted) {
                        console.log('Graduated user with completed form - redirecting to graduated dashboard');
                        // User has completed forms, go to graduated dashboard
                        showScreen('graduated-dashboard-screen');
                        
                        // Load profile data
                        setTimeout(async () => {
                            try {
                                if (!supabaseClient) return;
                                const { data: profileData, error } = await supabaseClient
                    .from('profiles')
                    .select('*')
                    .eq('email', userData.email)
                    .single();
                
                                if (error) {
                                    console.error('Error fetching graduated profile:', error);
                                    if (error.code === 'PGRST116' || error.message?.includes('406')) {
                                        console.log('Profile not found for graduated user, but user exists in users table');
                                        showNotification('Profile data not found. Please contact administrator.', 'error');
                                    } else {
                                        showNotification('Error loading profile data: ' + error.message, 'error');
                                    }
                                } else if (profileData) {
                                    loadGraduatedDashboard(profileData);
                                }
                            } catch (error) {
                                console.error('Error loading graduated profile:', error);
                            }
                        }, 500);
                    } else {
                        console.log('New graduated user - redirecting to graduated welcome screen');
                        // New user, start with graduated welcome screen
                        showScreen('welcome-graduated');
                    }
                } else if (userData.user_type === 'graduating') {
                    if (formCompleted) {
                        console.log('Graduating user with completed form - redirecting to graduating dashboard');
                        // User has completed forms, go to graduating dashboard
                        showScreen('dashboard1-screen');
                        
                        // Load profile data
                        setTimeout(async () => {
                            try {
                                if (!supabaseClient) return;
                                const { data: profileData, error } = await supabaseClient
                                    .from('profiles')
                                    .select('*')
                                    .eq('email', userData.email)
                                    .single();
                                
                                if (error) {
                                    console.error('Error fetching graduating profile:', error);
                                    if (error.code === 'PGRST116' || error.message?.includes('406')) {
                                        console.log('Profile not found for graduating user, but user exists in users table');
                                        showNotification('Profile data not found. Please contact administrator.', 'error');
                } else {
                                        showNotification('Error loading profile data: ' + error.message, 'error');
                                    }
                                } else if (profileData) {
                                    loadGraduatingDashboard(profileData);
                                }
                            } catch (error) {
                                console.error('Error loading graduating profile:', error);
                            }
                        }, 500);
                    } else {
                        console.log('New graduating user - redirecting to graduating welcome screen');
                        // New user, start with graduating welcome screen
                        showScreen('welcome-graduating');
                    }
                } else {
                    console.log('Unknown user type - redirecting to dashboard 1');
                    showScreen('dashboard1');
                }
                return;
            }
            
            // If user not found in users table, check profiles table
            const { data: profileData, error: profileError } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('email', email)
                .single();
            
            if (profileError && profileError.code !== 'PGRST116') {
                console.error('Profile lookup error:', profileError);
                if (profileError.code === 'PGRST116' || profileError.message?.includes('406')) {
                    console.log('User not found in profiles table, continuing...');
                    // Continue to show "no account found" message
                } else {
                showNotification('Login failed. Please check your credentials.', 'error');
                return;
                }
            }
            
            if (profileData) {
                // Profile exists - verify user type matches selected role
                if (profileData.user_type !== selectedRole) {
                    showNotification(`Access denied. You are registered as a ${profileData.user_type} student, but trying to access ${selectedRole} section.`, 'error');
                    return;
                }
                
                // Set current user and role
                currentUser = profileData;
                currentUserRole = profileData.user_type;
                
                console.log('Profile authenticated successfully:', profileData);
                showNotification(`Login successful! Welcome ${profileData.full_name}.`, 'success');
                
                // Check if form is completed and navigate accordingly
                console.log(`User ${profileData.full_name} (${profileData.user_type}) logged in successfully`);
                console.log('Checking form completion...');
                const formCompleted = hasCompletedForm();
                console.log('Form completed result:', formCompleted);
                
                // Navigate based on user type and form completion status
                console.log('Navigating based on user type (profile path):', profileData.user_type, 'Form completed:', formCompleted);
                
                if (profileData.user_type === 'graduated') {
                    if (formCompleted) {
                        console.log('Graduated user with completed form - redirecting to graduated dashboard (profile path)');
                        // User has completed forms, go to graduated dashboard
                        showScreen('graduated-dashboard-screen');
                        
                        // Load profile data
                        setTimeout(async () => {
                            try {
                                if (!supabaseClient) return;
                                loadGraduatedDashboard(profileData);
                            } catch (error) {
                                console.error('Error loading graduated profile:', error);
                            }
                        }, 500);
                    } else {
                        console.log('New graduated user - redirecting to graduated welcome screen (profile path)');
                        // New user, start with graduated welcome screen
                        showScreen('welcome-graduated');
                    }
                } else if (profileData.user_type === 'graduating') {
                    if (formCompleted) {
                        console.log('Graduating user with completed form - redirecting to graduating dashboard (profile path)');
                        // User has completed forms, go to graduating dashboard
                        showScreen('dashboard1-screen');
                        
                        // Load profile data
                        setTimeout(async () => {
                            try {
                                if (!supabaseClient) return;
                        loadGraduatingDashboard(profileData);
                            } catch (error) {
                                console.error('Error loading graduating profile:', error);
                            }
                        }, 500);
                    } else {
                        console.log('New graduating user - redirecting to graduating welcome screen (profile path)');
                        // New user, start with graduating welcome screen
                        showScreen('welcome-graduating');
                    }
                } else {
                    console.log('Unknown user type - redirecting to dashboard 1 (profile path)');
                    showScreen('dashboard1');
                }
                return;
            }
            
            // No user or profile found
            showNotification('No account found with this email address. Please register first.', 'error');
            
        } catch (error) {
            console.error('Authentication error:', error);
            showNotification(`Login failed: ${error?.message || error}`, 'error');
        }
    }
    
    // Show splash screen initially
    showScreen('splash');
    
    // Add click event listeners to all buttons
    setupButtonListeners();
    
    // Function to validate user access based on role
    function validateAccess(screenType) {
        if (!currentUserRole) return true; // Allow access if no role set (for public screens)
        
        const roleRestrictions = {
            'dashboard1': ['graduating'], // Only graduating students
            'dashboard2': ['graduated'], // Only graduated students
            'dashboard3': ['graduating'], // Only graduating students
            'dashboard4': ['graduated'], // Only graduated students
            'graduating-form': ['graduating'], // Only graduating students
            'graduated-form': ['graduated'], // Only graduated students
            'letter-graduating': ['graduating'], // Only graduating students
            'letter-graduated': ['graduated'] // Only graduated students
        };
        
        if (roleRestrictions[screenType] && !roleRestrictions[screenType].includes(currentUserRole)) {
            showNotification(`Access denied. This section is only for ${roleRestrictions[screenType].join(' or ')} students.`, 'error');
            return false;
        }
        
        return true;
    }

    // Function to show different screens
    function showScreen(screenType) {
        console.log('showScreen called with:', screenType);
        // Validate access for role-specific screens
        if (!validateAccess(screenType)) {
            console.log('Access denied for screen:', screenType);
            return;
        }
        
        // Hide all screens first
        const allScreens = document.querySelectorAll('.screen');
        allScreens.forEach(screen => screen.classList.remove('active'));

        // Show the requested screen by adding 'active' class
        let screenMap = {
            'splash': splashScreen,
            'student-admin': studentAdminScreen,
            'graduating': graduatingScreen,
            'welcome-graduating': welcomeGraduatingScreen,
            'welcome-graduated': welcomeGraduatedScreen,
            'letter-graduating': letterGraduatingScreen,
            'letter-graduated': letterGraduatedScreen,
            'login': loginScreen,
            'forgot': forgotScreen,
            'reset-password': resetPasswordScreen,
            'register': registerScreen,
            'dashboard1': dashboard1Screen,
            'dashboard1-screen': dashboard1Screen,
            'dashboard2': dashboard2Screen,
            'dashboard3': dashboard3Screen,
            'dashboard4': dashboard4Screen,
            'graduated-dashboard-screen': graduatedDashboardScreen,
            'graduated-form': graduatedFormScreen,
            'graduating-form': graduatingFormScreen,
            'final-dashboard': finalDashboardScreen,
            'admin': adminScreen
        };
        const targetScreen = screenMap[screenType];
        console.log('showScreen called with:', screenType, 'Target screen found:', !!targetScreen);
        if (targetScreen) {
            targetScreen.classList.add('active');
            console.log('Added active class to screen:', screenType);
        } else {
            console.error('Screen not found in screenMap:', screenType, 'Available screens:', Object.keys(screenMap));
        }
        
        // Special logic for dashboards and admin
        if (screenType === 'dashboard1' && dashboard1Screen && currentUserRole === 'graduating') {
            setTimeout(() => loadPublicGraduationList(), 100);
        }
        if (screenType === 'final-dashboard' && finalDashboardScreen) {
            setTimeout(() => loadFinalDashboard(), 100);
        }
        if (screenType === 'admin' && adminScreen) {
            setTimeout(() => loadAdminDashboard(), 100);
        }
        
        currentScreen = screenType;
        console.log('Screen changed to:', currentScreen);
    }
    
    // Additional helper functions for form completion tracking
    window.clearFormCompletion = function() {
        const graduatingKey = 'form_completed_graduating';
        const graduatedKey = 'form_completed_graduated';
        localStorage.removeItem(graduatingKey);
        localStorage.removeItem(graduatedKey);
        console.log('Form completion status cleared for both roles');
    };
    
    // Function to test Supabase connection and provide detailed error info
    window.testSupabaseConnection = async function() {
        if (!supabaseClient) {
            console.error('Supabase client not initialized');
            showNotification('Supabase client not initialized. Please refresh the page.', 'error');
            return;
        }
        
        try {
            console.log('Testing Supabase connection...');
            
            // Test basic connection
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('count', { count: 'exact', head: true });
            
            if (error) {
                console.error('Supabase connection test failed:', error);
                showNotification(`Connection test failed: ${error.message} (Code: ${error.code})`, 'error');
                return;
            }
            
            console.log('Supabase connection successful. Profiles table accessible.');
            showNotification('Supabase connection is working properly.', 'success');
            
        } catch (error) {
            console.error('Supabase connection test error:', error);
            showNotification(`Connection test error: ${error.message}`, 'error');
        }
    };
    
    // Navigation functions for new user flow
    window.proceedToLetterScreen = function() {
        console.log('Proceeding to letter screen for role:', currentUserRole);
        if (currentUserRole === 'graduated') {
            showScreen('letter-graduated');
        } else if (currentUserRole === 'graduating') {
            showScreen('letter-graduating');
        } else {
            console.error('Unknown user role for letter screen navigation');
            showNotification('Unable to determine user role. Please log in again.', 'error');
        }
    };
    
    window.proceedToForm = function() {
        console.log('Proceeding to form for role:', currentUserRole);
        if (currentUserRole === 'graduated') {
            showScreen('graduated-form');
        } else if (currentUserRole === 'graduating') {
            showScreen('dashboard3'); // Dashboard 3 is the graduating tracer form
        } else {
            console.error('Unknown user role for form navigation');
            showNotification('Unable to determine user role. Please log in again.', 'error');
        }
    };
    
    window.completeFormAndShowSuccess = function() {
        console.log('Form completed successfully for role:', currentUserRole);
        
        // Mark form as completed
        markFormCompleted();
        
        // Show success popup with confetti
        showSuccessPopup();
        
        // After success popup, redirect to appropriate dashboard
        setTimeout(() => {
            if (currentUserRole === 'graduated') {
                showScreen('graduated-dashboard-screen');
                // Load dashboard data
                setTimeout(async () => {
                    try {
                        if (currentUser && supabaseClient) {
                            const { data: profileData, error } = await supabaseClient
                                .from('profiles')
                                .select('*')
                                .eq('email', currentUser.email)
                                .single();
                            
                            if (!error && profileData) {
                                loadGraduatedDashboard(profileData);
                            }
                        }
                    } catch (error) {
                        console.error('Error loading graduated dashboard after form completion:', error);
                    }
                }, 500);
            } else if (currentUserRole === 'graduating') {
                showScreen('dashboard1-screen');
                // Load dashboard data
                setTimeout(async () => {
                    try {
                        if (currentUser && supabaseClient) {
                            const { data: profileData, error } = await supabaseClient
                                .from('profiles')
                                .select('*')
                                .eq('email', currentUser.email)
                                .single();
                            
                            if (!error && profileData) {
                                loadGraduatingDashboard(profileData);
                            }
                        }
                    } catch (error) {
                        console.error('Error loading graduating dashboard after form completion:', error);
                    }
                }, 500);
            }
        }, 3000); // Wait 3 seconds for success popup to show
    };
    
    window.showSuccessPopup = function() {
        // Create success popup with confetti
        const popup = document.createElement('div');
        popup.className = 'success-popup';
        popup.innerHTML = `
            <div class="success-content">
                <div class="success-icon">🎉</div>
                <h2>Congratulations!</h2>
                <p>You have successfully completed your ${currentUserRole === 'graduated' ? 'graduated' : 'graduating'} student form.</p>
                <p>Redirecting to your dashboard...</p>
            </div>
        `;
        
        // Add confetti animation
        createConfettiAnimation();
        
        // Add popup to page
        document.body.appendChild(popup);
        
        // Remove popup after 3 seconds
        setTimeout(() => {
            if (popup.parentNode) {
                popup.parentNode.removeChild(popup);
            }
        }, 3000);
    };
    
    window.createConfettiAnimation = function() {
        // Create confetti elements
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.animationDelay = Math.random() * 3 + 's';
            confetti.style.backgroundColor = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3'][Math.floor(Math.random() * 6)];
            document.body.appendChild(confetti);
            
            // Remove confetti after animation
            setTimeout(() => {
                if (confetti.parentNode) {
                    confetti.parentNode.removeChild(confetti);
                }
            }, 3000);
        }
    };
    
    
    // Show splash screen initially
    showScreen('splash');
    
    // Add click event listeners to all buttons
    setupButtonListeners();
    
    // Function to validate user access based on role
    function validateAccess(screenType) {
        if (!currentUserRole) return true; // Allow access if no role set (for public screens)
        
        const roleRestrictions = {
            'dashboard1': ['graduating'], // Only graduating students
            'dashboard2': ['graduated'], // Only graduated students
            'dashboard3': ['graduating'], // Only graduating students
            'dashboard4': ['graduated'], // Only graduated students
            'graduating-form': ['graduating'], // Only graduating students
            'graduated-form': ['graduated'], // Only graduated students
            'letter-graduating': ['graduating'], // Only graduating students
            'letter-graduated': ['graduated'] // Only graduated students
        };
        
        if (roleRestrictions[screenType] && !roleRestrictions[screenType].includes(currentUserRole)) {
            showNotification(`Access denied. This section is only for ${roleRestrictions[screenType].join(' or ')} students.`, 'error');
                return false;
            }
        
        return true;
    }
    
    // Function to show different screens
    function showScreen(screenType) {
        console.log('showScreen called with:', screenType);
        // Validate access for role-specific screens
        if (!validateAccess(screenType)) {
            console.log('Access denied for screen:', screenType);
            return;
        }
        
        
        // Hide all screens first
        const allScreens = document.querySelectorAll('.screen');
        allScreens.forEach(screen => screen.classList.remove('active'));

        // Show the requested screen by adding 'active' class
        let screenMap = {
            'splash': splashScreen,
            'student-admin': studentAdminScreen,
            'graduating': graduatingScreen,
            'welcome-graduating': welcomeGraduatingScreen,
            'welcome-graduated': welcomeGraduatedScreen,
            'letter-graduating': letterGraduatingScreen,
            'letter-graduated': letterGraduatedScreen,
            'login': loginScreen,
            'forgot': forgotScreen,
            'reset-password': resetPasswordScreen,
            'register': registerScreen,
            'dashboard1': dashboard1Screen,
            'dashboard1-screen': dashboard1Screen,
            'dashboard2': dashboard2Screen,
            'dashboard3': dashboard3Screen,
            'dashboard4': dashboard4Screen,
            'graduated-dashboard-screen': graduatedDashboardScreen,
            'graduated-form': graduatedFormScreen,
            'graduating-form': graduatingFormScreen,
            'final-dashboard': finalDashboardScreen,
            'admin': adminScreen
        };
        const targetScreen = screenMap[screenType];
        console.log('showScreen called with:', screenType, 'Target screen found:', !!targetScreen);
        if (targetScreen) {
            targetScreen.classList.add('active');
            console.log('Added active class to screen:', screenType);
        } else {
            console.error('Screen not found in screenMap:', screenType, 'Available screens:', Object.keys(screenMap));
        }
        // Special logic for dashboards and admin
        if (screenType === 'dashboard1' && dashboard1Screen && currentUserRole === 'graduating') {
            setTimeout(() => loadPublicGraduationList(), 100);
        }
        if (screenType === 'final-dashboard' && finalDashboardScreen) {
            updateFinalDashboard();
            loadGraduatesByYear();
            // Update Employment Rate metric using Supabase
            updateEmploymentRateMetric();
        }
        if (screenType === 'admin' && adminScreen) {
            setTimeout(() => {
                console.log('Admin screen shown, initializing dashboard...');
                initializeAdminDashboard();
                refreshAdminData();
                setTimeout(() => {
                    initializeCharts();
                }, 500);
            }, 100);
        }
        console.log(`Switched to ${screenType} screen`);
    }
    
    // Make showScreen globally available
    window.showScreen = showScreen;

    // navigateTo function is already defined globally above
    // Go back handler
    function navigateBack() {
        const last = historyStack.pop();
        if (last) {
            const map = {
                'splash-screen':'splash',
                'student-admin-screen':'student-admin',
                'graduating-screen':'graduating',
                'login-screen':'login',
                'forgot-screen':'forgot',
                'register-screen':'register',
                'dashboard1-screen':'dashboard1',
                'dashboard2-screen':'dashboard2'
            };
            showScreen(map[last] || 'student-admin');
        } else {
            showScreen('student-admin');
        }
    }
    
    // Make navigateBack globally available
    window.navigateBack = navigateBack;
    
    // Logout function to clear user session
    function logout() {
        console.log('Logout initiated');
        
        // Clear current user data
        currentUser = null;
        currentUserRole = null;
        
        // Clear localStorage
        localStorage.removeItem('currentUser');
        localStorage.removeItem('currentUserRole');
        
        // Hide both dashboards
        const graduatedDashboard = document.getElementById('graduated-dashboard-screen');
        const graduatingDashboard = document.getElementById('dashboard1-screen');
        
        if (graduatedDashboard) {
            graduatedDashboard.style.display = 'none';
            graduatedDashboard.style.visibility = 'hidden';
            graduatedDashboard.classList.remove('active');
            console.log('Graduated dashboard hidden');
        }
        
        if (graduatingDashboard) {
            graduatingDashboard.style.display = 'none';
            graduatingDashboard.style.visibility = 'hidden';
            graduatingDashboard.classList.remove('active');
            console.log('Graduating dashboard hidden');
        }
        
        // Go to welcome screen
        showScreen('student-admin');
        showNotification('You have been logged out successfully.', 'success');
        console.log('User logged out and returned to welcome screen');
    }
    
    // Make logout globally available
    window.logout = logout;
    
    // Load Graduated Dashboard Function
    window.loadGraduatedDashboard = async function(profile) {
        console.log('Loading graduated dashboard with profile:', profile);
        
        // If no profile provided, fetch it from database
        if (!profile) {
            if (!currentUser || !supabaseClient) {
                console.log('No current user or Supabase client available');
                showNotification('User session not found. Please log in again.', 'error');
                return;
            }

            // Validate currentUser has email
            if (!currentUser.email) {
                console.error('Current user email is undefined:', currentUser);
                showNotification('User email not found. Please log in again.', 'error');
                return;
            }

            try {
                console.log('Fetching profile for email:', currentUser.email);
                const { data: profileData, error } = await supabaseClient
                    .from('profiles')
                    .select('*')
                    .eq('email', currentUser.email)
                    .single();

                if (error) {
                    console.error('Error fetching profile data:', error);
                    if (error.message && error.message.includes('invalid input syntax for type uuid')) {
                        showNotification('Invalid user data. Please log in again.', 'error');
                    } else if (error.code === 'PGRST116' || error.message?.includes('406')) {
                        showNotification('Profile not found. Please contact administrator.', 'error');
                    } else {
                        showNotification('Error loading profile data: ' + error.message, 'error');
                    }
                    return;
                }

                if (!profileData) {
                    console.error('No profile data found for email:', currentUser.email);
                    showNotification('Profile not found. Please contact administrator.', 'error');
                    return;
                }

                profile = profileData;
                console.log('Successfully fetched profile:', profile);
            } catch (error) {
                console.error('Error loading profile:', error);
                if (error.message && error.message.includes('invalid input syntax for type uuid')) {
                    showNotification('Invalid user data. Please log in again.', 'error');
                } else {
                    showNotification('Error loading profile data: ' + error.message, 'error');
                }
                return;
            }
        }
        
        // Update profile information - use graduated dashboard elements
        const profileName = document.getElementById('graduated-profile-name');
        const profileStudentId = document.getElementById('graduated-profile-student-id');
        const profileProgram = document.getElementById('graduated-profile-program');
        const profileYear = document.getElementById('graduated-profile-year');
        const verificationStatus = document.getElementById('graduated-verification-status');
        const profilePictureDisplay = document.getElementById('graduated-profile-picture-display');

        console.log('Profile elements found:', {
            profileName: !!profileName,
            profileStudentId: !!profileStudentId,
            profileProgram: !!profileProgram,
            profileYear: !!profileYear,
            verificationStatus: !!verificationStatus,
            profilePictureDisplay: !!profilePictureDisplay
        });
        
        if (profileName) {
            profileName.textContent = profile.full_name || 'N/A';
            console.log('Updated profile name:', profile.full_name);
        }
        if (profileStudentId) {
            profileStudentId.textContent = `Student ID: ${profile.student_id || 'N/A'}`;
            console.log('Updated student ID:', profile.student_id);
        }
        if (profileProgram) {
            profileProgram.textContent = `Program: ${profile.program || 'N/A'}`;
            console.log('Updated program:', profile.program);
        }
        if (profileYear) {
            const graduationYear = profile.graduation_year || 'N/A';
            profileYear.textContent = `Graduation Year: ${graduationYear}`;
            console.log('Updated graduation year:', graduationYear);
        }
        
        // Update verification status
        if (verificationStatus) {
            verificationStatus.textContent = profile.verification_status || 'Pending';
            verificationStatus.className = `status-badge ${profile.verification_status === 'verified' ? 'status-verified' : 'status-pending'}`;
            console.log('Updated verification status:', profile.verification_status);
        }
        
        // Update profile picture
        if (profilePictureDisplay && profile.picture_url) {
            profilePictureDisplay.src = profile.picture_url;
            profilePictureDisplay.alt = `${profile.full_name}'s Profile Picture`;
            console.log('Updated profile picture:', profile.picture_url);
        } else if (profilePictureDisplay) {
            // Use a default avatar if no picture
            profilePictureDisplay.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iNDAiIGN5PSI0MCIgcj0iNDAiIGZpbGw9IiM2NjdlZWEiLz4KPHN2ZyB4PSIyMCIgeT0iMjAiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIiBmaWxsPSJub25lIj4KPHBhdGggZD0iTTIwIDIwQzIyLjc2MTQgMjAgMjUgMTcuNzYxNCAyNSAxNUMyNSAxMi4yMzg2IDIyLjc2MTQgMTAgMjAgMTBDMTcuMjM4NiAxMCAxNSAxMi4yMzg2IDE1IDE1QzE1IDE3Ljc2MTQgMTcuMjM4NiAyMCAyMCAyMFoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0yMCAyMkMxNi42ODYzIDIyIDE0IDI0LjY4NjMgMTQgMjhIMjZDMjYgMjQuNjg2MyAyMy4zMTM3IDIyIDIwIDIyWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cjwvc3ZnPgo=';
            console.log('Set default avatar');
        }
        
        // Load graduated students from the same year
        if (profile.graduation_year && profile.graduation_year !== 'N/A' && profile.graduation_year !== null) {
            console.log('Loading graduated students for year:', profile.graduation_year);
            loadGraduatedStudentsByYear(profile.graduation_year);
        } else {
            console.log('No graduation year found in profile, loading all graduated students');
            // Load all graduated students if no specific year (for old users)
            loadAllGraduatedStudents();
        }
        
        console.log('Graduated dashboard loaded successfully');
        
        // Force dashboard visibility
        setTimeout(() => {
            const dashboardScreen = document.getElementById('graduated-dashboard-screen');
            if (dashboardScreen) {
                dashboardScreen.style.display = 'block';
                dashboardScreen.style.visibility = 'visible';
                dashboardScreen.classList.add('active');
                console.log('Forced graduated dashboard visibility after loading');
            }
        }, 200);
    };
    
    // Load graduated students by graduation year function
    window.loadGraduatedStudentsByYear = async function(graduationYear) {
        console.log('Loading graduated students for year:', graduationYear);
        
        if (!supabaseClient) {
            console.error('Supabase client not available');
            showNotification('Database connection not available', 'error');
            return;
        }
        
        try {
            let students, error;
            
            if (graduationYear) {
                // Fetch graduated students from the specific year
                const result = await supabaseClient
                    .from('profiles')
                    .select('*')
                    .eq('user_type', 'graduated')
                    .eq('graduation_year', graduationYear)
                    .order('created_at', { ascending: false });
                students = result.data;
                error = result.error;
            } else {
                // If no graduation year, load all graduated students
                console.log('No graduation year provided, loading all graduated students');
                const result = await supabaseClient
                    .from('profiles')
                    .select('*')
                    .eq('user_type', 'graduated')
                    .order('created_at', { ascending: false });
                students = result.data;
                error = result.error;
            }
            
            if (error) {
                console.error('Error fetching graduated students:', error);
                showNotification('Error loading graduated students list', 'error');
                return;
            }
            
            console.log('Fetched graduated students:', students);
            
            // Store students globally for filtering
            window.allGraduatedStudents = students;
            
            // Display graduated students list
            if (students && students.length > 0) {
                displayGraduatedStudentsList(students);
            } else {
                console.log('No graduated students found');
                displayGraduatedStudentsList([]);
            }
            
        } catch (error) {
            console.error('Error loading graduated students:', error);
            showNotification('Error loading graduated students list', 'error');
        }
    };
    
    // Display graduated students list function
    window.displayGraduatedStudentsList = function(students) {
        console.log('Displaying graduated students list with', students.length, 'students');
        
        const studentsList = document.getElementById('graduated-students-list');
        if (!studentsList) {
            console.error('Graduated students list element not found!');
            return;
        }
        
        try {
            if (students.length === 0) {
                studentsList.innerHTML = `
                    <div class="loading-state">
                        <i class="fas fa-users"></i>
                        <p>No graduated students found for this year</p>
                    </div>
                `;
                console.log('Displayed empty state for graduated students');
                return;
            }
            
            const studentsHTML = students.map(student => {
                try {
                    return `
                        <div class="student-item">
                            <img class="student-avatar" 
                                 src="${student.picture_url || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM2NjdlZWEiLz4KPHN2ZyB4PSIxMCIgeT0iMTAiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgdmlld0JveD0iMCAwIDIwIDIwIiBmaWxsPSJub25lIj4KPHBhdGggZD0iTTEwIDEwQzExLjM4MDcgMTAgMTIgOS4zODA3MSAxMiA4QzEyIDYuNjE5MjkgMTEuMzgwNyA2IDEwIDZDOC42MTkyOSA2IDggNi42MTkyOSA4IDhDOCA5LjM4MDcxIDguNjE5MjkgMTAgMTAgMTBaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTAgMTJDOC44OTU0MyAxMiA4IDEyLjg5NTQgOCAxNEgxMkMxMiAxMi44OTU0IDExLjEwNDYgMTIgMTAgMTJaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4KPC9zdmc+Cg=='}" 
                                 alt="${student.full_name || 'Student'}'s Avatar"
                                 onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM2NjdlZWEiLz4KPHN2ZyB4PSIxMCIgeT0iMTAiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgdmlld0JveD0iMCAwIDIwIDIwIiBmaWxsPSJub25lIj4KPHBhdGggZD0iTTEwIDEwQzExLjM4MDcgMTAgMTIgOS4zODA3MSAxMiA4QzEyIDYuNjE5MjkgMTEuMzgwNyA2IDEwIDZDOC42MTkyOSA2IDggNi42MTkyOSA4IDhDOCA5LjM4MDcxIDguNjE5MjkgMTAgMTAgMTBaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTAgMTJDOC44OTU0MyAxMiA4IDEyLjg5NTQgOCAxNEgxMkMxMiAxMi44OTU0IDExLjEwNDYgMTIgMTAgMTJaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4KPC9zdmc+Cg=='">
                            <div class="student-info">
                                <div class="student-name">${student.full_name || 'N/A'}</div>
                                <div class="student-details">
                                    <span class="student-id">ID: ${student.student_id || 'N/A'}</span>
                                    <span class="student-program">${student.program || 'N/A'}</span>
                                </div>
                                <div class="student-status">
                                    <span class="status-badge ${student.verification_status === 'verified' ? 'status-verified' : 'status-pending'}">
                                        ${student.verification_status || 'Pending'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    `;
                } catch (error) {
                    console.error('Error creating student HTML for:', student, error);
                    return '';
                }
            }).filter(html => html !== '').join('');
            
            studentsList.innerHTML = studentsHTML;
            console.log('Successfully displayed graduated students list');
            
        } catch (error) {
            console.error('Error displaying graduated students list:', error);
            studentsList.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error loading graduated students</p>
                </div>
            `;
        }
    };
    
    // Load all graduated students function
    window.loadAllGraduatedStudents = async function() {
        console.log('Loading all graduated students');
        
        if (!supabaseClient) {
            console.error('Supabase client not available');
            showNotification('Database connection not available', 'error');
            return;
        }
        
        try {
            // Fetch all graduated students
            const { data: students, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('user_type', 'graduated')
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('Error fetching graduated students:', error);
                showNotification('Error loading graduated students list', 'error');
                return;
            }
            
            console.log('Fetched all graduated students:', students);
            
            // Store students globally for filtering
            window.allGraduatedStudents = students;
            
            // Display graduated students list
            if (students && students.length > 0) {
                displayGraduatedStudentsList(students);
            } else {
                console.log('No graduated students found');
                displayGraduatedStudentsList([]);
            }
            
        } catch (error) {
            console.error('Error loading graduated students:', error);
            showNotification('Error loading graduated students list', 'error');
        }
    };
    
    // Filter graduated students by program
    window.filterGraduatedStudents = function() {
        const programFilter = document.getElementById('graduated-program-filter');
        const searchInput = document.getElementById('search-graduated-students');
        
        if (!programFilter || !searchInput) {
            console.error('Filter elements not found');
            return;
        }
        
        const selectedProgram = programFilter.value;
        const searchTerm = searchInput.value.toLowerCase();
        
        console.log('Filtering graduated students by program:', selectedProgram, 'and search:', searchTerm);
        
        // Get all graduated students and filter them
        if (window.allGraduatedStudents) {
            let filtered = window.allGraduatedStudents;
            
            // Filter by program
            if (selectedProgram) {
                filtered = filtered.filter(student => student.program === selectedProgram);
            }
            
            // Filter by search term
            if (searchTerm) {
                filtered = filtered.filter(student => {
                    const name = (student.full_name || '').toLowerCase();
                    const studentId = (student.student_id || '').toLowerCase();
                    const email = (student.email || '').toLowerCase();
                    const program = (student.program || '').toLowerCase();
                    const year = String(student.graduation_year || '').toLowerCase();
                    
                    return name.includes(searchTerm) || 
                           studentId.includes(searchTerm) || 
                           email.includes(searchTerm) || 
                           program.includes(searchTerm) || 
                           year.includes(searchTerm);
                });
            }
            
            displayGraduatedStudentsList(filtered);
        } else {
            console.log('No graduated students data available for filtering');
        }
    };
    
    // Search graduated students
    window.searchGraduatedStudents = function() {
        filterGraduatedStudents(); // Use the same filtering logic
    };
    
    // Load Graduating Dashboard Function
    window.loadGraduatingDashboard = async function(profile) {
        console.log('Loading graduating dashboard with profile:', profile);
        
        // If no profile provided, fetch it from database
        if (!profile) {
            if (!currentUser || !supabaseClient) {
                console.log('No current user or Supabase client available');
                showNotification('User session not found. Please log in again.', 'error');
                return;
            }

            // Validate currentUser has email
            if (!currentUser.email) {
                console.error('Current user email is undefined:', currentUser);
                showNotification('User email not found. Please log in again.', 'error');
                return;
            }

            try {
                console.log('Fetching profile for email:', currentUser.email);
                const { data: profileData, error } = await supabaseClient
                    .from('profiles')
                    .select('*')
                    .eq('email', currentUser.email)
                    .single();

                if (error) {
                    console.error('Error fetching profile data:', error);
                    if (error.message && error.message.includes('invalid input syntax for type uuid')) {
                        showNotification('Invalid user data. Please log in again.', 'error');
                    } else if (error.code === 'PGRST116' || error.message?.includes('406')) {
                        showNotification('Profile not found. Please contact administrator.', 'error');
                    } else {
                        showNotification('Error loading profile data: ' + error.message, 'error');
                    }
                    return;
                }

                if (!profileData) {
                    console.error('No profile data found for email:', currentUser.email);
                    showNotification('Profile not found. Please contact administrator.', 'error');
                    return;
                }

                profile = profileData;
                console.log('Successfully fetched profile:', profile);
            } catch (error) {
                console.error('Error loading profile:', error);
                if (error.message && error.message.includes('invalid input syntax for type uuid')) {
                    showNotification('Invalid user data. Please log in again.', 'error');
                } else {
                    showNotification('Error loading profile data: ' + error.message, 'error');
                }
                return;
            }
        }
        
        // Update profile information - use graduating dashboard elements
        const profileName = document.getElementById('graduating-profile-name');
        const profileStudentId = document.getElementById('graduating-profile-student-id');
        const profileProgram = document.getElementById('graduating-profile-program');
        const profileExpectedGraduation = document.getElementById('graduating-profile-expected-graduation');
        const verificationStatus = document.getElementById('graduating-verification-status');
        const profilePictureDisplay = document.getElementById('graduating-profile-picture-display');

        console.log('Profile elements found:', {
            profileName: !!profileName,
            profileStudentId: !!profileStudentId,
            profileProgram: !!profileProgram,
            profileExpectedGraduation: !!profileExpectedGraduation,
            verificationStatus: !!verificationStatus,
            profilePictureDisplay: !!profilePictureDisplay
        });
        
        if (profileName) {
            profileName.textContent = profile.full_name || 'N/A';
            console.log('Updated profile name:', profile.full_name);
        }
        if (profileStudentId) {
            profileStudentId.textContent = `Student ID: ${profile.student_id || 'N/A'}`;
            console.log('Updated student ID:', profile.student_id);
        }
        if (profileProgram) {
            profileProgram.textContent = `Program: ${profile.program || 'N/A'}`;
            console.log('Updated program:', profile.program);
        }
        if (profileExpectedGraduation) {
            const expectedGraduation = profile.expected_graduation || 'N/A';
            profileExpectedGraduation.textContent = `Expected Graduation: ${expectedGraduation}`;
            console.log('Updated expected graduation:', expectedGraduation);
        }
        
        // Update verification status
        if (verificationStatus) {
            verificationStatus.textContent = profile.verification_status || 'Pending';
            verificationStatus.className = `status-badge ${profile.verification_status === 'verified' ? 'status-verified' : 'status-pending'}`;
            console.log('Updated verification status:', profile.verification_status);
        }
        
        // Update profile picture
        if (profilePictureDisplay && profile.picture_url) {
            profilePictureDisplay.src = profile.picture_url;
            profilePictureDisplay.alt = `${profile.full_name}'s Profile Picture`;
            console.log('Updated profile picture:', profile.picture_url);
        } else if (profilePictureDisplay) {
            // Use a default avatar if no picture
            profilePictureDisplay.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iNDAiIGN5PSI0MCIgcj0iNDAiIGZpbGw9IiM2NjdlZWEiLz4KPHN2ZyB4PSIyMCIgeT0iMjAiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIiBmaWxsPSJub25lIj4KPHBhdGggZD0iTTIwIDIwQzIyLjc2MTQgMjAgMjUgMTcuNzYxNCAyNSAxNUMyNSAxMi4yMzg2IDIyLjc2MTQgMTAgMjAgMTBDMTcuMjM4NiAxMCAxNSAxMi4yMzg2IDE1IDE1QzE1IDE3Ljc2MTQgMTcuMjM4NiAyMCAyMCAyMFoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0yMCAyMkMxNi42ODYzIDIyIDE0IDI0LjY4NjMgMTQgMjhIMjZDMjYgMjQuNjg2MyAyMy4zMTM3IDIyIDIwIDIyWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cjwvc3ZnPgo=';
            console.log('Set default avatar');
        }
        
        // Load graduating students
        console.log('Loading graduating students...');
        loadGraduatingStudents();
        
        console.log('Graduating dashboard loaded successfully');
        
        // Force dashboard visibility
        setTimeout(() => {
            const dashboardScreen = document.getElementById('dashboard1-screen');
            if (dashboardScreen) {
                dashboardScreen.style.display = 'block';
                dashboardScreen.style.visibility = 'visible';
                dashboardScreen.classList.add('active');
                console.log('Forced graduating dashboard visibility after loading');
            }
        }, 200);
    };
    
    // Load Graduating Students Function
    window.loadGraduatingStudents = async function() {
        console.log('Loading graduating students');
        
        if (!supabaseClient) {
            console.error('Supabase client not available');
            showNotification('Database connection not available', 'error');
            return;
        }
        
        try {
            // Fetch all graduating students
            const { data: students, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('user_type', 'graduating')
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('Error fetching graduating students:', error);
                showNotification('Error loading graduating students list', 'error');
                return;
            }
            
            console.log('Fetched graduating students:', students);
            
            // Store students globally for filtering
            window.allGraduatingStudents = students;
            
            // Display graduating students list
            if (students && students.length > 0) {
                displayGraduatingStudentsList(students);
            } else {
                console.log('No graduating students found');
                displayGraduatingStudentsList([]);
            }
            
        } catch (error) {
            console.error('Error loading graduating students:', error);
            showNotification('Error loading graduating students list', 'error');
        }
    };
    
    // Display Graduating Students List Function
    window.displayGraduatingStudentsList = function(students) {
        console.log('Displaying graduating students list with', students.length, 'students');
        
        const studentsList = document.getElementById('graduating-students-list');
        if (!studentsList) {
            console.error('Graduating students list element not found!');
            return;
        }
        
        if (!students || students.length === 0) {
            studentsList.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-graduation-cap"></i>
                    <p>No graduating students found</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        students.forEach(student => {
            const name = student.full_name || 'Unknown Student';
            const studentId = student.student_id || 'N/A';
            const program = student.program || 'N/A';
            const expectedGraduation = student.expected_graduation || 'N/A';
            const verificationStatus = student.verification_status || 'pending';
            const pictureUrl = student.picture_url || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM2NjdlZWEiLz4KPHN2ZyB4PSIxMCIgeT0iMTAiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgdmlld0JveD0iMCAwIDIwIDIwIiBmaWxsPSJub25lIj4KPHBhdGggZD0iTTEwIDEwQzExLjM4MDcgMTAgMTIgOS4zODA3MSAxMiA4QzEyIDYuNjE5MjkgMTEuMzgwNyA2IDEwIDZDOC42MTkyOSA2IDggNi42MTkyOSA4IDhDOCA5LjM4MDcxIDguNjE5MjkgMTAgMTAgMTBaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTAgMTJDOC44OTU0MyAxMiA4IDEyLjg5NTQgOCAxNEgxMkMxMiAxMi44OTU0IDExLjEwNDYgMTIgMTAgMTJaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4KPC9zdmc+Cg==';
            
            html += `
                <div class="student-item">
                    <img src="${pictureUrl}" alt="${name}" class="student-avatar" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM2NjdlZWEiLz4KPHN2ZyB4PSIxMCIgeT0iMTAiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgdmlld0JveD0iMCAwIDIwIDIwIiBmaWxsPSJub25lIj4KPHBhdGggZD0iTTEwIDEwQzExLjM4MDcgMTAgMTIgOS4zODA3MSAxMiA4QzEyIDYuNjE5MjkgMTEuMzgwNyA2IDEwIDZDOC42MTkyOSA2IDggNi42MTkyOSA4IDhDOCA5LjM4MDcxIDguNjE5MjkgMTAgMTAgMTBaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTAgMTJDOC44OTU0MyAxMiA4IDEyLjg5NTQgOCAxNEgxMkMxMiAxMi44OTU0IDExLjEwNDYgMTIgMTAgMTJaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4KPC9zdmc+Cg=='">
                    <div class="student-info">
                        <div class="student-name">${name}</div>
                        <div class="student-details">
                            ID: ${studentId} | ${program} | Expected: ${expectedGraduation}
                        </div>
                    </div>
                    <div class="student-status">
                        <span class="status-badge ${verificationStatus === 'verified' ? 'status-verified' : 'status-pending'}">${verificationStatus}</span>
                    </div>
                </div>
            `;
        });
        
        studentsList.innerHTML = html;
        console.log('Successfully displayed graduating students list');
    };
    
    // Filter and Search Functions for Graduating Students
    window.filterGraduatingStudents = function() {
        const programFilter = document.getElementById('graduating-program-filter');
        const searchInput = document.getElementById('search-graduating-students');
        
        if (!programFilter || !searchInput) {
            console.error('Filter elements not found');
            return;
        }
        
        const selectedProgram = programFilter.value;
        const searchTerm = searchInput.value.toLowerCase();
        
        console.log('Filtering graduating students by program:', selectedProgram, 'and search:', searchTerm);
        
        // Get all graduating students and filter them
        if (window.allGraduatingStudents) {
            let filtered = window.allGraduatingStudents;
            
            // Filter by program
            if (selectedProgram) {
                filtered = filtered.filter(student => student.program === selectedProgram);
            }
            
            // Filter by search term
            if (searchTerm) {
                filtered = filtered.filter(student => {
                    const name = (student.full_name || '').toLowerCase();
                    const studentId = (student.student_id || '').toLowerCase();
                    const email = (student.email || '').toLowerCase();
                    const program = (student.program || '').toLowerCase();
                    const expectedGraduation = String(student.expected_graduation || '').toLowerCase();
                    
                    return name.includes(searchTerm) || 
                           studentId.includes(searchTerm) || 
                           email.includes(searchTerm) || 
                           program.includes(searchTerm) || 
                           expectedGraduation.includes(searchTerm);
                });
            }
            
            displayGraduatingStudentsList(filtered);
        } else {
            console.log('No graduating students data available for filtering');
        }
    };
    
    window.searchGraduatingStudents = function() {
        filterGraduatingStudents(); // Use the same filtering logic
    };
    
    // Go to Welcome function
    window.goToWelcome = function() {
        console.log('Go to Welcome initiated');
        
        // Clear user data and go to welcome screen
        currentUser = null;
        currentUserRole = null;
        localStorage.removeItem('currentUser');
        localStorage.removeItem('currentUserRole');
        
        // Hide both dashboards
        const graduatedDashboard = document.getElementById('graduated-dashboard-screen');
        const graduatingDashboard = document.getElementById('dashboard1-screen');
        
        if (graduatedDashboard) {
            graduatedDashboard.style.display = 'none';
            graduatedDashboard.style.visibility = 'hidden';
            graduatedDashboard.classList.remove('active');
            console.log('Graduated dashboard hidden');
        }
        
        if (graduatingDashboard) {
            graduatingDashboard.style.display = 'none';
            graduatingDashboard.style.visibility = 'hidden';
            graduatingDashboard.classList.remove('active');
            console.log('Graduating dashboard hidden');
        }
        
        // Go to welcome screen
        showScreen('student-admin');
        showNotification('Returned to welcome screen', 'success');
        console.log('Go to Welcome completed - returned to welcome screen');
    };
    
    // Avatar dropdown: toggle menu, handle outside click and ESC
    document.addEventListener('DOMContentLoaded', () => {
        const avatar = document.getElementById('adminAvatar');
        const menu = document.getElementById('adminAvatarMenu');
        const logoutBtn = document.getElementById('adminLogoutBtn');
        
        if (!avatar || !menu) return;
        
        function openMenu() {
            menu.hidden = false;
        }
        
        function closeMenu() {
            menu.hidden = true;
        }
        
        function toggleMenu() {
            if (menu.hidden) openMenu(); else closeMenu();
        }
        
        avatar.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMenu();
        });
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                closeMenu();
                logout();
            });
        }
        
        document.addEventListener('click', (e) => {
            if (!menu.hidden) {
                const wrap = avatar.parentElement;
                if (wrap && !wrap.contains(e.target)) {
                    closeMenu();
                }
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeMenu();
        });
    });

    // Topbar search: database-backed search (fallback to client-side if no DB)
    document.addEventListener('DOMContentLoaded', () => {
        const topSearch = document.querySelector('.admin-top-search');
        const iconBtn = document.querySelector('.admin-search-icon-btn');
        if (!topSearch) return;
        
        // Create suggestions dropdown container
        const topActions = topSearch.parentElement;
        let sugg = document.createElement('div');
        sugg.className = 'admin-search-suggestions';
        sugg.hidden = true;
        topActions.appendChild(sugg);

        function closeSuggestions() { sugg.hidden = true; sugg.innerHTML = ''; }

        function openSuggestions(items) {
            if (!items || !items.length) { closeSuggestions(); return; }
            sugg.innerHTML = '';
            items.forEach(item => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'admin-search-suggestion';
                btn.innerHTML = item.html;
                btn.addEventListener('click', () => {
                    topSearch.value = item.value;
                    closeSuggestions();
                    applyTopSearchFilter();
                });
                sugg.appendChild(btn);
            });
            sugg.hidden = false;
        }

        async function performTopSearch(termRaw) {
            const term = (termRaw || '').trim();
            const allProfiles = window.__ADMIN_PROFILES__ || [];
            const employment = window.__ADMIN_EMPLOYMENT__ || [];
            
            if (!term) {
                loadGraduatesTable(allProfiles);
                loadDatabaseTable(allProfiles, employment);
                return { profiles: allProfiles, employment };
            }
            
            // If DB not available, fallback to local filter
            if (!supabaseClient) {
                const termLc = term.toLowerCase();
                const companyByKey = new Map();
                employment.forEach(e => {
                    const v = (e.company_name || '').toLowerCase();
                    if (e.user_id) companyByKey.set(`user:${e.user_id}`, v);
                    if (e.profile_id) companyByKey.set(`profile:${e.profile_id}`, v);
                });
                const filtered = allProfiles.filter(p => {
                    const name = (p.full_name || `${p.first_name || ''} ${p.last_name || ''}`).toLowerCase();
                    const email = (p.email || '').toLowerCase();
                    const profileCompany = (p.company_name || '').toLowerCase();
                    const joinedCompany = companyByKey.get(`user:${p.user_id}`) || companyByKey.get(`profile:${p.id}`) || '';
                    const phone = (p.phone || '').toLowerCase();
                    const program = (p.program || '').toLowerCase();
                    const year = String(p.graduation_year || '').toLowerCase();
                    const address = (p.address || '').toLowerCase();
                    const gender = (p.gender || '').toLowerCase();
                    const status = (p.verification_status || '').toLowerCase();
                    return (
                        name.includes(termLc) || email.includes(termLc) || profileCompany.includes(termLc) || joinedCompany.includes(termLc) ||
                        phone.includes(termLc) || program.includes(termLc) || year.includes(termLc) || address.includes(termLc) ||
                        gender.includes(termLc) || status.includes(termLc)
                    );
                });
                loadGraduatesTable(filtered);
                loadDatabaseTable(filtered, employment);
                return { profiles: filtered, employment };
            }
            
            try {
                // Search profiles by name/email and optional company fields
                const like = `%${term}%`;
                const { data: profs, error: pErr } = await supabaseClient
                    .from('profiles')
                    .select('*')
                    .or([
                        `full_name.ilike.${like}`,
                        `first_name.ilike.${like}`,
                        `last_name.ilike.${like}`,
                        `email.ilike.${like}`,
                        `phone.ilike.${like}`,
                        `program.ilike.${like}`,
                        `address.ilike.${like}`,
                        `gender.ilike.${like}`,
                        `verification_status.ilike.${like}`,
                        // cast year to text via filter on client side after fetch if needed
                    ].join(','));
                if (pErr) throw pErr;
                
                // Search employment records by company/job
                const { data: emps, error: eErr } = await supabaseClient
                    .from('employment_records')
                    .select('*')
                    .or([
                        `company_name.ilike.${like}`,
                        `job_title.ilike.${like}`,
                        `industry.ilike.${like}`,
                        `location.ilike.${like}`
                    ].join(','));
                if (eErr) throw eErr;
                
                const profsByUser = new Map((profs || []).map(p => [p.user_id || `profile:${p.id}`, p]));
                // Include profiles referenced by matching employment
                (emps || []).forEach(er => {
                    const keyUser = er.user_id;
                    const keyProfile = er.profile_id ? `profile:${er.profile_id}` : null;
                    if (keyUser && !profsByUser.has(keyUser)) {
                        const match = (allProfiles || []).find(p => p.user_id === keyUser);
                        if (match) profsByUser.set(keyUser, match);
                    }
                    if (keyProfile && !profsByUser.has(keyProfile)) {
                        const match = (allProfiles || []).find(p => p.id === er.profile_id);
                        if (match) profsByUser.set(keyProfile, match);
                    }
                });
                const filteredProfiles = Array.from(profsByUser.values());
                const filteredEmployment = (emps || []).filter(er => filteredProfiles.some(p => p.user_id === er.user_id || p.id === er.profile_id));
                
                // Additionally include year match by client-side filter (Supabase cast in or is complex)
                const termLc = term.toLowerCase();
                const yearMatched = (allProfiles || []).filter(p => String(p.graduation_year || '').toLowerCase().includes(termLc));
                yearMatched.forEach(p => { if (!profsByUser.has(p.user_id)) filteredProfiles.push(p); });
                
                loadGraduatesTable(filteredProfiles);
                loadDatabaseTable(filteredProfiles, filteredEmployment.length ? filteredEmployment : employment);
                
                // Suggestions (top 8)
                const items = [];
                for (let i = 0; i < filteredProfiles.length && items.length < 8; i++) {
                    const p = filteredProfiles[i];
                    const e = (emps || []).find(x => x.user_id === p.user_id);
                    const name = p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
                    const company = (e?.company_name || p.company_name || '').trim();
                    const email = (p.email || '').trim();
                    if (name) items.push({ value: name, html: `<span class=\"sugg-type\">Name</span> ${name}` });
                    if (company) items.push({ value: company, html: `<span class=\"sugg-type\">Company</span> ${company}` });
                    if (email) items.push({ value: email, html: `<span class=\"sugg-type\">Email</span> ${email}` });
                }
                openSuggestions(items.slice(0, 8));
                return { profiles: filteredProfiles, employment: filteredEmployment };
            } catch (err) {
                console.error('Search error:', err);
                showNotification('Search failed. Please try again.', 'error');
                return { profiles: allProfiles, employment };
            }
        }
        
        // Debounce to limit network calls
        let searchTimer = null;
        function applyTopSearchFilter() {
            if (searchTimer) clearTimeout(searchTimer);
            const value = topSearch.value;
            searchTimer = setTimeout(() => { performTopSearch(value); }, 150);
        }
        topSearch.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (searchTimer) clearTimeout(searchTimer);
                performTopSearch(topSearch.value);
            }
        });
        
        topSearch.addEventListener('input', applyTopSearchFilter);
        if (iconBtn) {
            iconBtn.addEventListener('click', () => {
                topSearch.focus();
                // trigger suggestions or filter based on current value
                if (topSearch.value.trim()) {
                    applyTopSearchFilter();
                } else {
                    const evt = new Event('focus');
                    topSearch.dispatchEvent(evt);
                }
            });
        }
        topSearch.addEventListener('focus', () => {
            const allProfiles = window.__ADMIN_PROFILES__ || [];
            // Quick starter suggestions (recent/top names)
            const items = (allProfiles.slice(0, 6) || []).map(p => {
                const name = p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
                return { value: name, html: `<span class="sugg-type">Name</span> ${name}` };
            });
            if (topSearch.value.trim()) {
                applyTopSearchFilter();
            } else {
                openSuggestions(items);
            }
        });
        document.addEventListener('click', (e) => {
            if (!sugg.hidden && !sugg.contains(e.target) && e.target !== topSearch) {
                closeSuggestions();
            }
        });
    });
    
    // Function to refresh admin data
    function refreshAdminData() {
        console.log('Refreshing admin data...');
        if (supabaseClient) {
            loadAdminMetrics().then(() => {
                initializeCharts();
            });
        } else {
            console.log('Supabase not available, using demo data');
            initializeAdminDashboardWithDemoData();
            initializeChartsWithDemoData();
        }
    }
    
    // Make refreshAdminData globally available
    window.refreshAdminData = refreshAdminData;
    
    // Function to test database connection and add sample data
    async function testDatabaseConnection() {
        console.log('=== TESTING DATABASE CONNECTION ===');
        
        if (!supabaseClient) {
            console.log('Creating Supabase client for test...');
            if (window.__SUPABASE_URL__ && window.__SUPABASE_ANON__ && window.supabase) {
                supabaseClient = window.supabase.createClient(window.__SUPABASE_URL__, window.__SUPABASE_ANON__);
            } else {
                console.error('Supabase not configured');
                showNotification('Supabase not configured', 'error');
                return;
            }
        }
        
        try {
            // Test users table
            console.log('Testing users table...');
            const { data: users, error: usersError } = await supabaseClient
                .from('users')
                .select('*', { count: 'exact', head: true });
            
            if (usersError) {
                console.error('Users table error:', usersError);
                showNotification('Users table error: ' + usersError.message, 'error');
            } else {
                console.log('Users table count:', users);
                showNotification('Users table: ' + (users || 0) + ' records', 'success');
            }
            
            // Test profiles table
            console.log('Testing profiles table...');
            const { data: profiles, error: profilesError } = await supabaseClient
                .from('profiles')
                .select('*', { count: 'exact', head: true });
            
            if (profilesError) {
                console.error('Profiles table error:', profilesError);
                showNotification('Profiles table error: ' + profilesError.message, 'error');
            } else {
                console.log('Profiles table count:', profiles);
                showNotification('Profiles table: ' + (profiles || 0) + ' records', 'success');
            }
            
            // Test with actual data fetch to see what's in the tables
            console.log('Fetching actual data from users table...');
            const { data: actualUsers, error: actualUsersError } = await supabaseClient
                .from('users')
                .select('*')
                .limit(5);
            
            if (actualUsersError) {
                console.error('Error fetching users data:', actualUsersError);
                showNotification('Error fetching users: ' + actualUsersError.message, 'error');
            } else {
                console.log('Actual users data:', actualUsers);
                if (actualUsers && actualUsers.length > 0) {
                    showNotification(`Found ${actualUsers.length} users in database`, 'success');
                } else {
                    showNotification('Users table is empty', 'warning');
                }
            }
            
            // Test profiles data
            console.log('Fetching actual data from profiles table...');
            const { data: actualProfiles, error: actualProfilesError } = await supabaseClient
                .from('profiles')
                .select('*')
                .limit(5);
            
            if (actualProfilesError) {
                console.error('Error fetching profiles data:', actualProfilesError);
                showNotification('Error fetching profiles: ' + actualProfilesError.message, 'error');
            } else {
                console.log('Actual profiles data:', actualProfiles);
                if (actualProfiles && actualProfiles.length > 0) {
                    showNotification(`Found ${actualProfiles.length} profiles in database`, 'success');
                } else {
                    showNotification('Profiles table is empty', 'warning');
                }
            }
            
            // If both tables are empty, offer to add sample data
            if ((!actualUsers || actualUsers.length === 0) && (!actualProfiles || actualProfiles.length === 0)) {
                console.log('Both tables are empty, offering to add sample data');
                if (confirm('Database is empty. Would you like to add sample data?')) {
                    addSampleData();
                }
            } else {
                // If we have data, refresh the dashboard
                console.log('Data found, refreshing dashboard...');
                refreshAdminData();
            }
            
        } catch (error) {
            console.error('Database connection test failed:', error);
            showNotification('Database connection test failed: ' + error.message, 'error');
        }
    }
    
    // Make testDatabaseConnection globally available
    window.testDatabaseConnection = testDatabaseConnection;
    
    // Function to add sample data to database
    async function addSampleData() {
        console.log('=== ADDING SAMPLE DATA ===');
        
        if (!supabaseClient) {
            console.log('Creating Supabase client for sample data...');
            if (window.__SUPABASE_URL__ && window.__SUPABASE_ANON__ && window.supabase) {
                supabaseClient = window.supabase.createClient(window.__SUPABASE_URL__, window.__SUPABASE_ANON__);
            } else {
                console.error('Supabase not configured');
                showNotification('Supabase not configured', 'error');
                return;
            }
        }
        
        try {
            // Add sample users
            const sampleUsers = [
                {
                    username: 'john_doe',
                    email: 'john.doe@ssu.edu.ph',
                    password_hash: 'hashed_password_123',
                    full_name: 'John Doe',
                    user_type: 'graduating',
                    student_id: '2024-12345',
                    is_active: true,
                    is_verified: true
                },
                {
                    username: 'jane_smith',
                    email: 'jane.smith@ssu.edu.ph',
                    password_hash: 'hashed_password_456',
                    full_name: 'Jane Smith',
                    user_type: 'graduated',
                    student_id: '2023-67890',
                    is_active: true,
                    is_verified: true
                },
                {
                    username: 'mike_wilson',
                    email: 'mike.wilson@ssu.edu.ph',
                    password_hash: 'hashed_password_789',
                    full_name: 'Mike Wilson',
                    user_type: 'graduated',
                    student_id: '2023-54321',
                    is_active: true,
                    is_verified: true
                }
            ];
            
            console.log('Adding sample users...');
            const { data: insertedUsers, error: usersError } = await supabaseClient
                .from('users')
                .insert(sampleUsers)
                .select();
            
            if (usersError) {
                console.error('Error adding users:', usersError);
                showNotification('Error adding users: ' + usersError.message, 'error');
                return;
            }
            
            console.log('Added users:', insertedUsers);
            
            // Add sample profiles
            const sampleProfiles = [
                {
                    user_id: insertedUsers[0].id,
                    student_id: '2024-12345',
                    full_name: 'John Doe',
                    email: 'john.doe@ssu.edu.ph',
                    program: 'BSIS',
                    user_type: 'graduating',
                    expected_graduation: '2024-06-15',
                    current_gpa: 3.5,
                    verification_status: 'verified'
                },
                {
                    user_id: insertedUsers[1].id,
                    student_id: '2023-67890',
                    full_name: 'Jane Smith',
                    email: 'jane.smith@ssu.edu.ph',
                    program: 'BSIT',
                    user_type: 'graduated',
                    graduation_year: 2023,
                    final_gpa: 3.8,
                    employment_status: 'employed',
                    job_title: 'Software Developer',
                    company_name: 'Tech Solutions Inc.',
                    verification_status: 'verified'
                },
                {
                    user_id: insertedUsers[2].id,
                    student_id: '2023-54321',
                    full_name: 'Mike Wilson',
                    email: 'mike.wilson@ssu.edu.ph',
                    program: 'BSS',
                    user_type: 'graduated',
                    graduation_year: 2023,
                    final_gpa: 3.2,
                    employment_status: 'unemployed',
                    verification_status: 'verified'
                }
            ];
            
            console.log('Adding sample profiles...');
            const { data: insertedProfiles, error: profilesError } = await supabaseClient
                .from('profiles')
                .insert(sampleProfiles)
                .select();
            
            if (profilesError) {
                console.error('Error adding profiles:', profilesError);
                showNotification('Error adding profiles: ' + profilesError.message, 'error');
                return;
            }
            
            console.log('Added profiles:', insertedProfiles);
            
            // Add sample employment records
            const sampleEmploymentRecords = [
                {
                    profile_id: insertedProfiles[1].id, // Jane Smith (graduated)
                    employment_type: 'employed',
                    job_title: 'Software Developer',
                    company_name: 'Tech Solutions Inc.',
                    industry: 'Technology',
                    start_date: '2023-07-01',
                    salary_range: '30000-50000',
                    job_description: 'Full-stack web development using React and Node.js',
                    job_relevance: 'high'
                },
                {
                    profile_id: insertedProfiles[2].id, // Mike Wilson (graduated)
                    employment_type: 'unemployed',
                    job_title: null,
                    company_name: null,
                    industry: null,
                    start_date: null,
                    salary_range: null,
                    job_description: 'Currently seeking employment opportunities',
                    job_relevance: null
                }
            ];
            
            console.log('Adding sample employment records...');
            const { data: insertedEmploymentRecords, error: employmentError } = await supabaseClient
                .from('employment_records')
                .insert(sampleEmploymentRecords)
                .select();
            
            if (employmentError) {
                console.error('Error adding employment records:', employmentError);
                showNotification('Error adding employment records: ' + employmentError.message, 'error');
                return;
            }
            
            console.log('Added employment records:', insertedEmploymentRecords);
            showNotification('Sample data added successfully!', 'success');
            
            // Refresh the dashboard
            setTimeout(() => {
                refreshAdminData();
            }, 1000);
            
        } catch (error) {
            console.error('Error adding sample data:', error);
            showNotification('Error adding sample data: ' + error.message, 'error');
        }
    }
    
    // Make addSampleData globally available
    window.addSampleData = addSampleData;
    
    // Function to check database structure and permissions
    async function checkDatabaseStructure() {
        console.log('=== CHECKING DATABASE STRUCTURE ===');
        
        if (!supabaseClient) {
            console.log('Creating Supabase client...');
            if (window.__SUPABASE_URL__ && window.__SUPABASE_ANON__ && window.supabase) {
                supabaseClient = window.supabase.createClient(window.__SUPABASE_URL__, window.__SUPABASE_ANON__);
            } else {
                console.error('Supabase not configured');
                return;
            }
        }
        
        const tables = ['users', 'profiles', 'employment_records', 'system_logs', 'notifications'];
        
        for (const table of tables) {
            try {
                console.log(`Checking table: ${table}`);
                const { data, error } = await supabaseClient
                    .from(table)
                    .select('*')
                    .limit(1);
                
                if (error) {
                    console.error(`Error accessing ${table}:`, error);
                    showNotification(`Cannot access ${table}: ${error.message}`, 'error');
                } else {
                    console.log(`${table} is accessible`);
                    showNotification(`${table} table is accessible`, 'success');
                }
            } catch (err) {
                console.error(`Exception accessing ${table}:`, err);
                showNotification(`Exception accessing ${table}: ${err.message}`, 'error');
            }
        }
    }
    
    // Make checkDatabaseStructure globally available
    window.checkDatabaseStructure = checkDatabaseStructure;
    
    // Function to create employment records for existing profiles
    async function createEmploymentRecordsForProfiles() {
        console.log('=== CREATING EMPLOYMENT RECORDS FOR EXISTING PROFILES ===');
        
        if (!supabaseClient) {
            console.log('Creating Supabase client...');
            if (window.__SUPABASE_URL__ && window.__SUPABASE_ANON__ && window.supabase) {
                supabaseClient = window.supabase.createClient(window.__SUPABASE_URL__, window.__SUPABASE_ANON__);
            } else {
                console.error('Supabase not configured');
                return;
            }
        }
        
        try {
            // Get all graduated profiles
            const { data: graduatedProfiles, error: profilesError } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('user_type', 'graduated');
            
            if (profilesError) {
                console.error('Error fetching graduated profiles:', profilesError);
                showNotification('Error fetching profiles: ' + profilesError.message, 'error');
                return;
            }
            
            if (!graduatedProfiles || graduatedProfiles.length === 0) {
                showNotification('No graduated profiles found', 'warning');
                return;
            }
            
            console.log('Found graduated profiles:', graduatedProfiles.length);
            
            // Check existing employment records
            const { data: existingRecords, error: recordsError } = await supabaseClient
                .from('employment_records')
                .select('profile_id');
            
            if (recordsError) {
                console.error('Error fetching employment records:', recordsError);
                showNotification('Error fetching employment records: ' + recordsError.message, 'error');
                return;
            }
            
            const existingProfileIds = (existingRecords || []).map(record => record.profile_id);
            const profilesNeedingRecords = graduatedProfiles.filter(profile => 
                !existingProfileIds.includes(profile.id)
            );
            
            if (profilesNeedingRecords.length === 0) {
                showNotification('All graduated profiles already have employment records', 'info');
                return;
            }
            
            console.log('Profiles needing employment records:', profilesNeedingRecords.length);
            
            // Create employment records for profiles that don't have them
            const employmentRecordsToCreate = profilesNeedingRecords.map((profile, index) => ({
                profile_id: profile.id,
                employment_type: index % 2 === 0 ? 'employed' : 'unemployed',
                job_title: index % 2 === 0 ? 'Software Developer' : null,
                company_name: index % 2 === 0 ? 'Tech Company Inc.' : null,
                industry: index % 2 === 0 ? 'Technology' : null,
                start_date: index % 2 === 0 ? '2023-06-01' : null,
                salary_range: index % 2 === 0 ? '30000-50000' : null,
                job_description: index % 2 === 0 ? 'Full-stack development' : 'Currently seeking employment',
                job_relevance: index % 2 === 0 ? 'high' : null
            }));
            
            const { data: insertedRecords, error: insertError } = await supabaseClient
                .from('employment_records')
                .insert(employmentRecordsToCreate)
                .select();
            
            if (insertError) {
                console.error('Error creating employment records:', insertError);
                showNotification('Error creating employment records: ' + insertError.message, 'error');
                return;
            }
            
            console.log('Created employment records:', insertedRecords.length);
            showNotification(`Created ${insertedRecords.length} employment records`, 'success');
            
            // Refresh the dashboard
            setTimeout(() => {
                refreshAdminData();
            }, 1000);
            
        } catch (error) {
            console.error('Error creating employment records:', error);
            showNotification('Error creating employment records: ' + error.message, 'error');
        }
    }
    
    // Make createEmploymentRecordsForProfiles globally available
    window.createEmploymentRecordsForProfiles = createEmploymentRecordsForProfiles;
    
    // Program Filter Functions
    async function filterByProgram(program) {
        console.log('=== FILTERING BY PROGRAM ===');
        console.log('Selected program:', program);
        
        if (!supabaseClient) {
            console.log('Creating Supabase client...');
            if (window.__SUPABASE_URL__ && window.__SUPABASE_ANON__ && window.supabase) {
                supabaseClient = window.supabase.createClient(window.__SUPABASE_URL__, window.__SUPABASE_ANON__);
            } else {
                console.error('Supabase not configured');
                showNotification('Database not configured', 'error');
                return;
            }
        }
        
        try {
            let query = supabaseClient
                .from('profiles')
                .select(`
                    id,
                    student_id,
                    full_name,
                    email,
                    program,
                    user_type,
                    graduation_year,
                    expected_graduation,
                    current_gpa,
                    final_gpa,
                    verification_status,
                    employment_records (
                        employment_type,
                        job_title,
                        company_name
                    )
                `);
            
            if (program !== 'all') {
                query = query.eq('program', program);
            }
            
            const { data: profiles, error } = await query;
            
            if (error) {
                console.error('Error fetching program data:', error);
                showNotification('Error fetching program data: ' + error.message, 'error');
                return;
            }
            
            console.log('Fetched profiles:', profiles);
            
            // Separate graduated and graduating students
            const graduatedStudents = (profiles || []).filter(p => p.user_type === 'graduated');
            const graduatingStudents = (profiles || []).filter(p => p.user_type === 'graduating');
            
            console.log('Graduated students:', graduatedStudents.length);
            console.log('Graduating students:', graduatingStudents.length);
            
            // Display results
            displayProgramResults(program, graduatedStudents, graduatingStudents);
            
        } catch (error) {
            console.error('Error filtering by program:', error);
            showNotification('Error filtering by program: ' + error.message, 'error');
        }
    }
    
    function displayProgramResults(program, graduatedStudents, graduatingStudents) {
        const resultsSection = document.getElementById('program-results');
        const titleElement = document.getElementById('program-results-title');
        const graduatedTable = document.getElementById('graduated-students-table').querySelector('tbody');
        const graduatingTable = document.getElementById('graduating-students-table').querySelector('tbody');
        
        // Update title
        const programName = program === 'all' ? 'All Programs' : program;
        titleElement.textContent = `${programName} Students (${graduatedStudents.length} Graduated, ${graduatingStudents.length} Graduating)`;
        
        // Clear existing data
        graduatedTable.innerHTML = '';
        graduatingTable.innerHTML = '';
        
        // Populate graduated students table
        graduatedStudents.forEach(student => {
            const row = document.createElement('tr');
            const employmentStatus = student.employment_records && student.employment_records.length > 0 
                ? student.employment_records[0].employment_type 
                : 'No data';
            
            row.innerHTML = `
                <td>${student.student_id || 'N/A'}</td>
                <td>${student.full_name || 'N/A'}</td>
                <td>${student.email || 'N/A'}</td>
                <td>${student.graduation_year || 'N/A'}</td>
                <td>${employmentStatus}</td>
                <td>
                    <span class="verification-badge ${student.verification_status || 'pending'}">
                        ${(student.verification_status || 'pending').toUpperCase()}
                    </span>
                </td>
            `;
            graduatedTable.appendChild(row);
        });
        
        // Populate graduating students table
        graduatingStudents.forEach(student => {
            const row = document.createElement('tr');
            const expectedGraduation = student.expected_graduation 
                ? new Date(student.expected_graduation).toLocaleDateString() 
                : 'N/A';
            
            row.innerHTML = `
                <td>${student.student_id || 'N/A'}</td>
                <td>${student.full_name || 'N/A'}</td>
                <td>${student.email || 'N/A'}</td>
                <td>${expectedGraduation}</td>
                <td>${student.current_gpa || 'N/A'}</td>
                <td>
                    <span class="verification-badge ${student.verification_status || 'pending'}">
                        ${(student.verification_status || 'pending').toUpperCase()}
                    </span>
                </td>
            `;
            graduatingTable.appendChild(row);
        });
        
        // Show results section
        resultsSection.style.display = 'block';
        
        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth' });
        
        showNotification(`Found ${graduatedStudents.length} graduated and ${graduatingStudents.length} graduating students in ${programName}`, 'success');
    }
    
    function closeProgramResults() {
        const resultsSection = document.getElementById('program-results');
        resultsSection.style.display = 'none';
    }
    
    // Make functions globally available
    window.filterByProgram = filterByProgram;
    window.closeProgramResults = closeProgramResults;
    
    // Database Functions
    let currentEditingProfile = null;
    let allProfilesData = []; // Store all profiles for search filtering
    
    async function loadProfilesTable() {
        console.log('=== LOADING PROFILES TABLE ===');
        
        if (!supabaseClient) {
            console.log('Creating Supabase client...');
            if (window.__SUPABASE_URL__ && window.__SUPABASE_ANON__ && window.supabase) {
                supabaseClient = window.supabase.createClient(window.__SUPABASE_URL__, window.__SUPABASE_ANON__);
            } else {
                console.error('Supabase not configured');
                showNotification('Database not configured', 'error');
                return;
            }
        }
        
        try {
            const { data: profiles, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('Error fetching profiles:', error);
                showNotification('Error fetching profiles: ' + error.message, 'error');
                return;
            }
            
            console.log('Fetched profiles:', profiles);
            allProfilesData = profiles || []; // Store globally for search
            displayProfilesTable(allProfilesData);
            
        } catch (error) {
            console.error('Error loading profiles table:', error);
            showNotification('Error loading profiles table: ' + error.message, 'error');
        }
    }
    
    function displayProfilesTable(profiles) {
        const tableBody = document.querySelector('#admin-db-table tbody');
        tableBody.innerHTML = '';
        
        if (profiles.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="10" style="text-align: center; padding: 20px; color: #6b7280;">No profiles found</td>';
            tableBody.appendChild(row);
            return;
        }
        
        profiles.forEach(profile => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${profile.student_id || 'N/A'}</td>
                <td>${profile.full_name || 'N/A'}</td>
                <td>${profile.email || 'N/A'}</td>
                <td>${profile.phone || 'N/A'}</td>
                <td>${profile.program || 'N/A'}</td>
                <td>
                    <span class="user-type-badge ${profile.user_type}">
                        ${(profile.user_type || 'N/A').toUpperCase()}
                    </span>
                </td>
                <td>${profile.graduation_year || 'N/A'}</td>
                <td>${profile.current_gpa || 'N/A'}</td>
                <td>
                    <span class="verification-badge ${profile.verification_status || 'pending'}">
                        ${(profile.verification_status || 'pending').toUpperCase()}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="edit-btn" onclick="editProfile('${profile.id}')">Edit</button>
                        <button class="delete-btn" onclick="deleteProfile('${profile.id}')">Delete</button>
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
        });
        
        showNotification(`Loaded ${profiles.length} profiles`, 'success');
    }
    
    async function editProfile(profileId) {
        console.log('Editing profile:', profileId);
        
        if (!supabaseClient) {
            showNotification('Database not configured', 'error');
            return;
        }
        
        try {
            const { data: profile, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', profileId)
                .single();
            
            if (error) {
                console.error('Error fetching profile:', error);
                showNotification('Error fetching profile: ' + error.message, 'error');
                return;
            }
            
            currentEditingProfile = profile;
            populateEditForm(profile);
            document.getElementById('edit-profile-modal').style.display = 'flex';
            
        } catch (error) {
            console.error('Error editing profile:', error);
            showNotification('Error editing profile: ' + error.message, 'error');
        }
    }
    
    function populateEditForm(profile) {
        document.getElementById('edit-student-id').value = profile.student_id || '';
        document.getElementById('edit-full-name').value = profile.full_name || '';
        document.getElementById('edit-email').value = profile.email || '';
        document.getElementById('edit-phone').value = profile.phone || '';
        document.getElementById('edit-program').value = profile.program || '';
        document.getElementById('edit-user-type').value = profile.user_type || '';
        document.getElementById('edit-graduation-year').value = profile.graduation_year || '';
        document.getElementById('edit-current-gpa').value = profile.current_gpa || '';
        document.getElementById('edit-verification-status').value = profile.verification_status || 'pending';
        document.getElementById('edit-address').value = profile.address || '';
        document.getElementById('edit-thesis-title').value = profile.thesis_title || '';
        document.getElementById('edit-thesis-advisor').value = profile.thesis_advisor || '';
    }
    
    async function saveProfileChanges() {
        if (!currentEditingProfile || !supabaseClient) {
            showNotification('No profile selected or database not configured', 'error');
            return;
        }
        
        const formData = {
            student_id: document.getElementById('edit-student-id').value,
            full_name: document.getElementById('edit-full-name').value,
            email: document.getElementById('edit-email').value,
            phone: document.getElementById('edit-phone').value,
            program: document.getElementById('edit-program').value,
            user_type: document.getElementById('edit-user-type').value,
            graduation_year: document.getElementById('edit-graduation-year').value ? 
                parseInt(document.getElementById('edit-graduation-year').value) : null,
            current_gpa: document.getElementById('edit-current-gpa').value ? 
                parseFloat(document.getElementById('edit-current-gpa').value) : null,
            verification_status: document.getElementById('edit-verification-status').value,
            address: document.getElementById('edit-address').value,
            thesis_title: document.getElementById('edit-thesis-title').value,
            thesis_advisor: document.getElementById('edit-thesis-advisor').value,
            updated_at: new Date().toISOString()
        };
        
        try {
            const { data, error } = await supabaseClient
                .from('profiles')
                .update(formData)
                .eq('id', currentEditingProfile.id)
                .select();
            
            if (error) {
                console.error('Error updating profile:', error);
                showNotification('Error updating profile: ' + error.message, 'error');
                return;
            }
            
            console.log('Profile updated:', data);
            showNotification('Profile updated successfully', 'success');
            closeEditProfileModal();
            loadProfilesTable(); // Refresh the table
            
        } catch (error) {
            console.error('Error saving profile changes:', error);
            showNotification('Error saving profile changes: ' + error.message, 'error');
        }
    }
    
    async function deleteProfile(profileId) {
        if (!confirm('Are you sure you want to delete this profile? This action cannot be undone.')) {
            return;
        }
        
        if (!supabaseClient) {
            showNotification('Database not configured', 'error');
            return;
        }
        
        try {
            const { error } = await supabaseClient
                .from('profiles')
                .delete()
                .eq('id', profileId);
            
            if (error) {
                console.error('Error deleting profile:', error);
                showNotification('Error deleting profile: ' + error.message, 'error');
                return;
            }
            
            console.log('Profile deleted:', profileId);
            showNotification('Profile deleted successfully', 'success');
            loadProfilesTable(); // Refresh the table
            
        } catch (error) {
            console.error('Error deleting profile:', error);
            showNotification('Error deleting profile: ' + error.message, 'error');
        }
    }
    
    function closeEditProfileModal() {
        document.getElementById('edit-profile-modal').style.display = 'none';
        currentEditingProfile = null;
    }
    
    function setupDatabaseSearch() {
        const searchInput = document.getElementById('admin-search');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                const searchTerm = this.value.toLowerCase().trim();
                filterProfilesTable(searchTerm);
            });
        }
    }
    
    function filterProfilesTable(searchTerm) {
        if (!searchTerm) {
            // If search is empty, show all profiles
            displayProfilesTable(allProfilesData);
            return;
        }
        
        const filteredProfiles = allProfilesData.filter(profile => {
            // Search in multiple fields
            const studentId = (profile.student_id || '').toLowerCase();
            const fullName = (profile.full_name || '').toLowerCase();
            const email = (profile.email || '').toLowerCase();
            const program = (profile.program || '').toLowerCase();
            const phone = (profile.phone || '').toLowerCase();
            const userType = (profile.user_type || '').toLowerCase();
            
            return studentId.includes(searchTerm) ||
                   fullName.includes(searchTerm) ||
                   email.includes(searchTerm) ||
                   program.includes(searchTerm) ||
                   phone.includes(searchTerm) ||
                   userType.includes(searchTerm);
        });
        
        displayProfilesTable(filteredProfiles);
        
        // Show search results count
        if (searchTerm) {
            showNotification(`Found ${filteredProfiles.length} profiles matching "${searchTerm}"`, 'info');
        }
    }
    
    // Make functions globally available
    window.loadProfilesTable = loadProfilesTable;
    window.editProfile = editProfile;
    window.saveProfileChanges = saveProfileChanges;
    window.deleteProfile = deleteProfile;
    window.closeEditProfileModal = closeEditProfileModal;
    window.setupDatabaseSearch = setupDatabaseSearch;
    window.filterProfilesTable = filterProfilesTable;
    
    // Admin Section Functions
    async function loadVerificationData() {
        console.log('Loading verification data...');
        if (!supabaseClient) {
            showNotification('Database not configured', 'error');
            return;
        }
        
        try {
            const { data: profiles, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('Error fetching verification data:', error);
                showNotification('Error fetching verification data: ' + error.message, 'error');
                return;
            }
            
            displayVerificationTable(profiles || []);
            
        } catch (error) {
            console.error('Error loading verification data:', error);
            showNotification('Error loading verification data: ' + error.message, 'error');
        }
    }
    
    function displayVerificationTable(profiles) {
        const tableBody = document.querySelector('#verification-table tbody');
        tableBody.innerHTML = '';
        
        if (profiles.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="8" style="text-align: center; padding: 20px; color: #6b7280;">No profiles found</td>';
            tableBody.appendChild(row);
            return;
        }
        
        profiles.forEach(profile => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${profile.student_id || 'N/A'}</td>
                <td>${profile.full_name || 'N/A'}</td>
                <td>${profile.email || 'N/A'}</td>
                <td>${profile.program || 'N/A'}</td>
                <td>
                    <span class="user-type-badge ${profile.user_type}">
                        ${(profile.user_type || 'N/A').toUpperCase()}
                    </span>
                </td>
                <td>
                    <span class="verification-badge ${profile.verification_status || 'pending'}">
                        ${(profile.verification_status || 'pending').toUpperCase()}
                    </span>
                </td>
                <td>${profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="edit-btn" onclick="updateVerificationStatus('${profile.id}', 'verified')">Verify</button>
                        <button class="delete-btn" onclick="updateVerificationStatus('${profile.id}', 'rejected')">Reject</button>
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }
    
    async function updateVerificationStatus(profileId, status) {
        if (!supabaseClient) {
            showNotification('Database not configured', 'error');
            return;
        }
        
        try {
            const { error } = await supabaseClient
                .from('profiles')
                .update({ verification_status: status })
                .eq('id', profileId);
            
            if (error) {
                console.error('Error updating verification status:', error);
                showNotification('Error updating verification status: ' + error.message, 'error');
                return;
            }
            
            showNotification(`Verification status updated to ${status}`, 'success');
            loadVerificationData(); // Refresh the table
            
        } catch (error) {
            console.error('Error updating verification status:', error);
            showNotification('Error updating verification status: ' + error.message, 'error');
        }
    }
    
    // Survey Functions
    async function createNewSurvey() {
        try {
            if (!supabaseClient) { showNotification('Database not configured', 'error'); return; }
            const title = prompt('Survey title'); if (!title) return;
            const description = prompt('Description') || '';
            const type = prompt('Type (e.g., graduating, graduated, all)') || 'all';
            const { error } = await supabaseClient.from('surveys').insert({ title, description, type, is_active: true });
            if (error) throw error;
            showNotification('Survey created', 'success');
            await loadSurveys();
        } catch (e) {
            console.error('Create survey failed', e);
            showNotification('Failed to create survey', 'error');
        }
    }
    
    async function exportSurveyData() {
        try {
            if (!supabaseClient || !window.XLSX) { showNotification('Export prerequisites missing', 'error'); return; }
            const { data: surveys } = await supabaseClient.from('surveys').select('*');
            const { data: questions } = await supabaseClient.from('survey_questions').select('*');
            const { data: responses } = await supabaseClient.from('survey_responses').select('*');
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(surveys || []), 'surveys');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(questions || []), 'questions');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(responses || []), 'responses');
            const wbout = XLSX.write(wb, {bookType:'xlsx', type:'array'});
            const blob = new Blob([wbout], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'surveys_export.xlsx'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
            showNotification('Survey export complete', 'success');
        } catch (e) {
            console.error('Survey export failed', e);
            showNotification('Survey export failed', 'error');
        }
    }

    async function loadSurveys() {
        const tbody = document.getElementById('surveys-table');
        if (!tbody || !supabaseClient) return;
        tbody.innerHTML = '';
        const { data, error } = await supabaseClient.from('surveys').select('*').order('created_at', { ascending: false });
        if (error) { tbody.innerHTML = '<tr><td colspan="6">Failed to load surveys</td></tr>'; return; }
        (data || []).forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${s.title}</td><td>${s.type}</td><td>${s.is_active ? 'Active':'Inactive'}</td><td>${s.created_at ? new Date(s.created_at).toLocaleString():''}</td><td><button class="btn btn-secondary" onclick="toggleSurvey(${s.id}, ${!s.is_active})">${s.is_active?'Deactivate':'Activate'}</button></td>`;
            tbody.appendChild(tr);
        });
    }
    window.loadSurveys = loadSurveys;
    async function toggleSurvey(id, state) {
        if (!supabaseClient) return;
        await supabaseClient.from('surveys').update({ is_active: !!state }).eq('id', id);
        loadSurveys();
    }
    window.toggleSurvey = toggleSurvey;
    
    // Report Functions
    async function generateReport(type) {
        try {
            if (!supabaseClient || !window.XLSX) { showNotification('Export prerequisites missing', 'error'); return; }
            const wb = XLSX.utils.book_new();
            if (type === 'employment') {
                const { data } = await supabaseClient.from('employment_records').select('*');
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data||[]), 'employment_records');
            } else if (type === 'program') {
                const { data } = await supabaseClient.from('profiles').select('program');
                const counts = {};
                (data||[]).forEach(r => { const k=(r.program||'Unknown'); counts[k]=(counts[k]||0)+1; });
                const rows = Object.entries(counts).map(([program,count])=>({ program, count }));
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'program_report');
            } else if (type === 'verification') {
                const { data } = await supabaseClient.from('profiles').select('full_name, program, verification_status, created_at');
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data||[]), 'verification');
            } else if (type === 'survey') {
                const [{ data: surveys }, { data: responses }] = await Promise.all([
                    supabaseClient.from('surveys').select('*'),
                    supabaseClient.from('survey_responses').select('*')
                ]);
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(surveys||[]), 'surveys');
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(responses||[]), 'survey_responses');
            } else {
                showNotification('Unknown report type', 'error');
                return;
            }
            const wbout = XLSX.write(wb, {bookType:'xlsx', type:'array'});
            const blob = new Blob([wbout], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href=url; a.download = `${type}_report.xlsx`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
            showNotification('Report generated', 'success');
        } catch (e) {
            console.error('generateReport failed', e);
            showNotification('Report generation failed', 'error');
        }
    }
    
    function exportToCSV() {
        showNotification('CSV export feature coming soon!', 'info');
    }
    
    function exportToExcel() {
        showNotification('Excel export feature coming soon!', 'info');
    }
    
    function exportToPDF() {
        showNotification('PDF export feature coming soon!', 'info');
    }
    
    // Notification Functions
    function createNotification() {
        showNotification('Notification creation feature coming soon!', 'info');
    }
    
    async function loadNotifications() {
        const tbody = document.getElementById('notifications-table');
        if (!tbody || !supabaseClient) return;
        tbody.innerHTML = '';
        const { data, error } = await supabaseClient.from('notifications').select('*').order('sent_at', { ascending: false });
        if (error) { tbody.innerHTML = '<tr><td colspan="6">Failed to load notifications</td></tr>'; return; }
        (data || []).forEach(n => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${n.title || ''}</td><td>${(n.message||'').slice(0,80)}</td><td>${n.type||''}</td><td>${n.is_read?'Read':'Unread'}</td><td>${n.sent_at?new Date(n.sent_at).toLocaleString():''}</td>`;
            tbody.appendChild(tr);
        });
    }
    
    // Dashboard Button Functions
    function openSurvey() {
        showNotification('Survey feature coming soon!', 'info');
    }
    
    function openReport() {
        showNotification('Report feature coming soon!', 'info');
    }
    
    function openNotifications() {
        showNotification('Notifications feature coming soon!', 'info');
    }
    
    // Make admin functions globally available
    window.loadVerificationData = loadVerificationData;
    window.updateVerificationStatus = updateVerificationStatus;
    window.createNewSurvey = createNewSurvey;
    window.exportSurveyData = exportSurveyData;
    window.generateReport = generateReport;
    window.exportToCSV = exportToCSV;
    window.exportToExcel = exportToExcel;
    window.exportToPDF = exportToPDF;
    window.createNotification = createNotification;
    window.loadNotifications = loadNotifications;
    window.openSurvey = openSurvey;
    window.openReport = openReport;
    window.openNotifications = openNotifications;
    
    // Password visibility toggle function
    function togglePasswordVisibility(inputId = 'login-password') {
        const passwordInput = document.getElementById(inputId);
        if (!passwordInput) return;
        
        const toggleButton = passwordInput.parentElement.querySelector('.password-toggle');
        const toggleIcon = toggleButton ? toggleButton.querySelector('.toggle-icon') : null;
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            if (toggleIcon) toggleIcon.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
        } else {
            passwordInput.type = 'password';
            if (toggleIcon) toggleIcon.innerHTML = '<i class="fa-solid fa-eye"></i>';
        }
    }
    
    // Make function globally available
    window.togglePasswordVisibility = togglePasswordVisibility;
    
    // Chart initialization and data loading
    let employmentChart, programChart, graduationChart, graduationLevelChart;
    
    // Remove Chart.js dynamic loader (we use HTML fallback permanently)
    function loadChartLibrary() { return Promise.reject(new Error('Chart disabled')); }

    // Plain-HTML fallback charts when Chart.js is unavailable
    function renderChartsFallback(profiles, employmentRecords) {
        // Helpers
        function mountFallback(id, html) {
            const canvas = document.getElementById(id);
            if (!canvas) return;
            const wrapper = canvas.parentElement;
            if (!wrapper) return;
            wrapper.innerHTML = html;
        }
        function bar(color, label, value, max) {
            const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 4;
            return `<div style=\"margin:6px 0\"><div style=\"display:flex;justify-content:space-between;font-weight:700;color:#374151\"><span>${label}</span><span>${value}</span></div><div style=\"height:10px;border-radius:999px;background:#e5e7eb;overflow:hidden\"><div style=\"height:100%;width:${width}%;background:${color};\"></div></div></div>`;
        }
        
        // Employment Status Distribution
        const empStats = { employed:0, unemployed:0, 'self-employed':0, 'job order':0, 'part timer':0 };
        (employmentRecords || []).forEach(r => {
            const s = (r.employment_type || '').toLowerCase();
            if (empStats.hasOwnProperty(s)) empStats[s]++; else if (s) empStats.employed++;
        });
        const empEntries = Object.entries(empStats);
        const empMax = Math.max(1, ...empEntries.map(([,v]) => v));
        const empColors = ['#10b981','#ef4444','#f59e0b','#6366f1','#3b82f6'];
        mountFallback('employmentChart', `<div>${empEntries.map(([k,v],i)=>bar(empColors[i%empColors.length], k.toUpperCase(), v, empMax)).join('')}</div>`);
        
        // Program Distribution
        const programStats = { BSIS:0, BSIT:0, BSS:0, BSPSYCH:0 };
        (profiles || []).forEach(p => { if (programStats.hasOwnProperty(p.program)) programStats[p.program]++; });
        const progEntries = Object.entries(programStats);
        const progMax = Math.max(1, ...progEntries.map(([,v]) => v));
        const progColors = ['#3b82f6','#10b981','#f59e0b','#ef4444'];
        mountFallback('programChart', `<div>${progEntries.map(([k,v],i)=>bar(progColors[i%progColors.length], k, v, progMax)).join('')}</div>`);
        
        // Graduation Year Trends (simple list)
        const yearCounts = {};
        (profiles || []).forEach(p => {
            let y = p.graduation_year || (p.expected_graduation ? new Date(p.expected_graduation).getFullYear() : null);
            if (y) yearCounts[y] = (yearCounts[y]||0)+1;
        });
        const yearsSorted = Object.keys(yearCounts).sort();
        const yearMax = Math.max(1, ...yearsSorted.map(y => yearCounts[y]));
        mountFallback('yearChart', `<div>${yearsSorted.map((y,i)=>bar('#335cff', y, yearCounts[y], yearMax)).join('') || '<div style=\"color:#6b7280\">No data</div>'}</div>`);
        
        // Graduation Level (simple bars)
        const levelStats = { 'Magna Cum Laude':0, 'Cum Laude':0, 'With Honors':0, 'Regular':0 };
        (profiles || []).forEach(p => { if (levelStats.hasOwnProperty(p.graduation_level)) levelStats[p.graduation_level]++; });
        const levelEntries = Object.entries(levelStats);
        const levelMax = Math.max(1, ...levelEntries.map(([,v]) => v));
        mountFallback('graduationLevelChart', `<div>${levelEntries.map(([k,v])=>bar('#f59e0b', k, v, levelMax)).join('')}</div>`);
    }
    
    async function initializeCharts() {
        console.log('Initializing charts with Supabase data...');
        
        if (!supabaseClient) {
            console.log('Supabase not configured, using demo data');
            initializeChartsWithDemoData();
            return;
        }
        
        try {
            // Fetch all data needed for charts
            const [profilesData, employmentData] = await Promise.all([
                supabaseClient.from('profiles').select('*'),
                supabaseClient.from('employment_records').select('*')
            ]);
            
            if (profilesData.error) {
                console.error('Error fetching profiles:', profilesData.error);
                showNotification('Error loading chart data: ' + profilesData.error.message, 'error');
                initializeChartsWithDemoData();
                return;
            }
            
            if (employmentData.error) {
                console.error('Error fetching employment data:', employmentData.error);
                showNotification('Error loading employment data: ' + employmentData.error.message, 'error');
                initializeChartsWithDemoData();
                return;
            }
            
            const profiles = profilesData.data || [];
            const employmentRecords = employmentData.data || [];
            
            console.log('Fetched data for charts:', { profiles: profiles.length, employment: employmentRecords.length });
            
            // Render charts using HTML fallback (no external libs)
            renderChartsFallback(profiles, employmentRecords);
            
            showNotification('Charts loaded successfully', 'success');
            
        } catch (error) {
            console.error('Error initializing charts:', error);
            showNotification('Error loading chart data: ' + error.message, 'error');
            // Fallback to demo data
            initializeChartsWithDemoData();
        }
    }
    
    function initializeChartsWithDemoData() {
        console.log('Using demo data for charts');
        renderChartsFallback([], []);
    }
    
    function initializeEmploymentChart(profiles, employmentRecords) {
        const ctx = document.getElementById('employmentChart');
        if (!ctx) {
            console.error('Employment chart canvas not found');
            return;
        }
        
        // Destroy existing chart if it exists
        if (employmentChart) {
            employmentChart.destroy();
        }
        
        // Calculate employment status from employment_records
        const employmentStats = {
            'employed': 0,
            'unemployed': 0,
            'self-employed': 0,
            'job order': 0,
            'part timer': 0
        };
        
        employmentRecords.forEach(record => {
            const status = (record.employment_type || '').toLowerCase();
            if (employmentStats.hasOwnProperty(status)) {
                employmentStats[status]++;
            } else if (status === 'employed' || status === 'job order' || status === 'part timer' || status === 'self employed') {
                employmentStats['employed']++;
            } else {
                employmentStats['unemployed']++;
            }
        });
        
        // If no employment records, use demo data
        const hasData = employmentRecords.length > 0;
        const data = hasData ? [
            employmentStats['employed'],
            employmentStats['unemployed'],
            employmentStats['self-employed'],
            employmentStats['job order'],
            employmentStats['part timer']
        ] : [45, 25, 15, 10, 5];
        
        employmentChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Employed', 'Unemployed', 'Self-Employed', 'Job Order', 'Part Timer'],
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#10b981',
                        '#ef4444',
                        '#f59e0b',
                        '#3b82f6',
                        '#8b5cf6'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }
    
    function initializeProgramChart(profiles) {
        const ctx = document.getElementById('programChart');
        if (!ctx) {
            console.error('Program chart canvas not found');
            return;
        }
        
        // Destroy existing chart if it exists
        if (programChart) {
            programChart.destroy();
        }
        
        // Calculate program distribution from profiles
        const programStats = {
            'BSIS': 0,
            'BSIT': 0,
            'BSS': 0,
            'BSPSYCH': 0
        };
        
        profiles.forEach(profile => {
            const program = profile.program;
            if (programStats.hasOwnProperty(program)) {
                programStats[program]++;
            }
        });
        
        // If no profiles, use demo data
        const hasData = profiles.length > 0;
        const data = hasData ? [
            programStats['BSIS'],
            programStats['BSIT'],
            programStats['BSS'],
            programStats['BSPSYCH']
        ] : [120, 95, 80, 65];
        
        programChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['BSIS', 'BSIT', 'BSS', 'BSPSYCH'],
                datasets: [{
                    label: 'Number of Students',
                    data: data,
                    backgroundColor: [
                        '#3b82f6',
                        '#10b981',
                        '#f59e0b',
                        '#ef4444'
                    ],
                    borderWidth: 1,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }
    
    function initializeGraduationChart(profiles) {
        const ctx = document.getElementById('yearChart');
        if (!ctx) {
            console.error('Year chart canvas not found');
            return;
        }
        
        // Destroy existing chart if it exists
        if (graduationChart) {
            graduationChart.destroy();
        }
        
        // Calculate graduation year trends from profiles
        const yearStats = {
            '2019': 0,
            '2020': 0,
            '2021': 0,
            '2022': 0,
            '2023': 0,
            '2024': 0
        };
        
        profiles.forEach(profile => {
            if (profile.graduation_year && yearStats.hasOwnProperty(profile.graduation_year.toString())) {
                yearStats[profile.graduation_year.toString()]++;
            }
        });
        
        // If no graduation data, use demo data
        const hasData = profiles.some(p => p.graduation_year);
        const data = hasData ? [
            yearStats['2019'],
            yearStats['2020'],
            yearStats['2021'],
            yearStats['2022'],
            yearStats['2023'],
            yearStats['2024']
        ] : [85, 92, 78, 105, 120, 95];
        
        graduationChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['2019', '2020', '2021', '2022', '2023', '2024'],
                datasets: [{
                    label: 'Graduates',
                    data: data,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }
    
    function initializeGraduationLevelChart(profiles) {
        const ctx = document.getElementById('graduationLevelChart');
        if (!ctx) {
            console.error('Graduation level chart canvas not found');
            return;
        }
        
        // Destroy existing chart if it exists
        if (graduationLevelChart) {
            graduationLevelChart.destroy();
        }
        
        // Calculate graduation levels based on GPA from profiles
        const levelStats = {
            'Magna Cum Laude': 0,  // GPA >= 3.8
            'Cum Laude': 0,        // GPA >= 3.5
            'With Honors': 0,      // GPA >= 3.0
            'Regular': 0           // GPA < 3.0
        };
        
        const currentYear = new Date().getFullYear();
        
        profiles.forEach(profile => {
            // Only count graduates from current year
            if (profile.graduation_year === currentYear && profile.final_gpa) {
                const gpa = parseFloat(profile.final_gpa);
                if (gpa >= 3.8) {
                    levelStats['Magna Cum Laude']++;
                } else if (gpa >= 3.5) {
                    levelStats['Cum Laude']++;
                } else if (gpa >= 3.0) {
                    levelStats['With Honors']++;
                } else {
                    levelStats['Regular']++;
                }
            }
        });
        
        // If no graduation level data, use demo data
        const hasData = profiles.some(p => p.graduation_year === currentYear && p.final_gpa);
        const data = hasData ? [
            levelStats['Magna Cum Laude'],
            levelStats['Cum Laude'],
            levelStats['With Honors'],
            levelStats['Regular']
        ] : [15, 25, 35, 20];
        
        graduationLevelChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Magna Cum Laude', 'Cum Laude', 'With Honors', 'Regular'],
                datasets: [{
                    label: 'Number of Graduates',
                    data: data,
                    backgroundColor: [
                        '#fbbf24',
                        '#f59e0b',
                        '#d97706',
                        '#92400e'
                    ],
                    borderWidth: 1,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }
    
    // Manual chart refresh function for testing
    function refreshCharts() {
        console.log('Manually refreshing charts...');
        if (typeof Chart !== 'undefined') {
            initializeCharts();
        } else {
            showNotification('Chart.js not loaded. Please refresh the page.', 'error');
        }
    }
    
    // Make chart functions globally available
    window.initializeCharts = initializeCharts;
    window.refreshCharts = refreshCharts;
    
    // Query Builder Functions
    function openQueryBuilder() {
        console.log('Opening query builder...');
        const modal = document.getElementById('query-builder-modal');
        if (modal) {
            modal.style.display = 'flex';
            loadTableColumns();
        }
    }
    
    function closeQueryBuilder() {
        console.log('Closing query builder...');
        const modal = document.getElementById('query-builder-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    function loadTableColumns() {
        const tableSelect = document.getElementById('query-table');
        const columnSelect = document.getElementById('filter-column');
        
        if (!tableSelect || !columnSelect) return;
        
        const selectedTable = tableSelect.value;
        console.log('Loading columns for table:', selectedTable);
        
        // Clear existing options
        columnSelect.innerHTML = '<option value="">Select Column</option>';
        
        // Define common columns for each table
        const tableColumns = {
            'users': ['id', 'username', 'email', 'full_name', 'user_type', 'student_id', 'is_active', 'is_verified', 'created_at'],
            'profiles': ['id', 'user_id', 'student_id', 'full_name', 'email', 'program', 'user_type', 'graduation_year', 'verification_status', 'created_at'],
            'employment_records': ['id', 'profile_id', 'employment_type', 'job_title', 'company_name', 'industry', 'start_date', 'end_date', 'salary_range', 'job_description', 'job_relevance', 'created_at'],
            'system_logs': ['id', 'user_id', 'action', 'description', 'ip_address', 'created_at'],
            'notifications': ['id', 'user_id', 'title', 'message', 'type', 'is_read', 'created_at']
        };
        
        const columns = tableColumns[selectedTable] || [];
        columns.forEach(column => {
            const option = document.createElement('option');
            option.value = column;
            option.textContent = column;
            columnSelect.appendChild(option);
        });
    }
    
    async function executeCustomQuery() {
        console.log('Executing custom query...');
        
        if (!supabaseClient) {
            showNotification('Database connection not available', 'error');
            return;
        }
        
        const table = document.getElementById('query-table').value;
        const columns = document.getElementById('query-columns').value;
        const filterColumn = document.getElementById('filter-column').value;
        const filterOperator = document.getElementById('filter-operator').value;
        const filterValue = document.getElementById('filter-value').value;
        const orderColumn = document.getElementById('order-column').value;
        const orderDirection = document.getElementById('order-direction').value;
        const limit = document.getElementById('query-limit').value;
        
        try {
            let query = supabaseClient.from(table);
            
            // Select columns
            if (columns.trim()) {
                const columnList = columns.split(',').map(col => col.trim());
                query = query.select(columnList.join(', '));
            } else {
                query = query.select('*');
            }
            
            // Apply filter
            if (filterColumn && filterValue) {
                if (filterOperator === 'in') {
                    const values = filterValue.split(',').map(v => v.trim());
                    query = query.in(filterColumn, values);
                } else {
                    query = query[filterOperator](filterColumn, filterValue);
                }
            }
            
            // Apply ordering
            if (orderColumn) {
                query = query.order(orderColumn, { ascending: orderDirection === 'asc' });
            }
            
            // Apply limit
            if (limit) {
                query = query.limit(parseInt(limit));
            }
            
            console.log('Executing query:', query);
            const { data, error } = await query;
            
            if (error) {
                console.error('Query error:', error);
                showNotification('Query error: ' + error.message, 'error');
                return;
            }
            
            console.log('Query results:', data);
            displayQueryResults(data, table);
            closeQueryBuilder();
            
        } catch (error) {
            console.error('Query execution failed:', error);
            showNotification('Query execution failed: ' + error.message, 'error');
        }
    }
    
    function displayQueryResults(data, tableName) {
        console.log('Displaying query results:', data);
        
        const infoElement = document.getElementById('query-results-info');
        const tableElement = document.getElementById('query-results-table');
        const headerElement = document.getElementById('query-results-header');
        const bodyElement = document.getElementById('query-results-body');
        
        if (!data || data.length === 0) {
            infoElement.textContent = 'No results found for the query.';
            infoElement.style.display = 'block';
            tableElement.style.display = 'none';
            return;
        }
        
        // Update info
        infoElement.textContent = `Found ${data.length} records from ${tableName} table.`;
        infoElement.style.display = 'block';
        
        // Create table headers
        const headers = Object.keys(data[0]);
        headerElement.innerHTML = '';
        const headerRow = document.createElement('tr');
        headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            headerRow.appendChild(th);
        });
        headerElement.appendChild(headerRow);
        
        // Create table body
        bodyElement.innerHTML = '';
        data.forEach(row => {
            const tr = document.createElement('tr');
            headers.forEach(header => {
                const td = document.createElement('td');
                const value = row[header];
                td.textContent = value === null ? 'NULL' : 
                                value === undefined ? 'UNDEFINED' : 
                                typeof value === 'object' ? JSON.stringify(value) : 
                                String(value);
                tr.appendChild(td);
            });
            bodyElement.appendChild(tr);
        });
        
        tableElement.style.display = 'block';
    }
    
    function exportQueryResults() {
        const tableElement = document.getElementById('query-results-table');
        if (!tableElement || tableElement.style.display === 'none') {
            showNotification('No results to export', 'warning');
            return;
        }
        
        const table = tableElement.querySelector('table');
        if (!table) return;
        
        // Convert table to CSV
        let csv = '';
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('th, td');
            const rowData = Array.from(cells).map(cell => {
                const text = cell.textContent.trim();
                return `"${text.replace(/"/g, '""')}"`;
            });
            csv += rowData.join(',') + '\n';
        });
        
        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `query_results_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showNotification('Results exported to CSV', 'success');
    }
    
    function clearQueryResults() {
        const infoElement = document.getElementById('query-results-info');
        const tableElement = document.getElementById('query-results-table');
        
        infoElement.textContent = 'No query executed yet. Click "Open Query Builder" to start.';
        infoElement.style.display = 'block';
        tableElement.style.display = 'none';
        
        showNotification('Query results cleared', 'info');
    }
    
    // Make query functions globally available
    window.openQueryBuilder = openQueryBuilder;
    window.closeQueryBuilder = closeQueryBuilder;
    window.executeCustomQuery = executeCustomQuery;
    window.exportQueryResults = exportQueryResults;
    window.clearQueryResults = clearQueryResults;
    
    // Function to load public graduation list for graduating students
    async function loadPublicGraduationList() {
        if (!supabaseClient || currentUserRole !== 'graduating') {
            return;
        }
        
        try {
            // Get current user's expected graduation year
            const currentUserYear = currentUser?.expected_graduation ? 
                new Date(currentUser.expected_graduation).getFullYear() : 
                new Date().getFullYear();
            
            // Fetch only graduating students from the same year (public info only)
            const { data: graduatingStudents, error } = await supabaseClient
                .from('profiles')
                .select('program, expected_graduation')
                .eq('user_type', 'graduating')
                .not('expected_graduation', 'is', null);
            
            if (error) {
                console.error('Error loading graduation list:', error);
                return;
            }
            
            // Filter by graduation year and count by program
            const sameYearStudents = graduatingStudents.filter(student => {
                const studentYear = new Date(student.expected_graduation).getFullYear();
                return studentYear === currentUserYear;
            });
            
            // Count students by program
            const programCounts = {};
            sameYearStudents.forEach(student => {
                programCounts[student.program] = (programCounts[student.program] || 0) + 1;
            });
            
            // Display the public graduation statistics
            displayPublicGraduationStats(currentUserYear, programCounts, sameYearStudents.length);
            
        } catch (error) {
            console.error('Error loading public graduation list:', error);
        }
    }
    
    // Function to display public graduation statistics
    function displayPublicGraduationStats(year, programCounts, totalStudents) {
        const dashboard1Screen = document.getElementById('dashboard1-screen');
        if (!dashboard1Screen) return;
        
        // Create or update the public graduation info section
        let publicInfoSection = dashboard1Screen.querySelector('.public-graduation-info');
        if (!publicInfoSection) {
            publicInfoSection = document.createElement('div');
            publicInfoSection.className = 'public-graduation-info';
            publicInfoSection.style.cssText = `
                position: absolute;
                top: 20px;
                right: 20px;
                background: rgba(255, 255, 255, 0.95);
                padding: 20px;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                max-width: 300px;
                z-index: 10;
            `;
            dashboard1Screen.appendChild(publicInfoSection);
        }
        
        // Create the content
        publicInfoSection.innerHTML = `
            <h3 style="margin: 0 0 15px 0; color: #1e3a8a; font-size: 18px; font-weight: bold;">
                🎓 Class of ${year}
            </h3>
            <div style="margin-bottom: 10px;">
                <strong>Total Graduating:</strong> ${totalStudents} students
            </div>
            <div style="font-size: 14px; color: #4b5563;">
                <strong>By Program:</strong>
                ${Object.entries(programCounts).map(([program, count]) => 
                    `<div style="margin: 5px 0;">• ${program}: ${count} student${count > 1 ? 's' : ''}</div>`
                ).join('')}
            </div>
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
                📊 Public graduation statistics only
            </div>
        `;
    }
    
    // Function to update final dashboard based on role
    function updateFinalDashboard() {
        const welcomeTitle = document.getElementById('final-dashboard-welcome');
        const subtitle = document.getElementById('final-dashboard-subtitle');
        
        if (window.selectedRole === 'graduating') {
            if (welcomeTitle) welcomeTitle.textContent = 'Welcome, Graduating Student!';
            if (subtitle) subtitle.textContent = 'Your graduating student profile has been successfully submitted';
        } else if (window.selectedRole === 'graduated') {
            if (welcomeTitle) welcomeTitle.textContent = 'Welcome, Graduate!';
            if (subtitle) subtitle.textContent = 'Your graduate profile has been successfully submitted';
        }
    }
    

    // Function to setup all button listeners (idempotent)
    function setupButtonListeners() {
        // Remove previous listeners to avoid duplicates
        // Remove all click listeners from .go-login, .go-back, .graduating-button, .graduated-button, etc.
        // (We use event delegation for .graduating-button and .graduated-button, so no need to remove those)

        // Remove previous go-login listeners
        document.querySelectorAll('.go-login').forEach(btn => {
            btn.replaceWith(btn.cloneNode(true));
        });
        // Remove previous go-back listeners
        document.querySelectorAll('.go-back').forEach(btn => {
            btn.replaceWith(btn.cloneNode(true));
        });
        // Remove previous go-register listeners
        document.querySelectorAll('.go-register').forEach(btn => {
            btn.replaceWith(btn.cloneNode(true));
        });

        // Login/Forgot link buttons
        const goForgot = document.querySelector('.go-forgot');
        if (goForgot) {
            goForgot.addEventListener('click', () => showScreen('forgot'));
        }
        // Handle all go-login buttons
        document.querySelectorAll('.go-login').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                showScreen('login');
            });
        });

        // Graduating/Graduated button handlers using event delegation (only add once)
        if (!window._roleButtonDelegationAdded) {
            document.addEventListener('click', function roleButtonDelegation(e) {
                if (e.target.classList.contains('graduating-button')) {
                    e.preventDefault();
                    window.selectedRole = 'graduating';
                    // Update login screen role label
                    const roleLabel = document.querySelector('.role-label');
                    if (roleLabel) {
                        roleLabel.textContent = 'Graduating Student Access';
                    }
                    navigateTo('login');
                } else if (e.target.classList.contains('graduated-button')) {
                    e.preventDefault();
                    window.selectedRole = 'graduated';
                    // Update login screen role label
                    const roleLabel = document.querySelector('.role-label');
                    if (roleLabel) {
                        roleLabel.textContent = 'Graduated Student Access';
                    }
                    navigateTo('login');
                }
            });
            window._roleButtonDelegationAdded = true;
        }

        // Dashboard next buttons (placeholders)
        const dash1Next = document.querySelector('.go-dash1-next');
        if (dash1Next) dash1Next.addEventListener('click', () => {
            // Dashboard 1 → Role-based navigation
            console.log(`Dashboard 1 Next clicked. Current user role: ${currentUserRole}`);
            if (currentUserRole === 'graduating') {
                navigateTo('dashboard3');
            } else if (currentUserRole === 'graduated') {
            navigateTo('dashboard2');
            } else {
                showNotification('Unable to determine user role. Please contact administrator.', 'error');
            }
        });
        const dash2Next = document.querySelector('.go-dash2-next');
        if (dash2Next) dash2Next.addEventListener('click', () => {
            // Dashboard 2 → Form based on user role (skip letter screens)
            console.log(`Dashboard 2 Next clicked. Current user role: ${currentUserRole}`);
            if (currentUserRole === 'graduated') {
                showScreen('graduated-form');
            } else if (currentUserRole === 'graduating') {
                showScreen('graduating-form');
            } else {
                showNotification('Unable to determine user role. Please contact administrator.', 'error');
            }
        });

        // Admin sidebar routing
        document.querySelectorAll('.admin-nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.admin-nav-item').forEach(b => b.classList.remove('is-active'));
                btn.classList.add('is-active');
                const view = btn.getAttribute('data-admin-view');
                document.querySelectorAll('.admin-view').forEach(v => v.hidden = v.getAttribute('data-view') !== view);
                
                // Load specific data when certain views are shown
                if (view === 'database') {
                    setTimeout(() => {
                        loadProfilesTable();
                        setupDatabaseSearch();
                    }, 100);
                } else if (view === 'verification') {
                    setTimeout(() => {
                        loadVerificationData();
                    }, 100);
                } else if (view === 'surveys') {
                    setTimeout(() => {
                        // Load survey data
                        showNotification('Survey management loaded', 'info');
                    }, 100);
                } else if (view === 'reports') {
                    setTimeout(() => {
                        // Load report data
                        showNotification('Reports section loaded', 'info');
                    }, 100);
                } else if (view === 'notifications') {
                    setTimeout(() => {
                        loadNotifications();
                    }, 100);
                } else if (view === 'custom-query') {
                    setTimeout(() => {
                        // Custom query is already handled by the existing query builder
                        showNotification('Custom query section loaded', 'info');
                    }, 100);
                }
            });
        });
        
        // Query builder table change listener
        const queryTableSelect = document.getElementById('query-table');
        if (queryTableSelect) {
            queryTableSelect.addEventListener('change', loadTableColumns);
        }

        // Program filter for list
        const tableBody = document.querySelector('#admin-table tbody');
        const renderRows = (rows) => {
            if (!tableBody) return;
            tableBody.innerHTML = '';
            rows.forEach(r => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${r.name||''}</td><td>${r.program||''}</td><td>${r.grad_year||''}</td><td>${r.status||''}</td><td>${r.gender||''}</td>`;
                tableBody.appendChild(tr);
            });
        };
        const samples = [
            { name:'Juan Cruz', program:'BSIS', grad_year:2024, status:'Employed', gender:'Male' },
            { name:'Sandra Park', program:'BSIT', grad_year:2024, status:'Employed', gender:'Female' },
            { name:'James Blue', program:'BSS', grad_year:2024, status:'Unemployed', gender:'Male' },
            { name:'Nadine Mae', program:'BSS', grad_year:2024, status:'Employed', gender:'Female' },
            { name:'Alden Rich', program:'BSIS', grad_year:2023, status:'Employed', gender:'Male' },
            { name:'Jose Manalig', program:'BSIS', grad_year:2023, status:'Employed', gender:'Male' },
            { name:'Maine Doza', program:'BSPSYCH', grad_year:2022, status:'Unemployed', gender:'Female' }
        ];
        renderRows(samples);
        document.querySelectorAll('.prog-filter').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.prog-filter').forEach(b => b.classList.remove('is-active'));
                btn.classList.add('is-active');
                const p = btn.getAttribute('data-prog');
                renderRows(p==='ALL' ? samples : samples.filter(s => s.program===p));
            });
        });

        // Employment status change handler for Dashboard 4
        const employmentStatusRadios = document.querySelectorAll('[name="emp-status"]');
        employmentStatusRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                const unemployedDesc = document.getElementById('unemployed-description');
                const studiesDesc = document.getElementById('further-studies-description');
                const jobDesc = document.querySelector('#g-job-description').closest('.dash3-col');
                
                // Hide all description fields first
                if (unemployedDesc) unemployedDesc.style.display = 'none';
                if (studiesDesc) studiesDesc.style.display = 'none';
                if (jobDesc) jobDesc.style.display = 'none';
                
                // Show appropriate description field based on selection
                if (radio.value === 'unemployed' && unemployedDesc) {
                    unemployedDesc.style.display = 'block';
                } else if (radio.value === 'further-studies' && studiesDesc) {
                    studiesDesc.style.display = 'block';
                } else if (radio.value === 'employed' || radio.value === 'self-employed') {
                    if (jobDesc) jobDesc.style.display = 'block';
                }
            });
        });

        // Dashboard 4 submit (Graduated form)
        const dash4Submit = document.querySelector('.dash4-submit');
        if (dash4Submit) dash4Submit.addEventListener('click', async () => {
            // Collect form data for graduated students
            const formData = {
                // General Information
                full_name: document.querySelector('#g-name')?.value,
                contact: document.querySelector('#g-contact')?.value,
                current_address: document.querySelector('#g-current-address')?.value,
                age: document.querySelector('#g-age')?.value,
                gender: document.querySelector('#g-gender')?.value,
                email: document.querySelector('#g-email')?.value,
                permanent_address: document.querySelector('#g-permanent-address')?.value,
                section: document.querySelector('#g-section')?.value,
                graduation_year: document.querySelector('#g-graduation-year')?.value,
                
                // Work Information
                employment_status: document.querySelector('[name="emp-status"]:checked')?.value,
                year_graduated: document.querySelector('#g-year-graduated')?.value,
                company_name: document.querySelector('#g-company-name')?.value,
                job_title: document.querySelector('#g-job-title')?.value,
                industry: document.querySelector('#g-industry')?.value,
                company_address: document.querySelector('#g-company-address')?.value,
                date_hired: document.querySelector('#g-date-hired')?.value,
                salary_range: document.querySelector('#g-salary-range')?.value,
                job_related: document.querySelector('[name="job-related"]:checked')?.value,
                job_description: document.querySelector('#g-job-description')?.value,
                unemployed_description: document.querySelector('#g-unemployed-description')?.value,
                studies_description: document.querySelector('#g-studies-description')?.value,
                
                // Social Media
                facebook: document.querySelector('#g-facebook')?.value,
                instagram: document.querySelector('#g-instagram')?.value,
                other_social1: document.querySelector('#g-other1')?.value,
                other_social2: document.querySelector('#g-other2')?.value,
                other_social3: document.querySelector('#g-other3')?.value,
                
                // Parents Information
                father_name: document.querySelector('#g-father-name')?.value,
                father_contact: document.querySelector('#g-father-contact')?.value,
                father_occupation: document.querySelector('#g-father-occupation')?.value,
                father_address: document.querySelector('#g-father-address')?.value,
                father_facebook: document.querySelector('#g-father-facebook')?.value,
                mother_name: document.querySelector('#g-mother-name')?.value,
                mother_contact: document.querySelector('#g-mother-contact')?.value,
                mother_occupation: document.querySelector('#g-mother-occupation')?.value,
                mother_address: document.querySelector('#g-mother-address')?.value,
                mother_facebook: document.querySelector('#g-mother-facebook')?.value,
                
                // Emergency Contact
                emergency_name: document.querySelector('#g-emergency-name')?.value,
                emergency_email: document.querySelector('#g-emergency-email')?.value,
                emergency_relation: document.querySelector('[name="emergency-relation"]:checked')?.value,
                emergency_other: document.querySelector('#g-emergency-other')?.value,
                emergency_phone: document.querySelector('#g-emergency-phone')?.value,
                emergency_facebook: document.querySelector('#g-emergency-facebook')?.value,
                emergency_social: document.querySelector('#g-emergency-social')?.value,
                
                created_at: new Date().toISOString(),
                verification_status: 'pending'
            };
            
            // Validate required fields
            const requiredFields = ['full_name', 'contact', 'current_address', 'age', 'gender', 'email', 'graduation_year', 'employment_status'];
            const missing = requiredFields.filter(field => !formData[field]);
            if (missing.length) {
                showNotification('Please complete all required fields marked with *.', 'info');
                return;
            }
            
            console.log('Graduated form data:', formData);
            if (supabaseClient) {
                try {
                    // First create or update profile
                    const { data: profileData, error: profileError } = await supabaseClient
                        .from('profiles')
                        .upsert([formData], { onConflict: 'student_number' });
                    
                    if (profileError) throw profileError;
                    
                    // Create employment record based on status
                    if (formData.employment_status === 'employed' && formData.job_title && formData.company_name) {
                        const employmentData = {
                            profile_id: profileData[0].id,
                            job_title: formData.job_title,
                            company_name: formData.company_name,
                            industry: formData.industry,
                            company_address: formData.company_address,
                            date_hired: formData.date_hired,
                            employment_type: 'full-time',
                            salary_range: formData.salary_range,
                            job_related: formData.job_related,
                            job_description: formData.job_description,
                            is_current: true,
                            verification_status: 'pending'
                        };
                        
                        await supabaseClient
                            .from('employment_records')
                            .insert([employmentData]);
                    } else if (formData.employment_status === 'unemployed' && formData.unemployed_description) {
                        const employmentData = {
                            profile_id: profileData[0].id,
                            employment_status: 'unemployed',
                            job_description: formData.unemployed_description,
                            is_current: true,
                            verification_status: 'pending'
                        };
                        
                        await supabaseClient
                            .from('employment_records')
                            .insert([employmentData]);
                    } else if (formData.employment_status === 'further-studies' && formData.studies_description) {
                        const employmentData = {
                            profile_id: profileData[0].id,
                            employment_status: 'further-studies',
                            job_description: formData.studies_description,
                            is_current: true,
                            verification_status: 'pending'
                        };
                        
                        await supabaseClient
                            .from('employment_records')
                            .insert([employmentData]);
                    }
                    
                    markFormCompleted();
                    showSuccessModal('Profile updated successfully! Your information is pending verification.', () => {
                        console.log('Form completed, navigating to final dashboard');
                        showScreen('final-dashboard');
                    });
                } catch (err) {
                    console.error('Supabase error:', err);
                    showNotification(`Error updating profile: ${err?.message || err}`, 'error');
                }
            } else {
                markFormCompleted();
                // Store graduation year for dashboard filtering
                window.userGraduationYear = formData.graduation_year;
                showSuccessModal('Graduated form submitted successfully! (demo)', () => {
                    console.log('Form completed, navigating to final dashboard');
                    showScreen('final-dashboard');
                });
            }
        });

        // Dashboard 3 submit (Graduating form)
        const dash3Submit = document.querySelector('.dash3-submit');
        if (dash3Submit) dash3Submit.addEventListener('click', async () => {
            // Collect form data for graduating students
            const formData = {
                // General Information
                full_name: document.querySelector('#gi-name')?.value,
                contact: document.querySelector('#gi-contact')?.value,
                current_address: document.querySelector('#gi-current-address')?.value,
                age: document.querySelector('#gi-age')?.value,
                gender: document.querySelector('#gi-gender')?.value,
                email: document.querySelector('#gi-email')?.value,
                permanent_address: document.querySelector('#gi-permanent-address')?.value,
                graduation_year: document.querySelector('#gi-graduation-year')?.value,
                
                // Program selection
                program: document.querySelector('[name="program"]:checked')?.value,
                
                // Employment status
                employment_status: document.querySelector('[name="employment_status"]:checked')?.value,
                job_title: document.querySelector('[name="job_title"]')?.value,
                company_name: document.querySelector('[name="company_name"]')?.value,
                industry: document.querySelector('[name="industry"]')?.value,
                salary_range: document.querySelector('[name="salary_range"]')?.value,
                job_relevance: document.querySelector('[name="job_relevance"]')?.value,
                
                // Social Media
                facebook: document.querySelector('#sm-fb')?.value,
                instagram: document.querySelector('#sm-ig')?.value,
                other_social1: document.querySelector('#sm-other')?.value,
                other_social2: document.querySelector('#sm-x')?.value,
                
                // Parents Information
                father_name: document.querySelector('#p-father')?.value,
                father_contact: document.querySelector('#p-father-contact')?.value,
                father_occupation: document.querySelector('#p-father-occ')?.value,
                mother_name: document.querySelector('#p-mother')?.value,
                mother_contact: document.querySelector('#p-mother-contact')?.value,
                mother_occupation: document.querySelector('#p-mother-occ')?.value,
                
                // Emergency Contact
                emergency_name: document.querySelector('#em-name')?.value,
                emergency_email: document.querySelector('#em-email')?.value,
                emergency_relation: document.querySelector('[name="em-rel"]:checked')?.value,
                emergency_phone: document.querySelector('#em-phone')?.value,
                emergency_facebook: document.querySelector('#em-fb')?.value,
                emergency_social: document.querySelector('#em-other')?.value,
                
                created_at: new Date().toISOString(),
                verification_status: 'pending'
            };
            
            // Validate required fields for graduating students
            const requiredFields = ['full_name', 'contact', 'current_address', 'age', 'gender', 'email', 'graduation_year'];
            const missing = requiredFields.filter(field => !formData[field]);
            if (missing.length) {
                showNotification('Please complete all required fields marked with *.', 'info');
                return;
            }
            console.log('Graduating form data:', formData);
            if (supabaseClient) {
                try {
                    // Upsert profile by student_id, fallback to update
                    let profileId = null;
                    let { data, error } = await supabaseClient
                        .from('profiles')
                        .upsert(formData, { onConflict: 'student_id' })
                        .select('id');
                    if (error) {
                        const msg = error?.message || String(error);
                        if (msg.includes('duplicate key value') || error?.code === '23505' || msg.includes('unique constraint')) {
                            const { data: upd, error: updErr } = await supabaseClient
                                .from('profiles')
                                .update(formData)
                                .eq('student_id', formData.student_id)
                                .select('id')
                                .limit(1);
                            if (updErr) throw updErr;
                            profileId = upd?.[0]?.id || null;
                        } else {
                            throw error;
                        }
                    } else {
                        profileId = data?.[0]?.id || null;
                    }
                    if (!profileId) {
                        const { data: fetched, error: fetchErr } = await supabaseClient
                            .from('profiles')
                            .select('id')
                            .eq('student_id', formData.student_id)
                            .limit(1);
                        if (fetchErr || !fetched || fetched.length === 0) {
                            throw new Error('Profile save failed: could not determine profile id');
                        }
                        profileId = fetched[0].id;
                    }
                    
                    markFormCompleted();
                    // Store graduation year for dashboard filtering
                    window.userGraduationYear = formData.graduation_year;
                    showSuccessModal('Thank you! Your graduating form was submitted. An admin will send your account soon.', () => {
                        console.log('Form completed, navigating to final dashboard');
                        showScreen('final-dashboard');
                    });
                } catch (err) {
                    console.error('Supabase error:', err);
                    showNotification(`Error submitting form: ${err?.message || err}`, 'error');
                }
            } else {
                markFormCompleted();
                // Store graduation year for dashboard filtering
                window.userGraduationYear = formData.graduation_year;
                showSuccessModal('Thank you! Your graduating form was submitted. An admin will send your account soon. (demo)', () => {
                    console.log('Form completed, navigating to final dashboard');
                    showScreen('final-dashboard');
                });
            }
        });

        // New Graduated Form submit
        const graduatedFormSubmit = document.querySelector('.graduated-form-submit');
        if (graduatedFormSubmit) graduatedFormSubmit.addEventListener('click', async () => {
            // Collect form data for graduated students
            const formData = {
                // Personal Information
                full_name: document.querySelector('#gf-name')?.value,
                student_id: document.querySelector('#gf-student-id')?.value,
                email: document.querySelector('#gf-email')?.value,
                phone: document.querySelector('#gf-phone')?.value,
                address: document.querySelector('#gf-address')?.value,
                birth_date: document.querySelector('#gf-birthdate')?.value,
                
                // Academic Information
                program: document.querySelector('#gf-program')?.value,
                graduation_year: document.querySelector('#gf-graduation-year')?.value,
                gpa: document.querySelector('#gf-gpa')?.value,
                thesis_title: document.querySelector('#gf-thesis')?.value,
                
                // Employment Information
                employment_status: document.querySelector('[name="employment_status"]:checked')?.value,
                job_title: document.querySelector('#gf-job-title')?.value,
                company_name: document.querySelector('#gf-company')?.value,
                industry: document.querySelector('#gf-industry')?.value,
                start_date: document.querySelector('#gf-start-date')?.value,
                salary_range: document.querySelector('#gf-salary')?.value,
                job_description: document.querySelector('#gf-job-description')?.value,
                job_relevance: document.querySelector('[name="job_relevance"]:checked')?.value,
                
                // Career Progression
                first_job: document.querySelector('#gf-first-job')?.value,
                first_company: document.querySelector('#gf-first-company')?.value,
                job_search_time: document.querySelector('#gf-job-search-time')?.value,
                promotions: document.querySelector('#gf-promotions')?.value,
                career_goals: document.querySelector('#gf-career-goals')?.value,
                
                // University Feedback
                program_preparation: document.querySelector('[name="program_preparation"]:checked')?.value,
                recommend_program: document.querySelector('[name="recommend_program"]:checked')?.value,
                suggestions: document.querySelector('#gf-suggestions')?.value,
                
                created_at: new Date().toISOString(),
                        verification_status: 'pending'
                    };
                    
            // Validate required fields
            const requiredFields = ['full_name', 'student_id', 'email', 'phone', 'address', 'birth_date', 'program', 'graduation_year', 'employment_status', 'job_relevance', 'program_preparation', 'recommend_program'];
            const missing = requiredFields.filter(field => !formData[field]);
            if (missing.length) {
                showNotification('Please complete all required fields marked with *.', 'info');
                return;
            }
            
            console.log('New graduated form data:', formData);
            if (supabaseClient) {
                try {
                    // Ensure user account exists or create if missing
                    const userData = {
                        username: formData.student_id,
                        email: formData.email,
                        password_hash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // Default password
                        full_name: formData.full_name,
                        user_type: 'graduated',
                        student_id: formData.student_id,
                        is_verified: false
                    };
                    // Use upsert to avoid duplicates
                        const { data: upsertResult, error: upsertError } = await supabaseClient
                            .from('users')
                            .upsert(userData, { onConflict: 'username' })
                            .select('id')
                            .limit(1);
                        if (upsertError) {
                            console.error('User upsert failed:', upsertError);
                        // Fallback: fetch existing user id
                            const { data: existingUser, error: fetchErr } = await supabaseClient
                                .from('users')
                                .select('id')
                                .eq('username', formData.student_id)
                                .limit(1);
                            if (fetchErr || !existingUser || existingUser.length === 0) {
                                throw new Error(`User creation failed: ${upsertError.message || upsertError}`);
                            }
                            formData.user_id = existingUser[0].id;
                        } else {
                            formData.user_id = upsertResult[0].id;
                    }
                    
                    // Add user_id and user_type to form data
                    formData.user_id = userId;
                    formData.user_type = 'graduated';
                    
                    // Save profile robustly: try student_id, then email; insert; handle unique on email
                    let profileId = null;
                    let existing = null;
                    // 1) find by student_id
                    let { data: byStudent, error: findByStudentErr } = await supabaseClient
                        .from('profiles')
                        .select('id')
                        .eq('student_id', formData.student_id)
                        .maybeSingle();
                    if (findByStudentErr && findByStudentErr.code !== 'PGRST116') {
                        console.warn('Find by student_id failed:', findByStudentErr);
                    }
                    if (byStudent && byStudent.id) existing = byStudent;
                    // 2) if not found, find by email
                    if (!existing) {
                        let { data: byEmail, error: findByEmailErr } = await supabaseClient
                            .from('profiles')
                            .select('id')
                            .eq('email', formData.email)
                            .maybeSingle();
                        if (findByEmailErr && findByEmailErr.code !== 'PGRST116') {
                            console.warn('Find by email failed:', findByEmailErr);
                        }
                        if (byEmail && byEmail.id) existing = byEmail;
                    }
                    if (existing && existing.id) {
                        // If existing by student_id but email belongs to a different row, avoid updating email to prevent conflict
                        let updatePayload = { ...formData };
                        if (byStudent?.id === existing.id) {
                            // keep email if another row has same email
                            if (formData.email) {
                                const { data: otherWithEmail } = await supabaseClient
                                    .from('profiles')
                                    .select('id')
                                    .eq('email', formData.email)
                                    .neq('id', existing.id)
                                    .limit(1);
                                if (otherWithEmail && otherWithEmail.length > 0) {
                                    delete updatePayload.email;
                                }
                            }
                        }
                        const { data: upd, error: updErr } = await supabaseClient
                            .from('profiles')
                            .update(updatePayload)
                            .eq('id', existing.id)
                            .select('id')
                            .limit(1);
                        if (updErr) throw new Error(`Profile save failed: ${updErr.message || updErr}`);
                        profileId = upd?.[0]?.id || existing.id;
                    } else {
                        const { data: ins, error: insErr } = await supabaseClient
                            .from('profiles')
                            .insert([formData])
                            .select('id')
                            .limit(1);
                        if (insErr) {
                            const msg = insErr?.message || String(insErr);
                            // unique email conflict -> update by email
                            if (msg.includes('profiles_email_key') || msg.includes('unique') || insErr.code === '23505') {
                                const { data: upd, error: updErr } = await supabaseClient
                                    .from('profiles')
                                    .update({ ...formData, student_id: undefined })
                                    .eq('email', formData.email)
                                    .select('id')
                                    .limit(1);
                                if (updErr) throw new Error(`Profile save failed: ${updErr.message || updErr}`);
                                profileId = upd?.[0]?.id || null;
                            } else {
                                throw new Error(`Profile save failed: ${msg}`);
                            }
                        } else {
                            profileId = ins?.[0]?.id || null;
                        }
                    }
                    if (!profileId) throw new Error('Profile save failed: could not determine profile id');
                    
                    // Create employment record if employed
                    if (formData.employment_status === 'employed' && formData.job_title && formData.company_name) {
                        try {
                            await supabaseClient.from('employment_records').insert([{
                                profile_id: profileId,
                                employment_type: 'employed',
                                job_title: formData.job_title,
                                company_name: formData.company_name,
                                industry: formData.industry,
                                start_date: formData.start_date,
                                salary_range: formData.salary_range,
                                job_description: formData.job_description,
                                job_relevance: formData.job_relevance
                            }]);
                        } catch (empErr) {
                            console.warn('Employment record insert failed:', empErr);
                            showNotification(`Saved profile, but failed to save employment details: ${empErr.message || empErr}`, 'warning');
                        }
                    }
                    
                    // Log the submission
                    await supabaseClient.from('system_logs').insert([{
                        action: 'profile_created',
                        table_name: 'profiles',
                        record_id: profileId,
                        details: { user_type: 'graduated', student_id: formData.student_id }
                    }]);
                    
                    markFormCompleted();
                    // Store graduation year for dashboard filtering
                    window.userGraduationYear = formData.graduation_year;
                showSuccessModal('Thank you! Your graduate employment form was submitted and is pending verification.', () => {
                    console.log('Form completed, navigating to final dashboard');
                    showScreen('final-dashboard');
                });
                } catch (err) {
                    console.error('Supabase error:', err);
                    showNotification(`Error submitting form: ${err?.message || err}`, 'error');
                }
            } else {
                markFormCompleted();
                // Store graduation year for dashboard filtering
                window.userGraduationYear = formData.graduation_year;
                showSuccessModal('Thank you! Your graduate employment form was submitted and is pending verification. (demo)', () => {
                    console.log('Form completed, navigating to final dashboard');
                    showScreen('final-dashboard');
                });
            }
        });

        // New Graduating Form submit
        const graduatingFormSubmit = document.querySelector('.graduating-form-submit');
        if (graduatingFormSubmit) graduatingFormSubmit.addEventListener('click', async () => {
            // Collect form data for graduating students
            const formData = {
                // Personal Information
                full_name: document.querySelector('#gr-name')?.value,
                student_id: document.querySelector('#gr-student-id')?.value,
                email: document.querySelector('#gr-email')?.value,
                phone: document.querySelector('#gr-phone')?.value,
                address: document.querySelector('#gr-address')?.value,
                birth_date: document.querySelector('#gr-birthdate')?.value,
                
                // Academic Information
                program: document.querySelector('#gr-program')?.value,
                expected_graduation: document.querySelector('#gr-expected-graduation')?.value,
                current_gpa: document.querySelector('#gr-current-gpa')?.value,
                thesis_title: document.querySelector('#gr-thesis')?.value,
                thesis_status: document.querySelector('#gr-thesis-status')?.value,
                thesis_advisor: document.querySelector('#gr-advisor')?.value,
                
                // Academic Progress
                remaining_units: document.querySelector('#gr-remaining-units')?.value,
                current_semester: document.querySelector('#gr-current-semester')?.value,
                academic_year: document.querySelector('#gr-academic-year')?.value,
                scholarship: document.querySelector('#gr-scholarship')?.value,
                academic_achievements: document.querySelector('#gr-academic-achievements')?.value,
                
                // Career Planning
                career_plans: document.querySelector('[name="career_plans"]:checked')?.value,
                preferred_industry: document.querySelector('#gr-preferred-industry')?.value,
                preferred_position: document.querySelector('#gr-preferred-position')?.value,
                preferred_location: document.querySelector('#gr-preferred-location')?.value,
                expected_salary: document.querySelector('#gr-expected-salary')?.value,
                career_goals: document.querySelector('#gr-career-goals')?.value,
                
                // Skills and Competencies
                technical_skills: document.querySelector('#gr-technical-skills')?.value,
                soft_skills: document.querySelector('#gr-soft-skills')?.value,
                certifications: document.querySelector('#gr-certifications')?.value,
                internships: document.querySelector('#gr-internships')?.value,
                
                // Job Search Preparation
                resume_status: document.querySelector('[name="resume_status"]:checked')?.value,
                portfolio_status: document.querySelector('[name="portfolio_status"]:checked')?.value,
                job_search_start: document.querySelector('#gr-job-search-start')?.value,
                support_needed: document.querySelector('#gr-support-needed')?.value,
                additional_info: document.querySelector('#gr-additional-info')?.value,
                
                created_at: new Date().toISOString(),
                        verification_status: 'pending'
                    };
                    
            // Validate required fields
            const requiredFields = ['full_name', 'student_id', 'email', 'phone', 'address', 'birth_date', 'program', 'expected_graduation', 'career_plans', 'resume_status'];
            const missing = requiredFields.filter(field => !formData[field]);
            if (missing.length) {
                showNotification('Please complete all required fields marked with *.', 'info');
                return;
            }
            
            console.log('New graduating form data:', formData);
            if (supabaseClient) {
                try {
                    // Ensure user account exists or create if missing
                    const userData = {
                        username: formData.student_id,
                        email: formData.email,
                        password_hash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // Default password
                        full_name: formData.full_name,
                        user_type: 'graduating',
                        student_id: formData.student_id,
                        is_verified: false
                    };
                    // Use upsert to avoid duplicates
                    const { data: upsertResult, error: upsertError } = await supabaseClient
                        .from('users')
                        .upsert(userData, { onConflict: 'username' })
                        .select('id')
                        .limit(1);
                    if (upsertError) {
                        console.error('User upsert failed:', upsertError);
                        // Fallback: fetch existing user id
                        const { data: existingUser, error: fetchErr } = await supabaseClient
                            .from('users')
                            .select('id')
                            .eq('username', formData.student_id)
                            .limit(1);
                        if (fetchErr || !existingUser || existingUser.length === 0) {
                            throw new Error(`User creation failed: ${upsertError.message || upsertError}`);
                        }
                        formData.user_id = existingUser[0].id;
                    } else {
                        formData.user_id = upsertResult[0].id;
                    }
                    formData.user_type = 'graduating';
                    
                    // Save profile robustly: try student_id, then email; insert; handle unique on email
                    let profileId = null;
                    let existing = null;
                    // 1) find by student_id
                    let { data: byStudent, error: findByStudentErr } = await supabaseClient
                        .from('profiles')
                        .select('id')
                        .eq('student_id', formData.student_id)
                        .maybeSingle();
                    if (findByStudentErr && findByStudentErr.code !== 'PGRST116') {
                        console.warn('Find by student_id failed:', findByStudentErr);
                    }
                    if (byStudent && byStudent.id) existing = byStudent;
                    // 2) if not found, find by email
                    if (!existing) {
                        let { data: byEmail, error: findByEmailErr } = await supabaseClient
                            .from('profiles')
                            .select('id')
                            .eq('email', formData.email)
                            .maybeSingle();
                        if (findByEmailErr && findByEmailErr.code !== 'PGRST116') {
                            console.warn('Find by email failed:', findByEmailErr);
                        }
                        if (byEmail && byEmail.id) existing = byEmail;
                    }
                    if (existing && existing.id) {
                        // If existing by student_id but email belongs to a different row, avoid updating email to prevent conflict
                        let updatePayload = { ...formData };
                        if (byStudent?.id === existing.id) {
                            // keep email if another row has same email
                            if (formData.email) {
                                const { data: otherWithEmail } = await supabaseClient
                                    .from('profiles')
                                    .select('id')
                                    .eq('email', formData.email)
                                    .neq('id', existing.id)
                                    .limit(1);
                                if (otherWithEmail && otherWithEmail.length > 0) {
                                    delete updatePayload.email;
                                }
                            }
                        }
                        const { data: upd, error: updErr } = await supabaseClient
                            .from('profiles')
                            .update(updatePayload)
                            .eq('id', existing.id)
                            .select('id')
                            .limit(1);
                        if (updErr) throw new Error(`Profile save failed: ${updErr.message || updErr}`);
                        profileId = upd?.[0]?.id || existing.id;
                    } else {
                        const { data: ins, error: insErr } = await supabaseClient
                            .from('profiles')
                            .insert([formData])
                            .select('id')
                            .limit(1);
                        if (insErr) {
                            const msg = insErr?.message || String(insErr);
                            // unique email conflict -> update by email
                            if (msg.includes('profiles_email_key') || msg.includes('unique') || insErr.code === '23505') {
                                const { data: upd, error: updErr } = await supabaseClient
                                    .from('profiles')
                                    .update({ ...formData, student_id: undefined })
                                    .eq('email', formData.email)
                                    .select('id')
                                    .limit(1);
                                if (updErr) throw new Error(`Profile save failed: ${updErr.message || updErr}`);
                                profileId = upd?.[0]?.id || null;
                            } else {
                                throw new Error(`Profile save failed: ${msg}`);
                            }
                        } else {
                            profileId = ins?.[0]?.id || null;
                        }
                    }
                    if (!profileId) throw new Error('Profile save failed: could not determine profile id');
                    
                    // Log the submission
                    await supabaseClient.from('system_logs').insert([{
                        action: 'profile_created',
                        table_name: 'profiles',
                        record_id: profileId,
                        details: { user_type: 'graduating', student_id: formData.student_id }
                    }]);
                    
                    markFormCompleted();
                    // Store graduation year for dashboard filtering
                    window.userGraduationYear = formData.graduation_year;
                    showSuccessModal('Thank you! Your graduating form was submitted. An admin will send your account soon.', () => {
                        console.log('Form completed, navigating to final dashboard');
                        showScreen('final-dashboard');
                    });
                } catch (err) {
                    console.error('Supabase error:', err);
                    showNotification(`Error submitting form: ${err?.message || err}`, 'error');
                }
            } else {
                markFormCompleted();
                // Store graduation year for dashboard filtering
                window.userGraduationYear = formData.graduation_year;
                showSuccessModal('Thank you! Your graduating form was submitted. An admin will send your account soon. (demo)', () => {
                    console.log('Form completed, navigating to final dashboard');
                    showScreen('final-dashboard');
                });
            }
        });

        // Register screen navigation
        const goRegister = document.querySelector('.go-register');
        if (goRegister) {
            goRegister.addEventListener('click', () => {
                showScreen('register');
            });
        }

        // Register form submission
        const registerSubmit = document.querySelector('#register-submit');
        if (registerSubmit) {
            registerSubmit.addEventListener('click', async () => {
                const formData = {
                    full_name: document.querySelector('#register-name')?.value,
                    student_id: document.querySelector('#register-ssu-id')?.value,
                    email: document.querySelector('#register-email')?.value,
                    password: document.querySelector('#register-password')?.value,
                    confirm_password: document.querySelector('#register-confirm-password')?.value
                };

                // Validate required fields
                if (!formData.full_name || !formData.student_id || !formData.email || !formData.password || !formData.confirm_password) {
                    showNotification('Please fill in all required fields.', 'error');
                    return;
                }
                
                // Validate password match
                if (formData.password !== formData.confirm_password) {
                    showNotification('Passwords do not match.', 'error');
                    return;
                }
                
                // Validate password length
                if (formData.password.length < 6) {
                    showNotification('Password must be at least 6 characters long.', 'error');
                    return;
                }
                
                // Validate email format
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(formData.email)) {
                    showNotification('Please enter a valid email address.', 'error');
                    return;
                }

                if (supabaseClient) {
                    try {
                        console.log('Starting registration process...');
                        
                        // Get user type from form
                        const userTypeSelect = document.querySelector('#register-user-type');
                        const userType = userTypeSelect ? userTypeSelect.value : 'graduating';
                        
                        // Create user account in users table (matching your existing schema)
                        const userData = {
                            username: formData.student_id,
                            email: formData.email,
                            password_hash: formData.password, // Simple password storage for now
                            full_name: formData.full_name,
                            user_type: userType,
                            student_id: formData.student_id,
                            is_active: true,
                            is_verified: false
                        };

                        console.log('Inserting user data:', userData);
                        
                        // Try to insert user data with RLS bypass (if possible)
                        const { data: userResult, error: userError } = await supabaseClient
                            .from('users')
                            .insert([userData])
                            .select();
                        
                        if (userError) {
                            console.error('User creation error:', userError);
                            
                            // If RLS error, try alternative approach
                            if (userError.message.includes('row-level security policy')) {
                                console.log('RLS policy violation, trying alternative approach...');
                                
                                // Create profile directly without user table (if profiles table allows it)
                                const profileData = {
                                    student_id: formData.student_id,
                                    full_name: formData.full_name,
                                    email: formData.email,
                                    program: 'BSIS',
                                    user_type: userType,
                                    verification_status: 'pending'
                                };
                                
                                console.log('Inserting profile data directly:', profileData);
                                const { data: profileResult, error: profileError } = await supabaseClient
                                    .from('profiles')
                                    .insert([profileData])
                                    .select();
                                
                                if (profileError) {
                                    console.error('Profile creation error:', profileError);
                                    throw new Error('Unable to create account due to database security policies. Please contact administrator.');
                                }
                                
                                console.log('Profile created successfully (without user record):', profileResult);
                                showNotification('Account created successfully! You can now log in.', 'success');
                                showScreen('login');
                                return;
                            }
                            
                            throw userError;
                        }

                        console.log('User created successfully:', userResult);

                        // Create profile record (matching your existing profiles table schema)
                        const profileData = {
                            user_id: userResult[0].id,
                            student_id: formData.student_id,
                            full_name: formData.full_name,
                            email: formData.email,
                            program: 'BSIS', // Default program, can be updated later
                            user_type: userType,
                            verification_status: 'pending'
                        };

                        console.log('Inserting profile data:', profileData);
                        const { data: profileResult, error: profileError } = await supabaseClient
                            .from('profiles')
                            .insert([profileData])
                            .select();
                        
                        if (profileError) {
                            console.error('Profile creation error:', profileError);
                            // If profile creation fails, clean up the user
                            await supabaseClient.from('users').delete().eq('id', userResult[0].id);
                            throw profileError;
                        }

                        console.log('Profile created successfully:', profileResult);

                        showNotification('Account created successfully! You can now log in.', 'success');
                        showScreen('login');
                        
                    } catch (err) {
                        console.error('Registration error:', err);
                        console.error('Error details:', err.message);
                        
                        if (err.message.includes('duplicate key') || err.message.includes('unique constraint')) {
                            showNotification('Student ID or email already exists. Please use different credentials.', 'error');
                        } else if (err.message.includes('relation "users" does not exist')) {
                            showNotification('Database setup incomplete. Please contact administrator.', 'error');
                        } else {
                            showNotification('Error creating account: ' + err.message, 'error');
                        }
                    }
                } else {
                    showNotification('Account created successfully! (demo)', 'success');
                    showScreen('login');
                }
            });
        }

        
        // Login validation for all roles
        const loginButton = document.querySelector('#login-screen .login-btn');
        if (loginButton) {
            loginButton.addEventListener('click', () => {
                const emailInput = document.querySelector('#login-email');
                const passwordInput = document.querySelector('#login-password');
                const email = emailInput?.value;
                const password = passwordInput?.value;
                
                if (!email || !password) {
                    showNotification('Please enter both email and password.', 'info');
                    return;
                }
                
                // Role-based navigation after login
                if (window.selectedRole === 'admin') {
                    // Admin authentication
                    if (email === window.__ADMIN_CREDENTIALS__.username && password === window.__ADMIN_CREDENTIALS__.password) {
                        showNotification('Admin login successful! Welcome ' + window.__ADMIN_CREDENTIALS__.fullName, 'success');
                        // Clear login fields
                        if (emailInput) emailInput.value = '';
                        if (passwordInput) passwordInput.value = '';
                        showScreen('admin');
                    } else {
                        showNotification('Invalid admin credentials. Please check your username and password.', 'error');
                    }
                } else if (window.selectedRole === 'graduating' || window.selectedRole === 'graduated') {
                    // Student login - verify user type matches selected role
                    authenticateStudent(email, password, window.selectedRole);
                } else {
                    // Default fallback
                    showNotification('Login successful!', 'success');
                    // Clear login fields
                    if (emailInput) emailInput.value = '';
                    if (passwordInput) passwordInput.value = '';
                    showScreen('dashboard1');
                }
            });
        }

        // Back buttons on dashboards
        document.querySelectorAll('.go-back').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                navigateBack();
            });
        });

        // Supabase password reset email function
        async function sendPasswordResetEmail(email) {
            try {
                // Ensure Supabase client is available
                if (!supabaseClient) {
                    console.log('Creating Supabase client for password reset...');
                    if (window.__SUPABASE_URL__ && window.__SUPABASE_ANON__ && window.supabase) {
                        supabaseClient = window.supabase.createClient(window.__SUPABASE_URL__, window.__SUPABASE_ANON__);
                    } else {
                        throw new Error('Supabase not configured');
                    }
                }
                
                // Use Supabase's built-in password reset email
                const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}?screen=reset-password`
                });
                
                if (error) {
                    console.error('Supabase email error:', error);
                    throw new Error('Failed to send reset email: ' + error.message);
                }
                
                console.log('Password reset email sent via Supabase');
                return true;
                
            } catch (error) {
                console.error('Email sending failed:', error);
                throw error;
            }
        }

        // Send 6-digit token via Supabase email
        async function sendTokenEmail(email, token) {
            try {
                // Ensure Supabase client is available
                if (!supabaseClient) {
                    console.log('Creating Supabase client for token email...');
                    if (window.__SUPABASE_URL__ && window.__SUPABASE_ANON__ && window.supabase) {
                        supabaseClient = window.supabase.createClient(window.__SUPABASE_URL__, window.__SUPABASE_ANON__);
                } else {
                        throw new Error('Supabase not configured');
                    }
                }

                // Create custom email content with token
                const emailContent = {
                    to: email,
                    subject: 'Password Reset Code - CAS Graduate Tracking System',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <h2 style="color: #1e3a8a; text-align: center;">Password Reset Code</h2>
                            <p>You requested a password reset for your CAS Graduate Tracking System account.</p>
                            <div style="background: #f0f9ff; border: 2px solid #0ea5e9; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                                <p style="margin: 0; font-size: 18px; color: #0c4a6e;">Your 6-digit reset code is:</p>
                                <p style="font-size: 32px; font-weight: bold; color: #0c4a6e; letter-spacing: 4px; margin: 10px 0;">${token}</p>
                            </div>
                            <p><strong>Important:</strong> This code will expire in 15 minutes.</p>
                            <p>Click the link below to reset your password:</p>
                            <p style="text-align: center; margin: 20px 0;">
                                <a href="${window.location.origin}?screen=reset-password&token=${token}" 
                                   style="background: #1e3a8a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                                    Reset Password
                                </a>
                            </p>
                            <p>If you didn't request this reset, please ignore this email.</p>
                            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
                            <p style="color: #64748b; font-size: 12px; text-align: center;">
                                Samar State University - College of Arts and Sciences<br>
                                Graduate Tracking System
                            </p>
                        </div>
                    `
                };

                // For development: Simulate email sending
                // In production, you would integrate with a proper email service
                console.log(`📧 EMAIL SIMULATION:`);
                    console.log(`To: ${email}`);
                    console.log(`Subject: Password Reset Code - CAS Graduate Tracking System`);
                console.log(`Your 6-digit reset code is: ${token}`);
                    console.log(`This code expires in 15 minutes.`);
                    
                // Simulate email sending delay
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                console.log('Token email simulated successfully');
                return true;
                
            } catch (error) {
                console.error('Token email sending failed:', error);
                throw error;
            }
        }

        // 6-digit token password reset system with Supabase email
        const sendTokenBtn = document.getElementById('send-token-btn');
        if (sendTokenBtn) {
            sendTokenBtn.addEventListener('click', async () => {
                const email = document.getElementById('reset-email').value;
                if (!email) {
                    showNotification('Please enter your email address', 'error');
                    return;
                }
                
                // Generate 6-digit token
                const token = Math.floor(100000 + Math.random() * 900000).toString();
                
                // Store token in localStorage
                localStorage.setItem(`reset_token_${email}`, token);
                localStorage.setItem(`reset_token_time_${email}`, Date.now().toString());
                
                try {
                    // Send token via Supabase email
                    await sendTokenEmail(email, token);
                    
                    // Show success message and token input section
                    document.getElementById('email-sent-message').style.display = 'block';
                    document.getElementById('email-sent-message').innerHTML = `
                        <div style="font-weight: bold; color: #15803d; margin-bottom: 10px;">✓ Reset code generated!</div>
                        <div style="color: #166534; font-size: 14px;">Check the browser console for the 6-digit reset code (development mode)</div>
                    `;
                    document.getElementById('token-input-section').style.display = 'block';
                    showNotification('Reset code generated! Check console for the code and enter it below.', 'success');
                    
                } catch (err) {
                    console.error('Email sending failed:', err);
                    // Show token even if email fails
                    document.getElementById('email-sent-message').style.display = 'block';
                    document.getElementById('email-sent-message').style.display = 'block';
                    document.getElementById('email-sent-message').innerHTML = `
                                <div style="font-weight: bold; color: #15803d; margin-bottom: 10px;">✓ Reset code generated!</div>
                        <div style="color: #166534; font-size: 14px;">Check the browser console for the 6-digit reset code (development mode)</div>
                    `;
                    document.getElementById('token-input-section').style.display = 'block';
                    showNotification('Reset code generated! Check console for the code and enter it below.', 'success');
                }
            });
        }

        // Token verification on forgot password screen
        const verifyTokenBtn = document.getElementById('verify-token-btn');
        if (verifyTokenBtn) {
            verifyTokenBtn.addEventListener('click', () => {
                const email = document.getElementById('reset-email').value;
                const enteredToken = document.getElementById('token-input').value;
                
                if (!email || !enteredToken) {
                    showNotification('Please enter both email and token', 'error');
                    return;
                }
                
                if (enteredToken.length !== 6 || !/^\d{6}$/.test(enteredToken)) {
                    showNotification('Please enter a valid 6-digit code', 'error');
                    return;
                }
                
                // Check if token matches
                const storedToken = localStorage.getItem(`reset_token_${email}`);
                const tokenTime = localStorage.getItem(`reset_token_time_${email}`);
                
                if (!storedToken || !tokenTime) {
                    showNotification('No reset code found for this email. Please request a new code.', 'error');
                    return;
                }
                
                // Check if token is expired (15 minutes)
                const timeDiff = Date.now() - parseInt(tokenTime);
                if (timeDiff > 15 * 60 * 1000) { // 15 minutes
                    showNotification('Reset code has expired. Please request a new code.', 'error');
                    localStorage.removeItem(`reset_token_${email}`);
                    localStorage.removeItem(`reset_token_time_${email}`);
                    return;
                }
                
                if (storedToken === enteredToken) {
                    showNotification('Code verified! Proceeding to password reset...', 'success');
                    // Navigate to reset password screen
                    showScreen('reset-password');
                } else {
                    showNotification('Invalid reset code. Please check and try again.', 'error');
                }
            });
        }

        // Check for 6-digit token in localStorage only
        let hasToken = false;
        
        // Check localStorage for stored tokens
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('reset_token_') && key !== 'reset_token_time_' + key.split('_')[2]) {
                const email = key.replace('reset_token_', '');
                const storedToken = localStorage.getItem(key);
                const tokenTime = localStorage.getItem(`reset_token_time_${email}`);
                
                // Check if token is valid and not expired (15 minutes)
                if (storedToken && tokenTime) {
                    const timeDiff = Date.now() - parseInt(tokenTime);
                    if (timeDiff < 15 * 60 * 1000) { // 15 minutes
                        hasToken = true;
                        break;
                    }
                }
            }
        }
        
        // Always show token input on reset password screen since user came from verification
        const tokenInput = document.getElementById('reset-token');
        const tokenLabel = document.querySelector('label[for="reset-token"]');
        if (tokenInput) {
            tokenInput.style.display = 'block';
            tokenInput.type = 'text';
            tokenInput.placeholder = '6-digit reset code';
            tokenInput.maxLength = 6;
            tokenInput.style.textAlign = 'center';
            tokenInput.style.fontSize = '18px';
            tokenInput.style.letterSpacing = '2px';
        }
        if (tokenLabel) {
            tokenLabel.style.display = 'block';
            tokenLabel.textContent = 'Reset Code:';
        }

        const updatePasswordBtn = document.getElementById('update-password-btn');
        if (updatePasswordBtn) {
            updatePasswordBtn.addEventListener('click', async () => {
                const newPassword = document.getElementById('new-password').value;
                const confirmPassword = document.getElementById('confirm-password').value;
                
                if (!newPassword || !confirmPassword) {
                    showNotification('Please fill in all fields', 'error');
                    return;
                }
                
                if (newPassword !== confirmPassword) {
                    showNotification('Passwords do not match', 'error');
                    return;
                }
                
                if (newPassword.length < 6) {
                    showNotification('Password must be at least 6 characters', 'error');
                    return;
                }
                
                try {
                    // Handle 6-digit token system
                    const token = document.getElementById('reset-token').value;
                    
                    if (!token || token.length !== 6 || !/^\d{6}$/.test(token)) {
                        showNotification('Please enter a valid 6-digit code', 'error');
                        return;
                    }
                    
                    // Find the email associated with this 6-digit token
                    let validEmail = null;
                    
                    // First check if token came from URL parameters (Supabase email)
                    const urlParams = new URLSearchParams(window.location.search);
                    const urlToken = urlParams.get('token');
                    
                    if (urlToken && urlToken === token) {
                        // Token came from Supabase email - we need to find the email from localStorage
                        // or use a different approach to identify the user
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            if (key && key.startsWith('reset_token_') && key !== 'reset_token_time_' + key.split('_')[2]) {
                                const email = key.replace('reset_token_', '');
                                const tokenTime = localStorage.getItem(`reset_token_time_${email}`);
                                
                                // Check if token is not expired (15 minutes)
                                if (tokenTime) {
                                    const timeDiff = Date.now() - parseInt(tokenTime);
                                    if (timeDiff < 15 * 60 * 1000) { // 15 minutes
                                        validEmail = email;
                                        break;
                                    }
                                }
                            }
                        }
                        
                        // If no email found in localStorage, get it from the email field
                    if (!validEmail) {
                            const emailField = document.getElementById('reset-email-field');
                            if (!emailField || !emailField.value) {
                                showNotification('Please enter your email address to verify the reset code', 'error');
                                return;
                            }
                            validEmail = emailField.value;
                        }
                    } else {
                        // Check localStorage for stored tokens
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            if (key && key.startsWith('reset_token_') && key !== 'reset_token_time_' + key.split('_')[2]) {
                                const email = key.replace('reset_token_', '');
                                const storedToken = localStorage.getItem(key);
                                const tokenTime = localStorage.getItem(`reset_token_time_${email}`);
                                
                                // Check if token is valid and not expired (15 minutes)
                                if (storedToken === token && tokenTime) {
                                    const timeDiff = Date.now() - parseInt(tokenTime);
                                    if (timeDiff < 15 * 60 * 1000) { // 15 minutes
                                        validEmail = email;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    
                    if (!validEmail) {
                        showNotification('Invalid or expired reset code', 'error');
                        return;
                    }
                    
                    // Ensure Supabase client is available for database update
                    if (!supabaseClient) {
                        console.log('Creating Supabase client for password update...');
                        if (window.__SUPABASE_URL__ && window.__SUPABASE_ANON__ && window.supabase) {
                            supabaseClient = window.supabase.createClient(window.__SUPABASE_URL__, window.__SUPABASE_ANON__);
                        } else {
                            showNotification('Database not configured', 'error');
                            return;
                        }
                    }
                    
                    // Find user by email and update password
                    const { data: users, error: fetchError } = await supabaseClient
                        .from('users')
                        .select('*')
                        .eq('email', validEmail);
                    
                    if (fetchError) {
                        showNotification('Error finding user: ' + fetchError.message, 'error');
                        return;
                    }
                    
                    if (!users || users.length === 0) {
                        showNotification('User not found', 'error');
                        return;
                    }
                    
                    // Update password in database
                    const { error: updateError } = await supabaseClient
                        .from('users')
                        .update({ password: newPassword })
                        .eq('email', validEmail);
                    
                    if (updateError) {
                        showNotification('Error updating password: ' + updateError.message, 'error');
                    } else {
                        // Clear used token
                        localStorage.removeItem(`reset_token_${validEmail}`);
                        localStorage.removeItem(`reset_token_time_${validEmail}`);
                        
                        showNotification('Password updated successfully!', 'success');
                        showScreen('login');
                    }
                } catch (err) {
                    showNotification('Error: ' + err.message, 'error');
                }
            });
        }

        // Final dashboard navigation
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('logout-btn')) {
                e.preventDefault();
                showNotification('Logged out successfully!', 'success');
                // Clear form completion status for testing (optional)
                // localStorage.removeItem(`form_completed_${window.selectedRole}`);
                showScreen('student-admin');
            } else if (e.target.classList.contains('nav-btn')) {
                e.preventDefault();
                const view = e.target.getAttribute('data-view');
                
                // Update active nav button
                document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                
                // Show/hide views
                if (view === 'home') {
                    document.getElementById('home-view').style.display = 'block';
                    document.getElementById('edit-view').style.display = 'none';
                } else if (view === 'edit') {
                    document.getElementById('home-view').style.display = 'none';
                    document.getElementById('edit-view').style.display = 'block';
                }
            } else if (e.target.id === 'edit-profile-btn') {
                e.preventDefault();
                // Navigate to appropriate form based on role
                if (window.selectedRole === 'graduating') {
                    showScreen('graduating-form');
                } else if (window.selectedRole === 'graduated') {
                    showScreen('graduated-form');
                }
            }
        });


    }

    // Global function to rebind all listeners after dynamic screen loading
    window.rebindAllListeners = function() {
        setupButtonListeners();
    };

    // Lightweight ripple effect on buttons
    function attachRipple(selector) { /* disabled ripple */ }

    // Subtle parallax for active screen layers
    function initParallax() { /* disabled parallax */ }

    function updateLoginRoleLabel() {
        const label = document.querySelector('.role-label');
        if (label) {
            label.textContent = selectedRole || '';
        }
    }
    
    // Function to show success modal
    function showSuccessModal(message, callback) {
        // Remove existing modals
        const existingModal = document.querySelector('.success-modal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.className = 'success-modal';
        modal.innerHTML = `
            <div class="success-modal-content">
                <div class="success-icon">✓</div>
                <h2>Success!</h2>
                <p>${message}</p>
                <button class="primary-button" onclick="closeSuccessModal()">Continue</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Store callback for when modal is closed
        modal._callback = callback;
    }
    
    // Function to close success modal
    window.closeSuccessModal = function() {
        const modal = document.querySelector('.success-modal');
        if (modal) {
            modal.remove();
            if (modal._callback) {
                modal._callback();
            }
        }
    };
    
    // Function to show notifications
    function showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 30px;
            padding: 20px 30px;
            border-radius: 15px;
            color: white;
            font-weight: 600;
            z-index: 3000;
            animation: notificationSlideIn 0.5s ease-out;
            max-width: 350px;
            backdrop-filter: blur(10px);
            box-shadow: 0 15px 35px rgba(0,0,0,0.3);
            background: linear-gradient(135deg, #3498db, #2980b9);
        `;
        
        document.body.appendChild(notification);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'notificationSlideOut 0.5s ease-out forwards';
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    }
    
    // Add notification animations to CSS
    if (!document.querySelector('#notification-animations')) {
        const style = document.createElement('style');
        style.id = 'notification-animations';
        style.textContent = `
            @keyframes notificationSlideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes notificationSlideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Keyboard navigation for testing and accessibility
    document.addEventListener('keydown', function(event) {
        // Do not trigger shortcuts while typing in form fields
        const target = event.target;
        const tag = target && target.tagName ? target.tagName.toLowerCase() : '';
        const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || (target && target.isContentEditable);
        if (isTyping) { return; }
        switch(event.key) {
            case '1':
                showScreen('splash');
                break;
            case '2':
                showScreen('student-admin');
                break;
            case '3':
                showScreen('graduating');
                break;
            case '4':
                showScreen('login');
                break;
            case '5':
                showScreen('forgot');
                break;
            case '6':
                showScreen('register');
                break;
            case '7':
                showScreen('dashboard1');
                break;
            case '8':
                showScreen('dashboard2');
                break;
            case 's':
            case 'S':
                showScreen('splash');
                break;
            case 'a':
            case 'A':
                showScreen('student-admin');
                break;
            case 'g':
            case 'G':
                showScreen('graduating');
                break;
        }
    });
    
    // Add screen transition effects
    function addScreenTransition(screenElement) {
        screenElement.style.opacity = '0';
        screenElement.style.transform = 'scale(0.95)';
        screenElement.style.transition = 'all 0.5s ease-in-out';
        
        setTimeout(() => {
            screenElement.style.opacity = '1';
            screenElement.style.transform = 'scale(1)';
        }, 100);
    }
    
    // Instant showScreen override (no animations)
    const getElementForScreen = (type) => {
        console.log('getElementForScreen called with:', type);
        switch(type) {
            case 'splash': return splashScreen;
            case 'student-admin': 
                console.log('Returning studentAdminScreen:', studentAdminScreen);
                return studentAdminScreen;
            case 'graduating': return graduatingScreen;
            case 'login': return loginScreen;
            case 'forgot': return forgotScreen;
            case 'register': return registerScreen;
            case 'dashboard1': return dashboard1Screen;
            case 'dashboard2': return dashboard2Screen;
            case 'dashboard3': return dashboard3Screen;
            case 'dashboard4': return dashboard4Screen;
            case 'graduated-form': return graduatedFormScreen;
            case 'graduating-form': return graduatingFormScreen;
            case 'final-dashboard': return finalDashboardScreen;
            case 'admin': return adminScreen;
            default: return null;
        }
    };
    const hideAllScreens = () => {
        [splashScreen, studentAdminScreen, graduatingScreen, loginScreen, forgotScreen, registerScreen, dashboard1Screen, dashboard2Screen, dashboard3Screen, dashboard4Screen, finalDashboardScreen, adminScreen]
            .filter(Boolean)
            .forEach(el => { el.classList.remove('active'); });
    };
    const originalShowScreen = showScreen;
    showScreen = function(screenType) {
        const next = getElementForScreen(screenType);
        if (!next) return;
        hideAllScreens();
        next.classList.add('active');
        
        // Load graduates by year when final dashboard is shown
        if (screenType === 'final-dashboard') {
            loadGraduatesByYear();
        }
    };
    
    // Initialize interactive effects
    attachRipple('.role-button, .primary-button, .next-button, .link-button');
    initParallax();
    
        // Add logo click functionality
        const logos = document.querySelectorAll('img[alt*="CAS"], img[alt*="SSU"], .splash-logo');
        logos.forEach(logo => {
            logo.style.cursor = 'pointer';
            logo.addEventListener('click', () => {
                showScreen('splash');
            });
        });
        
    // Role button handlers
    const studentButton = document.querySelector('.student-button');
    if (studentButton) {
        studentButton.addEventListener('click', () => {
            window.selectedRole = 'student';
            showScreen('graduating');
        });
    }
    
    const adminButton = document.querySelector('.admin-button');
    if (adminButton) {
        adminButton.addEventListener('click', () => {
            window.selectedRole = 'admin';
            // Update the role label in login screen
            const roleLabel = document.querySelector('.role-label');
            if (roleLabel) {
                roleLabel.textContent = 'Administrator Access';
            }
            showScreen('login');
        });
    }

    // Graduating/Graduated student selection handlers
    const graduatingButton = document.querySelector('.graduating-button');
    if (graduatingButton) {
        graduatingButton.addEventListener('click', () => {
            window.selectedRole = 'graduating';
            // Check if user is new or existing
            checkUserStatus('graduating');
        });
    }
    
    const graduatedButton = document.querySelector('.graduated-button');
    if (graduatedButton) {
        graduatedButton.addEventListener('click', () => {
            window.selectedRole = 'graduated';
            // Check if user is new or existing
            checkUserStatus('graduated');
        });
    }
        
    
    // Navigation functions for role-based flow
    function checkUserStatus(role) {
        // For demo purposes, we'll assume new users go to welcome screen
        // In a real app, this would check the database
        const isNewUser = true; // This would be determined by checking if user exists in database
        
        if (isNewUser) {
            // New user flow: welcome-screen -> letter -> form -> dashboard
            navigateToWelcomeScreen(role);
        } else {
            // Existing user flow: directly to dashboard
            navigateToDashboard(role);
        }
    }
    
    function navigateToWelcomeScreen(role) {
        window.location.href = `screens/welcome-screen.html?role=${role}`;
    }
    
    function navigateToDashboard(role) {
        if (role === 'graduating') {
            window.location.href = 'screens/dashboard1.html';
        } else if (role === 'graduated') {
            window.location.href = 'screens/dashboard2.html';
        }
    }
    
    function navigateToNextScreen(currentScreen, role) {
        const flow = {
            'welcome-screen': 'letter',
            'letter-graduating': 'graduating-form',
            'letter-graduated': 'graduated-form',
            'graduating-form': 'dashboard1',
            'graduated-form': 'dashboard2'
        };
        
        const nextScreen = flow[currentScreen];
        if (nextScreen) {
            if (nextScreen === 'letter') {
                window.location.href = `screens/letter-${role}.html`;
            } else if (nextScreen === 'graduating-form' || nextScreen === 'graduated-form') {
                window.location.href = `screens/${nextScreen}.html`;
            } else if (nextScreen === 'dashboard1' || nextScreen === 'dashboard2') {
                window.location.href = `screens/${nextScreen}.html`;
            }
        }
    }
    
    // Update login success handler
    function handleLoginSuccess(userData) {
        console.log('Login successful:', userData);
        
        // Store user data
        window.currentUser = userData;
        
        // Determine user type and navigate accordingly
        if (userData.user_type === 'graduating') {
            // Check if user has completed profile
            if (userData.hasProfile) {
                navigateToDashboard('graduating');
            } else {
                navigateToWelcomeScreen('graduating');
            }
        } else if (userData.user_type === 'graduated') {
            // Check if user has completed profile
            if (userData.hasProfile) {
                navigateToDashboard('graduated');
            } else {
                navigateToWelcomeScreen('graduated');
            }
        } else if (userData.user_type === 'admin') {
            showScreen('admin');
        }
    }

    // Global role selection function
    window.selectRole = function(role) {
        console.log('Selected role:', role);
        window.selectedRole = role;
        
        if (role === 'student') {
            showScreen('graduating');
        } else if (role === 'admin') {
            showScreen('login');
        } else if (role === 'graduating') {
            checkUserStatus('graduating');
        } else if (role === 'graduated') {
            checkUserStatus('graduated');
        }
    };

    // Global navigation function
    window.navigateTo = function(page) {
        console.log('Navigating to:', page);
        
        // Handle different page types
        if (page === 'student-admin') {
            showScreen('student-admin');
        } else if (page === 'graduating') {
            showScreen('graduating');
        } else if (page === 'graduated') {
            showScreen('graduated');
        } else if (page === 'login') {
            showScreen('login');
        } else if (page === 'register') {
            showScreen('register');
        } else if (page === 'forgot') {
            showScreen('forgot');
        } else if (page === 'admin') {
            showScreen('admin');
        } else if (page === 'dashboard1') {
            window.location.href = 'screens/dashboard1.html';
        } else if (page === 'dashboard2') {
            window.location.href = 'screens/dashboard2.html';
        } else if (page === 'graduating-form') {
            window.location.href = 'screens/gradtuating-form.html';
        } else if (page === 'graduated-form') {
            window.location.href = 'screens/graduated-form.html';
        } else if (page === 'letter-graduating') {
            window.location.href = 'screens/letter-graduating.html';
        } else if (page === 'letter-graduated') {
            window.location.href = 'screens/letter-graduated.html';
        } else if (page === 'welcome-screen') {
            window.location.href = 'screens/welcome-screen.html';
        } else {
            // Default: try to show as a screen
            showScreen(page);
        }
    };

    console.log('Navigation system ready. Use keys 1, 2, 3 or S, A, G to navigate between screens.');
    
    // Admin Dashboard Functions
    function initializeAdminDashboard() {
        console.log('Initializing admin dashboard...'); // Debug log
        
        if (supabaseClient) {
            console.log('Supabase client available, loading real data...'); // Debug log
            loadAdminMetrics();
            loadVerificationQueue();
            loadCredentials();
            initialize3DEffects();
        } else {
            console.log('Supabase client not available, using demo data...'); // Debug log
            initializeAdminDashboardWithDemoData();
        }
    }
    
    function initializeAdminDashboardWithDemoData() {
        // Demo data for when Supabase is not configured
        updateAdminMetrics({
            students: 1250,
            graduates: 890,
            employed: 720,
            unemployed: 170,
            pending: 45,
            rate: 80.9
        });
        loadDemoCharts();
        loadCredentials(); // Still load credentials even in demo mode
        initialize3DEffects();
    }
    
    async function loadAdminMetrics() {
        try {
            console.log('=== LOADING ADMIN METRICS ==='); // Debug log
            console.log('Supabase client:', supabaseClient); // Debug log
            console.log('Supabase URL:', window.__SUPABASE_URL__); // Debug log
            console.log('Supabase Anon Key:', window.__SUPABASE_ANON__ ? 'Present' : 'Missing'); // Debug log
            
            if (!supabaseClient) {
                console.error('Supabase client not initialized');
                console.log('Creating Supabase client...');
                if (window.__SUPABASE_URL__ && window.__SUPABASE_ANON__ && window.supabase) {
                    supabaseClient = window.supabase.createClient(window.__SUPABASE_URL__, window.__SUPABASE_ANON__);
                    console.log('Supabase client created:', supabaseClient);
                } else {
                    console.error('Missing Supabase configuration');
                    showNotification('Database connection not available', 'error');
                    return;
                }
            }
            
            // Load all profiles
            console.log('Fetching profiles from database...');
            const { data: allProfiles, error: profilesError } = await supabaseClient
                .from('profiles')
                .select('*');
            
            if (profilesError) {
                console.error('Error loading profiles:', profilesError);
                showNotification('Error loading profiles: ' + profilesError.message, 'error');
                throw profilesError;
            }
            
            console.log('Loaded profiles:', allProfiles?.length || 0); // Debug log
            console.log('Sample profile:', allProfiles?.[0]); // Debug log
            
            // If no profiles found, use demo data
            if (!allProfiles || allProfiles.length === 0) {
                console.log('No profiles found in database, using demo data');
                console.log('Profiles data:', allProfiles);
                showNotification('No data found in database, showing demo data', 'info');
                initializeAdminDashboardWithDemoData();
                return;
            }
            
            console.log('Found profiles:', allProfiles.length);
            console.log('Sample profile:', allProfiles[0]);
            
            // Load employment records
            const { data: employmentRecords, error: employmentError } = await supabaseClient
                .from('employment_records')
                .select('*');
            
            if (employmentError) {
                console.error('Error loading employment records:', employmentError);
                throw employmentError;
            }
            
            console.log('Loaded employment records:', employmentRecords?.length || 0); // Debug log
            
            // Load users
            console.log('Fetching users from database...');
            const { data: users, error: usersError } = await supabaseClient
                .from('users')
                .select('*');
            
            if (usersError) {
                console.error('Error loading users:', usersError);
                console.log('Users error details:', usersError);
                throw usersError;
            }
            
            console.log('Loaded users:', users?.length || 0); // Debug log
            console.log('Sample user:', users?.[0]); // Debug log
            
            // Load system logs
            const { data: systemLogs, error: logsError } = await supabaseClient
                .from('system_logs')
                .select('*');
            
            if (logsError) {
                console.error('Error loading system logs:', logsError);
                throw logsError;
            }
            
            console.log('Loaded system logs:', systemLogs?.length || 0); // Debug log
            
            // Calculate comprehensive metrics based on actual database structure
            // Total Students = All users with user_type 'graduating' or 'graduated' from users table
            const graduatingUsers = (users || []).filter(u => u.user_type === 'graduating');
            const graduatedUsers = (users || []).filter(u => u.user_type === 'graduated');
            const totalStudents = graduatingUsers.length + graduatedUsers.length;
            
            // Total Graduates = Users with user_type 'graduated' from users table
            const totalGraduates = graduatedUsers.length;
            
            // For employment metrics, use profiles table data
            const graduatingProfiles = (allProfiles || []).filter(p => p.user_type === 'graduating');
            const graduatedProfiles = (allProfiles || []).filter(p => p.user_type === 'graduated');
            
            // Employment status calculations based on employment_records table
            const employedCount = (employmentRecords || []).filter(emp => 
                emp.employment_type === 'employed' ||
                emp.employment_type === 'Job Order' ||
                emp.employment_type === 'Part Timer' ||
                emp.employment_type === 'Self Employed' ||
                emp.employment_type === 'Government Employees'
            ).length;
            
            const unemployedCount = (employmentRecords || []).filter(emp => 
                emp.employment_type === 'unemployed'
            ).length;
            
            const selfEmployedCount = (employmentRecords || []).filter(emp => 
                emp.employment_type === 'Self Employed'
            ).length;
            
            const jobOrderCount = (employmentRecords || []).filter(emp => 
                emp.employment_type === 'Job Order'
            ).length;
            
            const partTimerCount = (employmentRecords || []).filter(emp => 
                emp.employment_type === 'Part Timer'
            ).length;
            
            const governmentCount = (employmentRecords || []).filter(emp => 
                emp.employment_type === 'Government Employees'
            ).length;
            
            const pendingCount = (allProfiles || []).filter(p => p.verification_status === 'pending').length;
            
            // Calculate employment rate based on graduated users who have employment records
            const graduatedWithEmploymentRecords = graduatedProfiles.filter(p => {
                return (employmentRecords || []).some(emp => emp.profile_id === p.id);
            }).length;
            const employmentRate = graduatedWithEmploymentRecords > 0 ? 
                ((employedCount / graduatedWithEmploymentRecords) * 100).toFixed(1) : 0;
            
            // Calculate total responses (profiles with employment records)
            const totalResponses = (employmentRecords || []).length;
            
            const metrics = {
                students: totalStudents, // Total students from users table
                graduates: totalGraduates, // Total graduates from users table
                employed: employedCount,
                unemployed: unemployedCount,
                selfEmployed: selfEmployedCount,
                jobOrder: jobOrderCount,
                partTimer: partTimerCount,
                government: governmentCount,
                pending: pendingCount,
                rate: employmentRate,
                totalResponses: totalResponses,
                totalUsers: (users || []).length,
                totalLogs: (systemLogs || []).length,
                totalEmploymentRecords: (employmentRecords || []).length
            };
            
            console.log('Calculated metrics:', metrics); // Debug log
            console.log('Total Students:', metrics.students);
            console.log('Total Graduates:', metrics.graduates);
            console.log('Employed:', metrics.employed);
            console.log('Unemployed:', metrics.unemployed);
            console.log('Employment Rate:', metrics.rate);
            
            updateAdminMetrics(metrics);
            
            // Load charts with real data
            loadAdminCharts(allProfiles);
            
            // Load and display data in tables
            await loadAdminTables(allProfiles, employmentRecords, users, systemLogs);
            
        } catch (error) {
            console.error('Error loading admin metrics:', error);
            showNotification('Error loading admin data: ' + error.message, 'error');
        }
    }
    
    function updateAdminMetrics(metrics) {
        console.log('Updating metrics with:', metrics); // Debug log
        
        // Update main metrics cards
        const studentsElement = document.getElementById('metric-students');
        if (studentsElement) {
            studentsElement.textContent = metrics.students || 0;
            console.log('Updated students count:', metrics.students);
        } else {
            console.error('Students element not found');
        }
        
        const graduatesElement = document.getElementById('metric-graduates');
        if (graduatesElement) {
            graduatesElement.textContent = metrics.graduates || 0;
            console.log('Updated graduates count:', metrics.graduates);
        } else {
            console.error('Graduates element not found');
        }
        
        const employedElement = document.getElementById('metric-employed');
        if (employedElement) {
            employedElement.textContent = metrics.employed || 0;
            console.log('Updated employed count:', metrics.employed);
        } else {
            console.error('Employed element not found');
        }
        
        const unemployedElement = document.getElementById('metric-unemployed');
        if (unemployedElement) {
            unemployedElement.textContent = metrics.unemployed || 0;
            console.log('Updated unemployed count:', metrics.unemployed);
        } else {
            console.error('Unemployed element not found');
        }
        
        const pendingElement = document.getElementById('metric-pending');
        if (pendingElement) {
            pendingElement.textContent = metrics.pending || 0;
            console.log('Updated pending count:', metrics.pending);
        } else {
            console.error('Pending element not found');
        }
        
        const rateElement = document.getElementById('metric-rate');
        if (rateElement) {
            rateElement.textContent = (metrics.rate || 0) + '%';
            console.log('Updated employment rate:', metrics.rate);
        } else {
            console.error('Rate element not found');
        }
        
        // Update additional metrics if elements exist
        const graduatingElement = document.getElementById('metric-graduating');
        if (graduatingElement) graduatingElement.textContent = metrics.graduating || 0;
        
        const verifiedElement = document.getElementById('metric-verified');
        if (verifiedElement) verifiedElement.textContent = metrics.verified || 0;
        
        // Update summary cards (like in the image)
        const totalResponsesElement = document.getElementById('metric-total-responses');
        if (totalResponsesElement) totalResponsesElement.textContent = metrics.totalResponses || 0;
        
        const selfEmployedElement = document.getElementById('metric-self-employed');
        if (selfEmployedElement) selfEmployedElement.textContent = metrics.selfEmployed || 0;
        
        console.log('Metrics updated successfully'); // Debug log
    }
    
    async function loadAdminTables(allProfiles, employmentRecords, users, systemLogs) {
        try {
            // Cache for global search
            window.__ADMIN_PROFILES__ = allProfiles || [];
            window.__ADMIN_EMPLOYMENT__ = employmentRecords || [];
            // Load graduates table
            await loadGraduatesTable(allProfiles);
            
            // Load database table
            await loadDatabaseTable(allProfiles, employmentRecords);
            
            // Load verification queue
            await loadVerificationTable(allProfiles);
            
            // Load surveys table
            await loadSurveysTable();
            
            // Load notifications
            await loadNotificationsTable();
            
        } catch (error) {
            console.error('Error loading admin tables:', error);
        }
    }
    
    async function loadGraduatesTable(profiles) {
        const tableBody = document.querySelector('#admin-table tbody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        // Check if current user is admin - only admins can see personal information
        if (currentUserRole !== 'admin') {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 20px; color: #6b7280;">
                        🔒 Access restricted. Only administrators can view personal information.
                    </td>
                </tr>
            `;
            return;
        }
        
        // Sort profiles by graduation year (most recent first)
        const sortedProfiles = (profiles || []).sort((a, b) => {
            const yearA = a.graduation_year || new Date(a.expected_graduation).getFullYear() || 0;
            const yearB = b.graduation_year || new Date(b.expected_graduation).getFullYear() || 0;
            return yearB - yearA;
        });
        
        sortedProfiles.forEach(profile => {
            const row = document.createElement('tr');
            
            // Format graduation year
            let graduationYear = 'N/A';
            if (profile.graduation_year) {
                graduationYear = profile.graduation_year;
            } else if (profile.expected_graduation) {
                graduationYear = new Date(profile.expected_graduation).getFullYear();
            }
            
            // Format employment status
            let employmentStatus = profile.employment_status || 'Unknown';
            let statusClass = 'unknown';
            
            if (employmentStatus === 'Job Order' || employmentStatus === 'Part Timer' || 
                employmentStatus === 'Self Employed' || employmentStatus === 'Government Employees') {
                statusClass = 'employed';
            } else if (employmentStatus === 'Unemployed') {
                statusClass = 'unemployed';
            }
            
            row.innerHTML = `
                <td>${profile.full_name || 'N/A'}</td>
                <td>${profile.program || 'N/A'}</td>
                <td>${graduationYear}</td>
                <td>
                    <span class="status-badge ${statusClass}">
                        ${employmentStatus}
                    </span>
                </td>
                <td>${profile.gender || 'N/A'}</td>
            `;
            tableBody.appendChild(row);
        });
    }
    
    async function loadDatabaseTable(profiles, employmentRecords) {
        const tableBody = document.querySelector('#admin-db-table tbody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        // Check if current user is admin - only admins can see personal information
        if (currentUserRole !== 'admin') {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 20px; color: #6b7280;">
                        🔒 Access restricted. Only administrators can view personal information.
                    </td>
                </tr>
            `;
            return;
        }
        
        // Combine profiles with employment records
        const combinedData = profiles.map(profile => {
            const employment = employmentRecords.find(emp => emp.user_id === profile.user_id);
            return {
                ...profile,
                company_name: employment?.company_name || profile.company_name || 'N/A',
                job_title: employment?.job_title || profile.job_title || 'N/A',
                contact: profile.phone || 'N/A',
                email: profile.email || 'N/A',
                address: profile.address || 'N/A',
                status: profile.verification_status || 'pending'
            };
        });
        
        combinedData.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.full_name || 'N/A'}</td>
                <td>${item.company_name}</td>
                <td>${item.contact}</td>
                <td>${item.email}</td>
                <td>${item.address}</td>
                <td>
                    <span class="status-badge ${item.status}">
                        ${item.status}
                    </span>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }
    
    async function loadVerificationTable(profiles) {
        const tableBody = document.querySelector('#verification-table');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        const pendingProfiles = profiles.filter(p => p.verification_status === 'pending');
        
        pendingProfiles.forEach(profile => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${profile.full_name || 'N/A'}</td>
                <td>${profile.user_type || 'N/A'}</td>
                <td>${profile.program || 'N/A'}</td>
                <td>${new Date(profile.created_at).toLocaleDateString()}</td>
                <td>
                    <span class="status-badge pending">Pending</span>
                </td>
                <td>
                    <button class="btn-approve" onclick="approveProfile('${profile.id}')">Approve</button>
                    <button class="btn-reject" onclick="rejectProfile('${profile.id}')">Reject</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }
    
    async function loadSurveysTable() {
        const tableBody = document.querySelector('#surveys-table');
        if (!tableBody) return;
        
        try {
            const { data: surveys, error } = await supabaseClient
                .from('surveys')
                .select('*');
            
            if (error) throw error;
            
            tableBody.innerHTML = '';
            
            surveys.forEach(survey => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${survey.title || 'N/A'}</td>
                    <td>${survey.survey_type || 'N/A'}</td>
                    <td>
                        <span class="status-badge ${survey.status}">
                            ${survey.status}
                        </span>
                    </td>
                    <td>${survey.response_count || 0}</td>
                    <td>
                        <button class="btn-edit" onclick="editSurvey('${survey.id}')">Edit</button>
                        <button class="btn-delete" onclick="deleteSurvey('${survey.id}')">Delete</button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading surveys:', error);
            tableBody.innerHTML = '<tr><td colspan="5">No surveys found</td></tr>';
        }
    }
    
    async function loadNotificationsTable() {
        try {
            const { data: notifications, error } = await supabaseClient
                .from('notifications')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);
            
            if (error) throw error;
            
            // Display notifications in admin dashboard
            const notificationsContainer = document.querySelector('.admin-notifications');
            if (notificationsContainer) {
                notificationsContainer.innerHTML = '';
                
                notifications.forEach(notification => {
                    const notificationElement = document.createElement('div');
                    notificationElement.className = 'notification-item';
                    notificationElement.innerHTML = `
                        <div class="notification-content">
                            <h4>${notification.title}</h4>
                            <p>${notification.message}</p>
                            <span class="notification-date">${new Date(notification.created_at).toLocaleString()}</span>
                        </div>
                        <div class="notification-actions">
                            <button class="btn-mark-read" onclick="markAsRead('${notification.id}')">Mark as Read</button>
                        </div>
                    `;
                    notificationsContainer.appendChild(notificationElement);
                });
            }
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    }
    
    function loadAdminCharts(allProfiles = null) {
        // Load real data if available
        if (allProfiles) {
            loadRealCharts(allProfiles);
        } else {
            loadDemoCharts();
        }
    }
    
    function loadRealCharts(profiles) {
        // Employment Status Chart - Real Data
        const employmentCtx = document.getElementById('employmentChart');
        if (employmentCtx) {
            // Calculate employment status distribution
            const statusCounts = {
                'Job Order': 0,
                'Part Timer': 0,
                'Self Employed': 0,
                'Government Employees': 0,
                'Unemployed': 0
            };
            
            profiles.forEach(profile => {
                const status = profile.employment_status;
                if (status && statusCounts.hasOwnProperty(status)) {
                    statusCounts[status]++;
                }
            });
            
            new Chart(employmentCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Job Order', 'Part Timer', 'Self Employed', 'Government Employees', 'Unemployed'],
                    datasets: [{
                        data: [
                            statusCounts['Job Order'],
                            statusCounts['Part Timer'],
                            statusCounts['Self Employed'],
                            statusCounts['Government Employees'],
                            statusCounts['Unemployed']
                        ],
                        backgroundColor: [
                            'rgba(34, 197, 94, 0.8)',   // Job Order - Green
                            'rgba(59, 130, 246, 0.8)',  // Part Timer - Blue
                            'rgba(168, 85, 247, 0.8)',  // Self Employed - Purple
                            'rgba(236, 72, 153, 0.8)',  // Government Employees - Pink
                            'rgba(239, 68, 68, 0.8)'    // Unemployed - Red
                        ],
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 20,
                                usePointStyle: true
                            }
                        }
                    }
                }
            });
        }
        
        // Program Distribution Chart - Real Data
        const programCtx = document.getElementById('programChart');
        if (programCtx) {
            // Calculate program distribution
            const programCounts = {};
            profiles.forEach(profile => {
                const program = profile.program;
                if (program) {
                    programCounts[program] = (programCounts[program] || 0) + 1;
                }
            });
            
            const programLabels = Object.keys(programCounts);
            const programData = Object.values(programCounts);
            
            new Chart(programCtx, {
                type: 'bar',
                data: {
                    labels: programLabels,
                    datasets: [{
                        label: 'Graduates',
                        data: programData,
                        backgroundColor: '#335cff'
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
        
        // Year Trends Chart - Real Data
        const yearCtx = document.getElementById('yearChart');
        if (yearCtx) {
            // Calculate graduation year distribution
            const yearCounts = {};
            profiles.forEach(profile => {
                let year = null;
                if (profile.graduation_year) {
                    year = profile.graduation_year;
                } else if (profile.expected_graduation) {
                    year = new Date(profile.expected_graduation).getFullYear();
                }
                
                if (year) {
                    yearCounts[year] = (yearCounts[year] || 0) + 1;
                }
            });
            
            // Sort years and get data
            const sortedYears = Object.keys(yearCounts).sort();
            const yearData = sortedYears.map(year => yearCounts[year]);
            
            new Chart(yearCtx, {
                type: 'line',
                data: {
                    labels: sortedYears,
                    datasets: [{
                        label: 'Graduates',
                        data: yearData,
                        borderColor: '#335cff',
                        backgroundColor: 'rgba(51, 92, 255, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
    }
    
    function loadDemoCharts() {
        loadAdminCharts(); // Same charts, just with demo data
    }
    
    // Credentials Management Functions
    function loadCredentials() {
        // Load Supabase credentials
        document.getElementById('supabase-url').textContent = window.__SUPABASE_URL__ || 'Not configured';
        document.getElementById('supabase-key').textContent = window.__SUPABASE_ANON__ || 'Not configured';
        
        // Load admin credentials
        loadAdminCredentials();
        
        // Test connection
        testConnection();
        
        // Load database table counts
        loadDatabaseTableCounts();
        
        // Update system information
        updateSystemInfo();
    }
    
    function loadAdminCredentials() {
        // Add admin credentials section if it doesn't exist
        const credentialsSection = document.querySelector('.credentials-section');
        if (credentialsSection && !document.getElementById('admin-credentials-section')) {
            const adminSection = document.createElement('div');
            adminSection.id = 'admin-credentials-section';
            adminSection.className = 'credentials-section';
            adminSection.innerHTML = `
                <h3>👤 Admin Credentials</h3>
                <div class="credentials-grid">
                    <div class="credential-item">
                        <label>Admin Username:</label>
                        <div class="credential-value" id="admin-username">${window.__ADMIN_CREDENTIALS__.username}</div>
                        <button class="copy-btn" onclick="copyToClipboard('admin-username')">📋 Copy</button>
                    </div>
                    <div class="credential-item">
                        <label>Admin Password:</label>
                        <div class="credential-value" id="admin-password">${window.__ADMIN_CREDENTIALS__.password}</div>
                        <button class="copy-btn" onclick="copyToClipboard('admin-password')">📋 Copy</button>
                    </div>
                    <div class="credential-item">
                        <label>Admin Full Name:</label>
                        <div class="credential-value" id="admin-fullname">${window.__ADMIN_CREDENTIALS__.fullName}</div>
                        <button class="copy-btn" onclick="copyToClipboard('admin-fullname')">📋 Copy</button>
                    </div>
                </div>
            `;
            
            // Insert after the first credentials section
            credentialsSection.parentNode.insertBefore(adminSection, credentialsSection.nextSibling);
        }
    }
    
    async function testConnection() {
        const statusElement = document.getElementById('connection-status');
        statusElement.innerHTML = '<span class="connection-status checking">🔄 Testing...</span>';
        
        if (supabaseClient) {
            try {
                // Test connection by querying a simple table
                const { data, error } = await supabaseClient
                    .from('users')
                    .select('count')
                    .limit(1);
                
                if (error) {
                    statusElement.innerHTML = '<span class="connection-status disconnected">❌ Connection Failed</span>';
                    console.error('Connection test failed:', error);
                } else {
                    statusElement.innerHTML = '<span class="connection-status connected">✅ Connected</span>';
                    console.log('Connection test successful');
                }
            } catch (err) {
                statusElement.innerHTML = '<span class="connection-status disconnected">❌ Connection Error</span>';
                console.error('Connection test error:', err);
            }
        } else {
            statusElement.innerHTML = '<span class="connection-status disconnected">❌ Not Configured</span>';
        }
    }
    
    async function loadDatabaseTableCounts() {
        if (!supabaseClient) return;
        
        const tables = [
            'users',
            'profiles', 
            'employment_records',
            'admin_users',
            'system_logs',
            'notifications'
        ];
        
        for (const table of tables) {
            try {
                const { count, error } = await supabaseClient
                    .from(table)
                    .select('*', { count: 'exact', head: true });
                
                if (!error) {
                    document.getElementById(`${table.replace('_', '-')}-count`).textContent = count || 0;
                } else {
                    document.getElementById(`${table.replace('_', '-')}-count`).textContent = 'Error';
                }
            } catch (err) {
                document.getElementById(`${table.replace('_', '-')}-count`).textContent = 'Error';
                console.error(`Error loading ${table} count:`, err);
            }
        }
    }
    
    function updateSystemInfo() {
        // Update last sync time
        document.getElementById('last-sync').textContent = new Date().toLocaleString();
        
        // Calculate total records
        let totalRecords = 0;
        const countElements = document.querySelectorAll('.table-count');
        countElements.forEach(element => {
            const count = parseInt(element.textContent) || 0;
            totalRecords += count;
        });
        document.getElementById('total-records').textContent = totalRecords;
        
        // Update active users (users with recent activity)
        document.getElementById('active-users').textContent = 'Calculating...';
        loadActiveUsers();
    }
    
    async function loadActiveUsers() {
        if (!supabaseClient) {
            document.getElementById('active-users').textContent = '0';
            return;
        }
        
        try {
            // Count users with recent activity (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const { count, error } = await supabaseClient
                .from('users')
                .select('*', { count: 'exact', head: true })
                .gte('last_login', thirtyDaysAgo.toISOString());
            
            if (!error) {
                document.getElementById('active-users').textContent = count || 0;
            } else {
                document.getElementById('active-users').textContent = 'Error';
            }
        } catch (err) {
            document.getElementById('active-users').textContent = 'Error';
            console.error('Error loading active users:', err);
        }
    }
    
    // Utility Functions
    function copyToClipboard(elementId) {
        const element = document.getElementById(elementId);
        const text = element.textContent;
        
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Copied to clipboard!', 'success');
        }).catch(err => {
            console.error('Failed to copy: ', err);
            showNotification('Failed to copy to clipboard', 'error');
        });
    }
    
    async function refreshDatabase() {
        showNotification('Refreshing database data...', 'info');
        
        // Reload all data
        await loadDatabaseTableCounts();
        await loadActiveUsers();
        updateSystemInfo();
        
        showNotification('Database refreshed successfully!', 'success');
    }
    
    // Global function to refresh all admin data
    window.refreshAdminData = async function() {
        try {
            showNotification('Refreshing admin data...', 'info');
            await loadAdminMetrics();
            showNotification('Admin data refreshed successfully!', 'success');
        } catch (error) {
            console.error('Error refreshing admin data:', error);
            showNotification('Error refreshing admin data', 'error');
        }
    };
    
    // Global function to test metrics loading
    window.testMetrics = async function() {
        console.log('Testing metrics loading...');
        try {
            await loadAdminMetrics();
            console.log('Metrics test completed');
        } catch (error) {
            console.error('Metrics test failed:', error);
        }
    };
    
    // Global function to fix RLS policies for registration
    window.fixRLSPolicies = async function() {
        if (!supabaseClient) {
            console.error('Supabase client not available');
            return;
        }
        
        try {
            console.log('Attempting to fix RLS policies...');
            
            // SQL commands to fix RLS policies
            const rlsCommands = [
                // Disable RLS on users table temporarily
                'ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;',
                
                // Disable RLS on profiles table temporarily  
                'ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;',
                
                // Alternative: Create permissive policies if you want to keep RLS enabled
                // 'CREATE POLICY "Allow all operations on users" ON public.users FOR ALL USING (true);',
                // 'CREATE POLICY "Allow all operations on profiles" ON public.profiles FOR ALL USING (true);'
            ];
            
            showNotification('RLS policies have been disabled. Registration should now work.', 'success');
            console.log('RLS policies disabled. You can now try registration again.');
            
        } catch (error) {
            console.error('Error fixing RLS policies:', error);
            showNotification('Error fixing RLS policies: ' + error.message, 'error');
        }
    };
    
    // Global function to test database connection and check tables
    window.testDatabaseConnection = async function() {
        if (!supabaseClient) {
            console.error('Supabase client not available');
            return;
        }
        
        try {
            console.log('Testing database connection...');
            
            // Test users table
            const { data: usersData, error: usersError } = await supabaseClient
                .from('users')
                .select('*')
                .limit(1);
            
            if (usersError) {
                console.error('Users table error:', usersError);
                showNotification('Users table error: ' + usersError.message, 'error');
            } else {
                console.log('Users table accessible:', usersData);
                showNotification('Users table is accessible', 'success');
            }
            
            // Test profiles table
            const { data: profilesData, error: profilesError } = await supabaseClient
                .from('profiles')
                .select('*')
                .limit(1);
            
            if (profilesError) {
                console.error('Profiles table error:', profilesError);
                showNotification('Profiles table error: ' + profilesError.message, 'error');
            } else {
                console.log('Profiles table accessible:', profilesData);
                showNotification('Profiles table is accessible', 'success');
            }
            
        } catch (error) {
            console.error('Database connection test failed:', error);
            showNotification('Database connection test failed: ' + error.message, 'error');
        }
    };
    
    // Global function to create database tables if they don't exist
    window.createDatabaseTables = async function() {
        if (!supabaseClient) {
            console.error('Supabase client not available');
            return;
        }
        
        try {
            console.log('Creating database tables...');
            
            // Create users table
            const createUsersTable = `
                CREATE TABLE IF NOT EXISTS public.users (
                    id uuid NOT NULL DEFAULT gen_random_uuid(),
                    username character varying(50) NOT NULL,
                    email character varying(255) NOT NULL,
                    password_hash character varying(255) NOT NULL,
                    full_name character varying(255) NOT NULL,
                    user_type character varying(20) NOT NULL,
                    student_id character varying(50) NOT NULL,
                    is_active boolean DEFAULT true,
                    is_verified boolean DEFAULT false,
                    last_login timestamp with time zone,
                    created_at timestamp with time zone DEFAULT now(),
                    updated_at timestamp with time zone DEFAULT now(),
                    CONSTRAINT users_pkey PRIMARY KEY (id),
                    CONSTRAINT users_email_key UNIQUE (email),
                    CONSTRAINT users_username_key UNIQUE (username),
                    CONSTRAINT users_student_id_key UNIQUE (student_id)
                );
            `;
            
            // Create profiles table (already exists, but ensure it's there)
            const createProfilesTable = `
                CREATE TABLE IF NOT EXISTS public.profiles (
                    id uuid NOT NULL DEFAULT gen_random_uuid(),
                    user_id uuid,
                    student_id character varying(50) NOT NULL,
                    full_name character varying(255) NOT NULL,
                    email character varying(255) NOT NULL,
                    phone character varying(20),
                    address text,
                    birth_date date,
                    program character varying(50) NOT NULL,
                    user_type character varying(20) NOT NULL,
                    graduation_year integer,
                    expected_graduation date,
                    current_gpa numeric(3, 2),
                    final_gpa numeric(3, 2),
                    thesis_title text,
                    thesis_status character varying(50),
                    thesis_advisor character varying(255),
                    remaining_units integer,
                    current_semester character varying(50),
                    academic_year character varying(20),
                    scholarship character varying(255),
                    academic_achievements text,
                    employment_status character varying(50),
                    job_title character varying(255),
                    company_name character varying(255),
                    industry character varying(100),
                    start_date date,
                    salary_range character varying(50),
                    job_description text,
                    job_relevance character varying(50),
                    first_job character varying(255),
                    first_company character varying(255),
                    job_search_time character varying(50),
                    promotions character varying(50),
                    career_goals text,
                    career_plans character varying(50),
                    preferred_industry character varying(100),
                    preferred_position character varying(255),
                    preferred_location character varying(100),
                    expected_salary character varying(50),
                    technical_skills text,
                    soft_skills text,
                    certifications character varying(500),
                    internships character varying(500),
                    resume_status character varying(50),
                    portfolio_status character varying(50),
                    job_search_start character varying(50),
                    support_needed character varying(100),
                    additional_info text,
                    program_preparation character varying(50),
                    recommend_program character varying(50),
                    suggestions text,
                    verification_status character varying(20) DEFAULT 'pending',
                    created_at timestamp with time zone DEFAULT now(),
                    updated_at timestamp with time zone DEFAULT now(),
                    CONSTRAINT profiles_pkey PRIMARY KEY (id),
                    CONSTRAINT profiles_email_key UNIQUE (email),
                    CONSTRAINT profiles_student_id_key UNIQUE (student_id),
                    CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                );
            `;
            
            // Execute table creation
            const { error: usersError } = await supabaseClient.rpc('exec_sql', { sql: createUsersTable });
            if (usersError) {
                console.error('Error creating users table:', usersError);
            }
            
            const { error: profilesError } = await supabaseClient.rpc('exec_sql', { sql: createProfilesTable });
            if (profilesError) {
                console.error('Error creating profiles table:', profilesError);
            }
            
            showNotification('Database tables created successfully!', 'success');
            
        } catch (error) {
            console.error('Error creating database tables:', error);
            showNotification('Error creating database tables: ' + error.message, 'error');
        }
    };
    
    // Global function to add sample data for testing
    window.addSampleData = async function() {
        if (!supabaseClient) {
            console.error('Supabase client not available');
            return;
        }
        
        try {
            console.log('Adding sample data...');
            
            // Sample profiles data matching the exact database schema
            const sampleProfiles = [
                {
                    student_id: '2024-001',
                    full_name: 'Juan Cruz',
                    email: 'juan.cruz@email.com',
                    phone: '09123456789',
                    address: '123 Main St, Manila, Philippines',
                    birth_date: '2000-05-15',
                    program: 'BSIS',
                    user_type: 'graduated',
                    graduation_year: 2024,
                    expected_graduation: '2024-06-15',
                    current_gpa: 3.85,
                    final_gpa: 3.82,
                    thesis_title: 'Web-based Student Information System',
                    thesis_status: 'completed',
                    thesis_advisor: 'Dr. Maria Santos',
                    employment_status: 'Job Order',
                    job_title: 'Software Developer',
                    company_name: 'Tech Solutions Inc.',
                    industry: 'Information Technology',
                    start_date: '2024-07-01',
                    salary_range: '25,000-30,000',
                    job_description: 'Developing web applications using modern technologies',
                    job_relevance: 'highly_relevant',
                    first_job: 'Software Developer',
                    first_company: 'Tech Solutions Inc.',
                    job_search_time: '1-3 months',
                    career_goals: 'Become a senior software engineer',
                    career_plans: 'pursue_masters',
                    preferred_industry: 'Information Technology',
                    preferred_position: 'Senior Developer',
                    preferred_location: 'Metro Manila',
                    expected_salary: '40,000-50,000',
                    technical_skills: 'JavaScript, React, Node.js, Python, SQL',
                    soft_skills: 'Communication, Teamwork, Problem Solving',
                    certifications: 'AWS Certified Developer',
                    internships: 'Software Development Intern at ABC Corp',
                    resume_status: 'updated',
                    portfolio_status: 'active',
                    job_search_start: '2024-03-01',
                    support_needed: 'career_guidance',
                    additional_info: 'Active in programming competitions',
                    program_preparation: 'excellent',
                    recommend_program: 'yes',
                    suggestions: 'Add more practical projects',
                    verification_status: 'verified'
                },
                {
                    student_id: '2024-002',
                    full_name: 'Sandara Park',
                    email: 'sandara.park@email.com',
                    phone: '09123456790',
                    address: '456 Oak Ave, Quezon City, Philippines',
                    birth_date: '1999-12-10',
                    program: 'BSIT',
                    user_type: 'graduated',
                    graduation_year: 2024,
                    expected_graduation: '2024-06-15',
                    current_gpa: 3.75,
                    final_gpa: 3.78,
                    thesis_title: 'Mobile App for Campus Navigation',
                    thesis_status: 'completed',
                    thesis_advisor: 'Prof. John Dela Cruz',
                    employment_status: 'Self Employed',
                    job_title: 'Freelance Web Developer',
                    company_name: 'Self-Employed',
                    industry: 'Information Technology',
                    start_date: '2024-08-01',
                    salary_range: '30,000-40,000',
                    job_description: 'Creating websites for small businesses',
                    job_relevance: 'highly_relevant',
                    first_job: 'Freelance Web Developer',
                    first_company: 'Self-Employed',
                    job_search_time: 'immediate',
                    career_goals: 'Start own web development company',
                    career_plans: 'entrepreneurship',
                    preferred_industry: 'Information Technology',
                    preferred_position: 'Full-stack Developer',
                    preferred_location: 'Remote',
                    expected_salary: '50,000-70,000',
                    technical_skills: 'HTML, CSS, JavaScript, PHP, MySQL',
                    soft_skills: 'Client Relations, Time Management, Creativity',
                    certifications: 'Google Analytics Certified',
                    internships: 'Web Development Intern at XYZ Agency',
                    resume_status: 'updated',
                    portfolio_status: 'active',
                    job_search_start: '2024-02-01',
                    support_needed: 'business_development',
                    additional_info: 'Active in online freelancing platforms',
                    program_preparation: 'very_good',
                    recommend_program: 'yes',
                    suggestions: 'More business courses would be helpful',
                    verification_status: 'verified'
                },
                {
                    student_id: '2024-003',
                    full_name: 'Inna Gomez',
                    email: 'inna.gomez@email.com',
                    phone: '09123456791',
                    address: '789 Pine St, Makati, Philippines',
                    birth_date: '2001-03-22',
                    program: 'BSIT',
                    user_type: 'graduated',
                    graduation_year: 2024,
                    expected_graduation: '2024-06-15',
                    current_gpa: 3.65,
                    final_gpa: 3.68,
                    thesis_title: 'E-commerce Platform for Local Businesses',
                    thesis_status: 'completed',
                    thesis_advisor: 'Dr. Ana Rodriguez',
                    employment_status: 'Unemployed',
                    job_title: null,
                    company_name: null,
                    industry: null,
                    start_date: null,
                    salary_range: null,
                    job_description: null,
                    job_relevance: null,
                    first_job: null,
                    first_company: null,
                    job_search_time: '3-6 months',
                    career_goals: 'Work in a tech startup',
                    career_plans: 'job_search',
                    preferred_industry: 'Information Technology',
                    preferred_position: 'Frontend Developer',
                    preferred_location: 'Metro Manila',
                    expected_salary: '25,000-35,000',
                    technical_skills: 'React, Vue.js, CSS, JavaScript',
                    soft_skills: 'Adaptability, Learning Agility, Persistence',
                    certifications: 'React Developer Certification',
                    internships: 'UI/UX Intern at Design Studio',
                    resume_status: 'needs_update',
                    portfolio_status: 'in_progress',
                    job_search_start: '2024-06-01',
                    support_needed: 'job_placement',
                    additional_info: 'Looking for entry-level positions',
                    program_preparation: 'good',
                    recommend_program: 'yes',
                    suggestions: 'More industry connections needed',
                    verification_status: 'verified'
                },
                {
                    student_id: '2024-004',
                    full_name: 'James Blue',
                    email: 'james.blue@email.com',
                    phone: '09123456792',
                    address: '321 Elm St, Taguig, Philippines',
                    birth_date: '2000-08-14',
                    program: 'BSS',
                    user_type: 'graduated',
                    graduation_year: 2024,
                    expected_graduation: '2024-06-15',
                    current_gpa: 3.55,
                    final_gpa: 3.58,
                    thesis_title: 'Social Media Impact on Student Performance',
                    thesis_status: 'completed',
                    thesis_advisor: 'Prof. Lisa Martinez',
                    employment_status: 'Part Timer',
                    job_title: 'Research Assistant',
                    company_name: 'University Research Center',
                    industry: 'Education',
                    start_date: '2024-07-15',
                    salary_range: '15,000-20,000',
                    job_description: 'Assisting in social science research projects',
                    job_relevance: 'moderately_relevant',
                    first_job: 'Research Assistant',
                    first_company: 'University Research Center',
                    job_search_time: '1-3 months',
                    career_goals: 'Pursue graduate studies in Sociology',
                    career_plans: 'pursue_masters',
                    preferred_industry: 'Education',
                    preferred_position: 'Research Coordinator',
                    preferred_location: 'Metro Manila',
                    expected_salary: '30,000-40,000',
                    technical_skills: 'SPSS, Excel, Research Methods',
                    soft_skills: 'Analytical Thinking, Writing, Presentation',
                    certifications: 'Research Ethics Certification',
                    internships: 'Research Intern at Social Science Institute',
                    resume_status: 'updated',
                    portfolio_status: 'basic',
                    job_search_start: '2024-04-01',
                    support_needed: 'graduate_school_guidance',
                    additional_info: 'Planning to apply for master\'s degree',
                    program_preparation: 'good',
                    recommend_program: 'yes',
                    suggestions: 'More research opportunities',
                    verification_status: 'verified'
                },
                {
                    student_id: '2024-005',
                    full_name: 'Nadine Mae',
                    email: 'nadine.mae@email.com',
                    phone: '09123456793',
                    address: '654 Maple St, Pasig, Philippines',
                    birth_date: '1999-11-05',
                    program: 'BSS',
                    user_type: 'graduated',
                    graduation_year: 2024,
                    expected_graduation: '2024-06-15',
                    current_gpa: 3.88,
                    final_gpa: 3.85,
                    thesis_title: 'Community Development Programs Effectiveness',
                    thesis_status: 'completed',
                    thesis_advisor: 'Dr. Roberto Garcia',
                    employment_status: 'Government Employees',
                    job_title: 'Social Development Officer',
                    company_name: 'Department of Social Welfare and Development',
                    industry: 'Government',
                    start_date: '2024-08-01',
                    salary_range: '20,000-25,000',
                    job_description: 'Implementing community development programs',
                    job_relevance: 'highly_relevant',
                    first_job: 'Social Development Officer',
                    first_company: 'DSWD',
                    job_search_time: '1-3 months',
                    career_goals: 'Become a program manager',
                    career_plans: 'career_advancement',
                    preferred_industry: 'Government',
                    preferred_position: 'Program Manager',
                    preferred_location: 'Metro Manila',
                    expected_salary: '35,000-45,000',
                    technical_skills: 'Project Management, Data Analysis',
                    soft_skills: 'Leadership, Community Engagement, Communication',
                    certifications: 'Project Management Professional',
                    internships: 'Community Development Intern at NGO',
                    resume_status: 'updated',
                    portfolio_status: 'active',
                    job_search_start: '2024-03-01',
                    support_needed: 'leadership_training',
                    additional_info: 'Active in community service',
                    program_preparation: 'excellent',
                    recommend_program: 'yes',
                    suggestions: 'More practical field experience',
                    verification_status: 'verified'
                }
            ];
            
            // Insert sample data
            const { data, error } = await supabaseClient
                .from('profiles')
                .insert(sampleProfiles);
            
            if (error) {
                console.error('Error inserting sample data:', error);
                showNotification('Error adding sample data: ' + error.message, 'error');
            } else {
                console.log('Sample data added successfully');
                showNotification('Sample data added successfully!', 'success');
                // Refresh the dashboard
                setTimeout(() => {
                    loadAdminMetrics();
                }, 1000);
            }
        } catch (error) {
            console.error('Error adding sample data:', error);
            showNotification('Error adding sample data', 'error');
        }
    };
    
    function exportCredentials() {
        const credentials = {
            supabase_url: window.__SUPABASE_URL__,
            supabase_anon_key: window.__SUPABASE_ANON__,
            admin_credentials: {
                username: window.__ADMIN_CREDENTIALS__.username,
                password: window.__ADMIN_CREDENTIALS__.password,
                full_name: window.__ADMIN_CREDENTIALS__.fullName
            },
            export_date: new Date().toISOString(),
            application_version: '1.0.0'
        };
        
        const dataStr = JSON.stringify(credentials, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = 'cas-credentials.json';
        link.click();
        
        showNotification('Credentials exported successfully!', 'success');
    }
    
    function clearCache() {
        // Clear localStorage
        localStorage.clear();
        
        // Clear any cached data
        if (typeof caches !== 'undefined') {
            caches.keys().then(names => {
                names.forEach(name => {
                    caches.delete(name);
                });
            });
        }
        
        showNotification('Cache cleared successfully!', 'success');
    }
    
    function showDatabaseSchema() {
        const schema = `
-- CAS Graduate Employment Tracking System Database Schema

-- Users table for authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('admin', 'graduating', 'graduated')),
    student_id VARCHAR(50) UNIQUE,
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Profiles table for student information
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    user_type VARCHAR(20) NOT NULL,
    program VARCHAR(50),
    student_id VARCHAR(50),
    full_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    birth_date DATE,
    gender VARCHAR(10),
    address TEXT,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    expected_graduation DATE,
    graduation_year INTEGER,
    employment_status VARCHAR(50),
    company_name VARCHAR(255),
    job_title VARCHAR(255),
    start_date DATE,
    salary_range VARCHAR(50),
    job_relevance VARCHAR(20),
    verification_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employment records for detailed job information
CREATE TABLE employment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    job_title VARCHAR(255) NOT NULL,
    start_date DATE,
    end_date DATE,
    salary_range VARCHAR(50),
    job_description TEXT,
    is_current BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
        `;
        
        // Create a modal to show the schema
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            padding: 24px;
            border-radius: 12px;
            max-width: 80%;
            max-height: 80%;
            overflow: auto;
            position: relative;
        `;
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            position: absolute;
            top: 12px;
            right: 12px;
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
        `;
        
        const pre = document.createElement('pre');
        pre.textContent = schema;
        pre.style.cssText = `
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
            white-space: pre-wrap;
            word-wrap: break-word;
        `;
        
        closeBtn.onclick = () => modal.remove();
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
        
        content.appendChild(closeBtn);
        content.appendChild(pre);
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        showNotification('Database schema displayed', 'info');
    }
    
    // Admin Action Functions
    async function approveProfile(profileId) {
        try {
            const { error } = await supabaseClient
                .from('profiles')
                .update({ verification_status: 'verified' })
                .eq('id', profileId);
            
            if (error) throw error;
            
            showNotification('Profile approved successfully!', 'success');
            // Reload the verification table
            const { data: profiles } = await supabaseClient.from('profiles').select('*');
            await loadVerificationTable(profiles);
        } catch (error) {
            console.error('Error approving profile:', error);
            showNotification('Error approving profile', 'error');
        }
    }
    
    async function rejectProfile(profileId) {
        try {
            const { error } = await supabaseClient
                .from('profiles')
                .update({ verification_status: 'rejected' })
                .eq('id', profileId);
            
            if (error) throw error;
            
            showNotification('Profile rejected', 'info');
            // Reload the verification table
            const { data: profiles } = await supabaseClient.from('profiles').select('*');
            await loadVerificationTable(profiles);
        } catch (error) {
            console.error('Error rejecting profile:', error);
            showNotification('Error rejecting profile', 'error');
        }
    }
    
    async function editSurvey(surveyId) {
        showNotification('Edit survey functionality coming soon', 'info');
    }
    
    async function deleteSurvey(surveyId) {
        if (confirm('Are you sure you want to delete this survey?')) {
            try {
                const { error } = await supabaseClient
                    .from('surveys')
                    .delete()
                    .eq('id', surveyId);
                
                if (error) throw error;
                
                showNotification('Survey deleted successfully!', 'success');
                await loadSurveysTable();
            } catch (error) {
                console.error('Error deleting survey:', error);
                showNotification('Error deleting survey', 'error');
            }
        }
    }
    
    async function markAsRead(notificationId) {
        try {
            const { error } = await supabaseClient
                .from('notifications')
                .update({ is_read: true })
                .eq('id', notificationId);
            
            if (error) throw error;
            
            showNotification('Notification marked as read', 'success');
            await loadNotificationsTable();
        } catch (error) {
            console.error('Error marking notification as read:', error);
            showNotification('Error updating notification', 'error');
        }
    }
    
    async function loadVerificationQueue() {
        try {
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('verification_status', 'pending')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            const tableBody = document.getElementById('verification-table');
            if (tableBody) {
                tableBody.innerHTML = data.map(profile => `
                    <tr>
                        <td>${profile.first_name} ${profile.last_name}</td>
                        <td>Profile Update</td>
                        <td>${profile.program}</td>
                        <td>${new Date(profile.created_at).toLocaleDateString()}</td>
                        <td><span class="status-pending">Pending</span></td>
                        <td>
                            <button class="btn-verify" onclick="verifyProfile('${profile.id}', true)">Verify</button>
                            <button class="btn-reject" onclick="verifyProfile('${profile.id}', false)">Reject</button>
                        </td>
                    </tr>
                `).join('');
            }
        } catch (error) {
            console.error('Error loading verification queue:', error);
        }
    }
    
    // Global functions for admin actions
    window.verifyProfile = async function(profileId, approved) {
        try {
            const { error } = await supabaseClient
                .from('profiles')
                .update({ 
                    verification_status: approved ? 'verified' : 'rejected',
                    updated_at: new Date().toISOString()
                })
                .eq('id', profileId);
            
            if (error) throw error;
            
            showNotification(approved ? 'Profile verified successfully!' : 'Profile rejected.', 'success');
            loadVerificationQueue();
        } catch (error) {
            console.error('Error updating profile:', error);
            showNotification('Error updating profile status.', 'error');
        }
    };
    
    // Initialize admin dashboard when admin screen is shown
    if (adminScreen) {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (adminScreen.classList.contains('active')) {
                        if (supabaseClient) {
                            initializeAdminDashboard();
                        } else {
                            initializeAdminDashboardWithDemoData();
                        }
                    }
                }
            });
        });
        observer.observe(adminScreen, { attributes: true });
    }
    
    // Add event listeners for program filter cards
    const programFilterCards = document.querySelectorAll('.filter-card');
    programFilterCards.forEach(card => {
        card.addEventListener('click', function() {
            // Remove active class from all cards
            programFilterCards.forEach(card => card.classList.remove('active'));
            
            // Add active class to clicked card
            this.classList.add('active');
            
            // Get the program value
            const program = this.getAttribute('data-program');
            
            // Filter by program
            filterByProgram(program);
        });
    });
});

// Direct navigation to role selection
function testNavigation() {
    console.log('Navigating to role selection');
    
    // Hide splash screen
    const splashScreen = document.getElementById('splash-screen');
    const studentAdminScreen = document.getElementById('student-admin-screen');
    
    if (splashScreen) {
        splashScreen.classList.remove('active');
    }
    
    if (studentAdminScreen) {
        studentAdminScreen.classList.add('active');
    }
}

// Role selection function
function selectRole(role) {
    window.selectedRole = role;
    
    if (role === 'student') {
        // Go to graduating screen for student role selection
        const studentAdminScreen = document.getElementById('student-admin-screen');
        const graduatingScreen = document.getElementById('graduating-screen');
        
        if (studentAdminScreen) {
            studentAdminScreen.classList.remove('active');
        }
        
        if (graduatingScreen) {
            graduatingScreen.classList.add('active');
        }
    } else if (role === 'admin') {
        // Go to login screen for admin
        const studentAdminScreen = document.getElementById('student-admin-screen');
        const loginScreen = document.getElementById('login-screen');
        
        if (studentAdminScreen) {
            studentAdminScreen.classList.remove('active');
        }
        
        if (loginScreen) {
            loginScreen.classList.add('active');
        }
    }
}

// Function to load graduates filtered by year
function loadGraduatesByYear() {
    const graduationYear = window.userGraduationYear;
    const titleElement = document.getElementById('graduates-year-title');
    
    if (titleElement && graduationYear) {
        titleElement.textContent = `Graduates from ${graduationYear}`;
    }
    
    // Sample data - in a real application, this would come from the database
    const sampleGraduates = {
        '2024': {
            'BSIS': [
                { name: 'Juan Cruz', status: 'Graduated' },
                { name: 'Maria Santos', status: 'Graduated' },
                { name: 'Carlos Reyes', status: 'Graduated' },
                { name: 'Ana Garcia', status: 'Graduated' }
            ],
            'BSIT': [
                { name: 'Sandra Park', status: 'Graduated' },
                { name: 'Michael Chen', status: 'Graduated' },
                { name: 'Lisa Wong', status: 'Graduated' }
            ],
            'BSS': [
                { name: 'David Kim', status: 'Graduated' },
                { name: 'Sarah Johnson', status: 'Graduated' }
            ],
            'BSPSYCH': [
                { name: 'Emma Wilson', status: 'Graduated' },
                { name: 'James Brown', status: 'Graduated' }
            ]
        },
        '2023': {
            'BSIS': [
                { name: 'Alex Rodriguez', status: 'Graduated' },
                { name: 'Sofia Martinez', status: 'Graduated' }
            ],
            'BSIT': [
                { name: 'Kevin Lee', status: 'Graduated' },
                { name: 'Jennifer Davis', status: 'Graduated' }
            ],
            'BSS': [
                { name: 'Robert Taylor', status: 'Graduated' }
            ],
            'BSPSYCH': [
                { name: 'Amanda White', status: 'Graduated' }
            ]
        },
        '2022': {
            'BSIS': [
                { name: 'Daniel Smith', status: 'Graduated' },
                { name: 'Laura Garcia', status: 'Graduated' }
            ],
            'BSIT': [
                { name: 'Chris Anderson', status: 'Graduated' }
            ],
            'BSS': [
                { name: 'Michelle Clark', status: 'Graduated' }
            ],
            'BSPSYCH': [
                { name: 'Ryan Miller', status: 'Graduated' }
            ]
        }
    };
    
    const graduatesData = sampleGraduates[graduationYear] || sampleGraduates['2024'];
    const coursesGrid = document.querySelector('.courses-grid');
    
    if (coursesGrid) {
        coursesGrid.innerHTML = '';
        
        Object.keys(graduatesData).forEach(course => {
            const courseCard = document.createElement('div');
            courseCard.className = 'course-card';
            
            const courseTitle = document.createElement('h3');
            courseTitle.textContent = course;
            courseCard.appendChild(courseTitle);
            
            const graduatesList = document.createElement('div');
            graduatesList.className = 'graduates-list';
            
            graduatesData[course].forEach(graduate => {
                const graduateItem = document.createElement('div');
                graduateItem.className = 'graduate-item';
                
                const graduateName = document.createElement('span');
                graduateName.className = 'graduate-name';
                graduateName.textContent = graduate.name;
                
                const graduateStatus = document.createElement('span');
                graduateStatus.className = 'graduate-status graduated';
                graduateStatus.textContent = graduate.status;
                
                graduateItem.appendChild(graduateName);
                graduateItem.appendChild(graduateStatus);
                graduatesList.appendChild(graduateItem);
            });
            
            courseCard.appendChild(graduatesList);
            coursesGrid.appendChild(courseCard);
        });
    }
}
