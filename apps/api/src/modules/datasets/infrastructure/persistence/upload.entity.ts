import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

import type { DatasetColumn } from '@vigia/epidemiology'

import { QualityIssueEntity } from './quality-issue.entity'

@Entity({ name: 'uploads' })
@Index('ix_uploads_created_at', ['createdAt'])
export class UploadEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id!: number

  @Column({ name: 'file_hash', type: 'char', length: 64, unique: true })
  fileHash!: string

  @Column({ type: 'text' })
  filename!: string

  @Column({ type: 'varchar', length: 64 })
  source!: string

  @Column({ type: 'varchar', length: 32 })
  status!: string

  @Column({ name: 'rows_in', type: 'integer' })
  rowsIn!: number

  @Column({ name: 'rows_valid', type: 'integer' })
  rowsValid!: number

  @Column({ name: 'rows_dropped', type: 'integer' })
  rowsDropped!: number

  @Column({ name: 'duplicates_collapsed', type: 'integer' })
  duplicatesCollapsed!: number

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  mapping!: Record<string, string>

  @Column({ name: 'unmapped_columns', type: 'jsonb', default: () => "'[]'::jsonb" })
  unmappedColumns!: string[]

  @Column({ type: 'text', default: '' })
  title!: string

  @Column({ type: 'text', default: '' })
  topic!: string

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  columns!: DatasetColumn[]

  @Column({ type: 'boolean', default: true })
  epi!: boolean

  @Column({ name: 'source_format', type: 'varchar', length: 16, default: 'csv' })
  sourceFormat!: string

  @Column({ type: 'varchar', length: 32, nullable: true })
  encoding!: string | null

  @Column({ type: 'varchar', length: 8, nullable: true })
  delimiter!: string | null

  @Column({ name: 'raw_storage_key', type: 'text' })
  rawStorageKey!: string

  @Column({ name: 'normalized_storage_key', type: 'text', nullable: true })
  normalizedStorageKey!: string | null

  @Column({ name: 'quality_storage_key', type: 'text', nullable: true })
  qualityStorageKey!: string | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date

  @OneToMany(() => QualityIssueEntity, (issue) => issue.upload)
  issues!: QualityIssueEntity[]
}
