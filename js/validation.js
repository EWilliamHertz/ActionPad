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

export function validateForm(form) {
    let isValid = true;
    const inputs = form.querySelectorAll('input[required]');
    inputs.forEach(input => {
        clearError(input);
        if (!validateRequired(input)) isValid = false;
        else if (input.type === 'email' && !validateEmail(input)) isValid = false;
        else if (input.type === 'password' && input.hasAttribute('minlength') && !validateLength(input, input.minLength)) isValid = false;
    });
    return isValid;
}

export function setupLiveValidation(form) {
    form.addEventListener('input', (e) => {
        if (e.target.tagName === 'INPUT' && e.target.hasAttribute('required')) {
            clearError(e.target);
            validateRequired(e.target);
            if (e.target.type === 'email') validateEmail(e.target);
            if (e.target.type === 'password' && e.target.hasAttribute('minlength')) validateLength(e.target, e.target.minLength);
        }
    });
}
