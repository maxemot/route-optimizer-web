// Глобальные переменные
// let deliveries = []; // Удаляем, теперь данные на сервере
// let nextDeliveryId = 1; // Удаляем, ID управляет сервер
let geocodedAddresses = {};
const socket = io(); // Создаем один экземпляр сокета для всего приложения

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
// copyRouteLinkBtn.addEventListener('click', copyRouteLink); // Удаляем
const createRouteBtn = document.getElementById('create-route-btn');
createRouteBtn.addEventListener('click', handleCreateRoute);
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
    initializeWebSocket(); // Инициализируем WebSocket
    updateUI();
});

function initializeWebSocket() {
    // const socket = io(); // Удаляем, используем глобальный экземпляр

    socket.on('connect', () => {
        console.log('✅ WebSocket-соединение установлено');
    });

    socket.on('new_delivery', (newDelivery) => {
        console.log('📦 Получена новая доставка по WebSocket:', newDelivery);

        // Проверяем, не отображена ли уже эта доставка
        if (document.querySelector(`tr[data-delivery-id='${newDelivery.id}']`)) {
            console.log(`Доставка #${newDelivery.id} уже есть в таблице.`);
            return;
        }

        // Добавляем новую строку, если ее нет
        const emptyStateRow = deliveriesTbody.querySelector('.empty-state');
        if (emptyStateRow) {
            emptyStateRow.parentElement.innerHTML = '';
        }
        const newRow = createDeliveryRow(newDelivery);
        deliveriesTbody.appendChild(newRow);
        updateUI();
    });

    socket.on('deliveries_deleted', (ids) => {
        console.log(`🗑️ Получено событие на удаление доставок:`, ids);
        ids.forEach(id => {
            const row = document.querySelector(`tr[data-delivery-id='${id}']`);
            if (row) {
                row.remove();
            }
        });
        updateUI(); // Обновляем счетчики и состояние кнопок
    });
    
    socket.on('delete_error', (errorMessage) => {
        console.error('Ошибка удаления:', errorMessage);
        alert(errorMessage);
    });

    socket.on('deliveries_updated', (updatedDeliveries) => {
        console.log('🗺️ Получено обновление доставок по WebSocket:', updatedDeliveries);
        renderDeliveriesTable(updatedDeliveries);
    });
    
    socket.on('route_error', (errorMessage) => {
        console.error('Ошибка создания маршрута:', errorMessage);
        alert(errorMessage);
    });

    socket.on('disconnect', () => {
        console.warn('❌ WebSocket-соединение разорвано');
    });
}


async function loadAndRenderDeliveries() {
    try {
        showLoader('Загрузка доставок...');
        const response = await fetch('/api/deliveries');
        if (!response.ok) {
            throw new Error('Не удалось загрузить данные');
        }
        const deliveries = await response.json();
        renderDeliveriesTable(deliveries);
        hideLoader();
    } catch (error) {
        console.error('Ошибка загрузки доставок:', error);
        hideLoader();
        alert('Не удалось загрузить список доставок. Попробуйте обновить страницу.');
    }
}

function initializeEventListeners() {
    // Кнопки управления
    addDeliveryBtn.addEventListener('click', openDeliveryModal);
    optimizeRouteBtn.addEventListener('click', optimizeSelectedRoute);
    selectAllCheckbox.addEventListener('change', toggleSelectAll);
    deleteDeliveriesBtn.addEventListener('click', handleDeleteSelected);

    // Модальные окна
    const closeButtons = document.querySelectorAll('.close');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            closeModal(modal);
        });
    });

    // Закрытие модального окна по клику вне его
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal') && event.target.classList.contains('show')) {
            closeModal(event.target);
        }
    });

    // Форма добавления доставки
    deliveryAddress.addEventListener('blur', handleAddressBlur);
    deliveryAddress.addEventListener('input', clearAddressError);
    saveDeliveryBtn.addEventListener('click', saveDelivery);
    cancelDeliveryBtn.addEventListener('click', () => closeModal(deliveryModal));

    // Результаты маршрута
    openYandexMapsBtn.addEventListener('click', openRouteInYandexMaps);
    // copyRouteLinkBtn.addEventListener('click', copyRouteLink); // Удаляем
    const createRouteBtn = document.getElementById('create-route-btn');
    createRouteBtn.addEventListener('click', handleCreateRoute);
    routeError.textContent = '';
    openModal(routeModal);
}

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

        // Немедленно отрисовываем новую строку в таблице
        const emptyStateRow = deliveriesTbody.querySelector('.empty-state');
        if (emptyStateRow) {
            emptyStateRow.parentElement.innerHTML = ''; // Убираем сообщение о пустой таблице
        }
        const newRow = createDeliveryRow(savedDelivery);
        deliveriesTbody.appendChild(newRow);
        
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
        ? `<a href="https://yandex.ru/maps/?rtext=${delivery.address}" target="_blank" class="route-link" data-route-id="${delivery.routeId}">№${delivery.routeId}</a>` 
        : '—';

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
    deleteDeliveriesBtn.disabled = checkedBoxes.length === 0;

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

async function handleDeleteSelected() {
    const checkedBoxes = document.querySelectorAll('.delivery-checkbox:checked');
    if (checkedBoxes.length === 0) {
        return;
    }
    
    if (!confirm(`Вы уверены, что хотите удалить ${checkedBoxes.length} доставок?`)) {
        return;
    }
    
    const idsToDelete = Array.from(checkedBoxes).map(cb => parseInt(cb.closest('tr').dataset.deliveryId));
    
    // Отправляем событие на сервер через WebSocket, используя глобальный сокет
    // const socket = io(); // Удаляем, это было ошибкой
    socket.emit('delete_deliveries', idsToDelete);
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
        
        // Больше не генерируем ID и не меняем статус на клиенте
        
        currentRouteData = {
            ...routeData,
            // routeId будет присвоен сервером
            deliveryIds: selectedDeliveries.map(d => d.id), // Передаем ID доставок
            deliveries: selectedDeliveries
        };

        hideLoader();
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
    // routeNumber.textContent = `№${routeData.routeId}`; // Удаляем, т.к. ID еще нет
    routeNumber.textContent = 'Новый маршрут';
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
    // Эта функция теперь используется только для ссылки из таблицы.
    // Для попапа используется yandexMapsUrl из currentRouteData
    if (routeId && typeof routeId === 'string') {
        const route = findRouteById(routeId); // Эта функция может потребовать доработки
        if (route && route.yandexMapsUrl) {
            window.open(route.yandexMapsUrl, '_blank');
        }
    } else {
        if (currentRouteData && currentRouteData.yandexMapsUrl) {
            window.open(currentRouteData.yandexMapsUrl, '_blank');
        }
    }
}

// copyRouteLinkBtn.addEventListener('click', copyRouteLink); // Удаляем

function findRouteById(routeId) {
    // В реальном приложении здесь был бы поиск в базе данных
    // Пока что возвращаем текущий маршрут, если ID совпадает
    if (currentRouteData && currentRouteData.routeId == routeId) {
        return currentRouteData;
    }
    return null;
}

function handleCreateRoute() {
    if (!currentRouteData) return;
    
    socket.emit('create_route', {
        deliveryIds: currentRouteData.deliveryIds,
        // Можно передать и другие данные, если нужно
    });
    
    closeModal(routeModal);
}

// Вспомогательные функции
function showLoader(message = 'Загрузка...') {
    loader.querySelector('p').textContent = message;
    loader.classList.remove('hidden');
}

function hideLoader() {
    loader.classList.add('hidden');
} 