const express = require('express');
const { GoogleGenAI } = require('@google/genai');

const router = express.Router();

router.post('/chat', async (req, res) => {
    const { mensaje } = req.body || {};
    if (typeof mensaje !== 'string' || !mensaje.trim()) {
        return res.status(400).json({ error: 'El mensaje es obligatorio' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('GEMINI_API_KEY no está configurada');
        return res.status(503).json({ error: 'El servicio de IA no está configurado' });
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        const result = await ai.models.generateContent({
            model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
            contents: mensaje.trim()
        });

        if (typeof result.text !== 'string' || !result.text.trim()) {
            console.error('Gemini devolvió una respuesta vacía');
            return res.status(502).json({ error: 'El asistente devolvió una respuesta inválida' });
        }

        return res.status(200).json({ respuesta: result.text.trim() });
    } catch (error) {
        console.error('Error en POST /api/chat:', error);
        return res.status(502).json({ error: 'No se pudo obtener respuesta del asistente' });
    }
});

module.exports = router;
