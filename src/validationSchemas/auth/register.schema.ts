import z from 'zod';

const registerSchema = z.object({
  firstName: z
    .string()
    .min(2, 'First name must be at least 2 characters long')
    .max(50, 'First name must be at most 50 characters long')
    .nullable()
    .optional(),
  lastName: z
    .string()
    .min(2, 'Last name must be at least 2 characters long')
    .max(50, 'Last name must be at most 50 characters long')
    .nullable()
    .optional(),
  email: z
    .email('Invalid email address')
    .nonempty('Email is required')
    .nonoptional('Email is required'),
  countryCode: z
    .string()
    .regex(/^\+\d{1,3}$/, 'Country code must be in format +XX (e.g. +91)')
    .nullable()
    .optional(),
  mobile: z
    .string()
    .min(4, 'Mobile number must be at least 4 digits')
    .max(15, 'Mobile number must be at most 15 digits')
    .regex(/^\d+$/, 'Mobile number must contain only digits')
    .nullable()
    .optional(),
  password: z
    .string()
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+])[A-Za-z\d!@#$%^&*()_+]{8,16}$/,
      'Password must be 8 to 16 chars composed of one uppercase letter, one lowercase letter, one number and a special character ',
    )
    .nonempty('Password is required'),
});
export default registerSchema;
