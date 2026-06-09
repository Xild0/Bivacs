/**
 * @file emailService.js
 * @description Servizio per l'invio delle email automatiche di sistema.
 *
 * Include:
 * - configurazione del transporter Nodemailer;
 * - invio di email tramite SMTP Gmail;
 * - gestione degli errori di invio.
 */

const nodemailer = require('nodemailer');

/**
 * Transporter Nodemailer configurato con le credenziali
 * definite nelle variabili d'ambiente.
 */
const postino = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS 
    }
});

/**
 * Invia una email automatica di sistema.
 *
 * L'operazione:
 * - imposta mittente, destinatario e oggetto;
 * - inserisce il contenuto HTML ricevuto;
 * - invia la email tramite Nodemailer.
 *
 * @param {string} destinatario - Indirizzo email del destinatario.
 * @param {string} oggetto - Oggetto della email.
 * @param {string} testoHtml - Contenuto HTML della email.
 * @returns {Promise<void>}
 */
const inviaEmail = async (destinatario, oggetto, testoHtml) => {
    try {
        const mailOptions = {
            from: `"Bivacs Team" <${process.env.EMAIL_USER}>`,
            to: destinatario,
            subject: oggetto,
            html: testoHtml
        };

        await postino.sendMail(mailOptions);
        console.log(`Email inviata con successo a: ${destinatario}`);
    } catch (error) {
        console.error('Errore nell\'invio dell\'email:', error);
        throw new Error('Impossibile inviare l\'email');
    }
};

module.exports = inviaEmail;