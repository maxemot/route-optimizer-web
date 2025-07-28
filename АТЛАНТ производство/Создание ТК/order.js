/**
 * Скрипт для обработки заказов и создания технологических карт операций.
 */
const WEB_APP_URL_ORDER = "https://script.google.com/macros/s/AKfycbxbJkWPR11p9B8GqGh_745armAHcSu8l17Ah1zNNKqHlhq-BPz8YE7U06ARjfSuPo0Xhg/exec";


/**
 * Основная функция для отображения информации по заказу в модальном окне.
 */
function showOrderInfo() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. Получаем данные из активной строки на листе "Заказы"
    const activeSheet = spreadsheet.getActiveSheet();
    const activeCell = activeSheet.getActiveCell();
    const rowIndex = activeCell.getRow();
    
    // Получаем артикул из активной ячейки, номер заказа из столбца A, количество из столбца E
    const targetProduct = activeCell.getValue().toString().trim();
    const orderNumber = activeSheet.getRange(rowIndex, 1).getValue().toString().trim();
    const quantity = activeSheet.getRange(rowIndex, 5).getValue();

    // 2. Получаем данные из других листов
    const operationsData = getSheetData(spreadsheet, "Операции");
    const tkData = getSheetData(spreadsheet, "ТК");
    
    if (!operationsData) {
      SpreadsheetApp.getUi().alert("Не удалось получить данные из листа 'Операции'.");
      return;
    }

    // 3. Обрабатываем данные
    // Получаем все операции для изделия
    const operations = getOperationsForProduct(operationsData, targetProduct);
    if (operations.length === 0) {
      SpreadsheetApp.getUi().alert("Для изделия " + targetProduct + " не найдены операции на листе 'Операции'.");
      return;
    }

    // Проверяем существующие ТК для этих операций
    const existingTKs = getExistingOperationTKs(tkData, orderNumber, targetProduct);

    // Объединяем операции с их статусами
    const operationsWithStatus = operations.map(op => ({
      name: op.name,
      time: op.time,
      status: existingTKs[op.name] || "не создана"
    }));

    // 4. Создаем и показываем HTML-окно
    const template = HtmlService.createTemplateFromFile('order2.html');
    const dataForTemplate = {
      orderNumber: orderNumber,
      targetProduct: targetProduct,
      quantity: quantity,
      operations: operationsWithStatus,
      webAppUrl: WEB_APP_URL_ORDER // Добавляем URL
    };
    template.data = dataForTemplate;
    
    const html = template.evaluate().setWidth(800).setHeight(600).setTitle('Информация по заказу: ' + targetProduct);
    SpreadsheetApp.getUi().showModalDialog(html, 'Заказ №' + orderNumber);

  } catch (error) {
    Logger.log("Ошибка в showOrderInfo: " + error.toString());
    SpreadsheetApp.getUi().alert("Произошла ошибка: " + error.message);
  }
}

/**
 * Получение данных из листа таблицы.
 */
function getSheetData(spreadsheet, sheetName) {
  try {
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      Logger.log("Лист '" + sheetName + "' не найден");
      return null;
    }
    return sheet.getDataRange().getValues();
  } catch (e) {
    Logger.log("Ошибка при получении данных из листа '" + sheetName + "': " + e.toString());
    return null;
  }
}

/**
 * Получение списка операций и времени их выполнения для заданного артикула изделия.
 * @param {Array<Array<string>>} operationsData - Данные из листа "Операции".
 * @param {string} productCode - Артикул изделия.
 * @return {Array<Object>} - Массив объектов {name: string, time: string}.
 */
function getOperationsForProduct(operationsData, productCode) {
    const operations = [];
    if (!operationsData) return operations;

    for (let i = 1; i < operationsData.length; i++) {
        const row = operationsData[i];
        // Колонка A (индекс 0) - артикул изделия
        if (row[0] && row[0].toString().trim() === productCode) {
            // Операции в колонках C, E, G... (индексы 2, 4, 6...). Время в D, F, H...
            for (let j = 2; j < row.length; j += 2) {
                if (row[j]) {
                    const opName = row[j].toString().trim();
                    const opTime = (row[j + 1] || "").toString().trim();
                    operations.push({ name: opName, time: opTime });
                }
            }
            break; // Изделие найдено, выходим из цикла
        }
    }
    return operations;
}

/**
 * Получение существующих ТК для операций по конкретному заказу.
 * @param {Array<Array<string>>} tkData - Данные из листа "ТК".
 * @param {string} orderNumber - Номер заказа.
 * @param {string} productCode - Артикул изделия.
 * @return {Object} - Объект, где ключ - название операции, значение - номер ТК.
 */
function getExistingOperationTKs(tkData, orderNumber, productCode) {
    const tks = {};
    if (!tkData) return tks;

    // Структура листа ТК:
    // A(0): Номер ТК, B(1): Готовое изделие, C(2): Что делаем, E(4): Номер заказа
    for (let i = 1; i < tkData.length; i++) {
        const row = tkData[i];
        if (row.length >= 5 &&
            row[1] && row[1].toString().trim() == productCode &&
            row[4] && row[4].toString().trim() == orderNumber &&
            row[2] 
        ) {
            const operationName = row[2].toString().trim();
            const tkNumber = row[0];
            tks[operationName] = tkNumber;
        }
    }
    return tks;
}


/**
 * Создание технологических карт для операций в листе "ТК".
 * @param {Array<string>} operationsToCreate - Массив названий операций для создания ТК.
 * @param {string} orderNumber - Номер заказа.
 * @param {string} targetProduct - Артикул изделия.
 * @param {number} quantity - Количество.
 * @return {Object} - Результат операции.
 */
function createOperationTechCards(operationsToCreate, orderNumber, targetProduct, quantity) {
  try {
    if (!operationsToCreate || operationsToCreate.length === 0) {
      return { success: true, count: 0, message: "Нет операций для создания ТК." };
    }
    
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const tkSheet = spreadsheet.getSheetByName("ТК");
    if (!tkSheet) {
      return { success: false, message: "Лист 'ТК' не найден." };
    }

    // Получаем следующий номер ТК из ячейки F1
    let tkNumber = tkSheet.getRange("F1").getValue();
    tkNumber = (!tkNumber || isNaN(tkNumber)) ? 1 : parseInt(tkNumber);
    
    const templateRowIndex = tkSheet.getLastRow();
    if (templateRowIndex < 2) { // Если в таблице только заголовок
        return { success: false, message: "Не найден шаблон для создания ТК. Добавьте хотя бы одну строку-образец." };
    }
    
    const createdTKs = {};

    // Используем цикл, чтобы копировать шаблон и вставлять данные.
    // Это менее производительно чем batch, но гарантирует протягивание формул.
    operationsToCreate.forEach(opName => {
      const lastRow = tkSheet.getLastRow();
      tkSheet.insertRowAfter(lastRow); // Сначала явно вставляем новую строку
      const newRowIndex = lastRow + 1; // Определяем ее индекс
      const currentTkNumber = tkNumber++;
      
      // Копируем всю строку-шаблон в новую строку
      const templateRange = tkSheet.getRange(templateRowIndex, 1, 1, tkSheet.getLastColumn());
      templateRange.copyTo(tkSheet.getRange(newRowIndex, 1));
      
      // Перезаписываем только необходимые значения в столбцах A-E, оставляя формулы в F-M нетронутыми
      const newRowRange = tkSheet.getRange(newRowIndex, 1, 1, 5);
      newRowRange.setValues([[
        currentTkNumber,       // A: Номер ТК
        targetProduct,         // B: Готовое изделие
        opName,                // C: Что делаем (название операции)
        quantity,              // D: Кол-во
        orderNumber            // E: Номер заказа
      ]]);
      
      // Устанавливаем формат для номера заказа
      tkSheet.getRange(newRowIndex, 5).setNumberFormat('@');
      
      createdTKs[opName] = currentTkNumber;
    });

    // Обновляем номер ТК в ячейке F1
    tkSheet.getRange("F1").setValue(tkNumber);

    return { 
      success: true, 
      count: operationsToCreate.length,
      createdTKs: createdTKs
    };

  } catch (error) {
    Logger.log("Ошибка при создании ТК операций: " + error.toString());
    return { success: false, message: error.toString() };
  }
} 