// ──────────────────────────────────────────────
// Validation utilities
// ──────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Check if `email` looks like a valid e-mail address.
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Check that a string is not empty or whitespace-only.
 */
export function isRequired(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Check that a string has at least `min` characters (after trimming).
 */
export function isMinLength(value: string, min: number): boolean {
  return value.trim().length >= min;
}

// ── Form-level validators ───────────────────────

export interface LoginFormErrors {
  email?: string;
  password?: string;
}

export interface LoginFormResult {
  valid: boolean;
  errors: LoginFormErrors;
}

/**
 * Validate the login form fields and return structured errors.
 */
export function validateLoginForm(
  email: string,
  password: string,
): LoginFormResult {
  const errors: LoginFormErrors = {};

  if (!isRequired(email)) {
    errors.email = 'E-mail é obrigatório';
  } else if (!isValidEmail(email)) {
    errors.email = 'E-mail inválido';
  }

  if (!isRequired(password)) {
    errors.password = 'Senha é obrigatória';
  } else if (!isMinLength(password, 6)) {
    errors.password = 'Senha deve ter pelo menos 6 caracteres';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
