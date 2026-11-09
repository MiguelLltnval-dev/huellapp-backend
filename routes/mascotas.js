const express = require('express');
const router = express.Router();
const Mascota = require('../models/Mascota');
const mongoose = require('mongoose');

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

// PATCH: Actualizar el estado de una mascota
router.patch('/:id/estado', async (req, res) => {
    try {
        let estadoNormalizado = req.body.estado;
        if (estadoNormalizado === 'EN_CASA') estadoNormalizado = 'EN CASA';
        if (!['EN CASA', 'PERDIDO'].includes(estadoNormalizado)) {
            return res.status(400).json({ error: 'Estado inválido' });
        }

        if (!mongoose.isObjectIdOrHexString(req.params.id)) {
            return res.status(400).json({ error: 'ID de mascota inválido' });
        }

        const mascotaActualizada = await Mascota.findByIdAndUpdate(
            req.params.id,
            { estado: estadoNormalizado },
            { new: true, runValidators: true }
        );

        if (!mascotaActualizada) {
            return res.status(404).json({ error: 'Mascota no encontrada' });
        }

        res.status(200).json(mascotaActualizada);
    } catch (error) {
        console.error('Error en PATCH /mascotas/:id/estado:', error);
        res.status(500).json({ error: 'Error al actualizar el estado de la mascota' });
    }
});

module.exports = router;