/**
 * @OnlyCurrentDoc
 *
 * Скрипт для построения оптимального маршрута водителя (решение "задачи коммивояжера")
 * с использованием API Яндекс.Карт.
 *
 * Пользователь выделяет ячейки с адресами в Google Таблице, запускает скрипт из меню,
 * и получает оптимальный порядок адресов, общее время и расстояние, а также
 * ссылку на построенный маршрут в Яндекс.Картах.
 */

// ВАЖНО: Замените на ваш собственный ключ API, полученный в кабинете разработчика Яндекс.
const API_KEY = "7726ddb0-76da-4747-8007-d84dfe2fb93f";
const GEOCODER_URL = "https://geocode-maps.yandex.ru/1.x/";
// const DISTANCE_MATRIX_URL = "https://api.routing.yandex.net/v2/distancematrix"; // Удаляем, т.к. Матрица Яндекса платная

/**
 * Создает кастомное меню в интерфейсе Google Таблиц при открытии документа.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚚 Маршруты')
    .addItem('Построить оптимальный маршрут', 'thisistheway_wrapper')
    .addToUi();
}

/**
 * Функция-обертка. Показывает HTML-диалог.
 */
function thisistheway_wrapper() {
  const htmlOutput = HtmlService.createHtmlOutputFromFile('dialog.html')
      .setWidth(400)
      .setHeight(450);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Расчет маршрута');
}

/**
 * Выполняет всю основную логику: читает данные из таблицы, вызывает API
 * и возвращает результат для HTML-сервиса.
 * Эта функция вызывается из JavaScript в файле dialog.html
 * @returns {object} Результат для отображения.
 */
function calculateAndGetRoute() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const range = sheet.getActiveRange();
    
    if (!range) {
      throw new Error('Пожалуйста, сначала выделите ячейки с адресами.');
    }

    if (range.getWidth() !== 1) {
      throw new Error('Пожалуйста, выберите адреса в одном столбце.');
    }

    const addressValues = range.getValues();
    const firstRow = range.getRow();
    const coordsCol = range.getColumn() + 1;

    const addresses = [];
    const coords = [];

    for (let i = 0; i < addressValues.length; i++) {
        const address = String(addressValues[i][0]).trim();
        if (address === '') continue; // Пропускаем пустые строки в выделении

        const coordCell = sheet.getRange(firstRow + i, coordsCol);
        let coordValue = String(coordCell.getValue()).trim();

        if (coordValue !== '') {
            coords.push(coordValue);
            addresses.push(address);
        } else {
            Logger.log(`Координат для "${address}" нет, запрашиваем API...`);
            try {
                const newCoord = getSingleCoordinateFromYandex(address);
                coordCell.setValue(newCoord);
                coords.push(newCoord);
                addresses.push(address);
            } catch (e) {
                throw new Error(`Не удалось получить координаты для адреса "${address}". Подробности: ${e.message}`);
            }
        }
    }
    
    SpreadsheetApp.flush(); // Принудительно сохраняем все изменения в таблице

    if (addresses.length < 2) {
      throw new Error('Для построения маршрута нужно как минимум 2 адреса.');
    }
    
    if (addresses.length > 10) {
      Logger.log(`Внимание: Расчет для ${addresses.length} адресов может занять много времени.`);
    }

    // Передаем собранные данные в основную функцию расчета
    return thisistheway(addresses, coords);

  } catch (e) {
    Logger.log(e.stack);
    // Передаем ошибку на сторону клиента, чтобы она отобразилась в диалоге
    throw new Error(e.message);
  }
}


/**
 * Основная функция для нахождения оптимального маршрута.
 * @param {string[]} addresses Массив адресов. Первый элемент - точка старта и финиша.
 * @param {string[]} coords Готовый массив координат для этих адресов.
 * @returns {{orderedAddresses: string[], totalDistance: object, totalDuration: object, yandexMapsUrl: string}}
 */
function thisistheway(addresses, coords) {
  // 1. Получение координат теперь происходит в функции calculateAndGetRoute.

  // 2. Получаем матрицу времени и расстояний, используя бесплатный сервис Google Maps.
  const matrixData = getDistanceMatrixFromGoogle(coords);

  // 3. Решаем задачу коммивояжера (находим кратчайший путь).
  const routeResult = solveTsp(matrixData.duration, matrixData.distance);
  
  // 4. Формируем итоговый результат.
  const startAddress = addresses[0];
  const orderedAddresses = [startAddress];
  routeResult.path.forEach(index => {
    orderedAddresses.push(addresses[index]);
  });
  orderedAddresses.push(startAddress); // Добавляем точку старта в конец, т.к. нужно вернуться.
  
  const yandexMapsUrl = 'https://yandex.ru/maps/?rtext=' + orderedAddresses.map(encodeURIComponent).join('~') + '&rtt=auto';

  return {
    orderedAddresses: orderedAddresses,
    totalDistance: formatDistance(routeResult.distance),
    totalDuration: formatDuration(routeResult.duration),
    yandexMapsUrl: yandexMapsUrl,
  };
}


/**
 * Преобразует ОДИН адрес в географические координаты (долгота широта) через Яндекс.Геокодер.
 * @param {string} address Адрес для геокодирования.
 * @returns {string} Координаты в формате "долгота широта".
 * @throws {Error} Если не удалось найти координаты.
 */
function getSingleCoordinateFromYandex(address) {
    const params = {
      'apikey': API_KEY,
      'geocode': address,
      'format': 'json',
      'results': 1
    };
    const url = GEOCODER_URL + '?' + Object.keys(params).map(key => `${key}=${encodeURIComponent(params[key])}`).join('&');
    const response = UrlFetchApp.fetch(url, {'muteHttpExceptions': true});
    const json = JSON.parse(response.getContentText());

    if (response.getResponseCode() !== 200 || !json.response.GeoObjectCollection.featureMember.length) {
      throw new Error(`Не удалось найти координаты для адреса: "${address}". Проверьте правильность написания.`);
    }

    // Яндекс возвращает строку "долгота широта"
    const point = json.response.GeoObjectCollection.featureMember[0].GeoObject.Point.pos;
    return point;
}


/**
 * Получает матрицу расстояний и времени в пути, используя встроенный сервис Google Maps.
 * @param {string[]} coords Массив координат в формате "долгота широта" (из Яндекс.Геокодера).
 * @returns {{distance: number[][], duration: number[][]}} Матрицы расстояний (в метрах) и времени (в секундах).
 */
function getDistanceMatrixFromGoogle(coords) {
  const n = coords.length;
  const distanceMatrix = Array(n).fill(0).map(() => Array(n).fill(Infinity));
  const durationMatrix = Array(n).fill(0).map(() => Array(n).fill(Infinity));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        distanceMatrix[i][j] = 0;
        durationMatrix[i][j] = 0;
        continue;
      }
      
      // Координаты от Яндекс.Геокодера идут в формате "долгота широта" (через пробел).
      // Сервис Google Maps ожидает "широта,долгота" (через запятую). Меняем их местами.
      const origin = coords[i].split(' ').reverse().join(',');
      const destination = coords[j].split(' ').reverse().join(',');

      try {
        // Добавляем небольшую паузу, чтобы не превысить квоты Google на частоту запросов.
        Utilities.sleep(100); 
        
        const directions = Maps.newDirectionFinder()
          .setOrigin(origin)
          .setDestination(destination)
          .setMode(Maps.DirectionFinder.Mode.DRIVING)
          .getDirections();

        if (directions && directions.routes && directions.routes.length > 0) {
          const leg = directions.routes[0].legs[0];
          if (leg) {
            const distanceValue = leg.distance.value; // метры
            const durationValue = leg.duration.value; // секунды

            distanceMatrix[i][j] = distanceValue;
            durationMatrix[i][j] = durationValue;
          }
        } else {
             Logger.log(`[Google] Не удалось построить маршрут между точками ${i} (${origin}) и ${j} (${destination}).`);
        }
      } catch (e) {
        Logger.log(`[Google] Ошибка при построении маршрута между ${i} и ${j}: ${e.toString()}`);
        // Оставляем Infinity в матрице, чтобы показать, что путь не найден.
      }
    }
  }
  
  return { distance: distanceMatrix, duration: durationMatrix };
}


/**
 * Решает задачу коммивояжера методом полного перебора всех перестановок.
 * @param {number[][]} timeMatrix Матрица времени в пути.
 * @param {number[][]} distanceMatrix Матрица расстояний.
 * @returns {{path: number[], duration: number, distance: number}} Оптимальный путь и его характеристики.
 */
function solveTsp(timeMatrix, distanceMatrix) {
  const n = timeMatrix.length;
  const waypointIndices = Array.from({length: n - 1}, (_, i) => i + 1);

  if (n <= 2) { // Если только старт и одна точка
     const path = n > 1 ? [1] : [];
     const duration = n > 1 ? timeMatrix[0][1] + timeMatrix[1][0] : 0;
     const distance = n > 1 ? distanceMatrix[0][1] + distanceMatrix[1][0] : 0;
     return { path, duration, distance };
  }

  const permutations = getPermutations(waypointIndices);
  
  let bestPath = [];
  let minDuration = Infinity;

  for (const p of permutations) {
    let currentDuration = timeMatrix[0][p[0]]; // От старта (0) до первого пункта
    
    for (let i = 0; i < p.length - 1; i++) {
      currentDuration += timeMatrix[p[i]][p[i+1]];
    }
    
    currentDuration += timeMatrix[p[p.length - 1]][0]; // От последнего пункта до старта (0)

    if (currentDuration < minDuration) {
      minDuration = currentDuration;
      bestPath = p;
    }
  }

  // Рассчитываем итоговую дистанцию для лучшего маршрута по времени
  let bestDistance = distanceMatrix[0][bestPath[0]];
  for (let i = 0; i < bestPath.length - 1; i++) {
    bestDistance += distanceMatrix[bestPath[i]][bestPath[i+1]];
  }
  bestDistance += distanceMatrix[bestPath[bestPath.length - 1]][0];

  if (minDuration === Infinity) {
    throw new Error("Невозможно построить маршрут. Возможно, одна из точек недостижима для автомобиля.");
  }
  
  return { path: bestPath, duration: minDuration, distance: bestDistance };
}

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

/**
 * Генерирует все возможные перестановки элементов массива.
 * @param {any[]} inputArray Исходный массив.
 * @returns {any[][]} Массив всех перестановок.
 */
function getPermutations(inputArray) {
  const result = [];
  function permute(arr, memo = []) {
    if (arr.length === 0) {
      result.push(memo);
    } else {
      for (let i = 0; i < arr.length; i++) {
        const curr = arr.slice();
        const next = curr.splice(i, 1);
        permute(curr.slice(), memo.concat(next));
      }
    }
  }
  permute(inputArray);
  return result;
}


/**
 * Форматирует расстояние (метры) в читаемый вид (км).
 */
function formatDistance(meters) {
    return {
        value: meters,
        text: (meters / 1000).toFixed(1) + ' км'
    };
}

/**
 * Форматирует время (секунды) в читаемый вид (часы, минуты).
 */
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    let text = '';
    if (hours > 0) text += `${hours} ч `;
    if (minutes > 0) text += `${minutes} мин`;
    return {
        value: seconds,
        text: text.trim() || 'меньше минуты'
    };
} 