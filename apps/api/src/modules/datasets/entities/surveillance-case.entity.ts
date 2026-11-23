import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm'

import { UploadEntity } from './upload.entity'

@Entity({ name: 'surveillance_cases' })
@Unique('uq_cases_upload_natural_key', ['uploadId', 'naturalKey'])
@Index('ix_cases_upload_department_week', ['uploadId', 'department', 'year', 'epiWeek'])
@Index('ix_cases_upload_province_week', ['uploadId', 'province', 'year', 'epiWeek'])
@Index('ix_cases_upload_ubigeo', ['uploadId', 'ubigeo'])
export class SurveillanceCaseEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id!: number

  @Column({ name: 'upload_id', type: 'integer' })
  uploadId!: number

  @Column({ type: 'text' })
  disease!: string

  @Column({ type: 'char', length: 6 })
  ubigeo!: string

  @Column({ type: 'smallint' })
  year!: number

  @Column({ name: 'epi_week', type: 'smallint' })
  epiWeek!: number

  @Column({ type: 'text', default: '' })
  department!: string

  @Column({ type: 'text', default: '' })
  province!: string

  @Column({ type: 'text', default: '' })
  district!: string

  @Column({ type: 'text', default: '' })
  directorate!: string

  @Column({ type: 'text', default: 'unknown' })
  sex!: string

  @Column({ name: 'age_group', type: 'text', default: 'unknown' })
  ageGroup!: string

  @Column({ name: 'age_type', type: 'text', default: '' })
  ageType!: string

  @Column({ type: 'text', default: '' })
  diagnosis!: string

  @Column({ name: 'diagnosis_type', type: 'text', default: '' })
  diagnosisType!: string

  @Column({ type: 'integer' })
  cases!: number

  @Column({ name: 'natural_key', type: 'char', length: 64 })
  naturalKey!: string

  @ManyToOne(() => UploadEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'upload_id' })
  upload!: UploadEntity
}
