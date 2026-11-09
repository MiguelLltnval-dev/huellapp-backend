const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UsuarioSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    telefono: { type: String, required: false },
    departamento: { type: String, required: false },
    celular: { type: String },
    ciudad: { type: String, required: false },
    identidadVerificada: { type: Boolean, default: false }
}, { timestamps: true });

// Encriptar la contraseña antes de guardarla
UsuarioSchema.pre('save', async function() {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Método para verificar la contraseña en el Login
UsuarioSchema.methods.compararPassword = async function(candidata) {
    return await bcrypt.compare(candidata, this.password);
};

module.exports = mongoose.model('Usuario', UsuarioSchema);