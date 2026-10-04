import { defineMessages } from '../define';

/** Signing in, creating an account, two-step codes, password resets and social sign-in. */
export const auth = defineMessages({
  en: {
    // Sign in
    signInTitle: 'Sign in',
    signInIntro: 'See your orders, save addresses and check out faster.',
    passwordChangedNotice: 'Password changed. Sign in with your new password.',
    email: 'Email',
    password: 'Password',
    signInButton: 'Sign in',
    signInWithPasskey: 'Sign in with a passkey',
    passkeyHint: 'Use your fingerprint, face or screen lock',
    passkeyFailed: 'No passkey was used. Try again or sign in with your password.',
    forgotPassword: 'Forgot your password?',
    newToNixzora: 'New to NIXZORA? <link>Create an account</link>',

    // Two-step code
    verifyMetaTitle: 'Two-step verification',
    verifyTitle: 'Enter your code',
    verifyIntro: 'Open your authenticator app and enter the 6-digit code, or use a recovery code.',
    code: 'Code',
    verifyButton: 'Verify',
    signInExpired: 'That sign-in expired. Start again.',

    // Create an account
    registerTitle: 'Create an account',
    firstName: 'First name',
    optional: 'Optional',
    passwordHint: 'At least 12 characters. A short sentence works well.',
    createAccountButton: 'Create account',
    alreadyHaveOne: 'Already have one? <link>Sign in</link>',

    // Forgot / reset password
    forgotTitle: 'Reset your password',
    forgotIntro: 'We’ll email you a link to choose a new one.',
    resetLinkSent: 'If that email has an account, a reset link is on its way.',
    sendLink: 'Send link',
    resetTitle: 'Choose a new password',
    newPassword: 'New password',
    newPasswordHint: 'At least 12 characters.',
    savePassword: 'Save password',

    // Confirm email
    confirmEmailTitle: 'Confirm your email',
    emailConfirmed: 'Thanks — your email is confirmed.',
    goToAccount: 'Go to your account',

    // Google / Apple
    socialExpired: 'That sign-in expired. Try again.',
    appleFailed: 'Apple sign-in did not finish. Try again.',
    signingIn: 'Signing you in…',
    orUseEmail: 'or use your email',
  },
  fr: {
    signInTitle: 'Connexion',
    signInIntro:
      'Suivez vos commandes, enregistrez vos adresses et passez commande plus rapidement.',
    passwordChangedNotice: 'Mot de passe modifié. Connectez-vous avec votre nouveau mot de passe.',
    email: 'E-mail',
    password: 'Mot de passe',
    signInButton: 'Se connecter',
    signInWithPasskey: 'Se connecter avec une clé d’accès',
    passkeyHint: 'Utilisez votre empreinte, votre visage ou le verrouillage de l’écran',
    passkeyFailed:
      'Aucune clé d’accès n’a été utilisée. Réessayez ou connectez-vous avec votre mot de passe.',
    forgotPassword: 'Mot de passe oublié ?',
    newToNixzora: 'Nouveau sur NIXZORA ? <link>Créer un compte</link>',

    verifyMetaTitle: 'Vérification en deux étapes',
    verifyTitle: 'Saisissez votre code',
    verifyIntro:
      'Ouvrez votre application d’authentification et saisissez le code à 6 chiffres, ou utilisez un code de récupération.',
    code: 'Code',
    verifyButton: 'Vérifier',
    signInExpired: 'Cette connexion a expiré. Recommencez.',

    registerTitle: 'Créer un compte',
    firstName: 'Prénom',
    optional: 'Facultatif',
    passwordHint: 'Au moins 12 caractères. Une courte phrase fait très bien l’affaire.',
    createAccountButton: 'Créer mon compte',
    alreadyHaveOne: 'Vous avez déjà un compte ? <link>Se connecter</link>',

    forgotTitle: 'Réinitialiser votre mot de passe',
    forgotIntro: 'Nous vous enverrons par e-mail un lien pour en choisir un nouveau.',
    resetLinkSent:
      'Si un compte existe pour cette adresse e-mail, un lien de réinitialisation vous a été envoyé.',
    sendLink: 'Envoyer le lien',
    resetTitle: 'Choisissez un nouveau mot de passe',
    newPassword: 'Nouveau mot de passe',
    newPasswordHint: 'Au moins 12 caractères.',
    savePassword: 'Enregistrer le mot de passe',

    confirmEmailTitle: 'Confirmez votre adresse e-mail',
    emailConfirmed: 'Merci, votre adresse e-mail est confirmée.',
    goToAccount: 'Accéder à votre compte',

    socialExpired: 'Cette connexion a expiré. Réessayez.',
    appleFailed: 'La connexion avec Apple n’a pas abouti. Réessayez.',
    signingIn: 'Connexion en cours…',
    orUseEmail: 'ou utilisez votre e-mail',
  },
  es: {
    signInTitle: 'Iniciar sesión',
    signInIntro: 'Consulta tus pedidos, guarda direcciones y paga más rápido.',
    passwordChangedNotice: 'Contraseña cambiada. Inicia sesión con tu nueva contraseña.',
    email: 'Correo electrónico',
    password: 'Contraseña',
    signInButton: 'Iniciar sesión',
    signInWithPasskey: 'Iniciar sesión con una llave de acceso',
    passkeyHint: 'Usa tu huella, tu rostro o el bloqueo de pantalla',
    passkeyFailed:
      'No se usó ninguna llave de acceso. Inténtalo de nuevo o inicia sesión con tu contraseña.',
    forgotPassword: '¿Olvidaste tu contraseña?',
    newToNixzora: '¿Eres nuevo en NIXZORA? <link>Crea una cuenta</link>',

    verifyMetaTitle: 'Verificación en dos pasos',
    verifyTitle: 'Ingresa tu código',
    verifyIntro:
      'Abre tu app de autenticación e ingresa el código de 6 dígitos, o usa un código de recuperación.',
    code: 'Código',
    verifyButton: 'Verificar',
    signInExpired: 'Ese inicio de sesión expiró. Empieza de nuevo.',

    registerTitle: 'Crear una cuenta',
    firstName: 'Nombre',
    optional: 'Opcional',
    passwordHint: 'Al menos 12 caracteres. Una frase corta funciona bien.',
    createAccountButton: 'Crear cuenta',
    alreadyHaveOne: '¿Ya tienes una? <link>Inicia sesión</link>',

    forgotTitle: 'Restablece tu contraseña',
    forgotIntro: 'Te enviaremos por correo un enlace para elegir una nueva.',
    resetLinkSent:
      'Si ese correo tiene una cuenta, te enviamos un enlace para restablecer la contraseña.',
    sendLink: 'Enviar enlace',
    resetTitle: 'Elige una nueva contraseña',
    newPassword: 'Nueva contraseña',
    newPasswordHint: 'Al menos 12 caracteres.',
    savePassword: 'Guardar contraseña',

    confirmEmailTitle: 'Confirma tu correo',
    emailConfirmed: 'Gracias, tu correo está confirmado.',
    goToAccount: 'Ir a tu cuenta',

    socialExpired: 'Ese inicio de sesión expiró. Inténtalo de nuevo.',
    appleFailed: 'El inicio de sesión con Apple no se completó. Inténtalo de nuevo.',
    signingIn: 'Iniciando sesión…',
    orUseEmail: 'o usa tu correo',
  },
});
