/**
 * @file main.js
 * @description Punto di ingresso principale del frontend Vue di Bivacs.
 * Inizializza l'applicazione Vue e importa gli stili globali.
 */

import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import 'leaflet/dist/leaflet.css'

createApp(App).mount('#app')
