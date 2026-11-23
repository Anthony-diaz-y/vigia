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

@Entity({ name: 'upload_quality_issues' })
@Unique('uq_quality_issue_upload_code', ['uploadId', 'code'])
@Unique('uq_quality_issue_upload_position', ['uploadId', 'position'])
@Index('ix_quality_issues_upload_id', ['uploadId'])
export class QualityIssueEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id!: number

  @Column({ name: 'upload_id', type: 'integer' })
  uploadId!: number

  @Column({ type: 'integer' })
  position!: number

  @Column({ type: 'varchar', length: 64 })
  code!: string

  @Column({ type: 'text' })
  message!: string

  @Column({ type: 'integer' })
  count!: number

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  sample!: string[]

  @ManyToOne(() => UploadEntity, (upload) => upload.issues, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'upload_id' })
  upload!: UploadEntity
}
