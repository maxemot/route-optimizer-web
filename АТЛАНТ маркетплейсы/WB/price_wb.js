function PriceWB() {
  // Константы
  const SHEET_ID = "1eVrO8Bkq90YF2muG5bVNttzfO15i5T-2WRWsCYiqLL4";
  const API_KEY = "eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwMjE3djEiLCJ0eXAiOiJKV1QifQ.eyJlbnQiOjEsImV4cCI6MTc2MDQyODQxOCwiaWQiOiIwMTk2MzVkZC00ZWJlLTc5ZTUtOTUzYi01MDFiZmVhODM0MmEiLCJpaWQiOjQ1MTA3NTA0LCJvaWQiOjEzNjE0MjgsInMiOjc5MzQsInNpZCI6Ijg5ZjRiNjllLTFkNDYtNDZiYS1hN2JkLWU0NjRjODczODliMyIsInQiOmZhbHNlLCJ1aWQiOjQ1MTA3NTA0fQ.cWv_aNFA0fgrPHswSupUGRqzTKisyJyatgUGtzSts9LQiL-JanGhwvn8msOf2gMpAfWCrSWst2XIHpjt73GAUg";
  
  // Получаем лист для записи
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("ЦеныWB");
  
  // Очищаем лист
  sheet.clear();
  
  // Записываем заголовки
  sheet.getRange("A1:I1").setValues([[
    "Артикул", 
    "nmID", 
    "Размер", 
    "Цена", 
    "Цена со скидкой", 
    "Цена WB Клуб", 
    "Скидка %", 
    "Скидка WB Клуб %", 
    "Дата обновления"
  ]]);
  
  // Получаем цены товаров
  const priceData = getAllPrices(API_KEY);
  if (!priceData || priceData.length === 0) {
    Logger.log("Не удалось получить цены товаров");
    return;
  }
  
  // Записываем данные
  if (priceData.length > 0) {
    sheet.getRange(2, 1, priceData.length, 9).setValues(priceData);
    Logger.log(`Обновлено ${priceData.length} строк с ценами`);
  }
}

function getAllPrices(apiKey) {
  const baseUrl = "https://discounts-prices-api.wildberries.ru/api/v2/list/goods/filter";
  let allPrices = [];
  let offset = 0;
  const limit = 1000; // Максимальный лимит
  const currentTime = Utilities.formatDate(new Date(), "GMT+3", "dd.MM.yyyy HH:mm:ss");
  
  while (true) {
    // Формируем URL с параметрами
    const url = `${baseUrl}?limit=${limit}&offset=${offset}`;
    
    const options = {
      'method': 'GET',
      'headers': {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      'muteHttpExceptions': true
    };
    
    try {
      Logger.log(`Запрос цен: offset=${offset}, limit=${limit}`);
      const response = UrlFetchApp.fetch(url, options);
      
      if (response.getResponseCode() !== 200) {
        Logger.log(`Ошибка HTTP: ${response.getResponseCode()}`);
        Logger.log(`Ответ: ${response.getContentText()}`);
        break;
      }
      
      const data = JSON.parse(response.getContentText());
      const goods = data.data?.listGoods || [];
      
      Logger.log(`Получено ${goods.length} товаров`);
      
      // Обрабатываем полученные товары
      goods.forEach(good => {
        const nmID = good.nmID;
        const vendorCode = good.vendorCode || "Нет артикула";
        const discount = good.discount || 0;
        const clubDiscount = good.clubDiscount || 0;
        
        // Обрабатываем каждый размер товара
        if (good.sizes && good.sizes.length > 0) {
          good.sizes.forEach(size => {
            allPrices.push([
              vendorCode,
              nmID,
              size.techSizeName || "Без размера",
              size.price || 0,
              size.discountedPrice || 0,
              size.clubDiscountedPrice || 0,
              discount,
              clubDiscount,
              currentTime
            ]);
          });
        } else {
          // Если нет размеров, добавляем товар без размера
          allPrices.push([
            vendorCode,
            nmID,
            "Без размера",
            0,
            0,
            0,
            discount,
            clubDiscount,
            currentTime
          ]);
        }
      });
      
      // Если получили меньше товаров чем лимит, значит это последняя страница
      if (goods.length < limit) {
        Logger.log("Достигнут конец списка товаров");
        break;
      }
      
      // Увеличиваем offset для следующего запроса
      offset += limit;
      
      // Пауза между запросами чтобы не превысить лимиты API
      Utilities.sleep(1500);
      
    } catch (e) {
      Logger.log(`Ошибка при получении цен: ${e}`);
      break;
    }
  }
  
  Logger.log(`Всего обработано ${allPrices.length} записей о ценах`);
  return allPrices;
}

// Дополнительная функция для получения цен конкретного товара по nmID
function getPricesByNmID(nmID, apiKey) {
  const baseUrl = "https://discounts-prices-api.wildberries.ru/api/v2/list/goods/filter";
  const url = `${baseUrl}?limit=1000&offset=0&filterNmID=${nmID}`;
  
  const options = {
    'method': 'GET',
    'headers': {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    'muteHttpExceptions': true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    
    if (response.getResponseCode() !== 200) {
      Logger.log(`Ошибка HTTP при получении цены товара ${nmID}: ${response.getResponseCode()}`);
      return null;
    }
    
    const data = JSON.parse(response.getContentText());
    return data.data?.listGoods || [];
    
  } catch (e) {
    Logger.log(`Ошибка при получении цены товара ${nmID}: ${e}`);
    return null;
  }
} 