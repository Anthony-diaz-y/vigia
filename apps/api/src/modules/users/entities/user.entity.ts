import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

import type { UserRole } from '../../../common/auth/session-token'

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id!: number

  @Column({ type: 'varchar', length: 254, unique: true })
  email!: string

  @Column({ type: 'varchar', length: 80 })
  name!: string

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash!: string

  @Column({ type: 'varchar', length: 16 })
  role!: UserRole

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date
}
