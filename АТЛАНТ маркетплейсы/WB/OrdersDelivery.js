function getDeliveryOrdersFromWB() {
    // Константы
    const API_KEY = "eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwMTIwdjEiLCJ0eXAiOiJKV1QifQ.eyJlbnQiOjEsImV4cCI6MTc1NTE0Mzg4MiwiaWQiOiIwMTk0ZmFlMS1iMTI0LTc2M2EtYTI5OS00ZWFkMzBhMDBjNzciLCJpaWQiOjIyODU1MDkwLCJvaWQiOjEzNjE0MjgsInMiOjM4MzgsInNpZCI6Ijg5ZjRiNjllLTFkNDYtNDZiYS1hN2JkLWU0NjRjODczODliMyIsInQiOmZhbHNlLCJ1aWQiOjIyODU1MDkwfQ.7pX4vEgx-hfw6iywBb8V0LncnKJZFI4zEZ7meeIW2I7RNf6Ndnnuf8cokl6HMdEH7jL47ZaeOW_TWl1q4Gsr1Q";
    const SHEET_ID = "1eVrO8Bkq90YF2muG5bVNttzfO15i5T-2WRWsCYiqLL4";
    const SHEET_NAME = "Доставка";
    
    // Получаем все заказы
    const orders = getFBSOrders(API_KEY);
    if (!orders || !orders.orders) {
      Logger.log("❌ Не удалось получить данные о заказах");
      return;
    }
    
    // Получаем ID всех заказов
    const orderIds = orders.orders.map(order => order.id);
    Logger.log(`📦 Всего получено заказов: ${orderIds.length}`);
    
    // Получаем статусы заказов и фильтруем нужные
    const filteredOrders = getOrdersStatus(API_KEY, orderIds, orders);
    if (filteredOrders.length === 0) {
      Logger.log("❌ Нет заказов с нужными статусами");
      // Все равно обновляем таблицу, но с пустыми данными
      saveToSheet([], SHEET_ID, SHEET_NAME);
    } else {
      // Записываем данные в таблицу
      saveToSheet(filteredOrders, SHEET_ID, SHEET_NAME);
    }
  }
  
  function getFBSOrders(apiKey) {
    const url = "https://marketplace-api.wildberries.ru/api/v3/orders";
    
    // Удаляем вычисление дат, так как используем значения по умолчанию (30 дней)
    Logger.log(`🗓️ Запрашиваем заказы за последние 30 дней (значение API по умолчанию)`);
    
    let allOrders = { orders: [] };
    let nextValue = 0;
    let hasMore = true;
    let pageCounter = 0;
    
    // Получаем все страницы заказов с пагинацией
    while (hasMore && pageCounter < 20) { // увеличиваем до 20 страниц для большей надежности
      pageCounter++;
      
      // Используем только параметры limit и next
      const params = {
        limit: 1000,
        next: nextValue
      };
      
      // Добавляем параметры к URL
      const urlWithParams = `${url}?${Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join('&')}`;
      
      const options = {
        method: "GET",
        headers: {
          "Authorization": apiKey,
          "Content-Type": "application/json"
        },
        muteHttpExceptions: true
      };
      
      try {
        Logger.log(`🔄 Страница ${pageCounter}: Отправляем запрос к ${urlWithParams}`);
        const response = UrlFetchApp.fetch(urlWithParams, options);
        const responseCode = response.getResponseCode();
        const contentText = response.getContentText();
        
        Logger.log(`📡 Код ответа: ${responseCode}`);
        
        if (responseCode !== 200) {
          Logger.log(`❌ Ошибка API: ${contentText}`);
          return null;
        }
        
        const data = JSON.parse(contentText);
        if (!data || !data.orders) {
          Logger.log("❌ Некорректный формат данных в ответе");
          Logger.log(`Полученные данные: ${JSON.stringify(data)}`);
          return null;
        }
        
        // Добавляем полученные заказы к общему массиву
        allOrders.orders = allOrders.orders.concat(data.orders);
        
        // Проверяем, есть ли еще страницы
        Logger.log(`Значение next в ответе: ${data.next}, текущее: ${nextValue}`);
        
        if (data.next !== undefined && data.next !== null && data.next !== nextValue && data.next !== 0) {
          nextValue = data.next;
          Logger.log(`✅ Получена страница ${pageCounter} с ${data.orders.length} заказами. Следующая страница: ${nextValue}`);
        } else {
          hasMore = false;
          Logger.log(`✅ Получена последняя страница ${pageCounter} с ${data.orders.length} заказами`);
        }
        
      } catch (e) {
        Logger.log(`❌ Ошибка при получении заказов на странице ${pageCounter}:`);
        Logger.log(`Тип ошибки: ${e.name}`);
        Logger.log(`Сообщение: ${e.message}`);
        Logger.log(`Стек: ${e.stack}`);
        hasMore = false; // Прекращаем цикл при ошибке
      }
    }
    
    if (pageCounter >= 20) {
      Logger.log(`⚠️ Достигнут лимит запросов (20 страниц). Дальнейшая пагинация остановлена.`);
    }
    
    Logger.log(`✅ Всего успешно получено: ${allOrders.orders.length} заказов за ${pageCounter} страниц запросов`);
    return allOrders;
  }
  
  function getOrdersStatus(apiKey, orderIds, allOrders) {
    const url = "https://marketplace-api.wildberries.ru/api/v3/orders/status";
    const batchSize = 1000;
    const filteredOrders = [];
    const statusCounts = {};
    
    // Создаем карту заказов для быстрого поиска
    const ordersMap = {};
    
    // Проверяем структуру данных и создаем карту заказов
    if (Array.isArray(allOrders)) {
      // Если allOrders - это массив заказов
      allOrders.forEach(order => {
        if (order && order.id) {
          ordersMap[order.id] = order;
        }
      });
      Logger.log(`📦 Создана карта из ${Object.keys(ordersMap).length} заказов из массива`);
    } else if (allOrders && allOrders.orders && Array.isArray(allOrders.orders)) {
      // Если allOrders - это объект с полем orders, которое является массивом
      allOrders.orders.forEach(order => {
        if (order && order.id) {
          ordersMap[order.id] = order;
        }
      });
      Logger.log(`📦 Создана карта из ${Object.keys(ordersMap).length} заказов из allOrders.orders`);
    } else {
      Logger.log("❌ Некорректная структура данных заказов!");
      Logger.log(`Тип allOrders: ${typeof allOrders}`);
      Logger.log(`Значение allOrders: ${JSON.stringify(allOrders).substring(0, 200)}...`);
      return [];
    }
    
    // Обрабатываем заказы батчами
    for (let i = 0; i < orderIds.length; i += batchSize) {
      const batch = orderIds.slice(i, i + batchSize);
      Logger.log(`🔄 Обработка статусов для батча ${i}-${i+batch.length-1} (${batch.length} заказов)`);
      
      const options = {
        method: "POST",
        headers: {
          "Authorization": apiKey,
          "Content-Type": "application/json"
        },
        payload: JSON.stringify({ orders: batch }),
        muteHttpExceptions: true
      };
      
      try {
        const response = UrlFetchApp.fetch(url, options);
        const responseCode = response.getResponseCode();
        const contentText = response.getContentText();
        
        if (responseCode !== 200) {
          Logger.log(`❌ Ошибка API статусов: ${contentText}`);
          continue;
        }
        
        const statusData = JSON.parse(contentText);
        
        if (!statusData || !statusData.orders) {
          Logger.log("❌ Некорректный формат данных в ответе статусов");
          continue;
        }
        
        // Обрабатываем статусы
        statusData.orders.forEach(status => {
          // Подсчет статистики
          const statusPair = `${status.supplierStatus}/${status.wbStatus}`;
          statusCounts[statusPair] = (statusCounts[statusPair] || 0) + 1;
          
          // Фильтруем нужные заказы
          if (status.wbStatus === "waiting" && 
              (status.supplierStatus === "complete" || status.supplierStatus === "confirm")) {
            
            // Используем карту вместо метода find
            const orderData = ordersMap[status.id];
            if (orderData) {
              filteredOrders.push({
                'Номер заказа': orderData.id,
                'Артикул WB': orderData.article || '',
                'Баркод': orderData.skus?.[0] || '',  // Пробуем взять первый SKU как баркод
                'Цена': orderData.price || 0,
                'Дата заказа': orderData.createdAt || '',
                'Статус': `${status.supplierStatus}/waiting`
              });
            } else {
              Logger.log(`⚠️ Не найдены полные данные для заказа ID: ${status.id}`);
            }
          }
        });
        
        Logger.log(`✅ Успешно обработаны статусы для ${statusData.orders.length} заказов`);
        
      } catch (e) {
        Logger.log(`❌ Ошибка при получении статусов batch ${i}: ${e.toString()}`);
      }
    }
    
    // Выводим статистику
    Logger.log("\n📊 Статистика по статусам:");
    Logger.log("----------------------------");
    Logger.log("| Статус поставщика | Статус WB | Количество |");
    Logger.log("----------------------------");
    
    Object.entries(statusCounts).forEach(([status, count]) => {
      const [supplierStatus, wbStatus] = status.split('/');
      Logger.log(`| ${supplierStatus.padEnd(17)} | ${wbStatus.padEnd(9)} | ${count.toString().padEnd(10)} |`);
    });
    Logger.log("----------------------------");
    
    // Добавляем доп. проверку для конкретного статуса
    const waitingCompleteCounts = statusCounts['complete/waiting'] || 0;
    Logger.log(`\n🔍 Заказы в статусе complete/waiting: ${waitingCompleteCounts}`);
    
    Logger.log(`\n✅ Найдено заказов с нужными статусами: ${filteredOrders.length}`);
    return filteredOrders;
  }
  
  function saveToSheet(orders, sheetId, sheetName) {
    try {
      const ss = SpreadsheetApp.openById(sheetId);
      const sheet = ss.getSheetByName(sheetName);
      
      if (!sheet) {
        Logger.log(`❌ Не найден лист "${sheetName}"`);
        return;
      }
      
      // Очищаем лист
      sheet.clear();
      
      // Добавляем дату и время обновления
      const now = new Date();
      sheet.getRange(1, 1).setValue("Обновлено:");
      sheet.getRange(1, 2).setValue(`${now.toLocaleDateString('ru-RU')} ${now.toLocaleTimeString('ru-RU')}`);
      
      // Форматируем строку обновления
      sheet.getRange(1, 1, 1, 2).setFontWeight("bold").setBackground("#f3f3f3");
      
      // Пустая строка после времени обновления
      const startRow = 3;
      
      // Заголовки
      const headers = [
        'Номер заказа',
        'Артикул WB',
        'Баркод',
        'Цена',
        'Дата заказа',
        'Статус'
      ];
      
      // Подготавливаем данные
      const data = [headers];
      orders.forEach(order => {
        data.push([
          order['Номер заказа'],
          order['Артикул WB'],
          order['Баркод'],
          order['Цена'],
          order['Дата заказа'],
          order['Статус']
        ]);
      });
      
      // Записываем данные
      const range = sheet.getRange(startRow, 1, data.length, headers.length);
      range.setValues(data);
      
      // Форматируем заголовки
      const headerRange = sheet.getRange(startRow, 1, 1, headers.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#e6e6e6");
      
      // Автоматическая ширина столбцов
      sheet.autoResizeColumns(1, headers.length);
      
      Logger.log(`✅ Данные сохранены в таблицу`);
      Logger.log(`📊 Всего заказов: ${orders.length}`);
      
    } catch (e) {
      Logger.log(`❌ Ошибка при сохранении в таблицу: ${e.toString()}`);
    }
  }