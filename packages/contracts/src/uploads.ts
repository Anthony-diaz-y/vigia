import { z } from 'zod'

import { UPLOAD_STATUSES } from '@vigia/epidemiology'

export const UploadStatusSchema = z.enum(UPLOAD_STATUSES)

export const UploadSchema = z
  .object({
    id: z.number().int().positive(),
    file_hash: z.string().length(64),
    filename: z.string().min(1),
    source: z.string().min(1),
    status: UploadStatusSchema,
    rows_in: z.number().int().nonnegative(),
    rows_valid: z.number().int().nonnegative(),
    rows_dropped: z.number().int().nonnegative(),
    duplicates_collapsed: z.number().int().nonnegative(),
    created_at: z.string(),
  })
  .strict()

export type UploadDto = z.infer<typeof UploadSchema>

export const QualityIssueSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  count: z.number().int().nonnegative(),
  sample: z.array(z.string()),
})

export type QualityIssueDto = z.infer<typeof QualityIssueSchema>

export const QualityReportSchema = z
  .object({
    rows_in: z.number().int().nonnegative(),
    rows_valid: z.number().int().nonnegative(),
    rows_dropped: z.number().int().nonnegative(),
    duplicates_collapsed: z.number().int().nonnegative(),
    mapped_columns: z.record(z.string(), z.string()),
    unmapped_columns: z.array(z.string()),
    issues: z.array(QualityIssueSchema),
    source_format: z.string().min(1),
    encoding: z.string().nullable(),
    delimiter: z.string().nullable(),
    file_hash: z.string().length(64),
  })
  .strict()

export type QualityReportDto = z.infer<typeof QualityReportSchema>

export const ClearUploadsResponseSchema = z.object({
  cleared: z.boolean(),
})

export type ClearUploadsResponse = z.infer<typeof ClearUploadsResponseSchema>
