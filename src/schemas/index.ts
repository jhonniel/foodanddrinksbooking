import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerSchema = z
  .object({
    fullName: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Enter a valid email address"),
    phone: z
      .string()
      .optional()
      .refine(
        (v) =>
          v == null ||
          v.trim() === "" ||
          (v.trim().length >= 10 && /^[\d+\-\s()]+$/.test(v)),
        "Enter a valid phone number"
      ),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const checkoutSchema = z
  .object({
    orderType: z.enum(["DELIVERY", "PICKUP"]),
    paymentMethod: z.enum(["COD", "GCASH", "CARD", "ONLINE"]),
    addressId: z.string().optional(),
    fullAddress: z.string().optional(),
    deliveryInstructions: z.string().max(500).optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.orderType === "DELIVERY" && !data.addressId && !data.fullAddress) {
      ctx.addIssue({
        code: "custom",
        message: "Please select or enter a delivery address",
        path: ["addressId"],
      });
    }
  });

export const productFormSchema = z.object({
  name: z.string().min(2, "Product name is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  categoryId: z.string().min(1, "Category is required"),
  basePrice: z.coerce.number().positive("Price must be greater than 0"),
  isAvailable: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isBestSeller: z.boolean().default(false),
  preparationTimeMinutes: z.coerce.number().int().min(1).max(120).default(10),
});

export const inventoryAdjustSchema = z.object({
  itemId: z.string().uuid().or(z.string().min(1)),
  quantity: z.coerce.number(),
  type: z.enum(["PURCHASE", "ADJUSTMENT", "RETURN", "WASTE"]),
  notes: z.string().max(300).optional(),
});

export const promoCodeSchema = z.object({
  code: z
    .string()
    .min(3, "Enter a promo code")
    .max(32)
    .transform((v) => v.trim().toUpperCase()),
});

export const deliveryPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, "Enter the 4-digit delivery PIN"),
});

export const addressSchema = z.object({
  label: z.string().min(1, "Label is required"),
  fullAddress: z.string().min(5, "Address is required"),
  barangay: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  deliveryInstructions: z.string().max(500).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  isDefault: z.boolean().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type ProductFormInput = z.infer<typeof productFormSchema>;
