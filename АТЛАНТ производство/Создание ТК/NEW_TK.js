function getUniqueNodes() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Получаем активный лист и ячейку
    const activeSheet = ss.getActiveSheet();
    const activeCell = activeSheet.getActiveCell();
    
    // Проверяем, что мы на правильной вкладке
    if (activeSheet.getName() !== "Заказы") {
      Logger.log("❌ Ошибка: Пожалуйста, выберите ячейку на вкладке 'Заказы'");
      SpreadsheetApp.getUi().alert("Пожалуйста, выберите ячейку на вкладке 'Заказы'");
      return;
    }
    
    // В начале функции, после получения активной ячейки добавляем:
    const orderNumber = activeSheet.getRange(activeCell.getRow(), 1).getValue();
    
    // Функция для правильного преобразования значения в строку
    function normalizeValue(value) {
      if (value instanceof Date) {
        return Utilities.formatDate(value, "GMT", "dd.MM.yy")
          .replace(/^0/, '')
          .replace(/\.0/, '.')
          .replace(/\.[0-9]{2}$/, '.01');
      }
      return value.toString().trim();
    }
    
    // Получаем значение из активной ячейки
    const targetProduct = normalizeValue(activeCell.getValue());
    
    if (!targetProduct) {
      Logger.log("❌ Ошибка: Выбранная ячейка пуста");
      SpreadsheetApp.getUi().alert("Выбранная ячейка пуста");
      return;
    }
    
    try {
      // Получаем данные со вкладки "Схема"
      const schemaSheet = ss.getSheetByName("Схема");
      const rawData = schemaSheet.getDataRange().getValues();
      
      // Пропускаем заголовок и создаем массив связей с количеством
      const schemaData = rawData.slice(1).map(row => ({
        source: normalizeValue(row[0]),      // берем деталь
        target: normalizeValue(row[2]),      // артикул получившейся детали
        quantity: row[3]                     // количество
      }));
      
      function findAllSources(target, visited = null) {
        if (visited === null) visited = new Set();
        
        if (visited.has(target)) {
          return new Set();
        }
        
        visited.add(target);
        const sources = new Set();
        
        const directSources = schemaData
          .filter(row => row.target === target)
          .map(row => row.source);
        
        for (const source of directSources) {
          sources.add(source);
          const subSources = findAllSources(source, visited);
          subSources.forEach(s => sources.add(s));
        }
        
        return sources;
      }
      
      // Находим все связанные вершины
      const allRelatedNodes = findAllSources(targetProduct);
      allRelatedNodes.add(targetProduct);
      
      // Собираем все вершины и рёбра
      const allNodes = new Set();
      const incomingEdges = new Map(); // target -> Set(sources)
      
      schemaData.forEach(row => {
        if (allRelatedNodes.has(row.source) || allRelatedNodes.has(row.target)) {
          allNodes.add(row.source);
          allNodes.add(row.target);
          
          if (!incomingEdges.has(row.target)) {
            incomingEdges.set(row.target, new Set());
          }
          incomingEdges.get(row.target).add(row.source);
        }
      });
      
      // Находим нестартовые вершины
      const nonStartNodes = Array.from(allNodes)
        .filter(node => incomingEdges.has(node))
        .sort();
      
      // Получаем лист ТК
      const tkSheet = ss.getSheetByName("ТК");
      
      // Получаем все данные из первых 4 столбцов
      const tkRange = tkSheet.getRange("A1:D" + tkSheet.getLastRow());
      const tkValues = tkRange.getValues();
      
      // Функция для проверки, является ли значение пустым
      function isEmpty(value) {
        return value === null || value === undefined || 
               String(value).trim() === '' || value === 0;
      }
      
      // Ищем первую строку, где все 4 ячейки пустые
      let firstEmptyRow = 1;
      for (let i = 0; i < tkValues.length; i++) {
        const row = tkValues[i];
        if (isEmpty(row[0]) && isEmpty(row[1]) && 
            isEmpty(row[2]) && isEmpty(row[3])) {
          firstEmptyRow = i + 1;
          break;
        }
        firstEmptyRow = i + 2; // Если пустая строка не найдена, начнем с следующей после последней
      }
      
      Logger.log(`Найдена первая пустая строка: ${firstEmptyRow}`);
      
      // Получаем и обновляем порядковый номер из F1
      let sequenceNumber = tkSheet.getRange("F1").getValue() || 1;
      
      // Записываем каждую нестартовую вершину
      nonStartNodes.forEach(node => {
        // Находим количество из схемы
        const edge = schemaData.find(row => {
          Logger.log(`Проверяем связь: ${row.source} -> ${row.target} (${row.quantity})`);
          // Для узла ищем строку, где он является target
          if (row.target === node) {
            Logger.log(`Найдена связь для узла ${node}: ${row.source} -> ${node} (${row.quantity})`);
            return true;
          }
          return false;
        });
        
        const quantity = edge ? edge.quantity : "";
        
        // Получаем диапазон для записи (теперь 5 столбцов вместо 4)
        const range = tkSheet.getRange(firstEmptyRow, 1, 1, 5);
        
        // Устанавливаем текстовый формат для второго и третьего столбца
        range.offset(0, 1, 1, 2).setNumberFormat("@");
        
        // Устанавливаем цвет фона
        range.setBackground("#f8f0c7");
        
        // Записываем строку
        range.setValues([[
          sequenceNumber,
          targetProduct,
          node,
          quantity,
          orderNumber
        ]]);
        
        Logger.log(`Для узла ${node} найдено количество: ${quantity}`);
        
        firstEmptyRow++;
        sequenceNumber++;
      });
      
      // Обновляем порядковый номер в F1
      tkSheet.getRange("F1").setValue(sequenceNumber);
      
      // Выводим результат в лог
      Logger.log(`Записано ${nonStartNodes.length} вершин в ТК начиная со строки ${firstEmptyRow}`);
      
    } catch (e) {
      Logger.log("❌ Ошибка: " + e.toString());
      SpreadsheetApp.getUi().alert("Произошла ошибка: " + e.toString());
    }
  }