export type AuthFieldErrors = {
    name?: string;
    email?: string;
    password?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | undefined {
    const value = email.trim();
    if (!value) {
        return "Email is required.";
    }
    if (!emailPattern.test(value)) {
        return "Enter a valid email address.";
    }
    return undefined;
}

export function validateLoginPassword(password: string): string | undefined {
    if (!password.trim()) {
        return "Password is required.";
    }
    return undefined;
}

export function validateName(name: string): string | undefined {
    const value = name.trim();
    if (!value) {
        return "Name is required.";
    }
    if (value.length < 2) {
        return "Name must be at least 2 characters.";
    }
    if (value.length > 60) {
        return "Name must be under 60 characters.";
    }
    return undefined;
}

export function validateSignupPassword(password: string): string | undefined {
    if (password.length < 8) {
        return "Password must be at least 8 characters.";
    }
    if (!/[A-Z]/.test(password)) {
        return "Add at least one uppercase letter.";
    }
    if (!/[a-z]/.test(password)) {
        return "Add at least one lowercase letter.";
    }
    if (!/[0-9]/.test(password)) {
        return "Add at least one number.";
    }
    return undefined;
}
