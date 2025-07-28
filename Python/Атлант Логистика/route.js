/**
 * optimizeRoute.gs
 *
 * Google Apps Script function to compute the shortest round-trip route that
 * starts and ends at the first address (depot) and visits every other address
 * exactly once (Travelling Salesman Problem, n ≤ 10).
 *
 * The script uses ONLY free Yandex services:
 *   • Yandex Geocoder API – converts addresses to coordinates
 *   • Yandex Distance Matrix API – returns driving time & distance matrix
 * A Held-Karp (dynamic-programming) algorithm solves the TSP in seconds for
 * ≤ 10 locations.
 *
 * ⚠️  IMPORTANT:  Replace the placeholder string in `API_KEY` with your actual
 *                Yandex API key that has BOTH Geocoder and Distance Matrix
 *                access enabled.
 *
 * @param {string[]} addresses – Array of addresses in Russia. Element 0 is the
 *                               depot (start & end).
 * @returns {Object} {
 *            orderedAddresses – addresses in optimal visiting order (closed loop)
 *            totalDistance    – total driving distance (km)
 *            totalTime        – total driving time (human-readable)
 *            yandexRouteLink  – URL that opens the route in Yandex Maps
 *          }
 *
 * Usage example (in your Google Sheet or Apps Script editor):
 *   var stops = [
 *       "ул. Тверская, 1, Москва",
 *       "Красная пл., 3, Москва",
 *       "ул. Арбат, 12, Москва",
 *       "Ленинградский просп., 37, Москва"
 *   ];
 *   var result = optimizeRoute(stops);
 *   Logger.log(JSON.stringify(result, null, 2));
 */
function optimizeRoute(addresses) {
    var API_KEY = '7726ddb0-76da-4747-8007-d84dfe2fb93f';               //  ← PUT YOUR API KEY HERE
    if (!API_KEY || API_KEY === 'YOUR_YANDEX_API_KEY') {
      throw new Error('Please set your Yandex API key in the API_KEY variable.');
    }
  
    if (!addresses || addresses.length < 2) {
      throw new Error('Need at least two addresses (depot + one stop).');
    }
  
    /*************** 1. GEOCODE ALL ADDRESSES *****************/
    var coords = addresses.map(function (addr) {
      return geocodeAddress(addr, API_KEY);            // {lat, lon}
    });
  
    /*************** 2. BUILD DISTANCE / TIME MATRIX **********/
    var matrix = fetchDistanceMatrix(coords, API_KEY); // {time[][], distance[][]}
  
    /*************** 3. SOLVE TSP (Held-Karp DP) **************/
    var tsp = solveTSP(matrix.time);                   // {cost, path[]}
    var routeIdx = tsp.path;                           // e.g. [0,2,3,1,0]
    var orderedAddresses = routeIdx.map(function (i) { return addresses[i]; });
  
    /*************** 4. SUM TOTAL TIME & DISTANCE *************/
    var totalTimeSec = 0, totalDistM = 0;
    for (var i = 0; i < routeIdx.length - 1; i++) {
      totalTimeSec += matrix.time[routeIdx[i]][routeIdx[i + 1]];
      totalDistM   += matrix.distance[routeIdx[i]][routeIdx[i + 1]];
    }
    var totalDistKm = (totalDistM / 1000).toFixed(1);
  
    /*************** 5. CONSTRUCT YANDEX ROUTE LINK ***********/
    var coordsForLink = routeIdx.map(function (i) {
      var c = coords[i];
      return c.lat + ',' + c.lon;                      // lat,lon (Yandex format)
    }).join('~');
    // Ensure loop ends at depot
    if (routeIdx[routeIdx.length - 1] !== 0) {
      coordsForLink += '~' + coords[0].lat + ',' + coords[0].lon;
    }
    var yandexRouteLink = 'https://yandex.ru/maps/?rtext=' +
                          encodeURIComponent(coordsForLink) + '&rtt=auto';
  
    /*************** 6. RETURN RESULT *************************/
    return {
      orderedAddresses: orderedAddresses,
      totalDistance:    totalDistKm + ' km',
      totalTime:        formatDuration(totalTimeSec),
      yandexRouteLink:  yandexRouteLink
    };
  }
  
  /********************* HELPER FUNCTIONS ************************/
  /**
   * Geocode a single address using Yandex Geocoder API.
   * @param {string} address
   * @param {string} apiKey
   * @returns {{lat:number, lon:number}}
   */
  function geocodeAddress(address, apiKey) {
    var url = 'https://geocode-maps.yandex.ru/1.x/?format=json&apikey=' + apiKey +
              '&geocode=' + encodeURIComponent(address);
    var resp = UrlFetchApp.fetch(url);
    var data = JSON.parse(resp.getContentText());
    try {
      var pos = data.response.GeoObjectCollection.featureMember[0].GeoObject.Point.pos;
      var parts = pos.split(' ');                       // "lon lat"
      return { lat: parseFloat(parts[1]), lon: parseFloat(parts[0]) };
    } catch (e) {
      throw new Error('Failed to geocode address: ' + address);
    }
  }
  
  /**
   * Retrieve full NxN duration & distance matrix from Yandex Distance Matrix API.
   * @param {{lat:number, lon:number}[]} coords
   * @param {string} apiKey
   * @returns {{time:number[][], distance:number[][]}} // seconds & meters
   */
  function fetchDistanceMatrix(coords, apiKey) {
    var points = coords.map(function (c) {
      return { point: { latitude: c.lat, longitude: c.lon } };
    });
  
    var payload = {
      origins:      points,
      destinations: points,
      type:         'auto',      // driving
      routing_mode: 'fast'
    };
  
    var options = {
      method:           'post',
      contentType:      'application/json',
      payload:          JSON.stringify(payload),
      muteHttpExceptions: true,
      headers:          { 'Authorization': 'Api-Key ' + apiKey }
    };
  
    var url = 'https://api.routing.yandex.net/v2/distancematrix';
    var resp = UrlFetchApp.fetch(url, options);
    var data = JSON.parse(resp.getContentText());
  
    if (!data.rows) {
      throw new Error('Distance Matrix API error: ' + resp.getContentText());
    }
  
    var n = coords.length;
    var time = new Array(n);
    var dist = new Array(n);
    for (var i = 0; i < n; i++) {
      time[i] = new Array(n);
      dist[i] = new Array(n);
      for (var j = 0; j < n; j++) {
        var el = data.rows[i].elements[j];
        if (el.status !== 'OK') {
          throw new Error('Matrix element error between #' + i + ' and #' + j);
        }
        time[i][j] = el.duration.value;     // seconds
        dist[i][j] = el.distance.value;     // meters
      }
    }
    return { time: time, distance: dist };
  }
  
  /**
   * Solve the Travelling Salesman Problem using Held-Karp DP.
   * @param {number[][]} timeMatrix – square matrix (seconds)
   * @returns {{cost:number, path:number[]}} – minimal cost & visiting order (closed loop)
   */
  function solveTSP(timeMatrix) {
    var n = timeMatrix.length;
    var START = 0;
    var SIZE = 1 << n;
    var INF = Number.POSITIVE_INFINITY;
  
    // dp[mask][v] – min cost reaching subset "mask" ending at v
    var dp = Array.from({ length: SIZE }, function () {
      return Array(n).fill(INF);
    });
    var parent = Array.from({ length: SIZE }, function () {
      return Array(n).fill(-1);
    });
  
    dp[1 << START][START] = 0;
  
    for (var mask = 0; mask < SIZE; mask++) {
      for (var last = 0; last < n; last++) {
        if (!(mask & (1 << last))) continue;           // last not in subset
        var currCost = dp[mask][last];
        if (currCost === INF) continue;
  
        for (var next = 0; next < n; next++) {
          if (mask & (1 << next)) continue;            // already visited
          var newMask = mask | (1 << next);
          var newCost = currCost + timeMatrix[last][next];
          if (newCost < dp[newMask][next]) {
            dp[newMask][next] = newCost;
            parent[newMask][next] = last;
          }
        }
      }
    }
  
    // Close the loop back to START
    var full = SIZE - 1;
    var best = INF, lastNode = -1;
    for (var v = 0; v < n; v++) {
      if (v === START) continue;
      var cost = dp[full][v] + timeMatrix[v][START];
      if (cost < best) {
        best = cost;
        lastNode = v;
      }
    }
  
    // Reconstruct path (in reverse)
    var path = [START];
    var mask = full;
    var curr = lastNode;
    while (curr !== START) {
      path.push(curr);
      var prev = parent[mask][curr];
      mask &= ~(1 << curr);
      curr = prev;
    }
    path.push(START);          // close loop
    path.reverse();            // now START → … → START
  
    return { cost: best, path: path };
  }
  
  /**
   * Convert seconds → human-readable, e.g. "2 h 37 min".
   * @param {number} sec
   */
  function formatDuration(sec) {
    var h = Math.floor(sec / 3600);
    var m = Math.round((sec % 3600) / 60);
    return (h ? h + ' h ' : '') + m + ' min';
  }

  // ... здесь заканчивается код функции formatDuration ...

function OPTIMIZE(range) {
    if (!range) {
      return "Укажите диапазон с адресами, например, A2:A10";
    }
    // Преобразуем данные из таблицы в простой массив
    var addresses = range.map(function(row) { return row[0]; }).filter(Boolean);
  
    if (addresses.length < 2) {
      return "Нужно как минимум 2 адреса.";
    }
    try {
      // Вызываем нашу основную логику
      var result = optimizeRoute(addresses);
      
      // Форматируем красивый вывод для таблицы
      var output = [
        ["Общее расстояние:", result.totalDistance],
        ["Общее время:", result.totalTime],
        ["Ссылка на маршрут:", result.yandexRouteLink],
        ["---Оптимальный порядок---"],
      ];
      return output.concat(result.orderedAddresses.map(function(addr){return [addr]}));
    } catch (e) {
      return "Ошибка: " + e.message;
    }
  }