// Textos en español para las pantallas de contraseña

export const MIN_PASSWORD_LENGTH = 8;

// Revisa la contraseña nueva antes de mandarla; regresa el mensaje de error o '' si está bien
export const checkNewPassword = (password: string, repeat: string): string => {
  if (password.length < MIN_PASSWORD_LENGTH) return `La contraseña nueva debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  if (password !== repeat) return 'Las dos contraseñas nuevas no son iguales.';
  return '';
};

export const authErrorMessage = (code: string): string => {
  switch (code) {
    case 'wrong_password':
      return 'La contraseña actual no es correcta.';
    case 'same_password':
      return 'La contraseña nueva debe ser distinta a la actual.';
    case 'weak_password':
      return 'Esa contraseña es muy fácil de adivinar. Usa una más larga o con números y letras.';
    case 'session_expired':
      return 'Tu sesión terminó. Entra de nuevo e inténtalo otra vez.';
    case 'link_expired':
      return 'El enlace ya no sirve (vence pronto y solo se usa una vez). Pide uno nuevo.';
    case 'rate_limited':
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Se hicieron muchos intentos. Espera unos minutos y vuelve a intentar.';
    case 'network':
      return 'No pudimos conectarnos. Revisa tu internet e intenta de nuevo.';
    default:
      return 'No se pudo completar. Intenta de nuevo en un momento.';
  }
};
