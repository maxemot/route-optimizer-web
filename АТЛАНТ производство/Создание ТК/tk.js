/**
 * Скрипт для отображения упрощенной технологической карты операции.
 */
const SPREADSHEET_ID = "1HOBicgw2MTZiuiahAejOGTUfCz_HgVYb7aDABejSHII";

// ВАЖНО: URL веб-приложения из окна "Управление развертываниями".
// ScriptApp.getService().getUrl() возвращал неверный URL, что было причиной всех проблем.
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxbJkWPR11p9B8GqGh_745armAHcSu8l17Ah1zNNKqHlhq-BPz8YE7U06ARjfSuPo0Xhg/exec";

/**
 * Основная функция для отображения попапа ТК.
 * КОНТЕКСТ: UI. Вызывается из меню, использует getActiveSpreadsheet() для определения активной ячейки.
 */
function showSimpleTK() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Получаем все необходимые данные для отображения
    const data = getTKPopupData();
    if (!data) {
        SpreadsheetApp.getUi().alert("Не удалось получить данные для ТК. Проверьте строку.");
        return;
    }

    // Явно передаем правильный URL в данные для попапа
    data.webAppUrl = WEB_APP_URL;

    // Создаем и показываем HTML-окно
    const template = HtmlService.createTemplateFromFile('tk2.html');
    template.data = data;
    
    const html = template.evaluate().setWidth(720).setHeight(1200);
    SpreadsheetApp.getUi().showModalDialog(html, `ТК ${data.tkNumber}`);

  } catch (error) {
    Logger.log("Ошибка в showSimpleTK: " + error.toString());
    SpreadsheetApp.getUi().alert("Произошла ошибка: " + error.message);
  }
}

/**
 * Записывает действие в лист "Лог".
 * КОНТЕКСТ: Сервер. Вызывается из других серверных функций, использует openById().
 */
function logAction(tkNumber, workerName, action) {
  try {
    const logSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Лог");
    if (logSheet) {
      logSheet.appendRow([new Date(), workerName, tkNumber, action]);
      const newRow = logSheet.getLastRow();
      if (newRow > 2) { 
        const sourceRange = logSheet.getRange(newRow - 1, 5);
        const destinationRange = logSheet.getRange(newRow, 5);
        sourceRange.copyTo(destinationRange, SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
      }
    } else {
      Logger.log("Лист 'Лог' не найден. Действие не было записано.");
    }
  } catch (e) {
    Logger.log(`Ошибка при записи в лог: ${e.toString()}`);
  }
}


/**
 * Собирает все данные, необходимые для отображения в попапе tk2.html.
 * КОНТЕКСТ: UI. Вызывается из showSimpleTK(), использует getActiveSpreadsheet().
 */
function getTKPopupData() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const activeSheet = ss.getActiveSheet();
    const currentRow = activeSheet.getActiveCell().getRow();

    const tkNumber = activeSheet.getRange(currentRow, 1).getValue().toString().trim();
    const targetProduct = activeSheet.getRange(currentRow, 2).getValue().toString().trim();
    const operationName = activeSheet.getRange(currentRow, 3).getValue().toString().trim();
    const quantity = activeSheet.getRange(currentRow, 4).getValue();
    const orderNumber = activeSheet.getRange(currentRow, 5).getDisplayValue().toString().trim();
    const statusValue = activeSheet.getRange(currentRow, 6).getValue().toString().trim().toLowerCase() || 'новая';
    const status = statusValue === 'в работе' ? 'работа' : statusValue;
    const productName = activeSheet.getRange(currentRow, 10).getValue().toString().trim();
    const accumulatedWorkTimeMinutes = activeSheet.getRange(currentRow, 11).getValue();
    const accumulatedWorkTimeMs = accumulatedWorkTimeMinutes ? Number(accumulatedWorkTimeMinutes) * 60 * 1000 : 0;
    const startTime = activeSheet.getRange(currentRow, 7).getValue();
    const lastChangeTime = activeSheet.getRange(currentRow, 8).getValue();
    const assignedWorker = activeSheet.getRange(currentRow, 9).getValue().toString().trim();
    const workerName = Session.getEffectiveUser().getEmail().split('@')[0];
    const userAccess = getUserAccessRights();
    const requiredAccess = operationName.split('.')[0].split('_')[0];
    const userAccessList = userAccess.split(',').map(item => item.trim());
    const hasAccess = userAccessList.includes(requiredAccess);
    const canSplitTK = userAccessList.includes('РТК');
    const isLockedByOtherUser = assignedWorker && assignedWorker !== workerName;

    return {
        tkNumber, productName, orderNumber, targetProduct, quantity, operationName,
        status, workerName, assignedWorker, isLockedByOtherUser, canSplitTK,
        userAccess, hasAccess, activeRow: currentRow,
        formattedStartTime: startTime ? Utilities.formatDate(new Date(startTime), Session.getScriptTimeZone(), "dd.MM.yy HH:mm:ss") : '',
        formattedLastChangeTime: lastChangeTime ? Utilities.formatDate(new Date(lastChangeTime), Session.getScriptTimeZone(), "dd.MM.yy HH:mm:ss") : '',
        lastChangeTimestamp: lastChangeTime ? new Date(lastChangeTime).getTime() : 0,
        accumulatedWorkTimeMs: accumulatedWorkTimeMs
    };
}

/**
 * Получает права доступа для текущего пользователя из листа "Доступы".
 * КОНТЕКСТ: UI. Вызывается из getTKPopupData(), использует getActiveSpreadsheet().
 */
function getUserAccessRights() {
    try {
        const accessSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Доступы");
        if (!accessSheet) return "Нет данных";
        const data = accessSheet.getDataRange().getValues();
        const currentUserEmail = Session.getEffectiveUser().getEmail();
        for (let i = 1; i < data.length; i++) {
            if (data[i][1] && data[i][1].toString().trim().toLowerCase() === currentUserEmail.toLowerCase()) {
                return data[i].slice(5, 34).filter(String).join(', ');
            }
        }
        return "Не определены";
    } catch(e) {
        Logger.log("Ошибка при получении доступов: " + e.toString());
        return "Ошибка";
    }
}

/**
 * Обновляет статус ТК.
 * КОНТЕКСТ: Сервер. Вызывается из doPost(), использует openById().
 */
function updateTKStatus(action, workerName, tkNumber, activeRow, accumulatedWorkTimeMs, lastChangeTimestamp, currentStatus) {
    try {
        const now = new Date();
        const formattedDate = Utilities.formatDate(now, Session.getScriptTimeZone(), "dd.MM.yy HH:mm:ss");

        const actionMap = {'start': 'работа', 'pause': 'пауза', 'resume': 'работа', 'finish': 'готово'};
        const newStatus = actionMap[action];
        if (!newStatus) {
            return { success: false, message: 'Неизвестное действие: ' + action };
        }

        // --- ЕДИНСТВЕННОЕ ДЕЙСТВИЕ С ТАБЛИЦЕЙ ---
        logAction(tkNumber, workerName, newStatus);
        
        // --- Все остальные расчеты происходят в памяти ---
        let newAccumulatedWorkTimeMs = accumulatedWorkTimeMs;
        if ((action === 'pause' || action === 'finish') && currentStatus === 'работа') {
            if (lastChangeTimestamp) {
                const elapsedMs = now.getTime() - new Date(lastChangeTimestamp).getTime();
                newAccumulatedWorkTimeMs += elapsedMs;
            }
        }
        
        if (action === 'start') {
            newAccumulatedWorkTimeMs = 0;
        }

        // Возвращаем обновленные данные для корректного отображения в UI
        return { 
            success: true, 
            newStatus: newStatus, 
            formattedStartTime: (action === 'start') ? formattedDate : null, 
            formattedLastChangeTime: formattedDate, 
            newLastChangeTimestamp: now.getTime(), 
            newAccumulatedWorkTimeMs: newAccumulatedWorkTimeMs
        };
    } catch (e) {
        Logger.log('Ошибка при обновлении статуса ТК: ' + e);
        return { success: false, message: e.toString() };
    }
}

/**
 * Разделяет ТК.
 * КОНТЕКСТ: Сервер. Вызывается из doPost(), использует openById().
 */
function splitTK(quantityToMove, activeRow) {
    try {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        const sheet = ss.getSheetByName('ТК');
        if (!sheet) throw new Error("Лист 'ТК' не найден.");
        const row = activeRow;

        const originalQuantity = sheet.getRange(row, 4).getValue();
        const quantityToMoveNum = Number(quantityToMove);

        if (isNaN(quantityToMoveNum) || quantityToMoveNum <= 0 || quantityToMoveNum >= originalQuantity) {
            return { success: false, message: `Некорректное количество. Укажите число от 1 до ${originalQuantity - 1}.` };
        }

        sheet.getRange(row, 4).setValue(originalQuantity - quantityToMoveNum);

        let nextTkNumber = sheet.getRange("F1").getValue();
        nextTkNumber = (!nextTkNumber || isNaN(nextTkNumber)) ? 1 : parseInt(nextTkNumber);

        sheet.insertRowAfter(row);
        const newRow = row + 1;
        sheet.getRange(row, 1, 1, sheet.getLastColumn()).copyTo(sheet.getRange(newRow, 1));
        
        sheet.getRange(newRow, 1).setValue(nextTkNumber);
        sheet.getRange(newRow, 4).setValue(quantityToMoveNum);
        // Удалены строки, которые перезаписывали/очищали формулы в новой строке.
        // Теперь скопированные формулы сами вычислят корректное начальное состояние
        // (статус 'новая', пустые ячейки времени и т.д.) на основе нового номера ТК.
        
        sheet.getRange("F1").setValue(nextTkNumber + 1);

        return { success: true };
    } catch (e) {
        Logger.log('Ошибка при разделении ТК: ' + e.toString());
        return { success: false, message: 'Произошла ошибка: ' + e.toString() };
    }
}

/**
 * Обнуляет ТК.
 * КОНТЕКСТ: Сервер. Вызывается из doPost(), использует openById().
 */
function resetTKLog(tkNumber) {
    try {
        const logSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Лог");
        if (!logSheet) {
            return { success: false, message: "Лист 'Лог' не найден." };
        }
        const data = logSheet.getDataRange().getValues();
        const rowsToDelete = [];
        for (let i = 0; i < data.length; i++) {
            if (data[i][2] && data[i][2].toString().trim() === tkNumber.toString().trim()) {
                rowsToDelete.push(i + 1);
            }
        }
        for (let i = rowsToDelete.length - 1; i >= 0; i--) {
            logSheet.deleteRow(rowsToDelete[i]);
        }
        return { success: true };
    } catch (e) {
        Logger.log('Ошибка при обнулении ТК: ' + e.toString());
        return { success: false, message: 'Произошла ошибка: ' + e.toString() };
    }
}


/**
 * Получение фото изделия.
 * КОНТЕКСТ: Сервер. Вызывается из doPost().
 */
function getProductPhotoBase64(productCode) {
  try {
    const cleanCode = (productCode || '').toString().trim();
    const FOLDER_ID = '1qR_h4ZLVq51udz0r5ahA1rQ2V61oK-zu';
    const THUMBNAIL_FOLDER_ID = '1Q_QgdAkqP_p8WeZnWiDw1wnw9bHtkS0E';
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const thumbFolder = DriveApp.getFolderById(THUMBNAIL_FOLDER_ID);
    
    let file;
    let fileIterator;

    // Поиск миниатюр
    fileIterator = thumbFolder.getFilesByName(cleanCode + '-mini.jpg');
    if (fileIterator.hasNext()) {
      file = fileIterator.next();
    } else {
      fileIterator = thumbFolder.getFilesByName(cleanCode + '-mini.png');
      if (fileIterator.hasNext()) file = fileIterator.next();
    }
    
    // Если миниатюра не найдена, ищем оригинал
    if (!file) {
      fileIterator = folder.getFilesByName(cleanCode + '.jpg');
      if (fileIterator.hasNext()) {
        file = fileIterator.next();
      } else {
        fileIterator = folder.getFilesByName(cleanCode + '.png');
        if (fileIterator.hasNext()) file = fileIterator.next();
      }
    }

    if (file) {
      const blob = file.getBlob();
      return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
    }
    return null;
  } catch (e) {
    Logger.log('Ошибка при поиске фото: ' + e);
    return null;
  }
} 

/**
 * Возвращает URL активного веб-приложения.
 * КОНТЕКСТ: Сервер.
 */
// Эта функция больше не используется, т.к. ScriptApp.getService().getUrl() возвращает неверное значение.
// function getWebAppUrl() {
//   return ScriptApp.getService().getUrl();
// }

/**
 * Точка входа для веб-приложения.
 * КОНТЕКСТ: Сервер.
 */
// Функция doPost перенесена в файл menu.js 

/**
 * Новая основная функция для запуска/возобновления ТК из меню.
 * Проверяет статус и либо показывает окно с лоадером, либо ошибку.
 */
function startOrResumeTKFromMenu() {
  const ui = SpreadsheetApp.getUi();
  try {
    const activeSheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const currentRow = activeSheet.getActiveCell().getRow();
    const status = activeSheet.getRange(currentRow, 6).getValue().toString().trim().toLowerCase();
    const tkNumber = activeSheet.getRange(currentRow, 1).getValue();

    if (status === 'работа' || status === 'готово') {
      ui.alert('Действие не выполнено', `Технологическая карта ${tkNumber} уже находится в статусе "${status}".`, ui.ButtonSet.OK);
      return;
    }

    const tkData = getTKPopupData();
    if (!tkData) {
      ui.alert("Не удалось получить данные для ТК. Проверьте строку.");
      return;
    }
    
    const template = HtmlService.createTemplateFromFile('loader.html');
    template.tkData = tkData;
    template.initialMessage = 'Запускаем работу...';
    const html = template.evaluate().setWidth(300).setHeight(200);
    ui.showModalDialog(html, `ТК ${tkData.tkNumber}`);

  } catch (e) {
    Logger.log('Ошибка в startOrResumeTKFromMenu: ' + e.toString());
    ui.alert('Произошла критическая ошибка: ' + e.toString());
  }
}

/**
 * Вспомогательная функция, вызываемая из loader.html для выполнения действия.
 * Использует fetch для вызова doPost, чтобы гарантировать выполнение от имени администратора.
 */
function performTkActionViaFetch(tkData) {
  try {
    const action = (tkData.status === 'пауза') ? 'resume' : 'start';
    
    const payload = {
      functionName: 'updateTKStatus',
      args: [action, tkData.workerName, tkData.tkNumber, tkData.activeRow, tkData.accumulatedWorkTimeMs, tkData.lastChangeTimestamp, tkData.status]
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      headers: { 'Authorization': 'Bearer ' + ScriptApp.getIdentityToken() },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(WEB_APP_URL, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode === 200) {
      const result = JSON.parse(responseBody);
      if (result.success && result.data.success) {
        return result.data;
      } else {
        const errorMessage = (result.data && result.data.message) || result.message || 'Неизвестная ошибка на сервере.';
        throw new Error(errorMessage);
      }
    } else {
      throw new Error(`Ошибка сети: ${responseCode}. Ответ: ${responseBody}`);
    }
  } catch (e) {
    Logger.log('Критическая ошибка в performTkActionViaFetch: ' + e.toString());
    throw e; // Пробрасываем ошибку, чтобы onFailure в HTML ее поймал
  }
} 