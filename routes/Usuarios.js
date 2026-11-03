const express = require('express');
const router = express.Router();
const Usuario = require('../models/Usuario');
const jwt = require('jsonwebtoken');

// POST: Registrar nuevo usuario
router.post('/registro', async (req, res) => {
    try {
        const { email } = req.body;
        const usuarioExiste = await Usuario.findOne({ email });
        if (usuarioExiste) {
            return res.status(400).json({ error: "El correo ya está registrado" });
        }

        const nuevoUsuario = new Usuario(req.body);
        const guardado = await nuevoUsuario.save();
        
        res.status(201).json({ mensaje: "Usuario registrado con éxito", usuarioId: guardado._id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al registrar usuario" });
    }
});

// POST: Iniciar Sesión (Login)
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const usuario = await Usuario.findOne({ email });
        if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });

        const esValida = await usuario.compararPassword(password);
        if (!esValida) return res.status(401).json({ error: "Contraseña incorrecta" });

        const token = jwt.sign({ id: usuario._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

        res.status(200).json({
            mensaje: "Login exitoso",
            token,
            usuario: {
                id: usuario._id,
                nombre: usuario.nombre,
                email: usuario.email,
                ciudad: usuario.ciudad
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error en el servidor" });
    }
});

module.exports = router;