function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Меню')
//    .addItem('Заказ', 'findOptimalCuttings')
    .addItem('Заказ', 'showOrderInfo')
    .addItem('ТК', 'showSimpleTK')
    .addItem('Начать ТК', 'startOrResumeTKFromMenu')
    .addItem('Профиль', 'showUserProfile')
//    .addItem('Наклейки', 'printLabels')
//    .addItem('Схема', 'showSchemaEditor')
    .addToUi();
}

/**
 * Точка входа для веб-приложения.
 * КОНТЕКСТ: Сервер.
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const functionName = body.functionName;
    const args = body.args || [];

    Logger.log(`doPost triggered. Calling function: ${functionName} with args: ${JSON.stringify(args)}`);

    // Роутер, который позволяет вызывать только определенные функции с клиента
    const functionMap = {
      // Функции из tk.js
      'updateTKStatus': updateTKStatus,
      'splitTK': splitTK,
      'resetTKLog': resetTKLog,
      'getProductPhotoBase64': getProductPhotoBase64,
      // Функции из order.js
      'createOperationTechCards': createOperationTechCards
    };

    if (functionMap[functionName]) {
      // Вызываем соответствующую функцию с переданными аргументами
      const result = functionMap[functionName](...args);
      
      // Оборачиваем результат в стандартный успешный ответ
      const jsonResponse = JSON.stringify({ success: true, data: result });
      return ContentService.createTextOutput(jsonResponse).setMimeType(ContentService.MimeType.JSON);
    } else {
      // Если запрошенная функция не разрешена или не существует
      throw new Error(`Запрошенная серверная функция "${functionName}" не найдена или не разрешена.`);
    }

  } catch (error) {
    Logger.log(`КРИТИЧЕСКАЯ ОШИБКА в doPost: ${error.message} | Стек: ${error.stack}`);
    // Оборачиваем ошибку в стандартный ответ об ошибке
    const errorResponse = JSON.stringify({ success: false, message: `Ошибка на сервере: ${error.message}` });
    return ContentService.createTextOutput(errorResponse).setMimeType(ContentService.MimeType.JSON);
  }
}