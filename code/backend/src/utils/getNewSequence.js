/**
 * @file getNewSequence.js
 * @description Restituisce il valore successivo di una sequenza numerica
 * gestita automaticamente da MongoDB, se non esiste viene creata partendo da 1
 *
 * @param {string} nomeSequenza - identificatore sequenza
 * @returns {Promise<number>} prossimo intero della sequenza
 */
const Counter = require('../models/counter');

async function getNextSequence(nomeSequenza) {
    const counter = await Counter.findOneAndUpdate(
        { _id: nomeSequenza },
        { $inc: { seq: 1 } },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
    );
    return counter.seq;
}

module.exports = getNextSequence;