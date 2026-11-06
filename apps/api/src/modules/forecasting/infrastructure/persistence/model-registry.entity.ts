import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity({ name: 'model_registry' })
export class ModelRegistryEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id!: number

  @Column({ name: 'model_id', type: 'char', length: 16, unique: true })
  modelId!: string

  @Column({ type: 'varchar', length: 16 })
  level!: string

  @Column({ type: 'jsonb' })
  config!: Record<string, unknown>

  @Column({ name: 'data_cut', type: 'jsonb' })
  dataCut!: Record<string, unknown>

  @Column({ type: 'jsonb' })
  scorecard!: unknown[]

  @Column({ name: 'forecasts_storage_key', type: 'text', nullable: true })
  forecastsStorageKey!: string | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date
}
