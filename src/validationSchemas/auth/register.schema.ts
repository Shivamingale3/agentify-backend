import z from 'zod';

const registerSchema = z.object({
  firstName: z
    .string()
    .min(2, 'First name must be at least 2 characters long')
    .max(50, 'First name must be at most 50 characters long'),
  lastName: z
    .string()
    .min(2, 'Last name must be at least 2 characters long')
    .max(50, 'Last name must be at most 50 characters long'),
  email: z
    .email('Invalid email address')
    .nonempty('Email is required')
    .nonoptional('Email is required'),
  mobile: z
    .string()
    .length(10, 'Mobile must be 10 digits long')
    .regex(/^[6-9]\d{9}$/, 'Invalid mobile number'),
  password: z
    .string()
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+])[A-Za-z\d!@#$%^&*()_+]{8,16}$/,
      'Password must be 8 to 16 chars composed of one uppercase letter, one lowercase letter, one number and a special character ',
    )
    .nonempty('Password is required'),
});
export default registerSchema;
