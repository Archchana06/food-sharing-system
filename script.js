// API URL
const API_URL = 'http://localhost:3000/api';

// ========== CHECK AUTH ON PAGE LOAD ==========
document.addEventListener('DOMContentLoaded', () => {
    const user = getCurrentUser();
    
    if (window.location.pathname.includes('donor.html')) {
        if (!user) window.location.href = 'login.html';
        if (user.user_type !== 'donor' && user.user_type !== 'both') {
            window.location.href = 'seeker.html';
        }
        document.getElementById('userName').textContent = `Welcome, ${user.name}`;
        loadMyFood();
        setupPostFood();
    }
    
    if (window.location.pathname.includes('seeker.html')) {
        if (!user) window.location.href = 'login.html';
        document.getElementById('userName').textContent = `Welcome, ${user.name}`;
        loadAvailableFood();
        loadMyReservations();
    }
});

// ========== GET CURRENT USER ==========
function getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

// ========== LOGOUT ==========
function logout() {
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

// ========== SWITCH TO SEEKER PAGE ==========
function switchToSeeker() {
    const user = getCurrentUser();
    if (user) {
        window.location.href = 'seeker.html';
    } else {
        window.location.href = 'login.html';
    }
}

// ========== SWITCH TO DONOR PAGE ==========
function switchToDonor() {
    const user = getCurrentUser();
    if (user) {
        window.location.href = 'donor.html';
    } else {
        window.location.href = 'login.html';
    }
}

// ========== REGISTER FUNCTION ==========
if (document.getElementById('registerForm')) {
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const password = document.getElementById('password').value;
        const confirm_password = document.getElementById('confirm_password').value;
        
        if (password !== confirm_password) {
            showMessage('Passwords do not match!', 'error');
            return;
        }
        
        const userData = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            user_type: document.getElementById('user_type').value,
            password: password
        };
        
        try {
            const response = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                showMessage('Registration successful! Please login.', 'success');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            } else {
                showMessage(data.message || 'Registration failed', 'error');
            }
        } catch (error) {
            showMessage('Error connecting to server', 'error');
        }
    });
}

// ========== LOGIN FUNCTION ==========
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const loginData = {
            email: document.getElementById('email').value,
            password: document.getElementById('password').value
        };
        
        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                localStorage.setItem('user', JSON.stringify(data.user));
                
                showMessage('Login successful! Redirecting...', 'success');
                
                setTimeout(() => {
                    if (data.user.user_type === 'donor') {
                        window.location.href = 'donor.html';
                    } else if (data.user.user_type === 'seeker') {
                        window.location.href = 'seeker.html';
                    } else if (data.user.user_type === 'both') {
                        window.location.href = 'donor.html';
                    } else {
                        window.location.href = 'donor.html';
                    }
                }, 1000);
            } else {
                showMessage(data.message || 'Login failed', 'error');
            }
        } catch (error) {
            showMessage('Error connecting to server', 'error');
        }
    });
}

// ========== POST FOOD WITH IMAGE ==========
function setupPostFood() {
    if (!document.getElementById('postFoodForm')) return;
    
    document.getElementById('postFoodForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const user = getCurrentUser();
        
        // First, upload image if selected
        let imageUrl = '';
        const imageFile = document.getElementById('food_image').files[0];
        
        if (imageFile) {
            const formData = new FormData();
            formData.append('image', imageFile);
            
            try {
                const uploadResponse = await fetch(`${API_URL}/upload-image`, {
                    method: 'POST',
                    body: formData
                });
                
                const uploadData = await uploadResponse.json();
                if (uploadData.success) {
                    imageUrl = uploadData.imageUrl;
                } else {
                    showPostMessage('Image upload failed', 'error');
                    return;
                }
            } catch (error) {
                showPostMessage('Error uploading image', 'error');
                return;
            }
        }
        
        // Then post food with image URL
        const foodData = {
            user_id: user.id,
            food_name: document.getElementById('food_name').value,
            quantity: document.getElementById('quantity').value,
            location: document.getElementById('location').value,
            pickup_time: document.getElementById('pickup_time').value,
            image_url: imageUrl
        };
        
        try {
            const response = await fetch(`${API_URL}/food`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(foodData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                showPostMessage('Food posted successfully!', 'success');
                document.getElementById('postFoodForm').reset();
                loadMyFood();
            } else {
                showPostMessage(data.message || 'Failed to post food', 'error');
            }
        } catch (error) {
            showPostMessage('Error connecting to server', 'error');
        }
    });
}

// ========== LOAD MY FOOD POSTS (DONOR) WITH IMAGES ==========
async function loadMyFood() {
    const user = getCurrentUser();
    if (!user) return;
    
    try {
        const response = await fetch(`${API_URL}/my-food/${user.id}`);
        const data = await response.json();
        
        const foodList = document.getElementById('myFoodList');
        
        if (data.success && data.food.length > 0) {
            foodList.innerHTML = data.food.map(food => `
                <div class="food-card" id="food-${food.food_id}">
                    ${food.image_url ? `<img src="${food.image_url}" class="food-image" alt="${food.food_name}">` : '<div class="no-image">📷 No Image</div>'}
                    <h3>${food.food_name}</h3>
                    <p>📦 Quantity: ${food.quantity}</p>
                    <p>📍 Location: ${food.location}</p>
                    <p>⏰ Pickup: ${new Date(food.pickup_time).toLocaleString()}</p>
                    <p>Status: <strong>${food.status}</strong></p>
                    <button onclick="deleteFood(${food.food_id})" class="btn-delete">🗑️ Delete Post</button>
                </div>
            `).join('');
        } else {
            foodList.innerHTML = '<p>You haven\'t posted any food yet.</p>';
        }
    } catch (error) {
        document.getElementById('myFoodList').innerHTML = '<p>Error loading your food posts.</p>';
    }
}

// ========== DELETE FOOD FUNCTION ==========
async function deleteFood(foodId) {
    const user = getCurrentUser();
    if (!user) return;
    
    const confirmDelete = confirm('Are you sure you want to delete this food post?');
    if (!confirmDelete) return;
    
    try {
        const response = await fetch(`${API_URL}/food/${foodId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.id })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Food post deleted successfully!');
            loadMyFood();
        } else {
            alert(data.message || 'Failed to delete food');
        }
    } catch (error) {
        alert('Error connecting to server');
    }
}

// ========== LOAD AVAILABLE FOOD (SEEKER) WITH IMAGES ==========
async function loadAvailableFood() {
    try {
        const response = await fetch(`${API_URL}/food`);
        const data = await response.json();
        
        const foodList = document.getElementById('foodList');
        
        if (data.success && data.food.length > 0) {
            foodList.innerHTML = data.food.map(food => `
                <div class="food-card">
                    ${food.image_url ? `<img src="${food.image_url}" class="food-image" alt="${food.food_name}">` : '<div class="no-image">📷 No Image</div>'}
                    <h3>${food.food_name}</h3>
                    <p>📦 Quantity: ${food.quantity}</p>
                    <p>📍 Location: ${food.location}</p>
                    <p>⏰ Pickup: ${new Date(food.pickup_time).toLocaleString()}</p>
                    <p>👤 Donor: ${food.donor_name}</p>
                    <p>📞 Contact: ${food.phone}</p>
                    <button onclick="reserveFood(${food.food_id})">Reserve This Food</button>
                </div>
            `).join('');
        } else {
            foodList.innerHTML = '<p>No food available right now. Check back later!</p>';
        }
    } catch (error) {
        document.getElementById('foodList').innerHTML = '<p>Error loading food.</p>';
    }
}

// ========== RESERVE FOOD (SEEKER) ==========
async function reserveFood(foodId) {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/reserve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                food_id: foodId,
                user_id: user.id
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Food reserved successfully! Contact the donor for pickup.');
            loadAvailableFood();
            loadMyReservations();
        } else {
            alert('Failed to reserve food. Try again.');
        }
    } catch (error) {
        alert('Error connecting to server.');
    }
}

// ========== LOAD MY RESERVATIONS (SEEKER) ==========
async function loadMyReservations() {
    const user = getCurrentUser();
    if (!user) return;
    
    try {
        const response = await fetch(`${API_URL}/my-reservations/${user.id}`);
        const data = await response.json();
        
        const reservationsDiv = document.getElementById('myReservations');
        
        if (data.success && data.reservations.length > 0) {
            reservationsDiv.innerHTML = data.reservations.map(res => `
                <div class="food-card">
                    <h3>${res.food_name}</h3>
                    <p>📦 Quantity: ${res.quantity}</p>
                    <p>📍 Location: ${res.location}</p>
                    <p>⏰ Pickup: ${new Date(res.pickup_time).toLocaleString()}</p>
                    <p>👤 Donor: ${res.donor_name}</p>
                    <p>Status: <strong>${res.status}</strong></p>
                </div>
            `).join('');
        } else {
            reservationsDiv.innerHTML = '<p>You have no reservations yet.</p>';
        }
    } catch (error) {
        document.getElementById('myReservations').innerHTML = '<p>Error loading reservations.</p>';
    }
}

// ========== HELPER FUNCTIONS ==========
function showMessage(msg, type) {
    const messageDiv = document.getElementById('message');
    if (messageDiv) {
        messageDiv.textContent = msg;
        messageDiv.className = `message ${type}`;
        setTimeout(() => {
            messageDiv.className = 'message';
        }, 3000);
    }
}

function showPostMessage(msg, type) {
    const messageDiv = document.getElementById('postMessage');
    if (messageDiv) {
        messageDiv.textContent = msg;
        messageDiv.className = `message ${type}`;
        setTimeout(() => {
            messageDiv.className = 'message';
        }, 3000);
    }
}

// ========== LOAD PROFILE PAGE ==========
if (window.location.pathname.includes('profile.html')) {
    document.addEventListener('DOMContentLoaded', () => {
        const user = getCurrentUser();
        if (!user) {
            window.location.href = 'login.html';
        }
        loadProfileData();
    });
}

// ========== LOAD PROFILE DATA ==========
async function loadProfileData() {
    const user = getCurrentUser();
    if (!user) return;
    
    try {
        const response = await fetch(`${API_URL}/user/${user.id}`);
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('displayName').textContent = data.user.name;
            document.getElementById('displayEmail').textContent = data.user.email;
            document.getElementById('displayPhone').textContent = data.user.phone || 'Not provided';
            document.getElementById('displayType').textContent = data.user.user_type;
        }
    } catch (error) {
        showMessage('Error loading profile', 'error');
    }
}

// ========== SHOW EDIT FORM ==========
function showEditForm() {
    const user = getCurrentUser();
    document.getElementById('editName').value = user.name;
    document.getElementById('editPhone').value = user.phone || '';
    document.getElementById('profileView').style.display = 'none';
    document.getElementById('editForm').style.display = 'block';
    document.getElementById('passwordForm').style.display = 'none';
}

// ========== HIDE EDIT FORM ==========
function hideEditForm() {
    document.getElementById('profileView').style.display = 'block';
    document.getElementById('editForm').style.display = 'none';
}

// ========== UPDATE PROFILE ==========
async function updateProfile() {
    const user = getCurrentUser();
    const newName = document.getElementById('editName').value;
    const newPhone = document.getElementById('editPhone').value;
    
    try {
        const response = await fetch(`${API_URL}/user/${user.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName, phone: newPhone })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Update local storage
            user.name = newName;
            user.phone = newPhone;
            localStorage.setItem('user', JSON.stringify(user));
            
            showMessage('Profile updated successfully!', 'success');
            hideEditForm();
            loadProfileData();
        } else {
            showMessage(data.message || 'Update failed', 'error');
        }
    } catch (error) {
        showMessage('Error updating profile', 'error');
    }
}

// ========== SHOW PASSWORD FORM ==========
function showChangePassword() {
    document.getElementById('profileView').style.display = 'none';
    document.getElementById('passwordForm').style.display = 'block';
    document.getElementById('editForm').style.display = 'none';
}

// ========== HIDE PASSWORD FORM ==========
function hidePasswordForm() {
    document.getElementById('profileView').style.display = 'block';
    document.getElementById('passwordForm').style.display = 'none';
}

// ========== CHANGE PASSWORD ==========
async function changePassword() {
    const user = getCurrentUser();
    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (newPassword !== confirmPassword) {
        showMessage('New passwords do not match!', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: user.id,
                old_password: oldPassword,
                new_password: newPassword
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('Password changed successfully!', 'success');
            hidePasswordForm();
            document.getElementById('oldPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        } else {
            showMessage(data.message || 'Password change failed', 'error');
        }
    } catch (error) {
        showMessage('Error changing password', 'error');
    }
}

// ========== LOAD PROFILE DATA ==========
async function loadProfileData() {
    const user = getCurrentUser();
    if (!user) return;
    
    try {
        const response = await fetch(`${API_URL}/user/${user.id}`);
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('displayName').textContent = data.user.name;
            document.getElementById('displayEmail').textContent = data.user.email;
            document.getElementById('displayPhone').textContent = data.user.phone || 'Not provided';
            
            // Set role with badge class
            const roleSpan = document.getElementById('displayType');
            const role = data.user.user_type || 'seeker';
            roleSpan.innerHTML = `<span class="badge ${role}">${role.charAt(0).toUpperCase() + role.slice(1)}</span>`;
            
            // Format and display the registration date
            if (data.user.created_at) {
                const date = new Date(data.user.created_at);
                const formattedDate = date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                document.getElementById('displayJoined').textContent = formattedDate;
            } else {
                document.getElementById('displayJoined').textContent = 'Not available';
            }
        }
    } catch (error) {
        showMessage('Error loading profile', 'error');
    }
}