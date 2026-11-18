const { test } = require('node:test');
const assert = require('node:assert/strict');
const { contextoPista } = require('../services/contextoPista');

test('una corrección usa el último borrador y permite conservar los demás datos', () => {
    const contexto = contextoPista(true, { descripcion: 'Con collar rojo', ubicacion: 'Parque Caldas' });
    assert.ok(contexto.includes('Parque Caldas'));
    assert.ok(contexto.includes('Con collar rojo'));
    assert.ok(contexto.includes('correcciones más recientes'));
    assert.ok(contexto.includes('incompleto'));
});
test('el asistente general no recibe un borrador de otra mascota', () => {
    assert.equal(contextoPista(false, { ubicacion: 'Otra mascota' }), '');
    assert.equal(contextoPista(true, null), '');
    assert.equal(contextoPista(true, []), '');
});
test('limita tamaño y descarta tipos inválidos de la pista', () => {
    const contexto = contextoPista(true, { descripcion: 12, ubicacion: 'a'.repeat(5000) });
    assert.ok(contexto.includes('"descripcion":""'));
    assert.ok(contexto.includes('"ubicacion":"' + 'a'.repeat(2000) + '"'));
    assert.ok(!contexto.includes('a'.repeat(2001)));
});
