const express = require('express');
const router = express.Router();
const Usuario = require('../models/Usuario');
const jwt = require('jsonwebtoken');

const camposPublicosUsuario = (usuario) => ({
    _id: usuario._id,
    nombre: usuario.nombre,
    email: usuario.email,
    telefono: usuario.telefono || usuario.celular || null,
    departamento: usuario.departamento || null,
    ciudad: usuario.ciudad
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
            valor === null || valor === undefined ||
            (typeof valor === 'string' && valor.trim() === '')
        )) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios' });
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
