import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity({ name: 'dataset_rows' })
export class DatasetRowEntity {
  @PrimaryColumn({ name: 'upload_id', type: 'integer' })
  uploadId!: number

  @PrimaryColumn({ name: 'row_number', type: 'integer' })
  rowNumber!: number

  @Column({ type: 'jsonb' })
  data!: Record<string, string | number | null>
}
