const container = document.getElementById("authContainer");
const forgotPasswordForm = document.getElementById("forgotPasswordForm");
const forgotEmailInput = document.getElementById("forgotEmail");
const forgotOtpInput = document.getElementById("forgotOtp");
const forgotNewPasswordInput = document.getElementById("forgotNewPassword");
const forgotConfirmPasswordInput = document.getElementById("forgotConfirmPassword");
const forgotOtpStep = document.getElementById("forgotOtpStep");
const forgotResetStep = document.getElementById("forgotResetStep");
const btnSendOtp = document.getElementById("btnSendOtp");
const btnVerifyOtp = document.getElementById("btnVerifyOtp");
const btnResetPassword = document.getElementById("btnResetPassword");
const registerForm = document.getElementById("registerForm");
const registerStep1 = document.getElementById("registerStep1");
const registerStep2 = document.getElementById("registerStep2");
const registerOtpInput = document.getElementById("registerOtp");
const btnRegister = document.getElementById("btnRegister");
const btnConfirmRegisterOtp = document.getElementById("btnConfirmRegisterOtp");

let forgotOtpVerified = false;

function resetForgotPasswordState(clearEmail) {
    forgotOtpVerified = false;

    if (forgotOtpStep) forgotOtpStep.classList.remove('d-none');
    if (forgotResetStep) forgotResetStep.classList.add('d-none');

    if (forgotOtpInput) forgotOtpInput.value = '';
    if (forgotNewPasswordInput) forgotNewPasswordInput.value = '';
    if (forgotConfirmPasswordInput) forgotConfirmPasswordInput.value = '';
    if (clearEmail && forgotEmailInput) forgotEmailInput.value = '';
}

function resetRegisterOtpState(clearOtp) {
    if (registerStep1) registerStep1.classList.remove('d-none');
    if (registerStep2) registerStep2.classList.add('d-none');
    if (clearOtp && registerOtpInput) registerOtpInput.value = '';
    if (btnRegister) btnRegister.textContent = 'Register';
}

function showRegister() {
    container.classList.remove("forgot-active");
    container.classList.add("active");
    resetForgotPasswordState(true);
    resetRegisterOtpState(true);
    clearMessages();
}

function showLogin() {
    container.classList.remove("active");
    container.classList.remove("forgot-active");
    resetForgotPasswordState(true);
    resetRegisterOtpState(true);
    clearMessages();
}

function showForgotPassword() {
    container.classList.remove("active");
    container.classList.add("forgot-active");
    resetForgotPasswordState(false);
    resetRegisterOtpState(true);
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

function setButtonState(buttonEl, busyText, idleText, isBusy) {
    if (!buttonEl) return;
    buttonEl.disabled = !!isBusy;
    buttonEl.textContent = isBusy ? busyText : idleText;
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
if (registerForm) {
    // Phone number validation
    const contactNumberInput = document.getElementById("contactNumber");
    const lovedOneContactInput = document.getElementById("lovedOneContact");
    const regPasswordInput = document.getElementById("regPassword");
    const regEmailInput = document.getElementById("regEmail");
    const dateOfBirthInput = document.getElementById("dateOfBirth");

    if (dateOfBirthInput) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        dateOfBirthInput.max = yyyy + '-' + mm + '-' + dd;
    }

    if (registerOtpInput) {
        registerOtpInput.addEventListener('input', function () {
            this.value = this.value.replace(/\D/g, '').slice(0, 6);
        });
    }

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
        clearMessages(registerForm);

        var isRegisterOtpStepVisible = registerStep2 && !registerStep2.classList.contains('d-none');
        if (isRegisterOtpStepVisible) {
            e.preventDefault();
            if (btnConfirmRegisterOtp && !btnConfirmRegisterOtp.disabled) {
                btnConfirmRegisterOtp.click();
            }
            return;
        }

        if (contactNumberInput) validatePhoneNumber(contactNumberInput);
        if (lovedOneContactInput) validatePhoneNumber(lovedOneContactInput);

        if (dateOfBirthInput && dateOfBirthInput.value) {
            const selectedDob = new Date(dateOfBirthInput.value + 'T00:00:00');
            const todayAtMidnight = new Date();
            todayAtMidnight.setHours(0, 0, 0, 0);
            if (selectedDob > todayAtMidnight) {
                e.preventDefault();
                showMessage(registerForm, 'Date of birth cannot be in the future.', 'error');
                return;
            }
        }

        var registerPassword = regPasswordInput ? regPasswordInput.value : '';
        if (registerPassword.length < 8) {
            e.preventDefault();
            showMessage(registerForm, 'Password length is not sufficient. It must be at least 8 characters.', 'error');
            return;
        }

        if (!/[A-Z]/.test(registerPassword)) {
            e.preventDefault();
            showMessage(registerForm, 'Password must contain at least 1 uppercase letter.', 'error');
            return;
        }

        if (!/[a-z]/.test(registerPassword)) {
            e.preventDefault();
            showMessage(registerForm, 'Password must contain at least 1 lowercase letter.', 'error');
            return;
        }

        if (!/[0-9]/.test(registerPassword)) {
            e.preventDefault();
            showMessage(registerForm, 'Password must contain at least 1 digit.', 'error');
            return;
        }

        if (!/[^A-Za-z0-9]/.test(registerPassword)) {
            e.preventDefault();
            showMessage(registerForm, 'Password must contain at least 1 special character.', 'error');
            return;
        }
        
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

        setButtonState(btnRegister, 'Sending OTP…', 'Register', true);

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
        .then(({ ok, data }) => {
            if (!ok || !data.success) {
                showMessage(registerForm, data.message || 'Registration failed', 'error');
                return;
            }

            if (registerStep1) registerStep1.classList.add('d-none');
            if (registerStep2) registerStep2.classList.remove('d-none');
            if (registerOtpInput) registerOtpInput.focus();
            if (btnRegister) btnRegister.textContent = 'Resend OTP';
            showMessage(registerForm, data.message || 'Confirmation OTP sent. Please verify OTP to complete registration.', 'success');
        })
        .catch(() => {
            showMessage(registerForm, 'Failed to send OTP. Please try again.', 'error');
        })
        .finally(() => {
            setButtonState(btnRegister, 'Sending OTP…', (btnRegister && btnRegister.textContent === 'Resend OTP') ? 'Resend OTP' : 'Register', false);
        });
    });

    if (btnConfirmRegisterOtp) {
        btnConfirmRegisterOtp.addEventListener('click', function () {
            clearMessages(registerForm);

            var email = regEmailInput ? regEmailInput.value.trim() : '';
            var otp = registerOtpInput ? registerOtpInput.value.trim() : '';

            if (!email || !otp) {
                showMessage(registerForm, 'Please enter registration OTP.', 'error');
                return;
            }

            setButtonState(btnConfirmRegisterOtp, 'Verifying OTP…', 'Verify OTP & Complete Registration', true);

            fetch('/auth/signup/confirm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({ email: email, otp: otp })
            })
            .then(async (res) => {
                const data = await res.json().catch(() => null);
                if (!data) throw new Error('Invalid server response');
                return { ok: res.ok, data };
            })
            .then(({ ok, data }) => {
                if (!ok || !data.success) {
                    resetRegisterOtpState(true);
                    showMessage(registerForm, data.message || 'OTP verification failed.', 'error');
                    return;
                }

                showMessage(registerForm, data.message || 'Registration successful! Redirecting to login…', 'success');
                registerForm.reset();
                registerForm.classList.remove('was-validated');
                resetRegisterOtpState(true);
                setTimeout(function() { showLogin(); }, 1200);
            })
            .catch(() => {
                showMessage(registerForm, 'OTP verification failed. Please try again.', 'error');
            })
            .finally(() => {
                setButtonState(btnConfirmRegisterOtp, 'Verifying OTP…', 'Verify OTP & Complete Registration', false);
            });
        });
    }

    if (registerOtpInput) {
        registerOtpInput.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                if (btnConfirmRegisterOtp && !btnConfirmRegisterOtp.disabled) {
                    btnConfirmRegisterOtp.click();
                }
            }
        });
    }
}

if (forgotPasswordForm) {
    if (forgotEmailInput) {
        forgotEmailInput.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                var isForgotResetStepVisible = forgotResetStep && !forgotResetStep.classList.contains('d-none');
                if (!isForgotResetStepVisible && btnSendOtp && !btnSendOtp.disabled) {
                    btnSendOtp.click();
                }
            }
        });
    }

    forgotPasswordForm.addEventListener('submit', function (e) {
        e.preventDefault();

        var isForgotResetStepVisible = forgotResetStep && !forgotResetStep.classList.contains('d-none');
        if (isForgotResetStepVisible) {
            if (btnResetPassword && !btnResetPassword.disabled) {
                btnResetPassword.click();
            }
            return;
        }

        var otpValue = forgotOtpInput ? forgotOtpInput.value.trim() : '';
        if (otpValue) {
            if (btnVerifyOtp && !btnVerifyOtp.disabled) {
                btnVerifyOtp.click();
            }
            return;
        }

        if (btnSendOtp && !btnSendOtp.disabled) {
            btnSendOtp.click();
        }
    });

    if (forgotOtpInput) {
        forgotOtpInput.addEventListener('input', function () {
            this.value = this.value.replace(/\D/g, '').slice(0, 6);
        });

        forgotOtpInput.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                if (btnVerifyOtp && !btnVerifyOtp.disabled) {
                    btnVerifyOtp.click();
                }
            }
        });
    }

    if (btnSendOtp) {
        btnSendOtp.addEventListener('click', function () {
            clearMessages(forgotPasswordForm);

            var email = forgotEmailInput ? forgotEmailInput.value.trim() : '';
            if (!email) {
                showMessage(forgotPasswordForm, 'Please enter your email.', 'error');
                return;
            }

            setButtonState(btnSendOtp, 'Sending OTP…', 'Send OTP', true);

            fetch('/auth/forgot-password/request-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({ email: email })
            })
            .then(async (res) => {
                const data = await res.json().catch(() => null);
                if (!data) throw new Error('Invalid server response');
                return { ok: res.ok, data };
            })
            .then(({ ok, data }) => {
                if (!ok || !data.success) {
                    showMessage(forgotPasswordForm, data.message || 'Failed to send OTP.', 'error');
                    return;
                }

                forgotOtpVerified = false;
                if (forgotOtpStep) forgotOtpStep.classList.remove('d-none');
                if (forgotResetStep) forgotResetStep.classList.add('d-none');
                showMessage(forgotPasswordForm, data.message || 'OTP sent to your email.', 'success');
            })
            .catch(() => {
                showMessage(forgotPasswordForm, 'Failed to send OTP. Please try again.', 'error');
            })
            .finally(() => {
                setButtonState(btnSendOtp, 'Sending OTP…', 'Send OTP', false);
            });
        });
    }

    if (btnVerifyOtp) {
        btnVerifyOtp.addEventListener('click', function () {
            clearMessages(forgotPasswordForm);

            var email = forgotEmailInput ? forgotEmailInput.value.trim() : '';
            var otp = forgotOtpInput ? forgotOtpInput.value.trim() : '';

            if (!email || !otp) {
                showMessage(forgotPasswordForm, 'Please enter email and OTP.', 'error');
                return;
            }

            setButtonState(btnVerifyOtp, 'Verifying…', 'Verify OTP', true);

            fetch('/auth/forgot-password/verify-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({ email: email, otp: otp })
            })
            .then(async (res) => {
                const data = await res.json().catch(() => null);
                if (!data) throw new Error('Invalid server response');
                return { ok: res.ok, data };
            })
            .then(({ ok, data }) => {
                if (!ok || !data.success) {
                    forgotOtpVerified = false;
                    if (forgotOtpStep) forgotOtpStep.classList.remove('d-none');
                    if (forgotResetStep) forgotResetStep.classList.add('d-none');
                    showMessage(forgotPasswordForm, data.message || 'OTP verification failed.', 'error');

                    if (data && data.error_code === 'invalid_otp') {
                        setTimeout(function () {
                            showLogin();
                        }, 1000);
                    }
                    return;
                }

                forgotOtpVerified = true;
                if (forgotOtpStep) forgotOtpStep.classList.add('d-none');
                if (forgotResetStep) forgotResetStep.classList.remove('d-none');
                showMessage(forgotPasswordForm, data.message || 'OTP verified. You can now change password.', 'success');
            })
            .catch(() => {
                forgotOtpVerified = false;
                if (forgotOtpStep) forgotOtpStep.classList.remove('d-none');
                if (forgotResetStep) forgotResetStep.classList.add('d-none');
                showMessage(forgotPasswordForm, 'OTP verification failed. Please try again.', 'error');
            })
            .finally(() => {
                setButtonState(btnVerifyOtp, 'Verifying…', 'Verify OTP', false);
            });
        });
    }

    if (btnResetPassword) {
        btnResetPassword.addEventListener('click', function () {
            clearMessages(forgotPasswordForm);

            if (!forgotOtpVerified) {
                showMessage(forgotPasswordForm, 'Please verify OTP first.', 'error');
                return;
            }

            var email = forgotEmailInput ? forgotEmailInput.value.trim() : '';
            var newPassword = forgotNewPasswordInput ? forgotNewPasswordInput.value : '';
            var confirmPassword = forgotConfirmPasswordInput ? forgotConfirmPasswordInput.value : '';

            if (!email || !newPassword || !confirmPassword) {
                showMessage(forgotPasswordForm, 'Please fill all password fields.', 'error');
                return;
            }

            if (newPassword.length < 8) {
                showMessage(forgotPasswordForm, 'Password length is not sufficient. It must be at least 8 characters.', 'error');
                return;
            }

            if (!/[A-Z]/.test(newPassword)) {
                showMessage(forgotPasswordForm, 'Password must contain at least 1 uppercase letter.', 'error');
                return;
            }

            if (!/[a-z]/.test(newPassword)) {
                showMessage(forgotPasswordForm, 'Password must contain at least 1 lowercase letter.', 'error');
                return;
            }

            if (!/[0-9]/.test(newPassword)) {
                showMessage(forgotPasswordForm, 'Password must contain at least 1 digit.', 'error');
                return;
            }

            if (!/[^A-Za-z0-9]/.test(newPassword)) {
                showMessage(forgotPasswordForm, 'Password must contain at least 1 special character.', 'error');
                return;
            }

            setButtonState(btnResetPassword, 'Changing…', 'Change Password', true);

            fetch('/auth/forgot-password/reset', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({
                    email: email,
                    new_password: newPassword,
                    confirm_password: confirmPassword
                })
            })
            .then(async (res) => {
                const data = await res.json().catch(() => null);
                if (!data) throw new Error('Invalid server response');
                return { ok: res.ok, data };
            })
            .then(({ ok, data }) => {
                if (!ok || !data.success) {
                    showMessage(forgotPasswordForm, data.message || 'Failed to reset password.', 'error');
                    return;
                }

                showMessage(forgotPasswordForm, data.message || 'Password reset successful. Redirecting to login…', 'success');
                setTimeout(function () {
                    showLogin();
                }, 1200);
            })
            .catch(() => {
                showMessage(forgotPasswordForm, 'Failed to reset password. Please try again.', 'error');
            })
            .finally(() => {
                setButtonState(btnResetPassword, 'Changing…', 'Change Password', false);
            });
        });
    }

    if (forgotNewPasswordInput) {
        forgotNewPasswordInput.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                var isForgotResetStepVisible = forgotResetStep && !forgotResetStep.classList.contains('d-none');
                if (isForgotResetStepVisible && btnResetPassword && !btnResetPassword.disabled) {
                    btnResetPassword.click();
                }
            }
        });
    }

    if (forgotConfirmPasswordInput) {
        forgotConfirmPasswordInput.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                var isForgotResetStepVisible = forgotResetStep && !forgotResetStep.classList.contains('d-none');
                if (isForgotResetStepVisible && btnResetPassword && !btnResetPassword.disabled) {
                    btnResetPassword.click();
                }
            }
        });
    }
}