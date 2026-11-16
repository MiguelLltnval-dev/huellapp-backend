const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
    const autorizacion = req.headers.authorization;
    const coincidencia = typeof autorizacion === 'string'
        ? autorizacion.match(/^Bearer\s+(\S+)$/i)
        : null;

    if (!coincidencia) {
        return res.status(401).json({ error: 'Token de autenticación requerido' });
    }

    if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET no está configurado');
        return res.status(500).json({ error: 'Error en la configuración del servidor' });
    }

    try {
        const decoded = jwt.verify(coincidencia[1], process.env.JWT_SECRET);
        if (!decoded || typeof decoded !== 'object' || !decoded.id) {
            return res.status(401).json({ error: 'Token inválido' });
        }

        req.usuarioId = decoded.id;
        return next();
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ error: 'Token inválido o expirado' });
        }

        return next(error);
    }
};

module.exports = verificarToken;
