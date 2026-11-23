(() => {
  const currentYear = new Date().getFullYear();
  const antonelliMexicoPhoto = {
    thumb_url: 'https://images.ctfassets.net/1fvlg6xqnm65/3VQ81lFwmyH4C7Hck8kAN4/e93d1b3b0eb56018cc60e2510dd9e01a/M647491.jpg?fm=webp&q=75&w=1920',
    description_url: 'https://www.mercedesamgf1.com/news/in-pictures-the-best-images-from-mexico-city-2026',
    artist: 'Mercedes-AMG PETRONAS F1 Team',
    licence: '© Mercedes-Benz Grand Prix Ltd.',
  };
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
    if(route[0]==='champions')return readStatic('champions.json');
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
          ? antonelliMexicoPhoto
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

  async function commonsAntonelliRacePhotos(raceName) {
    try {
      const query = `Kimi Antonelli 2026 ${raceName}`;
      const url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=50&gsrsearch='
        + encodeURIComponent(query) + '&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=900&format=json&origin=*';
      const data = await get(url);
      return Object.values(data.query?.pages || []).map(page => {
        const file = page.imageinfo?.[0];
        if (!file?.thumburl) return null;
        const metadata = file.extmetadata || {};
        return {
          thumb_url: file.thumburl,
          description_url: file.descriptionurl || '',
          artist: metadata.Artist?.value?.replace(/<[^>]*>/g, '') || 'Autore non indicato',
          licence: metadata.LicenseShortName?.value || 'Licenza indicata su Wikimedia Commons',
          title: page.title || '',
        };
      }).filter(Boolean);
    } catch {
      return [];
    }
  }

  async function loadAntonelliMoments() {
    const rail = document.querySelector('#antonelliMoments');
    const eventLabels = {
      'Chinese Grand Prix': 'CINA',
      'Japanese Grand Prix': 'GIAPPONE',
      'Miami Grand Prix': 'MIAMI',
      'Canadian Grand Prix': 'CANADA',
      'Monaco Grand Prix': 'MONACO',
      'Belgian Grand Prix': 'BELGIO',
      'Italian Grand Prix': 'ITALIA',
      'Spanish Grand Prix': 'SPAGNA',
      'United States Grand Prix': 'STATI UNITI',
    };
    try {
      const profile = await get('/api/driver/antonelli?season=2026');
      const wins = (profile.season_results || []).filter(race => Number(race.finish_position) === 1);
      const groups = await Promise.all(wins.map(async race => {
        const [searchResults, categoryResults] = await Promise.all([
          commonsAntonelliRacePhotos(race.race),
          commonsCategoryPhotos(`2026 ${race.race}`),
        ]);
        return [...searchResults, ...categoryResults];
      }));
      const used = new Set();
      const isAntonelliPhoto = photo => /antonelli/i.test(photo.title || '');
      const uniquePhoto = photo => photo && isAntonelliPhoto(photo)
        && !used.has(photo.thumb_url || photo.description_url || photo.title);
      const items = wins.map((race, index) => {
        const label = eventLabels[race.race] || race.race;
        const candidates = (groups[index] || []).filter(photo => !/lego/i.test(photo.title) && uniquePhoto(photo));
        const photo = candidates[0];
        if (photo) used.add(photo.thumb_url || photo.description_url || photo.title);
        const image = photo
          ? `<a href="${escapeHtml(photo.description_url)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(photo.thumb_url)}" alt="${escapeHtml(photo.title.replace(/^File:/i, ''))}" loading="lazy"><span class="photo-kicker">VITTORIA ${index + 1} · 2026</span><span class="photo-title">${escapeHtml(label)}</span></a><figcaption><a href="${escapeHtml(photo.description_url)}" target="_blank" rel="noreferrer">${escapeHtml(photo.artist)} · ${escapeHtml(photo.licence)}</a></figcaption>`
          : `<div class="antonelli-win-placeholder" role="img" aria-label="Vittoria ${index + 1} al Gran Premio ${escapeHtml(label)}"><span>VITTORIA ${index + 1}</span><b>${escapeHtml(label)}</b></div>`;
        return `<figure class="archive-photo">${image}</figure>`;
      });
      document.querySelector('.moments-heading .eyebrow').textContent = `LE ${wins.length} VITTORIE · STAGIONE 2026`;
      rail.innerHTML = items.length ? items.join('') : '<div class="gallery-error">Vittorie della stagione 2026 non disponibili.</div>';
    } catch {
      rail.innerHTML = '<div class="gallery-error">Foto della stagione 2026 non disponibili al momento.</div>';
    }
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
        const featuredChampion = id === 'antonelli' && year === 2026;
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
        detailPage.innerHTML = `<a class="detail-back" href="?season=${year}#season">← ARCHIVIO ${year}</a><div class="detail-hero driver-profile-hero">${photo ? `<img src="${escapeHtml(photo.thumb_url)}" alt="${escapeHtml(data.full_name)}">` : ''}<div class="detail-copy"><div class="eyebrow"><span></span> PILOTA · STAGIONE ${year}</div><h1>${escapeHtml(data.full_name)}</h1><p>${escapeHtml(article.extract || data.notes || 'Profilo storico del campionato di Formula 1.')}</p>${careerStats}</div></div>${photo ? `<p class="photo-note">Foto: ${id === 'antonelli' && year === 2026 ? 'Kimi Antonelli festeggia il titolo mondiale al GP del Messico' : escapeHtml(photo.artist)} · ${escapeHtml(photo.artist)} · ${escapeHtml(photo.licence)} · <a href="${escapeHtml(photo.description_url)}" target="_blank" rel="noreferrer">fonte</a></p>` : ''}${driverPhotoGallery(photos, data.full_name)}<section class="detail-results"><h3>RISULTATI GARA · ${year}</h3>${resultsGrid(data.season_results, true)}</section><p class="data-credit">Statistiche: Lap Ledger / F1DB · CC BY-SA 4.0. Biografia: <a href="${escapeHtml(article.page || 'https://www.wikipedia.org/')}" target="_blank" rel="noreferrer">Wikipedia</a>.</p>`;
        if (featuredChampion) {
          const hero = detailPage.querySelector('.driver-profile-hero');
          hero.classList.add('antonelli-profile-hero');
          hero.style.backgroundImage = `linear-gradient(90deg,rgba(10,11,14,.88),rgba(10,11,14,.3)),url("${antonelliMexicoPhoto.thumb_url}")`;
          hero.querySelector('.eyebrow').textContent = `IL NUOVO CAMPIONE · ANDREA KIMI ANTONELLI · ${year}`;
          hero.querySelector('h1').textContent = 'Il nuovo campione';
          document.title = 'Il nuovo campione · Formula One';
        }
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
        let driverUrl = null;
        let result = null;
        if (image.dataset.driver !== 'antonelli') {
          driverUrl = image.dataset.wikipedia
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
          result = Object.values(page.query?.pages || {})[0];
          if (result?.pageprops?.disambiguation) return null;
        }
        const villeneuveFiles = [
          'Gilles Villeneuve imola 1979 (cropped).jpg',
          'Gilles Villeneuve 1979 Imola.jpg',
          'Gilles Villeneuve and Riccardo Patrese, Zolder 1979.jpg',
        ];
        let photo = image.dataset.driver === 'antonelli'
          ? antonelliMexicoPhoto
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

  const gameHistoryKey = 'formula-one-champion-game-v2';
  const legacyGameHistoryKey = 'formula-one-champion-game-v1';
  const lastGameKey = 'formula-one-champion-game-last-v1';
  const difficultyLimits = new Map([['facile', 10], ['medio', 5], ['difficile', 3], ['impossibile', 1]]);
  const difficultyNames = { facile: 'Facile', medio: 'Medio', difficile: 'Difficile', impossibile: 'Impossibile' };
  const gameYear = document.querySelector('#gameYear');
  const gameForm = document.querySelector('#championForm');
  const gameInput = document.querySelector('#championGuess');
  const difficultySelect = document.querySelector('#championDifficulty');
  const gameRules = document.querySelector('#gameRules');
  const gameFeedback = document.querySelector('#gameFeedback');
  const championSuggestion = document.querySelector('#acceptChampionSuggestion');
  const gameScores = document.querySelector('#gameScores');
  const gameStorageNote = document.querySelector('#gameStorageNote');
  const lastGameView = document.querySelector('#lastGame');
  const nextGame = document.querySelector('#nextGame');
  const forfeitGame = document.querySelector('#forfeitGame');
  const predictionStorageKey = 'formula-one-champion-predictions-v1';
  const predictionYearsView = document.querySelector('#predictionYears');
  const predictionHistoryView = document.querySelector('#predictionHistory');
  const predictionStorageNote = document.querySelector('#predictionStorageNote');
  const predictionFirstYear = 2027;
  const predictionMaximumYear = 2029;
  let predictions = [];
  let predictionDrivers = [];
  let champions = [];
  let champion = null;
  let roundAttempts = 0;
  let maxChampionAttempts = difficultyLimits.get('facile');
  let gameDifficulty = 'facile';
  let runAttempts = 0;
  let runStreak = 0;
  let gameHistory = [];
  let runAnswers = [];
  let latestGame = null;
  let usedYears = new Set();
  let gameFinished = false;

  function normalizedName(value) {
    return value.toLocaleLowerCase('it').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]/g, '');
  }

  function readPredictions() {
    try {
      const saved = JSON.parse(localStorage.getItem(predictionStorageKey) || '[]');
      if (!Array.isArray(saved)) return [];
      return saved.filter(item => item && typeof item === 'object'
        && Number.isInteger(item.year) && item.year >= predictionFirstYear && item.year <= predictionMaximumYear
        && typeof item.name === 'string' && item.name.trim().length > 0 && item.name.length <= 100
        && ['pending', 'correct', 'incorrect'].includes(item.status)
        && Number.isFinite(item.timestamp) && item.timestamp > 0)
        .map(item => ({
          year: item.year,
          name: item.name,
          driverId: typeof item.driverId === 'string' ? item.driverId : '',
          status: item.status,
          timestamp: item.timestamp,
        }))
        .sort((a, b) => a.year - b.year || a.timestamp - b.timestamp);
    } catch {
      predictionStorageNote.textContent = 'Salvataggio non disponibile: pronostici validi solo per questa visita.';
      return [];
    }
  }

  function savePredictions() {
    try {
      localStorage.setItem(predictionStorageKey, JSON.stringify(predictions));
    } catch {
      predictionStorageNote.textContent = 'Salvataggio non disponibile: pronostici persi alla chiusura della pagina.';
    }
  }

  function renderPredictions() {
    if (!predictions.length) {
      predictionHistoryView.innerHTML = '<li class="game-empty">Nessun pronostico salvato.</li>';
      return;
    }
    const labels = { pending: 'IN ATTESA', correct: 'INDOVINATO', incorrect: 'ERRATO' };
    predictionHistoryView.innerHTML = [...predictions].reverse().map(item => {
      const result = champions.find(candidate => candidate.year === item.year);
      const actual = item.status === 'pending' || !result ? '' : `<br>Campione: ${escapeHtml(result.name)}`;
      return `<li class="prediction-record prediction-${item.status}"><span><b>${escapeHtml(item.year)}</b> · ${escapeHtml(item.name)}</span><span>${labels[item.status]}${actual}<small>${escapeHtml(new Date(item.timestamp).toLocaleDateString('it-IT'))}</small></span></li>`;
    }).join('');
  }

  function resolvePredictions() {
    let changed = false;
    predictions.forEach(item => {
      if (item.status !== 'pending') return;
      const result = champions.find(candidate => candidate.year === item.year);
      if (!result) return;
      const matches = item.driverId && result.id
        ? item.driverId === String(result.id)
        : normalizedName(item.name) === normalizedName(result.name);
      item.status = matches ? 'correct' : 'incorrect';
      changed = true;
    });
    if (changed) savePredictions();
  }

  function latestChampionYear() {
    const latestChampionYear = champions.reduce((latest, item) => Math.max(latest, item.year), 0);
    return latestChampionYear;
  }

  function renderPredictionForms(selections = {}) {
    const latestYear = latestChampionYear();
    const optionsFor = year => predictionDrivers.map(driver =>
      `<option value="${escapeHtml(driver.id)}"${selections[year] === driver.id ? ' selected' : ''}>${escapeHtml(driver.name)}</option>`
    ).join('');
    predictionYearsView.innerHTML = Array.from(
      { length: predictionMaximumYear - predictionFirstYear + 1 },
      (_, index) => predictionFirstYear + index,
    ).map(year => {
      const record = predictions.find(item => item.year === year);
      const actual = champions.find(item => item.year === year);
      if (record) {
        const status = { pending: 'IN ATTESA DEL CAMPIONE', correct: 'PRONOSTICO INDOVINATO', incorrect: 'PRONOSTICO ERRATO' }[record.status];
        return `<div class="prediction-year-row"><h4>${year}</h4><p>${escapeHtml(record.name)} · ${status}</p>${record.status === 'incorrect' && actual ? `<small>Campione: ${escapeHtml(actual.name)}</small>` : ''}</div>`;
      }
      if (actual || year <= latestYear) {
        return `<div class="prediction-year-row"><h4>${year}</h4><p>STAGIONE CONCLUSA · ${escapeHtml(actual?.name || 'CAMPIONE NON DISPONIBILE')}</p></div>`;
      }
      return `<form class="prediction-year-row" data-prediction-year="${year}"><label for="predictionDriver${year}">Campione previsto · ${year}</label><div class="game-input-row"><select id="predictionDriver${year}" name="driver" required ${predictionDrivers.length ? '' : 'disabled'}><option value="">Scegli un pilota</option>${optionsFor(year)}</select><button class="primary-button" type="submit" ${predictionDrivers.length ? '' : 'disabled'}>SALVA</button></div></form>`;
    }).join('');
  }

  function submitPrediction(event, form) {
    event.preventDefault();
    const selections = Object.fromEntries([...predictionYearsView.querySelectorAll('form[data-prediction-year]')]
      .map(item => [item.dataset.predictionYear, item.elements.driver.value]));
    const year = Number(form.dataset.predictionYear);
    const driverId = form.elements.driver.value;
    const driver = predictionDrivers.find(item => String(item.id) === driverId);
    if (!Number.isInteger(year) || year < predictionFirstYear || year > predictionMaximumYear
      || year <= latestChampionYear() || predictions.some(item => item.year === year) || !driver) return;
    predictions.push({ year, name: driver.name, driverId: String(driver.id), status: 'pending', timestamp: Date.now() });
    predictions.sort((a, b) => a.year - b.year);
    savePredictions();
    renderPredictions();
    delete selections[year];
    renderPredictionForms(selections);
  }

  async function initFuturePredictions() {
    predictions = readPredictions();
    resolvePredictions();
    renderPredictions();
    predictionYearsView.addEventListener('submit', event => {
      const form = event.target.closest('form[data-prediction-year]');
      if (form) submitPrediction(event, form);
    });
    try {
      const data = await get(`/api/season/${latestChampionYear()}`);
      predictionDrivers = (data.drivers || []).filter(driver => driver && driver.id && driver.name)
        .map(driver => ({ id: String(driver.id), name: String(driver.name) }));
    } catch {
      predictionStorageNote.textContent = 'Formazione piloti non disponibile.';
      renderPredictionForms();
      return;
    }
    renderPredictionForms();
  }

  function championNames(name) {
    const nickname = name.match(/[\u0027\u2018\u201c]([^\u0027\u2019\u201d]+)[\u0027\u2019\u201d]/)?.[1];
    return nickname ? [name, `${nickname} ${name.split(/\s+/).at(-1)}`] : [name];
  }

  function spellingDistance(left, right) {
    if (Math.abs(left.length - right.length) > 2) return 3;
    let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let row = 1; row <= left.length; row += 1) {
      const current = [row];
      let minimum = row;
      for (let column = 1; column <= right.length; column += 1) {
        current[column] = Math.min(
          current[column - 1] + 1,
          previous[column] + 1,
          previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
        );
        minimum = Math.min(minimum, current[column]);
      }
      if (minimum > 2) return 3;
      previous = current;
    }
    return previous[right.length];
  }

  function findSpellingSuggestion(value) {
    const typed = normalizedName(value);
    if (typed.length < 6) return null;
    return championNames(champion.name).map(name => ({
      name,
      distance: spellingDistance(typed, normalizedName(name)),
    })).filter(item => item.distance > 0 && item.distance <= 2)
      .sort((a, b) => a.distance - b.distance)[0]?.name || null;
  }

  function readGameHistory() {
    try {
      const saved = localStorage.getItem(gameHistoryKey);
      if (saved !== null) {
        const records = JSON.parse(saved);
        return Array.isArray(records) ? records.filter(item => item && typeof item === 'object'
          && Number.isInteger(item.streak) && item.streak >= 0 && item.streak <= 100
          && Number.isInteger(item.attempts) && item.attempts > 0 && item.attempts <= 10000
          && Number.isFinite(item.timestamp) && item.timestamp > 0).map(item => ({
            ...item,
            difficulty: difficultyLimits.has(item.difficulty) ? item.difficulty : 'facile',
            answers: Array.isArray(item.answers) ? item.answers.filter(answer => answer && typeof answer === 'object'
              && Number.isInteger(answer.year)
              && typeof answer.name === 'string' && answer.name.length <= 100) : [],
          })).sort(compareGames).slice(0, 5) : [];
      }
      const legacy = JSON.parse(localStorage.getItem(legacyGameHistoryKey) || '[]');
      return Array.isArray(legacy) ? legacy.filter(item => item && Number.isInteger(item.guesses)
        && item.guesses > 0 && Number.isFinite(item.timestamp) && item.timestamp > 0)
        .map(item => ({ streak: 1, attempts: item.guesses, timestamp: item.timestamp, answers: [], difficulty: 'facile' }))
        .sort(compareGames).slice(0, 5) : [];
    } catch {
      gameStorageNote.textContent = 'Salvataggio non disponibile: risultati validi solo per questa visita.';
      return [];
    }
  }

  function compareGames(a, b) {
    return b.streak - a.streak || a.attempts - b.attempts || a.timestamp - b.timestamp;
  }

  function readLastGame() {
    try {
      const record = JSON.parse(localStorage.getItem(lastGameKey) || 'null');
      if (record && Number.isInteger(record.streak) && Number.isInteger(record.attempts)
        && Number.isFinite(record.timestamp) && record.timestamp > 0) {
        record.answers = Array.isArray(record.answers) ? record.answers.filter(answer => answer && typeof answer === 'object'
          && Number.isInteger(answer.year) && typeof answer.name === 'string' && answer.name.length <= 100) : [];
        return record;
      }
      const savedHistory = JSON.parse(localStorage.getItem(gameHistoryKey) || '[]');
      if (Array.isArray(savedHistory)) {
        const previous = savedHistory.filter(item => item && Number.isInteger(item.streak)
          && Number.isInteger(item.attempts) && Number.isFinite(item.timestamp) && item.timestamp > 0)
          .sort((a, b) => b.timestamp - a.timestamp)[0];
        if (previous) return { ...previous, answers: [], outcome: 'complete' };
      }
    } catch {
      gameStorageNote.textContent = 'Salvataggio non disponibile: risultati validi solo per questa visita.';
    }
    return gameHistory[0] || null;
  }

  function renderLastGame(record) {
    if (!record) {
      lastGameView.innerHTML = '<p>Completa una partita per vedere qui il riepilogo.</p>';
      return;
    }
    const outcomes = { forfeit: 'Persa per forfait', attempts: 'Persa: tentativi esauriti', complete: 'Completata' };
    const answers = Array.isArray(record.answers) ? record.answers : [];
    const answerList = answers.length
      ? `<ul>${answers.map(answer => `<li>${escapeHtml(answer.year)} — ${escapeHtml(answer.name)}</li>`).join('')}</ul>`
      : '<p>Dettagli delle risposte non disponibili.</p>';
    const missed = record.revealedName
      ? `<p><b>Campione non indovinato:</b> ${escapeHtml(record.revealedYear)} — ${escapeHtml(record.revealedName)}</p>` : '';
    lastGameView.innerHTML = `<p><b>Esito:</b> ${escapeHtml(outcomes[record.outcome] || 'Partita')}</p><p><b>Piloti indovinati:</b> ${escapeHtml(record.streak)}</p><p><b>Tentativi:</b> ${escapeHtml(record.attempts)}</p><p><b>Difficoltà:</b> ${escapeHtml(difficultyNames[record.difficulty] || 'Facile')}</p><p class="last-game-answers"><b>Anno — pilota</b></p>${answerList}${missed}<small>${escapeHtml(new Date(record.timestamp).toLocaleDateString('it-IT'))}</small>`;
  }

  function renderGameHistory() {
    if (!gameHistory.length) {
      gameScores.innerHTML = '<li class="game-empty">Completa una partita per iniziare la classifica.</li>';
      return;
    }
    gameScores.innerHTML = gameHistory.map(item => {
      const answers = item.answers?.length
        ? `<small class="game-score-answers">${item.answers.map(answer => `${escapeHtml(answer.year)} — ${escapeHtml(answer.name)}`).join('<br>')}</small>`
        : '<small class="game-score-answers">Dettagli precedenti non disponibili</small>';
      return `<li><span><b>${escapeHtml(item.streak)} ${item.streak === 1 ? 'anno' : 'anni'}</b> indovinati${answers}</span><span>${escapeHtml(item.attempts)} ${item.attempts === 1 ? 'tentativo' : 'tentativi'}<small>${escapeHtml(difficultyNames[item.difficulty] || 'Facile')} · ${escapeHtml(new Date(item.timestamp).toLocaleDateString('it-IT'))}</small></span></li>`;
    }).join('');
  }

  function startChampionRound() {
    if (!champions.length) return;
    const choices = champions.filter(item => !usedYears.has(item.year));
    if (!choices.length) {
      finishChampionGame(`Hai indovinato tutti gli anni: ${runStreak} su ${champions.length}.`);
      return;
    }
    champion = choices[Math.floor(Math.random() * choices.length)];
    usedYears.add(champion.year);
    roundAttempts = 0;
    gameYear.textContent = String(champion.year);
    gameInput.value = '';
    gameInput.disabled = false;
    gameForm.querySelector('button').disabled = false;
    gameFeedback.textContent = 'Scrivi il nome del campione.';
    nextGame.hidden = true;
    forfeitGame.hidden = false;
    championSuggestion.hidden = true;
  }

  function finishChampionGame(message, outcome = 'complete') {
    gameFinished = true;
    gameInput.disabled = true;
    gameForm.querySelector('button').disabled = true;
    difficultySelect.disabled = false;
    gameFeedback.textContent = message;
    forfeitGame.hidden = true;
    championSuggestion.hidden = true;
    const result = {
      streak: runStreak,
      attempts: runAttempts,
      difficulty: gameDifficulty,
      answers: [...runAnswers],
      timestamp: Date.now(),
      outcome,
      revealedYear: outcome === 'complete' ? null : champion?.year,
      revealedName: outcome === 'complete' ? null : champion?.name,
    };
    latestGame = result;
    renderLastGame(latestGame);
    try {
      localStorage.setItem(lastGameKey, JSON.stringify(result));
    } catch {
      gameStorageNote.textContent = 'Salvataggio non disponibile: risultato perso alla chiusura della pagina.';
    }
    const ranked = [...gameHistory, result].sort(compareGames);
    if (ranked.indexOf(result) < 5) {
      gameHistory = ranked.slice(0, 5);
      renderGameHistory();
      try {
        localStorage.setItem(gameHistoryKey, JSON.stringify(gameHistory));
      } catch {
        gameStorageNote.textContent = 'Salvataggio non disponibile: risultato perso alla chiusura della pagina.';
      }
    } else {
      gameFeedback.textContent = `${message} Fuori dalla top 5: partita non aggiunta alla classifica.`;
    }
    nextGame.textContent = 'NUOVA PARTITA ↗';
    nextGame.hidden = false;
  }

  function startChampionGame() {
    gameDifficulty = difficultySelect.value;
    maxChampionAttempts = difficultyLimits.get(gameDifficulty) || difficultyLimits.get('facile');
    runStreak = 0;
    runAttempts = 0;
    runAnswers = [];
    usedYears = new Set();
    gameFinished = false;
    difficultySelect.disabled = true;
    gameRules.textContent = `Hai ${maxChampionAttempts} ${maxChampionAttempts === 1 ? 'tentativo' : 'tentativi'} per anno. Se indovini, la partita continua con un altro anno.`;
    nextGame.textContent = 'PROSSIMO ANNO ↗';
    startChampionRound();
    gameInput.focus();
  }

  function resolveChampionGuess(value, countAttempt = true) {
    if (!champion || gameFinished || (countAttempt && gameInput.disabled)) return;
    if (countAttempt) {
      roundAttempts += 1;
      runAttempts += 1;
      difficultySelect.disabled = true;
    }
    if (championNames(champion.name).some(name => normalizedName(value) === normalizedName(name))) {
      championSuggestion.hidden = true;
      runStreak += 1;
      runAnswers.push({ year: champion.year, name: champion.name });
      gameFeedback.textContent = `Esatto: ${champion.name}! Anni indovinati di fila: ${runStreak}.`;
      gameInput.disabled = true;
      gameForm.querySelector('button').disabled = true;
      forfeitGame.hidden = true;
      nextGame.textContent = 'PROSSIMO ANNO ↗';
      nextGame.hidden = false;
      return;
    }
    const suggestion = findSpellingSuggestion(value);
    if (suggestion) {
      championSuggestion.textContent = `Intendevi ${suggestion}? Usa il suggerimento`;
      championSuggestion.dataset.name = suggestion;
      championSuggestion.hidden = false;
      gameFeedback.textContent = `Nome quasi corretto. Tentativo ${roundAttempts} di ${maxChampionAttempts}.`;
      if (roundAttempts >= maxChampionAttempts) {
        gameInput.disabled = true;
        gameForm.querySelector('button').disabled = true;
      } else {
        gameInput.select();
      }
      return;
    }
    championSuggestion.hidden = true;
    if (roundAttempts >= maxChampionAttempts) {
      finishChampionGame(`Dopo ${maxChampionAttempts} tentativi, il campione era ${champion.name}. Hai indovinato ${runStreak} ${runStreak === 1 ? 'anno' : 'anni'} consecutivi.`, 'attempts');
      return;
    }
    gameFeedback.textContent = `Nome errato. Tentativo ${roundAttempts} di ${maxChampionAttempts}. Riprova.`;
    gameInput.select();
  }

  async function initChampionGame() {
    gameHistory = readGameHistory();
    latestGame = readLastGame();
    renderGameHistory();
    renderLastGame(latestGame);
    gameDifficulty = difficultySelect.value;
    maxChampionAttempts = difficultyLimits.get(gameDifficulty) || difficultyLimits.get('facile');
    gameRules.textContent = `Hai ${maxChampionAttempts} ${maxChampionAttempts === 1 ? 'tentativo' : 'tentativi'} per anno. Se indovini, la partita continua con un altro anno.`;
    difficultySelect.addEventListener('change', () => {
      if (!gameFinished && (runAttempts || runStreak)) return;
      gameDifficulty = difficultySelect.value;
      maxChampionAttempts = difficultyLimits.get(gameDifficulty) || difficultyLimits.get('facile');
      gameRules.textContent = `Hai ${maxChampionAttempts} ${maxChampionAttempts === 1 ? 'tentativo' : 'tentativi'} per anno. Se indovini, la partita continua con un altro anno.`;
    });
    gameForm.addEventListener('submit', event => {
      event.preventDefault();
      resolveChampionGuess(gameInput.value);
    });
    gameInput.addEventListener('input', () => { championSuggestion.hidden = true; });
    championSuggestion.addEventListener('click', () => {
      const suggestedName = championSuggestion.dataset.name;
      if (!suggestedName) return;
      gameInput.value = suggestedName;
      championSuggestion.hidden = true;
      resolveChampionGuess(suggestedName, false);
    });
    nextGame.addEventListener('click', () => {
      if (gameFinished) startChampionGame();
      else {
        startChampionRound();
        gameInput.focus();
      }
    });
    forfeitGame.addEventListener('click', () => {
      if (!champion || gameFinished) return;
      finishChampionGame(`Partita persa per forfait. Il campione era ${champion.name}. Hai indovinato ${runStreak} ${runStreak === 1 ? 'anno' : 'anni'} consecutivi.`, 'forfeit');
    });
    try {
      const data = await get('/api/champions');
      champions = (data.items || []).filter(item => Number.isInteger(item.year) && item.name);
      if (!champions.length) throw new Error('Campioni non disponibili');
      startChampionRound();
      await initFuturePredictions();
    } catch {
      gameYear.textContent = '—';
      gameInput.disabled = true;
      gameForm.querySelector('button').disabled = true;
      gameFeedback.textContent = 'Dati dei campioni non disponibili.';
      predictionYearsView.innerHTML = '<p class="game-feedback">Dati dei campioni non disponibili.</p>';
    }
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
    initChampionGame();
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
