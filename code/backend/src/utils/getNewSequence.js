/**
 * @file getNewSequence.js
 * @description Utility per la gestione delle sequenze numeriche progressive.
 *
 * Include:
 * - ricerca della sequenza tramite identificatore;
 * - incremento automatico del contatore;
 * - creazione della sequenza se non esiste.
 */
const Counter = require('../models/counter');

/**
 * Restituisce il valore successivo di una sequenza numerica.
 *
 * @param {string} nomeSequenza - Identificatore della sequenza.
 * @returns {Promise<number>} Valore aggiornato della sequenza.
 */

async function getNextSequence(nomeSequenza) {
    const counter = await Counter.findOneAndUpdate(
        { _id: nomeSequenza },
        { $inc: { seq: 1 } },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
    );
    return counter.seq;
}

module.exports = getNextSequence;