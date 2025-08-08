// FILE: js/validation.js

function showError(input, message) {
    const formGroup = input.parentElement;
    input.classList.add('invalid');
    const error = formGroup.querySelector('.validation-error');
    if (error) error.textContent = message;
}

function clearError(input) {
    const formGroup = input.parentElement;
    input.classList.remove('invalid');
    const error = formGroup.querySelector('.validation-error');
    if (error) error.textContent = '';
}

function validateEmail(input) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.value.trim())) {
        showError(input, 'Please enter a valid email address.');
        return false;
    }
    return true;
}

function validateRequired(input) {
    // **THE FIX**: If an input is disabled, it is considered valid for this check.
    if (input.disabled) {
        return true;
    }
    if (input.value.trim() === '') {
        showError(input, 'This field is required.');
        return false;
    }
    return true;
}

function validateLength(input, min) {
    if (input.value.length < min) {
        showError(input, `Password must be at least ${min} characters.`);
        return false;
    }
    return true;
}

function validatePasswordsMatch(passwordInput, confirmInput) {
    if (passwordInput.value !== confirmInput.value) {
        showError(confirmInput, 'Passwords do not match.');
        return false;
    }
    return true;
}

export function validateForm(form) {
    let isValid = true;
    const inputs = form.querySelectorAll('input[required]');
    
    inputs.forEach(input => {
        clearError(input);
        if (!validateRequired(input)) isValid = false;
        else if (input.type === 'email' && !validateEmail(input)) isValid = false;
        else if (input.type === 'password' && input.hasAttribute('minlength') && !validateLength(input, input.minLength)) isValid = false;
    });

    if (form.id === 'register-form') {
        const password = form.querySelector('#register-password');
        const confirmPassword = form.querySelector('#register-confirm-password');
        if (password && confirmPassword && !validatePasswordsMatch(password, confirmPassword)) {
            isValid = false;
        }
    }

    return isValid;
}

export function setupLiveValidation(form) {
    form.addEventListener('input', (e) => {
        const input = e.target;
        if (input.tagName === 'INPUT' && input.hasAttribute('required')) {
            clearError(input);
            validateRequired(input);
            if (input.type === 'email') validateEmail(input);
            if (input.type === 'password' && input.hasAttribute('minlength')) {
                validateLength(input, input.minLength);
            }
            if (input.id === 'register-confirm-password') {
                const passwordInput = form.querySelector('#register-password');
                validatePasswordsMatch(passwordInput, input);
            }
        }
    });
}
