// Глобальные переменные
// let deliveries = []; // Удаляем, теперь данные на сервере
// let nextDeliveryId = 1; // Удаляем, ID управляет сервер
let geocodedAddresses = {};
let socket = null; // Глобальная переменная для сокета

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
const createRouteBtn = document.getElementById('create-route-btn'); // Новая кнопка
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
    socket = io(); // ПРАВИЛЬНО: Инициализируем глобальную переменную

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

    socket.on('deliveries_updated', (updatedDeliveries) => {
        console.log('🔄 Получено обновление для доставок:', updatedDeliveries);
        updatedDeliveries.forEach(delivery => {
            const row = document.querySelector(`tr[data-delivery-id='${delivery.id}']`);
            if (row) {
                // Заменяем всю строку целиком, чтобы обновить все данные и обработчики
                const newRow = createDeliveryRow(delivery);
                row.parentNode.replaceChild(newRow, row);
            }
        });
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
    openYandexMapsBtn.addEventListener('click', () => openRouteInYandexMaps(currentRouteData?.yandexMapsUrl));
    createRouteBtn.addEventListener('click', handleCreateRoute);
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
        // id и status будут присвоены сервером
        address: address,
        coordinates: geocodedAddresses[address],
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

        // Отрисовка теперь происходит через WebSocket, поэтому этот блок не нужен.
        // Сервер отправит событие 'new_delivery' всем клиентам (включая этого),
        // и доставка будет добавлена в таблицу в обработчике socket.on('new_delivery').
        
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
        ? `<a href="#" class="route-link" onclick="openRouteFromLink(event)" data-route="${delivery.routeId}">${delivery.routeId}</a>`
        : '';
    const creationDate = delivery.createdAt || ''; // Получаем дату

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
        <td>${creationDate}</td>
        <td>${routeCell}</td>
    `;

    return row;
}

function getStatusBadge(status) {
    const statusLabels = {
        'new': 'Новая',
        'pending': 'Ожидает',
        'ready': 'Готов',
        'in-route': 'В пути',
        'delivered': 'Доставлен'
    };

    return `<span class="status-badge status-${status}">${statusLabels[status] || status}</span>`;
}

function createRouteLink(routeId) {
    if (routeId) {
        return `<a href="#" class="route-link" onclick="openRouteFromLink(event)" data-route="${routeId}">Просмотр</a>`;
    }
    return 'Не назначен';
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    let text = '';
    if (hours > 0) text += `${hours} ч `;
    if (minutes > 0) text += `${minutes} мин`;
    return { value: seconds, text: text.trim() || 'меньше минуты' };
}

function formatDistance(meters) {
    return { value: meters, text: (meters / 1000).toFixed(1) + ' км' };
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
    
    // ID теперь строки (напр. "Д-0007"), parseInt не нужен.
    // Сервер ожидает массив числовых ID, но бэкенд будет парсить строки.
    // ОШИБКА: на самом деле, сокет-обработчик на сервере не парсит ID. 
    // Нужно отправлять числовые ID. Но фронтенд их не знает.
    // Давайте исправим это: будем хранить числовой ID в другом data-атрибуте.
    // Это изменение мы внесем в createDeliveryRow. А здесь пока оставим как есть,
    // но вернемся к этому.
    // --- ВРЕМЕННОЕ РЕШЕНИЕ ---
    // Давайте пока отправлять строковые ID, а на сервере их парсить.
    // Это проще, чем менять фронтенд.
    const idsToDelete = Array.from(checkedBoxes).map(cb => cb.closest('tr').dataset.deliveryId);
    
    // Используем существующее соединение для отправки события
    if (socket && socket.connected) { // Улучшенная проверка
        socket.emit('delete_deliveries', idsToDelete);
    } else {
        console.error('Сокет не инициализирован или не подключен.');
        alert('Не удалось подключиться к серверу для удаления. Пожалуйста, обновите страницу.');
    }
}

// Оптимизация маршрута
async function optimizeSelectedRoute() {
    const checkedBoxes = document.querySelectorAll('.delivery-checkbox:checked');

    // Получаем все доставки с сервера, чтобы иметь актуальные данные
    const response = await fetch('/api/deliveries');
    const deliveries = await response.json();

    const selectedDeliveries = Array.from(checkedBoxes).map(checkbox => {
        const deliveryId = checkbox.dataset.deliveryId; // Просто берем строковый ID
        return { id: deliveryId };
    }).filter(d => d);

    if (selectedDeliveries.length < 1) {
        alert('Выберите минимум 1 доставку для построения маршрута');
        return;
    }

    try {
        showLoader('Оптимизация маршрута...');
        const deliveryIds = selectedDeliveries.map(d => d.id);
        const routeData = await fetchOptimizedRoute(deliveryIds);

        currentRouteData = {
            ...routeData,
            deliveryIds: deliveryIds
        };

        hideLoader();
        showRouteResults(currentRouteData, true); // Показываем модалку с кнопкой "Создать"
        updateUI();

    } catch (error) {
        hideLoader();
        showRouteError('Ошибка при построении маршрута: ' + error.message);
    }
}

async function fetchOptimizedRoute(deliveryIds) {
    const response = await fetch('/api/optimize-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryIds }),
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Ошибка сервера при оптимизации маршрута');
    }

    return await response.json();
}


async function handleCreateRoute() {
    if (!currentRouteData) return;

    try {
        showLoader('Создание маршрута...');
        const response = await fetch('/api/routes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentRouteData),
        });

        if (!response.ok) {
            throw new Error('Не удалось сохранить маршрут на сервере');
        }

        const newRoute = await response.json();
        console.log('🎉 Маршрут успешно создан:', newRoute);

        hideLoader();
        closeModal(routeModal);
        // Обновления в таблице произойдут через WebSocket

    } catch (error) {
        console.error('Ошибка создания маршрута:', error);
        hideLoader();
        alert(error.message);
    }
}


function showRouteResults(routeData, isCreating) {
    routeNumber.textContent = isCreating ? "Новый маршрут" : `Маршрут №${routeData.id}`;
    deliveriesCount.textContent = routeData.deliveryIds ? routeData.deliveryIds.length : routeData.orderedAddresses.length - 2;
    totalDistance.textContent = routeData.totalDistance.text;
    totalDuration.textContent = routeData.totalDuration.text;
    
    // Показываем/скрываем кнопки
    createRouteBtn.style.display = isCreating ? 'inline-block' : 'none';
    openYandexMapsBtn.style.display = routeData.yandexMapsUrl ? 'inline-block' : 'none';

    routeStepsList.innerHTML = '';
    routeData.orderedRoute.forEach((routePoint, index) => {
        const step = document.createElement('div');
        step.className = 'route-step';

        const addressSpan = document.createElement('span');
        addressSpan.className = 'route-step-address';
        addressSpan.textContent = `${index + 1}. ${routePoint.address}`;

        step.appendChild(addressSpan);

        if (routePoint.travelTimeToPoint !== null) {
            const timeSpan = document.createElement('span');
            timeSpan.className = 'route-step-time';
            const distanceText = formatDistance(routePoint.travelDistanceToPoint).text;
            const durationText = formatDuration(routePoint.travelTimeToPoint).text;
            timeSpan.textContent = `(${distanceText}, + ${durationText})`;
            step.appendChild(timeSpan);
        }

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
async function openRouteFromLink(event) {
    event.preventDefault();
    const routeId = event.target.dataset.route;
    if (!routeId) return;

    try {
        showLoader('Загрузка маршрута...');
        const response = await fetch(`/api/routes/${routeId}`);
        if (!response.ok) throw new Error('Маршрут не найден');
        const routeData = await response.json();
        currentRouteData = routeData;
        hideLoader();
        showRouteResults(routeData, false); // Показываем модалку без кнопки "Создать"
    } catch (error) {
        hideLoader();
        alert(error.message);
    }
}

function openRouteInYandexMaps(url) {
    if (url) {
        window.open(url, '_blank');
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