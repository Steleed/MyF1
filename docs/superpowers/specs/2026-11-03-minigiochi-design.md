# Minigiochi: Indovina il campione

## Intento
Aggiungere al sito F1 una sezione Minigiochi, iniziando con una partita in cui si indovina il campione mondiale piloti dato l'anno. I risultati personali devono restare disponibili offline sul dispositivo.

## Obiettivi e limiti
- Aggiungere una voce di navigazione e una sezione dedicata, coerenti con l'attuale sito statico.
- Avviare una serie di anni casuali, scegliendo tra Facile (10), Medio (5), Difficile (3) e Impossibile (1) tentativi per anno.
- Continuare la stessa partita dopo ogni risposta corretta; salvare un solo risultato quando la serie termina.
- Ordinare la classifica prima per anni consecutivi indovinati, poi per tentativi totali e data.
- Mostrare solo i cinque risultati migliori e non inserire i risultati fuori classifica.
- Mostrare il riepilogo dell'ultima partita e aggiornarlo dopo ogni partita.
- Conservare i dati nel browser con `localStorage`, senza backend o account.
- Non aggiungere altri giochi né sincronizzazione tra dispositivi.

## Approcci
- **Storico locale completo (scelta proposta):** memorizza ogni partita completata con anno, tentativi e data; ordina per meno tentativi, poi per data. Mantiene visibili i progressi nel tempo.
- **Solo record personale:** salva il miglior risultato per partita o il singolo record. È più compatto ma non conserva lo storico dei tentativi.

Si propone lo storico completo perché la richiesta parla di una classifica dei migliori tentativi e di conservarli in memoria; il sito è statico e `localStorage` supporta il salvataggio personale offline.

## Comportamento e dati
- I campioni vengono ricavati dai dati di classifica piloti già pubblicati in `static-api/season/*.json`, prendendo il primo classificato per stagione.
- La partita estrae anni casuali senza ripetizioni nella stessa serie. L'utente sceglie la difficoltà prima del primo tentativo; il limite scelto vale per ogni anno della serie.
- Dopo una risposta corretta, la partita continua con un altro anno; al decimo errore mostra il nome del campione e termina la serie.
- Un pulsante di forfait termina la partita, mostra il campione corrente e registra la sconfitta.
- Ogni record include anni consecutivi indovinati, tentativi totali, risposte anno-pilota e timestamp. La top 5 ordina per serie più lunghe, meno tentativi e data; i risultati fuori classifica non vengono salvati nella classifica.
- Il riepilogo dell'ultima partita conserva esito, tentativi, risposte anno-pilota e campione non indovinato, separato dalla top 5.
- I record creati dalla prima versione vengono migrati come serie di un anno.
- La classifica si carica anche senza rete usando i dati già distribuiti e il salvataggio del browser. Se `localStorage` non è disponibile, il gioco resta utilizzabile nella sessione corrente e segnala che il salvataggio non è possibile.
- L'interfaccia usa etichette accessibili e non dipende da immagini o servizi esterni.

## Decisioni lasciate all'implementazione
Usare l'architettura HTML/CSS/JavaScript esistente e la generazione dati corrente, mantenendo semplice l'aggiunta futura di altre sezioni di gioco senza introdurre un framework o un backend.
