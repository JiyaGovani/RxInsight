const container = document.getElementById("authContainer");

function showRegister() {
    container.classList.remove("forgot-active");
    container.classList.add("active");
    clearMessages();
}

function showLogin() {
    container.classList.remove("active");
    container.classList.remove("forgot-active");
    clearMessages();
}

function showForgotPassword() {
    container.classList.remove("active");
    container.classList.add("forgot-active");
    clearMessages();
}

/* ── Inline message helpers ── */
function showMessage(formEl, text, type) {
    clearMessages(formEl);
    var msg = document.createElement('div');
    msg.className = 'auth-msg auth-msg-' + type;
    msg.textContent = text;
    formEl.prepend(msg);
}

function clearMessages(scope) {
    var root = scope || document;
    var msgs = root.querySelectorAll('.auth-msg');
    for (var i = 0; i < msgs.length; i++) msgs[i].remove();
}

// Login form submit (use fetch so the browser doesn't navigate to JSON)
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        clearMessages(loginForm);

        const formData = new FormData(loginForm);
        const payload = Object.fromEntries(formData.entries());
        const submitBtn = loginForm.querySelector('button[type="submit"], button:not([type])');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Logging in…'; }

        fetch(loginForm.action, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(payload)
        })
        .then(async (res) => {
            const data = await res.json().catch(() => null);
            if (!data) throw new Error('Invalid server response');
            return { ok: res.ok, status: res.status, data };
        })
        .then(({ ok, data }) => {
            if (data.success) {
                showMessage(loginForm, 'Login successful! Redirecting…', 'success');
                setTimeout(function() {
                    window.location.href = data.redirect || '/dashboard';
                }, 600);
            } else {
                showMessage(loginForm, data.message || 'Login failed', 'error');
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Login'; }
            }
        })
        .catch(() => {
            showMessage(loginForm, 'Login failed. Please try again.', 'error');
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Login'; }
        });
    });
}

// Form validation for register form
const registerForm = document.getElementById("registerForm");

if (registerForm) {
    // Phone number validation
    const contactNumberInput = document.getElementById("contactNumber");
    const lovedOneContactInput = document.getElementById("lovedOneContact");

    function validatePhoneNumber(input) {
        const value = input.value.replace(/\D/g, ''); // Remove non-digits
        input.value = value;
        
        if (input.hasAttribute('required') && value.length !== 10 && value.length > 0) {
            input.setCustomValidity('Phone number must be exactly 10 digits');
        } else if (!input.hasAttribute('required') && value.length > 0 && value.length !== 10) {
            input.setCustomValidity('Phone number must be exactly 10 digits');
        } else {
            input.setCustomValidity('');
        }
    }

    if (contactNumberInput) {
        contactNumberInput.addEventListener('input', function() {
            validatePhoneNumber(this);
        });
    }

    if (lovedOneContactInput) {
        lovedOneContactInput.addEventListener('input', function() {
            validatePhoneNumber(this);
        });
    }

    registerForm.addEventListener('submit', function(e) {
        if (contactNumberInput) validatePhoneNumber(contactNumberInput);
        if (lovedOneContactInput) validatePhoneNumber(lovedOneContactInput);
        
        if (!registerForm.checkValidity()) {
            e.preventDefault();
            e.stopPropagation();
            registerForm.classList.add('was-validated');
            return;
        }

        // Prevent normal form submission (which would show raw JSON in the browser)
        e.preventDefault();
        registerForm.classList.add('was-validated');

        const formData = new FormData(registerForm);
        const payload = Object.fromEntries(formData.entries());

        fetch(registerForm.action, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(payload)
        })
        .then(async (res) => {
            const data = await res.json().catch(() => null);
            if (!data) throw new Error('Invalid server response');
            return { ok: res.ok, status: res.status, data };
        })
        .then(({ data }) => {
            if (data.success) {
                showMessage(registerForm, 'Registration successful! Redirecting to login…', 'success');
                registerForm.reset();
                registerForm.classList.remove('was-validated');
                setTimeout(function() { showLogin(); }, 1200);
            } else {
                showMessage(registerForm, data.message || 'Registration failed', 'error');
            }
        })
        .catch(() => {
            showMessage(registerForm, 'Registration failed. Please try again.', 'error');
        });
    });
}