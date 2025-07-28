// Глобальные переменные
let geocodedAddresses = {};
// let socket; - убрано

// DOM элементы
const addDeliveryBtn = document.getElementById('add-delivery-btn');
const optimizeRouteBtn = document.getElementById('optimize-route-btn');
const selectedCount = document.getElementById('selected-count');
const deliveriesTable = document.getElementById('deliveries-table');
const deliveriesTbody = document.getElementById('deliveries-tbody');
const selectAllCheckbox = document.getElementById('select-all');
const deleteDeliveriesBtn = document.getElementById('delete-deliveries-btn');

// Модальные окна
const deliveryModal = document.getElementById('delivery-modal');
const routeModal = document.getElementById('route-modal');
const loader = document.getElementById('loader');

// Элементы формы добавления доставки
const deliveryAddress = document.getElementById('delivery-address');
const deliveryVolume = document.getElementById('delivery-volume');
const deliveryTime = document.getElementById('delivery-time');
const addressCoordinates = document.getElementById('address-coordinates');
const addressError = document.getElementById('address-error');
const saveDeliveryBtn = document.getElementById('save-delivery');
const cancelDeliveryBtn = document.getElementById('cancel-delivery');

// Элементы результатов маршрута
const routeNumber = document.getElementById('route-number');
const deliveriesCount = document.getElementById('deliveries-count');
const totalDistance = document.getElementById('total-distance');
const totalDuration = document.getElementById('total-duration');
const routeStepsList = document.getElementById('route-steps-list');
const openYandexMapsBtn = document.getElementById('open-yandex-maps');
const copyRouteLinkBtn = document.getElementById('copy-route-link');
const routeError = document.getElementById('route-error');

let currentRouteData = null;

// Функция для принудительного закрытия всех модальных окон
function closeAllModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.classList.remove('show');
        // modal.style.display = 'none'; // УДАЛЕНО: эта строка мешала открытию окон
    });
}

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    closeAllModals();
    initializeEventListeners();
    loadAndRenderDeliveries();
    // initializeWebSocket(); - убрано
    updateUI();
});

// Работа с модальными окнами
function openModal(modal) {
    modal.classList.add('show');
}

function closeModal(modal) {
    modal.classList.remove('show');
    if (modal === deliveryModal) {
        clearDeliveryForm();
    }
}

function openDeliveryModal() {
    openModal(deliveryModal);
    deliveryAddress.focus(); // Фокус на поле ввода адреса
}

function clearDeliveryForm() {
    deliveryAddress.value = '';
    deliveryVolume.value = '1.0';
    deliveryTime.value = '15';
    addressCoordinates.textContent = '';
    addressError.textContent = '';
}

// Геокодирование
async function handleAddressBlur() {
    const address = deliveryAddress.value.trim();
    if (!address) return;

    if (geocodedAddresses[address]) {
        displayCoordinates(geocodedAddresses[address]);
        return;
    }

    try {
        showAddressLoading();
        const coordinates = await geocodeAddress(address);
        geocodedAddresses[address] = coordinates;
        displayCoordinates(coordinates);
        clearAddressError();
    } catch (error) {
        showAddressError('Не удалось найти координаты для данного адреса');
        addressCoordinates.textContent = '';
    }
}

function showAddressLoading() {
    addressCoordinates.textContent = 'Поиск координат...';
    addressCoordinates.style.color = '#718096';
}

function displayCoordinates(coordinates) {
    addressCoordinates.textContent = `📍 ${coordinates}`;
    addressCoordinates.style.color = '#38a169';
}

function showAddressError(message) {
    addressError.textContent = message;
}

function clearAddressError() {
    addressError.textContent = '';
}

async function geocodeAddress(address) {
    const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address }),
    });

    if (!response.ok) {
        throw new Error('Ошибка геокодирования');
    }

    const data = await response.json();
    return data.coordinates;
}

// Управление доставками
async function saveDelivery() {
    const address = deliveryAddress.value.trim();
    const volume = parseFloat(deliveryVolume.value);
    const timeAtPoint = parseInt(deliveryTime.value);

    if (!address || !geocodedAddresses[address] || volume <= 0 || timeAtPoint <= 0) {
        showAddressError('Пожалуйста, введите корректный адрес и дождитесь получения координат');
        return;
    }

    const newDeliveryData = {
        // id будет присвоен сервером
        address: address,
        coordinates: geocodedAddresses[address],
        status: 'pending',
        volume: volume,
        timeAtPoint: timeAtPoint,
        routeId: null
    };

    try {
        showLoader('Сохранение...');
        const response = await fetch('/api/deliveries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newDeliveryData),
        });

        if (!response.ok) {
            throw new Error('Ошибка при сохранении доставки на сервере');
        }
        
        const savedDelivery = await response.json(); // Получаем созданную доставку с ID

        // Временное решение: просто перезагружаем все доставки
        await loadAndRenderDeliveries();
        
        hideLoader();
        closeModal(deliveryModal);
        updateUI();

    } catch (error) {
        console.error('Ошибка сохранения:', error);
        hideLoader();
        alert(error.message);
    }
}

function renderDeliveriesTable(deliveries) {
    deliveriesTbody.innerHTML = '';

    if (!deliveries || deliveries.length === 0) {
        // Показываем пустое состояние
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `
            <td colspan="8" class="empty-state">
                <span class="empty-state-icon">📦</span>
                <h3>Доставки не добавлены</h3>
                <p>Нажмите кнопку "➕ Добавить доставку" чтобы создать первую доставку</p>
            </td>
        `;
        deliveriesTbody.appendChild(emptyRow);
        return;
    }

    deliveries.forEach(delivery => {
        const row = createDeliveryRow(delivery);
        deliveriesTbody.appendChild(row);
    });
    // После отрисовки обновляем состояние кнопок и чекбоксов
    updateSelectionState(deliveries);
}

function createDeliveryRow(delivery) {
    const row = document.createElement('tr');
    row.dataset.deliveryId = delivery.id;

    const statusBadge = getStatusBadge(delivery.status);
    const routeCell = delivery.routeId
        ? `<a href="#" class="route-link" onclick="openRouteInYandexMaps('${delivery.routeId}')" data-route="${delivery.routeId}">№${delivery.routeId}</a>`
        : '';

    row.innerHTML = `
        <td>
            <input type="checkbox" class="delivery-checkbox" data-delivery-id="${delivery.id}" onchange="updateSelectionState()">
        </td>
        <td class="delivery-number">${delivery.id}</td>
        <td title="${delivery.address}">${truncateText(delivery.address, 40)}</td>
        <td class="coordinates-display">${delivery.coordinates}</td>
        <td>${statusBadge}</td>
        <td>${delivery.volume} м³</td>
        <td>${delivery.timeAtPoint} мин</td>
        <td>${routeCell}</td>
    `;

    return row;
}

function getStatusBadge(status) {
    const statusLabels = {
        'pending': 'Ожидает',
        'ready': 'Готов',
        'in-route': 'В пути',
        'delivered': 'Доставлен'
    };

    return `<span class="status-badge status-${status}">${statusLabels[status]}</span>`;
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Управление выбором
function toggleSelectAll() {
    const checkboxes = document.querySelectorAll('.delivery-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
    updateSelectionState();
}

function updateSelectionState(deliveries) { // deliveries необязателен, но может пригодиться
    const checkboxes = document.querySelectorAll('.delivery-checkbox');
    const checkedBoxes = document.querySelectorAll('.delivery-checkbox:checked');

    // Обновляем состояние "Выбрать все"
    selectAllCheckbox.indeterminate = checkedBoxes.length > 0 && checkedBoxes.length < checkboxes.length;
    selectAllCheckbox.checked = checkedBoxes.length === checkboxes.length && checkboxes.length > 0;

    // Обновляем счетчик
    selectedCount.textContent = `Выбрано: ${checkedBoxes.length} доставок`;

    // Управляем доступностью кнопки оптимизации
    optimizeRouteBtn.disabled = checkedBoxes.length < 1;
    // deleteDeliveriesBtn.disabled = checkedBoxes.length === 0; // Удалено

    // Выделяем выбранные строки
    checkboxes.forEach(checkbox => {
        const row = checkbox.closest('tr');
        if (checkbox.checked) {
            row.classList.add('selected');
        } else {
            row.classList.remove('selected');
        }
    });
}

function updateUI() {
    updateSelectionState();
}

// Оптимизация маршрута
async function optimizeSelectedRoute() {
    const checkedBoxes = document.querySelectorAll('.delivery-checkbox:checked');

    // Получаем все доставки с сервера, чтобы иметь актуальные данные
    const response = await fetch('/api/deliveries');
    const deliveries = await response.json();

    const selectedDeliveries = Array.from(checkedBoxes).map(checkbox => {
        const deliveryId = parseInt(checkbox.dataset.deliveryId);
        return deliveries.find(d => d.id === deliveryId);
    }).filter(d => d); // Отфильтровываем возможные null

    if (selectedDeliveries.length < 1) { // Теперь достаточно одной
        alert('Выберите минимум 1 доставку для построения маршрута');
        return;
    }

    try {
        showLoader('Оптимизация маршрута...');

        const routeData = await optimizeRoute(selectedDeliveries);
        
        // Временно генерируем ID маршрута на клиенте. В будущем это тоже должно быть на сервере.
        const routeId = `R-${Date.now()}`; 
        
        selectedDeliveries.forEach(delivery => {
            delivery.routeId = routeId;
            delivery.status = 'ready'; // Эту логику тоже нужно будет перенести на сервер
        });

        currentRouteData = {
            ...routeData,
            routeId: routeId,
            deliveries: selectedDeliveries
        };

        hideLoader();
        // После построения маршрута нужно будет обновить таблицу, чтобы показать номера маршрутов
        // Это будет сделано в рамках задачи по real-time обновлениям
        // loadAndRenderDeliveries();
        showRouteResults(currentRouteData);
        updateUI();

    } catch (error) {
        hideLoader();
        showRouteError('Ошибка при построении маршрута: ' + error.message);
    }
}

async function optimizeRoute(selectedDeliveries) {
    const addresses = selectedDeliveries.map(d => d.address);
    const coordinates = selectedDeliveries.map(d => d.coordinates);

    const response = await fetch('/api/optimize-route', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ addresses, coordinates }),
    });

    if (!response.ok) {
        throw new Error('Ошибка сервера при оптимизации маршрута');
    }

    return await response.json();
}

function showRouteResults(routeData) {
    routeNumber.textContent = `№${routeData.routeId}`;
    deliveriesCount.textContent = routeData.deliveries.length;
    totalDistance.textContent = routeData.totalDistance.text;
    totalDuration.textContent = routeData.totalDuration.text;

    // Отображаем шаги маршрута
    routeStepsList.innerHTML = '';
    routeData.orderedAddresses.forEach((address, index) => {
        const step = document.createElement('div');
        step.className = 'route-step';
        step.textContent = `${index + 1}. ${address}`;
        routeStepsList.appendChild(step);
    });

    routeError.textContent = '';
    openModal(routeModal);
}

function showRouteError(message) {
    routeError.textContent = message;
    openModal(routeModal);
}

// Работа с Яндекс.Картами
function openRouteInYandexMaps(routeId) {
    if (routeId && typeof routeId === 'string') {
        // Клик по номеру маршрута в таблице
        const route = findRouteById(routeId);
        if (route && route.yandexMapsUrl) {
            window.open(route.yandexMapsUrl, '_blank');
        }
    } else {
        // Клик из модального окна результатов
        if (currentRouteData && currentRouteData.yandexMapsUrl) {
            window.open(currentRouteData.yandexMapsUrl, '_blank');
        }
    }
}

function copyRouteLink() {
    if (currentRouteData && currentRouteData.yandexMapsUrl) {
        navigator.clipboard.writeText(currentRouteData.yandexMapsUrl).then(() => {
            copyRouteLinkBtn.textContent = '✓ Скопировано!';
            setTimeout(() => {
                copyRouteLinkBtn.innerHTML = '📋 Копировать ссылку';
            }, 2000);
        }).catch(() => {
            alert('Не удалось скопировать ссылку');
        });
    }
}

function findRouteById(routeId) {
    // В реальном приложении здесь был бы поиск в базе данных
    // Пока что возвращаем текущий маршрут, если ID совпадает
    if (currentRouteData && currentRouteData.routeId == routeId) {
        return currentRouteData;
    }
    return null;
}

// Вспомогательные функции
function showLoader(message = 'Загрузка...') {
    loader.querySelector('p').textContent = message;
    loader.classList.remove('hidden');
}

function hideLoader() {
    loader.classList.add('hidden');
} 