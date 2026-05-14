/**
 * @file emailService.js
 * @description Servizio per l'invio di email tramite Nodemailer e SMTP Google
 */

const nodemailer = require('nodemailer');

/**
 * Utilizza le credenziali salvate nel file .env per inviare le mail automatiche
 */
const postino = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS 
    }
});

/**
 * Invia una email di sistema
 * * @param {string} destinatario - Indirizzo email utente
 * @param {string} oggetto - Oggetto della mail
 * @param {string} testoHtml - Contenuto della mail
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