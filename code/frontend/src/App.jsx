import { useEffect, useState } from 'react';
import {
  MapPin,
  Droplets,
  Flame,
  AlertTriangle,
  ShieldAlert,
  Star,
  Mountain,
  Info,
  Camera,
  Navigation,
  Search,
  Route
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';
const demoTrack = [
  [46.4700, 11.6400],
  [46.4720, 11.6450],
  [46.4750, 11.6500],
  [46.4780, 11.6550]
];

import { getBivacchi, getBivaccoById, creaRecensione } from './api';

function App() {
  const [bivacchi, setBivacchi] = useState([]);
  const [selectedBivacco, setSelectedBivacco] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [message, setMessage] = useState('');
  const [showEmergency, setShowEmergency] = useState(false);

  const [filters, setFilters] = useState({
    nome: '',
    zona: '',
    altitudineMin: '',
    altitudineMax: '',
    postiLetto: ''
  });

  const [recensione, setRecensione] = useState({
    utente: '',
    stelle: 5,
    testo: '',
    anonima: false
  });

  async function loadBivacchi() {
    try {
      const data = await getBivacchi(filters);
      setBivacchi(data);
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function loadScheda(id) {
    try {
      const data = await getBivaccoById(id);
      setSelectedBivacco(data);
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleSubmitRecensione(event) {
    event.preventDefault();

    if (!selectedBivacco) return;

    try {
      await creaRecensione({
        bivaccoId: selectedBivacco._id,
        utente: recensione.utente,
        stelle: Number(recensione.stelle),
        testo: recensione.testo,
        anonima: recensione.anonima
      });

      setMessage('Recensione inviata correttamente.');

      setRecensione({
        utente: '',
        stelle: 5,
        testo: '',
        anonima: false
      });

      const updated = await getBivaccoById(selectedBivacco._id);
      setSelectedBivacco(updated);
      await loadBivacchi();
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    loadBivacchi();
  }, []);

  return (
    <div className="app">
      <nav className="navbar">
        <div className="brand">
          <Mountain size={28} />
          <span>Bivacs</span>
        </div>

        <div className="nav-links">
          <span>Bivacchi</span>
          <span>Mappa</span>
          <span>Sicurezza</span>
          <span>Recensioni</span>
        </div>

        <button
          className="sos-button"
          onClick={() => setShowEmergency(true)}
        >
          <ShieldAlert size={17} />
          SOS 112
        </button>
      </nav>

      <header className="hero">
        <motion.div
          className="hero-text"
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65 }}
        >
          <p className="eyebrow">Provincia Autonoma di Trento</p>
          <h1>Trova il bivacco giusto per la tua prossima escursione.</h1>
          <p className="hero-subtitle">
            Consulta dotazioni, risorse, posizione e informazioni utili per pianificare
            percorsi in montagna con più consapevolezza.
          </p>

          <div className="hero-actions">
            <button className="primary-button" onClick={loadBivacchi}>
              Esplora bivacchi
            </button>
            <button className="ghost-button" onClick={() => setViewMode('map')}>
              Apri mappa
            </button>
          </div>
        </motion.div>

        <motion.div
          className="hero-card"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.65, delay: 0.15 }}
        >
          <div className="hero-card-icon">
            <MapPin size={30} />
          </div>
          <h3>Mappa interattiva</h3>
          <p>
            Visualizza i bivacchi del Trentino sulla mappa e apri la scheda con un clic.
          </p>

          <div className="hero-stats">
            <div>
              <strong>{bivacchi.length}</strong>
              <span>Bivacchi caricati</span>
            </div>
            <div>
              <strong>CAI</strong>
              <span>Legenda sentieri</span>
            </div>
          </div>
        </motion.div>
      </header>

      <main className="container">
        {message && <div className="message">{message}</div>}

        <section className="filter-panel">
          <div className="section-title">
            <Search size={22} />
            <div>
              <p className="small-label">Ricerca</p>
              <h2>Filtra i bivacchi</h2>
            </div>
          </div>

          <div className="filters">
            <input
              placeholder="Nome bivacco"
              value={filters.nome}
              onChange={(e) => setFilters({ ...filters, nome: e.target.value })}
            />

            <input
              placeholder="Zona"
              value={filters.zona}
              onChange={(e) => setFilters({ ...filters, zona: e.target.value })}
            />

            <input
              type="number"
              placeholder="Altitudine min"
              value={filters.altitudineMin}
              onChange={(e) => setFilters({ ...filters, altitudineMin: e.target.value })}
            />

            <input
              type="number"
              placeholder="Altitudine max"
              value={filters.altitudineMax}
              onChange={(e) => setFilters({ ...filters, altitudineMax: e.target.value })}
            />

            <input
              type="number"
              placeholder="Posti letto min"
              value={filters.postiLetto}
              onChange={(e) => setFilters({ ...filters, postiLetto: e.target.value })}
            />

            <button className="primary-button" onClick={loadBivacchi}>
              Cerca
            </button>
          </div>
        </section>

        <div className="main-layout">
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="small-label">Catalogo</p>
                <h2>Bivacchi disponibili</h2>
              </div>

              <div className="view-toggle">
                <button
                  className={viewMode === 'list' ? 'active' : ''}
                  onClick={() => setViewMode('list')}
                >
                  Lista
                </button>
                <button
                  className={viewMode === 'map' ? 'active' : ''}
                  onClick={() => setViewMode('map')}
                >
                  Mappa
                </button>
              </div>
            </div>

            {bivacchi.length === 0 ? (
              <p className="empty">
                Nessun bivacco trovato. Inserisci dati nel database oppure modifica i filtri.
              </p>
            ) : viewMode === 'map' ? (
              <div className="map-box">
                <MapContainer
                  center={[46.07, 11.12]}
                  zoom={8}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  <Polyline
                    positions={demoTrack}
                    pathOptions={{
                      color: '#2f7d4f',
                      weight: 5
                    }}
                  />

                  {bivacchi.map((bivacco) => (
                    <Marker
                      key={bivacco._id}
                      position={[bivacco.latitudine, bivacco.longitudine]}
                    >
                      <Popup>
                        <strong>{bivacco.nome}</strong>
                        <br />
                        {bivacco.zona}
                        <br />
                        {bivacco.altitudine} m
                        <br />
                        <button
                          className="popup-button"
                          onClick={() => loadScheda(bivacco._id)}
                        >
                          Apri scheda
                        </button>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            ) : (
              <div className="cards">
                {bivacchi.map((bivacco, index) => (
                  <motion.article
                    key={bivacco._id}
                    className="bivacco-card"
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    whileHover={{ y: -5 }}
                    onClick={() => loadScheda(bivacco._id)}
                  >
                    <div className="card-top">
                      <div>
                        <h3>{bivacco.nome}</h3>
                        <p>{bivacco.zona}</p>
                      </div>

                      {bivacco.emergenza && (
                        <span className="danger-icon">
                          <AlertTriangle size={18} />
                        </span>
                      )}
                    </div>

                    <div className="card-data">
                      <span>{bivacco.altitudine} m</span>
                      <span>{bivacco.postiLetto} posti</span>
                      <span>{bivacco.mediaStelle || 0} ★</span>
                    </div>

                    <p className="dotazioni">
                      {bivacco.dotazioni || 'Dotazioni non specificate'}
                    </p>

                    <div className="resource-row">
                      <span className={bivacco.acquaPresente ? 'ok' : 'not-ok'}>
                        <Droplets size={15} />
                        Acqua
                      </span>

                      <span className={bivacco.legnaDisponibile ? 'ok' : 'not-ok'}>
                        <Flame size={15} />
                        Legna
                      </span>
                    </div>

                    <button className="secondary-button">
                      Apri scheda
                    </button>
                  </motion.article>
                ))}
              </div>
            )}
          </section>

          <aside className="panel detail-panel">
            {!selectedBivacco ? (
              <div className="placeholder">
                <Navigation size={42} />
                <h2>Seleziona un bivacco</h2>
                <p>
                  Apri una scheda dalla lista o dalla mappa per visualizzare dettagli,
                  risorse, legenda CAI e recensioni.
                </p>
              </div>
            ) : (
              <motion.div
                key={selectedBivacco._id}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="detail-heading">
                  <div>
                    <p className="small-label">Scheda bivacco</p>
                    <h2>{selectedBivacco.nome}</h2>
                  </div>

                  {selectedBivacco.emergenza && (
                    <span className="emergency-badge">Emergenza</span>
                  )}
                </div>

                <div className="detail-grid">
                  <div className="detail-item">
                    <span>Zona</span>
                    <strong>{selectedBivacco.zona}</strong>
                  </div>

                  <div className="detail-item">
                    <span>Altitudine</span>
                    <strong>{selectedBivacco.altitudine} m</strong>
                  </div>

                  <div className="detail-item">
                    <span>Posti letto</span>
                    <strong>{selectedBivacco.postiLetto}</strong>
                  </div>

                  <div className="detail-item">
                    <span>Rating</span>
                    <strong>{selectedBivacco.mediaStelle || 0} / 5</strong>
                  </div>
                </div>

                <section className="mini-widget">
                  <h3><Droplets size={18} /> Risorse disponibili</h3>
                  <div className="resource-row">
                    <span className={selectedBivacco.acquaPresente ? 'ok' : 'not-ok'}>
                      <Droplets size={15} />
                      Acqua {selectedBivacco.acquaPresente ? 'disponibile' : 'non disponibile'}
                    </span>

                    <span className={selectedBivacco.legnaDisponibile ? 'ok' : 'not-ok'}>
                      <Flame size={15} />
                      Legna {selectedBivacco.legnaDisponibile ? 'disponibile' : 'non disponibile'}
                    </span>
                  </div>
                </section>

                <section className="mini-widget">
                  <h3><Info size={18} /> Legenda CAI</h3>
                  <div className="legend">
                    <span><strong>T</strong> Turistico</span>
                    <span><strong>E</strong> Escursionistico</span>
                    <span><strong>EE</strong> Escursionisti esperti</span>
                    <span><strong>EEA</strong> Attrezzatura richiesta</span>
                  </div>
                </section>

                <section className="mini-widget">
                  <h3><Route size={18} /> Stato manutenzione</h3>
                  <p className="maintenance-ok">
                    Nessun ticket aperto per questo bivacco.
                  </p>
                </section>

                <section className="mini-widget">
                  <h3><Navigation size={18} /> Download GPX</h3>
                  <p className="widget-description">
                    Scarica il tracciato GPX del percorso per consultarlo offline durante l'escursione.
                  </p>

                  <a
                    href="/gpx/demo.gpx"
                    download
                    className="download-gpx-button"
                  >
                    Scarica tracciato GPX
                  </a>
                </section>

                <section className="mini-widget">
                  <h3><Camera size={18} /> Segnalazione rapida</h3>
                  <div className="photo-drop">
                    Trascina qui una foto del danno oppure clicca per caricarla.
                  </div>
                  <button className="primary-button">
                    Invia segnalazione
                  </button>
                </section>

                <form className="review-form" onSubmit={handleSubmitRecensione}>
                  <h3><Star size={18} /> Lascia una recensione</h3>

                  <input
                    placeholder="Nome utente"
                    value={recensione.utente}
                    onChange={(e) => setRecensione({ ...recensione, utente: e.target.value })}
                  />

                  <select
                    value={recensione.stelle}
                    onChange={(e) => setRecensione({ ...recensione, stelle: e.target.value })}
                  >
                    <option value="1">1 stella</option>
                    <option value="2">2 stelle</option>
                    <option value="3">3 stelle</option>
                    <option value="4">4 stelle</option>
                    <option value="5">5 stelle</option>
                  </select>

                  <textarea
                    placeholder="Scrivi un commento sul bivacco"
                    value={recensione.testo}
                    onChange={(e) => setRecensione({ ...recensione, testo: e.target.value })}
                  />

                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={recensione.anonima}
                      onChange={(e) => setRecensione({ ...recensione, anonima: e.target.checked })}
                    />
                    Pubblica come anonimo
                  </label>

                  <button className="primary-button" type="submit">
                    Invia recensione
                  </button>
                </form>
              </motion.div>
            )}
          </aside>
        </div>
      </main>
            {showEmergency && (
        <div className="emergency-overlay">
          <div className="emergency-modal">
            <div className="emergency-modal-icon">
              <ShieldAlert size={34} />
            </div>

            <h2>Emergenza alpina</h2>

            <p>
              In caso di emergenza contatta immediatamente i soccorsi e comunica
              posizione, numero di persone coinvolte e condizioni meteo.
            </p>

            <div className="emergency-numbers">
              <div>
                <strong>112</strong>
                <span>Numero unico emergenze</span>
              </div>

              <div>
                <strong>118</strong>
                <span>Soccorso sanitario / alpino</span>
              </div>
            </div>

            <button
              className="close-emergency-button"
              onClick={() => setShowEmergency(false)}
            >
              Chiudi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;