import z from "zod";

export const themeKeys = [
    "boring-grey",
    "sunset",
    "purple",
    "forest",
    "ocean",
    "rose",
    "indigo",
    "gold",
] as const;

export const themeKeySchema = z.enum(themeKeys);
export type ThemeKey = z.infer<typeof themeKeySchema>;

export const signupInput = z.object({
    email: z.string().email(),
    password: z.string(),
    name: z.string().optional()
})

//type inference in zod
export type SignupInput = z.infer<typeof signupInput>    

export const signinInput = z.object({
    email: z.string().email(),
    password: z.string(),
    name: z.string().optional()
})

export type SigninInput = z.infer<typeof signinInput>    

export const forgotPasswordInput = z.object({
    email: z.string().email(),
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordInput>

export const resetPasswordInput = z.object({
    email: z.string().email(),
    token: z.string().min(10),
    password: z.string().min(6),
})

export type ResetPasswordInput = z.infer<typeof resetPasswordInput>

export const createBlogInput = z.object({
    title: z.string(),
    content: z.string(),
    imageKey: z.string().optional()
})

export type CreateBlogInput = z.infer<typeof createBlogInput>    

export const updateBlogInput = z.object({
    title: z.string(),
    content: z.string(),
    id: z.number(),
})

export type UpdateBlogInput = z.infer<typeof updateBlogInput>    
