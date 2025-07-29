const { kv } = require('@vercel/kv');

// --- Вспомогательные функции ---
const parseId = (formattedId) => {
    if (!formattedId || typeof formattedId !== 'string') return NaN;
    return parseInt(formattedId.split('-')[1], 10);
};

// --- Обработчики событий WebSocket ---
module.exports = function(io, socket) {
    
    const handleDeleteDeliveries = async (ids) => {
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
    };

    const handleNewDelivery = async (delivery) => {
        // Логика добавления новой доставки (если нужно будет)
        // io.emit('new_delivery', newDelivery);
    };

    // Регистрируем обработчики
    socket.on('delete_deliveries', handleDeleteDeliveries);
    socket.on('new_delivery', handleNewDelivery);

    socket.on('disconnect', () => {
        console.log('🔌 Клиент отключен:', socket.id);
    });
}; 