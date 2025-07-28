function generatePopupHtml(components, operations, selectedNode, targetProduct, photosMap) {
  const placeholderImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2U5ZWNlZiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNnB4IiBmaWxsPSIjNmM3NTdkIj7QndC10YIg0YTQvtGC0L48L3RleHQ+PC9zdmc+';

  const getPhotoUrl = (code) => {
    const photo = photosMap.get(code);
    if (!photo) {
      Logger.log(`Нет фото для кода: ${code}`);
      return placeholderImage;
    }
    return photo;
  };

  const componentsHtml = components.map(comp => `
    <div class="component">
      <img src="${getPhotoUrl(comp.code)}" alt="${comp.code}">
      <div class="component-info">
        <div>${comp.code}</div>
        <div>${comp.quantity} шт</div>
      </div>
    </div>
  `).join('');

  const operationsHtml = operations.map(op => `
    <div class="operation">${op}</div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
          }
          .container {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            gap: 20px;
          }
          .section {
            margin-bottom: 20px;
          }
          .section-title {
            font-weight: bold;
            margin-bottom: 10px;
          }
          .components-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
          }
          .component {
            text-align: center;
          }
          .component img {
            width: 100px;
            height: 100px;
            object-fit: cover;
            margin-bottom: 5px;
          }
          .operations-list {
            background: #f0f0f0;
            padding: 10px;
            border-radius: 5px;
          }
          .operation {
            padding: 5px;
            margin: 5px 0;
            background: #e0e0e0;
            border-radius: 3px;
          }
          .result-section {
            text-align: center;
          }
          .result-section img {
            width: 200px;
            height: 200px;
            object-fit: cover;
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="section">
            <div class="section-title">Берем</div>
            <div class="components-grid">
              ${componentsHtml}
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Операции</div>
            <div class="operations-list">
              ${operationsHtml}
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Получаем</div>
            <div class="result-section">
              <img src="${getPhotoUrl(selectedNode)}" alt="${selectedNode}">
              <div>${selectedNode}</div>
            </div>
            
            <div class="section-title" style="margin-top: 20px;">Готовое изделие</div>
            <div class="result-section">
              <img src="${getPhotoUrl(targetProduct)}" alt="${targetProduct}">
              <div>${targetProduct}</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
} 