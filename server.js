const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
const { kv } = require('@vercel/kv');
const http = require('http');
const { Server } = require("socket.io");

// +++ НОВЫЕ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ +++
const formatDeliveryId = (id) => `Д-${String(id).padStart(4, '0')}`;
const formatRouteId = (id) => `М-${String(id).padStart(4, '0')}`;
const parseId = (formattedId) => parseInt(formattedId.split('-')[1], 10);
const formatCreationDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const mskDate = new Date(date.getTime() + (3 * 60 * 60 * 1000)); // +3 часа для МСК
    const day = String(mskDate.getUTCDate()).padStart(2, '0');
    const month = String(mskDate.getUTCMonth() + 1); // Месяцы от 0 до 11
    const hours = String(mskDate.getUTCHours()).padStart(2, '0');
    const minutes = String(mskDate.getUTCMinutes()).padStart(2, '0');
    return `${day}.${month} ${hours}:${minutes}`;
};

const app = express();
const server = http.createServer(app);

// Инициализируем сокеты на существующем сервере
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const YANDEX_API_KEY = process.env.YANDEX_API_KEY || "7726ddb0-76da-4747-8007-d84dfe2fb93f";
const GEOCODER_URL = "https://geocode-maps.yandex.ru/1.x/";
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Раздача статических файлов из папки 'public'
app.use(express.static(path.join(__dirname, 'public')));

// --- Логика WebSocket ---
io.on('connection', (socket) => {
    console.log('🔌 Клиент подключен по WebSocket');
    
    socket.on('delete_deliveries', async (ids) => {
        try {
            const numericIds = ids.map(id => parseId(id));
            if (numericIds.some(isNaN)) {
                throw new Error("Получены некорректные ID для удаления");
            }

            const deliveries = await kv.get('deliveries') || [];
            const updatedDeliveries = deliveries.filter(d => !numericIds.includes(d.id));
            await kv.set('deliveries', updatedDeliveries);

            console.log(`🗑️ Удалены доставки с ID: ${numericIds.join(', ')}`);
            io.emit('deliveries_deleted', ids);
        } catch (error) {
            console.error('Ошибка удаления доставок:', error);
            socket.emit('delete_error', 'Не удалось удалить доставки на сервере');
        }
    });

    socket.on('disconnect', () => {
        console.log('🔌 Клиент отключен');
    });
});

app.post('/api/routes', async (req, res) => {
    try {
        const { deliveryIds, orderedAddresses, totalDistance, totalDuration, yandexMapsUrl } = req.body;
        if (!deliveryIds || deliveryIds.length === 0) {
            return res.status(400).json({ error: 'Не предоставлены ID доставок для создания маршрута' });
        }

        // --- ИСПРАВЛЕНИЕ: Парсим строковые ID в числовые ---
        const numericDeliveryIds = deliveryIds.map(id => parseId(id));
        if (numericDeliveryIds.some(isNaN)) {
            return res.status(400).json({ error: 'Некорректный формат ID доставки' });
        }

        // 1. Генерируем новый номер маршрута (теперь это просто число)
        const routeId = await kv.incr('nextRouteId');

        // 2. Сохраняем сам маршрут в отдельный список с ЧИСЛОВЫМИ ID доставок
        const newRoute = { id: routeId, deliveryIds: numericDeliveryIds, orderedAddresses, totalDistance, totalDuration, yandexMapsUrl, createdAt: new Date().toISOString() };
        const routes = await kv.get('routes') || [];
        await kv.set('routes', [...routes, newRoute]);

        // 3. Обновляем доставки, добавляя им числовой номер маршрута
        const deliveries = await kv.get('deliveries') || [];
        const deliveriesToUpdate = [];
        const allOtherDeliveries = [];

        deliveries.forEach(d => {
            // --- ИСПРАВЛЕНИЕ: Используем массив числовых ID для поиска ---
            if (numericDeliveryIds.includes(d.id)) {
                // ИЗМЕНЕНИЕ СТАТУСА: Теперь при создании маршрута статус становится 'ready'
                deliveriesToUpdate.push({ ...d, routeId: routeId, status: 'ready' });
            } else {
                allOtherDeliveries.push(d);
            }
        });

        await kv.set('deliveries', [...allOtherDeliveries, ...deliveriesToUpdate]);
        
        // 4. Оповещаем клиентов, отправляя отформатированные данные
        const formattedDeliveriesToUpdate = deliveriesToUpdate.map(d => ({
            ...d,
            id: formatDeliveryId(d.id),
            routeId: d.routeId ? formatRouteId(d.routeId) : null,
            createdAt: formatCreationDate(d.createdAt)
        }));
        io.emit('deliveries_updated', formattedDeliveriesToUpdate);
        console.log(`🗺️ Создан новый маршрут #${routeId} для доставок: ${numericDeliveryIds.join(', ')}`);

        // Отдаем на фронт тоже отформатированный маршрут
        res.status(201).json({
            ...newRoute,
            id: formatRouteId(newRoute.id)
        });
    } catch (error) {
        console.error('Ошибка создания маршрута:', error);
        res.status(500).json({ error: 'Не удалось создать маршрут' });
    }
});

app.get('/api/routes/:id', async (req, res) => {
    try {
        const { id } = req.params; // id в формате "М-0001"
        const numericId = parseId(id);

        const allRoutes = await kv.get('routes') || [];
        const route = allRoutes.find(r => r.id === numericId);

        if (!route) {
            return res.status(404).json({ error: 'Маршрут не найден' });
        }
        
        // Добавляем недостающие поля для совместимости с модальным окном
        if (route.totalDistance && !route.totalDistanceByRoad) {
            route.totalDistanceByLine = route.totalDistance;
            route.totalDistanceByRoad = formatDistance(route.totalDistance.value * 1.44);
            delete route.totalDistance;
        }

        res.json({
            ...route,
            id: formatRouteId(route.id)
        });
    } catch (error) {
        console.error('Ошибка получения маршрута:', error);
        res.status(500).json({ error: 'Не удалось получить маршрут' });
    }
});


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/readme', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'readme.html'));
});

app.get('/api/deliveries', async (req, res) => {
    try {
        const deliveries = await kv.get('deliveries') || [];
        // Форматируем ID перед отправкой на клиент
        const formattedDeliveries = deliveries.map(d => ({
            ...d,
            id: formatDeliveryId(d.id),
            routeId: d.routeId ? formatRouteId(d.routeId) : null,
            createdAt: formatCreationDate(d.createdAt)
        }));
        res.json(formattedDeliveries);
    } catch (error) {
        console.error('Ошибка получения доставок из KV:', error);
        res.status(500).json({ error: 'Не удалось получить доставки' });
    }
});

app.post('/api/deliveries', async (req, res) => {
    try {
        const newDelivery = req.body;
        if (!newDelivery || !newDelivery.address || !newDelivery.coordinates) {
            return res.status(400).json({ error: 'Некорректные данные для доставки' });
        }
        
        newDelivery.status = 'new';
        newDelivery.createdAt = new Date().toISOString(); 

        const deliveries = await kv.get('deliveries') || [];
        const nextId = (await kv.get('nextDeliveryId')) || 1;
        newDelivery.id = nextId;
        
        const updatedDeliveries = [...deliveries, newDelivery];
        
        await kv.set('deliveries', updatedDeliveries);
        await kv.set('nextDeliveryId', nextId + 1);
        
        console.log(`📦 Добавлена новая доставка: #${newDelivery.id} ${newDelivery.address}`);
        
        // Форматируем ID и дату перед отправкой по WebSocket
        const formattedDelivery = {
            ...newDelivery,
            id: formatDeliveryId(newDelivery.id),
            createdAt: formatCreationDate(newDelivery.createdAt)
        };
        io.emit('new_delivery', formattedDelivery);
        res.status(201).json(formattedDelivery);

    } catch (error) {
        console.error('Ошибка сохранения доставки в KV:', error);
        res.status(500).json({ error: 'Не удалось сохранить доставку' });
    }
});

app.get('/api/release-time', async (req, res) => {
    try {
        const releaseTime = await kv.get('releaseTime') || new Date().toISOString();
        const date = new Date(releaseTime);
        const mskDate = new Date(date.getTime() + (3 * 60 * 60 * 1000));
        const day = String(mskDate.getUTCDate()).padStart(2, '0');
        const month = String(mskDate.getUTCMonth() + 1).padStart(2, '0');
        const hours = String(mskDate.getUTCHours()).padStart(2, '0');
        const minutes = String(mskDate.getUTCMinutes()).padStart(2, '0');
        const seconds = String(mskDate.getUTCSeconds()).padStart(2, '0');
        const formattedTime = `${day}.${month} ${hours}:${minutes}:${seconds}`;
    
        res.json({ 
            releaseTime: formattedTime,
            timestamp: releaseTime
        });
    } catch (error) {
        console.error('Ошибка получения времени релиза:', error);
        res.status(500).json({ error: 'Не удалось получить время релиза' });
    }
});

app.post('/api/geocode', async (req, res) => {
    try {
        const { address } = req.body;
        if (!address) return res.status(400).json({ error: 'Адрес не предоставлен' });
        const params = new URLSearchParams({ apikey: YANDEX_API_KEY, geocode: address, format: 'json', results: 1 });
        const response = await fetch(`${GEOCODER_URL}?${params}`);
        if (!response.ok) throw new Error(`Yandex API вернул статус: ${response.status}`);
        const data = await response.json();
        if (!data.response?.GeoObjectCollection?.featureMember?.length) return res.status(404).json({ error: 'Адрес не найден' });
        const geoObject = data.response.GeoObjectCollection.featureMember[0].GeoObject;
        console.log(`✅ Координаты найдены: ${geoObject.Point.pos}`);
        res.json({ coordinates: geoObject.Point.pos, fullAddress: geoObject.metaDataProperty.GeocoderMetaData.text });
    } catch (error) {
        console.error('❌ Ошибка геокодирования:', error);
        res.status(500).json({ error: 'Ошибка при геокодировании адреса' });
    }
});

app.post('/api/optimize-route', async (req, res) => {
    try {
        const { deliveryIds } = req.body; // Получаем массив строковых ID ("Д-xxxx")
        if (!deliveryIds || deliveryIds.length < 1) {
            return res.status(400).json({ error: 'Необходимо предоставить минимум 1 адрес' });
        }

        const numericDeliveryIds = deliveryIds.map(id => parseId(id));
        if (numericDeliveryIds.some(isNaN)) {
            return res.status(400).json({ error: 'Некорректный формат ID доставки' });
        }

        // Получаем все доставки и фильтруем нужные по числовым ID
        const allDeliveries = await kv.get('deliveries') || [];
        const selectedDeliveries = allDeliveries.filter(d => numericDeliveryIds.includes(d.id));

        if (selectedDeliveries.length !== numericDeliveryIds.length) {
             return res.status(404).json({ error: 'Одна или несколько выбранных доставок не найдены в базе' });
        }

        let addresses = selectedDeliveries.map(d => d.address);
        let coordinates = selectedDeliveries.map(d => d.coordinates);
        
        const startPoint = { address: "Поповка, Московская обл., 141892", coordinates: "37.298805 56.150459" };
        addresses.unshift(startPoint.address);
        coordinates.unshift(startPoint.coordinates);

        console.log(`🚗 Оптимизация маршрута для ${addresses.length} точек (включая старт/финиш):`);
        addresses.forEach((addr, i) => console.log(`    ${i}. ${addr} (${coordinates[i]})`));

        const distanceMatrix = await calculateMockDistanceMatrix(coordinates);
        const solution = solveTsp(distanceMatrix.duration, distanceMatrix.distance);

        const edgeDistances = [];
        if (solution.path.length > 0) {
            edgeDistances.push(distanceMatrix.distance[0][solution.path[0]]); // Склад -> первая точка
            for (let i = 0; i < solution.path.length - 1; i++) {
                edgeDistances.push(distanceMatrix.distance[solution.path[i]][solution.path[i + 1]]); // Точка -> точка
            }
            edgeDistances.push(distanceMatrix.distance[solution.path[solution.path.length - 1]][0]); // Последняя точка -> склад
        }
        
        const result = buildResultObject(solution.path, edgeDistances, addresses.map(a => ({address: a})), selectedDeliveries);

        console.log(`✅ Маршрут построен: ${result.totalDistanceByRoad.text}, ${result.totalDuration.text}`);
        res.status(200).json(result);

    } catch (error) {
        console.error("❌ Ошибка в /api/optimize-route:", error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера при оптимизации маршрута' });
    }
});

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
            const coord1 = coordinates[i].split(' ').map(parseFloat);
            const coord2 = coordinates[j].split(' ').map(parseFloat);
            const distance = calculateStraightDistance(coord1[1], coord1[0], coord2[1], coord2[0]);
            distanceMatrix[i][j] = distance;
            durationMatrix[i][j] = Math.round(distance / 16.67); // ~60 km/h в м/с
        }
    }
    return { distance: distanceMatrix, duration: durationMatrix };
}

function calculateStraightDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Radius of the earth in m
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function solveTsp(timeMatrix, distanceMatrix) {
    const n = distanceMatrix.length;
    if (n <= 1) return { path: [], duration: 0, distance: 0 };

    // 1. Nearest Neighbor
    let tour = [0];
    let unvisited = new Set(Array.from({ length: n - 1 }, (_, i) => i + 1));

    let currentPoint = 0;
    while (unvisited.size > 0) {
        let nearestPoint = -1;
        let minDistance = Infinity;

        for (const point of unvisited) {
            if (distanceMatrix[currentPoint][point] < minDistance) {
                minDistance = distanceMatrix[currentPoint][point];
                nearestPoint = point;
            }
        }
        tour.push(nearestPoint);
        unvisited.delete(nearestPoint);
        currentPoint = nearestPoint;
    }

    // 2. 2-opt Improvement
    let improved = true;
    while (improved) {
        improved = false;
        for (let i = 0; i < n - 2; i++) {
            for (let j = i + 2; j < n; j++) {
                const i_ = tour[i];
                const i1_ = tour[i + 1];
                const j_ = tour[j];
                const j1_ = tour[(j + 1) % n];

                const oldDistance = distanceMatrix[i_][i1_] + distanceMatrix[j_][j1_];
                const newDistance = distanceMatrix[i_][j_] + distanceMatrix[i1_][j1_];
                
                if (newDistance < oldDistance) {
                    const segment = tour.slice(i + 1, j + 1);
                    segment.reverse();
                    tour = tour.slice(0, i + 1).concat(segment).concat(tour.slice(j + 1));
                    improved = true;
                }
            }
        }
    }
    
    // The tour starts with the depot (0), we need to return the path of waypoints
    const waypointTour = tour.slice(1);
    
    // Recalculate final distance and duration
    let finalDistance = 0;
    let finalDuration = 0;
    
    // From depot to first waypoint
    finalDistance += distanceMatrix[0][waypointTour[0]];
    finalDuration += timeMatrix[0][waypointTour[0]];

    for (let i = 0; i < waypointTour.length - 1; i++) {
        finalDistance += distanceMatrix[waypointTour[i]][waypointTour[i+1]];
        finalDuration += timeMatrix[waypointTour[i]][waypointTour[i+1]];
    }

    // From last waypoint back to depot
    finalDistance += distanceMatrix[waypointTour[waypointTour.length - 1]][0];

    const speedMps = 30 * 1000 / 3600;
    const totalDuration = Math.round((finalDistance * 1.44) / speedMps);

    return { path: waypointTour, duration: totalDuration, distance: finalDistance };
}

function buildResultObject(path, edgeDistances, allAddresses, allDeliveries) {
    const depotAddress = allAddresses[0].address;
    const speedMps = 30 * 1000 / 3600;

    let orderedRoute = [{
        address: depotAddress,
        deliveryId: null, travelTimeToPoint: null, distanceToPointByLine: null, distanceToPointByRoad: null
    }];

    let deliveryIds = [];
    
    // Путь от склада до первой точки и между точками
    path.forEach((pointIndex, i) => {
        const address = allAddresses[pointIndex].address;
        const delivery = allDeliveries.find(d => d.address === address);
        if (delivery) {
            deliveryIds.push(delivery.id);
        }

        const distance = edgeDistances[i];
        orderedRoute.push({
            address: address,
            deliveryId: delivery ? delivery.id : null,
            travelTimeToPoint: Math.round((distance * 1.44) / speedMps),
            distanceToPointByLine: distance,
            distanceToPointByRoad: distance * 1.44,
        });
    });

    // Добавляем последний шаг - возвращение на склад
    const returnToDepotDistance = edgeDistances[edgeDistances.length - 1];
    orderedRoute.push({
        address: depotAddress,
        deliveryId: null,
        travelTimeToPoint: Math.round((returnToDepotDistance * 1.44) / speedMps),
        distanceToPointByLine: returnToDepotDistance,
        distanceToPointByRoad: returnToDepotDistance * 1.44,
    });
    
    const totalDistanceByLine = edgeDistances.reduce((a, b) => a + b, 0);
    const totalDistanceByRoad = totalDistanceByLine * 1.44;
    const totalDuration = Math.round(totalDistanceByRoad / speedMps);
    
    const yandexMapsUrl = 'https://yandex.ru/maps/?rtext=' + orderedRoute.map(r => encodeURIComponent(r.address)).join('~') + '&rtt=auto';

    return {
        orderedRoute,
        totalDistanceByLine: formatDistance(totalDistanceByLine),
        totalDistanceByRoad: formatDistance(totalDistanceByRoad),
        totalDuration: formatDuration(totalDuration),
        yandexMapsUrl,
        calculatedAt: new Date().toISOString(),
        deliveryIds: deliveryIds,
    };
}

function formatDistance(meters) {
    return { value: meters, text: (meters / 1000).toFixed(1) + ' км' };
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    let text = '';
    if (hours > 0) text += `${hours} ч `;
    if (minutes > 0) text += `${minutes} мин`;
    return { value: seconds, text: text.trim() || 'меньше минуты' };
}


app.post('/api/routing', async (req, res) => {
    try {
        const allDeliveries = await kv.get('deliveries') || [];
        const allRoutes = await kv.get('routes') || [];

        const deliveriesToRoute = allDeliveries.filter(d => ['new', 'flex'].includes(d.status));
        if (deliveriesToRoute.length === 0) {
            return res.status(200).json({ message: "Нет доставок для маршрутизации.", routesCreated: 0, deliveriesAffected: 0 });
        }

        const oldFlexRouteIds = [...new Set(deliveriesToRoute.filter(d => d.routeId).map(d => d.routeId))];
        const coordinates = deliveriesToRoute.map(d => d.coordinates);

        // 1. Строим один большой маршрут
        const distanceMatrix = await calculateMockDistanceMatrix(coordinates);
        const tspSolution = solveTsp(distanceMatrix.duration, distanceMatrix.distance);
        
        const orderedDeliveries = tspSolution.path.map(index => deliveriesToRoute[index -1]); // -1 так как TSP отдает индексы 1..N

        // 2. Нарезаем на маршруты по 6 часов
        const MAX_CHUNK_SECONDS = 6 * 60 * 60;
        let chunkedRoutes = [];
        let currentChunk = [];
        let currentChunkTime = 0;

        for (const delivery of orderedDeliveries) {
            const deliveryTime = (delivery.timeAtPoint || 0) * 60;
            if (currentChunk.length > 0 && currentChunkTime + deliveryTime > MAX_CHUNK_SECONDS) {
                chunkedRoutes.push(currentChunk);
                currentChunk = [];
                currentChunkTime = 0;
            }
            currentChunk.push(delivery);
            currentChunkTime += deliveryTime;
        }
        if (currentChunk.length > 0) {
            chunkedRoutes.push(currentChunk);
        }

        // 3. Обновляем данные в KV
        const remainingRoutes = allRoutes.filter(r => !oldFlexRouteIds.includes(r.id));
        let nextRouteId = (await kv.get('nextRouteId')) || 1;
        const finalRoutes = [];
        const updatedDeliveries = [];

        for (const chunk of chunkedRoutes) {
            const newRouteId = nextRouteId++;
            const deliveryIds = chunk.map(d => d.id);
            finalRoutes.push({ id: newRouteId, deliveryIds, createdAt: new Date().toISOString() });
            chunk.forEach(d => {
                updatedDeliveries.push({ ...d, routeId: newRouteId, status: 'flex' });
            });
        }
        
        await kv.set('routes', [...remainingRoutes, ...finalRoutes]);
        const otherDeliveries = allDeliveries.filter(d => !['new', 'flex'].includes(d.status));
        await kv.set('deliveries', [...otherDeliveries, ...updatedDeliveries]);
        await kv.set('nextRouteId', nextRouteId);
        
        io.emit('deliveries_updated', updatedDeliveries.map(d => ({
            ...d,
            id: formatDeliveryId(d.id),
            routeId: formatRouteId(d.routeId),
            createdAt: formatCreationDate(d.createdAt)
        })));

        res.json({ 
            message: "Маршрутизация завершена",
            routesCreated: finalRoutes.length,
            deliveriesAffected: updatedDeliveries.length,
        });

    } catch (error) {
        console.error('❌ Ошибка выполнения маршрутизации:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера при маршрутизации' });
    }
});


// --- Экспорт для Vercel ---
// Vercel будет использовать этот экспорт, чтобы запустить сервер.
// Но для локальной разработки и для того, чтобы сокеты работали,
// нам нужно его слушать.
if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`🚀 Сервер запущен на порту ${PORT}`);
    });
}

module.exports = server;