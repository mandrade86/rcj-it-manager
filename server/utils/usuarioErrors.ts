const FIELD_LABELS: Record<string, string> = {
  nombre: 'nombre',
  email: 'correo electrónico',
  login_dominio: 'usuario de dominio',
  rol_id: 'rol',
  empleado_id: 'empleado vinculado',
  departamento_id: 'departamento',
  password: 'contraseña local',
}

export function usuarioFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field
}

export function duplicateUsuarioMessage(keyPattern: Record<string, unknown> | undefined): {
  error: string
  field: string
} {
  const key = Object.keys(keyPattern ?? {})[0] ?? 'email'
  if (key === 'login_dominio') {
    return {
      field: 'login_dominio',
      error: 'Ya existe un usuario con ese login de dominio. Verifica la lista o usa otro nombre de usuario.',
    }
  }
  return {
    field: 'email',
    error: 'Ya existe un usuario con ese correo o login. Verifica la lista o usa otro identificador.',
  }
}
