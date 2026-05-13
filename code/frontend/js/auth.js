/**
 * @file auth.js - frontend
 * @description Gestisce la persistenza dell'autenticazione lato client.
 */

/**
 * Effettua il logout dell'utente dal sistema rimuovendo il token JWT salvato
 *  nel localStorage e reindirizza l'utente alla pagina di login. 
 * Non è necessaria una chiamata al backend poiché il sistema è stateless.
 * * @returns {void}
 */
function logoutUtente() {
    // rimozione del token dalla memoria del browser
    localStorage.removeItem('bivacs_token');
    
    // pulizia di altri dati utente salvati
    localStorage.removeItem('user_data');

    console.log('Logout effettuato con successo. Token rimosso.');

    // reindirizzamento alla pagina di login o alla home
    window.location.href = 'login.html';
}

/**
 * Verifica se l'utente è attualmente autenticato nel frontend.
 * * @returns {boolean} True se è presente un token, false altrimenti.
 */
function isAutenticato() {
    return localStorage.getItem('bivacs_token') !== null;
}