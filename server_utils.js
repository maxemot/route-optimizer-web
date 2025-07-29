// Вспомогательные функции, используемые и в server.js, и в скриптах

const formatDeliveryId = (id) => `Д-${String(id).padStart(4, '0')}`;

async function calculateMockDistanceMatrix(coordinates) {
    const n = coordinates.length;
    const distanceMatrix = Array(n).fill(0).map(() => Array(n).fill(Infinity));
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (i === j) {
                distanceMatrix[i][j] = 0;
                continue;
            }
            const coord1 = coordinates[i].split(' ').map(parseFloat);
            const coord2 = coordinates[j].split(' ').map(parseFloat);
            distanceMatrix[i][j] = calculateStraightDistance(coord1[1], coord1[0], coord2[1], coord2[0]);
        }
    }
    // Для совместимости с логикой TSP, которая ожидает объект
    return { distance: distanceMatrix, duration: distanceMatrix }; 
}

function calculateStraightDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Radius of the earth in m
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

module.exports = {
    formatDeliveryId,
    calculateMockDistanceMatrix,
    calculateStraightDistance,
}; 