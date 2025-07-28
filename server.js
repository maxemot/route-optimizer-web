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
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const YANDEX_API_KEY = process.env.YANDEX_API_KEY || "7726ddb0-76da-4747-8007-d84dfe2fb93f";
const GEOCODER_URL = "https://geocode-maps.yandex.ru/1.x/";
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('🔌 Клиент подключен по WebSocket');
    
    socket.on('delete_deliveries', async (ids) => {
        try {
            const deliveries = await kv.get('deliveries') || [];
            const updatedDeliveries = deliveries.filter(d => !ids.includes(d.id));
            await kv.set('deliveries', updatedDeliveries);

            console.log(`🗑️ Удалены доставки с ID: ${ids.join(', ')}`);
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

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/readme', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'readme.html'));
});

app.get('/api/deliveries', async (req, res) => {
    try {
        const deliveries = await kv.get('deliveries');
        res.json(deliveries || []);
    } catch (error) {
        res.status(500).json({ error: 'Не удалось получить доставки' });
    }
});

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
        
        io.emit('new_delivery', newDelivery);
        res.status(201).json(newDelivery);

    } catch (error) {
        res.status(500).json({ error: 'Не удалось сохранить доставку' });
    }
});

app.get('/api/release-time', (req, res) => {
    const releaseTime = "2025-07-28T07:36:49.000Z";
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
        res.json({ coordinates: geoObject.Point.pos, fullAddress: geoObject.metaDataProperty.GeocoderMetaData.text });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка при геокодировании адреса' });
    }
});

app.post('/api/optimize-route', async (req, res) => {
    try {
        let { addresses, coordinates } = req.body;
        if (!addresses || !coordinates || addresses.length !== coordinates.length || addresses.length < 1) {
            return res.status(400).json({ error: 'Необходимо предоставить минимум 1 адрес' });
        }
        
        const startPoint = { address: "Поповка, Московская обл., 141892", coordinates: "37.298805 56.150459" };
        addresses.unshift(startPoint.address);
        coordinates.unshift(startPoint.coordinates);

        const distanceMatrix = await calculateMockDistanceMatrix(coordinates);
        const solution = solveTsp(distanceMatrix.duration, distanceMatrix.distance);
        
        const orderedAddresses = [addresses[0]];
        solution.path.forEach(index => { orderedAddresses.push(addresses[index]); });
        orderedAddresses.push(addresses[0]);
        
        const yandexMapsUrl = 'https://yandex.ru/maps/?rtext=' + orderedAddresses.map(addr => encodeURIComponent(addr)).join('~') + '&rtt=auto';

        res.json({
            orderedAddresses,
            totalDistance: formatDistance(solution.distance),
            totalDuration: formatDuration(solution.duration),
            yandexMapsUrl
        });
    } catch (error) {
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
            durationMatrix[i][j] = Math.round(distance / 16.67); // ~60 km/h
        }
    }
    return { distance: distanceMatrix, duration: durationMatrix };
}

function calculateStraightDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function solveTsp(timeMatrix, distanceMatrix) {
    const n = timeMatrix.length;
    if (n <= 1) return { path: [], duration: 0, distance: 0 };
    const waypointIndices = Array.from({length: n - 1}, (_, i) => i + 1);
    if (n === 2) return { path: [1], duration: timeMatrix[0][1] + timeMatrix[1][0], distance: distanceMatrix[0][1] + distanceMatrix[1][0] };

    const permutations = getPermutations(waypointIndices);
    let bestPath = [], minDuration = Infinity;

    for (const p of permutations) {
        let currentDuration = timeMatrix[0][p[0]];
        for (let i = 0; i < p.length - 1; i++) { currentDuration += timeMatrix[p[i]][p[i+1]]; }
        currentDuration += timeMatrix[p[p.length - 1]][0];
        if (currentDuration < minDuration) {
            minDuration = currentDuration;
            bestPath = p;
        }
    }
    let bestDistance = distanceMatrix[0][bestPath[0]];
    for (let i = 0; i < bestPath.length - 1; i++) { bestDistance += distanceMatrix[bestPath[i]][bestPath[i+1]]; }
    bestDistance += distanceMatrix[bestPath[bestPath.length - 1]][0];
    return { path: bestPath, duration: minDuration, distance: bestDistance };
}

function getPermutations(inputArray) {
    const result = [];
    const permute = (arr, memo = []) => {
        if (arr.length === 0) { result.push(memo); } 
        else {
            for (let i = 0; i < arr.length; i++) {
                let curr = arr.slice();
                let next = curr.splice(i, 1);
                permute(curr.slice(), memo.concat(next));
            }
        }
    };
    permute(inputArray);
    return result;
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

server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});

module.exports = app;