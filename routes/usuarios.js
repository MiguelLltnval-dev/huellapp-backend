const express = require('express');
const router = express.Router();
const Usuario = require('../models/Usuario');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const crypto = require('crypto');
const verificarToken = require('../middleware/verificarToken');

const camposPublicosUsuario = (usuario) => ({
    _id: usuario._id,
    nombre: usuario.nombre,
    email: usuario.email,
    celular: usuario.celular || usuario.telefono || null,
    telefono: usuario.telefono || usuario.celular || null,
    departamento: usuario.departamento || null,
    ciudad: usuario.ciudad,
    fotoPerfil: usuario.fotoPerfil || ''
});

// POST: Registrar nuevo usuario
router.post('/registro', async (req, res) => {
    try {
        req.body = req.body || {};
        const { nombre, email, password, departamento, ciudad } = req.body || {};
        const telefono = req.body.telefono || req.body.celular || '';
        const datos = {
            nombre: typeof nombre === 'string' ? nombre.trim() : nombre,
            email: typeof email === 'string' ? email.trim() : email,
            password,
            telefono: typeof telefono === 'string' ? telefono.trim() : telefono,
            departamento: typeof departamento === 'string' ? departamento.trim() : departamento,
            ciudad: typeof ciudad === 'string' ? ciudad.trim() : ciudad
        };

        if ([datos.nombre, datos.email, datos.password].some((valor) =>
            typeof valor !== 'string' || valor.trim() === ''
        )) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios' });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email) || datos.email.length > 254 ||
            datos.password.trim().length < 8 || Buffer.byteLength(datos.password, 'utf8') > 72) {
            return res.status(400).json({ error: 'Revisa el correo y la contraseña (mínimo 8 caracteres y máximo 72 bytes)' });
        }

        const emailNormalizado = datos.email.toLowerCase();
        const usuarioExiste = await Usuario.findOne({ email: emailNormalizado });
        if (usuarioExiste) {
            return res.status(400).json({ error: 'El correo ya está registrado' });
        }

        const nuevoUsuario = new Usuario({
            nombre: datos.nombre,
            email: emailNormalizado,
            password: datos.password,
            telefono: datos.telefono,
            departamento: datos.departamento,
            ciudad: datos.ciudad
        });
        const guardado = await nuevoUsuario.save();

        res.status(201).json({
            mensaje: 'Usuario registrado',
            usuario: camposPublicosUsuario(guardado)
        });
    } catch (error) {
        console.error('DETALLE EXACTO DEL ERROR:', error);
        if (error.code === 11000) {
            return res.status(400).json({ error: 'El correo ya está registrado' });
        }
        res.status(500).json({ error: error.message || 'Error al registrar usuario' });
    }
});

// PATCH: Actualizar el perfil del usuario autenticado
router.patch('/:id/perfil', verificarToken, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: 'ID de usuario inválido' });
        }

        if (String(req.usuarioId) !== req.params.id.toLowerCase()) {
            return res.status(403).json({ error: 'No puedes editar este perfil' });
        }

        const datos = req.body;
        if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
            return res.status(400).json({ error: 'Los datos del perfil son inválidos' });
        }

        // Compatibilidad con las APK anteriores que serializaban celular como telefono.
        if (!Object.prototype.hasOwnProperty.call(datos, 'celular') &&
            Object.prototype.hasOwnProperty.call(datos, 'telefono')) {
            datos.celular = datos.telefono;
        }

        const camposPermitidos = ['nombre', 'celular', 'departamento', 'ciudad', 'fotoPerfil'];
        const camposRecibidos = camposPermitidos.filter((campo) =>
            Object.prototype.hasOwnProperty.call(datos, campo)
        );

        if (camposRecibidos.length === 0) {
            return res.status(400).json({ error: 'No se recibieron datos para actualizar' });
        }

        if (camposRecibidos.some((campo) => typeof datos[campo] !== 'string')) {
            return res.status(400).json({ error: 'Los datos del perfil deben ser texto' });
        }

        const usuario = await Usuario.findById(req.params.id);
        if (!usuario) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        camposRecibidos.forEach((campo) => {
            usuario[campo] = datos[campo];
        });
        if (camposRecibidos.includes('celular')) usuario.telefono = datos.celular;

        const actualizado = await usuario.save();
        return res.status(200).json({
            mensaje: 'Perfil actualizado',
            usuario: camposPublicosUsuario(actualizado)
        });
    } catch (error) {
        console.error('Error en PATCH /usuarios/:id/perfil:', error);
        return res.status(500).json({ error: 'Error al actualizar el perfil' });
    }
});

const vigenciaCodigo = 15 * 60 * 1000;
const esperaReenvio = 60 * 1000;
const hashCodigo = (codigo) => crypto.createHash('sha256').update(codigo).digest('hex');
const normalizarCorreo = (email) => typeof email === 'string' ? email.trim().toLowerCase() : '';
const correoValido = (email) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const respuestaRecuperacion = { mensaje: 'Si el correo está registrado, recibirás un código de recuperación.' };

router.post('/recuperar', async (req, res) => {
    const email = normalizarCorreo(req.body?.email);
    if (!correoValido(email)) return res.status(400).json({ mensaje: 'Ingresa un correo válido.' });

    const apiKey = process.env.BREVO_API_KEY?.trim();
    const remitente = process.env.RECOVERY_EMAIL_FROM?.trim();
    if (!apiKey || !remitente) {
        console.error('Recuperación: faltan BREVO_API_KEY o RECOVERY_EMAIL_FROM');
        return res.status(503).json({ mensaje: 'El servicio de recuperación no está disponible.' });
    }

    const codigo = crypto.randomBytes(8).toString('hex').toUpperCase();
    const tokenHash = hashCodigo(codigo);
    const ahora = Date.now();
    try {
        const anterior = await Usuario.findOneAndUpdate(
            { email, $or: [
                { passwordResetExpires: null },
                { passwordResetExpires: { $lte: new Date(ahora + vigenciaCodigo - esperaReenvio) } }
            ] },
            { $set: { passwordResetTokenHash: tokenHash, passwordResetExpires: new Date(ahora + vigenciaCodigo) } },
            { projection: { passwordResetTokenHash: 1, passwordResetExpires: 1 }, returnDocument: 'before' }
        );
        if (!anterior) return res.json(respuestaRecuperacion);

        try {
            const respuesta = await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                    sender: { name: 'HuellApp', email: remitente },
                    to: [{ email }],
                    subject: 'Código de recuperación de HuellApp',
                    textContent: `Tu código es ${codigo}. Escríbelo en HuellApp junto con tu nueva contraseña. El código vence en 15 minutos. Si no lo pediste, ignora este correo.`
                }),
                signal: AbortSignal.timeout(10000)
            });
            if (!respuesta.ok) throw new Error(`Brevo HTTP ${respuesta.status}`);
        } catch (error) {
            await Usuario.updateOne({ _id: anterior._id, passwordResetTokenHash: tokenHash }, { $set: {
                passwordResetTokenHash: anterior.passwordResetTokenHash ?? null,
                passwordResetExpires: anterior.passwordResetExpires ?? null
            } });
            console.error('Error al enviar recuperación:', error.message);
            return res.status(503).json({ mensaje: 'No se pudo enviar el código. Intenta de nuevo.' });
        }
        return res.json(respuestaRecuperacion);
    } catch (error) {
        console.error('Error al solicitar recuperación:', error.name);
        return res.status(500).json({ mensaje: 'No se pudo procesar la solicitud.' });
    }
});

router.post('/recuperar/confirmar', async (req, res) => {
    const email = normalizarCorreo(req.body?.email);
    const codigo = typeof req.body?.codigo === 'string' ? req.body.codigo.trim().toUpperCase() : '';
    const password = req.body?.password;
    if (!correoValido(email) || !/^[A-F0-9]{16}$/.test(codigo) ||
        typeof password !== 'string' || password.trim().length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
        return res.status(400).json({ mensaje: 'Revisa el correo, el código y la nueva contraseña.' });
    }
    try {
        const filtro = {
            email,
            passwordResetTokenHash: hashCodigo(codigo),
            passwordResetExpires: { $gt: new Date() }
        };
        if (await Usuario.exists(filtro)) {
            const passwordHash = await bcrypt.hash(password, 10);
            filtro.passwordResetExpires.$gt = new Date();
            const resultado = await Usuario.updateOne(filtro, { $set: {
                password: passwordHash, passwordResetTokenHash: null, passwordResetExpires: null
            } });
            if (resultado.modifiedCount === 1) return res.json({ mensaje: 'Contraseña actualizada.' });
        }
        return res.status(400).json({ mensaje: 'El código es incorrecto o venció. Puedes solicitar otro.' });
    } catch (error) {
        console.error('Error al confirmar recuperación:', error.name);
        return res.status(500).json({ mensaje: 'No se pudo actualizar la contraseña.' });
    }
});

// POST: Iniciar sesión
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (typeof email !== 'string' || !email.trim() ||
            typeof password !== 'string' || !password) {
            return res.status(400).json({ error: 'Email y password son obligatorios' });
        }

        const usuario = await Usuario.findOne({ email: email.trim().toLowerCase() });
        if (!usuario) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const esValida = await usuario.compararPassword(password);
        if (!esValida) {
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }

        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET no está configurado');
            return res.status(500).json({ error: 'Error en la configuración del servidor' });
        }

        const token = jwt.sign({ id: usuario._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

        res.status(200).json({
            mensaje: 'Login exitoso',
            token,
            usuario: camposPublicosUsuario(usuario)
        });
    } catch (error) {
        console.error('Error en POST /usuarios/login:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

module.exports = router;
