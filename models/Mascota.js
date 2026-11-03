const mongoose = require('mongoose');

const MascotaSchema = new mongoose.Schema({
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    nombre: { type: String, default: 'Desconocido' },
    especie: { type: String, required: true },
    color: { type: String, required: true },
    ciudad: { type: String, required: true },
    estado: { type: String, enum: ['PERDIDO', 'EN_CASA'], default: 'PERDIDO' },
    
    // Divisor de flujos (Arquitectura)
    tipoPublicacion: { type: String, enum: ['emergencia', 'adopcion'], default: 'emergencia' },
    
    // Opcionales para adopción
    edadAproximada: { type: String, default: null },
    requisitosAdopcion: { type: String, default: null },
    
    // Foto en formato texto
    fotoUrl: { type: String, default: null } 
}, { timestamps: true });

module.exports = mongoose.model('Mascota', MascotaSchema);