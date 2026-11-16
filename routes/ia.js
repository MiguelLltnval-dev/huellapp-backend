const express = require('express');
const router = express.Router();

const SYSTEM_PROMPT = `Eres el asistente virtual de HuellApp, una app colombiana de mascotas perdidas. Responde siempre amablemente. Si el usuario te da detalles de un avistamiento (ej. 'vi un perro negro en Bogotá'), extrae esos datos.

Devuelve únicamente un JSON válido con las propiedades respuesta (string), esBorrador (boolean) y mascotaGenerada (null u objeto). Si el usuario solo saluda o no describe un avistamiento claro, esBorrador debe ser false y mascotaGenerada null. Si describe un avistamiento claro, esBorrador debe ser true y mascotaGenerada debe contener especie, raza, color y ciudad como strings. No inventes datos que no mencione; deja esos campos como strings vacíos.

Se breve y conciso. No utilices formato Markdown (como negritas con asteriscos ** o listas) en el campo 'respuesta'. Entrega la respuesta lo más rápido posible.`;

const responseSchema = {
    type: 'OBJECT',
    properties: {
        respuesta: { type: 'STRING' },
        esBorrador: { type: 'BOOLEAN' },
        mascotaGenerada: {
            type: 'OBJECT',
            nullable: true,
            properties: {
                especie: { type: 'STRING' },
                raza: { type: 'STRING' },
                color: { type: 'STRING' },
                ciudad: { type: 'STRING' }
            },
            required: ['especie', 'raza', 'color', 'ciudad']
        }
    },
    required: ['respuesta', 'esBorrador', 'mascotaGenerada']
};

const esRespuestaValida = (datos) => {
    if (!datos || typeof datos.respuesta !== 'string' || typeof datos.esBorrador !== 'boolean') {
        return false;
    }

    if (!datos.esBorrador) {
        return datos.mascotaGenerada === null;
    }

    const mascota = datos.mascotaGenerada;
    return mascota !== null &&
        typeof mascota === 'object' &&
        ['especie', 'raza', 'color', 'ciudad'].every((campo) =>
            typeof mascota[campo] === 'string'
        );
};

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

    const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

    try {
        const respuestaApi = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                    contents: [{ role: 'user', parts: [{ text: mensaje.trim() }] }],
                    generationConfig: {
                        responseMimeType: 'application/json',
                        responseSchema,
                        temperature: 0.2
                    }
                }),
                signal: AbortSignal.timeout(60000)
            }
        );

        if (!respuestaApi.ok) {
            const detalle = await respuestaApi.text();
            console.error(`Error de Gemini (${respuestaApi.status}):`, detalle);
            return res.status(502).json({ error: 'No se pudo obtener respuesta del asistente' });
        }

        const resultadoApi = await respuestaApi.json();
        const texto = resultadoApi.candidates?.[0]?.content?.parts
            ?.map((parte) => parte.text || '')
            .join('')
            .trim();

        if (!texto) {
            console.error('Gemini devolvió una respuesta vacía');
            return res.status(502).json({ error: 'El asistente devolvió una respuesta inválida' });
        }

        let datos;
        try {
            datos = JSON.parse(texto);
        } catch (error) {
            console.error('Gemini devolvió JSON inválido:', error);
            return res.status(502).json({ error: 'El asistente devolvió una respuesta inválida' });
        }

        if (!esRespuestaValida(datos)) {
            console.error('Gemini devolvió un JSON con formato inesperado');
            return res.status(502).json({ error: 'El asistente devolvió una respuesta inválida' });
        }

        const mascotaGenerada = datos.esBorrador
            ? {
                especie: datos.mascotaGenerada.especie,
                raza: datos.mascotaGenerada.raza,
                color: datos.mascotaGenerada.color,
                ciudad: datos.mascotaGenerada.ciudad
            }
            : null;

        return res.status(200).json({
            respuesta: datos.respuesta,
            esBorrador: datos.esBorrador,
            mascotaGenerada
        });
    } catch (error) {
        console.error('Error en POST /ia/chat:', error);
        return res.status(502).json({ error: 'No se pudo procesar la solicitud del asistente' });
    }
});

module.exports = router;
