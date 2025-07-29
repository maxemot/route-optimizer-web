require('dotenv').config();
const { kv } = require('@vercel/kv');
const { calculateMockDistanceMatrix, formatDeliveryId, calculateStraightDistance } = require('../server_utils'); // Потребуется вынести функции в отдельный файл

async function migrateRoutes() {
    console.log('🚀 Starting route migration...');

    try {
        const allRoutes = await kv.get('routes') || [];
        const allDeliveries = await kv.get('deliveries') || [];
        let updatedRoutes = 0;

        const migratedRoutes = await Promise.all(allRoutes.map(async (route) => {
            // Мигрируем только если маршрут в старом формате
            if (!route.orderedRoute && route.orderedAddresses) {
                console.log(`- Migrating route #${route.id}...`);
                updatedRoutes++;

                const startPoint = { address: "Поповка, Московская обл., 141892", coordinates: "37.298805 56.150459" };
                
                const pointsInRoute = route.orderedAddresses.map(addr => {
                    if (addr === startPoint.address) return startPoint;
                    return allDeliveries.find(d => d.address === addr);
                }).filter(Boolean);

                if (pointsInRoute.length !== route.orderedAddresses.length) {
                    console.warn(`  - Warning: Could not find all deliveries for route #${route.id}. Skipping.`);
                    return route; // Возвращаем как есть, если не нашли все точки
                }

                const coordinates = pointsInRoute.map(p => p.coordinates);
                const matrix = await calculateMockDistanceMatrix(coordinates);
                const speedMps = 30 * 1000 / 3600;

                const newOrderedRoute = pointsInRoute.map((point, i) => {
                    const delivery = allDeliveries.find(d => d.id === point.id);
                    let travelInfo = { travelTimeToPoint: null, distanceToPointByRoad: null, timeAtPoint: null };
                    
                    if (i > 0) {
                        const distance = matrix.distance[i-1][i];
                        travelInfo.travelTimeToPoint = Math.round((distance * 1.44) / speedMps);
                        travelInfo.distanceToPointByRoad = distance * 1.44;
                    }

                    if(delivery) {
                        travelInfo.timeAtPoint = delivery.timeAtPoint;
                    }

                    return {
                        address: point.address,
                        deliveryId: delivery ? formatDeliveryId(delivery.id) : null,
                        ...travelInfo
                    };
                });
                
                return {
                    ...route,
                    orderedRoute: newOrderedRoute,
                    orderedAddresses: undefined // Удаляем старое поле
                };
            }
            return route;
        }));

        // Сохраняем обновленные маршруты обратно в KV
        await kv.set('routes', migratedRoutes);

        console.log(`\n✅ Migration complete!`);
        console.log(`   - Total routes checked: ${allRoutes.length}`);
        console.log(`   - Routes updated: ${updatedRoutes}`);

    } catch (error) {
        console.error('❌ An error occurred during migration:', error);
    }
}

// Выносим вспомогательные функции, чтобы их можно было импортировать
module.exports = { migrateRoutes };

// Запускаем миграцию, если файл был вызван напрямую
if (require.main === module) {
    migrateRoutes();
} 