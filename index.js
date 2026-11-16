require('dotenv').config();
if (!process.env.GEMINI_API_KEY) {
    console.warn('\x1b[1;33m%s\x1b[0m', '⚠️ GEMINI_API_KEY no está configurada; configura esta variable en Render.');
}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middlewares
app.use(cors());
// Límite ampliado a 50mb para recibir fotos desde Android
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Conexión a MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB Atlas Conectado a HuellApp'))
    .catch(err => console.error('❌ Error conectando a BD:', err));

// Rutas
app.get('/', (req, res) => {
    res.json({ status: 'OK', message: 'API HuellApp en Producción' });
});

app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/mascotas', require('./routes/mascotas'));
app.use('/api/ia', require('./routes/ia'));
app.use('/api', require('./routes/chat'));

// Iniciar Servidor en 0.0.0.0 para evitar el bloqueo del emulador
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor HuellApp corriendo en http://0.0.0.0:${PORT}`);
});