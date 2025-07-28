function painter() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = ss.getActiveSheet();
  const activeCell = activeSheet.getActiveCell();
  
  // Получаем значение из столбца B и C той же строки
  const targetProduct = activeSheet.getRange(activeCell.getRow(), 2).getValue();
  const selectedNode = activeSheet.getRange(activeCell.getRow(), 3).getValue();
  const schemaSheet = ss.getSheetByName("Схема");
  
  // Получаем данные из таблицы
  const rawData = schemaSheet.getDataRange().getValues();
  
  // Пропускаем заголовок и создаем массив связей
  const schemaData = rawData.slice(1).map(row => ({
    source: String(row[0]).trim(),      // берем деталь
    sourceQty: row[1],                  // количество детали
    target: String(row[2]).trim(),      // делаем деталь
    targetQty: row[3]                   // количество в сборке
  }));
  
  // Функция для поиска всех источников
  function findAllSources(target, visited = new Set()) {
    if (visited.has(target)) {
      return new Set();
    }
    
    visited.add(target);
    const sources = new Set();
    
    // Находим прямые источники для целевой вершины
    const directSources = schemaData
      .filter(row => row.target === target)
      .map(row => row.source);
    
    for (const source of directSources) {
      sources.add(source);
      // Рекурсивно ищем источники для каждого найденного source
      const subSources = findAllSources(source, visited);
      subSources.forEach(s => sources.add(s));
    }
    
    return sources;
  }
  
  try {
    // Находим все вершины, связанные с целевым продуктом
    const allRelatedNodes = findAllSources(targetProduct);
    allRelatedNodes.add(targetProduct);
    
    // Фильтруем связи, оставляя только те, что связаны с нашим продуктом
    const filteredData = schemaData.filter(row => 
      allRelatedNodes.has(row.source) && allRelatedNodes.has(row.target)
    );
    
    // Если нет данных, выводим сообщение
    if (filteredData.length === 0) {
      Logger.log(`❌ Не найдены данные для изделия: ${targetProduct}`);
      return;
    }
    
    // Находим стартовые вершины
    const allSources = new Set(filteredData.map(row => row.source));
    const allTargets = new Set(filteredData.map(row => row.target));
    const startNodes = new Set([...allSources].filter(x => !allTargets.has(x)));
    
    // Создаем DOT разметку для графа
    let dotSource = 'digraph G {\n';
    dotSource += '  rankdir=LR;\n';
    dotSource += '  node [shape=box, style="rounded,filled", fillcolor=lightgray, height=0.2, width=1.0, margin=0.05];\n';
    
    // Группируем стартовые вершины
    const targetToSources = {};
    filteredData.forEach(row => {
      if (startNodes.has(row.source)) {
        if (!targetToSources[row.target]) {
          targetToSources[row.target] = [];
        }
        const label = row.sourceQty.toString().toLowerCase() === 'операция' 
          ? `${row.source} операция`
          : `${row.source} ${row.sourceQty}шт`;
        targetToSources[row.target].push(label);
      }
    });
    
    // Добавляем информацию о количествах для нестартовых вершин
    const nodeInfo = {};
    filteredData.forEach(row => {
      if (!startNodes.has(row.source)) {
        if (!nodeInfo[row.source]) {
          nodeInfo[row.source] = { in_qty: [], out_qty: [] };
        }
        if (row.sourceQty.toString().toLowerCase() === 'операция') {
          nodeInfo[row.source].out_qty.push('операция');
        } else {
          nodeInfo[row.source].out_qty.push(`берем ${row.sourceQty} шт`);
        }
      }
      
      if (!nodeInfo[row.target]) {
        nodeInfo[row.target] = { in_qty: [], out_qty: [] };
      }
      nodeInfo[row.target].in_qty.push(`получаем ${row.targetQty} шт`);
    });
    
    // Добавляем узлы и связи в DOT
    filteredData.forEach(row => {
      if (!startNodes.has(row.source)) {
        const sourceLabel = nodeInfo[row.source] 
          ? `${row.source}\\n${nodeInfo[row.source].in_qty[0]}\\n${nodeInfo[row.source].out_qty[0]}`
          : row.source;
        const targetLabel = nodeInfo[row.target]
          ? `${row.target}\\n${nodeInfo[row.target].in_qty[0]}`
          : row.target;
          
        // Подсвечиваем только конкретный узел
        const sourceColor = row.source === selectedNode ? "#ffe070" : "lightgray";
        const targetColor = row.target === selectedNode ? "#ffe070" : "lightgray";
          
        dotSource += `  "${row.source}" [label=<${sourceLabel}>, fillcolor="${sourceColor}"];\n`;
        dotSource += `  "${row.target}" [label=<${targetLabel}>, fillcolor="${targetColor}"];\n`;
        dotSource += `  "${row.source}" -> "${row.target}";\n`;
      }
    });
    
    // Добавляем группы стартовых вершин
    Object.entries(targetToSources).forEach(([target, sources]) => {
      const groupId = `start_group_${target}`;
      const groupLabel = sources.join('\\n');
      // Группы всегда серые
      dotSource += `  "${groupId}" [label=<${groupLabel}>, fillcolor="lightgray"];\n`;
      dotSource += `  "${groupId}" -> "${target}";\n`;
    });
    
    dotSource += '}';
    
    // Создаем HTML с графом
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Production Graph - ${targetProduct}</title>
      <script src="https://d3js.org/d3.v5.min.js"></script>
      <script src="https://unpkg.com/@hpcc-js/wasm@0.3.11/dist/index.min.js"></script>
      <script src="https://unpkg.com/d3-graphviz@3.0.5/build/d3-graphviz.js"></script>
      <style>
        #graph { width: 100%; height: 100vh; margin: 0; padding: 0; }
      </style>
    </head>
    <body style="margin:0; padding:0;">
      <div id="graph"></div>
      <script>
        var dotSource = \`${dotSource}\`;
        var graphviz = d3.select("#graph").graphviz()
          .fit(true)
          .zoomScaleExtent([0.1, 10])
          .width(window.innerWidth)
          .height(window.innerHeight);
        graphviz.renderDot(dotSource);
        window.addEventListener("resize", function() {
          graphviz
            .width(window.innerWidth)
            .height(window.innerHeight)
            .fit(true)
            .renderDot(dotSource);
        });
      </script>
    </body>
    </html>
    `;
    
    // Открываем HTML в новой вкладке браузера
    const htmlOutput = HtmlService.createHtmlOutput(html)
      .setWidth(1000)
      .setHeight(800);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Production Graph');
    
    Logger.log(`✅ График создан`);
    
  } catch (e) {
    Logger.log(`❌ Ошибка: ${e.toString()}`);
  }
}