// Глобальные переменные
let geocodedAddresses = {};
let nextRouteId = 1; // Возвращаем для временной генерации ID маршрута
let currentRouteData = null;

// DOM элементы
const addDeliveryBtn = document.getElementById('add-delivery-btn');
const optimizeRouteBtn = document.getElementById('optimize-route-btn');
const selectedCount = document.getElementById('selected-count');
const deliveriesTbody = document.getElementById('deliveries-tbody');
const selectAllCheckbox = document.getElementById('select-all');
const deliveryModal = document.getElementById('delivery-modal');
const routeModal = document.getElementById('route-modal');
const loader = document.getElementById('loader');
const deliveryAddress = document.getElementById('delivery-address');
const deliveryVolume = document.getElementById('delivery-volume');
const deliveryTime = document.getElementById('delivery-time');
const addressCoordinates = document.getElementById('address-coordinates');
const addressError = document.getElementById('address-error');
const saveDeliveryBtn = document.getElementById('save-delivery');
const cancelDeliveryBtn = document.getElementById('cancel-delivery');
const routeNumber = document.getElementById('route-number');
const deliveriesCount = document.getElementById('deliveries-count');
const totalDistance = document.getElementById('total-distance');
const totalDuration = document.getElementById('total-duration');
const routeStepsList = document.getElementById('route-steps-list');
const openYandexMapsBtn = document.getElementById('open-yandex-maps');
const copyRouteLinkBtn = document.getElementById('copy-route-link');
const routeError = document.getElementById('route-error');


// --- Инициализация ---
document.addEventListener('DOMContentLoaded', function() {
    closeAllModals();
    initializeEventListeners();
    loadAndRenderDeliveries();
    updateUI();
});

function initializeEventListeners() {
    addDeliveryBtn.addEventListener('click', openDeliveryModal);
    optimizeRouteBtn.addEventListener('click', optimizeSelectedRoute);
    selectAllCheckbox.addEventListener('change', toggleSelectAll);

    document.querySelectorAll('.close').forEach(btn => {
        btn.addEventListener('click', function() { closeModal(this.closest('.modal')); });
    });

    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) { closeModal(event.target); }
    });

    deliveryAddress.addEventListener('blur', handleAddressBlur);
    deliveryAddress.addEventListener('input', clearAddressError);
    saveDeliveryBtn.addEventListener('click', saveDelivery);
    cancelDeliveryBtn.addEventListener('click', () => closeModal(deliveryModal));
    openYandexMapsBtn.addEventListener('click', openRouteInYandexMaps);
    copyRouteLinkBtn.addEventListener('click', copyRouteLink);
}

// --- Загрузка и отрисовка данных ---
async function loadAndRenderDeliveries() {
    try {
        showLoader('Загрузка доставок...');
        const response = await fetch('/api/deliveries');
        if (!response.ok) throw new Error('Не удалось загрузить данные');
        const deliveries = await response.json();
        renderDeliveriesTable(deliveries);
    } catch (error) {
        alert('Не удалось загрузить список доставок. Попробуйте обновить страницу.');
    } finally {
        hideLoader();
    }
}

function renderDeliveriesTable(deliveries) {
    deliveriesTbody.innerHTML = '';
    if (!deliveries || deliveries.length === 0) {
        deliveriesTbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <span class="empty-state-icon">📦</span>
                    <h3>Доставки не добавлены</h3>
                    <p>Нажмите кнопку "➕ Добавить доставку" чтобы создать первую доставку</p>
                </td>
            </tr>`;
        return;
    }

    deliveries.forEach(delivery => {
        const row = createDeliveryRow(delivery);
        deliveriesTbody.appendChild(row);
    });
    updateSelectionState();
}

function createDeliveryRow(delivery) {
    const row = document.createElement('tr');
    row.dataset.deliveryId = delivery.id;

    const statusBadge = `<span class="status-badge status-${delivery.status}">${delivery.status}</span>`;
    const routeCell = delivery.routeId ? `№${delivery.routeId}` : '';

    row.innerHTML = `
        <td><input type="checkbox" class="delivery-checkbox" onchange="updateSelectionState()"></td>
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

// --- Управление доставками ---
async function saveDelivery() {
    const address = deliveryAddress.value.trim();
    const volume = parseFloat(deliveryVolume.value);
    const timeAtPoint = parseInt(deliveryTime.value);

    if (!address || !geocodedAddresses[address] || isNaN(volume) || volume <= 0 || isNaN(timeAtPoint) || timeAtPoint <= 0) {
        showAddressError('Все поля должны быть корректно заполнены.');
        return;
    }

    const newDeliveryData = {
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

        if (!response.ok) throw new Error('Ошибка при сохранении доставки на сервере');
        
        await loadAndRenderDeliveries(); // Перезагружаем список
        closeModal(deliveryModal);
    } catch (error) {
        alert(error.message);
    } finally {
        hideLoader();
    }
}

// --- Построение маршрута ---
async function optimizeSelectedRoute() {
    const checkedBoxes = document.querySelectorAll('.delivery-checkbox:checked');
    if (checkedBoxes.length < 1) {
        alert('Выберите минимум 1 доставку для построения маршрута');
        return;
    }

    showLoader('Оптимизация маршрута...');
    try {
        const response = await fetch('/api/deliveries');
        const allDeliveries = await response.json();
        
        const selectedDeliveries = Array.from(checkedBoxes).map(checkbox => {
            const deliveryId = parseInt(checkbox.closest('tr').dataset.deliveryId);
            return allDeliveries.find(d => d.id === deliveryId);
        }).filter(Boolean);

        const routeData = await optimizeRoute(selectedDeliveries);
        const routeId = `R-${Date.now()}`;
        
        currentRouteData = { ...routeData, routeId, deliveries: selectedDeliveries };
        showRouteResults(currentRouteData);
    } catch (error) {
        showRouteError('Ошибка при построении маршрута: ' + error.message);
    } finally {
        hideLoader();
    }
}

async function optimizeRoute(selectedDeliveries) {
    const addresses = selectedDeliveries.map(d => d.address);
    const coordinates = selectedDeliveries.map(d => d.coordinates);

    const response = await fetch('/api/optimize-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses, coordinates }),
    });

    if (!response.ok) throw new Error('Ошибка сервера при оптимизации маршрута');
    return await response.json();
}

// --- Геокодирование ---
async function handleAddressBlur() {
    const address = deliveryAddress.value.trim();
    if (!address) return;
    if (geocodedAddresses[address]) {
        displayCoordinates(geocodedAddresses[address]);
        return;
    }

    showAddressLoading();
    try {
        const coordinates = await geocodeAddress(address);
        geocodedAddresses[address] = coordinates;
        displayCoordinates(coordinates);
    } catch (error) {
        showAddressError('Не удалось найти координаты');
    }
}

async function geocodeAddress(address) {
    const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
    });
    if (!response.ok) throw new Error('Ошибка геокодирования');
    const data = await response.json();
    return data.coordinates;
}


// --- UI и вспомогательные функции ---
function updateUI() {
    updateSelectionState();
}

function updateSelectionState() {
    const checkboxes = document.querySelectorAll('.delivery-checkbox');
    const checkedBoxes = document.querySelectorAll('.delivery-checkbox:checked');
    
    selectAllCheckbox.indeterminate = checkedBoxes.length > 0 && checkedBoxes.length < checkboxes.length;
    selectAllCheckbox.checked = checkedBoxes.length === checkboxes.length && checkboxes.length > 0;
    selectedCount.textContent = `Выбрано: ${checkedBoxes.length} доставок`;
    optimizeRouteBtn.disabled = checkedBoxes.length < 1;

    checkboxes.forEach(checkbox => {
        checkbox.closest('tr').classList.toggle('selected', checkbox.checked);
    });
}

function toggleSelectAll() {
    const checkboxes = document.querySelectorAll('.delivery-checkbox');
    checkboxes.forEach(checkbox => { checkbox.checked = selectAllCheckbox.checked; });
    updateSelectionState();
}

function showRouteResults(routeData) {
    routeNumber.textContent = `№${routeData.routeId}`;
    deliveriesCount.textContent = routeData.deliveries.length;
    totalDistance.textContent = routeData.totalDistance.text;
    totalDuration.textContent = routeData.totalDuration.text;
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

function openModal(modal) { modal.style.display = 'flex'; }
function closeModal(modal) {
    modal.style.display = 'none';
    if (modal === deliveryModal) clearDeliveryForm();
}
function clearDeliveryForm() {
    deliveryAddress.value = '';
    deliveryVolume.value = '1.0';
    deliveryTime.value = '15';
    addressCoordinates.textContent = '';
    clearAddressError();
}
function showAddressLoading() {
    addressCoordinates.textContent = 'Поиск...';
    addressCoordinates.style.color = '#718096';
    clearAddressError();
}
function displayCoordinates(coordinates) {
    addressCoordinates.textContent = `📍 ${coordinates}`;
    addressCoordinates.style.color = '#38a169';
}
function showAddressError(message) { addressError.textContent = message; }
function clearAddressError() { addressError.textContent = ''; }
function openRouteInYandexMaps() {
    if (currentRouteData && currentRouteData.yandexMapsUrl) {
        window.open(currentRouteData.yandexMapsUrl, '_blank');
    }
}
function copyRouteLink() {
    if (currentRouteData && currentRouteData.yandexMapsUrl) {
        navigator.clipboard.writeText(currentRouteData.yandexMapsUrl).then(() => {
            copyRouteLinkBtn.textContent = '✓ Скопировано!';
            setTimeout(() => { copyRouteLinkBtn.textContent = '📋 Копировать ссылку'; }, 2000);
        });
    }
}
function showRouteError(message) {
    routeNumber.textContent = '';
    deliveriesCount.textContent = '';
    totalDistance.textContent = '';
    totalDuration.textContent = '';
    routeStepsList.innerHTML = '';
    routeError.textContent = message;
    openModal(routeModal);
}
function showLoader(message = 'Загрузка...') {
    loader.querySelector('p').textContent = message;
    loader.classList.remove('hidden');
}
function hideLoader() { loader.classList.add('hidden'); }
function truncateText(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
} 