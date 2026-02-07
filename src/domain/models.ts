import { z } from "zod";

export const AddressSchema = z.object({
  street1: z.string().min(1),
  street2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  countryCode: z.string().length(2),
});

export const ParcelSchema = z.object({
  weightKg: z.number().positive(),
  lengthCm: z.number().positive(),
  widthCm: z.number().positive(),
  heightCm: z.number().positive(),
});

export const RateRequestSchema = z.object({
  origin: AddressSchema,
  destination: AddressSchema,
  parcel: ParcelSchema,
  serviceLevel: z.string().optional(),
});

export const MoneySchema = z.object({
  currency: z.string().length(3),
  amount: z.number().nonnegative(),
});

export const RateQuoteSchema = z.object({
  carrier: z.literal("UPS"),
  serviceLevel: z.string(),
  totalCharge: MoneySchema,
  deliveryDays: z.number().int().positive().optional(),
});

export type Address = z.infer<typeof AddressSchema>;
export type Parcel = z.infer<typeof ParcelSchema>;
export type RateRequest = z.infer<typeof RateRequestSchema>;
export type Money = z.infer<typeof MoneySchema>;
export type RateQuote = z.infer<typeof RateQuoteSchema>;
