const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');

const app = express();

// Конфигурация
const YANDEX_API_KEY = process.env.YANDEX_API_KEY || "7726ddb0-76da-4747-8007-d84dfe2fb93f";
const GEOCODER_URL = "https://geocode-maps.yandex.ru/1.x/";
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Основная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint для геокодирования адреса
app.post('/api/geocode', async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Адрес не указан' });
    }

    const params = new URLSearchParams({
      'apikey': YANDEX_API_KEY,
      'geocode': address,
      'format': 'json',
      'results': '1'
    });

    const response = await fetch(`${GEOCODER_URL}?${params}`);
    const data = await response.json();

    if (!response.ok || !data.response.GeoObjectCollection.featureMember.length) {
      return res.status(404).json({ 
        error: `Не удалось найти координаты для адреса: "${address}"` 
      });
    }

    const point = data.response.GeoObjectCollection.featureMember[0].GeoObject.Point.pos;
    const [lon, lat] = point.split(' ');
    
    res.json({ 
      coordinates: point,
      longitude: parseFloat(lon),
      latitude: parseFloat(lat)
    });

  } catch (error) {
    console.error('Ошибка геокодирования:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// API endpoint для расчета матрицы расстояний через Google Maps (будет эмулироваться)
app.post('/api/distance-matrix', async (req, res) => {
  try {
    const { coordinates } = req.body;
    
    if (!coordinates || !Array.isArray(coordinates)) {
      return res.status(400).json({ error: 'Массив координат не указан' });
    }

    // В реальном приложении здесь бы был вызов к Google Distance Matrix API
    // Пока создаем моковые данные для демонстрации
    const matrix = await calculateMockDistanceMatrix(coordinates);
    
    res.json(matrix);

  } catch (error) {
    console.error('Ошибка расчета матрицы:', error);
    res.status(500).json({ error: 'Ошибка при расчете матрицы расстояний' });
  }
});

// API endpoint для оптимизации маршрута
app.post('/api/optimize-route', async (req, res) => {
  try {
    const { addresses, coordinates } = req.body;
    
    if (!addresses || !coordinates || addresses.length !== coordinates.length) {
      return res.status(400).json({ error: 'Некорректные данные адресов или координат' });
    }

    if (addresses.length < 2) {
      return res.status(400).json({ error: 'Необходимо минимум 2 адреса' });
    }

    // Получаем матрицу расстояний
    const matrixData = await calculateMockDistanceMatrix(coordinates);
    
    // Решаем задачу коммивояжера
    const routeResult = solveTsp(matrixData.duration, matrixData.distance);
    
    // Формируем оптимальный порядок адресов
    const startAddress = addresses[0];
    const orderedAddresses = [startAddress];
    routeResult.path.forEach(index => {
      orderedAddresses.push(addresses[index]);
    });
    orderedAddresses.push(startAddress);
    
    const yandexMapsUrl = 'https://yandex.ru/maps/?rtext=' + 
      orderedAddresses.map(encodeURIComponent).join('~') + '&rtt=auto';

    res.json({
      orderedAddresses,
      totalDistance: formatDistance(routeResult.distance),
      totalDuration: formatDuration(routeResult.duration),
      yandexMapsUrl
    });

  } catch (error) {
    console.error('Ошибка оптимизации маршрута:', error);
    res.status(500).json({ error: 'Ошибка при оптимизации маршрута' });
  }
});

// Функции для расчета маршрута (портированные из Google Apps Script)

async function calculateMockDistanceMatrix(coordinates) {
  const n = coordinates.length;
  const distanceMatrix = Array(n).fill(0).map(() => Array(n).fill(Infinity));
  const durationMatrix = Array(n).fill(0).map(() => Array(n).fill(Infinity));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        distanceMatrix[i][j] = 0;
        durationMatrix[i][j] = 0;
        continue;
      }
      
      // Эмулируем расчет расстояния на основе координат
      const coord1 = coordinates[i].split(' ').map(parseFloat);
      const coord2 = coordinates[j].split(' ').map(parseFloat);
      
      // Простой расчет расстояния по прямой (в реальности здесь был бы запрос к Google Maps)
      const distance = calculateStraightDistance(coord1[1], coord1[0], coord2[1], coord2[0]);
      const duration = Math.round(distance / 60 * 1000); // Примерная скорость 60 км/ч
      
      distanceMatrix[i][j] = distance;
      durationMatrix[i][j] = duration;
    }
  }
  
  return { distance: distanceMatrix, duration: durationMatrix };
}

function calculateStraightDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Радиус Земли в метрах
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function solveTsp(timeMatrix, distanceMatrix) {
  const n = timeMatrix.length;
  const waypointIndices = Array.from({length: n - 1}, (_, i) => i + 1);

  if (n <= 2) {
    const path = n > 1 ? [1] : [];
    const duration = n > 1 ? timeMatrix[0][1] + timeMatrix[1][0] : 0;
    const distance = n > 1 ? distanceMatrix[0][1] + distanceMatrix[1][0] : 0;
    return { path, duration, distance };
  }

  const permutations = getPermutations(waypointIndices);
  
  let bestPath = [];
  let minDuration = Infinity;

  for (const p of permutations) {
    let currentDuration = timeMatrix[0][p[0]];
    
    for (let i = 0; i < p.length - 1; i++) {
      currentDuration += timeMatrix[p[i]][p[i+1]];
    }
    
    currentDuration += timeMatrix[p[p.length - 1]][0];

    if (currentDuration < minDuration) {
      minDuration = currentDuration;
      bestPath = p;
    }
  }

  let bestDistance = distanceMatrix[0][bestPath[0]];
  for (let i = 0; i < bestPath.length - 1; i++) {
    bestDistance += distanceMatrix[bestPath[i]][bestPath[i+1]];
  }
  bestDistance += distanceMatrix[bestPath[bestPath.length - 1]][0];

  if (minDuration === Infinity) {
    throw new Error("Невозможно построить маршрут");
  }
  
  return { path: bestPath, duration: minDuration, distance: bestDistance };
}

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

function formatDistance(meters) {
  return {
    value: meters,
    text: (meters / 1000).toFixed(1) + ' км'
  };
}

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

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`Откройте http://localhost:${PORT} в браузере`);
});

module.exports = app; 