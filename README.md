# HuellApp

API de HuellApp para usuarios, reportes, pistas, recuperación por correo y asistente con Groq.

## Entregables

- [Informe final, manual técnico, manual de usuario y acta](entregables/Informe_Final_HuellApp.pdf)
- [Código Android](https://github.com/MiguelLltnval-dev/huellapp-frontend)
- [Descargar la última APK](https://github.com/MiguelLltnval-dev/huellapp-frontend/releases/latest/download/HuellApp.apk)
- [Ver Releases](https://github.com/MiguelLltnval-dev/huellapp-frontend/releases/latest)
- [Compilación automática de Android](https://github.com/MiguelLltnval-dev/huellapp-frontend/actions/workflows/android-build.yml)
- [API desplegada](https://huellapp-backend.onrender.com/)

## Ejecutar localmente

Requiere Node.js 22 o compatible con las dependencias.

1. Ejecutar npm ci.
2. Copiar .env.example a .env.
3. Completar las variables sin subir secretos a Git.
4. Ejecutar npm run dev, o npm start sin recarga.

Variables: MONGODB_URI, JWT_SECRET, GROQ_API_KEY; GROQ_MODEL opcional; BREVO_API_KEY y RECOVERY_EMAIL_FROM para recuperación; PORT opcional en local. En Render se configuran en Environment.

## Pruebas

Ejecutar npm test. Las 15 pruebas ejercitan HTTP, JWT y bcrypt con modelos de datos y envío de correo simulados; no necesitan ni modifican una base de producción. La CI ejecuta estas pruebas tras cada push a main.

La recuperación genera un código de 16 caracteres válido durante 15 minutos. El código se guarda como hash, se envía mediante la API HTTPS de Brevo y se invalida al usarlo. Confirmar la recepción real del correo y la configuración del remitente en el entorno desplegado.

## Actualizar el computador principal

Dentro del backend:

~~~powershell
git status
git pull --ff-only origin main
npm ci
~~~

Dentro del frontend:

~~~powershell
git status
git pull --ff-only origin master
~~~

Abrir el frontend en Android Studio y sincronizar Gradle. Conservar el .env local; Git no lo distribuye. Si hay cambios locales, conservarlos antes de integrar; no usar reset --hard para resolver la actualización.

El frontend y el backend son repositorios independientes. La subcarpeta frontend de este PC se excluye del Git del backend. El workflow Android publica una APK debug en Releases; el backend se despliega de forma independiente en Render.

Antes de presentar: probar ingreso, reporte, pista, perfil, En Casa y recepción real del correo. Completar las evidencias por historia en Trello. El directorio veterinario sigue siendo beta informativa.
