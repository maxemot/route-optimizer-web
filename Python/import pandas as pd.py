import pandas as pd
import graphviz
import os
import webbrowser
from PIL import Image
from collections import defaultdict
import sys

def find_all_sources(df, target, visited=None):
    """Рекурсивно находит все исходные вершины для заданной целевой"""
    if visited is None:
        visited = set()
    
    if target in visited:
        return set()
    
    visited.add(target)
    sources = set()
    
    # Находим прямые источники для целевой вершины
    direct_sources = df[df['делаем деталь'].str.strip() == target]['берем деталь'].str.strip()
    
    for source in direct_sources:
        sources.add(source)
        # Рекурсивно ищем источники для каждого найденного source
        sources.update(find_all_sources(df, source, visited))
    
    return sources

def create_graph(target_product):
    try:
        # Путь к файлу
        file_path = '/Users/maksimshchegolikhin/Desktop/Programming/Table.csv'
        
        if not os.path.exists(file_path):
            print(f"❌ Ошибка: Файл не найден: {file_path}")
            return
            
        # Читаем нужные столбцы
        df = pd.read_csv(file_path, sep=';')
        
        # Находим все вершины, связанные с целевым продуктом
        all_related_nodes = find_all_sources(df, target_product)
        all_related_nodes.add(target_product)  # Добавляем сам целевой продукт
        
        # Фильтруем DataFrame, оставляя только строки, связанные с нашим продуктом
        df_filtered = df[
            (df['берем деталь'].str.strip().isin(all_related_nodes)) & 
            (df['делаем деталь'].str.strip().isin(all_related_nodes))
        ]
        
        # Если нет данных, выводим сообщение
        if df_filtered.empty:
            print(f"❌ Не найдены данные для изделия: {target_product}")
            return
        
        # Создаем граф с настройками компактного размещения
        dot = graphviz.Digraph(comment='Production Graph')
        dot.attr(rankdir='LR')      # Слева направо
        dot.attr(nodesep='0.1')     # Минимальное расстояние между узлами по вертикали
        dot.attr(ranksep='0.1')     # Минимальное расстояние между рангами
        dot.attr(concentrate='true') # Объединяем похожие ребра
        
        # Находим стартовые вершины
        all_sources = set(df_filtered['берем деталь'].str.strip())
        all_targets = set(df_filtered['делаем деталь'].str.strip())
        start_nodes = all_sources - all_targets
        
        # Группируем стартовые вершины по их целевым вершинам
        target_to_sources = defaultdict(list)
        for _, row in df_filtered.iterrows():
            source = str(row['берем деталь']).strip()
            if source in start_nodes:
                target = str(row['делаем деталь']).strip()
                source_qty = str(row['Кол-во']).strip()
                if source_qty.lower() == 'операция':
                    label = f"{source} операция"
                else:
                    label = f"{source} берем {source_qty} шт"
                target_to_sources[target].append(label)
        
        # Собираем информацию о количествах для нестартовых вершин
        node_info = {}
        for _, row in df_filtered.iterrows():
            source = str(row['берем деталь']).strip()
            target = str(row['делаем деталь']).strip()
            source_qty = str(row['Кол-во']).strip()
            target_qty = str(row['Кол-во.1']).strip()
            
            if source not in start_nodes:
                if source not in node_info:
                    node_info[source] = {'in_qty': [], 'out_qty': []}
                if source_qty.lower() == 'операция':
                    node_info[source]['out_qty'].append('операция')
                else:
                    node_info[source]['out_qty'].append(f'берем {source_qty} шт')
            
            if target not in node_info:
                node_info[target] = {'in_qty': [], 'out_qty': []}
            node_info[target]['in_qty'].append(f'получаем {target_qty} шт')
        
        # Создаем узлы и связи
        for _, row in df_filtered.iterrows():
            source = str(row['берем деталь']).strip()
            target = str(row['делаем деталь']).strip()
            
            if source in start_nodes:
                continue
                
            def get_node_label(node):
                info = node_info[node]
                label = node
                if info['in_qty']:
                    label += '\n' + info['in_qty'][0]
                if info['out_qty']:
                    label += '\n' + info['out_qty'][0]
                return label
            
            dot.node(source, get_node_label(source),
                    shape='box',
                    style='rounded,filled',
                    fillcolor='lightgray',
                    height='0.2',
                    width='1.0',
                    margin='0.05')
            
            dot.node(target, get_node_label(target),
                    shape='box',
                    style='rounded,filled',
                    fillcolor='lightgray',
                    height='0.2',
                    width='1.0',
                    margin='0.05')
            
            dot.edge(source, target)
        
        # Создаем объединенные стартовые вершины и их связи
        for target, sources in target_to_sources.items():
            group_id = f"start_group_{target}"
            group_label = '\n'.join(sources)
            
            dot.node(group_id, group_label,
                    shape='box',
                    style='rounded,filled',
                    fillcolor='lightgray',
                    height='0.2',
                    width='1.0',
                    margin='0.05')
            
            dot.edge(group_id, target)
        
        # Получаем DOT представление графа
        dot_source = dot.source
        
        # Создаем HTML файл
        html_path = '/Users/maksimshchegolikhin/Desktop/Programming/production_graph.html'
        
        # Формируем HTML содержимое с встроенным DOT
        html_content = f'''
        <!DOCTYPE html>
        <html>
        <head>
            <title>Production Graph - {target_product}</title>
            <script src="https://d3js.org/d3.v5.min.js"></script>
            <script src="https://unpkg.com/@hpcc-js/wasm@0.3.11/dist/index.min.js"></script>
            <script src="https://unpkg.com/d3-graphviz@3.0.5/build/d3-graphviz.js"></script>
            <style>
                #graph {{
                    width: 100%;
                    height: 100vh;
                    margin: 0;
                    padding: 0;
                }}
            </style>
        </head>
        <body style="margin:0; padding:0;">
            <div id="graph"></div>
            <script>
                var dotSource = `{dot_source}`;
                var graphviz = d3.select("#graph").graphviz()
                    .fit(true)
                    .zoomScaleExtent([0.1, 10])
                    .width(window.innerWidth)
                    .height(window.innerHeight);
                graphviz.renderDot(dotSource);
                window.addEventListener("resize", function() {{
                    graphviz
                        .width(window.innerWidth)
                        .height(window.innerHeight)
                        .fit(true)
                        .renderDot(dotSource);
                }});
            </script>
        </body>
        </html>
        '''
        
        # Сохраняем HTML файл
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        # Открываем в Chrome
        chrome_path = {
            'darwin': 'open -a /Applications/Google\ Chrome.app %s',
            'win32': 'C:/Program Files/Google/Chrome/Application/chrome.exe %s',
            'linux': 'google-chrome %s'
        }
        
        platform = os.sys.platform
        if platform in chrome_path:
            browser = chrome_path[platform]
            webbrowser.get(browser).open('file://' + os.path.realpath(html_path))
        else:
            print("❌ Не удалось определить путь к Chrome для вашей операционной системы")
        
        print(f"✅ График сохранен и открыт в браузере: {html_path}")
        
    except Exception as e:
        print(f"❌ Ошибка: {str(e)}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("❌ Пожалуйста, укажите название изделия в качестве аргумента")
        print("Пример: python painter.py 02.07.01.С01")
        sys.exit(1)
    
    target_product = sys.argv[1].strip()
    create_graph(target_product)
