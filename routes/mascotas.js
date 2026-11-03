const express = require('express');
const router = express.Router();
const Mascota = require('../models/Mascota');

// GET: Obtener mascotas (Permite filtrar por emergencia o adopción)
router.get('/', async (req, res) => {
    try {
        const { tipo } = req.query;
        let filtro = {};
        if (tipo) filtro.tipoPublicacion = tipo;

        const mascotas = await Mascota.find(filtro).sort({ createdAt: -1 });
        res.status(200).json(mascotas);
    } catch (error) {
        console.error("Error en GET /mascotas:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// POST: Registrar Mascota (Emergencia o Adopción)
router.post('/', async (req, res) => {
    try {
        const { especie, color, ciudad, usuarioId } = req.body;
        
        if (!especie || !color || !ciudad || !usuarioId) {
            return res.status(400).json({ error: "Faltan datos obligatorios" });
        }

        const nuevaMascota = new Mascota(req.body);
        const guardada = await nuevaMascota.save();
        
        console.log(`✅ ${guardada.tipoPublicacion} registrada`);
        res.status(201).json(guardada);
    } catch (error) {
        console.error("Error en POST /mascotas:", error);
        res.status(500).json({ error: "Error al guardar mascota" });
    }
});

module.exports = router;