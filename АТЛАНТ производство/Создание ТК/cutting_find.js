/**
 * Программа оптимизации раскроя для Google Apps Script
 * Адаптировано из Python-скрипта wb_cutting_optimization.py
 */

/**
 * Основная функция для поиска оптимальных раскроев
 */
function findOptimalCuttings() {
  try {
    // Получаем активную таблицу
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    // Получаем данные из листов
    var schemaData = getSheetData(spreadsheet, "Схема");
    var cuttingData = getSheetData(spreadsheet, "Раскрои");
    var stockData = getSheetData(spreadsheet, "Склад");
    var materialTypesData = getSheetData(spreadsheet, "Типы раскроев");
    
    if (!schemaData || !cuttingData) {
      SpreadsheetApp.getUi().alert("Не удалось получить данные из таблицы. Проверьте наличие листов 'Схема' и 'Раскрои'.");
      return;
    }
    
    // Создаем словарь соответствия коротких и полных названий материалов
    var materialNames = {};
    if (materialTypesData && materialTypesData.length > 1) {
      for (var i = 1; i < materialTypesData.length; i++) {
        if (materialTypesData[i].length >= 2 && materialTypesData[i][0] && materialTypesData[i][1]) {
          materialNames[materialTypesData[i][0].toString().trim()] = materialTypesData[i][1].toString().trim();
        }
      }
    }
    
    // Получаем значение из активной ячейки и из столбца A этой же строки
    var activeCell = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getActiveCell();
    var targetProduct = activeCell.getValue().toString().trim();
    var rowIndex = activeCell.getRow();
    var orderNumber = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getRange(rowIndex, 1).getValue().toString().trim();
    
    // Получаем количество из столбца E (индекс 5)
    var quantity = 1; // Значение по умолчанию
    try {
      var quantityValue = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getRange(rowIndex, 5).getValue();
      
      // Преобразуем значение в число
      if (typeof quantityValue === 'number') {
        quantity = quantityValue;
      } else if (typeof quantityValue === 'string') {
        // Удаляем все нечисловые символы, кроме точки и запятой
        quantityValue = quantityValue.replace(/[^\d.,]/g, '').replace(',', '.');
        if (quantityValue !== '') {
          var parsedValue = parseFloat(quantityValue);
          if (!isNaN(parsedValue) && parsedValue > 0) {
            quantity = parsedValue;
          }
        }
      }
      
      // Проверяем корректность значения
      if (isNaN(quantity) || quantity <= 0) {
        quantity = 1;
      }
    } catch (e) {
      Logger.log("Ошибка при получении количества: " + e.toString());
      quantity = 1;
    }
    
    // Построение графа с учетом целевого изделия
    var graph = buildGraph(schemaData, targetProduct);
    
    // Проверяем, является ли выбранная ячейка артикулом изделия
    if (!isValidProduct(targetProduct, graph)) {
      SpreadsheetApp.getUi().alert("Выбранная ячейка не содержит артикул изделия.");
      return;
    }
    
    // Поиск всех компонентов
    var result = findAllComponents(graph, targetProduct);
    var components = result.components;
    var operations = result.operations;
    
    // Умножаем количество каждого компонента на количество изделий в заказе
    for (var part in components) {
      components[part] *= quantity;
    }
    
    // Фильтрация только раскройных деталей
    var cuttingParts = {};
    for (var part in components) {
      if (isCuttingPart(part)) {
        cuttingParts[part] = components[part];
      }
    }
    
    // Получение данных о раскроях
    var cuttings = getCuttingData(cuttingData);
    
    // Получение данных о наличии деталей на складе
    var stock = getStockData(stockData);
    
    // Получение уникальных значений из столбца C, где в столбце E выбранный артикул
    var uniqueValues = getUniqueValuesFromSchema(schemaData, targetProduct, quantity, orderNumber);
    
    if (Object.keys(cuttings).length === 0) {
      SpreadsheetApp.getUi().alert("Не найдено данных о раскроях. Программа завершена.");
      return;
    }
    
    // Поиск оптимального набора раскроев
    var result = findOptimalCuttingsSet(cuttingParts, cuttings, stock);
    
    // Создаем словарь для отслеживания, в каком раскрое будет раскраиваться каждая деталь
    var partToCutting = mapPartsToCuttings(result.selectedCuttings, cuttings, result.partsToCut);
    
    // Создаем HTML-отчет и открываем его в модальном окне
    showHtmlReport(components, stock, partToCutting, result.partsToCut, cuttings, 
                  result.selectedCuttings, result.extraParts, targetProduct, result, orderNumber, materialNames, uniqueValues, quantity);
    
  } catch (error) {
    Logger.log("Ошибка: " + error.toString());
    SpreadsheetApp.getUi().alert("Произошла ошибка: " + error.toString());
  }
}

/**
 * Проверяет, является ли код действительным изделием в графе
 */
function isValidProduct(productCode, graph) {
  // Проверяем, есть ли код в графе или есть ли у него компоненты
  return productCode && (graph[productCode] !== undefined || isLeafInGraph(productCode, graph));
}

/**
 * Проверяет, является ли код листом в графе (т.е. используется как компонент)
 */
function isLeafInGraph(productCode, graph) {
  for (var parent in graph) {
    for (var i = 0; i < graph[parent].length; i++) {
      if (graph[parent][i].component === productCode) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Получение данных из листа таблицы
 */
function getSheetData(spreadsheet, sheetName) {
  try {
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      Logger.log("Лист '" + sheetName + "' не найден");
      return null;
    }
    
    var data = sheet.getDataRange().getValues();
    Logger.log("Успешно получены данные из листа '" + sheetName + "': " + data.length + " строк");
    return data;
  } catch (e) {
    Logger.log("Ошибка при получении данных из листа '" + sheetName + "': " + e.toString());
    return null;
  }
}

/**
 * Построение графа изделия
 */
function buildGraph(schemaData, targetProduct) {
  var graph = {};
  
  Logger.log("Построение графа из " + schemaData.length + " строк данных");
  
  for (var i = 1; i < schemaData.length; i++) {  // Пропускаем заголовок
    var row = schemaData[i];
    if (row.length < 5 || !row[0] || !row[1] || !row[2] || !row[3] || !row[4]) {  // Проверяем наличие всех нужных столбцов
      continue;
    }
    
    // Проверяем, что строка относится к целевому изделию
    if (row[4].toString().trim() !== targetProduct) {
      continue;
    }
    
    var source = row[0].toString().trim();
    var sourceQuantity = row[1].toString().trim();
    var target = row[2].toString().trim();
    var targetQuantity = row[3].toString().trim();
    
    // Добавляем ребро в граф
    if (!graph[target]) {
      graph[target] = [];
    }
    
    graph[target].push({
      'component': source,
      'quantity': sourceQuantity !== "операция" ? sourceQuantity : "операция",
      'targetQuantity': targetQuantity
    });
  }
  
  // Выводим информацию о построенном графе
  Logger.log("Построен граф с " + Object.keys(graph).length + " узлами");
  return graph;
}

/**
 * Поиск всех компонентов для изделия (обход графа)
 */
function findAllComponents(graph, productCode, multiplier) {
  var components = {};
  var operations = [];
  multiplier = multiplier || 1;
  
  function traverse(productCode, multiplier) {
    // Если продукта нет в графе, значит это базовый компонент
    if (!graph[productCode]) {
      components[productCode] = (components[productCode] || 0) + multiplier;
      return;
    }
    
    // Обходим все компоненты текущего продукта
    for (var i = 0; i < graph[productCode].length; i++) {
      var component = graph[productCode][i];
      
      if (component.quantity === "операция") {
        operations.push(component.component);
      } else {
        // Рассчитываем количество компонентов с учетом множителя
        try {
          var compQuantity = parseInt(component.quantity);
          var targetQuantity = parseInt(component.targetQuantity);
          var newMultiplier = multiplier * compQuantity / targetQuantity;
          
          // Рекурсивно обходим граф для этого компонента
          traverse(component.component, newMultiplier);
        } catch (e) {
          Logger.log("Ошибка при обработке компонента " + component.component + ": " + e.toString());
          Logger.log("Данные компонента: " + JSON.stringify(component));
        }
      }
    }
  }
  
  traverse(productCode, multiplier);
  
  return {
    components: components,
    operations: operations
  };
}

/**
 * Проверка, является ли компонент раскройной деталью
 */
function isCuttingPart(partCode) {
  // Проверяем, содержит ли код букву "Р" с возможными другими буквами после неё
  if (partCode.indexOf('Р') === -1) {
    return false;
  }
  
  // Находим позицию буквы "Р"
  var rPos = partCode.indexOf('Р');
  
  // Проверяем, что до буквы "Р" только цифры и точки
  var beforeR = partCode.substring(0, rPos);
  for (var i = 0; i < beforeR.length; i++) {
    var c = beforeR.charAt(i);
    if (!(c >= '0' && c <= '9') && c !== '.') {
      return false;
    }
  }
  
  return true;
}

/**
 * Получение данных о раскроях
 */
function getCuttingData(cuttingData) {
  var cuttings = {};
  
  Logger.log("Обработка данных о раскроях из " + cuttingData.length + " строк");
  
  for (var i = 1; i < cuttingData.length; i++) {  // Пропускаем заголовок
    var row = cuttingData[i];
    if (!row || !row[0]) {  // Пропускаем пустые строки
      continue;
    }
    
    var cuttingNumber = row[0].toString().trim();
    var partCode = row.length > 1 && row[1] ? row[1].toString().trim() : "";
    
    // Получаем площадь детали из столбца J (индекс 9)
    var area = 0;
    if (row.length > 9 && row[9]) {
      try {
        area = parseFloat(row[9].toString().replace(',', '.'));
      } catch (e) {
        try {
          // Пробуем очистить строку от непечатаемых символов
          var cleanValue = row[9].toString().replace(/[^0-9.,]/g, '').replace(',', '.');
          if (cleanValue) {
            area = parseFloat(cleanValue);
          } else {
            Logger.log("Предупреждение: Не удалось преобразовать '" + row[9] + "' в число для площади детали " + partCode);
          }
        } catch (e) {
          Logger.log("Предупреждение: Не удалось преобразовать '" + row[9] + "' в число для площади детали " + partCode);
        }
      }
    }
    
    // Проверяем, что столбец K (индекс 10) существует и содержит число
    var quantity = 0;
    if (row.length > 10 && row[10]) {
      try {
        quantity = parseInt(row[10].toString());
      } catch (e) {
        try {
          // Пробуем очистить строку от непечатаемых символов
          var cleanValue = row[10].toString().replace(/[^0-9]/g, '');
          if (cleanValue) {
            quantity = parseInt(cleanValue);
          } else {
            Logger.log("Предупреждение: Не удалось преобразовать '" + row[10] + "' в число для раскроя " + cuttingNumber + ", детали " + partCode);
          }
        } catch (e) {
          Logger.log("Предупреждение: Не удалось преобразовать '" + row[10] + "' в число для раскроя " + cuttingNumber + ", детали " + partCode);
        }
      }
    }
    
    if (partCode && quantity > 0) {
      if (!cuttings[cuttingNumber]) {
        cuttings[cuttingNumber] = [];
      }
      
      cuttings[cuttingNumber].push({
        'partCode': partCode,
        'quantity': quantity,
        'area': area
      });
    }
  }
  
  Logger.log("Обработано " + Object.keys(cuttings).length + " раскроев");
  return cuttings;
}

/**
 * Получение данных о наличии деталей на складе
 */
function getStockData(stockData) {
  var stock = {};
  
  Logger.log("Обработка данных о складе из " + stockData.length + " строк");
  
  for (var i = 1; i < stockData.length; i++) {  // Пропускаем заголовок
    var row = stockData[i];
    if (!row || row.length < 2) {  // Пропускаем пустые строки или строки без нужных данных
      continue;
    }
    
    var partCode = row[0].toString().trim();
    
    // Получаем количество на складе
    var quantity = 0;
    if (row[1]) {
      try {
        quantity = parseInt(row[1].toString());
      } catch (e) {
        try {
          // Пробуем очистить строку от непечатаемых символов
          var cleanValue = row[1].toString().replace(/[^0-9]/g, '');
          if (cleanValue) {
            quantity = parseInt(cleanValue);
          } else {
            Logger.log("Предупреждение: Не удалось преобразовать '" + row[1] + "' в число для детали " + partCode + " на складе");
          }
        } catch (e) {
          Logger.log("Предупреждение: Не удалось преобразовать '" + row[1] + "' в число для детали " + partCode + " на складе");
        }
      }
    }
    
    if (partCode && quantity > 0) {
      stock[partCode] = quantity;
    }
  }
  
  Logger.log("Обработано " + Object.keys(stock).length + " деталей на складе");
  return stock;
}

/**
 * Поиск оптимального набора раскроев с учетом наличия деталей на складе
 */
function findOptimalCuttingsSet(requiredParts, cuttings, stock) {
  // Создаем копию требуемых деталей, чтобы не изменять оригинал
  var remainingParts = {};
  
  // Учитываем наличие деталей на складе
  var partsFromStock = {};
  var partsToCut = {};
  
  for (var part in requiredParts) {
    var qty = requiredParts[part];
    var stockQty = stock[part] || 0;
    
    if (stockQty >= qty) {
      // Если на складе достаточно деталей, берем их оттуда
      partsFromStock[part] = qty;
    } else {
      // Если на складе недостаточно деталей, берем что есть и остальное вырезаем
      partsFromStock[part] = stockQty;
      partsToCut[part] = qty - stockQty;
      remainingParts[part] = qty - stockQty;
    }
  }
  
  Logger.log("Поиск оптимального набора раскроев для " + Object.keys(remainingParts).length + 
             " деталей из " + Object.keys(cuttings).length + " доступных раскроев");
  
  // Словарь для хранения выбранных раскроев и их количества
  var selectedCuttings = {};
  
  // Словарь для хранения лишних деталей
  var extraParts = {};
  
  // Переменные для отслеживания площади и количества
  var usefulArea = 0;  // Площадь нужных деталей
  var wasteArea = 0;   // Площадь ненужных деталей
  var usefulCount = 0;  // Количество нужных деталей
  var wasteCount = 0;   // Количество ненужных деталей
  
  // Пока есть неудовлетворенные требования
  var iteration = 0;
  while (sumValues(remainingParts) > 0 && iteration < 100) {  // Ограничиваем количество итераций
    iteration++;
    var bestCutting = null;
    var bestScore = -1;
    
    // Перебираем все раскрои
    for (var cuttingNumber in cuttings) {
      var parts = cuttings[cuttingNumber];
      
      // Считаем площадь нужных деталей в этом раскрое
      var usefulAreaInCutting = 0;
      var totalAreaInCutting = 0;
      
      for (var i = 0; i < parts.length; i++) {
        var part = parts[i];
        var partCode = part.partCode;
        var quantity = part.quantity;
        var area = part.area;
        
        // Общая площадь всех деталей этого типа в раскрое
        var partTotalArea = area * quantity;
        totalAreaInCutting += partTotalArea;
        
        // Если деталь нужна, считаем полезную площадь
        if (remainingParts[partCode] && remainingParts[partCode] > 0) {
          var usefulQuantity = Math.min(quantity, remainingParts[partCode]);
          usefulAreaInCutting += area * usefulQuantity;
        }
      }
      
      // Если раскрой дает полезные детали
      if (usefulAreaInCutting > 0) {
        // Оценка эффективности: отношение полезной площади к общей площади
        var score = usefulAreaInCutting / totalAreaInCutting;
        
        if (score > bestScore) {
          bestScore = score;
          bestCutting = cuttingNumber;
        }
      }
    }
    
    // Если не нашли подходящий раскрой, выходим из цикла
    if (bestCutting === null) {
      break;
    }
    
    // Добавляем выбранный раскрой
    selectedCuttings[bestCutting] = (selectedCuttings[bestCutting] || 0) + 1;
    
    // Обновляем оставшиеся требования и учитываем лишние детали
    var parts = cuttings[bestCutting];
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      var partCode = part.partCode;
      var quantity = part.quantity;
      var area = part.area;
      
      if (remainingParts[partCode] && remainingParts[partCode] > 0) {
        // Если деталь нужна
        var used = Math.min(quantity, remainingParts[partCode]);
        remainingParts[partCode] -= used;
        
        // Учитываем площадь и количество полезных деталей
        usefulArea += area * used;
        usefulCount += used;
        
        // Если остались лишние детали этого типа
        if (quantity > used) {
          extraParts[partCode] = (extraParts[partCode] || 0) + (quantity - used);
          // Учитываем площадь и количество лишних деталей
          wasteArea += area * (quantity - used);
          wasteCount += (quantity - used);
        }
      } else {
        // Если деталь не нужна вообще
        extraParts[partCode] = (extraParts[partCode] || 0) + quantity;
        // Учитываем площадь и количество лишних деталей
        wasteArea += area * quantity;
        wasteCount += quantity;
      }
    }
  }
  
  // Проверяем, все ли требования удовлетворены
  var unsatisfied = {};
  for (var part in remainingParts) {
    if (remainingParts[part] > 0) {
      unsatisfied[part] = remainingParts[part];
    }
  }
  
  // Рассчитываем общую эффективность
  var totalEfficiency = (usefulArea + wasteArea) > 0 ? usefulArea / (usefulArea + wasteArea) : 0;
  
  return {
    selectedCuttings: selectedCuttings,
    extraParts: extraParts,
    unsatisfied: unsatisfied,
    usefulArea: usefulArea,
    wasteArea: wasteArea,
    totalEfficiency: totalEfficiency,
    partsFromStock: partsFromStock,
    partsToCut: partsToCut,
    usefulCount: usefulCount,
    wasteCount: wasteCount
  };
}

/**
 * Вспомогательная функция для суммирования значений в объекте
 */
function sumValues(obj) {
  var sum = 0;
  for (var key in obj) {
    sum += obj[key];
  }
  return sum;
}

/**
 * Создание отображения деталей на раскрои
 */
function mapPartsToCuttings(selectedCuttings, cuttings, partsToCut) {
  // Создаем словарь для отслеживания, в каком раскрое будет раскраиваться каждая деталь
  var partToCutting = {};
  
  // Заполняем словарь, проходя по выбранным раскроям и отслеживая количество деталей
  var remainingNeeded = {};
  for (var part in partsToCut) {
    remainingNeeded[part] = partsToCut[part];
  }
  
  // Проходим по выбранным раскроям в порядке их выбора
  for (var cuttingNumber in selectedCuttings) {
    var parts = cuttings[cuttingNumber];
    
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      var partCode = part.partCode;
      var quantity = part.quantity;
      
      if (partsToCut[partCode] && remainingNeeded[partCode] > 0) {
        // Определяем, сколько деталей мы берем из этого раскроя
        var used = Math.min(quantity, remainingNeeded[partCode]);
        remainingNeeded[partCode] -= used;
        
        // Добавляем информацию о раскрое
        if (!partToCutting[partCode]) {
          partToCutting[partCode] = [];
        }
        
        // Добавляем раскрой с указанием количества деталей
        partToCutting[partCode].push([cuttingNumber, used]);
      }
    }
  }
  
  return partToCutting;
}

/**
 * Получить уникальные значения из схемы для технологических карт
 */
function getUniqueValuesFromSchema(schemaData, targetProduct, quantity, orderNumber) {
  var uniqueValues = [];
  var quantityMap = {}; // Для хранения количества для каждого артикула
  var operationsMap = {}; // Для хранения операций для каждого артикула
  
  quantity = quantity || 1;
  
  for (var i = 1; i < schemaData.length; i++) {
    if (schemaData[i].length >= 5 && schemaData[i][4]) {
      var columnE = schemaData[i][4].toString().trim();
      if (columnE === targetProduct && schemaData[i][2]) {
        var columnC = schemaData[i][2].toString().trim();
        var columnB = schemaData[i].length > 1 && schemaData[i][1] ? schemaData[i][1].toString().trim() : "";
        var columnD = schemaData[i].length > 3 && schemaData[i][3] ? schemaData[i][3].toString().trim() : "1";
        if (uniqueValues.indexOf(columnC) === -1) {
          uniqueValues.push(columnC);
          quantityMap[columnC] = columnD;
          operationsMap[columnC] = [];
        }
        if (columnB === "операция" && schemaData[i][0]) {
          var operation = schemaData[i][0].toString().trim();
          if (operationsMap[columnC].indexOf(operation) === -1) {
            operationsMap[columnC].push(operation);
          }
        }
      }
    }
  }
  
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var tkSheet = spreadsheet.getSheetByName("ТК");
  var tkNumbers = {};
  
  if (tkSheet) {
    var tkData = tkSheet.getDataRange().getValues();
    for (var i = 1; i < tkData.length; i++) {
      // Теперь проверяем и артикул, и номер заказа
      if (tkData[i][1] === targetProduct && tkData[i][2] && tkData[i][4] == orderNumber) {
        var tkArticle = tkData[i][2].toString().trim();
        var tkNumber = tkData[i][0];
        if (tkNumber) {
          tkNumbers[tkArticle] = tkNumber;
        }
      }
    }
  }
  
  var result = [];
  for (var i = 0; i < uniqueValues.length; i++) {
    var code = uniqueValues[i];
    var tkNumber = null;
    if (tkNumbers[code]) {
      tkNumber = tkNumbers[code];
    } else {
      var codeWithoutLeadingZeros = code.replace(/^0+/, '');
      for (var tkArticle in tkNumbers) {
        var tkArticleWithoutLeadingZeros = tkArticle.replace(/^0+/, '');
        if (tkArticleWithoutLeadingZeros === codeWithoutLeadingZeros) {
          tkNumber = tkNumbers[tkArticle];
          break;
        }
      }
    }
    var componentQuantity = quantityMap[code];
    var numericQuantity = parseFloat(componentQuantity);
    if (!isNaN(numericQuantity)) {
      componentQuantity = numericQuantity * quantity;
    }
    result.push({
      code: code,
      quantity: componentQuantity,
      operations: operationsMap[code].join(", "),
      tkNumber: tkNumber
    });
  }
  return result;
}

/**
 * Показать HTML-отчет в модальном окне
 */
function showHtmlReport(components, stock, partToCutting, partsToCut, cuttings, 
                      selectedCuttings, extraParts, targetProduct, result, orderNumber, materialNames, uniqueValues, quantity) {
  // Проверяем отсутствующие детали
  var missingParts = [];
  for (var part in components) {
    if (isCuttingPart(part)) {  // Проверяем только раскройные детали
      var found = false;
      for (var cutting in selectedCuttings) {
        for (var i = 0; i < cuttings[cutting].length; i++) {
          if (cuttings[cutting][i].partCode === part) {
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (!found) {
        missingParts.push(part);
      }
    }
  }

  // Создаем HTML с предупреждением
  var warningHtml = '';
  if (missingParts.length > 0) {
    warningHtml = '<div id="missing-parts-warning" class="warning-box">' +
                 '<div class="warning-content">' +
                 '<span class="warning-icon">⚠️</span>' +
                 '<span class="warning-text">Отсутствуют детали: ' + missingParts.join(', ') + '</span>' +
                 '</div></div>';
  }

  // Создаем шаблон
  var template = HtmlService.createTemplateFromFile('cutting_html');
  
  // Передаем данные в шаблон
  template.data = {
    components: components,
    stock: stock,
    partToCutting: partToCutting,
    partsToCut: partsToCut,
    cuttings: cuttings,
    selectedCuttings: selectedCuttings,
    extraParts: extraParts,
    targetProduct: targetProduct,
    result: result,
    orderNumber: orderNumber,
    materialNames: materialNames,
    uniqueValues: uniqueValues,
    quantity: quantity,
    missingParts: missingParts,
    warningHtml: warningHtml
  };
  
  // Отображаем HTML
  var html = template.evaluate()
    .setWidth(1200)
    .setHeight(800)
    .setTitle('Анализ раскроев');
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Анализ раскроев');
}

/**
 * Получение информации о существующих ТК для раскроев
 */
function getCuttingTKs(targetProduct, orderNumber) {
  var cuttingTKs = {};
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  
  // Открываем лист "ТК"
  var tkSheet = spreadsheet.getSheetByName("ТК");
  if (!tkSheet) {
    return cuttingTKs;
  }
  
  // Получаем все данные из листа ТК
  var tkData = tkSheet.getDataRange().getValues();
  
  // Проходим по всем строкам, начиная с первой после заголовка
  for (var i = 1; i < tkData.length; i++) {
    var row = tkData[i];
    // Проверяем, что строка содержит данные и относится к нужному изделию и заказу
    if (row.length >= 6 && row[1] == targetProduct && row[2] && row[4] == orderNumber) {
      var tkNumber = row[0];
      var cuttingNumber = row[2].toString().trim();
      // Если это раскрой (не узел), добавляем в результат
      if (!isCuttingPart(cuttingNumber)) {
        cuttingTKs[cuttingNumber] = tkNumber;
      }
    }
  }
  
  return cuttingTKs;
}

/**
 * Получение информации о существующих ТК для сборок (узлов)
 */
function getAssemblyTKs(targetProduct, orderNumber) {
  var assemblyTKs = {};
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var tkSheet = spreadsheet.getSheetByName("ТК");
  if (!tkSheet) {
    return assemblyTKs;
  }
  var tkData = tkSheet.getDataRange().getValues();
  for (var i = 1; i < tkData.length; i++) {
    var row = tkData[i];
    // Проверяем, что строка содержит данные и относится к нужному изделию и заказу
    if (row.length >= 6 && row[1] == targetProduct && row[2] && row[4] == orderNumber) {
      var tkNumber = row[0];
      var nodeCode = row[2].toString().trim();
      // Если это сборка (узел), а не раскрой
      if (!isCuttingPart(nodeCode)) {
        assemblyTKs[nodeCode] = tkNumber;
      }
    }
  }
  return assemblyTKs;
}

/**
 * Вспомогательная функция для проверки, является ли объект пустым
 */
function isEmptyObject(obj) {
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      return false;
    }
  }
  return true;
}

/**
 * Создание технологических карт в листе "ТК"
 */
function createTechCards() {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    // Получаем текущие значения из контекста
    var sheet = SpreadsheetApp.getActiveSheet();
    var rowIndex = sheet.getActiveCell().getRow();
    var targetProduct = sheet.getActiveCell().getValue().toString().trim();
    var orderNumber = sheet.getRange(rowIndex, 1).getValue().toString().trim();
    
    // Получаем количество из столбца E
    var quantity = 1; // Значение по умолчанию
    try {
      var quantityValue = sheet.getRange(rowIndex, 5).getValue();
      
      // Преобразуем значение в число
      if (typeof quantityValue === 'number') {
        quantity = quantityValue;
      } else if (typeof quantityValue === 'string') {
        // Удаляем все нечисловые символы, кроме точки и запятой
        quantityValue = quantityValue.replace(/[^\d.,]/g, '').replace(',', '.');
        if (quantityValue !== '') {
          var parsedValue = parseFloat(quantityValue);
          if (!isNaN(parsedValue) && parsedValue > 0) {
            quantity = parsedValue;
          }
        }
      }
      
      // Проверяем корректность значения
      if (isNaN(quantity) || quantity <= 0) {
        quantity = 1;
      }
    } catch (e) {
      Logger.log("Ошибка при получении количества: " + e.toString());
      quantity = 1;
    }
    
    // Получаем значения из листа Схема
    var schemaData = getSheetData(spreadsheet, "Схема");
    
    // Получаем уникальные значения технологических карт
    var techCards = getUniqueValuesFromSchema(schemaData, targetProduct, quantity, orderNumber);
    
    // Проверяем, есть ли технологические карты для создания
    if (!techCards || techCards.length === 0) {
      return { success: false, message: "Нет данных для создания технологических карт" };
    }
    
    // Фильтруем только те техкарты, которые еще не созданы
    var techCardsToCreate = techCards.filter(function(card) {
      return !card.tkNumber;
    });
    
    // Если все технологические карты уже созданы
    if (techCardsToCreate.length === 0) {
      return { 
        success: true, 
        count: 0, 
        allCreated: true, 
        message: "Все технологические карты уже созданы"
      };
    }
    
    // Открываем лист "ТК"
    var tkSheet = spreadsheet.getSheetByName("ТК");
    if (!tkSheet) {
      return { success: false, message: "Лист 'ТК' не найден" };
    }
    
    // Получаем порядковый номер ТК из ячейки F1
    var tkNumber = tkSheet.getRange("F1").getValue();
    if (!tkNumber || isNaN(tkNumber)) {
      tkNumber = 1; // Если номер не найден, начинаем с 1
    } else {
      tkNumber = parseInt(tkNumber);
    }
    
    // Находим первую пустую строку в листе ТК
    var tkData = tkSheet.getDataRange().getValues();
    var startRow = -1;
    
    for (var i = 1; i < tkData.length; i++) { // Пропускаем заголовок
      if (!tkData[i][0] && !tkData[i][1] && !tkData[i][2]) {
        startRow = i + 1; // +1 потому что индексы начинаются с 0, а строки листа с 1
        break;
      }
    }
    
    if (startRow === -1) {
      // Если пустая строка не найдена, добавляем в конец листа
      startRow = tkData.length + 1;
    }
    
    // Создаем объект для хранения номеров ТК по каждому артикулу
    var createdTKs = {};
    
    // Создаем технологические карты
    for (var i = 0; i < techCardsToCreate.length; i++) {
      var card = techCardsToCreate[i];
      var currentTkNumber = tkNumber + i;
      
      // Сохраняем номер ТК для этого артикула
      createdTKs[card.code] = currentTkNumber;
      
      // Заполняем данные для текущей карты
      tkSheet.getRange(startRow + i, 1).setValue(currentTkNumber); // Столбец A: порядковый номер ТК
      
      // Столбец B: готовое изделие (сохраняем как текст, чтобы сохранить ведущие нули)
      var productCell = tkSheet.getRange(startRow + i, 2);
      productCell.setValue(targetProduct);
      productCell.setNumberFormat("@"); // Устанавливаем текстовый формат
      
      // Столбец C: узел (также сохраняем как текст, чтобы сохранить ведущие нули)
      var nodeCell = tkSheet.getRange(startRow + i, 3);
      nodeCell.setValue(card.code);
      nodeCell.setNumberFormat("@"); // Устанавливаем текстовый формат
      
      tkSheet.getRange(startRow + i, 4).setValue(card.quantity); // Столбец D: количество
      tkSheet.getRange(startRow + i, 5).setValue(orderNumber); // Столбец E: номер заказа
      tkSheet.getRange(startRow + i, 6).setValue("Новый"); // Столбец F: статус
      tkSheet.getRange(startRow + i, 10).setValue("цех"); // Столбец J: тип ТК
    }
    
    // Обновляем порядковый номер ТК в ячейке F1
    tkSheet.getRange("F1").setValue(tkNumber + techCardsToCreate.length);
    
    return { 
      success: true, 
      count: techCardsToCreate.length,
      createdTKs: createdTKs,
      // Добавляем информацию о том, что все ТК созданы (после этой операции)
      allCreated: techCardsToCreate.length === techCards.length
    };
    
  } catch (error) {
    Logger.log("Ошибка при создании ТК: " + error.toString());
    return { success: false, message: error.toString() };
  }
}

/**
 * Создание технологических карт для раскроев в листе "ТК"
 */
function createCuttingCards(cuttingsData) {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    // Получаем текущие значения из контекста
    var sheet = SpreadsheetApp.getActiveSheet();
    var rowIndex = sheet.getActiveCell().getRow();
    var targetProduct = sheet.getActiveCell().getValue().toString().trim();
    var orderNumber = sheet.getRange(rowIndex, 1).getValue().toString().trim();
    
    // Получаем количество из столбца E
    var quantity = 1; // Значение по умолчанию
    try {
      var quantityValue = sheet.getRange(rowIndex, 5).getValue();
      
      // Преобразуем значение в число
      if (typeof quantityValue === 'number') {
        quantity = quantityValue;
      } else if (typeof quantityValue === 'string') {
        // Удаляем все нечисловые символы, кроме точки и запятой
        quantityValue = quantityValue.replace(/[^\d.,]/g, '').replace(',', '.');
        if (quantityValue !== '') {
          var parsedValue = parseFloat(quantityValue);
          if (!isNaN(parsedValue) && parsedValue > 0) {
            quantity = parsedValue;
          }
        }
      }
      
      // Проверяем корректность значения
      if (isNaN(quantity) || quantity <= 0) {
        quantity = 1;
      }
    } catch (e) {
      Logger.log("Ошибка при получении количества: " + e.toString());
      quantity = 1;
    }
    
    // Проверяем, есть ли раскрои для создания
    if (!cuttingsData || cuttingsData.length === 0) {
      return { success: false, message: "Нет данных для создания технологических карт раскроев" };
    }
    
    // Открываем лист "ТК"
    var tkSheet = spreadsheet.getSheetByName("ТК");
    if (!tkSheet) {
      return { success: false, message: "Лист 'ТК' не найден" };
    }
    
    // Получаем порядковый номер ТК из ячейки F1
    var tkNumber = tkSheet.getRange("F1").getValue();
    if (!tkNumber || isNaN(tkNumber)) {
      tkNumber = 1; // Если номер не найден, начинаем с 1
    } else {
      tkNumber = parseInt(tkNumber);
    }
    
    // Находим первую пустую строку в листе ТК
    var tkData = tkSheet.getDataRange().getValues();
    var startRow = -1;
    
    for (var i = 1; i < tkData.length; i++) { // Пропускаем заголовок
      if (!tkData[i][0] && !tkData[i][1] && !tkData[i][2]) {
        startRow = i + 1; // +1 потому что индексы начинаются с 0, а строки листа с 1
        break;
      }
    }
    
    if (startRow === -1) {
      // Если пустая строка не найдена, добавляем в конец листа
      startRow = tkData.length + 1;
    }
    
    // Создаем объект для хранения информации о созданных ТК
    var createdCuttingTKs = {};
    
    // Создаем техкарты для раскроев
    for (var i = 0; i < cuttingsData.length; i++) {
      var cuttingInfo = cuttingsData[i];
      var currentTkNumber = tkNumber + i;
      
      // Сохраняем номер ТК для этого раскроя
      createdCuttingTKs[cuttingInfo.cutting] = currentTkNumber;
      
      // Используем оригинальное количество раскроев без умножения на quantity
      var cuttingQuantity = cuttingInfo.quantity;
      
      // Заполняем данные для текущей карты
      tkSheet.getRange(startRow + i, 1).setValue(currentTkNumber); // Столбец A: порядковый номер ТК
      
      // Столбец B: готовое изделие (сохраняем как текст, чтобы сохранить ведущие нули)
      var productCell = tkSheet.getRange(startRow + i, 2);
      productCell.setValue(targetProduct);
      productCell.setNumberFormat("@"); // Устанавливаем текстовый формат
      
      // Столбец C: номер раскроя (также сохраняем как текст, чтобы сохранить ведущие нули)
      var cuttingCell = tkSheet.getRange(startRow + i, 3);
      cuttingCell.setValue(cuttingInfo.cutting);
      cuttingCell.setNumberFormat("@"); // Устанавливаем текстовый формат
      
      tkSheet.getRange(startRow + i, 4).setValue(cuttingQuantity); // Столбец D: количество раскроев
      tkSheet.getRange(startRow + i, 5).setValue(orderNumber); // Столбец E: номер заказа
      tkSheet.getRange(startRow + i, 6).setValue("Новый"); // Столбец F: статус
      tkSheet.getRange(startRow + i, 10).setValue("раскрой"); // Столбец J: тип ТК
    }
    
    // Обновляем порядковый номер ТК в ячейке F1
    tkSheet.getRange("F1").setValue(tkNumber + cuttingsData.length);
    
    // Проверяем, все ли раскрои созданы
    var allCreated = true;
    
    // Получаем все существующие ТК для раскроев
    var existingCuttingTKs = getCuttingTKs(targetProduct, orderNumber);
    
    // Проверяем, все ли раскрои имеют ТК
    for (var i = 0; i < cuttingsData.length; i++) {
      var cuttingNumber = cuttingsData[i].cutting;
      if (!existingCuttingTKs[cuttingNumber] && !createdCuttingTKs[cuttingNumber]) {
        allCreated = false;
        break;
      }
    }
    
    return { 
      success: true, 
      count: cuttingsData.length,
      createdCuttingTKs: createdCuttingTKs,
      allCreated: allCreated
    };
    
  } catch (error) {
    Logger.log("Ошибка при создании ТК раскроев: " + error.toString());
    return { success: false, message: error.toString() };
  }
}

/**
 * Получить фото изделия по артикулу в виде base64-строки (для вставки в HTML)
 * @param {string} productCode
 * @return {string|null} base64-строка или null
 */
function getProductPhotoBase64(productCode) {
  try {
    // Приводим артикул к строке, убираем пробелы и незначащие символы
    var cleanCode = (productCode || '').toString().trim();
    Logger.log('Ищу фото для артикула: ' + cleanCode);
    // ID папки с фотографиями
    var FOLDER_ID = '1qR_h4ZLVq51udz0r5ahA1rQ2V61oK-zu';
    var THUMBNAIL_FOLDER_ID = '1Q_QgdAkqP_p8WeZnWiDw1wnw9bHtkS0E';
    var folder = DriveApp.getFolderById(FOLDER_ID);
    var thumbFolder = DriveApp.getFolderById(THUMBNAIL_FOLDER_ID);
    
    // Проверяем миниатюру JPG
    var jpgMiniName = cleanCode + '-mini.jpg';
    var fileIterator = thumbFolder.getFilesByName(jpgMiniName);
    if (fileIterator.hasNext()) {
      var file = fileIterator.next();
      Logger.log('Нашёл миниатюру JPG: ' + file.getName());
      var blob = file.getBlob();
      var base64Data = Utilities.base64Encode(blob.getBytes());
      return 'data:' + blob.getContentType() + ';base64,' + base64Data;
    }
    // Проверяем миниатюру PNG
    var pngMiniName = cleanCode + '-mini.png';
    fileIterator = thumbFolder.getFilesByName(pngMiniName);
    if (fileIterator.hasNext()) {
      var file = fileIterator.next();
      Logger.log('Нашёл миниатюру PNG: ' + file.getName());
      var blob = file.getBlob();
      var base64Data = Utilities.base64Encode(blob.getBytes());
      return 'data:' + blob.getContentType() + ';base64,' + base64Data;
    }
    // Оригинал JPG
    fileIterator = folder.getFilesByName(cleanCode + '.jpg');
    if (fileIterator.hasNext()) {
      var file = fileIterator.next();
      Logger.log('Нашёл оригинал JPG: ' + file.getName());
      var blob = file.getBlob();
      var base64Data = Utilities.base64Encode(blob.getBytes());
      return 'data:' + blob.getContentType() + ';base64,' + base64Data;
    }
    // Оригинал PNG
    fileIterator = folder.getFilesByName(cleanCode + '.png');
    if (fileIterator.hasNext()) {
      var file = fileIterator.next();
      Logger.log('Нашёл оригинал PNG: ' + file.getName());
      var blob = file.getBlob();
      var base64Data = Utilities.base64Encode(blob.getBytes());
      return 'data:' + blob.getContentType() + ';base64,' + base64Data;
    }
    Logger.log('Фото не найдено для артикула: ' + cleanCode);
    // Не найдено
    return null;
  } catch (e) {
    Logger.log('Ошибка при поиске фото по артикулу: ' + e);
    return null;
  }
}