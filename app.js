(() => {
  const currentYear = new Date().getFullYear();
  const select = document.querySelector('#seasonSelect');
  const status = document.querySelector('#seasonStatus');
  const title = document.querySelector('#seasonTitle');
  const meta = document.querySelector('#seasonMeta');
  const errorBox = document.querySelector('#errorBox');
  const detailPage = document.querySelector('#detailPage');

  const staticCache = new Map();
  async function get(url) {
    const request = new URL(url, document.baseURI);
    if (request.origin !== location.origin || !request.pathname.includes('/api/')) {
      const response = await fetch(request);
      if (!response.ok) throw new Error('Errore ' + response.status);
      return response.json();
    }
    const route=request.pathname.split('/api/').pop().split('/').filter(Boolean);
    const readStatic=async path=>{
      if(location.protocol==='file:'){
        const payload=window.F1_STATIC_FILES?.[path];
        if(!payload)throw new Error('Dato statico non trovato: '+path);
        return payload;
      }
      if(!staticCache.has(path)) staticCache.set(path,fetch(new URL(path,new URL('./static-api/',document.baseURI))).then(r=>{if(!r.ok)throw new Error('Archivio statico non trovato: '+path);return r.json()}));
      return staticCache.get(path);
    };
    if(route[0]==='home')return readStatic('home.json');
    if(route[0]==='seasons')return readStatic('seasons.json');
    if(route[0]==='season' && /^\d{4}$/.test(route[1]||''))return readStatic('season/'+route[1]+'.json');
    const type=route[0],id=route[1];
    if(!id||!['driver','constructor','chassis'].includes(type))throw new Error('Endpoint non trovato');
    const archiveFile=type==='chassis'?'chassis.json':type+'s.json';
    const archive=await readStatic(archiveFile),record=archive.items[id];
    if(!record)throw new Error('Scheda non trovata');
    if(type==='chassis')return record;
    const year=Number(request.searchParams.get('season'))||currentYear;
    if(type==='driver')return {...record,season:year,season_results:record.results_by_year[String(year)]||[],standing:record.standings_by_year[String(year)]||null};
    const standings=record.standings_by_year[String(year)]||[],entrants=record.entrants_by_year[String(year)]||[];
    const ids=[...new Set(entrants.flatMap(e=>(e.chassis_ids||'').split('+').filter(Boolean)))];
    return {...record,season:year,standings,standing:standings[0]||null,entrants,cars:ids.map(i=>archive.chassis[i]).filter(Boolean),season_results:record.results_by_year[String(year)]||[]};
  }

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function photoFigure(photo, title, extraClass = '') {
    const artist = photo.artist || photo.credit || 'Autore non indicato';
    const licence = photo.licence || 'Licenza non indicata';
    const isRace = extraClass === 'race-photo';
    const photoYear = Math.min(photo.first_year || photo.year || currentYear, currentYear);
    const destination = photo.id
      ? `?type=chassis&id=${encodeURIComponent(photo.id)}&season=${photoYear}`
      : escapeHtml(photo.description_url || '#');
    const external = photo.id ? '' : ' target="_blank" rel="noreferrer"';
    const label = isRace ? `${photo.year} · ROUND ${photo.round}` : 'MONOPOSTO';
    return `<figure class="archive-photo ${extraClass}"><a href="${destination}"${external}><img src="${escapeHtml(photo.thumb_url)}" alt="${escapeHtml(title)}" loading="lazy"><span class="photo-kicker">${escapeHtml(label)}</span><span class="photo-title">${escapeHtml(title)}</span></a><figcaption><a href="${escapeHtml(photo.description_url || '#')}" target="_blank" rel="noreferrer">${escapeHtml(artist)} · ${escapeHtml(licence)}</a></figcaption></figure>`;
  }

  function sampleEven(items, count) {
    if (items.length <= count) return items;
    return Array.from({ length: count }, (_, index) => items[Math.round(index * (items.length - 1) / (count - 1))]);
  }

  async function loadYears() {
    const { years } = await get('/api/seasons');
    for (const year of years) {
      const option = document.createElement('option');
      option.value = String(year);
      option.textContent = String(year);
      select.append(option);
    }
    const requested = Number(new URLSearchParams(location.search).get('season'));
    const initial = years.includes(requested) ? requested : Math.min(currentYear, years[0]);
    select.value = String(initial);
    return initial;
  }

  function standingsTable(rows, type, year) {
    if (!rows.length) return '<div class="notice">Classifica non disponibile per questa stagione.</div>';
    const constructor = type === 'constructor';
    const classified = constructor && rows.some(entry => entry.position !== null && entry.position !== undefined);
    const heading = constructor ? (classified ? '<th>POS</th><th>SCUDERIA / MOTORE</th><th>PT</th>' : '<th>TEAM / ISCRITTO</th><th>TELAIO / MOTORE</th><th></th>') : '<th>POS</th><th>PILOTA</th><th>PT</th>';
    const body = rows.map((entry, index) => {
      const position = entry.position_text || entry.position || '';
      const id = entry.id || (constructor ? entry.chassis_id : null);
      const typePath = constructor ? (entry.id ? 'constructor' : 'chassis') : 'driver';
      const secondary = constructor ? (entry.chassis_id || entry.engine_id) : entry.team;
      return `<tr><td>${escapeHtml(classified || !constructor ? (position || index + 1) : '')}</td><td>${id ? `<a class="name detail-link" href="?type=${typePath}&id=${encodeURIComponent(id)}&season=${year}">${escapeHtml(entry.name)}</a>` : `<span class="name">${escapeHtml(entry.name)}</span>`}${secondary ? `<span class="team">${escapeHtml(secondary)}</span>` : ''}</td><td class="points">${escapeHtml(entry.points ?? '')}</td></tr>`;
    }).join('');
    return `<table class="standings"><thead><tr>${heading}</tr></thead><tbody>${body}</tbody></table>`;
  }

  async function loadSeason(year) {
    title.textContent = year;
    status.textContent = 'Caricamento archivio locale…';
    meta.textContent = 'CLASSIFICHE E RISULTATI';
    errorBox.hidden = true;
    document.querySelector('#driversTable').innerHTML = '<div class="loading">Caricamento…</div>';
    document.querySelector('#constructorsTable').innerHTML = '<div class="loading">Caricamento…</div>';
    try {
      const data = await get(`/api/season/${year}`);
      document.querySelector('#driversTable').innerHTML = standingsTable(data.drivers, 'driver', year);
      document.querySelector('#constructorsTable').innerHTML = standingsTable(data.constructors, 'constructor', year);
      status.textContent = data.constructors_championship
        ? `${data.drivers.length} piloti · classifica scuderie disponibile`
        : `${data.drivers.length} piloti · ${data.constructors.length} team iscritti · nessun titolo costruttori in palio`;
      meta.textContent = 'CLASSIFICHE FINALI · ARCHIVIO LOCALE';
    } catch {
      status.textContent = 'Archivio locale non raggiungibile';
      errorBox.hidden = false;
      errorBox.textContent = 'Archivio locale non disponibile. Verifica che static-api sia pubblicato insieme al sito.';
      document.querySelector('#driversTable').innerHTML = '';
      document.querySelector('#constructorsTable').innerHTML = '';
    }
  }

  async function wikipediaPerson(fullName, driverId) {
    for (const language of ['en', 'it']) {
      try {
        const preferredTitles = { farina: 'Giuseppe Farina', 'villeneuve-g': 'Gilles Villeneuve', antonelli: 'Andrea Kimi Antonelli' };
        const preferredTitle = preferredTitles[driverId];
        const query = fullName + ' Formula One driver';
        const url = preferredTitle
          ? 'https://' + language + '.wikipedia.org/w/api.php?action=query&titles=' + encodeURIComponent(preferredTitle) + '&prop=extracts|pageimages|pageprops&exintro=1&explaintext=1&piprop=name|thumbnail&pithumbsize=1000&format=json&origin=*'
          : 'https://' + language + '.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=' + encodeURIComponent(query) + '&gsrnamespace=0&gsrlimit=5&prop=extracts|pageimages|pageprops&exintro=1&explaintext=1&piprop=name|thumbnail&pithumbsize=1000&format=json&origin=*';
        const data = await get(url);
        const pages = Object.values(data.query?.pages || {}).filter(page => !page.pageprops?.disambiguation);
        pages.sort((a, b) => {
          const score = page => (page.title.toLowerCase() === fullName.toLowerCase() ? 5 : 0) + (/formula one|formula 1|grand prix|racing driver|pilota automobilistico|pilota di formula/i.test(page.extract || '') ? 3 : 0);
          return score(b) - score(a);
        });
        const page = pages.find(item => /formula one|formula 1|grand prix|racing driver|pilota automobilistico|pilota di formula/i.test(item.extract || ''));
        if (!page) continue;
        let photo = null;
        if (page.pageimage) {
          const commons = await get(`https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(`File:${page.pageimage}`)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1100&format=json&origin=*`);
          const file = Object.values(commons.query?.pages || {})[0]?.imageinfo?.[0];
          if (file?.thumburl) {
            const metadata = file.extmetadata || {};
            photo = {
              thumb_url: file.thumburl,
              description_url: file.descriptionurl,
              artist: metadata.Artist?.value?.replace(/<[^>]*>/g, '') || 'Autore non indicato',
              licence: metadata.LicenseShortName?.value || 'Licenza indicata su Wikimedia Commons',
            };
          }
        }
        const villeneuveFiles = [
          'Gilles Villeneuve imola 1979 (cropped).jpg',
          'Gilles Villeneuve 1979 Imola.jpg',
          'Gilles Villeneuve and Riccardo Patrese, Zolder 1979.jpg',
        ];
        const extraPhotos = driverId === 'villeneuve-g'
          ? await commonsFilePhotos(villeneuveFiles)
          : await commonsDriverPhotos(driverId === 'antonelli' ? 'Andrea Kimi Antonelli portrait' : fullName, driverId === 'antonelli' ? 10 : 5);
        const relevantPhotos = driverId === 'antonelli'
          ? extraPhotos.filter(item => /antonelli/i.test(item.title || '')).sort((a, b) => Number(/portrait|head.?shot|interview|paddock/i.test(b.title || '')) - Number(/portrait|head.?shot|interview|paddock/i.test(a.title || '')))
          : extraPhotos;
        const profilePhoto = driverId === 'antonelli'
          ? { thumb_url: 'https://cdn-3.motorsport.com/images/mgl/27vkbNO0/s8/andrea-kimi-antonelli-mercedes.jpg', description_url: 'https://www.motorsport.com/driver/kimi-antonelli/947765/', artist: 'Motorsport.com', licence: '© Motorsport.com' }
          : photo;
        const seen = new Set();
        const photos = (driverId === 'villeneuve-g' ? relevantPhotos : [profilePhoto, ...relevantPhotos]).filter(item => {
          if (!item) return false;
          const key = item.description_url || item.thumb_url;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).slice(0, 3);
        return {
          extract: page.extract || '',
          page: 'https://' + language + '.wikipedia.org/wiki/' + encodeURIComponent(page.title.replaceAll(' ', '_')),
          photo: photos[0] || null,
          photos,
        };
      } catch { /* Prova Wikipedia nell'altra lingua. */ }
    }
    return { extract: '', page: '', photo: null };
  }

  async function commonsFilePhotos(fileNames) {
    try {
      const titles = fileNames.map(name => 'File:' + name).join('|');
      const url = 'https://commons.wikimedia.org/w/api.php?action=query&titles='
        + encodeURIComponent(titles) + '&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1100&format=json&origin=*';
      const data = await get(url);
      const files = new Map(Object.values(data.query?.pages || {}).map(page => {
        const file = page.imageinfo?.[0];
        if (!file?.thumburl) return [null, null];
        const metadata = file.extmetadata || {};
        return [page.title.replace(/^File:/i, '').toLowerCase(), {
          thumb_url: file.thumburl,
          description_url: file.descriptionurl || '',
          artist: metadata.Artist?.value?.replace(/<[^>]*>/g, '') || 'Autore non indicato',
          licence: metadata.LicenseShortName?.value || 'Licenza indicata su Wikimedia Commons',
          title: page.title,
        }];
      }));
      return fileNames.map(name => files.get(name.toLowerCase())).filter(Boolean);
    } catch {
      return [];
    }
  }

  async function commonsDriverPhotos(fullName, limit = 3) {
    try {
      const query = '"' + fullName + '" Formula 1';
      const url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch='
        + encodeURIComponent(query) + '&gsrnamespace=6&gsrlimit=15&prop=imageinfo'
        + '&iiprop=url|extmetadata&iiurlwidth=1100&format=json&origin=*';
      const data = await get(url);
      return Object.values(data.query?.pages || {}).map(page => {
        const file = page.imageinfo?.[0];
        if (!file?.thumburl) return null;
        const metadata = file.extmetadata || {};
        return {
          thumb_url: file.thumburl,
          description_url: file.descriptionurl || '',
          artist: metadata.Artist?.value?.replace(/<[^>]*>/g, '') || 'Autore non indicato',
          licence: metadata.LicenseShortName?.value || 'Licenza indicata su Wikimedia Commons',
          title: page.title || fullName,
        };
      }).filter(Boolean).slice(0, limit);
    } catch {
      return [];
    }
  }

  async function commonsCategoryPhotos(category) {
    try {
      const url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=categorymembers&gcmtitle='
        + encodeURIComponent('Category:' + category) + '&gcmtype=file&gcmlimit=100&prop=imageinfo'
        + '&iiprop=url|extmetadata&iiurlwidth=900&format=json&origin=*';
      const data = await get(url);
      return Object.values(data.query?.pages || {}).map(page => {
        const file = page.imageinfo?.[0];
        if (!file?.thumburl) return null;
        const metadata = file.extmetadata || {};
        return {
          thumb_url: file.thumburl,
          description_url: file.descriptionurl || '',
          artist: metadata.Artist?.value?.replace(/<[^>]*>/g, '') || 'Autore non indicato',
          licence: metadata.LicenseShortName?.value || 'Licenza indicata su Wikimedia Commons',
          title: page.title || '',
          category,
        };
      }).filter(Boolean);
    } catch {
      return [];
    }
  }

  function antonelliMomentCaption(photo) {
    const title = photo.title.replace(/^File:/i, '').replace(/\.[^.]+$/, '');
    if (/pole position award/i.test(title)) return 'Cina · conquista della pole';
    if (/post race celebration/i.test(title)) return 'Cina · festa dopo la gara';
    if (/qualifying top 3/i.test(title)) return 'Cina · top 3 in qualifica';
    if (/bahrain/i.test(title)) return 'Bahrain · in gara';
    if (/niederlande|netherlands|dutch grand prix/i.test(title)) return 'Paesi Bassi · Gran Premio di Zandvoort';
    if (photo.category.includes('Australian')) return 'Australia · weekend di gara';
    return title.replace(/^2026[ _-]*/i, '').replace(/[_-]+/g, ' ');
  }

  async function loadAntonelliMoments() {
    const rail = document.querySelector('#antonelliMoments');
    const categories = [
      'Andrea Kimi Antonelli in 2026',
      'Andrea Kimi Antonelli at the 2026 Australian Grand Prix',
    ];
    const groups = await Promise.all(categories.map(commonsCategoryPhotos));
    const unique = new Map(groups.flat().filter(photo => !/lego/i.test(photo.title)).map(photo => [photo.title, photo]));
    const photos = [...unique.values()];
    const priority = [
      /Pole Position Award/i,
      /Post Race Celebration/i,
      /Qualifying Top 3/i,
      /Bahrain.*Race/i,
      /Australian Grand Prix/i,
      /Niederlande|Netherlands/i,
    ];
    photos.sort((a, b) => {
      const rank = photo => {
        const index = priority.findIndex(pattern => pattern.test(photo.title));
        return index < 0 ? priority.length : index;
      };
      return rank(a) - rank(b);
    });
    const items = photos.slice(0, 12).map(photo => {
      const caption = antonelliMomentCaption(photo);
      return `<figure class="archive-photo"><a href="${escapeHtml(photo.description_url)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(photo.thumb_url)}" alt="Kimi Antonelli · ${escapeHtml(caption)}" loading="lazy"><span class="photo-kicker">STAGIONE 2026</span><span class="photo-title">${escapeHtml(caption)}</span></a><figcaption><a href="${escapeHtml(photo.description_url)}" target="_blank" rel="noreferrer">${escapeHtml(photo.artist)} · ${escapeHtml(photo.licence)}</a></figcaption></figure>`;
    });
    rail.innerHTML = items.length ? items.join('') : '<div class="gallery-error">Foto della stagione 2026 non disponibili al momento.</div>';
  }

  function driverPhotoGallery(photos, fullName) {
    const extra = (photos || []).slice(1, 3);
    if (!extra.length) return '';
    const cards = extra.map((photo, index) =>
      '<figure><img src="' + escapeHtml(photo.thumb_url) + '" alt="' + escapeHtml(fullName + ' in Formula 1, foto ' + (index + 2)) + '" loading="lazy">'
      + '<figcaption><a href="' + escapeHtml(photo.description_url || '#') + '" target="_blank" rel="noreferrer">'
      + escapeHtml(photo.artist || 'Autore non indicato') + ' · ' + escapeHtml(photo.licence || 'Licenza Wikimedia Commons')
      + '</a></figcaption></figure>'
    ).join('');
    return '<section class="driver-photos"><div class="driver-photo-grid">' + cards + '</div></section>';
  }

  function stats(items) {
    return `<div class="detail-stats">${items.filter(item => item[1] !== null && item[1] !== undefined && item[1] !== '').map(([label, value]) => `<span><small>${escapeHtml(label)}</small><b>${escapeHtml(value)}</b></span>`).join('')}</div>`;
  }

  function resultsGrid(results, driver = false) {
    if (!results?.length) return '<p>Nessun risultato registrato per questa stagione.</p>';
    return `<div class="detail-races">${results.map(race => `<div><span>${escapeHtml(race.round)} · ${escapeHtml(race.race || race.race_name)}</span><b>${escapeHtml(race.position_text || race.finish_position || '—')}</b><small>${escapeHtml(driver ? race.constructor || '' : race.driver || '')} · ${escapeHtml(race.points ?? 0)} pt</small></div>`).join('')}</div>`;
  }

  async function loadDetail() {
    const params = new URLSearchParams(location.search);
    const type = params.get('type');
    const id = params.get('id');
    const year = Number(params.get('season')) || currentYear;
    if (!['driver', 'constructor', 'chassis'].includes(type) || !id) return false;
    document.querySelectorAll('header a[href^="#"]').forEach(link => { link.href = `?season=${year}${link.getAttribute('href')}`; });
    document.querySelectorAll('main > section:not(#detailPage)').forEach(section => { section.hidden = true; });
    detailPage.hidden = false;
    detailPage.innerHTML = '<div class="loading detail-loading">Caricamento scheda…</div>';
    try {
      const data = await get(`/api/${type}/${encodeURIComponent(id)}?season=${year}`);
      if (type === 'driver') {
        const article = await wikipediaPerson(data.full_name, data.id);
        const photos = article.photos || (article.photo ? [article.photo] : []);
        const photo = photos[0] || null;
        const careerStats = stats([
          ['TITOLI', data.titles], ['VITTORIE', data.wins], ['PODI', data.podiums],
          ['POLE', data.poles], ['GIRI VELOCI', data.fastest_laps], ['PUNTI IN CARRIERA', data.career_points],
          ['GARE', data.starts], ['ESORDIO', data.first_season], ['ULTIMA STAGIONE', data.last_season],
          ['NAZIONALITÀ', data.nationality], ['NATO', data.born], ['LUOGO', data.place_of_birth],
          ['CLASSIFICA ' + year, data.standing?.position_text || data.standing?.position], ['PUNTI ' + year, data.standing?.points],
        ]);
        detailPage.innerHTML = `<a class="detail-back" href="?season=${year}#season">← ARCHIVIO ${year}</a><div class="detail-hero driver-profile-hero">${photo ? `<img src="${escapeHtml(photo.thumb_url)}" alt="${escapeHtml(data.full_name)}">` : ''}<div class="detail-copy"><div class="eyebrow"><span></span> PILOTA · STAGIONE ${year}</div><h1>${escapeHtml(data.full_name)}</h1><p>${escapeHtml(article.extract || data.notes || 'Profilo storico del campionato di Formula 1.')}</p>${careerStats}</div></div>${photo ? `<p class="photo-note">Foto: ${escapeHtml(photo.artist)} · ${escapeHtml(photo.licence)} · <a href="${escapeHtml(photo.description_url)}" target="_blank" rel="noreferrer">fonte</a></p>` : ''}${driverPhotoGallery(photos, data.full_name)}<section class="detail-results"><h3>RISULTATI GARA · ${year}</h3>${resultsGrid(data.season_results, true)}</section><p class="data-credit">Statistiche: Lap Ledger / F1DB · CC BY-SA 4.0. Biografia: <a href="${escapeHtml(article.page || 'https://www.wikipedia.org/')}" target="_blank" rel="noreferrer">Wikipedia</a>.</p>`;
      } else if (type === 'constructor') {
        const standings = data.standing;
        const cars = (data.cars || []).map(car => `<a class="team-car" href="?type=chassis&id=${encodeURIComponent(car.id)}&season=${year}">${car.photo ? `<img src="${escapeHtml(car.photo.thumb_url)}" alt="${escapeHtml(car.full_name)}" loading="lazy"><small class="team-photo-credit">${escapeHtml(car.photo.artist || car.photo.credit || 'Autore non indicato')} · ${escapeHtml(car.photo.licence)}</small>` : ''}<b>${escapeHtml(car.full_name)}</b><small>${escapeHtml(car.engine_name || 'Motore non documentato')} · ${escapeHtml(car.confidence || '')}</small></a>`).join('');
        detailPage.innerHTML = `<a class="detail-back" href="?season=${year}#season">← ARCHIVIO ${year}</a><div class="detail-copy team-profile"><div class="eyebrow"><span></span> SCUDERIA · STAGIONE ${year}</div><h1>${escapeHtml(data.name)}</h1><p>${escapeHtml(data.notes || data.base || 'Scheda storica della scuderia.')}</p>${stats([['PAESE', data.country], ['ESORDIO', data.first_entry], ['TITOLI COSTRUTTORI', data.constructors_titles], ['VITTORIE', data.wins], ['POSIZIONE ' + year, standings?.position_text || standings?.position], ['PUNTI ' + year, standings?.points]])}</div><section class="detail-results"><h3>MONOPOSTI DELLA STAGIONE</h3><div class="team-car-grid">${cars || '<p>Dettagli monoposto non disponibili per questa stagione.</p>'}</div></section><section class="detail-results"><h3>RISULTATI E PILOTI · ${year}</h3>${resultsGrid(data.season_results)}</section><p class="data-credit">Dati e specifiche: Lap Ledger / F1DB · CC BY-SA 4.0. Foto accreditate nelle schede monoposto.</p>`;
      } else {
        const photo = data.photo;
        const car = data.design || {};
        detailPage.innerHTML = `<a class="detail-back" href="?type=constructor&id=${encodeURIComponent(data.constructor?.id || '')}&season=${year}">← TORNA ALLA SCUDERIA</a><div class="detail-hero car-profile">${photo ? `<img src="${escapeHtml(photo.thumb_url)}" alt="${escapeHtml(data.full_name)}">` : ''}<div class="detail-copy"><div class="eyebrow"><span></span> MONOPOSTO · ${escapeHtml(data.first_year || '')}–${escapeHtml(data.last_year || 'oggi')}</div><h1>${escapeHtml(data.full_name)}</h1><p>${escapeHtml(car.concept || car.story || 'Dati tecnici disponibili solo dove documentati dalle fonti.')}</p>${stats([['COSTRUTTORE', data.constructor?.name], ['TELAIO', data.chassis_type], ['MOTORE', data.engine_name], ['CONFIGURAZIONE', data.engine_config], ['CILINDRATA', data.capacity_cc ? `${data.capacity_cc} cc` : null], ['POTENZA', data.power_bhp ? `${data.power_bhp} bhp` : null], ['REGIME', data.rev_limit_rpm ? `${data.rev_limit_rpm} rpm` : null], ['CAMBIO', data.gearbox], ['MARCIA', data.gears], ['SOSPENSIONI ANT.', data.susp_front], ['SOSPENSIONI POST.', data.susp_rear], ['FRENI', data.brakes], ['PESO', data.weight_kg ? `${data.weight_kg} kg` : null], ['PASSO', data.wheelbase_mm ? `${data.wheelbase_mm} mm` : null], ['CARREGGIATA ANT.', data.track_front_mm ? `${data.track_front_mm} mm` : null], ['CARREGGIATA POST.', data.track_rear_mm ? `${data.track_rear_mm} mm` : null], ['SERBATOIO', data.fuel_capacity_l ? `${data.fuel_capacity_l} l` : data.fuel], ['PNEUMATICI', data.tyres]])}</div></div>${photo ? `<p class="photo-note">Foto: ${escapeHtml(photo.artist || photo.credit || 'Autore non indicato')} · ${escapeHtml(photo.licence)} · <a href="${escapeHtml(photo.description_url)}" target="_blank" rel="noreferrer">fonte</a></p>` : '<p class="photo-note">Foto non disponibile nell’archivio con licenza verificata.</p>'}<section class="detail-results"><h3>STAGIONI IN ARCHIVIO</h3><div class="year-chips">${(data.seasons_entered || []).map(entry => entry.constructor_id ? `<a href="?type=constructor&id=${encodeURIComponent(entry.constructor_id)}&season=${entry.year}">${entry.year}</a>` : `<span>${entry.year}</span>`).join('')}</div></section><p class="data-credit">Specifiche: Lap Ledger / F1DB · CC BY-SA 4.0. I campi mancanti non sono stati stimati.</p>`;
      }
    } catch {
      detailPage.innerHTML = `<a class="detail-back" href="?season=${year}#season">← ARCHIVIO</a><div class="notice">Scheda non disponibile nel database locale.</div>`;
    }
    return true;
  }

  async function loadHomePhotos() {
    try {
      const data = await get('/api/home');
      const cars = data.cars || [];
      const races = data.races || [];
      document.querySelector('#photoCount').textContent = `${data.car_photo_count || cars.length} FOTO DI MONOPOSTI`;
      document.querySelector('#racePhotoCount').textContent = `${data.race_photo_count || races.length} MOMENTI DI GARA · 1950—OGGI`;
      const coverCars = sampleEven(cars, 6);
      const coverRaces = sampleEven(races, 6);
      const coverPhotos = [];
      for (let index = 0; index < Math.max(coverCars.length, coverRaces.length); index++) {
        if (coverCars[index]) coverPhotos.push(photoFigure(coverCars[index], coverCars[index].full_name));
        if (coverRaces[index]) coverPhotos.push(photoFigure(coverRaces[index], `${coverRaces[index].name_used} · ${coverRaces[index].year}`, 'race-photo'));
      }
      document.querySelector('#heroCollage').innerHTML = coverPhotos.join('');
      document.querySelector('#carGallery').innerHTML = cars.map(car => photoFigure(car, car.full_name)).join('');
      document.querySelector('#raceGallery').innerHTML = races.map(race => photoFigure(race, `${race.name_used} · ${race.year}`, 'race-photo')).join('');
    } catch {
      document.querySelector('#heroCollage').innerHTML = '<div class="gallery-error">Archivio fotografico non disponibile. Ricarica la pagina tra poco.</div>';
    }
  }

  async function loadDriverPortraits() {
    const cards = [...document.querySelectorAll('img[data-driver]')];
    const figures = await Promise.all(cards.map(async image => {
      try {
        let driverUrl = image.dataset.wikipedia
          ? 'https://en.wikipedia.org/wiki/' + encodeURIComponent(image.dataset.wikipedia)
          : null;
        if (!driverUrl) {
          const data = await get('https://api.jolpi.ca/ergast/f1/drivers/' + encodeURIComponent(image.dataset.driver) + '.json?limit=1');
          driverUrl = data.MRData?.DriverTable?.Drivers?.[0]?.url;
        }
        if (!driverUrl) return null;
        const source = new URL(driverUrl);
        if (!source.hostname.endsWith('wikipedia.org')) return null;
        const title = decodeURIComponent(source.pathname.split('/wiki/')[1] || '');
        const page = await get('https://' + source.hostname + '/w/api.php?action=query&titles=' + encodeURIComponent(title) + '&prop=pageimages|pageprops&piprop=name|thumbnail&pithumbsize=800&format=json&origin=*');
        const result = Object.values(page.query?.pages || {})[0];
        if (result?.pageprops?.disambiguation) return null;
        const villeneuveFiles = [
          'Gilles Villeneuve imola 1979 (cropped).jpg',
          'Gilles Villeneuve 1979 Imola.jpg',
          'Gilles Villeneuve and Riccardo Patrese, Zolder 1979.jpg',
        ];
        let photo = image.dataset.driver === 'antonelli'
          ? (await commonsFilePhotos(['2026 Bahrain GP - Mercedes - Kimi Antonelli - Race.jpg']))[0] || null
          : image.dataset.driver === 'villeneuve-g'
            ? (await commonsFilePhotos(villeneuveFiles))[0] || null
            : null;
        if (!photo && image.dataset.driver !== 'villeneuve-g' && result?.pageimage) {
          const commons = await get('https://commons.wikimedia.org/w/api.php?action=query&titles=' + encodeURIComponent('File:' + result.pageimage) + '&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=800&format=json&origin=*');
          const file = Object.values(commons.query?.pages || {})[0]?.imageinfo?.[0];
          if (file?.thumburl) {
            const metadata = file.extmetadata || {};
            photo = {
              thumb_url: file.thumburl,
              description_url: file.descriptionurl || '',
              artist: metadata.Artist?.value?.replace(/<[^>]*>/g, '') || 'Autore non indicato',
              licence: metadata.LicenseShortName?.value || 'Licenza indicata su Commons',
            };
          }
        }
        if (!photo && image.dataset.driver !== 'villeneuve-g') photo = (await commonsDriverPhotos(image.alt.split(',')[0], 1))[0] || null;
        if (!photo) return null;
        image.src = photo.thumb_url;
        const artist = photo.artist || 'Autore non indicato';
        const licence = photo.licence || 'Licenza indicata su Commons';
        const credit = document.createElement('small');
        credit.className = 'portrait-credit';
        credit.textContent = artist + ' · ' + licence;
        image.closest('.driver-card').append(credit);
        const figure = document.createElement('figure');
        figure.className = 'archive-photo hero-portrait';
        const link = document.createElement('a');
        link.href = image.closest('.driver-card').href;
        const portrait = document.createElement('img');
        portrait.src = photo.thumb_url;
        portrait.alt = image.alt;
        portrait.loading = 'eager';
        const kicker = document.createElement('span');
        kicker.className = 'photo-kicker';
        kicker.textContent = 'PILOTA';
        const name = document.createElement('span');
        name.className = 'photo-title';
        name.textContent = image.alt;
        link.append(portrait, kicker, name);
        const caption = document.createElement('figcaption');
        const sourceLink = document.createElement('a');
        sourceLink.href = photo.description_url || driverUrl;
        sourceLink.target = '_blank';
        sourceLink.rel = 'noreferrer';
        sourceLink.textContent = artist + ' · ' + licence;
        caption.append(sourceLink);
        figure.append(link, caption);
        return figure;
      } catch {
        return null;
      }
    }));
    figures.filter(Boolean).forEach(figure => document.querySelector('#heroCollage').append(figure));
  }

  async function start() {
    const params = new URLSearchParams(location.search);
    if (params.has('type')) {
      const year = Number(params.get('season')) || currentYear;
      await loadDetail();
      document.querySelectorAll('header a[href^="#"]').forEach(link => { link.href = `?season=${year}${link.getAttribute('href')}`; });
    } else {
      try {
        const year = await loadYears();
        await loadSeason(year);
      } catch {
        status.textContent = 'Archivio locale non avviato';
        errorBox.hidden = false;
        errorBox.textContent = 'Archivio statico non disponibile. Verifica che static-api sia pubblicato insieme al sito.';
      }
    }
    loadHomePhotos();
    loadDriverPortraits();
    loadAntonelliMoments();
  }

  document.querySelectorAll('.moments-controls button').forEach(button => button.addEventListener('click', () => {
    document.querySelector('#antonelliMoments').scrollBy({ left: Number(button.dataset.scroll) * 520, behavior: 'smooth' });
  }));

  select.addEventListener('change', () => loadSeason(Number(select.value)));
  document.querySelector('#prevYear').addEventListener('click', () => { if (+select.value > 1950) { select.value = String(+select.value - 1); loadSeason(+select.value); } });
  document.querySelector('#nextYear').addEventListener('click', () => { if (+select.value < currentYear) { select.value = String(+select.value + 1); loadSeason(+select.value); } });
  document.querySelectorAll('[data-year]').forEach(button => button.addEventListener('click', () => { select.value = button.dataset.year; loadSeason(+select.value); }));
  start();
})();
