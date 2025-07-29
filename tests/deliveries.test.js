require('dotenv').config();
const request = require('supertest');
const server = require('../server'); // Импортируем сервер
const { kv } = require('@vercel/kv');

const DEPOT_ADDRESS = 'Поповка, Московская обл., 141892';

jest.mock('@vercel/kv'); // Теперь Jest автоматически подхватит мок из __mocks__

describe('Интеграционное тестирование API', () => {
    let testServer;

    beforeAll((done) => {
        testServer = server.listen(done);
    });

    afterAll((done) => {
        testServer.close(done);
    });
    
    beforeEach(async () => {
        kv.__clearStore();
        jest.clearAllMocks();
        await kv.set('nextDeliveryId', 1);
        await kv.set('nextRouteId', 1);
    });

    test('POST /api/deliveries - должен создавать доставку', async () => {
        await kv.set('nextDeliveryId', 1);
        
        const newDelivery = { 
            address: 'Москва, ул. Тверская, 1', 
            volume: 2, 
            time: 30,
            coordinates: '37.617635,55.755814' 
        };

        const response = await request(server) // Используем testServer
            .post('/api/deliveries')
            .send(newDelivery)
            .expect(201);
        
        expect(response.body).toHaveProperty('id', 'Д-0001');
        expect(response.body).toHaveProperty('status', 'new');
    });

    test('GET /api/deliveries - должен возвращать список доставок', async () => {
        const deliveries = [{ id: 1, address: 'Test Address' }];
        await kv.set('deliveries', deliveries);

        const response = await request(server) // Используем testServer
            .get('/api/deliveries')
            .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBe(1);
        expect(response.body[0]).toHaveProperty('id', 'Д-0001');
    });

    test('GET /api/release-time - должен возвращать время релиза', async () => {
        const testTime = new Date().toISOString();
        await kv.set('releaseTime', testTime);

        const response = await request(server) // Используем testServer
            .get('/api/release-time')
            .expect(200);
        
        expect(response.body).toHaveProperty('timestamp', testTime);
        expect(response.body).toHaveProperty('releaseTime');
    });

    test('POST /api/optimize-route - должен оптимизировать маршрут', async () => {
        // Шаг 1: Подготовка данных и оптимизация
        const deliveries = [
            { id: 1, address: 'Start', coordinates: '37.6 55.7' },
            { id: 2, address: 'Point 1', coordinates: '37.7 55.8' }
        ];
        await kv.set('deliveries', deliveries);
        await kv.set('nextRouteId', 1);

        const optimizationResponse = await request(server)
            .post('/api/optimize-route')
            .send({ deliveryIds: ['Д-0001', 'Д-0002'] })
            .expect(200);

        expect(Array.isArray(optimizationResponse.body)).toBe(true);
        const route = optimizationResponse.body[0];

        expect(route).toHaveProperty('orderedRoute');
        expect(route).toHaveProperty('totalDistanceByLine');
        expect(route).toHaveProperty('totalDistanceByRoad');
        expect(route.totalDistanceByRoad.value).toBeCloseTo(route.totalDistanceByLine.value * 1.44);

        const expectedDuration = Math.round(route.totalDistanceByRoad.value / (30 * 1000 / 3600));
        const receivedDuration = route.totalDuration.value;
        const maxRoundingError = 0.5 * route.orderedRoute.length;
        expect(Math.abs(receivedDuration - expectedDuration)).toBeLessThanOrEqual(maxRoundingError);

        const firstPoint = route.orderedRoute[0];
        expect(firstPoint).toHaveProperty('address');
        expect(firstPoint).toHaveProperty('travelTimeToPoint', null);
        expect(firstPoint).toHaveProperty('distanceToPointByLine', null);
        expect(firstPoint).toHaveProperty('distanceToPointByRoad', null);

        const secondPoint = route.orderedRoute[1];
        expect(secondPoint).toHaveProperty('address');
        expect(secondPoint).toHaveProperty('travelTimeToPoint');
        expect(typeof secondPoint.travelTimeToPoint).toBe('number');
        expect(secondPoint).toHaveProperty('distanceToPointByLine');
        expect(typeof secondPoint.distanceToPointByLine).toBe('number');
        expect(secondPoint).toHaveProperty('distanceToPointByRoad');
        expect(typeof secondPoint.distanceToPointByRoad).toBe('number');
        expect(secondPoint.distanceToPointByRoad).toBeCloseTo(secondPoint.distanceToPointByLine * 1.44);
    });

    /*
    test('POST /api/routes - должен создавать маршрут после оптимизации', async () => {
        // Шаг 1: Подготовка данных и оптимизация
        const deliveries = [
            { id: 1, address: 'Start', coordinates: '37.6 55.7' },
            { id: 2, address: 'Point 1', coordinates: '37.7 55.8' }
        ];
        await kv.set('deliveries', deliveries);
        await kv.set('nextRouteId', 1);

        const optimizationResponse = await request(server) // Используем testServer
            .post('/api/optimize-route')
            .send({ deliveryIds: ['Д-0001', 'Д-0002'] });
        
        const routeData = optimizationResponse.body;

        // Шаг 2: Создание маршрута с данными из оптимизации
        const createRouteResponse = await request(server) // Используем testServer
            .post('/api/routes')
            .send(routeData)
            .expect(201);
            
        expect(createRouteResponse.body).toHaveProperty('id', 'М-0001');
        
        // Шаг 3: Проверка, что у доставок обновился routeId
        const finalDeliveries = await kv.get('deliveries');
        expect(finalDeliveries.find(d => d.id === 1).routeId).toBe(1);
        expect(finalDeliveries.find(d => d.id === 2).routeId).toBe(1);
    });
    */

    // ... Другие тесты можно добавить по аналогии
}); 