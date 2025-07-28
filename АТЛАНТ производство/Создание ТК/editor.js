/**
 * СЕРВЕРНЫЕ ФУНКЦИИ GOOGLE APPS SCRIPT
 * Этот файл содержит только серверный код для работы с Google Sheets
 * 
 * СТРУКТУРА ДАННЫХ:
 * Лист "Схема" содержит:
 * A - Источник (артикул детали/операции)
 * B - Количество источника
 * C - Целевое изделие (артикул)
 * D - Количество целевого изделия
 * E - Код изделия (используется для группировки)
 * F - Название готового изделия
 * G - Название источника
 * H - Название целевого изделия
 * I - Артикул фото источника
 * J - Артикул фото целевого изделия
 * K - Операция
 * 
 * Список изделий формируется из уникальных значений столбца E
 */

/**
 * Нормализация артикула: добавляет ведущие нули до 4-х знаков, если это число.
 * @param {string|number} code - Артикул для нормализации.
 * @returns {string} Нормализованный артикул.
 */
function normalizeCode(code) {
  if (code === null || code === undefined) return '';
  const strCode = String(code).trim();
  // Проверяем, что это строка, состоящая только из цифр, длиной от 1 до 4
  if (/^\d{1,4}$/.test(strCode)) {
    return strCode.padStart(4, '0');
  }
  return strCode; // Возвращаем как есть для нечисловых артикулов
}

// Функция для запуска редактора схем сборки
function showSchemaEditor() {
  try {
    const template = HtmlService.createTemplateFromFile('editor2')
      .evaluate()
      .setWidth(1400)
      .setHeight(900)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    
    SpreadsheetApp.getUi().showModalDialog(template, 'Редактор схем сборки');
    
  } catch (e) {
    Logger.log('Ошибка при открытии редактора: ' + e.toString());
    SpreadsheetApp.getUi().alert('Ошибка при открытии редактора: ' + e.toString());
  }
}

/**
 * Простая тестовая функция для проверки связи
 */
function testConnection() {
  Logger.log('Тест соединения работает!');
  return 'Соединение работает!';
}

/**
 * Получение списка уникальных изделий из листа "Схема" (столбец E)
 */
function getProductsList() {
  try {
    Logger.log('Начинаем получение списка изделий из схемы...');
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    Logger.log('Получили активную таблицу: ' + ss.getName());
    
    const schemaSheet = ss.getSheetByName("Схема");
    
    if (!schemaSheet) {
      Logger.log('Лист "Схема" не найден');
      return [];
    }
    
    Logger.log('Лист "Схема" найден');
    
    const data = schemaSheet.getDataRange().getValues();
    Logger.log('Получены данные из схемы, строк: ' + data.length);
    
    // Собираем уникальные изделия из столбца E (индекс 4)
    const uniqueProducts = new Set();
    const productDetails = {};
    
    // Пропускаем заголовок (первую строку)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const productCode = row[4]; // Столбец E
      
      if (productCode && productCode.toString().trim()) {
        const code = normalizeCode(productCode.toString().trim());
        uniqueProducts.add(code);
        
        // Сохраняем дополнительную информацию об изделии
        if (!productDetails[code]) {
          productDetails[code] = {
            code: code,
            name: row[5] ? row[5].toString().trim() : 'Без названия', // Столбец F - название готового изделия
            photoId: code // Используем сам код изделия для поиска фото
          };
        }
      }
    }
    
    // Преобразуем в массив продуктов
    const products = Array.from(uniqueProducts).map(code => ({
      ...productDetails[code],
      hasPhoto: false // Изначально считаем, что фото нет
    }));
    
    Logger.log(`Найдено ${products.length} уникальных изделий`);
    return products;
    
  } catch (e) {
    Logger.log('Ошибка при получении списка изделий: ' + e.toString());
    Logger.log('Стек ошибки: ' + e.stack);
    throw new Error('Ошибка загрузки изделий: ' + e.toString());
  }
}

/**
 * Получение схемы изделия из листа "Схема"
 */
function getProductSchema(productCode) {
  try {
    const normalizedId = normalizeCode(productCode);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const schemaSheet = ss.getSheetByName("Схема");
    
    if (!schemaSheet) {
      Logger.log('Лист "Схема" не найден');
      return { schema: [], images: {} };
    }
    
    const data = schemaSheet.getDataRange().getValues();
    const schema = [];
    const imageCodes = new Set();
    
    // Пропускаем заголовок (первую строку)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Проверяем, что строка относится к нужному изделию (столбец E)
      if (row[4] && normalizeCode(row[4].toString().trim()) === normalizedId) {
        const schemaItem = {
          source: normalizeCode(row[0] ? row[0].toString().trim() : ''),
          sourceQuantity: row[1] || 1,
          target: normalizeCode(row[2] ? row[2].toString().trim() : ''),
          targetQuantity: row[3] || 1,
          productCode: normalizedId,
          sourceName: row[6] ? row[6].toString().trim() : '', // G - Название источника
          targetName: row[7] ? row[7].toString().trim() : '', // H - Название целевого изделия
          sourcePhotoId: normalizeCode(row[8] ? row[8].toString().trim() : ''), // I - Фото источника
          targetPhotoId: normalizeCode(row[9] ? row[9].toString().trim() : ''), // J - Фото целевого изделия
          operation: row[10] ? row[10].toString().trim() : '' // K - Операция
        };
        
        schema.push(schemaItem);
        
        // Собираем коды для загрузки изображений
        if (schemaItem.source) imageCodes.add(schemaItem.sourcePhotoId || schemaItem.source);
        if (schemaItem.target) imageCodes.add(schemaItem.targetPhotoId || schemaItem.target);
      }
    }
    
    // Загружаем изображения. Для полной схемы ищем фото узлов в папке изделия.
    const images = loadImagesForCodes(Array.from(imageCodes), normalizedId);
    
    Logger.log(`Загружена схема для ${normalizedId}: ${schema.length} элементов`);
    return {
      schema: schema,
      images: images
    };
    
  } catch (e) {
    Logger.log('Ошибка при получении схемы: ' + e.toString());
    return { schema: [], images: {} };
  }
}

/**
 * Сохранение схемы изделия в лист "Схема"
 */
function saveProductSchema(productCode, schema) {
  try {
    const normalizedId = normalizeCode(productCode);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const schemaSheet = ss.getSheetByName("Схема");
    
    if (!schemaSheet) {
      return { success: false, error: 'Лист "Схема" не найден' };
    }
    
    // Получаем все данные из листа
    const allData = schemaSheet.getDataRange().getValues();
    
    // Удаляем старые записи для этого изделия (кроме заголовка)
    const filteredData = [allData[0]]; // Сохраняем заголовок
    for (let i = 1; i < allData.length; i++) {
      if (!allData[i][4] || normalizeCode(allData[i][4].toString().trim()) !== normalizedId) {
        filteredData.push(allData[i]);
      }
    }
    
    // Добавляем новые записи
    schema.forEach(item => {
      filteredData.push([
        normalizeCode(item.source || ''),
        item.sourceQuantity || 1,
        normalizeCode(item.target || ''),
        item.targetQuantity || 1,
        normalizedId,
        item.targetName || '', // F - Название готового изделия
        item.sourceName || '', // G - Название источника
        item.targetName || '', // H - Название целевого изделия
        normalizeCode(item.sourcePhotoId || ''), // I - Фото источника
        normalizeCode(item.targetPhotoId || ''), // J - Фото целевого изделия
        item.operation || '' // K - Операция
      ]);
    });
    
    // Очищаем лист и записываем новые данные
    schemaSheet.clear();
    if (filteredData.length > 0) {
      schemaSheet.getRange(1, 1, filteredData.length, 11).setValues(filteredData);
    }
    
    Logger.log(`Сохранена схема для ${normalizedId}: ${schema.length} элементов`);
    return { success: true };
    
  } catch (e) {
    Logger.log('Ошибка при сохранении схемы: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * Создание нового изделия (добавляется запись в схему)
 */
function createProduct(code, name, sourceCode) {
  try {
    const normalizedId = normalizeCode(code);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const schemaSheet = ss.getSheetByName("Схема");
    
    if (!schemaSheet) {
      return { success: false, error: 'Лист "Схема" не найден' };
    }
    
    // Проверяем, не существует ли уже такое изделие в схеме
    const data = schemaSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][4] && normalizeCode(data[i][4].toString().trim()) === normalizedId) {
        return { success: false, error: 'Изделие с таким артикулом уже существует' };
      }
    }
    
    // Если указан sourceCode, дублируем схему
    if (sourceCode) {
      const sourceSchema = getProductSchema(sourceCode);
      if (sourceSchema.schema.length > 0) {
        // Обновляем productCode в схеме и сохраняем
        const newSchema = sourceSchema.schema.map(item => ({
          ...item,
          productCode: normalizedId,
          targetName: name // Обновляем название целевого изделия
        }));
        saveProductSchema(normalizedId, newSchema);
      }
    } else {
      // Создаем базовую запись для нового изделия
      schemaSheet.appendRow([
        '', // A - Источник (пустой для начала)
        1,  // B - Количество источника
        normalizedId, // C - Целевое изделие
        1,  // D - Количество целевого изделия
        normalizedId, // E - Код изделия (столбец E)
        name, // F - Название готового изделия
        '', // G - Название источника
        name, // H - Название целевого изделия
        '', // I - Фото источника
        normalizedId, // J - Фото целевого изделия (используем код)
        '' // K - Операция
      ]);
    }
    
    Logger.log(`Создано изделие ${normalizedId} - ${name}`);
    return { success: true };
    
  } catch (e) {
    Logger.log('Ошибка при создании изделия: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * Обновление изделия (обновляется в схеме)
 */
function updateProduct(oldCode, newCode, newName) {
  try {
    const normalizedOldId = normalizeCode(oldCode);
    const normalizedNewId = normalizeCode(newCode);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const schemaSheet = ss.getSheetByName("Схема");
    
    if (!schemaSheet) {
      return { success: false, error: 'Лист "Схема" не найден' };
    }
    
    const data = schemaSheet.getDataRange().getValues();
    let updated = false;
    
    // Ищем и обновляем все записи с этим изделием
    for (let i = 1; i < data.length; i++) {
      if (data[i][4] && normalizeCode(data[i][4].toString().trim()) === normalizedOldId) {
        // Обновляем код изделия (столбец E)
        schemaSheet.getRange(i + 1, 5).setValue(normalizedNewId);
        // Обновляем целевое изделие (столбец C), если оно совпадает
        if (data[i][2] && normalizeCode(data[i][2].toString().trim()) === normalizedOldId) {
          schemaSheet.getRange(i + 1, 3).setValue(normalizedNewId);
        }
        // Обновляем название готового изделия (столбец F)
        schemaSheet.getRange(i + 1, 6).setValue(newName);
        // Обновляем название целевого изделия (столбец H)
        schemaSheet.getRange(i + 1, 8).setValue(newName);
        // Обновляем фото целевого изделия (столбец J), если оно совпадает с кодом
        if (data[i][9] && normalizeCode(data[i][9].toString().trim()) === normalizedOldId) {
          schemaSheet.getRange(i + 1, 10).setValue(normalizedNewId);
        }
        updated = true;
      }
    }
    
    if (!updated) {
      return { success: false, error: 'Изделие не найдено' };
    }
    
    Logger.log(`Обновлено изделие ${normalizedOldId} -> ${normalizedNewId} - ${newName}`);
    return { success: true };
    
  } catch (e) {
    Logger.log('Ошибка при обновлении изделия: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * Переименование изделия (обновляется в схеме)
 */
function renameProduct(code, newName) {
  try {
    const normalizedId = normalizeCode(code);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const schemaSheet = ss.getSheetByName("Схема");
    
    if (!schemaSheet) {
      return { success: false, error: 'Лист "Схема" не найден' };
    }
    
    const data = schemaSheet.getDataRange().getValues();
    let updated = false;
    
    // Ищем и переименовываем изделие во всех записях схемы
    for (let i = 1; i < data.length; i++) {
      if (data[i][4] && normalizeCode(data[i][4].toString().trim()) === normalizedId) {
        // Обновляем название готового изделия (столбец F)
        schemaSheet.getRange(i + 1, 6).setValue(newName);
        // Обновляем название целевого изделия (столбец H)
        schemaSheet.getRange(i + 1, 8).setValue(newName);
        updated = true;
      }
    }
    
    if (!updated) {
      return { success: false, error: 'Изделие не найдено' };
    }
    
    Logger.log(`Переименовано изделие ${normalizedId} -> ${newName}`);
    return { success: true };
    
  } catch (e) {
    Logger.log('Ошибка при переименовании изделия: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * Загрузка изображений для списка кодов (упрощенная версия как в popup.js)
 * @param {string[]} codes - Массив кодов для поиска.
 * @param {string|null} productCodeContext - Артикул изделия, в папке которого нужно искать. Если null, ищет в корневой папке.
 */
function getFolderToSearch(productCodeContext) {
  const SCRIPT_CACHE = CacheService.getScriptCache();
  const ROOT_FOLDER_ID = '1qR_h4ZLVq51udz0r5ahA1rQ2V61oK-zu';

  // Если контекст не задан, просто возвращаем корневую папку
  if (!productCodeContext) {
    return DriveApp.getFolderById(ROOT_FOLDER_ID);
  }
  
  const normalizedContext = normalizeCode(productCodeContext);
  const cacheKey = `folder_id_${normalizedContext}`;
  const cachedFolderId = SCRIPT_CACHE.get(cacheKey);

  // Если ID папки есть в кеше, используем его
  if (cachedFolderId) {
    if (cachedFolderId === 'not_found') {
      Logger.log(`Подпапка для изделия ${normalizedContext} не найдена (из кэша).`);
      return null;
    }
    try {
      return DriveApp.getFolderById(cachedFolderId);
    } catch (e) {
      Logger.log(`Ошибка получения папки ${cachedFolderId} из кэша. Повторный поиск. Ошибка: ${e.toString()}`);
      // Если папка не найдена по кешированному ID, продолжаем и ищем заново
    }
  }

  // Если в кеше нет, ищем папку
  const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
  const subfolderIterator = rootFolder.getFoldersByName(normalizedContext);

  if (subfolderIterator.hasNext()) {
    const folder = subfolderIterator.next();
    // Кешируем найденный ID на 6 часов (максимальное время)
    SCRIPT_CACHE.put(cacheKey, folder.getId(), 21600);
    return folder;
  } else {
    Logger.log(`Подпапка для изделия ${normalizedContext} не найдена. Кэшируем 'not_found'.`);
    // Кешируем результат 'not_found' на 5 минут, чтобы не искать постоянно
    SCRIPT_CACHE.put(cacheKey, 'not_found', 300);
    return null;
  }
}

function loadImagesForCodes(codes, productCodeContext = null) {
  const images = {};
  
  if (!codes || codes.length === 0) {
    return images;
  }
  
  try {
    const folderToSearch = getFolderToSearch(productCodeContext);

    // Если папка (включая подпапку) не найдена, выходим
    if (!folderToSearch) {
      return {};
    }
    
    // Больше не ограничиваем количество, т.к. поиск папки кешируется
    const uniqueCodes = [...new Set(codes)];
    
    uniqueCodes.forEach(code => {
      if (!code) return;
      
      const cleanCode = normalizeCode(code.toString().trim());
      
      try {
        // Проверяем JPG
        let fileIterator = folderToSearch.getFilesByName(cleanCode + '.jpg');
        if (fileIterator.hasNext()) {
          const file = fileIterator.next();
          const blob = file.getBlob();
          const base64Data = Utilities.base64Encode(blob.getBytes());
          images[cleanCode] = `data:${blob.getContentType()};base64,${base64Data}`;
          return;
        }
        
        // Проверяем PNG
        fileIterator = folderToSearch.getFilesByName(cleanCode + '.png');
        if (fileIterator.hasNext()) {
          const file = fileIterator.next();
          const blob = file.getBlob();
          const base64Data = Utilities.base64Encode(blob.getBytes());
          images[cleanCode] = `data:${blob.getContentType()};base64,${base64Data}`;
          return;
        }
        
        // Если файл не найден
        images[cleanCode] = null;
        
      } catch (e) {
        Logger.log(`Ошибка при загрузке изображения ${cleanCode}: ${e.toString()}`);
        images[cleanCode] = null;
      }
    });
    
  } catch (e) {
    Logger.log('Ошибка при загрузке изображений: ' + e.toString());
  }
  
  return images;
}

/**
 * Универсальная функция для загрузки карточек (изделия или узлы)
 * @param {string} filterType - 'products' для изделий, 'nodes' для узлов
 * @param {string} filterValue - значение для фильтрации (null для изделий, код изделия для узлов)
 */
function getCardsFast(filterType, filterValue = null, rootProductCode = null) {
  try {
    Logger.log(`Быстрая загрузка карточек: ${filterType}, фильтр: ${filterValue}, корень: ${rootProductCode}`);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const schemaSheet = ss.getSheetByName("Схема");
    
    if (!schemaSheet) {
      Logger.log('Лист "Схема" не найден');
      return [];
    }
    
    const data = schemaSheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      Logger.log('Схема пуста, возвращаем пустой массив');
      return [];
    }
    
    const cards = [];
    const seenCodes = new Set();
    const normalizedFilterValue = normalizeCode(filterValue);
    
    if (filterType === 'products') {
      // Для изделий: группируем по столбцу E (код изделия)
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const productCode = row[4]; // Столбец E
        
        if (productCode && productCode.toString().trim()) {
          const code = normalizeCode(productCode.toString().trim());
          
          if (!seenCodes.has(code)) {
            seenCodes.add(code);
            cards.push({
              code: code,
              name: row[5] ? row[5].toString().trim() : 'Без названия', // F - название изделия
              photoId: code,
              type: 'product',
              hasChildren: true // У изделий всегда есть дочерние элементы
            });
          }
        }
      }
      
      cards.sort((a, b) => a.code.localeCompare(b.code));
      
    } else if (filterType === 'nodes' && normalizedFilterValue && rootProductCode) {
      const normalizedRootCode = normalizeCode(rootProductCode);
      Logger.log(`Поиск узлов для ${normalizedFilterValue} внутри изделия ${normalizedRootCode} с использованием бинарного поиска (данные считаются предварительно отсортированными)`);

      // 1. Используем данные как есть (без заголовка), т.к. они уже отсортированы по "Артикулу готового изделия" (столбец E)
      const sortedData = data.slice(1);

      // 2. Находим диапазон строк для корневого изделия с помощью бинарного поиска
      const start = binarySearchStart(sortedData, normalizedRootCode, 4);
      if (start === -1) {
          Logger.log(`Не найдено строк для изделия ${normalizedRootCode}`);
          return [];
      }
      const end = binarySearchEnd(sortedData, normalizedRootCode, 4);

      const children = new Map();
      const allTargetsInProduct = new Set();

      // 3. Собираем всех возможных "родителей" только в найденном диапазоне
      for (let i = start; i <= end; i++) {
          const row = sortedData[i];
          const target = normalizeCode(row[2]); // столбец C
          if (target) {
              allTargetsInProduct.add(target);
          }
      }

      // 4. Находим прямых потомков для текущего узла в том же диапазоне
      for (let i = start; i <= end; i++) {
          const row = sortedData[i];
          const source = normalizeCode(row[0]); // столбец A
          const target = normalizeCode(row[2]); // столбец C

          if (target === normalizedFilterValue) {
              if (source && !children.has(source)) {
                  children.set(source, {
                      code: source,
                      name: row[6] ? row[6].toString().trim() : 'Без названия', // G
                      photoId: source,
                      type: 'node',
                      quantity: row[1] || 1, // B
                      isOperation: String(row[1]).toLowerCase() === 'операция',
                  });
              }
          }
      }
      
      // 5. Преобразуем Map в массив и проставляем флаг hasChildren
      const finalCards = Array.from(children.values()).map(child => {
        child.hasChildren = allTargetsInProduct.has(child.code);
        return child;
      });
      
      finalCards.sort((a, b) => a.code.localeCompare(b.code));
      Logger.log(`Найдено ${finalCards.length} дочерних узлов для ${normalizedFilterValue}`);
      return finalCards;
    }
    
    Logger.log(`Загружено ${cards.length} карточек типа ${filterType}`);
    return cards;
    
  } catch (e) {
    Logger.log(`Ошибка при загрузке карточек: ${e.toString()}`);
    return [];
  }
}

/**
 * Бинарный поиск начала диапазона
 */
function binarySearchStart(sortedArray, target, columnIndex) {
  let left = 0;
  let right = sortedArray.length - 1;
  let result = -1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const value = normalizeCode(sortedArray[mid][columnIndex]);
    
    if (value.localeCompare(target) >= 0) {
      if (value === target) result = mid;
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }
  // Если result не найден, но left указывает на начало блока
  if (result === -1 && left < sortedArray.length && normalizeCode(sortedArray[left][columnIndex]) === target) {
    return left;
  }
  return result;
}

/**
 * Бинарный поиск конца диапазона
 */
function binarySearchEnd(sortedArray, target, columnIndex) {
  let left = 0;
  let right = sortedArray.length - 1;
  let result = -1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const value = normalizeCode(sortedArray[mid][columnIndex]);
    
    if (value.localeCompare(target) <= 0) {
      if (value === target) result = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
    // Если result не найден, но right указывает на конец блока
  if (result === -1 && right >= 0 && normalizeCode(sortedArray[right][columnIndex]) === target) {
    return right;
  }
  return result;
}

/**
 * Получение списка изделий без фото (быстрая загрузка) - УСТАРЕЛО, используйте getCardsFast
 */
function getProductsListFast() {
  return getCardsFast('products');
}

/**
 * Получение одного изображения (для динамической загрузки)
 */
function getProductPhotoBase64(imageCode, productCodeContext = null) {
  const images = loadImagesForCodes([imageCode], productCodeContext);
  return images[normalizeCode(imageCode)] || null;
}

/**
 * Быстрая загрузка узлов для конкретного уровня - УСТАРЕЛО, используйте getCardsFast('nodes', levelCode)
 */
function getNodesForLevelFast(levelCode) {
  return getCardsFast('nodes', levelCode);
}

/**
 * Загрузка полной схемы изделия (только когда нужно редактировать)
 */
function loadFullSchemaForProduct(productCode) {
  try {
    const normalizedId = normalizeCode(productCode);
    Logger.log(`Загрузка полной схемы для изделия: ${normalizedId}`);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const schemaSheet = ss.getSheetByName("Схема");
    
    if (!schemaSheet) {
      Logger.log('Лист "Схема" не найден');
      return { schema: [], images: {} };
    }
    
    const data = schemaSheet.getDataRange().getValues();
    const schema = [];
    const imageCodes = new Set();
    
    // Пропускаем заголовок (первую строку)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Проверяем, что строка относится к нужному изделию (столбец E)
      if (row[4] && normalizeCode(row[4].toString().trim()) === normalizedId) {
        const schemaItem = {
          source: normalizeCode(row[0] ? row[0].toString().trim() : ''),
          sourceQuantity: row[1] || 1,
          target: normalizeCode(row[2] ? row[2].toString().trim() : ''),
          targetQuantity: row[3] || 1,
          productCode: normalizedId,
          sourceName: row[6] ? row[6].toString().trim() : '', // G - Название источника
          targetName: row[7] ? row[7].toString().trim() : '', // H - Название целевого изделия
          sourcePhotoId: normalizeCode(row[8] ? row[8].toString().trim() : ''), // I - Фото источника
          targetPhotoId: normalizeCode(row[9] ? row[9].toString().trim() : ''), // J - Фото целевого изделия
          operation: row[10] ? row[10].toString().trim() : '' // K - Операция
        };
        
        schema.push(schemaItem);
        
        // Собираем коды для загрузки изображений
        if (schemaItem.source) imageCodes.add(schemaItem.sourcePhotoId || schemaItem.source);
        if (schemaItem.target) imageCodes.add(schemaItem.targetPhotoId || schemaItem.target);
      }
    }
    
    // Больше не загружаем изображения здесь, клиент сделает это по необходимости
    // const images = loadImagesForCodes(Array.from(imageCodes), normalizedId);
    
    Logger.log(`Загружена полная схема для ${normalizedId}: ${schema.length} элементов (без изображений)`);
    return {
      schema: schema,
      images: {} // Всегда возвращаем пустой объект, изображения загрузит клиент
    };
    
  } catch (e) {
    Logger.log('Ошибка при загрузке полной схемы: ' + e.toString());
    return { schema: [], images: {} };
  }
}

/**
 * Удаление изделия (удаляет все записи в схеме)
 */
function deleteProduct(productCode) {
  try {
    const normalizedId = normalizeCode(productCode);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const schemaSheet = ss.getSheetByName("Схема");
    
    if (!schemaSheet) {
      return { success: false, error: 'Лист "Схема" не найден' };
    }
    
    // Получаем все данные из листа
    const allData = schemaSheet.getDataRange().getValues();
    
    // Удаляем все записи для этого изделия
    const filteredData = [allData[0]]; // Сохраняем заголовок
    for (let i = 1; i < allData.length; i++) {
      if (!allData[i][4] || normalizeCode(allData[i][4].toString().trim()) !== normalizedId) {
        filteredData.push(allData[i]);
      }
    }
    
    // Очищаем лист и записываем оставшиеся данные
    schemaSheet.clear();
    if (filteredData.length > 0) {
      schemaSheet.getRange(1, 1, filteredData.length, 11).setValues(filteredData);
    }
    
    Logger.log(`Удалено изделие ${normalizedId}`);
    return { success: true };
    
  } catch (e) {
    Logger.log('Ошибка при удалении изделия: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * Обновление операции для целевого узла
 */
function updateOperationForNode(productCode, nodeCode, newOperation) {
  try {
    const normalizedProductCode = normalizeCode(productCode);
    const normalizedNodeCode = normalizeCode(nodeCode);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const schemaSheet = ss.getSheetByName("Схема");
    
    if (!schemaSheet) {
      return { success: false, error: 'Лист "Схема" не найден' };
    }
    
    const data = schemaSheet.getDataRange().getValues();
    let updated = false;
    
    // Ищем и обновляем все записи с этим изделием и целевым узлом
    for (let i = 1; i < data.length; i++) {
      if (normalizeCode(data[i][4]) === normalizedProductCode && normalizeCode(data[i][2]) === normalizedNodeCode) {
        // Обновляем операцию (столбец K)
        schemaSheet.getRange(i + 1, 11).setValue(newOperation);
        updated = true;
      }
    }
    
    if (!updated) {
      Logger.log(`Не найден узел ${normalizedNodeCode} как целевой в изделии ${normalizedProductCode} для обновления операции.`);
    }
    
    Logger.log(`Обновлена операция для узла ${normalizedNodeCode} в изделии ${normalizedProductCode} на "${newOperation}"`);
    return { success: true };
    
  } catch (e) {
    Logger.log('Ошибка при обновлении операции: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

 