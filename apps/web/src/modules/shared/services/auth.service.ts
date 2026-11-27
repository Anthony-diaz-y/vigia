import type {
  CreateUserRequest,
  LoginRequest,
  LoginResponse,
  SessionUser,
  UserDto,
} from '@vigia/contracts'

import { apiDelete, apiGet, apiPost } from '../api'

// Inicia sesión con correo y contraseña
export function login(request: LoginRequest): Promise<LoginResponse> {
  return apiPost<LoginResponse>('/api/auth/login', request)
}

// Usuario de la sesión actual, para comprobar que sigue vigente
export function fetchMe(): Promise<SessionUser> {
  return apiGet<SessionUser>('/api/auth/me')
}

// Lista los usuarios (solo administradores)
export function fetchUsers(): Promise<UserDto[]> {
  return apiGet<UserDto[]>('/api/users')
}

// Crea un usuario (solo administradores)
export function createUser(request: CreateUserRequest): Promise<UserDto> {
  return apiPost<UserDto>('/api/users', request)
}

// Elimina un usuario (solo administradores)
export function deleteUser(id: number): Promise<void> {
  return apiDelete<void>(`/api/users/${id}`)
}
