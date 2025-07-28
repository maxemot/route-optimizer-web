require('dotenv').config();
const { kv } = require('@vercel/kv');

async function migrateData() {
    console.log('🚀 Запуск миграции ID...');

    try {
        // 1. Миграция маршрутов (routes)
        const routes = await kv.get('routes') || [];
        const migratedRoutes = [];
        const routeIdMap = new Map(); // Карта для соответствия старых строковых ID новым числовым

        if (routes.length > 0) {
            console.log(`🔍 Найдено ${routes.length} маршрутов для миграции.`);
            for (const route of routes) {
                if (typeof route.id === 'string' && route.id.startsWith('П-')) {
                    const numericId = parseInt(route.id.replace('П-', ''), 10);
                    if (!isNaN(numericId)) {
                        routeIdMap.set(route.id, numericId); // Сохраняем соответствие
                        migratedRoutes.push({
                            ...route,
                            id: numericId // Заменяем строковый ID на числовой
                        });
                        console.log(`  - Маршрут "${route.id}" преобразован в ID: ${numericId}`);
                    }
                } else {
                    // Если ID уже числовой, просто добавляем
                    migratedRoutes.push(route);
                }
            }
            await kv.set('routes', migratedRoutes);
            console.log('✅ Маршруты успешно мигрированы.');
        } else {
            console.log('ℹ️ Маршруты для миграции не найдены.');
        }

        // 2. Миграция доставок (deliveries)
        const deliveries = await kv.get('deliveries') || [];
        const migratedDeliveries = [];

        if (deliveries.length > 0) {
            console.log(`🔍 Найдено ${deliveries.length} доставок для обновления.`);
            for (const delivery of deliveries) {
                // Проверяем, есть ли у доставки строковый routeId, который мы преобразовали
                if (delivery.routeId && routeIdMap.has(delivery.routeId)) {
                    const numericRouteId = routeIdMap.get(delivery.routeId);
                    migratedDeliveries.push({
                        ...delivery,
                        routeId: numericRouteId // Обновляем routeId на числовой
                    });
                     console.log(`  - У доставки #${delivery.id} обновлен routeId с "${delivery.routeId}" на ${numericRouteId}`);
                } else {
                    migratedDeliveries.push(delivery);
                }
            }
            await kv.set('deliveries', migratedDeliveries);
            console.log('✅ Доставки успешно обновлены.');
        } else {
             console.log('ℹ️ Доставки для миграции не найдены.');
        }

        // 3. Сброс счетчика 'nextRouteId'
        // Это необходимо, чтобы новые маршруты начинали нумерацию с правильного числа.
        // Мы берем максимальный существующий числовой ID и устанавливаем счетчик на следующее значение.
        const allRoutes = await kv.get('routes') || [];
        const maxRouteId = allRoutes.reduce((max, r) => (typeof r.id === 'number' && r.id > max) ? r.id : max, 0);
        await kv.set('nextRouteId', maxRouteId + 1);
        console.log(`🔄 Счетчик 'nextRouteId' установлен в: ${maxRouteId + 1}`);


        console.log('🎉 Миграция успешно завершена!');

    } catch (error) {
        console.error('❌ Ошибка во время миграции:', error);
        process.exit(1); // Выход с ошибкой
    }
}

migrateData(); 