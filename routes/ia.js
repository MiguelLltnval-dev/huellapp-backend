const express = require('express');
const Groq = require('groq-sdk');

const router = express.Router();

const SYSTEM_PROMPT = `Eres el asistente virtual de HuellApp, una app colombiana de mascotas perdidas. Responde siempre amablemente y de forma concisa.
Si el usuario reporta un avistamiento claro, pon esBorrador en true y extrae especie, raza, color y ciudad. Si un dato no está presente, usa un string vacío y no lo inventes.
Si el usuario solo saluda o el avistamiento no es claro, pon esBorrador en false y mascotaGenerada en null.
Devuelve únicamente un objeto JSON válido con exactamente estas propiedades: respuesta (string), esBorrador (boolean) y mascotaGenerada (null u objeto con especie, raza, color y ciudad como strings). No agregues texto ni formato Markdown.`;

const serializarDetalleError = (detalle, apiKey) => {
    let texto;
    try {
        texto = typeof detalle === 'string' ? detalle : JSON.stringify(detalle);
    } catch (error) {
        console.error('No se pudo serializar el detalle de Groq:', error);
        texto = String(detalle);
    }

    texto = texto || 'Error desconocido del servidor.';
    const clave = typeof apiKey === 'string' ? apiKey.trim() : '';
    if (clave.length >= 8) {
        texto = texto.split(clave).join('[REDACTED]');
    }

    return texto.length > 1500 ? `${texto.slice(0, 1500)}…` : texto;
};

const normalizarRespuesta = (datos) => {
    if (!datos || typeof datos !== 'object' || Array.isArray(datos) ||
        typeof datos.respuesta !== 'string' || typeof datos.esBorrador !== 'boolean') {
        return null;
    }

    if (!datos.esBorrador) {
        return {
            respuesta: datos.respuesta,
            esBorrador: false,
            mascotaGenerada: null
        };
    }

    const mascota = datos.mascotaGenerada;
    if (!mascota || typeof mascota !== 'object' || Array.isArray(mascota)) {
        return null;
    }

    const campos = ['especie', 'raza', 'color', 'ciudad'];
    if (campos.some((campo) =>
        mascota[campo] !== undefined && typeof mascota[campo] !== 'string'
    )) {
        return null;
    }

    return {
        respuesta: datos.respuesta,
        esBorrador: true,
        mascotaGenerada: {
            especie: mascota.especie || '',
            raza: mascota.raza || '',
            color: mascota.color || '',
            ciudad: mascota.ciudad || ''
        }
    };
};

router.post('/chat', async (req, res) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (typeof apiKey !== 'string' || !apiKey.trim()) {
        console.warn('GROQ_API_KEY no está configurada');
        return res.status(503).json({ error: 'El servicio de IA no está configurado' });
    }

    const { mensaje } = req.body || {};
    if (typeof mensaje !== 'string' || !mensaje.trim()) {
        return res.status(400).json({ error: 'El mensaje es requerido' });
    }

    try {
        const groq = new Groq({ apiKey: apiKey.trim() });
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: mensaje.trim() }
            ],
            model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
            temperature: 0.2,
            response_format: { type: 'json_object' }
        });

        const respuestaCruda = chatCompletion.choices?.[0]?.message?.content;
        if (typeof respuestaCruda !== 'string' || !respuestaCruda.trim()) {
            console.error('Groq devolvió una respuesta vacía');
            return res.status(502).json({ error: 'El asistente devolvió una respuesta inválida' });
        }

        let datos;
        try {
            const respuestaLimpia = respuestaCruda.replace(/```(?:json)?/gi, '').trim();
            datos = JSON.parse(respuestaLimpia);
        } catch (parseError) {
            console.error('Groq devolvió JSON inválido:', parseError);
            return res.status(200).json({
                respuesta: 'Comprendo, pero tuve problemas estructurando la información. ¿Puedes repetirlo más claramente?',
                esBorrador: false,
                mascotaGenerada: null
            });
        }

        const respuesta = normalizarRespuesta(datos);
        if (!respuesta) {
            console.error('Groq devolvió un JSON con formato inesperado');
            return res.status(502).json({ error: 'El asistente devolvió una respuesta inválida' });
        }

        return res.status(200).json(respuesta);
    } catch (error) {
        const datoError = error && error.response
            ? error.response.data || error.response.error
            : error && error.error;
        const mensajeReal = datoError || (error && error.message) || 'Error desconocido del servidor.';
        const detalleSeguro = serializarDetalleError(mensajeReal, apiKey);

        console.error('=== ERROR CRÍTICO GROQ ===');
        console.error('Detalle:', detalleSeguro);
        console.error(error instanceof Error
            ? {
                name: error.name,
                message: detalleSeguro,
                status: error.status,
                stack: error.stack ? serializarDetalleError(error.stack, apiKey) : undefined
            }
            : error);

        return res.status(500).json({
            error: `Fallo en la IA (Groq): ${detalleSeguro}`
        });
    }
});

module.exports = router;
