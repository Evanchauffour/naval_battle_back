import { z } from 'zod';

export const CreateUserSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  email: z.string().email('Email invalide'),
  password: z
    .string()
    .min(6, 'Le mot de passe doit faire au moins 6 caractères'),
  role: z
    .enum(['ADMIN', 'MANAGER', 'USER'])
    .refine((val) => val !== undefined, {
      message: 'Le rôle est requis',
    }),
  organizationId: z.number().optional(),
  onboardingStatus: z
    .enum(['NOT_STARTED', 'STARTED', 'ORG_CREATED', 'COMPLETED'])
    .optional(),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
