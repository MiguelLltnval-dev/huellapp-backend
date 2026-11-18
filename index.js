require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
if (!process.env.GROQ_API_KEY) console.warn('GROQ_API_KEY no está configurada.');
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB Atlas conectado a HuellApp'))
    .catch(error => console.error('Error conectando a BD:', error.message));
const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => console.log('Servidor HuellApp en puerto ' + port));
