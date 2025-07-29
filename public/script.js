document.addEventListener('DOMContentLoaded', () => {
    // --- Глобальные переменные и константы ---
    const deliveryTableBody = document.querySelector('#delivery-table tbody');
    const selectAllCheckbox = document.getElementById('select-all');
    const deleteDeliveriesBtn = document.getElementById('delete-deliveries-btn');
    const addDeliveryBtn = document.getElementById('add-delivery-btn');
    const optimizeRouteBtn = document.getElementById('optimize-route-btn');
    const selectionInfo = document.querySelector('.selection-info');
    const createRouteBtn = document.getElementById('create-route-btn');
    const deleteRoutesBtn = document.getElementById('delete-routes-btn');

    let deliveries = [];
    let selectedDeliveries = new Set();
    let currentRouteData = null;

    // Модальные окна
    const modals = {
        'add-delivery-modal': document.getElementById('delivery-modal'),
        'route-results-modal': document.getElementById('route-modal'),
    };
    const routeSummary = document.getElementById('route-summary');
    const routeStepsList = document.getElementById('route-steps-list');
    const openYandexMapsBtn = document.getElementById('open-yandex-maps');
    const routeError = document.getElementById('route-error');

    // --- Загрузка данных через REST API ---
    async function loadDeliveries() {
        try {
            console.log('🔄 Загружаем данные через REST API...');
            const response = await fetch('/api/deliveries');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('✅ Получены данные через REST API:', data);
            deliveries = data;
            renderTable();
            updateSelectionState();
        } catch (error) {
            console.error('❌ Ошибка загрузки данных:', error);
            // Показываем сообщение об ошибке в таблице
            deliveryTableBody.innerHTML = '<tr><td colspan="9" class="text-center">Ошибка загрузки данных</td></tr>';
        }
    }

    // Загружаем данные при старте
    loadDeliveries();

    // --- Сокеты (оставляем для real-time обновлений) ---
    const socket = io();

    socket.on('connect', () => {
        console.log('Соединение с сервером установлено');
    });

    socket.on('deliveries_updated', (updatedDeliveries) => {
        console.log('Получены данные по WebSocket (deliveries_updated):', updatedDeliveries);
        deliveries = updatedDeliveries;
        renderTable();
        updateSelectionState();
    });

    socket.on('release_time_updated', (releaseTime) => {
        document.getElementById('release-time-display').textContent = `Сборка проекта от: ${new Date(releaseTime).toLocaleString()}`;
    });

    socket.on('disconnect', () => {
        console.log('Соединение с сервером потеряно');
    });

    // --- Функции для работы с таблицей ---

    function renderTable() {
        deliveryTableBody.innerHTML = '';
        if (deliveries.length === 0) {
            deliveryTableBody.innerHTML = '<tr><td colspan="7" class="text-center">Нет данных для отображения</td></tr>';
            return;
        }

        deliveries.sort((a, b) => a.id.localeCompare(b.id));

        deliveries.forEach(delivery => {
            const row = document.createElement('tr');
            row.dataset.deliveryId = delivery.id;
            if (selectedDeliveries.has(delivery.id)) {
                row.classList.add('selected');
            }

            row.innerHTML = `
                <td><input type="checkbox" class="row-checkbox" ${selectedDeliveries.has(delivery.id) ? 'checked' : ''}></td>
                <td>${delivery.id}</td>
                <td>${delivery.address}</td>
                <td>${delivery.timeAtPoint} мин</td>
                <td><span class="status status-${delivery.status}">${getStatusText(delivery.status)}</span></td>
                <td class="route-id-cell">${delivery.routeId || '—'}</td>
                <td>${delivery.createdAt}</td>
            `;
            deliveryTableBody.appendChild(row);
        });

        // Повторно навешиваем обработчики на новые строки
        deliveryTableBody.querySelectorAll('.row-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', handleRowSelection);
        });
        deliveryTableBody.querySelectorAll('.route-id-cell').forEach(cell => {
            if (cell.textContent !== '—') {
                cell.classList.add('clickable');
                cell.addEventListener('click', handleRouteIdClick);
            }
        });
    }

    function handleRowSelection(event) {
        const checkbox = event.target;
        const row = checkbox.closest('tr');
        const deliveryId = row.dataset.deliveryId;

        if (checkbox.checked) {
            selectedDeliveries.add(deliveryId);
            row.classList.add('selected');
        } else {
            selectedDeliveries.delete(deliveryId);
            row.classList.remove('selected');
        }
        updateSelectionState();
    }
    
    function toggleSelectAll() {
        const checkboxes = deliveryTableBody.querySelectorAll('.row-checkbox');
        const allRowsSelected = selectAllCheckbox.checked;
        
        checkboxes.forEach(checkbox => {
            checkbox.checked = allRowsSelected;
            const deliveryId = checkbox.closest('tr').dataset.deliveryId;
            if (allRowsSelected) {
                selectedDeliveries.add(deliveryId);
                 checkbox.closest('tr').classList.add('selected');
            } else {
                selectedDeliveries.delete(deliveryId);
                checkbox.closest('tr').classList.remove('selected');
            }
        });
        updateSelectionState();
    }
    
    function updateSelectionState() {
        const selectedCount = selectedDeliveries.size;
        
        // Управление состоянием основного чекбокса
        const totalRows = deliveryTableBody.querySelectorAll('.row-checkbox').length;
        selectAllCheckbox.checked = selectedCount > 0 && selectedCount === totalRows;
        selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalRows;

        // Управление состоянием кнопок
        const hasNew = Array.from(selectedDeliveries).some(id => {
            const delivery = deliveries.find(d => d.id === id);
            return delivery && delivery.status === 'new';
        });

        optimizeRouteBtn.disabled = !hasNew;
        deleteDeliveriesBtn.disabled = selectedCount === 0;
        
        const hasRoute = Array.from(selectedDeliveries).some(id => {
            const delivery = deliveries.find(d => d.id === id);
            return delivery && delivery.routeId;
        });
        
        deleteRoutesBtn.style.display = hasRoute ? 'inline-block' : 'none';

        if (selectedCount > 0) {
            selectionInfo.textContent = `Выбрано: ${selectedCount}`;
        } else {
            selectionInfo.textContent = '';
        }
    }


    // --- Функции для работы с API ---

    async function addDelivery(address, timeAtPoint) {
        try {
            const response = await fetch('/api/deliveries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, timeAtPoint })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Ошибка при добавлении доставки');
            }
            showToast('Доставка успешно добавлена');
            closeModal('add-delivery-modal');
            document.getElementById('add-delivery-form').reset();
            // Данные обновятся через WebSocket
        } catch (error) {
            console.error('Ошибка:', error);
            showToast(error.message, 'error');
        }
    }
    
    async function handleDeleteDeliveries() {
        const idsToDelete = Array.from(selectedDeliveries);
        if (idsToDelete.length === 0) {
            showToast('Не выбрано ни одной доставки для удаления.', 'warning');
            return;
        }

        const userConfirmed = confirm(`Вы уверены, что хотите удалить ${idsToDelete.length} доставок?`);
        if (userConfirmed) {
            try {
                const response = await fetch('/api/deliveries', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: idsToDelete })
                });
                const result = await response.json();
                if (response.ok) {
                    showToast(`Успешно удалено ${result.deletedCount} доставок.`);
                    selectedDeliveries.clear();
                    // Обновление через WebSocket
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                console.error('Ошибка при удалении доставок:', error);
                showToast(`Ошибка: ${error.message}`, 'error');
            }
        }
    }

    async function optimizeSelectedRoute() {
        const deliveryIds = Array.from(selectedDeliveries);
        if (deliveryIds.length === 0) {
            showToast('Выберите доставки для оптимизации.', 'warning');
            return;
        }
        
        console.log("Оптимизация для ID:", deliveryIds);

        try {
            const response = await fetch('/api/optimize-route', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deliveryIds })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Ошибка на сервере');
            }
            console.log("Ответ от сервера:", data);
            currentRouteData = data; 
            showRouteResults(data);
        } catch (error) {
            console.error('Ошибка при оптимизации маршрута:', error);
            showToast(`Ошибка оптимизации: ${error.message}`, 'error');
            routeError.textContent = `Ошибка: ${error.message}`;
            openModal('route-results-modal');
        }
    }

    async function handleDeleteRoutes() {
        const routeIdsToDelete = new Set();
        selectedDeliveries.forEach(deliveryId => {
            const delivery = deliveries.find(d => d.id === deliveryId);
            if (delivery && delivery.routeId) {
                routeIdsToDelete.add(delivery.routeId);
            }
        });

        const uniqueRouteIds = Array.from(routeIdsToDelete);

        if (uniqueRouteIds.length === 0) {
            showToast('Не выбрано ни одного маршрута для удаления.', 'warning');
            return;
        }

        const userConfirmed = confirm(`Вы уверены, что хотите удалить ${uniqueRouteIds.length} маршрут(ов)? Это действие отменит их для всех связанных доставок.`);

        if (userConfirmed) {
            try {
                const response = await fetch('/api/routes', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ routeIds: uniqueRouteIds })
                });
                const result = await response.json();
                if (response.ok) {
                    showToast(`Успешно удалено ${result.deletedCount} маршрут(ов).`);
                    selectedDeliveries.clear();
                    updateSelectionState();
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                console.error('Ошибка при удалении маршрутов:', error);
                showToast(`Ошибка: ${error.message}`, 'error');
            }
        }
    }

    function handleCreateRoute() {
        const routesToCreate = currentRouteData;
        console.log("Отправка данных для создания маршрута:", routesToCreate);
    
        if (!routesToCreate || routesToCreate.length === 0) {
            showToast('Нет данных о маршруте для создания.', 'error');
            return;
        }
    
        fetch('/api/routes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ routes: routesToCreate }),
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.message); });
            }
            return response.json();
        })
        .then(data => {
            showToast('Маршруты успешно созданы');
            closeModal('route-results-modal');
            selectedDeliveries.clear();
            // Данные обновятся через сокет
        })
        .catch(error => {
            console.error('Ошибка при создании маршрута:', error);
            showToast(`Ошибка: ${error.message}`, 'error');
        });
    }

    async function handleRouteIdClick(event) {
        const routeId = event.target.textContent;
        try {
            const response = await fetch(`/api/routes/${routeId}`);
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message);
            }
            const routeDetails = await response.json();
            currentRouteData = [routeDetails];
            showRouteResults([routeDetails], true); // true - режим просмотра
        } catch (error) {
            console.error(`Ошибка при загрузке маршрута ${routeId}:`, error);
            showToast(`Не удалось загрузить маршрут: ${error.message}`, 'error');
        }
    }

    // --- Функции для работы с UI ---

    function showRouteResults(routesData, isViewing = false) {
        routeStepsList.innerHTML = '';
        routeSummary.style.display = 'none';
        routeError.textContent = '';
        openYandexMapsBtn.style.display = 'none';
    
        if (!routesData || routesData.length === 0) {
            routeError.textContent = 'Нет данных для отображения.';
            openModal('route-results-modal');
            return;
        }
    
        routesData.forEach((route, index) => {
            const routeChunkContainer = document.createElement('div');
            routeChunkContainer.className = 'route-chunk';
    
            const titleContainer = document.createElement('div');
            titleContainer.className = 'route-chunk-title';
    
            const title = document.createElement('h4');
            const routeId = route.id ? formatRouteId(route.id) : `Маршрут ${index + 1}`;
            title.textContent = routeId;
            titleContainer.appendChild(title);
    
            const mapLink = document.createElement('a');
            mapLink.href = route.yandexMapsUrl;
            mapLink.target = '_blank';
            mapLink.className = 'btn btn-primary btn-map';
            mapLink.textContent = 'Карта';
            titleContainer.appendChild(mapLink);
            routeChunkContainer.appendChild(titleContainer);
    
            const summary = document.createElement('p');
            summary.innerHTML = `Расстояние: <strong>${(route.totalDistanceByRoad / 1000).toFixed(1)} км</strong>, Время: <strong>${formatDuration(route.totalDuration)}</strong>`;
            routeChunkContainer.appendChild(summary);
    
            const stepsList = document.createElement('ol');
            stepsList.className = 'route-steps';
    
            route.orderedRoute.forEach((step, stepIndex) => {
                const li = document.createElement('li');
                li.className = 'route-step';
    
                const addressSpan = document.createElement('span');
                addressSpan.className = 'route-step-address';
                addressSpan.textContent = step.address === 'Поповка, Московская обл., 141892' ? 'Поповка' : step.address;
                li.appendChild(addressSpan);
    
                if (step.travelTimeToPoint != null) {
                    const timeSpan = document.createElement('span');
                    timeSpan.className = 'route-step-time';
                    const serviceTimeHtml = step.timeAtPoint ? ` <span class="service-time">+ ${step.timeAtPoint}мин</span>` : '';
                    timeSpan.innerHTML = `${(step.distanceToPointByRoad / 1000).toFixed(1)}км, ${formatDuration(step.travelTimeToPoint)}${serviceTimeHtml}`;
                    li.appendChild(timeSpan);
                }
                stepsList.appendChild(li);
            });
    
            routeChunkContainer.appendChild(stepsList);
            routeStepsList.appendChild(routeChunkContainer);
        });
    
        createRouteBtn.style.display = isViewing ? 'none' : 'block';
        openModal('route-results-modal');
    }

    // --- Модальные окна ---
    
    function openModal(modalId) {
        const modal = modals[modalId];
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    function closeModal(modalId) {
        const modal = modals[modalId];
        if (modal) {
            modal.style.display = 'none';
        }
    }

    function closeAllModals() {
        Object.values(modals).forEach(modal => modal.style.display = 'none');
    }

    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            closeAllModals();
        }
    };
    
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', (event) => {
            const modalId = event.target.closest('.modal').id;
            closeModal(modalId);
        });
    });

    document.getElementById('save-delivery').addEventListener('click', function(event) {
        event.preventDefault();
        const address = document.getElementById('delivery-address').value;
        const timeAtPoint = parseInt(document.getElementById('delivery-time').value, 10);
        if (address && timeAtPoint > 0) {
            addDelivery(address, timeAtPoint);
        }
    });

    // --- Вспомогательные функции ---

    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => {
            toast.className = toast.className.replace('show', '');
        }, 3000);
    }
    
    function getStatusText(status) {
        const statuses = {
            'new': 'Новая',
            'in-progress': 'В пути',
            'delivered': 'Доставлена'
        };
        return statuses[status] || status;
    }

    function formatDeliveryId(id) {
        return `Д-${String(id).padStart(4, '0')}`;
    }

    function formatRouteId(id) {
        return `М-${String(id).padStart(4, '0')}`;
    }

    function formatDuration(seconds) {
        if (seconds === null || seconds === undefined) return '';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        let result = '';
        if (h > 0) result += `${h}ч `;
        if (m > 0) result += `${m}мин`;
        return result.trim() || '0мин';
    }

    function initializeEventListeners() {
        selectAllCheckbox.addEventListener('change', toggleSelectAll);
        deleteDeliveriesBtn.addEventListener('click', handleDeleteDeliveries);
        deleteRoutesBtn.addEventListener('click', handleDeleteRoutes);
        addDeliveryBtn.addEventListener('click', () => openModal('add-delivery-modal'));
        optimizeRouteBtn.addEventListener('click', optimizeSelectedRoute);
        createRouteBtn.addEventListener('click', handleCreateRoute);
    }

    // --- Инициализация ---
    closeAllModals();
    initializeEventListeners();
}); 