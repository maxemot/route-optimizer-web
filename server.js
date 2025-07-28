const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
const { kv } = require('@vercel/kv');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Для простоты разрешаем все источники
        methods: ["GET", "POST"]
    }
});

// Конфигурация
const YANDEX_API_KEY = process.env.YANDEX_API_KEY || "7726ddb0-76da-4747-8007-d84dfe2fb93f";
const GEOCODER_URL = "https://geocode-maps.yandex.ru/1.x/";
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Socket.io connection
io.on('connection', (socket) => {
    console.log('🔌 Клиент подключен по WebSocket');
    socket.on('disconnect', () => {
        console.log('🔌 Клиент отключен');
    });
});

// Основная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Страница документации
app.get('/readme', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'readme.html'));
});

// API для Доставок

// Получить все доставки
app.get('/api/deliveries', async (req, res) => {
    try {
        const deliveries = await kv.get('deliveries');
        res.json(deliveries || []);
    } catch (error) {
        console.error('Ошибка получения доставок из KV:', error);
        res.status(500).json({ error: 'Не удалось получить доставки' });
    }
});

// Добавить новую доставку
app.post('/api/deliveries', async (req, res) => {
    try {
        const newDelivery = req.body;
        if (!newDelivery || !newDelivery.address || !newDelivery.coordinates) {
            return res.status(400).json({ error: 'Некорректные данные для доставки' });
        }

        const deliveries = await kv.get('deliveries') || [];
        
        const nextId = (await kv.get('nextDeliveryId')) || 1;
        newDelivery.id = nextId;
        
        const updatedDeliveries = [...deliveries, newDelivery];
        
        await kv.set('deliveries', updatedDeliveries);
        await kv.set('nextDeliveryId', nextId + 1);

        console.log(`📦 Добавлена новая доставка: #${newDelivery.id} ${newDelivery.address}`);
        
        // Оповещаем всех подключенных клиентов о новой доставке
        io.emit('new_delivery', newDelivery);

        res.status(201).json(newDelivery);

    } catch (error) {
        console.error('Ошибка сохранения доставки в KV:', error);
        res.status(500).json({ error: 'Не удалось сохранить доставку' });
    }
});


// API endpoint для получения времени релиза
app.get('/api/release-time', (req, res) => {
  // Фиксированное время релиза для текущей версии
  const releaseTime = "2025-07-28T06:42:17.000Z"; // Время последнего удачного деплоя
  
  // Форматируем в нужный формат (используем UTC, т.к. сервер Vercel в UTC)
  const date = new Date(releaseTime);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  
  const formattedTime = `${day}.${month} ${hours}:${minutes}:${seconds} UTC`;
  
  res.json({ 
    releaseTime: formattedTime,
    timestamp: releaseTime
  });
});

// API endpoint для геокодирования
app.post('/api/geocode', async (req, res) => {
    try {
        const { address } = req.body;
        
        if (!address) {
            return res.status(400).json({ error: 'Адрес не предоставлен' });
        }

        console.log(`🗺️ Геокодирование адреса: "${address}"`);

        const params = new URLSearchParams({
            apikey: YANDEX_API_KEY,
            geocode: address,
            format: 'json',
            results: 1
        });

        const response = await fetch(`${GEOCODER_URL}?${params}`, {
            method: 'GET',
            headers: {
                'User-Agent': 'RouteOptimizer/1.0'
            }
        });

        if (!response.ok) {
            throw new Error(`Yandex API вернул статус: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.response?.GeoObjectCollection?.featureMember?.length) {
            return res.status(404).json({ error: 'Адрес не найден' });
        }

        const geoObject = data.response.GeoObjectCollection.featureMember[0].GeoObject;
        const coordinates = geoObject.Point.pos; // "долгота широта"
        
        console.log(`✅ Координаты найдены: ${coordinates}`);

        res.json({ 
            coordinates: coordinates,
            fullAddress: geoObject.metaDataProperty.GeocoderMetaData.text
        });
    } catch (error) {
        console.error('❌ Ошибка геокодирования:', error);
        res.status(500).json({ error: 'Ошибка при геокодировании адреса' });
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
        let { addresses, coordinates } = req.body;

        if (!addresses || !coordinates || addresses.length !== coordinates.length || addresses.length < 1) { // Теперь достаточно одной точки
            return res.status(400).json({ 
                error: 'Необходимо предоставить минимум 1 адрес с соответствующими координатами' 
            });
        }
        
        // Добавляем фиксированную точку старта/финиша в начало
        const startPoint = {
            address: "Поповка, Московская обл., 141892",
            coordinates: "37.298805 56.150459" // Долгота, Широта
        };
        
        // Вставляем точку "Поповка" в начало массивов
        addresses.unshift(startPoint.address);
        coordinates.unshift(startPoint.coordinates);

        console.log(`🚗 Оптимизация маршрута для ${addresses.length} точек (включая старт/финиш):`);
        addresses.forEach((addr, i) => console.log(`  ${i}. ${addr} (${coordinates[i]})`));

        // Рассчитываем матрицу расстояний (используем mock для демонстрации)
        const distanceMatrix = await calculateMockDistanceMatrix(coordinates);
        
        // Решаем задачу коммивояжера
        const solution = solveTsp(distanceMatrix.duration, distanceMatrix.distance);
        
        // Формируем упорядоченный список адресов
        const startAddress = addresses[0];
        const orderedAddresses = [startAddress];
        
        solution.path.forEach(index => {
            orderedAddresses.push(addresses[index]);
        });
        orderedAddresses.push(startAddress); // Возвращаемся в начальную точку
        
        // Создаем ссылку на Яндекс.Карты
        const yandexMapsUrl = 'https://yandex.ru/maps/?rtext=' + 
            orderedAddresses.map(addr => encodeURIComponent(addr)).join('~') + 
            '&rtt=auto';

        const result = {
            orderedAddresses,
            totalDistance: formatDistance(solution.distance),
            totalDuration: formatDuration(solution.duration),
            yandexMapsUrl,
            calculatedAt: new Date().toISOString()
        };

        console.log(`✅ Маршрут построен: ${result.totalDistance.text}, ${result.totalDuration.text}`);
        
        res.json(result);
    } catch (error) {
        console.error('❌ Ошибка при оптимизации маршрута:', error);
        res.status(500).json({ 
            error: 'Внутренняя ошибка сервера при оптимизации маршрута' 
        });
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
server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`   Откройте http://localhost:${PORT} в браузере`);
});

module.exports = app; 