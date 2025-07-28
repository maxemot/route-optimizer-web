// Глобальные переменные
let addressCounter = 2;
let geocodedAddresses = new Map(); // Кэш для координат

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Добавляем слушатели событий для начальных полей
    setupAddressListeners();
    
    // Проверяем готовность формы при каждом изменении
    document.addEventListener('input', checkFormReadiness);
});

// Настройка слушателей событий для полей адресов
function setupAddressListeners() {
    const allInputs = document.querySelectorAll('input[type="text"]');
    allInputs.forEach(input => {
        // Геокодирование при потере фокуса
        input.addEventListener('blur', handleAddressBlur);
        
        // Сброс координат при изменении адреса
        input.addEventListener('input', handleAddressInput);
    });
}

// Обработчик ввода адреса
function handleAddressInput(event) {
    const input = event.target;
    const coordsId = getCoordinatesId(input.id);
    const coordsDisplay = document.getElementById(coordsId);
    const inputGroup = input.closest('.address-input-group');
    
    if (coordsDisplay) {
        coordsDisplay.style.display = 'none';
        coordsDisplay.textContent = '';
        inputGroup.classList.remove('has-coordinates');
    }
}

// Обработчик потери фокуса (геокодирование)
async function handleAddressBlur(event) {
    const input = event.target;
    const address = input.value.trim();
    
    if (!address) return;
    
    // Проверяем кэш
    if (geocodedAddresses.has(address)) {
        displayCoordinates(input, geocodedAddresses.get(address));
        return;
    }
    
    // Показываем индикатор загрузки
    showLoadingForInput(input, true);
    
    try {
        const response = await fetch('/api/geocode', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ address: address })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Сохраняем в кэш и отображаем
            geocodedAddresses.set(address, data);
            displayCoordinates(input, data);
        } else {
            showErrorForInput(input, data.error);
        }
    } catch (error) {
        showErrorForInput(input, 'Ошибка соединения с сервером');
    } finally {
        showLoadingForInput(input, false);
    }
}

// Отображение координат
function displayCoordinates(input, data) {
    const coordsId = getCoordinatesId(input.id);
    const coordsDisplay = document.getElementById(coordsId);
    const inputGroup = input.closest('.address-input-group');
    
    if (coordsDisplay) {
        coordsDisplay.textContent = `📍 ${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`;
        coordsDisplay.style.display = 'block';
        coordsDisplay.classList.add('visible');
        inputGroup.classList.add('has-coordinates');
    }
}

// Показ ошибки для поля ввода
function showErrorForInput(input, errorMessage) {
    const coordsId = getCoordinatesId(input.id);
    const coordsDisplay = document.getElementById(coordsId);
    const inputGroup = input.closest('.address-input-group');
    
    if (coordsDisplay) {
        coordsDisplay.textContent = `❌ ${errorMessage}`;
        coordsDisplay.style.display = 'block';
        coordsDisplay.style.color = '#dc3545';
        inputGroup.classList.remove('has-coordinates');
    }
}

// Показ индикатора загрузки
function showLoadingForInput(input, show) {
    const coordsId = getCoordinatesId(input.id);
    const coordsDisplay = document.getElementById(coordsId);
    
    if (coordsDisplay) {
        if (show) {
            coordsDisplay.textContent = '🔄 Определение координат...';
            coordsDisplay.style.display = 'block';
            coordsDisplay.style.color = '#667eea';
        } else {
            coordsDisplay.style.color = '#666';
        }
    }
}

// Получение ID элемента для отображения координат
function getCoordinatesId(inputId) {
    if (inputId === 'start-address') {
        return 'start-coords';
    }
    return inputId.replace('address', 'coords');
}

// Добавление нового поля адреса
function addAddress() {
    addressCounter++;
    const container = document.getElementById('additional-addresses');
    
    const newAddressGroup = document.createElement('div');
    newAddressGroup.className = 'address-input-group fade-in';
    newAddressGroup.innerHTML = `
        <label for="address-${addressCounter}">Адрес ${addressCounter}:</label>
        <input type="text" id="address-${addressCounter}" placeholder="Введите адрес">
        <div class="coordinates-display" id="coords-${addressCounter}"></div>
        <button type="button" class="remove-address" onclick="removeAddress(${addressCounter})">✕</button>
    `;
    
    container.appendChild(newAddressGroup);
    
    // Настраиваем слушатели для нового поля
    const newInput = newAddressGroup.querySelector('input');
    newInput.addEventListener('blur', handleAddressBlur);
    newInput.addEventListener('input', handleAddressInput);
    
    // Фокусируемся на новом поле
    newInput.focus();
    
    checkFormReadiness();
}

// Удаление поля адреса
function removeAddress(addressNumber) {
    const addressGroup = document.querySelector(`#address-${addressNumber}`).closest('.address-input-group');
    addressGroup.remove();
    checkFormReadiness();
}

// Проверка готовности формы
function checkFormReadiness() {
    const inputs = document.querySelectorAll('input[type="text"]');
    const filledInputs = Array.from(inputs).filter(input => input.value.trim() !== '');
    const optimizeBtn = document.getElementById('optimize-btn');
    
    // Нужно минимум 2 заполненных адреса (начальный + 1)
    if (filledInputs.length >= 2) {
        optimizeBtn.disabled = false;
    } else {
        optimizeBtn.disabled = true;
    }
}

// Основная функция оптимизации маршрута
async function optimizeRoute() {
    const inputs = document.querySelectorAll('input[type="text"]');
    const addresses = [];
    const coordinates = [];
    
    // Собираем данные
    for (const input of inputs) {
        const address = input.value.trim();
        if (!address) continue;
        
        // Проверяем, есть ли координаты для этого адреса
        if (!geocodedAddresses.has(address)) {
            alert(`Пожалуйста, дождитесь определения координат для адреса: "${address}"`);
            input.focus();
            return;
        }
        
        addresses.push(address);
        coordinates.push(geocodedAddresses.get(address).coordinates);
    }
    
    if (addresses.length < 2) {
        alert('Необходимо заполнить минимум 2 адреса');
        return;
    }
    
    // Показываем секцию результатов с лоадером
    const resultSection = document.getElementById('result-section');
    const loader = document.getElementById('loader');
    const results = document.getElementById('results');
    const error = document.getElementById('error');
    
    resultSection.style.display = 'block';
    loader.style.display = 'block';
    results.style.display = 'none';
    error.style.display = 'none';
    
    // Скроллим к результатам
    resultSection.scrollIntoView({ behavior: 'smooth' });
    
    try {
        const response = await fetch('/api/optimize-route', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                addresses: addresses,
                coordinates: coordinates
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showResults(data);
        } else {
            showError(data.error);
        }
    } catch (error) {
        showError('Ошибка соединения с сервером');
    }
}

// Отображение результатов
function showResults(result) {
    const loader = document.getElementById('loader');
    const results = document.getElementById('results');
    
    loader.style.display = 'none';
    results.style.display = 'block';
    results.classList.add('fade-in');
    
    // Отображаем маршрут
    const routeContainer = document.getElementById('route-steps');
    routeContainer.innerHTML = '';
    
    result.orderedAddresses.forEach((address, index) => {
        const tag = document.createElement('div');
        tag.className = 'address-tag';
        tag.textContent = address;
        routeContainer.appendChild(tag);
        
        if (index < result.orderedAddresses.length - 1) {
            const arrow = document.createElement('div');
            arrow.className = 'arrow';
            arrow.textContent = '↓';
            routeContainer.appendChild(arrow);
        }
    });
    
    // Отображаем информацию о маршруте
    document.getElementById('total-distance').textContent = 'Общее расстояние: ' + result.totalDistance.text;
    document.getElementById('total-duration').textContent = 'Общее время в пути: ' + result.totalDuration.text;
    
    // Настраиваем кнопки
    const openLinkBtn = document.getElementById('open-link-btn');
    const copyLinkBtn = document.getElementById('copy-link-btn');
    
    openLinkBtn.href = result.yandexMapsUrl;
    copyLinkBtn.onclick = () => copyToClipboard(result.yandexMapsUrl);
}

// Отображение ошибки
function showError(errorMessage) {
    const loader = document.getElementById('loader');
    const error = document.getElementById('error');
    
    loader.style.display = 'none';
    error.style.display = 'block';
    error.textContent = 'Произошла ошибка: ' + errorMessage;
}

// Копирование ссылки в буфер обмена
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        
        const status = document.getElementById('copy-status');
        status.textContent = 'Ссылка скопирована!';
        status.classList.add('visible');
        
        setTimeout(() => {
            status.classList.remove('visible');
        }, 2000);
    } catch (err) {
        console.error('Не удалось скопировать текст: ', err);
        
        const status = document.getElementById('copy-status');
        status.textContent = 'Не удалось скопировать. Попробуйте вручную.';
        status.style.color = '#dc3545';
        status.classList.add('visible');
        
        setTimeout(() => {
            status.classList.remove('visible');
            status.style.color = '#28a745';
        }, 3000);
    }
} 