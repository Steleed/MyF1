#!/usr/bin/env python3
"""Esporta dati F1 in JSON statico per GitHub Pages."""
import json
from collections import defaultdict
from pathlib import Path
import server
OUT=Path(__file__).resolve().parent/'static-api'
OUT.mkdir(exist_ok=True)
def write(name,data):
 p=OUT/name;p.parent.mkdir(parents=True,exist_ok=True)
 p.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
now=server.CURRENT_YEAR
years=[x['year'] for x in server.rows('SELECT year FROM seasons WHERE year BETWEEN 1950 AND ? ORDER BY year DESC',(now,))]
write('seasons.json',{'years':years})
write('champions.json',{'items':server.rows("SELECT year,driver_id AS id,entity AS name FROM v_standings_final WHERE table_type='drivers' AND position=1 ORDER BY year")})
cars=server.rows("SELECT h.id,h.full_name,h.first_year,h.last_year,a.thumb_url,a.description_url,a.artist,a.credit,a.licence,a.licence_url FROM chassis h JOIN article_images a ON a.article=h.article WHERE a.route='article' AND a.thumb_url IS NOT NULL GROUP BY a.description_url ORDER BY h.first_year,h.full_name")
f2004_rows=server.rows("SELECT h.id,h.full_name,h.first_year,h.last_year,a.thumb_url,a.description_url,a.artist,a.credit,a.licence,a.licence_url FROM chassis h JOIN article_images a ON a.article=h.article WHERE h.id=? AND a.route='article' AND a.thumb_url IS NOT NULL ORDER BY a.description_url LIMIT 1",("ferrari-f2004",))
f2004=f2004_rows[0] if f2004_rows else None
cars=[photo for photo in cars if photo["id"] != "ferrari-f14-t"]
featured_cars=server.sample_even(cars,24)
if f2004 and all(photo["id"] != "ferrari-f2004" for photo in featured_cars):
 featured_cars[-1]=f2004
races=server.rows("SELECT a.race_id,r.year,r.round,r.name_used,a.file_name,a.thumb_url,a.description_url,a.artist,a.credit,a.licence,a.licence_url FROM article_images a JOIN races r ON r.id=a.race_id WHERE a.route='race' AND a.thumb_url IS NOT NULL AND r.year<=? AND r.name_used NOT LIKE '%Indianapolis 500%' GROUP BY a.description_url ORDER BY r.year,r.round",(now,))
write('home.json',{'cars':featured_cars,'races':server.sample_even(races,24),'car_photo_count':len(cars),'race_photo_count':len(races),'data_source':'Lap Ledger v2.26 / F1DB','data_license':'CC BY-SA 4.0'})
for y in years:
 teams=server.rows("SELECT constructor_id AS id,entity AS name,engine_id,team,position,position_text,points,confidence,NULL AS chassis_id FROM v_standings_final WHERE year=? AND table_type='constructors' ORDER BY position IS NULL,position,entity,engine_id",(y,))
 if not teams:
  teams=server.rows("SELECT constructor_id AS id,entrant_name AS name,engine_manufacturer_id AS engine_id,NULL AS team,NULL AS position,NULL AS position_text,NULL AS points,confidence,chassis_ids FROM season_entrants WHERE year=? ORDER BY entrant_name",(y,))
  for x in teams:x['chassis_id']=(x.pop('chassis_ids') or '').split('+')[0] or None
 write('season/'+str(y)+'.json',{'year':y,'drivers':server.rows("SELECT driver_id AS id,entity AS name,position,position_text,points,confidence FROM v_standings_final WHERE year=? AND table_type='drivers' ORDER BY position IS NULL,position,entity",(y,)),'constructors':teams,'constructors_championship':bool(server.row("SELECT 1 AS available FROM v_standings_final WHERE year=? AND table_type='constructors' LIMIT 1",(y,)))})

dr=defaultdict(lambda:defaultdict(list))
for x in server.rows("SELECT e.driver_id,r.year,r.round,r.name_used AS race,r.date_iso,e.grid,e.finish_position,e.position_text,e.points,e.status,c.name AS constructor FROM race_entries e JOIN races r ON r.id=e.race_id LEFT JOIN constructors c ON c.id=e.constructor_id ORDER BY r.year,r.round"):dr[x['driver_id']][str(x.pop('year'))].append(x)
ds=defaultdict(dict)
for x in server.rows("SELECT driver_id,year,position,position_text,points FROM v_standings_final WHERE table_type='drivers' AND driver_id IS NOT NULL"):ds[x['driver_id']][str(x['year'])]={k:x[k] for k in ('position','position_text','points')}
drivers={p['id']:{**p,'results_by_year':dr[p['id']],'standings_by_year':ds[p['id']]} for p in server.rows('SELECT * FROM drivers')}
write('drivers.json',{'items':drivers})

cr=defaultdict(lambda:defaultdict(list))
for x in server.rows("SELECT e.constructor_id,r.year,r.round,r.name_used AS race,e.driver_id,d.full_name AS driver,e.finish_position,e.position_text,e.grid,e.points,e.status,e.chassis_id FROM race_entries e JOIN races r ON r.id=e.race_id LEFT JOIN drivers d ON d.id=e.driver_id WHERE e.constructor_id IS NOT NULL ORDER BY r.year,r.round,e.finish_position"):cr[x['constructor_id']][str(x.pop('year'))].append(x)
cs=defaultdict(lambda:defaultdict(list))
for x in server.rows("SELECT constructor_id,year,position,position_text,points,engine_id FROM v_standings_final WHERE table_type='constructors' AND constructor_id IS NOT NULL ORDER BY year,position"):cs[x['constructor_id']][str(x['year'])].append({k:x[k] for k in ('position','position_text','points','engine_id')})
ent=defaultdict(lambda:defaultdict(list));ids=set()
for x in server.rows("SELECT year,constructor_id,entrant_name,chassis_ids,engine_ids,tyre_names,confidence FROM season_entrants WHERE constructor_id IS NOT NULL ORDER BY year,entrant_name"):
 ident,y=x.pop('constructor_id'),str(x.pop('year'));ids.update((x.get('chassis_ids') or '').split('+'));ent[ident][y].append(x)
ids.discard('');chassis={}
for ident in ids:
 d=server.chassis_details(ident)
 if d:chassis[ident]=d
teams={p['id']:{**p,'results_by_year':cr[p['id']],'standings_by_year':cs[p['id']],'entrants_by_year':ent[p['id']]} for p in server.rows('SELECT * FROM constructors')}
write('constructors.json',{'items':teams,'chassis':chassis})
all_chassis={}
for p in server.rows('SELECT id FROM chassis'):
 ident=p['id'];d=server.chassis_details(ident)
 if d:
  d['seasons_entered']=server.rows("SELECT year,entrant_id,f1db_constructor_id,constructor_id,entrant_name,engine_manufacturer_id FROM season_entrants WHERE instr('+'||chassis_ids||'+','+'||?||'+')>0 ORDER BY year",(ident,))
  all_chassis[ident]=d
write('chassis.json',{'items':all_chassis})
bundle={str(f.relative_to(OUT)):json.loads(f.read_text(encoding='utf-8')) for f in OUT.rglob('*.json')}
(OUT/'local.js').write_text('window.F1_STATIC_FILES='+json.dumps(bundle,ensure_ascii=False,separators=(',',':'))+';',encoding='utf-8')
print('Creato static-api: '+str(len(years))+' stagioni, '+str(len(drivers))+' piloti, '+str(len(teams))+' scuderie, '+str(len(all_chassis))+' telai')
