function testShowCellImage() {
  const ui = SpreadsheetApp.getUi();
  const activeCell = SpreadsheetApp.getActiveSpreadsheet().getActiveRange();
  
  try {
    // Получаем значение из ячейки
    const imageName = activeCell.getValue().toString();
    Logger.log('Ищем изображение: ' + imageName);
    
    // ID папки с фотографиями
    const FOLDER_ID = '1qR_h4ZLVq51udz0r5ahA1rQ2V61oK-zu';
    const folder = DriveApp.getFolderById(FOLDER_ID);
    
    // Ищем файл с нужным именем (проверяем оба расширения)
    let imageFile = null;
    const jpgFile = folder.getFilesByName(imageName + '.jpg');
    const pngFile = folder.getFilesByName(imageName + '.png');
    
    if (jpgFile.hasNext()) {
      imageFile = jpgFile.next();
      Logger.log('Найден JPG файл');
    } else if (pngFile.hasNext()) {
      imageFile = pngFile.next();
      Logger.log('Найден PNG файл');
    }
    
    if (!imageFile) {
      ui.alert('Изображение не найдено: ' + imageName);
      return;
    }
    
    // Получаем данные изображения и конвертируем в base64
    const blob = imageFile.getBlob();
    const base64Data = Utilities.base64Encode(blob.getBytes());
    const contentType = blob.getContentType();
    const imageData = `data:${contentType};base64,${base64Data}`;
    
    // Показываем изображение в попапе
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <base target="_top">
          <style>
            body { margin: 20px; text-align: center; }
            img { max-width: 100%; max-height: 400px; object-fit: contain; }
            .info { margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="info">Изображение: ${imageName}</div>
          <img src="${imageData}" alt="${imageName}">
        </body>
      </html>
    `;
    
    ui.showModalDialog(
      HtmlService.createHtmlOutput(html)
        .setWidth(500)
        .setHeight(600),
      'Просмотр изображения'
    );
    
  } catch (e) {
    Logger.log('Ошибка: ' + e.toString());
    ui.alert('Произошла ошибка: ' + e.toString());
  }
} 