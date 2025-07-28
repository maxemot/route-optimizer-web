/**
 * Скрипт для получения остатков товаров с Ozon Seller API
 * и их отображения в Google Sheets
 */

// Константы для API Ozon
const CLIENT_ID = "1407255";
const API_KEY = "42bce76c-9760-424b-b28b-e2ea35fda3bf";
const API_URL = "https://api-seller.ozon.ru/v4/product/info/stocks";
const API_URL_WAREHOUSE = "https://api-seller.ozon.ru/v1/product/info/stocks-by-warehouse/fbs";
const SHEET_ID = "1eVrO8Bkq90YF2muG5bVNttzfO15i5T-2WRWsCYiqLL4";
const SHEET_NAME = "Оcтатки Ozon";
const SHEET_NAME_WAREHOUSE = "Оcтатки по складам";

/**
 * Основная функция, которую нужно запустить для получения данных
 */
function getOzonStocks() {
  try {
    // Получаем данные о stocks с API Ozon
    const stocksData = fetchStocksFromOzon();
    
    // Обрабатываем полученные данные
    const processedData = processStocksData(stocksData);
    
    // Получаем данные по складам для каждого SKU
    const skuList = extractSkuList(processedData.productMap);
    
    if (skuList.length > 0) {
      // Получаем данные по складам
      const warehouseData = fetchStocksByWarehouse(skuList);
      
      // Обрабатываем полученные данные о складах
      const processedWarehouseData = processWarehouseData(warehouseData);
      
      // Добавляем данные о складах в processedData
      mergeWarehouseData(processedData, processedWarehouseData);
      
      Logger.log("Данные об остатках по складам успешно получены");
    } else {
      Logger.log("Нет SKU для запроса данных о складах");
    }
    
    // Записываем объединенные данные в таблицу
    writeDataToSheet(processedData);
    
    Logger.log("Данные об остатках товаров успешно получены и записаны в таблицу");
  } catch (error) {
    Logger.log("Произошла ошибка: " + error.message);
  }
}

/**
 * Извлекает список SKU из обработанных данных о товарах
 */
function extractSkuList(productMap) {
  const skuList = [];
  
  for (const productId in productMap) {
    const sku = productMap[productId].sku;
    if (sku && !isNaN(parseInt(sku))) {
      skuList.push(parseInt(sku));
    }
  }
  
  Logger.log(`Найдено ${skuList.length} SKU для запроса данных о складах`);
  return skuList;
}

/**
 * Получает данные об остатках по складам для списка SKU
 */
function fetchStocksByWarehouse(skuList) {
  // Подготавливаем запрос
  const requestData = {
    "sku": skuList
  };
  
  // Настройки HTTP запроса
  const options = {
    'method': 'POST',
    'contentType': 'application/json',
    'headers': {
      'Client-Id': CLIENT_ID,
      'Api-Key': API_KEY
    },
    'payload': JSON.stringify(requestData),
    'muteHttpExceptions': true
  };
  
  Logger.log(`Отправка запроса на получение данных о складах для ${skuList.length} SKU`);
  
  // Выполнение запроса
  const response = UrlFetchApp.fetch(API_URL_WAREHOUSE, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();
  
  // Логирование для отладки
  Logger.log("Код ответа API по складам: " + responseCode);
  Logger.log("Краткий ответ API по складам: " + responseText.substring(0, 200) + "...");
  
  if (responseCode !== 200) {
    throw new Error(`Ошибка API Ozon для запроса по складам (код ${responseCode}): ${responseText}`);
  }
  
  // Парсим ответ
  try {
    const parsedData = JSON.parse(responseText);
    
    if (parsedData.result) {
      Logger.log(`Получены данные о ${parsedData.result.length} записях по складам`);
      return parsedData.result;
    } else {
      Logger.log("Ответ API не содержит результатов по складам");
      return [];
    }
  } catch (e) {
    Logger.log("Ошибка парсинга JSON для ответа по складам: " + e.message);
    throw new Error("Некорректный формат ответа от API Ozon по складам: " + e.message);
  }
}

/**
 * Обработка данных по складам
 */
function processWarehouseData(warehouseData) {
  const skuMap = {};
  const warehouseSet = new Set();
  
  // Если нет данных, возвращаем пустой результат
  if (!warehouseData || warehouseData.length === 0) {
    return { skuMap: {}, warehouses: [] };
  }
  
  // Обработка каждой записи
  warehouseData.forEach(item => {
    const sku = item.sku;
    const productId = item.product_id;
    const warehouseName = item.warehouse_name;
    const warehouseId = item.warehouse_id;
    const present = item.present;
    const reserved = item.reserved;
    
    // Добавляем склад в набор уникальных складов
    warehouseSet.add(warehouseName);
    
    // Создаем запись для SKU, если её еще нет
    if (!skuMap[sku]) {
      skuMap[sku] = {
        product_id: productId,
        warehouseData: {}
      };
    }
    
    // Сохраняем количество товара для данного склада
    skuMap[sku].warehouseData[warehouseName] = {
      present: present,
      reserved: reserved,
      warehouse_id: warehouseId
    };
  });
  
  // Преобразуем набор складов в массив
  const warehouses = Array.from(warehouseSet);
  
  return {
    skuMap: skuMap,
    warehouses: warehouses
  };
}

/**
 * Объединяет данные об остатках по типам и по складам
 */
function mergeWarehouseData(processedData, processedWarehouseData) {
  const { skuMap, warehouses } = processedWarehouseData;
  
  // Добавляем склады в список типов
  processedData.warehouses = warehouses;
  
  // Для каждого товара добавляем информацию о складах
  for (const productId in processedData.productMap) {
    const productData = processedData.productMap[productId];
    const sku = productData.sku;
    
    // Инициализируем объект для данных о складах, если его еще нет
    if (!productData.warehouseData) {
      productData.warehouseData = {};
    }
    
    // Если для данного SKU есть информация о складах
    if (sku && skuMap[sku]) {
      // Копируем данные о складах из skuMap в объект товара
      warehouses.forEach(warehouse => {
        if (skuMap[sku].warehouseData[warehouse]) {
          productData.warehouseData[warehouse] = skuMap[sku].warehouseData[warehouse].present;
        } else {
          productData.warehouseData[warehouse] = 0;
        }
      });
    } else {
      // Если данных о складах нет, заполняем нулями
      warehouses.forEach(warehouse => {
        productData.warehouseData[warehouse] = 0;
      });
    }
  }
}

/**
 * Функция для получения данных с API Ozon
 */
function fetchStocksFromOzon() {
  let allItems = [];
  let cursor = null;
  let hasMore = true;
  
  while (hasMore) {
    // Параметры запроса к API
    const requestData = {
      "limit": 100,
      "filter": {
        "visibility": "ALL"
      }
    };
    
    // Добавляем курсор для пагинации, если он есть
    if (cursor) {
      requestData.cursor = cursor;
    }
    
    // Настройки HTTP запроса
    const options = {
      'method': 'POST',
      'contentType': 'application/json',
      'headers': {
        'Client-Id': CLIENT_ID,
        'Api-Key': API_KEY
      },
      'payload': JSON.stringify(requestData),
      'muteHttpExceptions': true
    };
    
    // Выполнение запроса
    const response = UrlFetchApp.fetch(API_URL, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    // Логирование для отладки
    Logger.log("Код ответа API: " + responseCode);
    Logger.log("Краткий ответ API: " + responseText.substring(0, 200) + "...");
    
    if (responseCode !== 200) {
      throw new Error(`Ошибка API Ozon (код ${responseCode}): ${responseText}`);
    }
    
    // Парсим ответ
    try {
      const parsedData = JSON.parse(responseText);
      
      if (parsedData.items && parsedData.items.length > 0) {
        // Добавляем полученные товары к общему списку
        allItems = allItems.concat(parsedData.items);
        Logger.log(`Получено ${parsedData.items.length} товаров, всего: ${allItems.length}`);
        
        // Проверяем, есть ли еще данные
        if (parsedData.cursor) {
          cursor = parsedData.cursor;
        } else {
          hasMore = false;
        }
      } else {
        // Больше нет данных
        hasMore = false;
        Logger.log("Больше нет данных для получения");
      }
    } catch (e) {
      Logger.log("Ошибка парсинга JSON: " + e.message);
      throw new Error("Некорректный формат ответа от API Ozon: " + e.message);
    }
    
    // Добавляем задержку между запросами, чтобы не превысить лимиты API
    if (hasMore) {
      Utilities.sleep(1000);
    }
  }
  
  // Возвращаем все полученные данные
  return { items: allItems };
}

/**
 * Обработка данных, полученных от API
 */
function processStocksData(stocksData) {
  const result = {};
  const typeSet = new Set();
  
  // Если нет данных, возвращаем пустой результат
  if (!stocksData.items || stocksData.items.length === 0) {
    return { productMap: {}, types: [] };
  }
  
  // Обработка каждого товара
  stocksData.items.forEach(item => {
    const productId = item.product_id;
    const offerId = item.offer_id || ""; // Сохраняем offer_id
    
    if (!result[productId]) {
      result[productId] = {
        offer_id: offerId,
        stocksCount: 0, // Количество элементов в массиве stocks
        sku: "", // Значение SKU (будет заполнено ниже)
        stocksByType: {} // Данные о количестве по типам складов
      };
    }
    
    // Обработка данных о складах для каждого товара
    if (item.stocks && item.stocks.length > 0) {
      // Сохраняем количество элементов в массиве stocks
      result[productId].stocksCount = item.stocks.length;
      
      item.stocks.forEach(stock => {
        const type = stock.type;
        const present = stock.present;
        const sku = stock.sku || ""; // Получаем SKU
        
        // Добавляем тип склада в набор уникальных типов
        typeSet.add(type);
        
        // Сохраняем количество товара для данного типа склада
        result[productId].stocksByType[type] = present;
        
        // Сохраняем SKU (берем из первого элемента, если их несколько)
        if (!result[productId].sku && sku) {
          result[productId].sku = sku;
        }
      });
    }
  });
  
  // Преобразуем набор типов в массив
  const types = Array.from(typeSet);
  
  return {
    productMap: result,
    types: types
  };
}

/**
 * Запись данных в таблицу Google Sheets
 */
function writeDataToSheet(processedData) {
  const { productMap, types, warehouses } = processedData;
  
  // Логирование для отладки
  Logger.log("Количество товаров для записи: " + Object.keys(productMap).length);
  Logger.log("Типы складов: " + types.join(", "));
  if (warehouses) {
    Logger.log("Склады: " + warehouses.join(", "));
  }
  
  // Открываем таблицу
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  
  // Если листа нет, создаем его
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  } else {
    // Очищаем лист перед записью новых данных
    sheet.clear();
  }
  
  // Если нет данных, пишем сообщение и выходим
  if (Object.keys(productMap).length === 0 || types.length === 0) {
    sheet.getRange(1, 1).setValue("Нет данных о остатках товаров");
    return;
  }
  
  // Получаем текущую дату и время в формате Google Sheets
  const now = new Date();
  
  // Определяем московские склады
  const moscowWarehouses = ["Склад Подъячево FBS", "Склад RealFbs по России Деловые линии"];
  
  // Подготавливаем заголовки с дополнительными столбцами
  const baseHeaders = ["product_id", "offer_id", "sku", "stocks_count"];
  const typeHeaders = types.map(type => `Тип: ${type}`);
  const warehouseHeaders = warehouses && warehouses.length > 0 ? 
                           warehouses.map(warehouse => `Склад: ${warehouse}`) : [];
  
  // Добавляем столбец "Москва" после всех складов
  const aggregatedHeaders = ["Москва"];
  
  const headers = [...baseHeaders, ...typeHeaders, ...warehouseHeaders, ...aggregatedHeaders];
  
  // Добавляем строку с информацией об обновлении данных
  sheet.getRange(1, 1).setValue("Данные обновлены:");
  sheet.getRange(1, 2).setValue(now);
  sheet.getRange(1, 2).setNumberFormat("dd.MM.yyyy HH:mm:ss");
  
  // Объединяем ячейки в первой строке для лучшего отображения
  if (headers.length > 2) {
    sheet.getRange(1, 3, 1, headers.length - 2).merge();
  }
  
  // Устанавливаем стиль для строки с датой обновления
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground("#f3f3f3")
    .setFontWeight("bold");
  
  // Записываем заголовки таблицы во вторую строку
  sheet.getRange(2, 1, 1, headers.length).setValues([headers]);
  
  // Подготавливаем данные для записи
  const productIds = Object.keys(productMap);
  const rowsData = productIds.map(productId => {
    const productData = productMap[productId];
    
    // Начинаем строку с product_id, offer_id, sku и stocks_count
    const row = [
      productId, 
      productData.offer_id, 
      productData.sku, 
      productData.stocksCount
    ];
    
    // Добавляем количество для каждого типа склада
    types.forEach(type => {
      row.push(productData.stocksByType[type] || 0);
    });
    
    // Добавляем количество для каждого склада (если данные есть)
    let moscowTotal = 0; // Переменная для хранения суммы по московским складам
    
    if (warehouses && warehouses.length > 0 && productData.warehouseData) {
      warehouses.forEach(warehouse => {
        const warehouseValue = productData.warehouseData[warehouse] || 0;
        row.push(warehouseValue);
        
        // Если склад в списке московских, добавляем его значение к сумме
        if (moscowWarehouses.includes(warehouse)) {
          moscowTotal += warehouseValue;
        }
      });
    }
    
    // Добавляем сумму по московским складам
    row.push(moscowTotal);
    
    return row;
  });
  
  // Записываем данные в таблицу (смещаем на одну строку вниз из-за добавленной строки с датой)
  if (rowsData.length > 0) {
    sheet.getRange(3, 1, rowsData.length, headers.length).setValues(rowsData);
  }
  
  // Форматирование заголовков
  sheet.getRange(2, 1, 1, headers.length)
    .setFontWeight("bold")
    .setBackground("#e8eaed");
  
  // Выделяем столбец "Москва" цветом фона
  const moscowColumnIndex = headers.length;
  sheet.getRange(2, moscowColumnIndex, rowsData.length + 1, 1).setBackground("#e6f2ff");
  
  // Добавляем условное форматирование для выделения нулевых значений
  addConditionalFormatting(sheet, baseHeaders.length, headers.length, rowsData.length);
  
  // Закрепляем две верхние строки (дата обновления и заголовки)
  sheet.setFrozenRows(2);
  
  // Автоматически изменяем размеры столбцов
  sheet.autoResizeColumns(1, headers.length);
}

/**
 * Добавляет условное форматирование для выделения нулевых значений
 */
function addConditionalFormatting(sheet, startColumn, totalColumns, rowCount) {
  // Создаем правило для выделения нулевых значений светло-серым цветом
  const rule = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberEqualTo(0)
    .setBackground("#f0f0f0")
    .setRanges([sheet.getRange(3, startColumn, rowCount, totalColumns - startColumn + 1)])
    .build();
  
  // Получаем текущие правила и добавляем новое
  const rules = sheet.getConditionalFormatRules();
  rules.push(rule);
  sheet.setConditionalFormatRules(rules);
}

/**
 * Создает меню в таблице для запуска скрипта
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Ozon')
    .addItem('Получить остатки товаров', 'getOzonStocks')
    .addToUi();
}