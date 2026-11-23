# Predizioni campione del mondo

## Intento
Aggiungere ai minigiochi pronostici distinti dal quiz storico: scegliere i campioni piloti delle stagioni future e conservarne gli esiti.

## Obiettivi e limiti
- Prima stagione pronosticabile: 2027; ultima: 2029, prima del cambio regolamento indicato dall’utente.
- Tre pronostici indipendenti, uno per ciascuna stagione 2027, 2028 e 2029, compilabili anche tutti subito. Ogni stagione si verifica e si chiude separatamente; gli anni successivi restano disponibili anche dopo un errore.
- Selezione del pilota tramite menu a tendina con roster dell’ultima stagione disponibile nell’archivio.
- Conservare pronostici, esiti e data nel browser, anche dopo ricarica.
- Non modificare il quiz storico né introdurre account, backend o sincronizzazione.

## Approcci
- **Stato locale nel gioco esistente (scelta proposta):** aggiungere interfaccia e logica alla sezione Minigiochi, riusando i dati dei campioni e `localStorage`. Si integra con il sito statico e non richiede nuove dipendenze.
- **Salvataggio server/account:** permetterebbe di condividere i record tra dispositivi, ma richiederebbe identità e API; fuori dal perimetro attuale.

## Comportamento e dati
- Ogni anno tra 2027 e 2029 ha un menu autonomo. Il menu usa i piloti della formazione più recente ottenuta da `/api/season/<anno>`.
- Il pronostico resta in attesa finché i dati dei campioni non contengono il campione di quella stagione. Al caricamento dei dati, il sistema confronta il campione reale con il pronostico e registra corretto o errato.
- Un esito corretto o errato chiude solo il pronostico del relativo anno. Le altre stagioni restano pronosticabili finché non si chiudono.
- L’archivio mostra ogni pronostico con stagione, pilota, stato ed esito. Il limite 2029 impedisce nuove predizioni oltre la stagione precedente al cambio regolamento.
- Usare l’archivio campioni già esistente, HTML/CSS/JavaScript e `localStorage`; dati corrotti o storage non disponibile non devono bloccare il quiz storico.

## Verifica
- Dropdown offre tutti i piloti del roster più recente e permette un pronostico separato per 2027, 2028 e 2029.
- Pronostici futuri restano in attesa e sopravvivono al ricaricamento.
- Quando un campione viene aggiunto ai dati, si chiude solo il pronostico di quell’anno con esito corretto o errato.
- Nessun pronostico oltre il 2029; record storici del quiz esistente restano invariati.
