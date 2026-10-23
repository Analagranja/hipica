type ErrorSupabase = {
  message?: string
  code?: string
  details?: string | null
}

const porCodigo: Record<string, string> = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  email_not_confirmed: 'Confirmá tu correo antes de entrar.',
  user_already_exists: 'Ya existe una cuenta con ese correo.',
  user_already_registered: 'Ya existe una cuenta con ese correo.',
  weak_password: 'La contraseña debe tener al menos 6 caracteres.',
  validation_failed: 'Revisá los datos ingresados.',
  email_address_invalid: 'El correo no tiene un formato válido.',
  over_request_rate_limit: 'Demasiados intentos. Esperá un momento y volvé a probar.',
  over_email_send_rate_limit:
    'Demasiados correos enviados. Esperá un momento y volvé a probar.',
  '23505': 'Ese dato ya existe.',
  '22P02': 'La invitación no es válida.',
  '42501': 'No tenés permiso para hacer eso.',
  PGRST301: 'Tu sesión venció. Volvé a entrar.',
}

const porMensaje: Record<string, string> = {
  'Invalid login credentials': 'Correo o contraseña incorrectos.',
  'Invalid email or password': 'Correo o contraseña incorrectos.',
  'Email not confirmed': 'Confirmá tu correo antes de entrar.',
  'User already registered': 'Ya existe una cuenta con ese correo.',
  'Password should be at least 6 characters':
    'La contraseña debe tener al menos 6 caracteres.',
  'Signup requires a valid password': 'Ingresá una contraseña.',
  'Unable to validate email address: invalid format':
    'El correo no tiene un formato válido.',
  'No autenticado': 'Tenés que iniciar sesión.',
  'Invitación inválida o vencida': 'La invitación no es válida o está vencida.',
  'La invitación es para otro correo': 'Esta invitación es para otro correo.',
}

export function mensajeErrorSupabase(error: ErrorSupabase | null | undefined): string {
  if (!error) return 'Ocurrió un error. Intentá de nuevo.'

  const codigo = error.code ?? ''
  if (porCodigo[codigo]) return porCodigo[codigo]

  const mensaje = (error.message ?? error.details ?? '').trim()
  if (!mensaje) return 'Ocurrió un error. Intentá de nuevo.'
  if (porMensaje[mensaje]) return porMensaje[mensaje]

  const texto = mensaje.toLowerCase()

  if (texto.includes('invalid login') || texto.includes('invalid email or password')) {
    return 'Correo o contraseña incorrectos.'
  }
  if (texto.includes('email not confirmed')) {
    return 'Confirmá tu correo antes de entrar.'
  }
  if (texto.includes('already registered') || texto.includes('already been registered')) {
    return 'Ya existe una cuenta con ese correo.'
  }
  if (texto.includes('at least 6 characters') || texto.includes('weak password')) {
    return 'La contraseña debe tener al menos 6 caracteres.'
  }
  if (texto.includes('unable to validate email') || texto.includes('invalid format')) {
    return 'El correo no tiene un formato válido.'
  }
  if (texto.includes('rate limit') || texto.includes('only request this after')) {
    return 'Demasiados intentos. Esperá un momento y volvé a probar.'
  }
  if (
    texto.includes('failed to fetch') ||
    texto.includes('networkerror') ||
    texto.includes('network request failed') ||
    texto.includes('load failed')
  ) {
    return 'No hay conexión. Revisá tu red e intentá de nuevo.'
  }
  if (texto.includes('jwt') || (texto.includes('session') && texto.includes('expired'))) {
    return 'Tu sesión venció. Volvé a entrar.'
  }
  if (texto.includes('duplicate key') || texto.includes('unique constraint')) {
    if (texto.includes('membresias')) return 'Ya formás parte de ese club.'
    return 'Ese dato ya existe.'
  }
  if (texto.includes('invalid input syntax for type uuid')) {
    return 'La invitación no es válida.'
  }
  if (texto.includes('null value') && texto.includes('nombre')) {
    return 'Ingresá el nombre del club.'
  }
  if (texto.includes('permission denied') || texto.includes('row-level security')) {
    return 'No tenés permiso para hacer eso.'
  }
  if (texto.includes('no autenticado')) return 'Tenés que iniciar sesión.'
  if (texto.includes('invitación inválida') || texto.includes('invitacion invalida')) {
    return 'La invitación no es válida o está vencida.'
  }
  if (texto.includes('otro correo')) return 'Esta invitación es para otro correo.'

  if (esEspanol(mensaje)) {
    return mensaje.endsWith('.') ? mensaje : `${mensaje}.`
  }

  return 'No se pudo completar la acción. Intentá de nuevo.'
}

function esEspanol(mensaje: string): boolean {
  return /[áéíóúñ¿¡]/i.test(mensaje)
}
