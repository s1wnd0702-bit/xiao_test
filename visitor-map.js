(function () {
  'use strict';

  var MAP_DATA_URL = 'china-provinces.json';
  var GEOLOCATION_URL = 'https://ipwho.is/';
  var COUNTER_BASE_URL = 'https://countapi.mileshilliard.com/api/v1/';
  var COUNTER_PREFIX = 's1wnd0702-bit-xiao-test-visitor-';
  var SESSION_KEY = 'xiao-test-visitor-counted-v2';
  var IS_PRODUCTION = /(^|\.)s1wnd0702-bit\.github\.io$/i.test(window.location.hostname);
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var PROVINCES = [
    { slug: 'beijing', name: '北京市', english: 'Beijing', aliases: ['beijing'] },
    { slug: 'tianjin', name: '天津市', english: 'Tianjin', aliases: ['tianjin'] },
    { slug: 'hebei', name: '河北省', english: 'Hebei', aliases: ['hebei'] },
    { slug: 'shanxi', name: '山西省', english: 'Shanxi', aliases: ['shanxi'] },
    { slug: 'inner-mongolia', name: '内蒙古自治区', english: 'Inner Mongolia', aliases: ['inner mongolia', 'neimenggu'] },
    { slug: 'liaoning', name: '辽宁省', english: 'Liaoning', aliases: ['liaoning'] },
    { slug: 'jilin', name: '吉林省', english: 'Jilin', aliases: ['jilin'] },
    { slug: 'heilongjiang', name: '黑龙江省', english: 'Heilongjiang', aliases: ['heilongjiang'] },
    { slug: 'shanghai', name: '上海市', english: 'Shanghai', aliases: ['shanghai'] },
    { slug: 'jiangsu', name: '江苏省', english: 'Jiangsu', aliases: ['jiangsu'] },
    { slug: 'zhejiang', name: '浙江省', english: 'Zhejiang', aliases: ['zhejiang'] },
    { slug: 'anhui', name: '安徽省', english: 'Anhui', aliases: ['anhui'] },
    { slug: 'fujian', name: '福建省', english: 'Fujian', aliases: ['fujian'] },
    { slug: 'jiangxi', name: '江西省', english: 'Jiangxi', aliases: ['jiangxi'] },
    { slug: 'shandong', name: '山东省', english: 'Shandong', aliases: ['shandong'] },
    { slug: 'henan', name: '河南省', english: 'Henan', aliases: ['henan'] },
    { slug: 'hubei', name: '湖北省', english: 'Hubei', aliases: ['hubei'] },
    { slug: 'hunan', name: '湖南省', english: 'Hunan', aliases: ['hunan'] },
    { slug: 'guangdong', name: '广东省', english: 'Guangdong', aliases: ['guangdong'] },
    { slug: 'guangxi', name: '广西壮族自治区', english: 'Guangxi', aliases: ['guangxi'] },
    { slug: 'hainan', name: '海南省', english: 'Hainan', aliases: ['hainan'] },
    { slug: 'chongqing', name: '重庆市', english: 'Chongqing', aliases: ['chongqing'] },
    { slug: 'sichuan', name: '四川省', english: 'Sichuan', aliases: ['sichuan'] },
    { slug: 'guizhou', name: '贵州省', english: 'Guizhou', aliases: ['guizhou'] },
    { slug: 'yunnan', name: '云南省', english: 'Yunnan', aliases: ['yunnan'] },
    { slug: 'tibet', name: '西藏自治区', english: 'Tibet', aliases: ['tibet', 'xizang', 'tibet autonomous region'] },
    { slug: 'shaanxi', name: '陕西省', english: 'Shaanxi', aliases: ['shaanxi'] },
    { slug: 'gansu', name: '甘肃省', english: 'Gansu', aliases: ['gansu'] },
    { slug: 'qinghai', name: '青海省', english: 'Qinghai', aliases: ['qinghai'] },
    { slug: 'ningxia', name: '宁夏回族自治区', english: 'Ningxia', aliases: ['ningxia'] },
    { slug: 'xinjiang', name: '新疆维吾尔自治区', english: 'Xinjiang', aliases: ['xinjiang'] },
    { slug: 'taiwan', name: '台湾省', english: 'Taiwan', aliases: ['taiwan'] },
    { slug: 'hong-kong', name: '香港特别行政区', english: 'Hong Kong', aliases: ['hong kong'] },
    { slug: 'macau', name: '澳门特别行政区', english: 'Macau', aliases: ['macau', 'macao'] }
  ];
  var REGION_CODE_TO_SLUG = {
    BJ: 'beijing', TJ: 'tianjin', HE: 'hebei', SX: 'shanxi', NM: 'inner-mongolia',
    LN: 'liaoning', JL: 'jilin', HL: 'heilongjiang', SH: 'shanghai', JS: 'jiangsu',
    ZJ: 'zhejiang', AH: 'anhui', FJ: 'fujian', JX: 'jiangxi', SD: 'shandong',
    HA: 'henan', HB: 'hubei', HN: 'hunan', GD: 'guangdong', GX: 'guangxi',
    HI: 'hainan', CQ: 'chongqing', SC: 'sichuan', GZ: 'guizhou', YN: 'yunnan',
    XZ: 'tibet', SN: 'shaanxi', GS: 'gansu', QH: 'qinghai', NX: 'ningxia',
    XJ: 'xinjiang', TW: 'taiwan', HK: 'hong-kong', MO: 'macau'
  };

  var mapCanvas = document.getElementById('visitor-map-canvas');
  var svg = document.getElementById('visitor-map-svg');
  var tooltip = document.getElementById('visitor-map-tooltip');
  var loading = document.getElementById('visitor-map-loading');
  var status = document.getElementById('visitor-map-status');
  var totalCount = document.getElementById('visitor-total-count');
  var overseasCount = document.getElementById('visitor-overseas-count');

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

  function loadCounts() {
    var keys = PROVINCES.map(function (province) { return province.slug; }).concat(['total', 'overseas']);
    var failures = 0;
    var counts = {};

    return Promise.all(keys.map(function (key) {
      return getCount(key).then(function (value) {
        counts[key] = value;
      }).catch(function () {
        failures += 1;
        counts[key] = 0;
      });
    })).then(function () {
      return { counts: counts, failures: failures };
    });
  }

  function emptyCounts() {
    var counts = { total: 0, overseas: 0 };
    PROVINCES.forEach(function (province) {
      counts[province.slug] = 0;
    });
    return counts;
  }

  function normalizeRegion(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/province|autonomous region|municipality|special administrative region/g, '')
      .replace(/[^a-z]+/g, ' ')
      .trim();
  }

  function findProvince(region, regionCode) {
    var normalized = normalizeRegion(region);
    var match = null;

    PROVINCES.some(function (province) {
      if (province.aliases.some(function (alias) { return normalizeRegion(alias) === normalized; })) {
        match = province;
        return true;
      }
      return false;
    });

    if (!match && regionCode && REGION_CODE_TO_SLUG[String(regionCode).toUpperCase()]) {
      var slug = REGION_CODE_TO_SLUG[String(regionCode).toUpperCase()];
      match = PROVINCES.filter(function (province) { return province.slug === slug; })[0] || null;
    }

    return match;
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

  function recordVisit(locationData) {
    var changes = {};
    var isChina = locationData && locationData.success && locationData.country_code === 'CN';
    var currentProvince = isChina ? findProvince(locationData.region, locationData.region_code) : null;
    var countryLabel = locationData && locationData.country ? locationData.country : 'Unknown region';

    if (!IS_PRODUCTION) {
      return Promise.resolve({
        changes: changes,
        currentProvince: currentProvince,
        message: currentProvince
          ? 'Preview location: ' + currentProvince.english + ' / ' + currentProvince.name + '. Local previews are not counted.'
          : 'Local preview mode. Visits are counted only on the published GitHub Pages site.'
      });
    }

    if (wasCountedThisSession()) {
      return Promise.resolve({
        changes: changes,
        currentProvince: currentProvince,
        message: currentProvince
          ? 'Current visit: ' + currentProvince.english + ' / ' + currentProvince.name + ' (already counted in this session).'
          : 'Current visit: ' + countryLabel + ' (already counted in this session).'
      });
    }

    var keys = ['total'];
    if (currentProvince) {
      keys.push(currentProvince.slug);
    } else if (!isChina) {
      keys.push('overseas');
    }

    return Promise.allSettled(keys.map(function (key) {
      return hitCount(key).then(function (value) {
        changes[key] = value;
        return value;
      });
    })).then(function (results) {
      var succeeded = results.some(function (result) { return result.status === 'fulfilled'; });
      if (succeeded) {
        markSessionCounted();
      }

      if (currentProvince) {
        return {
          changes: changes,
          currentProvince: currentProvince,
          message: 'Current visit: ' + currentProvince.english + ' / ' + currentProvince.name + '. The province heat has been updated.'
        };
      }

      return {
        changes: changes,
        currentProvince: null,
        message: isChina
          ? 'Current visit is in China, but the province could not be resolved.'
          : 'Current visit: ' + countryLabel + '. Included in the overseas total.'
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
    var minLongitude = 73;
    var maxLongitude = 135.5;
    var minLatitude = 17.5;
    var maxLatitude = 53.8;
    var paddingX = 28;
    var paddingY = 20;
    var width = 720 - paddingX * 2;
    var height = 470 - paddingY * 2;
    var x = paddingX + ((coordinate[0] - minLongitude) / (maxLongitude - minLongitude)) * width;
    var y = paddingY + ((maxLatitude - coordinate[1]) / (maxLatitude - minLatitude)) * height;
    return [x, y];
  }

  function ringToPath(ring) {
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
      return '#e8f0f7';
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

  function showTooltip(province, count, maximum, event) {
    tooltip.textContent = province.english + ' / ' + province.name + '\nVisits: ' + count + '\n' + heatLabel(count, maximum);
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

  function renderMap(geoJson, counts, currentProvince) {
    var title = svg.querySelector('title');
    var description = svg.querySelector('desc');
    var provinceByName = {};
    var maximum = Math.max.apply(Math, PROVINCES.map(function (province) { return counts[province.slug] || 0; }).concat([1]));
    var markerLayer = createSvgElement('g', { 'class': 'visitor-map__markers', 'aria-hidden': 'true' });

    PROVINCES.forEach(function (province) {
      provinceByName[province.name] = province;
    });

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
      var province = provinceByName[feature.properties && feature.properties.name];
      var pathData = geometryToPath(feature.geometry);
      if (!province || !pathData) {
        return;
      }

      var count = counts[province.slug] || 0;
      var path = createSvgElement('path', {
        d: pathData,
        'class': 'visitor-map__province',
        fill: heatColor(count, maximum),
        'data-province': province.slug,
        tabindex: '0',
        role: 'button',
        'aria-label': province.english + ', ' + count + ' visits',
        'fill-rule': 'evenodd',
        'vector-effect': 'non-scaling-stroke'
      });
      var nativeTitle = createSvgElement('title');
      nativeTitle.textContent = province.english + ' / ' + province.name + ': ' + count + ' visits';
      path.appendChild(nativeTitle);

      path.addEventListener('pointerenter', function (event) { showTooltip(province, count, maximum, event); });
      path.addEventListener('pointermove', function (event) { positionTooltip(event.clientX, event.clientY); });
      path.addEventListener('pointerleave', hideTooltip);
      path.addEventListener('focus', function (event) { showTooltip(province, count, maximum, event); });
      path.addEventListener('blur', hideTooltip);
      svg.appendChild(path);

      if (count > 0 && feature.properties && (feature.properties.centroid || feature.properties.center)) {
        var center = projectCoordinate(feature.properties.centroid || feature.properties.center);
        var marker = createSvgElement('circle', {
          cx: center[0].toFixed(2),
          cy: center[1].toFixed(2),
          r: String(Math.min(9, 3.5 + Math.log(count + 1) * 1.5)),
          'class': 'visitor-map__marker' + (currentProvince && currentProvince.slug === province.slug ? ' visitor-map__marker--current' : '')
        });
        markerLayer.appendChild(marker);
      }
    });

    svg.appendChild(markerLayer);
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

  function updateSummary(counts) {
    totalCount.textContent = String(counts.total || 0);
    overseasCount.textContent = String(counts.overseas || 0);
  }

  var locationPromise = IS_PRODUCTION
    ? fetchJson(GEOLOCATION_URL, 9000)
    : Promise.resolve({ success: false });
  var countsPromise = IS_PRODUCTION
    ? loadCounts()
    : Promise.resolve({ counts: emptyCounts(), failures: 0 });
  var visitPromise = locationPromise.then(recordVisit).catch(function () {
    return {
      changes: {},
      currentProvince: null,
      message: 'The map loaded, but the current visit could not be assigned to a province.'
    };
  });

  Promise.allSettled([
    fetchJson(MAP_DATA_URL, 12000),
    countsPromise,
    visitPromise
  ]).then(function (results) {
    if (results[0].status !== 'fulfilled') {
      renderError('Province map data is temporarily unavailable. Please refresh later.');
      status.textContent = 'Visitor counting is available, but the map outline could not be loaded.';
      status.classList.add('visitor-map__note--error');
      return;
    }

    var countResult = results[1].status === 'fulfilled' ? results[1].value : { counts: {}, failures: PROVINCES.length + 2 };
    var visitResult = results[2].status === 'fulfilled' ? results[2].value : { changes: {}, currentProvince: null, message: 'Visitor location is temporarily unavailable.' };
    var counts = countResult.counts;

    Object.keys(visitResult.changes).forEach(function (key) {
      counts[key] = visitResult.changes[key];
    });

    renderMap(results[0].value, counts, visitResult.currentProvince);
    updateSummary(counts);
    status.textContent = visitResult.message;

    if (countResult.failures > 0) {
      status.textContent += ' Some historical counters could not be read.';
      status.classList.add('visitor-map__note--error');
    }
  }).catch(function () {
    renderError('The visitor heatmap is temporarily unavailable. Please refresh later.');
    status.textContent = 'No visitor IP address has been stored by this page.';
    status.classList.add('visitor-map__note--error');
  });
}());
