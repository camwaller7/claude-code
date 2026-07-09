export interface PasswordRequirement {
  id: string
  label: string
  test: (pw: string) => boolean
}

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { id: 'length', label: 'At least 12 characters', test: pw => pw.length >= 12 },
  { id: 'upper', label: 'One uppercase letter', test: pw => /[A-Z]/.test(pw) },
  { id: 'lower', label: 'One lowercase letter', test: pw => /[a-z]/.test(pw) },
  { id: 'number', label: 'One number', test: pw => /[0-9]/.test(pw) },
  { id: 'symbol', label: 'One symbol (!@#$…)', test: pw => /[^A-Za-z0-9]/.test(pw) },
]

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '123456789012', 'qwertyuiop12',
  'letmein12345', 'welcome12345', 'iloveyou1234', 'admin1234567',
])

export function validatePassword(pw: string): string[] {
  const failures = PASSWORD_REQUIREMENTS.filter(r => !r.test(pw)).map(r => r.label)
  if (COMMON_PASSWORDS.has(pw.toLowerCase())) {
    failures.push('Not a commonly used password')
  }
  return failures
}

export function isPasswordValid(pw: string): boolean {
  return validatePassword(pw).length === 0
}
