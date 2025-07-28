/**
 * Скрипт для получения заказов Ozon через API Seller
 * и загрузки их в Google таблицу
 */

/**
 * Основная функция для запуска из меню Google Таблиц
 */
function getOzonOrders() {
  // Константы для работы с API
  const OZON_API_URL = 'https://api-seller.ozon.ru/v3/posting/fbs/list';
  const CLIENT_ID = '1407255';
  const API_KEY = '42bce76c-9760-424b-b28b-e2ea35fda3bf';
  const SHEET_ID = '1eVrO8Bkq90YF2muG5bVNttzfO15i5T-2WRWsCYiqLL4';
  const SHEET_NAME = 'ЗаказыOZ';

  try {
    // Получаем заказы из API Ozon
    const orders = fetchOzonOrders(OZON_API_URL, CLIENT_ID, API_KEY);
    
    // Проверяем, что получили данные
    if (!orders || !orders.result || !orders.result.postings || orders.result.postings.length === 0) {
      Logger.log('Нет заказов в статусе "awaiting_deliver"');
      SpreadsheetApp.getActive().toast('Нет заказов в статусе "awaiting_deliver"');
      return;
    }
    
    // Преобразуем данные заказов в формат для загрузки в таблицу
    const formattedData = formatOrdersData(orders.result.postings);
    
    // Загружаем данные в таблицу
    loadDataToSheet(formattedData, SHEET_ID, SHEET_NAME);
    
    // Выводим сообщение об успешном выполнении
    SpreadsheetApp.getActive().toast('Заказы успешно загружены!');
    
  } catch (error) {
    Logger.log('Ошибка: ' + error.message);
    SpreadsheetApp.getActive().toast('Произошла ошибка: ' + error.message);
  }
}

/**
 * Функция для получения заказов из API Ozon
 */
function fetchOzonOrders(apiUrl, clientId, apiKey) {
  // Получаем текущую дату и дату 30 дней назад
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 30);
  
  // Форматируем даты в формат строки ISO 8601
  const toDateStr = toDate.toISOString();
  const fromDateStr = fromDate.toISOString();
  
  // Формируем тело запроса с рабочими параметрами
  const payload = {
    "dir": "ASC",
    "filter": {
      "since": fromDateStr,
      "status": "awaiting_deliver",
      "to": toDateStr
    },
    "limit": 100,
    "offset": 0  // Явно указываем начальное смещение
  };
  
  Logger.log("Отправляем запрос к API Ozon: " + JSON.stringify(payload));
  
  // Настраиваем параметры запроса
  const options = {
    "method": "POST",
    "contentType": "application/json",
    "headers": {
      "Client-Id": clientId,
      "Api-Key": apiKey
    },
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };
  
  // Устанавливаем таймаут на выполнение запроса (30 секунд)
  options.timeout = 30000;
  
  // Выполняем запрос к API
  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    
    // Проверяем код ответа
    if (responseCode !== 200) {
      Logger.log("Ответ API: " + response.getContentText());
      throw new Error(`Ошибка API Ozon: ${responseCode}. ${response.getContentText()}`);
    }
    
    // Парсим и возвращаем результат
    return JSON.parse(response.getContentText());
  } catch (e) {
    Logger.log("Ошибка при выполнении запроса: " + e.message);
    throw e; // Передаем ошибку выше для обработки
  }
}

/**
 * Функция для преобразования данных заказов в формат для таблицы
 */
function formatOrdersData(postings) {
  // Создаем заголовок таблицы с добавлением артикула в начало
  const headers = [
    'Артикул товара',
    'Номер отправления', 
    'ID заказа', 
    'Номер заказа', 
    'Статус', 
    'Подстатус',
    'Способ доставки',
    'Склад',
    'Дата создания',
    'Дата отгрузки',
    'Товары'
  ];
  
  // Добавляем заголовок в массив данных
  const data = [headers];
  
  // Добавляем данные каждого заказа
  postings.forEach(posting => {
    // Формируем строку с информацией о товарах
    let productsInfo = '';
    
    // Получаем артикул первого товара
    let firstProductArticle = '';
    
    if (posting.products && posting.products.length > 0) {
      // Формируем информацию о товарах
      productsInfo = posting.products.map(p => 
        `${p.name} (${p.offer_id}) - ${p.quantity} шт. - ${p.price} ${p.currency_code}`
      ).join('\n');
      
      // Получаем артикул первого товара
      // Артикул обычно находится в скобках в конце названия или в offer_id
      const firstProduct = posting.products[0];
      
      // Пробуем извлечь артикул из названия товара, если он находится в скобках
      const nameMatch = firstProduct.name.match(/\(([^)]+)\)$/);
      
      if (nameMatch && nameMatch[1]) {
        // Если артикул найден в скобках в конце названия
        firstProductArticle = nameMatch[1];
      } else {
        // Иначе используем offer_id как артикул
        firstProductArticle = firstProduct.offer_id;
      }
    }
    
    // Добавляем строку с данными заказа (артикул в первом столбце)
    data.push([
      firstProductArticle,
      posting.posting_number,
      posting.order_id,
      posting.order_number,
      posting.status,
      posting.substatus,
      posting.delivery_method ? posting.delivery_method.name : '',
      posting.delivery_method ? posting.delivery_method.warehouse : '',
      formatDate(posting.in_process_at),
      formatDate(posting.shipment_date),
      productsInfo
    ]);
  });
  
  return data;
}

/**
 * Функция для форматирования даты
 */
function formatDate(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm');
}

/**
 * Функция для загрузки данных в таблицу
 */
function loadDataToSheet(data, sheetId, sheetName) {
  // Получаем таблицу
  const spreadsheet = SpreadsheetApp.openById(sheetId);
  let sheet = spreadsheet.getSheetByName(sheetName);
  
  // Если вкладка не существует, создаем её
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  
  // Очищаем содержимое вкладки
  sheet.clear();
  
  // Формируем информацию о дате последнего обновления
  const now = new Date();
  const updateLabel = [["Последнее обновление:"]]; 
  const updateTime = [[Utilities.formatDate(now, Session.getScriptTimeZone(), "dd.MM.yyyy HH:mm:ss")]];
  
  // Записываем "Последнее обновление:" в ячейку A1
  sheet.getRange(1, 1, 1, 1).setValues(updateLabel);
  sheet.getRange(1, 1, 1, 1).setFontWeight("bold");
  
  // Записываем дату и время в ячейку B1
  sheet.getRange(1, 2, 1, 1).setValues(updateTime);
  
  // Начинаем данные со 2-й строки (без пустой строки)
  const startRow = 2;
  
  // Записываем данные, начиная со 2-й строки
  if (data.length > 0) {
    const range = sheet.getRange(startRow, 1, data.length, data[0].length);
    range.setValues(data);
    
    // Форматирование таблицы
    sheet.getRange(startRow, 1, 1, data[0].length).setFontWeight('bold');
    sheet.setFrozenRows(startRow); // Закрепляем строку с заголовками
    sheet.autoResizeColumns(1, data[0].length);
  }
} 