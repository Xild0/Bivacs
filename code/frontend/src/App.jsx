import { useEffect, useState } from 'react';
import './App.css';
import { getBivacchi, getBivaccoById, creaRecensione } from './api';

function App() {
  const [bivacchi, setBivacchi] = useState([]);
  const [selectedBivacco, setSelectedBivacco] = useState(null);
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

  const [message, setMessage] = useState('');

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
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    loadBivacchi();
  }, []);

  return (
    <div className="app">
      <header className="hero">
        <h1>Bivacs</h1>
        <p>Catalogazione e monitoraggio dei bivacchi della Provincia Autonoma di Trento.</p>
      </header>

      {message && <div className="message">{message}</div>}

      <section className="panel">
        <h2>Ricerca bivacchi</h2>

        <div className="filters">
          <input
            placeholder="Nome"
            value={filters.nome}
            onChange={(e) => setFilters({ ...filters, nome: e.target.value })}
          />

          <input
            placeholder="Zona"
            value={filters.zona}
            onChange={(e) => setFilters({ ...filters, zona: e.target.value })}
          />

          <input
            placeholder="Altitudine min"
            type="number"
            value={filters.altitudineMin}
            onChange={(e) => setFilters({ ...filters, altitudineMin: e.target.value })}
          />

          <input
            placeholder="Altitudine max"
            type="number"
            value={filters.altitudineMax}
            onChange={(e) => setFilters({ ...filters, altitudineMax: e.target.value })}
          />

          <input
            placeholder="Posti letto min"
            type="number"
            value={filters.postiLetto}
            onChange={(e) => setFilters({ ...filters, postiLetto: e.target.value })}
          />

          <button onClick={loadBivacchi}>Filtra</button>
        </div>
      </section>

      <main className="layout">
        <section className="panel">
          <h2>Lista bivacchi</h2>

          {bivacchi.length === 0 ? (
            <p>Nessun bivacco trovato.</p>
          ) : (
            <div className="cards">
              {bivacchi.map((bivacco) => (
                <article key={bivacco._id} className="card">
                  <h3>{bivacco.nome}</h3>
                  <p><strong>Zona:</strong> {bivacco.zona}</p>
                  <p><strong>Altitudine:</strong> {bivacco.altitudine} m</p>
                  <p><strong>Posti letto:</strong> {bivacco.postiLetto}</p>
                  <button onClick={() => loadScheda(bivacco._id)}>
                    Apri scheda
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Scheda bivacco</h2>

          {!selectedBivacco ? (
            <p>Seleziona un bivacco dalla lista.</p>
          ) : (
            <>
              <h3>{selectedBivacco.nome}</h3>
              <p><strong>Zona:</strong> {selectedBivacco.zona}</p>
              <p><strong>Coordinate:</strong> {selectedBivacco.latitudine}, {selectedBivacco.longitudine}</p>
              <p><strong>Altitudine:</strong> {selectedBivacco.altitudine} m</p>
              <p><strong>Posti letto:</strong> {selectedBivacco.postiLetto}</p>
              <p><strong>Dotazioni:</strong> {selectedBivacco.dotazioni || 'Non specificate'}</p>
              <p><strong>Acqua:</strong> {selectedBivacco.acquaPresente ? 'Disponibile' : 'Non disponibile'}</p>
              <p><strong>Legna:</strong> {selectedBivacco.legnaDisponibile ? 'Disponibile' : 'Non disponibile'}</p>
              <p><strong>Rating medio:</strong> {selectedBivacco.mediaStelle || 0} / 5</p>

              {selectedBivacco.emergenza && (
                <div className="alert">Emergenza attiva su questo bivacco</div>
              )}

              <form className="review-form" onSubmit={handleSubmitRecensione}>
                <h3>Lascia una recensione</h3>

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
                  placeholder="Commento"
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

                <button type="submit">Invia recensione</button>
              </form>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;