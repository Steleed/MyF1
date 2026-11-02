#!/usr/bin/env python3
"""Serve the static site and read-only Formula 1 archive API."""

from __future__ import annotations

import datetime as dt
import gzip
import json
import re
import sqlite3
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

ROOT = Path(__file__).resolve().parent
DB_FILE = ROOT / "data" / "f1.db.gz"
CURRENT_YEAR = dt.date.today().year
DB = sqlite3.connect(":memory:", check_same_thread=False)
DB.deserialize(gzip.open(DB_FILE, "rb").read())
DB.row_factory = sqlite3.Row
DB.execute("PRAGMA temp_store=MEMORY")
DB_LOCK = threading.RLock()


def rows(sql: str, args: tuple = ()) -> list[dict]:
    with DB_LOCK:
        return [dict(item) for item in DB.execute(sql, args)]


def row(sql: str, args: tuple = ()) -> dict | None:
    with DB_LOCK:
        result = DB.execute(sql, args).fetchone()
    return dict(result) if result else None


def sample_even(items: list[dict], count: int) -> list[dict]:
    if len(items) <= count:
        return items
    return [items[round(index * (len(items) - 1) / (count - 1))] for index in range(count)]


def chassis_details(chassis_id: str) -> dict | None:
    car = row("SELECT * FROM chassis WHERE id = ?", (chassis_id,))
    if not car:
        return None
    car["constructor"] = row("SELECT id, name, country FROM constructors WHERE id = ?", (car.get("constructor_id"),))
    car["design"] = row("SELECT * FROM cars WHERE id = ?", (car.get("car_id"),)) if car.get("car_id") else None
    car["photo"] = row(
        "SELECT thumb_url, description_url, artist, credit, licence, licence_url "
        "FROM article_images WHERE route = 'article' AND article = ? AND thumb_url IS NOT NULL",
        (car.get("article"),),
    )
    return car


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_json(self, payload: object, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        parts = [unquote(part) for part in parsed.path.strip("/").split("/")]
        if not parts or parts[0] != "api":
            return super().do_GET()
        try:
            if parts == ["api", "home"]:
                photos = rows(
                    "SELECT h.id, h.full_name, h.first_year, h.last_year, "
                    "a.thumb_url, a.description_url, a.artist, a.credit, a.licence, a.licence_url "
                    "FROM chassis h JOIN article_images a ON a.article = h.article "
                    "WHERE a.route = 'article' AND a.thumb_url IS NOT NULL "
                    "GROUP BY a.description_url ORDER BY h.first_year, h.full_name"
                )
                f2004_rows = rows(
                    "SELECT h.id, h.full_name, h.first_year, h.last_year, a.thumb_url, "
                    "a.description_url, a.artist, a.credit, a.licence, a.licence_url "
                    "FROM chassis h JOIN article_images a ON a.article = h.article "
                    "WHERE h.id = ? AND a.route = 'article' AND a.thumb_url IS NOT NULL "
                    "ORDER BY a.description_url LIMIT 1", ("ferrari-f2004",),
                )
                f2004 = f2004_rows[0] if f2004_rows else None
                photos = [photo for photo in photos if photo["id"] != "ferrari-f14-t"]
                featured_cars = sample_even(photos, 24)
                if f2004 and all(photo["id"] != "ferrari-f2004" for photo in featured_cars):
                    featured_cars[-1] = f2004
                race_photos = rows(
                    "SELECT a.race_id, r.year, r.round, r.name_used, a.file_name, a.thumb_url, "
                    "a.description_url, a.artist, a.credit, a.licence, a.licence_url "
                    "FROM article_images a JOIN races r ON r.id = a.race_id "
                    "WHERE a.route = 'race' AND a.thumb_url IS NOT NULL AND r.year <= ? "
                    "AND r.name_used NOT LIKE '%Indianapolis 500%' "
                    "GROUP BY a.description_url ORDER BY r.year, r.round", (CURRENT_YEAR,),
                )
                return self.send_json({
                    "cars": featured_cars,
                    "races": sample_even(race_photos, 24),
                    "car_photo_count": len(photos),
                    "race_photo_count": len(race_photos),
                    "data_source": "Lap Ledger v2.26 / F1DB",
                    "data_license": "CC BY-SA 4.0",
                })
            if parts == ["api", "seasons"]:
                return self.send_json({"years": [item["year"] for item in rows(
                    "SELECT year FROM seasons WHERE year BETWEEN 1950 AND ? ORDER BY year DESC",
                    (CURRENT_YEAR,),
                )]})
            if len(parts) == 3 and parts[1] == "season" and parts[2].isdigit():
                year = int(parts[2])
                if not 1950 <= year <= CURRENT_YEAR:
                    return self.send_json({"error": "Stagione non disponibile"}, 404)
                constructor_standings = rows(
                    "SELECT constructor_id AS id, entity AS name, engine_id, team, position, "
                    "position_text, points, confidence, NULL AS chassis_id "
                    "FROM v_standings_final WHERE year = ? AND table_type = 'constructors' "
                    "ORDER BY position IS NULL, position, entity, engine_id", (year,),
                )
                if not constructor_standings:
                    constructor_standings = rows(
                        "SELECT constructor_id AS id, entrant_name AS name, engine_manufacturer_id AS engine_id, "
                        "NULL AS team, NULL AS position, NULL AS position_text, NULL AS points, "
                        "confidence, chassis_ids FROM season_entrants WHERE year = ? ORDER BY entrant_name",
                        (year,),
                    )
                    for entrant in constructor_standings:
                        entrant["chassis_id"] = (entrant.pop("chassis_ids") or "").split("+")[0] or None
                return self.send_json({
                    "year": year,
                    "drivers": rows(
                        "SELECT driver_id AS id, entity AS name, position, position_text, points, confidence "
                        "FROM v_standings_final WHERE year = ? AND table_type = 'drivers' "
                        "ORDER BY position IS NULL, position, entity", (year,),
                    ),
                    "constructors": constructor_standings,
                    "constructors_championship": bool(row(
                        "SELECT 1 AS available FROM v_standings_final WHERE year = ? AND table_type = 'constructors' LIMIT 1",
                        (year,),
                    )),
                })
            if len(parts) == 3 and parts[1] in ("driver", "constructor", "chassis"):
                identity = parts[2]
                if not re.fullmatch(r"[a-zA-Z0-9_-]+", identity):
                    return self.send_json({"error": "Identificativo non valido"}, 400)
                params = parse_qs(parsed.query)
                year = int(params.get("season", [str(CURRENT_YEAR)])[0])
                if not 1950 <= year <= CURRENT_YEAR:
                    return self.send_json({"error": "Stagione non disponibile"}, 404)
                if parts[1] == "driver":
                    profile = row("SELECT * FROM drivers WHERE id = ?", (identity,))
                    if not profile:
                        return self.send_json({"error": "Pilota non trovato"}, 404)
                    profile["season_results"] = rows(
                        "SELECT r.round, r.name_used AS race, r.date_iso, e.grid, e.finish_position, "
                        "e.position_text, e.points, e.status, c.name AS constructor "
                        "FROM race_entries e JOIN races r ON r.id = e.race_id "
                        "LEFT JOIN constructors c ON c.id = e.constructor_id "
                        "WHERE e.driver_id = ? AND r.year = ? ORDER BY r.round", (identity, year),
                    )
                    profile["season"] = year
                    profile["standing"] = row(
                        "SELECT position, position_text, points FROM v_standings_final "
                        "WHERE year = ? AND table_type = 'drivers' AND driver_id = ? LIMIT 1",
                        (year, identity),
                    )
                    return self.send_json(profile)
                if parts[1] == "constructor":
                    team = row("SELECT * FROM constructors WHERE id = ?", (identity,))
                    if not team:
                        return self.send_json({"error": "Scuderia non trovata"}, 404)
                    team["season"] = year
                    team["standings"] = rows(
                        "SELECT position, position_text, points, engine_id FROM v_standings_final "
                        "WHERE year = ? AND table_type = 'constructors' AND constructor_id = ? "
                        "ORDER BY position", (year, identity),
                    )
                    entrants = rows(
                        "SELECT entrant_name, chassis_ids, engine_ids, tyre_names, confidence "
                        "FROM season_entrants WHERE year = ? AND constructor_id = ? ORDER BY entrant_name",
                        (year, identity),
                    )
                    team["entrants"] = entrants
                    ids = sorted({chassis_id for entrant in entrants
                                  for chassis_id in (entrant.get("chassis_ids") or "").split("+") if chassis_id})
                    team["cars"] = [detail for chassis_id in ids if (detail := chassis_details(chassis_id))]
                    team["season_results"] = rows(
                        "SELECT r.round, r.name_used AS race, e.driver_id, d.full_name AS driver, "
                        "e.finish_position, e.position_text, e.grid, e.points, e.status, e.chassis_id "
                        "FROM race_entries e JOIN races r ON r.id = e.race_id "
                        "LEFT JOIN drivers d ON d.id = e.driver_id "
                        "WHERE e.constructor_id = ? AND r.year = ? ORDER BY r.round, e.finish_position",
                        (identity, year),
                    )
                    team["standing"] = team["standings"][0] if team["standings"] else None
                    return self.send_json(team)
                car = chassis_details(identity)
                if not car:
                    return self.send_json({"error": "Monoposto non trovata"}, 404)
                car["seasons_entered"] = rows(
                    "SELECT year, entrant_id, f1db_constructor_id, constructor_id, entrant_name, engine_manufacturer_id "
                    "FROM season_entrants WHERE instr('+' || chassis_ids || '+', '+' || ? || '+') > 0 "
                    "ORDER BY year", (identity,),
                )
                return self.send_json(car)
            return self.send_json({"error": "Endpoint non trovato"}, 404)
        except (ValueError, sqlite3.Error) as error:
            return self.send_json({"error": str(error)}, 500)


if __name__ == "__main__":
    print("Sito F1: http://localhost:8000")
    ThreadingHTTPServer(("127.0.0.1", 8000), Handler).serve_forever()
