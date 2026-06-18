import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(120),
  companyName: z.string().trim().min(2, "Please enter your company name").max(160),
  email: z.string().trim().email("Please enter a valid business email").max(160),
  phone: z.string().trim().min(6, "Please enter a phone number").max(40),
  country: z.string().trim().min(2, "Please enter your country").max(80),
  interest: z.string().trim().min(2, "Please select or enter your product/service interest").max(160),
  message: z.string().trim().min(10, "Please add a message with your requirement").max(4000),
  website: z.string().max(0, "Spam protection triggered").optional().or(z.literal("")),
});

export type ContactFormInput = z.infer<typeof contactSchema>;
