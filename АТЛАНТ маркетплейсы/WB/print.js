function printLabels() {
  try {
    // Получаем активную таблицу и лист
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getActiveSheet();
    
    // Получаем позицию курсора
    const activeRange = sheet.getActiveRange();
    const currentRow = activeRange.getRow();
    
    Logger.log(`Активная строка: ${currentRow}`);
    
    // Получаем данные из текущей строки
    const orderNumber = sheet.getRange(currentRow, 1).getValue(); // Столбец A
    const article = sheet.getRange(currentRow, 3).getValue();     // Столбец C  
    const quantity = sheet.getRange(currentRow, 5).getValue();    // Столбец E
    const productName = sheet.getRange(currentRow, 7).getValue(); // Столбец G
    const warehouseLocation = sheet.getRange(currentRow, 12).getValue(); // Столбец L - место на складе
    
    // Проверяем, что все необходимые данные заполнены
    if (!orderNumber || !article || !quantity || !productName) {
      throw new Error("Не все необходимые данные заполнены в выбранной строке");
    }
    
    Logger.log(`Заказ: ${orderNumber}, Артикул: ${article}, Количество: ${quantity}, Название: ${productName}, Место: ${warehouseLocation}`);
    
    // Создаем PDF документ
    const pdfBlob = createLabelsPDF(orderNumber, article, quantity, productName, warehouseLocation);
    
    // Создаем временный файл для получения URL
    const fileName = `Наклейки_${orderNumber}_${article}_${new Date().getTime()}.pdf`;
    const tempFile = DriveApp.createFile(pdfBlob.setName(fileName));
    
    // Делаем файл доступным для всех с ссылкой
    tempFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // Получаем URL для просмотра
    const fileUrl = `https://drive.google.com/file/d/${tempFile.getId()}/view`;
    
    // Автоматически открываем PDF в новой вкладке
    const htmlOutput = HtmlService.createHtmlOutput(`
      <script>
        window.open('${fileUrl}', '_blank');
        google.script.host.close();
      </script>
    `).setWidth(100).setHeight(50);
    
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Открытие PDF...');
    
    // Удаляем временный файл через 60 секунд
    Utilities.sleep(60000);
    DriveApp.getFileById(tempFile.getId()).setTrashed(true);
    
    Logger.log(`PDF файл создан и открыт: ${fileName}`);
    
    return tempFile.getId();
    
  } catch (error) {
    Logger.log(`Ошибка: ${error.message}`);
    SpreadsheetApp.getUi().alert('Ошибка', error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    throw error;
  }
}

function createLabelsPDF(orderNumber, article, quantity, productName, warehouseLocation) {
  // Создаем новый Google Документ для генерации PDF
  const doc = DocumentApp.create(`Наклейки_${orderNumber}_${article}_temp`);
  const body = doc.getBody();
  
  // Устанавливаем параметры страницы для А4 с минимальными отступами
  body.setPageWidth(595.28); // А4 ширина в пунктах
  body.setPageHeight(841.89); // А4 высота в пунктах
  body.setMarginTop(10);     // Минимальные отступы
  body.setMarginBottom(10);
  body.setMarginLeft(10);
  body.setMarginRight(10);
  
  // Размеры наклейки в пунктах (А4 разделен на 3x9 = 27 наклеек)
  const labelWidth = (595.28 - 20) / 3;  // ~192 пт
  const totalMargins = 10 + 10; // Отступы сверху и снизу
  const availableHeight = 841.89 - totalMargins; // 821.89 пт
  const calculatedHeight = availableHeight / 9; // 91.32 пт на строку - расчетная высота
  const labelHeight = calculatedHeight * 0.95; // Уменьшаем на 5% = ~86.75 пт
  
  // Создаем таблицу 9x3 для наклеек
  const table = body.appendTable();
  
  let labelCount = 0;
  const maxLabels = Math.min(parseInt(quantity), 27); // Максимум 27 наклеек на лист
  
  // Заполняем таблицу наклейками
  for (let row = 0; row < 9; row++) {
    const tableRow = table.appendTableRow();
    
    for (let col = 0; col < 3; col++) {
      const cell = tableRow.appendTableCell();
      
      // Настраиваем отступы ячейки ДО создания абзацев
      cell.setPaddingTop(0);     // Убираем отступы полностью
      cell.setPaddingBottom(0);  // Убираем отступы полностью
      cell.setPaddingLeft(1);    // Минимальный отступ по бокам
      cell.setPaddingRight(1);
      cell.setVerticalAlignment(DocumentApp.VerticalAlignment.TOP); // Прижимаем к верху
      cell.setWidth(labelWidth);
      
      if (labelCount < maxLabels) {
        // Номер заказа наверху с увеличенным шрифтом
        const orderParagraph = cell.insertParagraph(0, `Заказ: ${orderNumber}`);
        orderParagraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
        orderParagraph.setSpacingBefore(-3); // Отрицательный отступ для прижатия к верху
        orderParagraph.setSpacingAfter(-3); // Еще больше уменьшаем отступ для компактности
        orderParagraph.setIndentStart(0);  // Убираем отступ слева
        orderParagraph.setIndentEnd(0);    // Убираем отступ справа
        const orderText = orderParagraph.editAsText();
        orderText.setFontFamily('Arial');
        orderText.setFontSize(14); // Увеличиваем размер с 10 до 14
        orderText.setBold(0, 5, true); // Жирным только слово "Заказ:"
        
        // Артикул крупным шрифтом по центру
        const articleParagraph = cell.appendParagraph(article);
        articleParagraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
        articleParagraph.setSpacingBefore(-3); // Еще больше убираем отступ до артикула
        articleParagraph.setSpacingAfter(1); // Минимальный отступ после
        const articleText = articleParagraph.editAsText();
        articleText.setFontFamily('Arial');
        articleText.setFontSize(30); // Оставляем размер артикула
        articleText.setBold(true);
        
        // Название товара с увеличенным шрифтом
        const nameParagraph = cell.appendParagraph(productName);
        nameParagraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
        nameParagraph.setSpacingBefore(1); // Минимальный отступ до
        nameParagraph.setSpacingAfter(-3); // Отрицательный отступ для прижатия к низу
        const nameText = nameParagraph.editAsText();
        nameText.setFontFamily('Arial');
        nameText.setFontSize(12); // Увеличиваем размер с 10 до 12
        
        // Место на складе
        const locationParagraph = cell.appendParagraph(warehouseLocation);
        locationParagraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
        locationParagraph.setSpacingBefore(1); // Минимальный отступ до
        locationParagraph.setSpacingAfter(-3); // Отрицательный отступ для прижатия к низу
        const locationText = locationParagraph.editAsText();
        locationText.setFontFamily('Arial');
        locationText.setFontSize(10); // Уменьшаем размер с 12 до 10
        
        labelCount++;
      } else {
        // Пустая наклейка
        cell.appendParagraph("");
      }
    }
    
    // Устанавливаем точную фиксированную высоту для каждой строки
    tableRow.setMinimumHeight(labelHeight);
  }
  
  // Устанавливаем границы таблицы
  table.setBorderWidth(0.5);
  table.setBorderColor('#000000');
  
  // Сохраняем документ
  doc.saveAndClose();
  
  // Конвертируем в PDF
  const docFile = DriveApp.getFileById(doc.getId());
  const pdfBlob = docFile.getBlob().setContentType('application/pdf');
  
  // Удаляем временный документ
  DriveApp.getFileById(doc.getId()).setTrashed(true);
  
  return pdfBlob;
} 