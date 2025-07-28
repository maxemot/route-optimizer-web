function generateBarcodePDF() {
  const SHEET_ID = "1eVrO8Bkq90YF2muG5bVNttzfO15i5T-2WRWsCYiqLL4";
  const SOURCE_SHEET_NAME = "Доставка";
  
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SOURCE_SHEET_NAME);
  
  // Получаем баркоды и артикулы из столбцов B и C (начиная с 4-й строки)
  const lastRow = sheet.getLastRow();
  const barcodes = sheet.getRange("C4:C" + lastRow).getValues().flat();
  const articles = sheet.getRange("B4:B" + lastRow).getValues().flat();
  
  // Создаем массив объектов с баркодами и артикулами
  const items = barcodes.map((barcode, index) => ({
    barcode: barcode,
    article: articles[index]
  })).filter(item => item.barcode !== "" && item.barcode != null);
  
  if (items.length === 0) {
    Logger.log("❌ Баркоды не найдены");
    return;
  }
  
  // Сортируем элементы по артикулам в алфавитном порядке
  items.sort(function(a, b) {
    const articleA = String(a.article || "");
    const articleB = String(b.article || "");
    
    if (articleA < articleB) return -1;
    if (articleA > articleB) return 1;
    return 0;
  });
  
  Logger.log(`Всего найдено баркодов: ${items.length}`);
  Logger.log("=== Начало генерации страниц ===");
  
  // Создаем HTML для PDF
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @page {
          size: 400px 300px;
          margin: 0;
          padding: 0;
        }
        body {
          margin: 0;
          padding: 0;
        }
        .barcode-page {
          width: 400px;
          height: 300px;
          margin: 0;
          padding: 0;
          page-break-after: always;
          page-break-inside: avoid;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          align-items: center;
          text-align: center;
        }
        .barcode-image {
          width: 360px;
          height: 160px;
          margin: 20px 0;
        }
        .barcode-number {
          margin: 5px 0;
          font-family: Arial, sans-serif;
          font-size: 24px;
        }
        .article-number {
          margin: 5px 0;
          font-family: Arial, sans-serif;
          font-size: 20px;
          font-weight: bold;
          color: #000;
        }
      </style>
    </head>
    <body style="width: 400px;">
  `;
  
  // Добавляем страницу для каждого баркода
  items.forEach((item, index) => {
    if (!item.barcode) {
      Logger.log(`[Пропущено] Страница ${index + 1} - пустой баркод`);
      return;
    }
    
    const cleanBarcode = String(item.barcode).trim();
    const article = String(item.article || '').trim();
    
    Logger.log(`[Создано] Страница ${index + 1} - Баркод: ${cleanBarcode}, Артикул: ${article}`);
    
    // Получаем изображение штрих-кода и конвертируем в base64
    const barcodeUrl = `https://quickchart.io/barcode?type=code128&text=${cleanBarcode}&width=360&height=160&margin=0`;
    const response = UrlFetchApp.fetch(barcodeUrl);
    const imageBlob = response.getBlob();
    const base64Image = Utilities.base64Encode(imageBlob.getBytes());
    
    html += `
      <div class="barcode-page">
        <img class="barcode-image" src="data:image/png;base64,${base64Image}" alt="Barcode ${cleanBarcode}">
        <div class="barcode-number">${cleanBarcode}</div>
        <div class="article-number">${article}</div>
      </div>
    `;
  });
  
  html += '</body></html>';
  
  // Создаем PDF
  const blob = Utilities.newBlob(html, 'text/html', 'barcodes.html');
  const pdf = blob.getAs('application/pdf');
  
  // Создаем файл в Google Drive
  DriveApp.createFile(pdf).setName('barcodes.pdf');
  
  Logger.log("=== Завершение генерации страниц ===");
  Logger.log(`✅ PDF создан с ${items.length} страницами`);
}

// Функция для обработки скачивания
function doGet(e) {
  if (e.parameter.download) {
    return ContentService.createTextOutput(pdf.getBytes())
      .setMimeType(ContentService.MimeType.PDF)
      .setDownloadAsFile('barcodes.pdf');
  }
}
