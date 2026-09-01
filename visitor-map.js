(function () {
  'use strict';

  var MAP_DATA_URL = 'world-countries.json';
  var GEOLOCATION_URL = 'https://ipwho.is/';
  var COUNTER_BASE_URL = 'https://countapi.mileshilliard.com/api/v1/';
  var COUNTER_PREFIX = 's1wnd0702-bit-xiao-test-visitor-';
  var COUNTRY_COUNTER_PREFIX = 'country-';
  var SESSION_KEY = 'xiao-test-visitor-counted-v3';
  var IS_PRODUCTION = /(^|\.)s1wnd0702-bit\.github\.io$/i.test(window.location.hostname);
  var MAX_PARALLEL_REQUESTS = 14;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var MAP_WIDTH = 960;
  var MAP_HEIGHT = 500;
  var MAP_PADDING_X = 8;
  var MAP_PADDING_Y = 8;

  var COUNTRY_CODE_OVERRIDES = {
    'Northern Cyprus': 'CY',
    Somaliland: 'SO',
    Kosovo: 'XK'
  };

  var mapCanvas = document.getElementById('visitor-map-canvas');
  var svg = document.getElementById('visitor-map-svg');
  var tooltip = document.getElementById('visitor-map-tooltip');
  var loading = document.getElementById('visitor-map-loading');
  var status = document.getElementById('visitor-map-status');
  var totalCount = document.getElementById('visitor-total-count');
  var countriesCount = document.getElementById('visitor-countries-count');

  if (!mapCanvas || !svg || !window.fetch) {
    return;
  }

  function fetchJson(url, timeout) {
    var controller = window.AbortController ? new AbortController() : null;
    var timer = controller ? window.setTimeout(function () { controller.abort(); }, timeout || 10000) : null;
    var options = {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    };

    if (controller) {
      options.signal = controller.signal;
    }

    return fetch(url, options).then(function (response) {
      if (!response.ok) {
        var error = new Error('Request failed with status ' + response.status);
        error.status = response.status;
        throw error;
      }
      return response.json();
    }).finally(function () {
      if (timer) {
        window.clearTimeout(timer);
      }
    });
  }

  function counterUrl(action, key) {
    return COUNTER_BASE_URL + action + '/' + encodeURIComponent(COUNTER_PREFIX + key);
  }

  function getCount(key) {
    return fetchJson(counterUrl('get', key), 10000).then(function (data) {
      return Math.max(0, Number(data.value) || 0);
    }).catch(function (error) {
      if (error.status === 404) {
        return 0;
      }
      throw error;
    });
  }

  function hitCount(key) {
    return fetchJson(counterUrl('hit', key), 10000).then(function (data) {
      return Math.max(0, Number(data.value) || 0);
    });
  }

  function countryCounterKey(code) {
    return COUNTRY_COUNTER_PREFIX + String(code || '').toLowerCase();
  }

  function mapWithConcurrency(items, limit, worker) {
    var nextIndex = 0;
    var workers = [];
    var workerCount = Math.min(limit, items.length);

    function runNext() {
      var index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return Promise.resolve();
      }
      return Promise.resolve(worker(items[index], index)).then(runNext);
    }

    while (workers.length < workerCount) {
      workers.push(runNext());
    }
    return Promise.all(workers);
  }

  function loadCounts(countries) {
    var tasks = [{ countKey: 'total', counterKey: 'total' }].concat(countries.map(function (country) {
      return { countKey: country.code, counterKey: countryCounterKey(country.code) };
    }));
    var failures = 0;
    var counts = {};

    return mapWithConcurrency(tasks, MAX_PARALLEL_REQUESTS, function (task) {
      return getCount(task.counterKey).then(function (value) {
        counts[task.countKey] = value;
      }).catch(function () {
        failures += 1;
        counts[task.countKey] = 0;
      });
    }).then(function () {
      return { counts: counts, failures: failures };
    });
  }

  function emptyCounts(countries) {
    var counts = { total: 0 };
    countries.forEach(function (country) {
      counts[country.code] = 0;
    });
    return counts;
  }

  function isCountryCode(value) {
    return /^[A-Z]{2}$/.test(String(value || '').toUpperCase());
  }

  function featureCountryName(feature) {
    var properties = feature && feature.properties ? feature.properties : {};
    return properties.ADMIN || properties.NAME_EN || properties.NAME || properties.name || 'Unknown country';
  }

  function featureCountryCode(feature) {
    var properties = feature && feature.properties ? feature.properties : {};
    var preferred = String(properties.ISO_A2_EH || '').toUpperCase();
    var fallback = String(properties.ISO_A2 || '').toUpperCase();
    var name = featureCountryName(feature);

    if (isCountryCode(preferred)) {
      return preferred;
    }
    if (isCountryCode(fallback)) {
      return fallback;
    }
    return COUNTRY_CODE_OVERRIDES[name] || '';
  }

  function collectCountries(geoJson) {
    var byCode = {};

    (geoJson.features || []).forEach(function (feature) {
      var code = featureCountryCode(feature);
      if (code && !byCode[code]) {
        byCode[code] = { code: code, name: featureCountryName(feature) };
      }
    });

    return {
      list: Object.keys(byCode).sort().map(function (code) { return byCode[code]; }),
      byCode: byCode
    };
  }

  function wasCountedThisSession() {
    try {
      return window.sessionStorage.getItem(SESSION_KEY) === 'yes';
    } catch (error) {
      return false;
    }
  }

  function markSessionCounted() {
    try {
      window.sessionStorage.setItem(SESSION_KEY, 'yes');
    } catch (error) {
      /* The counter still works when storage is disabled. */
    }
  }

  function countryFromLocation(locationData, countriesByCode) {
    var code = String(locationData && locationData.country_code || '').toUpperCase();
    if (!isCountryCode(code)) {
      return null;
    }
    return countriesByCode[code] || {
      code: code,
      name: locationData.country || code
    };
  }

  function recordVisit(locationData, countriesByCode) {
    var changes = {};
    var currentCountry = locationData && locationData.success
      ? countryFromLocation(locationData, countriesByCode)
      : null;

    if (!IS_PRODUCTION) {
      return Promise.resolve({
        changes: changes,
        currentCountry: null,
        message: 'Local preview mode. Visits are counted only on the published GitHub Pages site.'
      });
    }

    if (wasCountedThisSession()) {
      return Promise.resolve({
        changes: changes,
        currentCountry: currentCountry,
        message: currentCountry
          ? 'Current visit: ' + currentCountry.name + ' (already counted in this session).'
          : 'This visit has already been counted, but its country could not be resolved.'
      });
    }

    var tasks = [{ countKey: 'total', counterKey: 'total' }];
    if (currentCountry) {
      tasks.push({ countKey: currentCountry.code, counterKey: countryCounterKey(currentCountry.code) });
    }

    return Promise.allSettled(tasks.map(function (task) {
      return hitCount(task.counterKey).then(function (value) {
        changes[task.countKey] = value;
        return value;
      });
    })).then(function (results) {
      var succeeded = results.some(function (result) { return result.status === 'fulfilled'; });
      if (succeeded) {
        markSessionCounted();
      }

      return {
        changes: changes,
        currentCountry: currentCountry,
        message: currentCountry
          ? 'Current visit: ' + currentCountry.name + '. The country heat has been updated.'
          : 'The visit was counted, but its country could not be resolved.'
      };
    });
  }

  function createSvgElement(name, attributes) {
    var element = document.createElementNS(SVG_NS, name);
    Object.keys(attributes || {}).forEach(function (key) {
      element.setAttribute(key, attributes[key]);
    });
    return element;
  }

  function projectCoordinate(coordinate) {
    var longitude = Math.max(-180, Math.min(180, Number(coordinate[0]) || 0));
    var latitude = Math.max(-90, Math.min(90, Number(coordinate[1]) || 0));
    var width = MAP_WIDTH - MAP_PADDING_X * 2;
    var height = MAP_HEIGHT - MAP_PADDING_Y * 2;
    var x = MAP_PADDING_X + ((longitude + 180) / 360) * width;
    var y = MAP_PADDING_Y + ((90 - latitude) / 180) * height;
    return [x, y];
  }

  function ringToPath(ring) {
    if (!ring || !ring.length) {
      return '';
    }

    return ring.map(function (coordinate, index) {
      var point = projectCoordinate(coordinate);
      return (index === 0 ? 'M' : 'L') + point[0].toFixed(2) + ',' + point[1].toFixed(2);
    }).join('') + 'Z';
  }

  function geometryToPath(geometry) {
    if (!geometry || !geometry.coordinates) {
      return '';
    }

    if (geometry.type === 'Polygon') {
      return geometry.coordinates.map(ringToPath).join('');
    }

    if (geometry.type === 'MultiPolygon') {
      return geometry.coordinates.map(function (polygon) {
        return polygon.map(ringToPath).join('');
      }).join('');
    }

    return '';
  }

  function interpolateColor(start, end, amount) {
    var value = Math.max(0, Math.min(1, amount));
    var result = start.map(function (channel, index) {
      return Math.round(channel + (end[index] - channel) * value);
    });
    return 'rgb(' + result.join(',') + ')';
  }

  function heatColor(count, maximum) {
    if (!count) {
      return '#e5edf4';
    }

    var intensity = maximum > 1 ? Math.log(count + 1) / Math.log(maximum + 1) : 1;
    if (intensity < 0.5) {
      return interpolateColor([253, 230, 138], [245, 158, 11], intensity * 2);
    }
    return interpolateColor([245, 158, 11], [153, 27, 27], (intensity - 0.5) * 2);
  }

  function heatLabel(count, maximum) {
    if (!count) {
      return 'No recorded visits';
    }
    var ratio = maximum ? count / maximum : 0;
    if (ratio >= 0.67) {
      return 'High heat';
    }
    if (ratio >= 0.34) {
      return 'Medium heat';
    }
    return 'Low heat';
  }

  function positionTooltip(clientX, clientY) {
    var bounds = mapCanvas.getBoundingClientRect();
    var left = clientX - bounds.left + 12;
    var top = clientY - bounds.top + 12;
    var tooltipWidth = tooltip.offsetWidth || 170;
    var tooltipHeight = tooltip.offsetHeight || 60;

    left = Math.max(8, Math.min(left, bounds.width - tooltipWidth - 8));
    top = Math.max(8, Math.min(top, bounds.height - tooltipHeight - 8));
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }

  function showTooltip(country, count, maximum, event) {
    tooltip.textContent = country.name + '\nVisits: ' + count + '\n' + heatLabel(count, maximum);
    tooltip.hidden = false;

    if (event && typeof event.clientX === 'number') {
      positionTooltip(event.clientX, event.clientY);
    } else if (event && event.currentTarget) {
      var bounds = event.currentTarget.getBoundingClientRect();
      positionTooltip(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    }
  }

  function hideTooltip() {
    tooltip.hidden = true;
  }

  function renderMap(geoJson, counts, currentCountry, countries) {
    var title = svg.querySelector('title');
    var description = svg.querySelector('desc');
    var maximum = Math.max.apply(Math, countries.map(function (country) {
      return counts[country.code] || 0;
    }).concat([1]));

    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }
    if (title) {
      svg.appendChild(title);
    }
    if (description) {
      svg.appendChild(description);
    }

    geoJson.features.forEach(function (feature) {
      var code = featureCountryCode(feature);
      var pathData = geometryToPath(feature.geometry);
      if (!code || !pathData) {
        return;
      }

      var country = { code: code, name: featureCountryName(feature) };
      var count = counts[code] || 0;
      var isCurrent = currentCountry && currentCountry.code === code;
      var path = createSvgElement('path', {
        d: pathData,
        'class': 'visitor-map__country' + (isCurrent ? ' visitor-map__country--current' : ''),
        fill: heatColor(count, maximum),
        'data-country': code.toLowerCase(),
        tabindex: '0',
        role: 'button',
        'aria-label': country.name + ', ' + count + ' visits',
        'fill-rule': 'evenodd',
        'vector-effect': 'non-scaling-stroke'
      });
      var nativeTitle = createSvgElement('title');
      nativeTitle.textContent = country.name + ': ' + count + ' visits';
      path.appendChild(nativeTitle);

      path.addEventListener('pointerenter', function (event) { showTooltip(country, count, maximum, event); });
      path.addEventListener('pointermove', function (event) { positionTooltip(event.clientX, event.clientY); });
      path.addEventListener('pointerleave', hideTooltip);
      path.addEventListener('focus', function (event) { showTooltip(country, count, maximum, event); });
      path.addEventListener('blur', hideTooltip);
      svg.appendChild(path);
    });

    mapCanvas.classList.add('visitor-map__canvas--loaded');
    loading.hidden = true;
  }

  function renderError(message) {
    loading.hidden = true;
    svg.hidden = true;
    var error = document.createElement('p');
    error.className = 'visitor-map__error';
    error.textContent = message;
    mapCanvas.appendChild(error);
  }

  function updateSummary(counts, countries) {
    var reached = countries.filter(function (country) {
      return (counts[country.code] || 0) > 0;
    }).length;
    totalCount.textContent = String(counts.total || 0);
    countriesCount.textContent = String(reached);
  }

  fetchJson(MAP_DATA_URL, 12000).then(function (geoJson) {
    if (!geoJson || !Array.isArray(geoJson.features) || !geoJson.features.length) {
      throw new Error('The world map data is invalid.');
    }

    var countries = collectCountries(geoJson);
    var initialCounts = emptyCounts(countries.list);
    renderMap(geoJson, initialCounts, null, countries.list);
    status.textContent = IS_PRODUCTION
      ? 'Loading anonymous country visit counts…'
      : 'Local preview mode. Visits are counted only on the published GitHub Pages site.';

    var locationPromise = IS_PRODUCTION
      ? fetchJson(GEOLOCATION_URL, 9000)
      : Promise.resolve({ success: false });
    var countsPromise = IS_PRODUCTION
      ? loadCounts(countries.list)
      : Promise.resolve({ counts: initialCounts, failures: 0 });
    var visitPromise = locationPromise.then(function (locationData) {
      return recordVisit(locationData, countries.byCode);
    }).catch(function () {
      return {
        changes: {},
        currentCountry: null,
        message: 'The map loaded, but the current visit could not be assigned to a country.'
      };
    });

    return Promise.allSettled([countsPromise, visitPromise]).then(function (results) {
      var countResult = results[0].status === 'fulfilled'
        ? results[0].value
        : { counts: initialCounts, failures: countries.list.length + 1 };
      var visitResult = results[1].status === 'fulfilled'
        ? results[1].value
        : { changes: {}, currentCountry: null, message: 'Visitor location is temporarily unavailable.' };
      var counts = countResult.counts;

      Object.keys(visitResult.changes).forEach(function (key) {
        counts[key] = visitResult.changes[key];
      });

      renderMap(geoJson, counts, visitResult.currentCountry, countries.list);
      updateSummary(counts, countries.list);
      status.textContent = visitResult.message;

      if (countResult.failures > 0) {
        status.textContent += ' Some historical country counters could not be read.';
        status.classList.add('visitor-map__note--error');
      }
    });
  }).catch(function () {
    renderError('World map data is temporarily unavailable. Please refresh later.');
    status.textContent = 'Visitor counting is available, but the world map outline could not be loaded.';
    status.classList.add('visitor-map__note--error');
  });
}());
