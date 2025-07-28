function StockWB() {
  // Константы
  const SHEET_ID = "1eVrO8Bkq90YF2muG5bVNttzfO15i5T-2WRWsCYiqLL4";
  const API_KEY = "eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwMjE3djEiLCJ0eXAiOiJKV1QifQ.eyJlbnQiOjEsImV4cCI6MTc2MDQyODQxOCwiaWQiOiIwMTk2MzVkZC00ZWJlLTc5ZTUtOTUzYi01MDFiZmVhODM0MmEiLCJpaWQiOjQ1MTA3NTA0LCJvaWQiOjEzNjE0MjgsInMiOjc5MzQsInNpZCI6Ijg5ZjRiNjllLTFkNDYtNDZiYS1hN2JkLWU0NjRjODczODliMyIsInQiOmZhbHNlLCJ1aWQiOjQ1MTA3NTA0fQ.cWv_aNFA0fgrPHswSupUGRqzTKisyJyatgUGtzSts9LQiL-JanGhwvn8msOf2gMpAfWCrSWst2XIHpjt73GAUg";
  const WAREHOUSES = ["795888", "805648"];
  
  // Получаем лист для записи
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("ОстаткиWB");
  
  // Очищаем лист
  sheet.clear();
  
  // Записываем заголовки
  sheet.getRange("A1:E1").setValues([["Артикул", "Баркод", "Количество", "Склад", "Дата обновления"]]);
  
  // Получаем карточки
  const cards = getCards(API_KEY);
  if (!cards) {
    Logger.log("Не удалось получить карточки");
    return;
  }
  
  // Собираем баркоды и создаем мапы
  const barcodeMap = {};
  const barcodes = [];
  
  cards.forEach(card => {
    if (card.sizes) {
      card.sizes.forEach(size => {
        if (size.skus) {
          size.skus.forEach(sku => {
            barcodeMap[sku] = card.vendorCode;
            barcodes.push(sku);
          });
        }
      });
    }
  });
  
  // Получаем остатки для каждого склада
  let rowData = [];
  const currentTime = Utilities.formatDate(new Date(), "GMT+3", "dd.MM.yyyy HH:mm:ss");
  
  WAREHOUSES.forEach(warehouse => {
    const stocks = getStocks(barcodes, warehouse, API_KEY);
    if (stocks) {
      stocks.forEach(stock => {
        rowData.push([
          barcodeMap[stock.sku] || "Нет артикула",
          stock.sku,
          stock.amount,
          warehouse,
          currentTime
        ]);
      });
    }
  });
  
  // Записываем данные
  if (rowData.length > 0) {
    sheet.getRange(2, 1, rowData.length, 5).setValues(rowData);
    Logger.log(`Обновлено ${rowData.length} строк`);
  }
}

function getCards(apiKey) {
  //const url = 'https://suppliers-api.wildberries.ru/content/v2/get/cards/list';
  const url = 'https://content-api.wildberries.ru/content/v2/get/cards/list';
  let allCards = [];
  
  // Начальный payload
  let payload = {
    "settings": {
      "cursor": {
        "limit": 100
      },
      "filter": {
        "withPhoto": -1
      }
    }
  };
  
  while (true) {
    const options = {
      'method': 'post',
      'headers': {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      'payload': JSON.stringify(payload),
      'muteHttpExceptions': true
    };
    
    try {
      Logger.log("Отправляем запрос на получение карточек...");
      const response = UrlFetchApp.fetch(url, options);
      const data = JSON.parse(response.getContentText());
      
      const cards = data.cards || [];
      const cursor = data.cursor || {};
      
      Logger.log(`Получено ${cards.length} карточек`);
      allCards = allCards.concat(cards);
      
      // Если получили меньше 100 карточек, значит это последняя страница
      if (cards.length < 100) {
        Logger.log("Достигнут конец списка");
        break;
      }
      
      // Обновляем cursor для следующего запроса
      payload.settings.cursor.updatedAt = cursor.updatedAt;
      payload.settings.cursor.nmID = cursor.nmID;
      
      // Пауза между запросами
      Utilities.sleep(1000);
      
    } catch (e) {
      Logger.log(`Ошибка при получении карточек: ${e}`);
      return null;
    }
  }
  
  Logger.log(`Всего получено ${allCards.length} карточек`);
  return allCards;
}

function getStocks(barcodes, warehouseId, apiKey) {
  const url = `https://marketplace-api.wildberries.ru/api/v3/stocks/${warehouseId}`;
  
  // Разбиваем баркоды на группы по 1000
  const batchSize = 1000;
  let allStocks = [];
  
  for (let i = 0; i < barcodes.length; i += batchSize) {
    const batch = barcodes.slice(i, i + batchSize);
    
    const options = {
      'method': 'post',
      'headers': {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      'payload': JSON.stringify({
        "skus": batch
      })
    };
    
    try {
      const response = UrlFetchApp.fetch(url, options);
      const data = JSON.parse(response.getContentText());
      if (data.stocks) {
        allStocks = allStocks.concat(data.stocks);
      }
      
      // Пауза между запросами
      if (i + batchSize < barcodes.length) {
        Utilities.sleep(1000);
      }
    } catch (e) {
      Logger.log(`Ошибка при получении остатков для склада ${warehouseId}: ${e}`);
    }
  }
  
  return allStocks;
}