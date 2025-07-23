// This script handles all client-side logic for the application,
// including Supabase integration for authentication, data management,
// and real-time subscriptions.

// ====================================================================
// Supabase Initialization
// IMPORTANT: Replace 'YOUR_SUPABASE_PROJECT_URL' and 'YOUR_SUPABASE_ANON_KEY'
// with your actual Supabase project URL and public anon key.
// You can find these in your Supabase project settings under API.
// ====================================================================
const SUPABASE_URL = "https://ygmyxyblesqkimeesjwr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbXl4eWJsZXNxa2ltZWVzandyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwODI4NjAsImV4cCI6MjA2ODY1ODg2MH0.TI4kx-toajXifG-7a4HY9sVk3y2_rNL4yNj6r6VB6RI";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====================================================================
// Global State Variables
// These variables hold the current state of the application,
// such as the logged-in user, active session, and selected package.
// ====================================================================
let currentUser = null;
let currentSession = null;
let questions = []; // Stores questions for the current session
let currentQuestionIndex = 0;
let selectedPackage = null;
let appliedVoucher = null;

// ====================================================================
// UI Helper Functions
// Functions to manage user interface elements like showing alerts
// and switching between different sections of the application.
// ====================================================================

/**
 * Displays an alert message to the user.
 * @param {string} message - The message to display.
 * @param {'success'|'error'|'info'} type - The type of alert (for styling).
 */
function showAlert(message, type) {
    // This is a placeholder for a real UI alert.
    // In a production app, you would display this in a dedicated message box
    // rather than using browser alerts.
    console.log(`Alert (${type}): ${message}`);
    // Example: You might update a div with id 'alert-message' and add a class for styling
    // const alertDiv = document.getElementById('alert-message');
    // alertDiv.textContent = message;
    // alertDiv.className = `alert ${type}`; // Add appropriate CSS classes
    // alertDiv.style.display = 'block';
    // setTimeout(() => alertDiv.style.display = 'none', 5000); // Hide after 5 seconds
}

/**
 * Shows a specific section of the application and hides others.
 * Assumes sections have IDs like 'auth-section', 'package-section', etc.
 * @param {string} sectionId - The ID of the section to show.
 */
function showSection(sectionId) {
    document.querySelectorAll('.app-section').forEach(section => {
        section.style.display = 'none';
    });
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.style.display = 'block';
    } else {
        console.warn(`Section with ID '${sectionId}' not found.`);
    }
}

/**
 * Shows the login form.
 */
function showLogin() {
    // This function would typically hide registration and show login forms.
    // Assuming a simple toggle for now.
    console.log("Showing login form.");
    // Example: document.getElementById('login-form').style.display = 'block';
    // document.getElementById('register-form').style.display = 'none';
}

// ====================================================================
// Authentication Functions
// Handles user registration, login, and logout using Supabase Auth.
// ====================================================================

/**
 * Hashes a given password using SHA-256.
 * @param {string} password - The password to hash.
 * @returns {Promise<string>} The hexadecimal string representation of the hash.
 */
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Hashes a security answer.
 * NOTE: For a real production system, consider a stronger hashing mechanism
 * for security answers, similar to password hashing. btoa is simple encoding.
 * @param {string} answer - The security answer to hash.
 * @returns {string} The base64 encoded string of the answer.
 */
async function hashAnswer(answer) {
    return btoa(answer); // Simple encoding for demo, use proper hashing in production
}

/**
 * Validates the password against predefined requirements.
 * (Placeholder function - implement your actual password policy here)
 * @param {string} password - The password to validate.
 * @returns {boolean} True if the password meets requirements, false otherwise.
 */
function validatePassword(password) {
    // Example: At least 8 characters, one uppercase, one lowercase, one number
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;
    return regex.test(password);
}


/**
 * Registers a new user with email, password, name, and security answers.
 */
async function register() {
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const securityAnswers = {
        q1: document.getElementById('security-q1').value.trim().toLowerCase(),
        q2: document.getElementById('security-q2').value.trim().toLowerCase(),
        q3: document.getElementById('security-q3').value.trim().toLowerCase(),
        q4: document.getElementById('security-q4').value.trim().toLowerCase(),
        q5: document.getElementById('security-q5').value.trim().toLowerCase()
    };

    if (!name || !email || !password) {
        showAlert('Please fill all fields', 'error');
        return;
    }

    if (!validatePassword(password)) {
        showAlert('Password does not meet requirements (e.g., min 8 chars, 1 uppercase, 1 lowercase, 1 number).', 'error');
        return;
    }

    try {
        // Sign up the user with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    name: name // Store user's name in auth metadata
                }
            }
        });

        if (authError) throw authError;

        // Hash security answers before storing them
        const hashedAnswers = {
            q1: await hashAnswer(securityAnswers.q1),
            q2: await hashAnswer(securityAnswers.q2),
            q3: await hashAnswer(securityAnswers.q3),
            q4: await hashAnswer(securityAnswers.q4),
            q5: await hashAnswer(securityAnswers.q5)
        };

        // Create a user profile entry in the 'users' table
        const { error: profileError } = await supabase
            .from('users')
            .insert({
                id: authData.user.id, // Link to Supabase Auth user ID
                email: email,
                name: name,
                password_hash: await hashPassword(password), // Store hashed password
                security_answers: hashedAnswers // Store hashed security answers
            });

        if (profileError) throw profileError;

        showAlert('Registration successful! Please check your email to verify your account.', 'success');
        showLogin(); // Redirect to login after successful registration
    } catch (error) {
        console.error('Registration error:', error);
        showAlert('Registration failed: ' + error.message, 'error');
    }
}

/**
 * Logs in a user with email and password.
 */
async function login() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        showAlert('Please enter email and password', 'error');
        return;
    }

    try {
        // Sign in the user with Supabase Auth
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;

        // Fetch the user's profile from the 'users' table
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', data.user.id)
            .single();

        if (userError) throw userError;

        currentUser = userData; // Set the global currentUser object
        showAlert(`Welcome back, ${currentUser.name}!`, 'success');
        showSection('package-section'); // Show the package selection section
        loadPackages(); // Load available packages
    } catch (error) {
        console.error('Login error:', error);
        showAlert('Invalid credentials', 'error');
    }
}

/**
 * Logs out the current user.
 */
async function logout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;

        // Clear global state upon logout
        currentUser = null;
        currentSession = null;
        questions = [];
        currentQuestionIndex = 0;
        selectedPackage = null;
        appliedVoucher = null;
        // resetUser = null; // This variable was not defined, removed.

        showAlert('Logged out successfully.', 'info');
        showSection('auth-section'); // Go back to authentication section
        showLogin(); // Show the login form
    } catch (error) {
        console.error('Logout error:', error);
        showAlert('Logout failed', 'error');
    }
}

// ====================================================================
// Package Management
// Functions to load and select interview packages.
// ====================================================================

/**
 * Loads available packages from the 'packages' table and displays them.
 */
async function loadPackages() {
    try {
        const { data, error } = await supabase
            .from('packages')
            .select('*')
            .eq('active', true) // Only fetch active packages
            .order('price', { ascending: true }); // Order by price

        if (error) throw error;

        const container = document.getElementById('pricing-cards');
        if (container) {
            container.innerHTML = data.map(pkg => `
                <div class="pricing-card p-4 m-2 bg-white rounded-lg shadow-md cursor-pointer hover:shadow-lg transition-shadow duration-300" onclick="selectPackage('${pkg.id}')">
                    <h3 class="text-xl font-semibold mb-2 text-gray-800">${pkg.name}</h3>
                    <div class="text-2xl font-bold text-indigo-600 mb-3">$${pkg.price}</div>
                    <p class="text-gray-600 mb-1">${pkg.questions} Interview Questions</p>
                    <p class="text-gray-600 mb-1">AI-Powered Feedback</p>
                    <p class="text-gray-600 mb-1">Audio/Video Recording</p>
                    <p class="text-gray-600">Real-time Analysis</p>
                </div>
            `).join('');
        } else {
            console.error("Element with ID 'pricing-cards' not found.");
        }
    } catch (error) {
        console.error('Error loading packages:', error);
        showAlert('Failed to load packages', 'error');
    }
}

/**
 * Selects a package by its ID and updates the UI.
 * @param {string} packageId - The ID of the selected package.
 */
async function selectPackage(packageId) {
    try {
        const { data, error } = await supabase
            .from('packages')
            .select('*')
            .eq('id', packageId)
            .single();

        if (error) throw error;

        selectedPackage = data;
        showAlert(`Package "${selectedPackage.name}" selected.`, 'info');
        // You might want to navigate to a confirmation or session start section here
        // For now, let's assume it proceeds to session creation.
        createSession();
    } catch (error) {
        console.error('Error selecting package:', error);
        showAlert('Failed to select package', 'error');
    }
}

/**
 * Applies a voucher code to the current session.
 * @param {string} voucherCode - The voucher code to apply.
 */
async function applyVoucher(voucherCode) {
    try {
        const { data, error } = await supabase
            .from('vouchers')
            .select('*')
            .eq('code', voucherCode)
            .eq('active', true)
            .single();

        if (error) throw error;

        appliedVoucher = data;
        showAlert(`Voucher "${voucherCode}" applied! You get ${data.discount}% off.`, 'success');
        // Recalculate final price if already in session creation phase
    } catch (error) {
        console.error('Error applying voucher:', error);
        showAlert('Invalid or inactive voucher code.', 'error');
        appliedVoucher = null; // Clear applied voucher on error
    }
}

/**
 * Calculates the final price of the selected package after applying any voucher.
 * @returns {number} The final price.
 */
function calculateFinalPrice() {
    if (!selectedPackage) return 0;
    let finalPrice = selectedPackage.price;
    if (appliedVoucher) {
        finalPrice = finalPrice * (1 - appliedVoucher.discount / 100);
    }
    return finalPrice;
}


// ====================================================================
// Session Management
// Functions to create and manage user interview sessions.
// ====================================================================

/**
 * Creates a new interview session for the current user.
 * @returns {Promise<object>} The created session data.
 */
async function createSession() {
    if (!currentUser || !selectedPackage) {
        showAlert('Please log in and select a package first.', 'error');
        return;
    }

    try {
        const { data, error } = await supabase
            .from('sessions')
            .insert({
                user_id: currentUser.id,
                package_id: selectedPackage.id,
                package_name: selectedPackage.name,
                questions_count: selectedPackage.questions,
                price: selectedPackage.price,
                final_price: calculateFinalPrice(),
                voucher_code: appliedVoucher?.code,
                payment_details: "/* Placeholder for actual payment details */", // In a real app, this would come from a payment gateway
                context: {
                    // Example context data
                    roleName: currentUser.role || 'user',
                    CompanyName: currentUser.company || 'N/A'
                },
                status: 'paid' // Assuming payment is handled or it's a free session
            })
            .select() // Select the newly inserted row
            .single(); // Expect a single row back

        if (error) throw error;

        currentSession = data; // Store the newly created session
        showAlert('Session created successfully!', 'success');
        // Proceed to load questions for the session
        // loadQuestionsForSession(currentSession.id); // Assuming such a function exists
        showSection('interview-section'); // Show the interview section
        return data;
    } catch (error) {
        console.error('Error creating session:', error);
        showAlert('Failed to create session: ' + error.message, 'error');
        throw error; // Re-throw to propagate the error if needed
    }
}

// ====================================================================
// Recording Management
// Functions to upload audio/video recordings to Supabase Storage.
// ====================================================================

/**
 * Uploads a recording blob to Supabase Storage.
 * @param {Blob} blob - The recording data as a Blob.
 * @param {string} type - The type of recording ('video' or 'audio').
 * @param {string} questionId - The ID of the question this recording is for.
 * @returns {Promise<string>} The public URL of the uploaded recording.
 */
async function uploadRecording(blob, type, questionId) {
    if (!currentUser || !currentSession) {
        showAlert('User not logged in or session not active for recording upload.', 'error');
        throw new Error('Authentication or session missing.');
    }

    try {
        // Define a unique file name for the recording
        const fileName = `${currentUser.id}/${currentSession.id}/${questionId}_${Date.now()}.webm`; // .webm is common for web recordings

        // Determine content type based on the 'type' parameter
        const contentType = type === 'video' ? 'video/webm' : 'audio/webm';

        // Upload the blob to the 'recordings' bucket
        const { data, error } = await supabase.storage
            .from('recordings')
            .upload(fileName, blob, {
                contentType: contentType,
                upsert: false // Set to true if you want to overwrite existing files
            });

        if (error) throw error;

        // Get the public URL of the uploaded file
        const { data: urlData } = supabase.storage
            .from('recordings')
            .getPublicUrl(fileName);

        if (!urlData || !urlData.publicUrl) {
            throw new Error('Failed to get public URL for recording.');
        }

        return urlData.publicUrl;
    } catch (error) {
        console.error('Error uploading recording:', error);
        showAlert('Failed to upload recording: ' + error.message, 'error');
        throw error; // Re-throw to propagate the error
    }
}

// ====================================================================
// Question and Response Management
// Functions to save user responses and AI analysis results.
// ====================================================================

/**
 * Saves a user's response to a question, including the recording.
 * @param {string} questionId - The ID of the question.
 * @param {object} response - An object containing response details (blob, type, duration).
 * @param {Blob} response.blob - The recording blob.
 * @param {string} response.type - The type of recording ('audio' or 'video').
 * @param {number} response.duration - The duration of the recording in seconds.
 * @returns {Promise<object>} The saved response data.
 */
async function saveQuestionResponse(questionId, response) {
    try {
        // First, upload the recording to storage
        const recordingUrl = await uploadRecording(
            response.blob,
            response.type,
            questionId
        );

        // Then, save the response details to the 'responses' table
        const { data, error } = await supabase
            .from('responses')
            .insert({
                question_id: questionId,
                recording_type: response.type,
                duration: response.duration,
                recording_url: recordingUrl,
                recorded_at: new Date() // Timestamp of when the response was recorded
            });

        if (error) throw error;

        showAlert('Response saved successfully!', 'success');
        return data;
    } catch (error) {
        console.error('Error saving response:', error);
        showAlert('Failed to save response: ' + error.message, 'error');
        throw error;
    }
}

/**
 * Saves the AI analysis results for a specific question response.
 * @param {string} questionId - The ID of the question for which analysis is being saved.
 * @param {object} analysis - The JSONB analysis object from the AI model.
 * @param {number} analysis.overallRating - The overall rating from the AI analysis.
 */
async function saveAnalysis(questionId, analysis) {
    try {
        // Update the 'responses' table with analysis data
        const { error } = await supabase
            .from('responses')
            .update({
                analyzed: true, // Mark as analyzed
                analysis: analysis, // Store the full analysis JSONB
                rating: analysis.overallRating, // Store overall rating separately for easier querying
                updated_at: new Date() // Update timestamp
            })
            .eq('question_id', questionId); // Target the specific response

        if (error) throw error;

        showAlert('Analysis saved successfully!', 'success');
    } catch (error) {
        console.error('Error saving analysis:', error);
        showAlert('Failed to save analysis: ' + error.message, 'error');
        throw error;
    }
}

/**
 * Calculates the average rating of analyzed questions in the current session.
 * @returns {number} The average rating, or 0 if no questions are rated.
 */
function calculateAverageRating() {
    // Filter questions that have a rating
    const ratedQuestions = questions.filter(q => q.rating !== undefined && q.rating !== null);

    if (ratedQuestions.length === 0) {
        return 0; // No rated questions, return 0
    }

    // Sum up all ratings and divide by the count of rated questions
    const totalRating = ratedQuestions.reduce((sum, q) => sum + q.rating, 0);
    return totalRating / ratedQuestions.length;
}


// ====================================================================
// Feedback and Usage Data Management
// Functions to save user feedback and comprehensive usage statistics.
// ====================================================================

/**
 * Saves user feedback data.
 * @param {number} rating - The user's rating (e.g., 1-5).
 * @param {string} feedbackText - Optional text comments from the user.
 */
async function saveFeedbackData(rating, feedbackText) {
    if (!currentUser || !currentSession) {
        showAlert('User not logged in or session not active for feedback submission.', 'error');
        return;
    }

    try {
        // Insert feedback into the 'feedback' table
        const { error: feedbackError } = await supabase
            .from('feedback')
            .insert({
                session_id: currentSession.id,
                user_id: currentUser.id,
                rating: rating,
                feedback_text: feedbackText || "No additional comments provided",
                submitted_at: new Date()
            });

        if (feedbackError) throw feedbackError;

        showAlert('Feedback submitted successfully!', 'success');
    } catch (error) {
        console.error('Error saving feedback:', error);
        showAlert('Failed to save feedback: ' + error.message, 'error');
    }
}

/**
 * Saves comprehensive usage data for the completed session.
 * This function consolidates various metrics about the session.
 */
async function saveUsageData() {
    if (!currentUser || !currentSession) {
        showAlert('User not logged in or session not active for usage data saving.', 'error');
        return;
    }

    // Prepare usage data object
    const usageData = {
        user_id: currentUser.id,
        session_id: currentSession.id,
        package_used: selectedPackage?.name,
        package_id: selectedPackage?.id,
        questions_total: questions.length,
        questions_answered: questions.filter(q => q.userResponse).length, // Assuming 'userResponse' property exists when answered
        questions_analyzed: questions.filter(q => q.analyzed).length, // Assuming 'analyzed' property exists
        voucher_used: appliedVoucher?.code,
        voucher_discount: appliedVoucher?.discount || 0,
        role_name: currentSession.context?.roleName,
        company_name: currentSession.context?.CompanyName,
        average_question_rating: calculateAverageRating(),
        total_session_duration: Date.now() - new Date(currentSession.created_at).getTime(), // Duration in milliseconds
        video_responses_count: questions.filter(q => q.userResponse?.type === 'video').length,
        audio_responses_count: questions.filter(q => q.userResponse?.type === 'audio').length,
        app_feedback_rating: null, // This would typically be set after user provides feedback separately
        app_feedback_text: "No additional comments provided", // Placeholder
        price_original: selectedPackage?.price,
        price_paid: currentSession.final_price,
        payment_method: currentSession.final_price === 0 ? 'Free' : 'PayPal', // Simple logic, expand as needed
        device_type: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop',
        session_started: currentSession.created_at,
        session_completed: new Date()
    };

    try {
        // Insert usage data into the 'usage_data' table
        const { error: usageError } = await supabase
            .from('usage_data')
            .insert(usageData);

        if (usageError) throw usageError;

        showAlert('Usage data saved successfully!', 'info');
    } catch (error) {
        console.error('Error saving usage data:', error);
        showAlert('Failed to save usage data: ' + error.message, 'error');
    }
}


// ====================================================================
// Real-time Subscriptions (Optional but Recommended)
// Sets up real-time listeners for changes in specific tables.
// This can be useful for dynamic updates without page reloads.
// ====================================================================

/**
 * Sets up real-time subscriptions for 'packages' and 'vouchers' tables.
 * This allows the UI to update automatically when data changes in the database.
 */
function setupRealtimeSubscriptions() {
    // Subscribe to package changes
    supabase
        .channel('packages-changes') // Unique channel name
        .on('postgres_changes', { event: '*', schema: 'public', table: 'packages' },
            (payload) => {
                console.log('Package changed (realtime):', payload);
                loadPackages(); // Reload packages to reflect changes in UI
            }
        )
        .subscribe();

    // Subscribe to voucher changes
    supabase
        .channel('vouchers-changes') // Unique channel name
        .on('postgres_changes', { event: '*', schema: 'public', table: 'vouchers' },
            (payload) => {
                console.log('Voucher changed (realtime):', payload);
                // You might want to update the voucher display or re-evaluate prices here
            }
        )
        .subscribe();
}

// ====================================================================
// Application Initialization on Page Load
// This block runs when the DOM is fully loaded, checking for existing
// sessions and setting up real-time listeners.
// ====================================================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM Content Loaded. Initializing application...');

    // Check for an existing Supabase session
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        // If a session exists, the user is logged in.
        console.log('Existing session found:', session);
        // Fetch the user's profile from the 'users' table
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

        if (userError) {
            console.error('Error fetching user data on load:', userError);
            showAlert('Failed to load user profile. Please log in again.', 'error');
            showSection('auth-section');
            showLogin();
            return;
        }

        if (userData) {
            currentUser = userData; // Set the global currentUser object
            showAlert(`Welcome back, ${currentUser.name}!`, 'success');
            showSection('package-section'); // Show the package selection section
            loadPackages(); // Load available packages
        }
    } else {
        // No existing session, show the authentication section
        console.log('No existing session. Showing auth section.');
        showSection('auth-section');
        showLogin();
    }

    // Set up real-time subscriptions regardless of login status
    setupRealtimeSubscriptions();
});
