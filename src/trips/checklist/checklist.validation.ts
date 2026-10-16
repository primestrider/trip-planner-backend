import { z } from "zod";

const ChecklistItemFields = z.object({
  title: z.string().trim().min(1).max(200),

  // free-form group, e.g. "Documents", "Clothes"
  category: z.string().trim().min(1).max(50).nullable().optional(),

  // trip member responsible for the item
  assignedToUserId: z.uuid().nullable().optional()
});

export const CreateChecklistItemSchema = ChecklistItemFields.strict();

export const UpdateChecklistItemSchema = ChecklistItemFields.extend({
  isChecked: z.boolean()
})
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided"
  });

export const ListChecklistQuerySchema = z.object({
  // "true" / "false" to show only checked / unchecked items
  checked: z.enum(["true", "false"]).optional()
});

export type CreateChecklistItemDto = z.infer<typeof CreateChecklistItemSchema>;
export type UpdateChecklistItemDto = z.infer<typeof UpdateChecklistItemSchema>;
export type ListChecklistQuery = z.infer<typeof ListChecklistQuerySchema>;
