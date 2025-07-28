// Глобальный кэш для изображений
const imageCache = {};
// Кэш для схемы данных
var schemaDataCache = null;

function showphoto() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const activeSheet = ss.getActiveSheet();
    
    // Проверяем, что мы на вкладке "ТК"
    if (activeSheet.getName() !== "ТК") {
      SpreadsheetApp.getUi().alert("Пожалуйста, выберите ячейку на вкладке 'ТК'");
      return;
    }
    
    // Сначала показываем лоадер
    const loadingHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <base target="_top">
          <style>
            body { 
              font-family: Arial; 
              text-align: center; 
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
            }
            .loader { 
              border: 16px solid #f3f3f3;
              border-top: 16px solid #3498db;
              border-radius: 50%;
              width: 120px;
              height: 120px;
              animation: spin 2s linear infinite;
              margin-bottom: 20px;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        </head>
        <body>
          <div class="loader"></div>
          <h2>Загрузка технологической карты...</h2>
        </body>
      </html>
    `;
    
    // Показываем диалог с лоадером
    const htmlOutput = HtmlService
      .createHtmlOutput(loadingHtml)
      .setWidth(1600)
      .setHeight(900);
    
    const ui = SpreadsheetApp.getUi();
    ui.showModalDialog(htmlOutput, 'Технологическая карта');
    
    try {
    // Получаем данные текущей строки
    const activeCell = activeSheet.getActiveCell();
    const currentRow = activeCell.getRow();
    const targetProduct = activeSheet.getRange(currentRow, 2).getValue(); // Готовое изделие
    const selectedNode = activeSheet.getRange(currentRow, 3).getValue(); // Выбранный узел
    const selectedNodeQuantity = activeSheet.getRange(currentRow, 4).getValue(); // Количество получаемых деталей
    
    // Получаем схему
    const schemaData = getSchemaData();
    
    // Получаем компоненты для выбранного узла
    const { components, operations } = getNodeComponents(selectedNode, schemaData);
    
    // Получаем соответствия названий и артикулов фото
    const { namesMap, photoIdsMap } = getNodeNamesAndPhotoIds();
    
    // Собираем список всех кодов, для которых нужны изображения (используем артикулы фото)
    const imageCodes = [
      photoIdsMap[targetProduct] || targetProduct, 
      photoIdsMap[selectedNode] || selectedNode
    ];
    components.forEach(comp => {
      const photoId = photoIdsMap[comp.code] || comp.code;
      imageCodes.push(photoId);
    });
    
    // Загружаем изображения синхронно
    loadImagesSync(imageCodes);
      
      // Получаем дополнительные данные
      const additionalData = getAdditionalData();
      
      // Формируем заголовок в зависимости от типа техкарты
      let popupTitle;
      if (additionalData.type === "раскрой") {
        popupTitle = `Раскрой, тк ${additionalData.tkNumber}, заказ ${additionalData.orderNumber}`;
      } else {
        popupTitle = `Цех, тк ${additionalData.tkNumber}, заказ ${additionalData.orderNumber}`;
      }
    
    // Генерируем HTML техкарты
    const techCardHtml = generatePopupHtml(
      components, 
      operations, 
      selectedNode, 
      targetProduct, 
      selectedNodeQuantity,
      photoIdsMap
    );
    
    // Показываем техкарту
    const techCardOutput = HtmlService
      .createHtmlOutput(techCardHtml)
      .setWidth(1600)
      .setHeight(900);
    
      ui.showModalDialog(techCardOutput, popupTitle);
    } catch (innerError) {
      // Логируем детальную ошибку
      Logger.log('Внутренняя ошибка: ' + innerError.stack);
      
      // Показываем пользователю более понятное сообщение об ошибке
      SpreadsheetApp.getUi().alert('Произошла ошибка при загрузке данных: ' + innerError.message);
    }
    
  } catch (e) {
    Logger.log('Ошибка: ' + e.stack);
    SpreadsheetApp.getUi().alert('Произошла ошибка: ' + e.message);
  }
}

// Синхронная загрузка изображений
function loadImagesSync(codes) {
  // Фильтруем только те коды, которые еще не в кэше
  const codesToLoad = codes.filter(code => !imageCache[code]);
  
  if (codesToLoad.length === 0) {
    return; // Все изображения уже в кэше
  }
  
  // ID папки с фотографиями
  const FOLDER_ID = '1qR_h4ZLVq51udz0r5ahA1rQ2V61oK-zu';
  const folder = DriveApp.getFolderById(FOLDER_ID);
  
  // Загружаем изображения по одному
  codesToLoad.forEach(code => {
    try {
      // Проверяем JPG
      let fileIterator = folder.getFilesByName(code + '.jpg');
      if (fileIterator.hasNext()) {
        const file = fileIterator.next();
        const blob = file.getBlob();
        const base64Data = Utilities.base64Encode(blob.getBytes());
        imageCache[code] = `data:${blob.getContentType()};base64,${base64Data}`;
        return;
      }
      
      // Проверяем PNG
      fileIterator = folder.getFilesByName(code + '.png');
      if (fileIterator.hasNext()) {
        const file = fileIterator.next();
        const blob = file.getBlob();
        const base64Data = Utilities.base64Encode(blob.getBytes());
        imageCache[code] = `data:${blob.getContentType()};base64,${base64Data}`;
        return;
      }
      
      // Если файл не найден
      imageCache[code] = null;
    } catch (e) {
      Logger.log(`Ошибка при загрузке изображения ${code}: ${e}`);
      imageCache[code] = null;
    }
  });
}

// Добавим новую функцию для получения названий узлов и артикулов фото
function getNodeNamesAndPhotoIds() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Получаем данные из вкладки "Узлы"
  const nodesSheet = ss.getSheetByName("Узлы");
  const nodesData = nodesSheet.getDataRange().getValues();
  
  // Получаем данные из вкладки "Изделия"
  const productsSheet = ss.getSheetByName("Изделия");
  const productsData = productsSheet.getDataRange().getValues();
  
  // Создаем объекты для хранения соответствий
  const namesMap = {};
  const photoIdsMap = {};
  
  // Заполняем соответствия для узлов (артикул в A, название в D, артикул фото в E)
  nodesData.forEach(row => {
    if (row[0]) { // Если артикул не пустой
      const nodeCode = row[0].toString().trim();
      namesMap[nodeCode] = row[3] ? row[3].toString().trim() : "";
      // Если артикул фото пустой или отсутствует, используем артикул узла как fallback
      const photoId = row[4] ? row[4].toString().trim() : "";
      photoIdsMap[nodeCode] = photoId || nodeCode;
    }
  });
  
  // Заполняем соответствия для изделий (артикул в A, название - конкатенация B и C)
  // Но НЕ устанавливаем автоматически photoId = productCode
  productsData.forEach(row => {
    if (row[0]) { // Если артикул не пустой
      const productCode = row[0].toString().trim();
      const name1 = row[1] ? row[1].toString().trim() : "";
      const name2 = row[2] ? row[2].toString().trim() : "";
      
      // Устанавливаем название только если его еще нет (приоритет у вкладки "Узлы")
      if (!namesMap[productCode]) {
        namesMap[productCode] = (name1 + " " + name2).trim();
      }
      
      // Устанавливаем photoId только если его еще нет (приоритет у вкладки "Узлы")
      if (!photoIdsMap[productCode]) {
        photoIdsMap[productCode] = productCode; // Fallback для изделий
      }
    }
  });
  
  return { namesMap, photoIdsMap };
}

// Обновляем старую функцию для обратной совместимости
function getNodeNames() {
  const { namesMap } = getNodeNamesAndPhotoIds();
  return namesMap;
}

// Функция для генерации HTML техкарты
function generatePopupHtml(components, operations, selectedNode, targetProduct, selectedNodeQuantity, photoIdsMap) {
  const placeholderImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2U5ZWNlZiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNnB4IiBmaWxsPSIjNmM3NTdkIj7QndC10YIg0YTQvtGC0L48L3RleHQ+PC9zdmc+';
  const additionalData = getAdditionalData();
  const namesMap = getNodeNames();
  const buttonState = getButtonState(additionalData.startTime, additionalData.endTime);
  const buttonText = buttonState === 'start' ? 'Начать' : buttonState === 'finish' ? 'Завершить' : 'Готово';
  const buttonClass = buttonState === 'done' ? 'button-disabled' : 'button-active';
  const getPhotoUrl = (code) => {
    const photoId = photoIdsMap[code] || code;
    return getImageData(photoId) || placeholderImage;
  };
  // Получаем количество для готового изделия из заказа
  const productQuantity = getProductQuantity(additionalData.orderNumber, targetProduct);
  
  // Создаем копию компонентов для сохранения оригинальных значений
  const originalComponents = JSON.parse(JSON.stringify(components));
  
  // Определяем заголовок блока с компонентами в зависимости от типа техкарты
  let componentsSectionTitle;
  if (additionalData.type === "раскрой") {
    componentsSectionTitle = "Детали получаемые из раскроя";
  } else {
    // Для типа "цех" добавляем кликабельный тег
    componentsSectionTitle = "Берем для получения <span id='quantityToggleTag' class='quantity-tag' data-mode='single' data-total='" + selectedNodeQuantity + "'>1шт</span>";
  }
  
  // Определяем заголовок блока "Получаем" в зависимости от типа техкарты
  const receiveTitle = additionalData.type === "раскрой" ? "Раскрой" : "Получаем";

  const componentsHtml = components.map(comp => `
    <div class="component">
      <div class="img-container">
      <img src="${getPhotoUrl(comp.code)}" alt="${comp.code}">
      </div>
      <div class="component-info">
        <div class="code-with-quantity">
          <span class="code-part">${comp.code}</span> 
          <span class="quantity-part" data-original-qty="${comp.quantity}">(${String(comp.quantity).replace('.', ',')} шт)</span>
        </div>
        <div class="name-part${!namesMap[comp.code] ? ' no-name' : ''}">${namesMap[comp.code] || "нет названия"}</div>
      </div>
    </div>
  `).join('');

  // Проверяем, что operations существует и является массивом
  const operationsArray = Array.isArray(operations) ? operations : [];
  const operationsHtml = operationsArray.map(op => `
    <div class="operation">⚙️ ${op}</div>
  `).join('');
  const workerName = additionalData.workerName;
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <script>
          window.onload = function() {
            google.script.run
              .withSuccessHandler(function() {
                // ...
              })
              .resizePopup();
            document.getElementById('actionButton').addEventListener('click', function() {
              const buttonState = this.getAttribute('data-state');
              if (buttonState !== 'done') {
                this.disabled = true;
                this.textContent = 'Обработка...';
                google.script.run
                  .withSuccessHandler(function(result) {
                    if (result.success) {
                      if (buttonState === 'start') {
                        document.querySelector('#startTime').textContent = result.formattedDate;
                        document.getElementById('actionButton').textContent = 'Завершить';
                        document.getElementById('actionButton').setAttribute('data-state', 'finish');
                        document.getElementById('actionButton').disabled = false;
                      } else if (buttonState === 'finish') {
                        document.querySelector('#endTime').textContent = result.formattedDate;
                        document.getElementById('actionButton').textContent = 'Готово';
                        document.getElementById('actionButton').setAttribute('data-state', 'done');
                        document.getElementById('actionButton').className = 'button-disabled';
                      }
                    } else {
                      alert('Произошла ошибка: ' + result.error);
                      document.getElementById('actionButton').disabled = false;
                      document.getElementById('actionButton').textContent = buttonState === 'start' ? 'Начать' : 'Завершить';
                    }
                  })
                  .updateTaskStatus(buttonState, "${workerName}");
              }
            });
            document.getElementById('printButton').addEventListener('click', function() {
              this.disabled = true;
              this.innerHTML = '<span style="font-size:12px;">⏳</span>';
              google.script.run
                .withSuccessHandler(function(pdfUrl) {
                  if (pdfUrl) {
                    window.open(pdfUrl, '_blank');
                  } else {
                    alert('Ошибка при создании PDF');
                  }
                  document.getElementById('printButton').disabled = false;
                  document.getElementById('printButton').innerHTML = '<span style="font-size:16px;">🖨️</span>';
                })
                .generatePdf();
            });
            
            // Добавляем обработчик для переключения режима отображения количества
            const quantityToggleTag = document.getElementById('quantityToggleTag');
            if (quantityToggleTag) {
              quantityToggleTag.addEventListener('click', function() {
                const currentMode = this.getAttribute('data-mode');
                const totalQuantity = parseInt(this.getAttribute('data-total'), 10);
                
                if (currentMode === 'single') {
                  // Переключаемся на режим "Xшт"
                  this.setAttribute('data-mode', 'total');
                  this.textContent = totalQuantity + 'шт';
                  
                  // Обновляем количества в компонентах
                  document.querySelectorAll('.quantity-part').forEach(element => {
                    const originalQty = parseFloat(element.getAttribute('data-original-qty'));
                    const newQty = (originalQty * totalQuantity).toFixed(2).replace('.00', '').replace('.', ',');
                    element.textContent = '(' + newQty + ' шт)';
                  });
                } else {
                  // Переключаемся на режим "1шт"
                  this.setAttribute('data-mode', 'single');
                  this.textContent = '1шт';
                  
                  // Возвращаем исходные количества
                  document.querySelectorAll('.quantity-part').forEach(element => {
                    const originalQty = parseFloat(element.getAttribute('data-original-qty'));
                    const formattedQty = originalQty.toFixed(2).replace('.00', '').replace('.', ',');
                    element.textContent = '(' + formattedQty + ' шт)';
                  });
                }
              });
            }
          }
        </script>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 0; 
          }
          .popup-header {
            height: 0;
            position: relative;
          }
          .action-block {
            position: absolute;
            top: 32px;
            right: 32px;
            z-index: 10;
            display: flex;
            align-items: center;
            gap: 12px;
            background: #f7f7f7;
            border-radius: 10px;
            padding: 10px 18px;
            box-shadow: 0 1px 4px #0001;
          }
          .action-info {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            margin-right: 10px;
          }
          .action-label {
            font-size: 13px;
            color: #888;
            margin-bottom: 2px;
          }
          .action-value {
            font-size: 15px;
            font-weight: bold; 
            color: #222;
          }
          .button-active, .button-disabled {
            padding: 8px 18px;
            border: none;
            border-radius: 5px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            text-align: center;
            background-color: #c8e06c;
            margin-right: 0;
            width: 160px;
          }
          .button-active:hover {
            background-color: #a9c046;
          }
          .button-disabled {
            background-color: #cccccc;
            color: #666666;
            cursor: not-allowed;
          }
          .print-button {
            background: none;
            border: none;
            margin-left: 6px;
            font-size: 16px;
            cursor: pointer;
            color: #888;
            padding: 0 4px;
          }
          .print-button:disabled {
            color: #ccc;
            cursor: not-allowed;
          }
          .container {
            display: grid;
            grid-template-columns: 80% 20%;
            gap: 24px;
            padding: 0 32px 32px 32px;
            margin-top: 0;
          }
          .components-section {
            background: none;
            border: none;
            box-shadow: none;
            padding: 0;
          }
          .section-title {
            font-size: 22px;
            font-weight: bold;
            margin: 18px 0 10px 0;
            text-align: left;
          }
          .quantity-tag {
            display: inline-block;
            background-color: #e6efff;
            color: #1e3e7b;
            border-radius: 5px;
            font-weight: bold;
            padding: 3px 8px;
            margin-left: 6px;
            cursor: pointer;
            transition: background-color 0.2s;
          }
          .quantity-tag:hover {
            background-color: #d5e5ff;
          }
          .components-grid { 
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 16px;
            margin-top: 10px;
          }
          .component { 
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            background: #fff;
            border-radius: 10px;
            box-shadow: 0 1px 4px #0001;
            padding: 0;
          }
          .img-container {
            width: 100%;
            aspect-ratio: 1/1; /* Создает квадрат */
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            border-radius: 10px 10px 0 0;
          }
          .component img { 
            width: 100%;
            height: auto;
            object-fit: contain; 
          }
          .component-info {
            width: 100%;
            padding: 2px 4px;
          }
          .code-with-quantity {
            font-size: 15px;
            margin-top: 5px;
          }
          .code-part {
            font-weight: bold;
            color: #000;
          }
          .quantity-part {
            font-weight: normal;
            color: #666;
          }
          .name-part {
            font-size: 13px;
            color: #444;
          }
          .no-name {
            color: #888888;
          }
          .right-block {
            display: flex;
            flex-direction: column;
            width: 100%;
            margin-top: 24px;
          }
          .right-section {
            border: 3px solid #9166AA;
            border-radius: 10px;
            margin-bottom: 8px;
            overflow: hidden;
            height: auto;
            padding: 0;
          }
          .info-block {
            border: 3px solid #9166AA;
            border-radius: 10px;
            background: #f8f8f8;
            padding: 15px;
            margin-bottom: 8px;
            width: 100%;
            box-sizing: border-box;
          }
          .info-grid {
            display: flex;
            flex-direction: column;
            gap: 5px;
            margin-bottom: 12px;
          }
          .info-row {
            display: flex;
            align-items: center;
          }
          .info-label {
            font-size: 13px;
            color: #888;
            width: 80px;
          }
          .info-value {
            font-size: 15px;
            font-weight: bold;
            color: #222;
          }
          .button-row {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .result-section {
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            background: #fff;
            padding: 0;
            height: 100%;
            box-sizing: border-box;
          }
          .result-title {
            font-size: 20px;
            font-weight: bold;
            margin: 0;
            text-align: center;
            width: 100%;
            background: #f0f0f0;
            padding: 6px 0;
          }
          .result-content {
            padding: 10px 0;
            width: 100%;
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
          }
          .img-product-container {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            width: 50%;
            text-align: center;
          }
          .img-product-container .img-container {
            width: 100%;
            max-width: 140px;
            margin: 0;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: flex-start;
          }
          .img-product-container img {
            width: 100%;
            height: auto;
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            margin: 0;
            padding: 0;
          }
          .quantity-badge {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background-color: #e6efff;
            border-radius: 25px;
            padding: 10px 20px;
            margin-left: 10px;
            margin-right: 15px;
          }
          .product-quantity-badge {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background-color: #F0F0F0;
            border-radius: 25px;
            padding: 10px 20px;
            margin-left: 10px;
            margin-right: 15px;
          }
          .quantity-display {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-left: auto;
            position: relative;
            top: -25px; /* Увеличиваем смещение вверх для лучшего вертикального центрирования */
          }
          .quantity-number {
            font-size: 42px;
            font-weight: bold;
            color: #1e3e7b;
            line-height: 1;
          }
          .quantity-label {
            font-size: 24px;
            font-weight: bold;
            color: #1e3e7b;
            text-transform: uppercase;
          }
          .quantity-x {
            font-size: 36px;
            font-weight: bold;
            color: #1e3e7b;
            margin-right: 10px;
          }
          .result-info {
            width: 100%;
            text-align: center;
            margin-top: 10px;
            padding: 0 5px;
          }
          .operations-block {
            background: #f8f8f8;
            border: 3px solid #9166AA;
            border-radius: 10px;
            padding: 10px 15px;
            margin-bottom: 16px;
          }
          .operations-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 8px;
          }
          .operations-list {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }
          .operation {
            background: #e6efff;
            color: #1e3e7b;
            padding: 5px 10px;
            border-radius: 5px;
            font-size: 14px;
            font-weight: 500;
            margin: 3px;
            display: inline-block;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          .operations-section {
            background: #f8f8f8;
            border: 1px solid #ddd;
            border-radius: 5px;
            padding: 10px;
            margin-bottom: 15px;
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            justify-content: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
           <div>
             <div class="section-title">${componentsSectionTitle}</div>
             <div class="components-section">
               <div class="components-grid">
                 ${componentsHtml}
            </div>
          </div>
            </div>
           <div class="right-block">
             <div class="info-block">
               <div class="info-grid">
                 <div class="info-row">
                   <div class="info-label">Начало:</div>
                   <div class="info-value" id="startTime">${additionalData.formattedStartTime || ''}</div>
            </div>
                 <div class="info-row">
                   <div class="info-label">Конец:</div>
                   <div class="info-value" id="endTime">${additionalData.formattedEndTime || ''}</div>
            </div>
                 <div class="info-row">
                   <div class="info-label">Работник:</div>
                   <div class="info-value">${additionalData.workerName}</div>
            </div>
          </div>
               <div class="button-row">
            <button id="actionButton" class="${buttonClass}" data-state="${buttonState}">${buttonText}</button>
                 <button id="printButton" class="print-button" title="Печать"><span style="font-size:16px;">🖨️</span></button>
            </div>
          </div>
          
             <div class="right-section">
               <div class="result-title">${receiveTitle}</div>
            <div class="result-section">
                 <div class="result-content">
                   <div class="img-product-container">
                     <div class="img-container">
              <img src="${getPhotoUrl(selectedNode)}" alt="${selectedNode}">
              </div>
                     <div class="result-info">
                       <div class="code-with-quantity"><span class="code-part">${selectedNode}</span></div>
                       <div class="name-part${!namesMap[selectedNode] ? ' no-name' : ''}">${namesMap[selectedNode] || "нет названия"}</div>
                     </div>
                   </div>
                   ${additionalData.type !== "раскрой" ? `
                   <div class="quantity-display">
                     <span class="quantity-x">x</span>
                     <div class="quantity-badge">
                       <div style="display: flex; align-items: center;">
                         <span class="quantity-number">${selectedNodeQuantity}</span>
                       </div>
                       <span class="quantity-label">шт</span>
                     </div>
                   </div>
                   ` : ''}
                 </div>
            </div>
          </div>
          
             <div class="right-section">
               <div class="result-title">Готовое изделие</div>
            <div class="result-section">
                 <div class="result-content" style="justify-content: space-between;">
                   <div class="img-product-container" style="width: 50%;">
                     <div class="img-container">
              <img src="${getPhotoUrl(targetProduct)}" alt="${targetProduct}">
                     </div>
                     <div class="result-info">
              <div class="code-with-quantity"><span class="code-part">${targetProduct}</span></div>
              <div class="name-part${!namesMap[targetProduct] ? ' no-name' : ''}">${namesMap[targetProduct] || "нет названия"}</div>
            </div>
                   </div>
                   <div class="quantity-display">
                     <span class="quantity-x">x</span>
                     <div class="product-quantity-badge">
                       <div style="display: flex; align-items: center;">
                         <span class="quantity-number">${productQuantity}</span>
                       </div>
                       <span class="quantity-label">шт</span>
                     </div>
                   </div>
                 </div>
               </div>
            </div>
            
            ${operationsArray.length > 0 ? `
            <div class="right-section">
              <div class="result-title">Операции</div>
              <div class="result-section" style="padding: 10px;">
                <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; align-items: center; width: 100%; min-height: 50px;">
                  ${operationsHtml}
                </div>
              </div>
            </div>
            ` : ''}
          </div>
        </div>
      </body>
    </html>
  `;
}

// Функция для получения дополнительных данных
function getAdditionalData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = ss.getActiveSheet();
  const activeCell = activeSheet.getActiveCell();
  const currentRow = activeCell.getRow();
  
  // Получаем данные из соответствующих столбцов
  const tkNumber = activeSheet.getRange(currentRow, 1).getValue(); // Столбец A
  const status = activeSheet.getRange(currentRow, 6).getValue(); // Столбец F
  const startTime = activeSheet.getRange(currentRow, 7).getValue(); // Столбец G
  const endTime = activeSheet.getRange(currentRow, 8).getValue(); // Столбец H
  const orderNumber = activeSheet.getRange(currentRow, 5).getValue(); // Столбец E
  const type = activeSheet.getRange(currentRow, 10).getValue(); // Столбец J - тип
  
  // Форматируем даты
  const formattedStartTime = startTime ? Utilities.formatDate(new Date(startTime), Session.getScriptTimeZone(), "dd.MM HH:mm") : '';
  const formattedEndTime = endTime ? Utilities.formatDate(new Date(endTime), Session.getScriptTimeZone(), "dd.MM HH:mm") : '';
  
  // Получаем имя пользователя через getEffectiveUser()
  const workerName = Session.getEffectiveUser().getEmail().split('@')[0];
  
  // Определяем класс для стилизации статуса и преобразуем статус в верхний регистр
  let statusClass = 'new';
  let displayStatus = 'НОВЫЙ';
  
  if (status === 'в работе') {
    statusClass = 'inprogress';
    displayStatus = 'В РАБОТЕ';
  } else if (status === 'готово') {
    statusClass = 'done';
    displayStatus = 'ГОТОВО';
  }
  
  return {
    tkNumber,
    status: displayStatus,
    startTime,
    endTime,
    formattedStartTime,
    formattedEndTime,
    orderNumber,
    workerName,
    statusClass,
    type
  };
}

// Функция для расчета длительности
function calculateDuration(startTime, endTime) {
  if (!startTime) {
    return '';
  }
  
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : new Date();
  
  // Разница в миллисекундах
  const diff = end - start;
  
  // Переводим в часы и минуты
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  return `${hours}ч ${minutes}мин`;
}

// Функция для определения состояния кнопки
function getButtonState(startTime, endTime) {
  if (endTime) {
    return 'done'; // Готово
  } else if (startTime) {
    return 'finish'; // Завершить
  } else {
    return 'start'; // Начать
  }
}

// Функция для обновления статуса задачи
function updateTaskStatus(buttonState, workerName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const activeSheet = ss.getActiveSheet();
    const activeCell = activeSheet.getActiveCell();
    const currentRow = activeCell.getRow();
    
    // Получаем текущий статус для возврата в клиентский код
    const oldStatus = activeSheet.getRange(currentRow, 6).getValue();
    let oldStatusClass = 'new';
    if (oldStatus === 'в работе') {
      oldStatusClass = 'inprogress';
    } else if (oldStatus === 'готово') {
      oldStatusClass = 'done';
    }
    
    const now = new Date();
    const formattedDate = Utilities.formatDate(now, Session.getScriptTimeZone(), "dd.MM HH:mm");
    
    let newStatus, newStatusClass;
    
    if (buttonState === 'start') {
      // Меняем статус на "в работе" и записываем время начала
      newStatus = 'В РАБОТЕ';
      newStatusClass = 'inprogress';
      activeSheet.getRange(currentRow, 6).setValue('в работе'); // Столбец F (сохраняем в нижнем регистре)
      activeSheet.getRange(currentRow, 7).setValue(now); // Столбец G
      activeSheet.getRange(currentRow, 9).setValue(workerName); // Столбец I - имя работника
    } else if (buttonState === 'finish') {
      // Меняем статус на "готово" и записываем время завершения
      newStatus = 'ГОТОВО';
      newStatusClass = 'done';
      activeSheet.getRange(currentRow, 6).setValue('готово'); // Столбец F (сохраняем в нижнем регистре)
      activeSheet.getRange(currentRow, 8).setValue(now); // Столбец H
      activeSheet.getRange(currentRow, 9).setValue(workerName); // Столбец I - имя работника
      
      // Записываем продолжительность выполнения в минутах в столбец K
      const startTime = activeSheet.getRange(currentRow, 7).getValue();
      if (startTime) {
        // Вычисляем продолжительность в минутах
        const durationMinutes = Math.round((now - startTime) / (1000 * 60));
        activeSheet.getRange(currentRow, 11).setValue(durationMinutes); // Столбец K
        
        // Получаем артикул узла из столбца C
        const nodeCode = activeSheet.getRange(currentRow, 3).getValue();
        
        // Считаем минимальное время выполнения для данного узла на момент завершения
        const allRows = activeSheet.getDataRange().getValues();
        let minTime = null;
        for (let i = 1; i < allRows.length; i++) { // пропускаем заголовок
          if (allRows[i][2] && String(allRows[i][2]).trim() === String(nodeCode).trim()) { // столбец C
            const timeVal = allRows[i][10]; // столбец K (индекс 10)
            if (typeof timeVal === 'number' && !isNaN(timeVal)) {
              if (minTime === null || timeVal < minTime) {
                minTime = timeVal;
              }
            }
          }
        }
        if (minTime !== null) {
          activeSheet.getRange(currentRow, 12).setValue(minTime); // Столбец L
        } else {
          activeSheet.getRange(currentRow, 12).setValue(''); // если нет данных
        }
      }
    }
    
    // Рассчитываем новую длительность
    const startTime = activeSheet.getRange(currentRow, 7).getValue();
    const endTime = buttonState === 'finish' ? now : null;
    const duration = calculateDuration(startTime, endTime);
    
    return { 
      success: true,
      oldStatus: oldStatus,
      oldStatusClass: oldStatusClass,
      newStatus: newStatus,
      newStatusClass: newStatusClass,
      formattedDate: formattedDate,
      duration: duration
    };
  } catch (e) {
    Logger.log('Ошибка при обновлении статуса: ' + e);
    return { success: false, error: e.toString() };
  }
}

// Оптимизированная функция получения схемы данных с кэшированием
function getSchemaData() {
  try {
    // Проверяем, определена ли переменная schemaDataCache и не null ли она
    if (typeof schemaDataCache !== 'undefined' && schemaDataCache !== null) {
    return schemaDataCache;
  }
    
    // Если переменная не определена, инициализируем её
    if (typeof schemaDataCache === 'undefined') {
      schemaDataCache = null;
    }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const schemaSheet = ss.getSheetByName("Схема");
  const rawData = schemaSheet.getDataRange().getValues();
  
  schemaDataCache = rawData.slice(1).map(row => ({
    source: row[0].toString().trim(),
    sourceQuantity: row[1],
    target: row[2].toString().trim(),
    targetQuantity: row[3],
    targetProduct: row[4].toString().trim() // Добавляем артикул готового изделия из столбца E
  }));
  
  return schemaDataCache;
  } catch (e) {
    Logger.log('Ошибка при получении схемы данных: ' + e);
    // В случае ошибки возвращаем пустой массив
    return [];
  }
}

function getNodeComponents(node, schemaData) {
  const components = [];
  const operations = [];
  
  // Получаем тип из дополнительных данных
  const additionalData = getAdditionalData();
  
  // Получаем артикул готового изделия из текущей строки ТК
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = ss.getActiveSheet();
  const activeCell = activeSheet.getActiveCell();
  const currentRow = activeCell.getRow();
  const targetProduct = activeSheet.getRange(currentRow, 2).getValue(); // Готовое изделие из столбца B
  
  if (additionalData.type === "раскрой") {
    // Для раскроя берем данные из вкладки "Раскрои"
    const raskroiSheet = ss.getSheetByName("Раскрои");
    const raskroiData = raskroiSheet.getDataRange().getValues();
    
    // Ищем нужный раскрой в столбце A
    for (let i = 1; i < raskroiData.length; i++) {
      if (raskroiData[i][0] === node) {
        const detail = raskroiData[i][1];
        const quantity = raskroiData[i][10];
        
        if (detail) {
          components.push({
            code: detail,
            quantity: quantity || 1
          });
        }
      }
    }
    
    operations.push("раскрой");
  } else {
    // Для сборки используем данные из вкладки "Схема"
    schemaData.forEach(row => {
      // Проверяем совпадение и узла, и артикула готового изделия
      if (row.target === node && row.targetProduct === targetProduct) {
        if (row.sourceQuantity === "операция") {
          operations.push(row.source);
        } else {
          components.push({
            code: row.source,
            quantity: row.sourceQuantity
          });
        }
      }
    });
  }

  return { components, operations };
}

function getImageData(imageName) {
  // Если изображение в кэше, возвращаем его
  if (imageCache.hasOwnProperty(imageName)) {
    return imageCache[imageName];
  }
  
  // Если изображения нет в кэше, возвращаем null
  return null;
}

function resizePopup(width, height) {
  const dialog = HtmlService.getActiveDialog();
  if (dialog) {
    // Получаем максимальные размеры экрана
    const maxWidth = window.screen.availWidth; // 100% от доступной ширины
    const maxHeight = window.screen.availHeight; // 100% от доступной высоты
    
    // Устанавливаем максимальные размеры
    dialog.setWidth(maxWidth).setHeight(maxHeight);
  }
} 

// Функция для уменьшения размера и качества изображения
function reduceImageQuality(imageDataUrl, maxSize, quality) {
  try {
    // Если изображения нет, возвращаем null
    if (!imageDataUrl) return null;
    
    // Определяем индекс начала base64 данных
    const commaIndex = imageDataUrl.indexOf(',');
    if (commaIndex === -1) return imageDataUrl;
    
    // Получаем тип и данные
    const type = imageDataUrl.substring(0, commaIndex + 1);
    
    // Просто возвращаем оригинальное изображение без изменений
    // Это позволит избежать проблем с отображением и ускорить генерацию
    // без потери качества изображений
    return imageDataUrl;
  } catch (e) {
    Logger.log('Ошибка при оптимизации изображения: ' + e);
    return imageDataUrl; // Возвращаем оригинальное изображение в случае ошибки
  }
}

// Функция для генерации PDF файла технологической карты
function generatePdf() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const activeSheet = ss.getActiveSheet();
    const activeCell = activeSheet.getActiveCell();
    const currentRow = activeCell.getRow();
    
    // Получаем данные текущей строки
    const targetProduct = activeSheet.getRange(currentRow, 2).getValue(); // Готовое изделие
    const selectedNode = activeSheet.getRange(currentRow, 3).getValue(); // Выбранный узел
    const selectedNodeQuantity = activeSheet.getRange(currentRow, 4).getValue(); // Количество получаемых деталей
    
    // Получаем схему
    const schemaData = getSchemaData();
    
    // Получаем компоненты для выбранного узла
    const { components, operations } = getNodeComponents(selectedNode, schemaData);
    
    // Получаем соответствия названий и артикулов фото
    const { namesMap, photoIdsMap } = getNodeNamesAndPhotoIds();
    
    // Собираем список всех кодов, для которых нужны изображения (используем артикулы фото)
    const imageCodes = [
      photoIdsMap[targetProduct] || targetProduct, 
      photoIdsMap[selectedNode] || selectedNode
    ];
    components.forEach(comp => {
      const photoId = photoIdsMap[comp.code] || comp.code;
      imageCodes.push(photoId);
    });
    
    // Загружаем изображения синхронно
    loadImagesSync(imageCodes);
    
    // Получаем дополнительные данные
    const additionalData = getAdditionalData();
    
    // Используем изображения без изменений для лучшего качества
    const optimizedImageCache = imageCache;
    
    // Генерируем HTML для PDF версии
    const pdfHtml = generatePrintPdfHtml(
      components, 
      operations, 
      selectedNode, 
      targetProduct, 
      selectedNodeQuantity,
      additionalData,
      optimizedImageCache,
      photoIdsMap
    );
    
    // Создаем временный HTML файл в Google Drive
    const htmlFile = DriveApp.createFile('temp_tk.html', pdfHtml, MimeType.HTML);
    
    // Преобразуем HTML в PDF используя Google Drive API
    const blob = DriveApp.getFileById(htmlFile.getId()).getBlob();
    
    // Создаем PDF файл с соответствующим именем
    let pdfFileName;
    if (additionalData.type === "раскрой") {
      pdfFileName = `Раскрой_тк_${additionalData.tkNumber}_${selectedNode}.pdf`;
    } else {
      pdfFileName = `Цех_тк_${additionalData.tkNumber}_${selectedNode}.pdf`;
    }
    const pdfFile = DriveApp.createFile(blob.getAs('application/pdf')).setName(pdfFileName);
    
    // Удаляем временный HTML файл
    htmlFile.setTrashed(true);
    
    // Возвращаем URL для просмотра PDF
    return pdfFile.getUrl();
    
  } catch (e) {
    Logger.log('Ошибка при создании PDF: ' + e);
    return null;
  }
}

// Функция для генерации HTML для печатной версии PDF
function generatePrintPdfHtml(components, operations, selectedNode, targetProduct, selectedNodeQuantity, additionalData, imageCache, photoIdsMap) {
  const placeholderImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2U5ZWNlZiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNnB4IiBmaWxsPSIjNmM3NTdkIj7QndC10YIg0YTQvtGC0L48L3RleHQ+PC9zdmc+';
  
  // Определяем заголовки в зависимости от типа
  const componentsTitle = additionalData.type === "раскрой" ? "Детали получаемые из раскроя" : "Берем для получения 1шт";
  const receiveTitle = additionalData.type === "раскрой" ? "Раскрой" : "Получаем";
  
  // Получаем соответствия артикулов и названий
  const namesMap = getNodeNames();
  
  // Получаем количество готового изделия из заказа
  const productQuantity = getProductQuantity(additionalData.orderNumber, targetProduct);
  
  const getPhotoUrl = (code) => {
    // Используем оригинальные изображения из кэша с артикулом фото
    const photoId = photoIdsMap[code] || code;
    const imageData = imageCache[photoId];
    return imageData || placeholderImage;
  };

  // Создаем HTML для компонентов
  const componentsHtml = components.map(comp => `
    <div class="component">
      <div class="img-container">
      <img src="${getPhotoUrl(comp.code)}" alt="${comp.code}">
      </div>
      <div class="component-info">
        <div class="code-with-quantity"><span class="code-part">${comp.code}</span> <span class="quantity-part">(${comp.quantity} шт)</span></div>
        <div class="name-part${!namesMap[comp.code] ? ' no-name' : ''}">${namesMap[comp.code] || "нет названия"}</div>
      </div>
    </div>
  `).join('');

  // Операции
  // Проверяем, что operations существует и является массивом
  const operationsArray = Array.isArray(operations) ? operations : [];
  const operationsHtml = operationsArray.map(op => `
    <div class="operation">⚙️ ${op}</div>
  `).join('');

  // Создаем HTML для PDF
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${additionalData.type === "раскрой" ? "Раскрой" : "Цех"}, тк ${additionalData.tkNumber}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 20px;
          }
          h1 {
            font-size: 24px;
            text-align: center;
            margin-bottom: 5px;
          }
          .header-info {
            text-align: center;
            border-bottom: 1px solid #000;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          h2 {
            font-size: 18px;
            margin: 15px 0 10px 0;
          }
          .components-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
          }
          .component {
            width: 150px;
            text-align: center;
            margin-bottom: 15px;
          }
          .component img {
            width: 140px;
            height: 140px;
            object-fit: contain;
            border: 1px solid #eee;
            background-color: #fff;
          }
          .component-name {
            font-weight: bold;
            margin-top: 5px;
          }
          .component-qty {
            color: #666;
          }
          .result {
            display: flex;
            align-items: center;
            margin: 15px 0;
            padding: 10px;
            border: 1px solid #ccc;
            border-radius: 4px;
          }
          .result img {
            width: 150px;
            height: 150px;
            object-fit: contain;
            margin-right: 15px;
            border: 1px solid #eee;
            background-color: #fff;
          }
          .result-info {
            flex: 1;
          }
          .result-code {
            font-weight: bold;
            font-size: 16px;
          }
          .result-qty {
            color: #666;
            margin-left: 5px;
          }
          .result-name {
            margin-top: 5px;
          }
          .operation {
            background: #e6efff;
            color: #1e3e7b;
            padding: 5px 10px;
            border-radius: 5px;
            font-size: 14px;
            font-weight: 500;
            margin: 3px;
            display: inline-block;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          .operations-section {
            background: #f8f8f8;
            border: 1px solid #ddd;
            border-radius: 5px;
            padding: 10px;
            margin-bottom: 15px;
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            justify-content: center;
          }
        </style>
      </head>
      <body>
        <h1>${additionalData.type === "раскрой" ? "Раскрой" : "Цех"}, тк ${additionalData.tkNumber}</h1>
        <div class="header-info">
          Заказ № ${additionalData.orderNumber} | Статус: ${additionalData.status} | Работник: ${additionalData.workerName}
        </div>
        
        ${operationsArray.length > 0 ? `
        <h2>Операции:</h2>
        <div class="operations-section">${operationsHtml || 'Нет операций'}</div>
        ` : ''}
        
        <h2>${componentsTitle}:</h2>
        <div class="components-grid">
          ${componentsHtml || 'Нет компонентов'}
        </div>
        
        <h2>${receiveTitle}:</h2>
        <div class="result">
          <img src="${getPhotoUrl(selectedNode)}" alt="${selectedNode}">
          <div class="result-info">
            <div>
              <span class="result-code">${selectedNode}</span>
              ${additionalData.type !== "раскрой" ? `<span class="result-qty">(${selectedNodeQuantity} шт)</span>` : ''}
            </div>
            ${additionalData.type !== "раскрой" && namesMap[selectedNode] ? 
              `<div class="result-name">${namesMap[selectedNode]}</div>` : ''
            }
          </div>
        </div>
        
        <h2>Готовое изделие:</h2>
        <div class="result">
          <img src="${getPhotoUrl(targetProduct)}" alt="${targetProduct}">
          <div class="result-info">
            <div class="code-with-quantity"><span class="code-part">${targetProduct}</span></div>
            <div class="name-part${!namesMap[targetProduct] ? ' no-name' : ''}">${namesMap[targetProduct] || "нет названия"}</div>
          </div>
        </div>
      </body>
    </html>
  `;
}

// Функция для получения количества готового изделия из вкладки "Заказы"
function getProductQuantity(orderNumber, productCode) {
  if (!orderNumber || !productCode) {
    return "-"; // Используем "-" как значение по умолчанию
  }
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ordersSheet = ss.getSheetByName("Заказы");
    
    if (!ordersSheet) {
      Logger.log('Вкладка "Заказы" не найдена');
      return "-";
    }
    
    const ordersData = ordersSheet.getDataRange().getValues();
    
    // Проверяем наличие заголовков таблицы
    if (ordersData.length < 2) {
      Logger.log('Недостаточно данных в таблице "Заказы"');
      return "-";
    }
    
    // Определяем индексы столбцов
    const headers = ordersData[0].map(h => String(h).trim().toLowerCase());
    const orderColIndex = headers.indexOf('номер заказа');
    const codeColIndex = headers.indexOf('артикул');
    const qtyColIndex = headers.indexOf('кол-во');
    
    // Если не нашли нужные столбцы, используем стандартные позиции (A, C, E)
    const orderIndex = orderColIndex >= 0 ? orderColIndex : 0;
    const codeIndex = codeColIndex >= 0 ? codeColIndex : 2;
    const qtyIndex = qtyColIndex >= 0 ? qtyColIndex : 4;
    
    // Поиск по всем строкам заказов
    for (let i = 1; i < ordersData.length; i++) {
      // Проверяем совпадение номера заказа и артикула
      if (ordersData[i][orderIndex] && String(ordersData[i][orderIndex]).trim() === String(orderNumber).trim() && 
          ordersData[i][codeIndex] && String(ordersData[i][codeIndex]).trim() === String(productCode).trim()) {
        // Возвращаем количество
        return ordersData[i][qtyIndex] ? Number(ordersData[i][qtyIndex]) : "-";
      }
    }
    
    // Если конкретное совпадение не найдено, ищем такой же артикул в других заказах
    for (let i = 1; i < ordersData.length; i++) {
      if (ordersData[i][codeIndex] && String(ordersData[i][codeIndex]).trim() === String(productCode).trim()) {
        // Возвращаем количество из первого найденного заказа с таким артикулом
        return ordersData[i][qtyIndex] ? Number(ordersData[i][qtyIndex]) : "-";
      }
    }
    
    // Если ничего не найдено
    Logger.log(`Заказ ${orderNumber} с артикулом ${productCode} не найден, используем "-"`);
    return "-";
  } catch (e) {
    Logger.log('Ошибка при получении количества продукта: ' + e);
    return "-";
  }
} 