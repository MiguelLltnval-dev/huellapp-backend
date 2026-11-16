const mongoose = require('mongoose');

const PistaSchema = new mongoose.Schema({
    mascotaId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Mascota',
        required: true
    },
    usuarioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    descripcion: { type: String, required: true, trim: true },
    ubicacion: { type: String, required: true, trim: true },
    fecha: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Pista', PistaSchema);
