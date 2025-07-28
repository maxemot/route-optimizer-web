/**
 * Функция для обновления информации о складских запасах Озон
 * Ищет заказы с сегодняшней датой отгрузки и записывает их в таблицу склада
 */
function updateOzonStock() {
  // ID таблицы
  const sheetId = "1eVrO8Bkq90YF2muG5bVNttzfO15i5T-2WRWsCYiqLL4";
  
  // Открываем таблицу
  const spreadsheet = SpreadsheetApp.openById(sheetId);
  
  // Открываем нужные листы
  const deliverySheet = spreadsheet.getSheetByName("ДоставкаOZ");
  const stockSheet = spreadsheet.getSheetByName("СкладOZ");
  
  // Получаем текущую дату в нужном формате
  const today = new Date();
  const formattedDate = Utilities.formatDate(today, "GMT+3", "dd.MM.yyyy");
  
  // Получаем все данные с листа доставки
  const deliveryData = deliverySheet.getDataRange().getValues();
  
  // Создаем объект для хранения артикулов и их количества
  const articlesToShip = {};
  
  // Перебираем строки, начиная со второй (пропускаем заголовок)
  for (let i = 1; i < deliveryData.length; i++) {
    const row = deliveryData[i];
    const articleCode = row[0]; // Артикул в столбце A
    const shipmentDate = row[9]; // Дата отгрузки в столбце J
    
    // Проверяем, соответствует ли дата отгрузки сегодняшней дате
    if (shipmentDate instanceof Date) {
      const shipmentDateFormatted = Utilities.formatDate(shipmentDate, "GMT+3", "dd.MM.yyyy");
      if (shipmentDateFormatted === formattedDate) {
        // Увеличиваем счетчик для этого артикула
        articlesToShip[articleCode] = (articlesToShip[articleCode] || 0) + 1;
      }
    } else if (typeof shipmentDate === 'string' && shipmentDate.includes(formattedDate)) {
      // Увеличиваем счетчик для этого артикула, если дата в виде строки
      articlesToShip[articleCode] = (articlesToShip[articleCode] || 0) + 1;
    }
  }
  
  // Если нечего отгружать, выходим
  if (Object.keys(articlesToShip).length === 0) {
    Logger.log("Нет отгрузок на сегодня");
    return;
  }
  
  // Получаем данные с листа склада
  const stockData = stockSheet.getDataRange().getValues();
  
  // Ищем первую пустую строку (где столбцы A, B, C пустые)
  let emptyRowIndex = -1;
  for (let i = 0; i < stockData.length; i++) {
    if (!stockData[i][0] && !stockData[i][1] && !stockData[i][2]) {
      emptyRowIndex = i;
      break;
    }
  }
  
  // Если пустую строку не нашли, добавляем в конец
  if (emptyRowIndex === -1) {
    emptyRowIndex = stockData.length;
  }
  
  // Создаем массив строк для записи
  const rowsToWrite = [];
  
  // Для каждого артикула создаем строку
  for (const articleCode in articlesToShip) {
    rowsToWrite.push([
      "Списание", // Столбец A: всегда "Списание"
      "отгрузка на ozon", // Столбец B: всегда "отгрузка на ozon"
      articleCode, // Столбец C: артикул
      articlesToShip[articleCode], // Столбец D: количество
      new Date(today), // Столбец E: сегодняшняя дата (будет отформатирована таблицей)
      new Date(today)  // Столбец F: сегодняшняя дата (будет отформатирована таблицей)
    ]);
  }
  
  // Записываем строки в таблицу склада, начиная с первой пустой строки
  if (rowsToWrite.length > 0) {
    stockSheet.getRange(emptyRowIndex + 1, 1, rowsToWrite.length, 6).setValues(rowsToWrite);
    Logger.log(`Записано ${rowsToWrite.length} строк отгрузок`);
  }
} 