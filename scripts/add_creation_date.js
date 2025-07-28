require('dotenv').config();
const { kv } = require('@vercel/kv');

async function addCreationDate() {
    console.log('🚀 Запуск миграции: добавление даты создания к доставкам...');

    try {
        const deliveries = await kv.get('deliveries') || [];
        
        // Устанавливаем дату "29 июля 2025 года, 02:00:00" по Московскому времени (UTC+3)
        // new Date(year, monthIndex, day, hours, minutes, seconds)
        // ВАЖНО: monthIndex для июля - это 6
        const defaultDate = new Date(Date.UTC(2025, 6, 29, 2, 0, 0) - (3 * 60 * 60 * 1000));
        const defaultDateISO = defaultDate.toISOString();

        console.log(`Будет использована дата по-умолчанию: ${defaultDateISO}`);

        const migratedDeliveries = deliveries.map(delivery => {
            // Добавляем поле createdAt, только если его еще нет
            if (!delivery.createdAt) {
                return {
                    ...delivery,
                    createdAt: defaultDateISO
                };
            }
            return delivery;
        });

        await kv.set('deliveries', migratedDeliveries);
        console.log(`✅ Миграция завершена. ${migratedDeliveries.length} доставок проверено и обновлено.`);

    } catch (error) {
        console.error('❌ Ошибка во время миграции:', error);
        process.exit(1);
    }
}

addCreationDate(); 