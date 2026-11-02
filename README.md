# Formula One — archivio F1

Il sito si pubblica direttamente su GitHub Pages. Puoi anche aprire index.html dal disco senza avviare un server.

Per aggiornare i dati dopo aver sostituito data/f1.db.gz, rigenera i JSON statici:

    python3 build_static.py

Pubblica insieme alle pagine anche static-api/. Lo script crea anche local.js per l’apertura diretta dal disco. Dati: Lap Ledger / F1DB, CC BY-SA 4.0. Le foto Wikimedia mostrano credito e licenza.

Fonti: https://www.lapledger.org/data · https://github.com/f1db/f1db
