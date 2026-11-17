const Mascota = require('../models/Mascota');

const normalizar = (texto) => (typeof texto === 'string' ? texto : '')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();

const equivalencias = {
    perro: 'perro', perros: 'perro', perra: 'perro', perras: 'perro',
    perrito: 'perro', perritos: 'perro', perrita: 'perro', perritas: 'perro',
    gato: 'gato', gatos: 'gato', gata: 'gato', gatas: 'gato',
    gatito: 'gato', gatitos: 'gato', gatita: 'gato', gatitas: 'gato',
    blanca: 'blanco', negra: 'negro', amarilla: 'amarillo', dorada: 'dorado',
    canela: 'marron', cafe: 'marron', marrones: 'marron', cafes: 'marron',
    blancos: 'blanco', blancas: 'blanco', negros: 'negro', negras: 'negro'
};
const palabras = (texto) => normalizar(texto).split(' ').filter(Boolean)
    .map((palabra) => equivalencias[palabra] || palabra);
const conectores = new Set(['a', 'de', 'del', 'el', 'la', 'las', 'los', 'en', 'con', 'y', 'o']);

function detectarBusqueda(mensaje) {
    const texto = normalizar(mensaje);
    const reportar = /\b(?:se me (?:perdio|extravio|escapo)|(?:perdi|extrave) (?:a )?mi|mi .{1,60} (?:se perdio|esta perdid[oa]|desaparecio|no aparece))\b/.test(texto);
    const especie = palabras(mensaje).find((palabra) => palabra === 'perro' || palabra === 'gato');
    const consultar = /\b(?:perdid[oa]s?|extraviad[oa]s?|desaparecid[oa]s?)\b/.test(texto) &&
        !/\b(?:vi|encontre|aviste|ayudar|consejos|que hago|como (?:ayudo|reporto|publico|registro))\b/.test(texto);
    const buscar = /\b(?:busca(?:me|r)?|estoy buscando|muestra(?:me)?|hay|encuentra(?:me)?)\b/.test(texto);
    const avistamiento = /\b(?:vi|encontre|aviste|recogi|rescate|hemos encontrado)\b/.test(texto) &&
        /\b(?:perr[oa]s?|perrit[oa]s?|gat[oa]s?|gatit[oa]s?|mascotas?|animales?|perdid[oa]s?)\b/.test(texto);
    const colores = [...new Set(palabras(mensaje))].filter((palabra) =>
        /^(blanco|negro|amarillo|marron|gris|dorado|beige|crema|atigrado|tricolor)$/.test(palabra));
    return { activa: reportar || consultar || avistamiento || (buscar && !!especie), reportar, avistamiento, especie, colores };
}

function coincidencias(texto, campo) {
    const solicitadas = new Set(palabras(texto).filter((palabra) => !conectores.has(palabra)));
    const disponibles = new Set(palabras(campo));
    return [...solicitadas].filter((palabra) => disponibles.has(palabra)).length;
}

async function buscarMascotas(mensaje, criterios, deteccion, avistamiento = deteccion.avistamiento) {
    const datos = {};
    for (const campo of ['especie', 'raza', 'color', 'ciudad', 'nombre']) {
        const valor = criterios?.[campo];
        if (typeof valor === 'string' && normalizar(valor) && valor.length <= 120) {
            datos[campo] = valor.trim();
        }
    }
    datos.especie ||= deteccion.especie;
    datos.color ||= deteccion.colores.join(' ') || undefined;
    const pesos = { color: 3, raza: 5, ciudad: 2, nombre: 6 };
    const campos = Object.keys(pesos);
    const solicitados = campos.filter((campo) => datos[campo]);
    const resultados = [];
    const cursor = Mascota.find({ estado: 'PERDIDO', tipoPublicacion: { $ne: 'adopcion' } })
        .select('nombre especie color raza ciudad createdAt').lean().cursor();

    for await (const mascota of cursor) {
        if (datos.especie && palabras(datos.especie).join(' ') !== palabras(mascota.especie).join(' ')) continue;
        const [color, razaAnterior] = (mascota.color || '').split(/\.\s*raza:\s*/i);
        const raza = mascota.raza || razaAnterior;
        const ciudad = (mascota.ciudad || '').split(/\.\s*perdido el:/i)[0];
        const nombre = normalizar(mascota.nombre) === 'desconocido' ? '' : mascota.nombre;
        const atributos = { color, raza, ciudad, nombre };
        const puntaje = campos.reduce((total, campo) => {
            const criterio = datos[campo] || mensaje;
            return total + pesos[campo] * coincidencias(criterio, atributos[campo]);
        }, 0);
        if (solicitados.length && !solicitados.some((campo) => coincidencias(datos[campo], atributos[campo]))) continue;

        resultados.push({
            puntaje,
            fecha: mascota.createdAt?.getTime() || 0,
            mascota: { _id: mascota._id, nombre: mascota.nombre, especie: mascota.especie, color, raza, ciudad }
        });
        resultados.sort((a, b) => b.puntaje - a.puntaje || b.fecha - a.fecha);
        if (resultados.length > 5) resultados.pop();
    }

    const coincidenciasEncontradas = resultados
        .filter((resultado) => resultado.puntaje > 0 || !resultados[0].puntaje)
        .map((resultado) => resultado.mascota);
    let respuesta = coincidenciasEncontradas.length
        ? 'Estos son los reportes activos que mejor encajan con tu búsqueda. Toca uno para ver la foto y los detalles.'
        : 'No encontré reportes activos que coincidan. Puedes probar con menos detalles o crear un reporte.';
    if (avistamiento) {
        respuesta = coincidenciasEncontradas.length
            ? 'Compara la foto y los detalles. Si reconoces a la mascota, abre el reporte y toca «Agregar pista» para contar dónde la encontraste. Quien publicó el reporte puede confirmar que ya está en casa.'
            : 'No encontré un reporte activo que coincida. Dime la especie, el color y la ciudad para intentar otra búsqueda.';
    }
    return {
        respuesta,
        esBorrador: false,
        esPista: false,
        pistaGenerada: { descripcion: '', ubicacion: '' },
        coincidencias: coincidenciasEncontradas,
        avistamiento: !!avistamiento,
        mascotaGenerada: datos,
        puedeReportar: !avistamiento
    };
}

module.exports = { buscarMascotas, detectarBusqueda };
