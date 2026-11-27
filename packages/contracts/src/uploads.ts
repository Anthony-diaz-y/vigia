import { z } from 'zod'

import {
  COLUMN_ROLES,
  DESCRIPTIVE_FIELDS,
  MAX_VALUE_LABEL,
  PLACE_LEVELS,
  UPLOAD_STATUSES,
} from '@vigia/epidemiology'

export const UploadStatusSchema = z.enum(UPLOAD_STATUSES)

export const ColumnRoleSchema = z.enum(COLUMN_ROLES)

export const PlaceLevelSchema = z.enum(PLACE_LEVELS)

export const ColumnKindSchema = z.enum(['date', 'number', 'text'])

export const TimeKindSchema = z.enum(['date', 'week', 'month', 'year', 'none'])

export const ValueLabelsSchema = z.record(
  z.string().min(1),
  z.string().trim().min(1).max(MAX_VALUE_LABEL),
)

export const DatasetColumnSchema = z
  .object({
    name: z.string(),
    label: z.string(),
    role: ColumnRoleSchema,
    level: PlaceLevelSchema.nullable(),
    field: z.enum(DESCRIPTIVE_FIELDS).nullable(),
    kind: ColumnKindSchema,
    values: ValueLabelsSchema.optional(),
  })
  .strict()

export type DatasetColumnDto = z.infer<typeof DatasetColumnSchema>

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
    title: z.string(),
    topic: z.string(),
    columns: z.array(DatasetColumnSchema),
    time: TimeKindSchema,
    epi: z.boolean(),
    indicators: z.array(z.object({ id: z.string(), label: z.string() }).strict()),
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

export const OptionInfoSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    description: z.string().optional(),
  })
  .strict()

export const PreviewColumnSchema = DatasetColumnSchema.extend({
  samples: z.array(z.string()),
  codes: z.array(z.string()).optional(),
  reason: z.string().nullable(),
}).strict()

export type PreviewColumnDto = z.infer<typeof PreviewColumnSchema>

export const UploadPreviewSchema = z
  .object({
    source: z.string().min(1),
    title: z.string(),
    topic: z.string(),
    rows: z.number().int().nonnegative(),
    suggested_by: z.enum(['deepseek', 'rules']),
    columns: z.array(PreviewColumnSchema),
    roles: z.array(OptionInfoSchema),
    place_levels: z.array(OptionInfoSchema),
    pii_detected: z.array(z.string()),
  })
  .strict()

export type UploadPreview = z.infer<typeof UploadPreviewSchema>
