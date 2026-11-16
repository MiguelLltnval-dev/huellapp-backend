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

const serializarDetalleError = (detalle, apiKey) => {
    let texto;
    try {
        texto = typeof detalle === 'string' ? detalle : JSON.stringify(detalle);
    } catch (error) {
        console.error('No se pudo serializar el detalle de Gemini:', error);
        texto = String(detalle);
    }

    texto = texto || 'Error desconocido del servidor.';
    const clave = apiKey.trim();
    if (clave.length >= 8) {
        texto = texto.split(clave).join('[REDACTED]');
    }

    return texto.length > 1500 ? `${texto.slice(0, 1500)}…` : texto;
};

router.post('/chat', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (typeof apiKey !== 'string' || !apiKey.trim()) {
        return res.status(500).json({
            mensaje: 'CRÍTICO: No se ha configurado la variable GEMINI_API_KEY en Render'
        });
    }

    const { mensaje } = req.body || {};
    if (typeof mensaje !== 'string' || !mensaje.trim()) {
        return res.status(400).json({ error: 'El mensaje es obligatorio' });
    }

    const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

    try {
        const respuestaApi = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey.trim()
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
            const respuestaError = await respuestaApi.text();
            let detalleProveedor = respuestaError;
            try {
                detalleProveedor = JSON.parse(respuestaError);
            } catch (parseError) {
                console.error('La respuesta de error de Gemini no era JSON:', parseError);
            }

            const errorGemini = new Error(`Gemini respondió con HTTP ${respuestaApi.status}`);
            errorGemini.response = {
                status: respuestaApi.status,
                data: serializarDetalleError(detalleProveedor, apiKey)
            };
            throw errorGemini;
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

        const textoLimpio = texto.replace(/```(?:json)?/gi, '').trim();
        let datos;
        try {
            datos = JSON.parse(textoLimpio);
        } catch (parseError) {
            console.error('Gemini devolvió JSON inválido:', parseError);
            return res.status(200).json({
                respuesta: 'Comprendo, pero tuve problemas estructurando la información. ¿Puedes repetirlo más claramente?',
                esBorrador: false,
                mascotaGenerada: null
            });
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
        console.error('=== ERROR CRÍTICO AL CONTACTAR A GEMINI ===');

        let mensajeReal = 'Error desconocido del servidor.';
        if (error && error.response && error.response.data) {
            const data = error.response.data;
            const detalle = serializarDetalleError(data, apiKey);
            const estado = error.response.status ? `HTTP ${error.response.status}: ` : '';
            mensajeReal = `${estado}${detalle}`;
        } else if (error && error.message) {
            mensajeReal = error.message;
        }

        const detalleSeguro = serializarDetalleError(mensajeReal, apiKey);
        console.error('Detalle:', detalleSeguro);
        console.error(error instanceof Error
            ? {
                name: error.name,
                message: detalleSeguro,
                stack: error.stack ? serializarDetalleError(error.stack, apiKey) : undefined
            }
            : error);

        return res.status(500).json({
            error: `Fallo en Gemini: ${detalleSeguro}`
        });
    }
});

module.exports = router;
