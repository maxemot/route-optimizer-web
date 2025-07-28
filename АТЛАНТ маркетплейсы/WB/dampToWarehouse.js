function copyToWarehouse() {
    const SHEET_ID = "1eVrO8Bkq90YF2muG5bVNttzfO15i5T-2WRWsCYiqLL4";
    const SOURCE_SHEET_NAME = "Доставка";
    const TARGET_SHEET_NAME = "Склад";
    
    try {
      const ss = SpreadsheetApp.openById(SHEET_ID);
      const sourceSheet = ss.getSheetByName(SOURCE_SHEET_NAME);
      const targetSheet = ss.getSheetByName(TARGET_SHEET_NAME);
      
      if (!sourceSheet || !targetSheet) {
        Logger.log("❌ Не найдены нужные листы");
        return;
      }
      
      // Получаем дату обновления из листа Доставка
      const updateDate = sourceSheet.getRange("B1").getValue();
      
      // Получаем все данные из листа Доставка (начиная с 4-й строки)
      const sourceData = sourceSheet.getRange(4, 1, sourceSheet.getLastRow() - 3, sourceSheet.getLastColumn()).getValues();
      
      // Группируем данные по артикулу и считаем количество
      const groupedData = {};
      sourceData.forEach(row => {
        if (row[1]) { // Проверяем, что артикул не пустой
          const article = row[1]; // Артикул WB
          if (!groupedData[article]) {
            groupedData[article] = 1;
          } else {
            groupedData[article]++;
          }
        }
      });
      
      // Преобразуем сгруппированные данные в массив для вставки
      const dataToInsert = Object.entries(groupedData).map(([article, count]) => [
        "Списание",           // 1 столбец
        "отгрузка на wb",    // 2 столбец
        article,             // 3 столбец - артикул
        count,              // 4 столбец - количество
        updateDate          // 5 столбец - дата
      ]);
      
      // Находим первую пустую строку в листе Склад, начиная с 3-й строки
      let startRow = 3;
      const targetData = targetSheet.getDataRange().getValues();
      
      // Проверяем каждую строку, начиная с третьей
      for (let i = 2; i < targetData.length; i++) { // i = 2 соответствует 3-й строке
        // Проверяем первые 6 столбцов (A-F)
        const rowIsEmpty = targetData[i].slice(0, 6).every(cell => 
          cell === '' || cell === null || cell === undefined
        );
        
        if (rowIsEmpty) {
          startRow = i + 1; // +1 потому что индексы начинаются с 0
          break;
        }
      }
      
      // Вставляем данные
      if (dataToInsert.length > 0) {
        targetSheet.getRange(startRow, 1, dataToInsert.length, 5).setValues(dataToInsert);
        
        Logger.log(`✅ Данные успешно скопированы в лист "${TARGET_SHEET_NAME}"`);
        Logger.log(`📊 Добавлено строк: ${dataToInsert.length}`);
        Logger.log(`📍 Начальная строка: ${startRow}`);
      } else {
        Logger.log("❌ Нет данных для копирования");
      }
      
    } catch (e) {
      Logger.log(`❌ Ошибка при копировании данных: ${e.toString()}`);
    }
  }