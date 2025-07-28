import pandas as pd
from collections import defaultdict, Counter
import requests
import urllib.parse
import csv
import io
import webbrowser
import os
import tempfile

# Получение данных из таблицы, доступной по ссылке
def get_sheet_data(sheet_id, sheet_name):
    # Кодируем имя листа для URL
    encoded_sheet_name = urllib.parse.quote(sheet_name)
    
    try:
        # Используем только метод 3, который работает успешно
        print(f"Получение данных из листа '{sheet_name}'...")
        url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq?tqx=out:csv&sheet={encoded_sheet_name}"
        response = requests.get(url)
        response.raise_for_status()
        
        # Используем csv модуль для корректного разбора CSV
        csv_data = csv.reader(io.StringIO(response.text))
        data = list(csv_data)
        
        print(f"Успешно получены данные из листа '{sheet_name}': {len(data)} строк")
        return data
    except Exception as e:
        print(f"Ошибка при получении данных из листа '{sheet_name}': {e}")
        return []

# Построение графа изделия
def build_graph(schema_data):
    graph = defaultdict(list)
    
    print(f"Построение графа из {len(schema_data)} строк данных")
    
    for row in schema_data[1:]:  # Пропускаем заголовок
        if len(row) < 4 or not all(row[:4]):  # Пропускаем пустые строки
            continue
        
        source = row[0].strip()
        source_quantity = row[1].strip()
        target = row[2].strip()
        target_quantity = row[3].strip()
        
        # Добавляем ребро в граф
        graph[target].append({
            'component': source,
            'quantity': source_quantity if source_quantity != "операция" else "операция",
            'target_quantity': target_quantity
        })
    
    # Выводим информацию о построенном графе
    print(f"Построен граф с {len(graph)} узлами")
    return graph

# Поиск всех компонентов для изделия (обход графа)
def find_all_components(graph, product_code, components=None, operations=None, multiplier=1):
    if components is None:
        components = Counter()
    if operations is None:
        operations = []
    
    # Если продукта нет в графе, значит это базовый компонент
    if product_code not in graph:
        components[product_code] += multiplier
        return components, operations
    
    # Обходим все компоненты текущего продукта
    for component in graph[product_code]:
        if component['quantity'] == "операция":
            operations.append(component['component'])
        else:
            # Рассчитываем количество компонентов с учетом множителя
            try:
                comp_quantity = int(component['quantity'])
                target_quantity = int(component['target_quantity'])
                new_multiplier = multiplier * comp_quantity / target_quantity
                
                # Рекурсивно обходим граф для этого компонента
                find_all_components(graph, component['component'], components, operations, new_multiplier)
            except ValueError as e:
                print(f"Ошибка при обработке компонента {component['component']}: {e}")
                print(f"Данные компонента: {component}")
    
    return components, operations

# Проверка, является ли компонент раскройной деталью
def is_cutting_part(part_code):
    # Проверяем, содержит ли код букву "Р" с возможными другими буквами после неё
    if 'Р' not in part_code:
        return False
    
    # Находим позицию буквы "Р"
    r_pos = part_code.find('Р')
    
    # Проверяем, что до буквы "Р" только цифры и точки
    before_r = part_code[:r_pos]
    if not all(c.isdigit() or c == '.' for c in before_r):
        return False
    
    return True

# Получение данных о раскроях
def get_cutting_data(cutting_data):
    cuttings = defaultdict(list)
    
    print(f"Обработка данных о раскроях из {len(cutting_data)} строк")
    
    for row in cutting_data[1:]:  # Пропускаем заголовок
        if not row or not row[0]:  # Пропускаем пустые строки
            continue
        
        cutting_number = row[0].strip()
        part_code = row[1].strip() if len(row) > 1 and row[1] else ""
        
        # Получаем площадь детали из столбца J (индекс 9)
        area = 0
        if len(row) > 9 and row[9]:
            try:
                area = float(row[9])
            except ValueError:
                try:
                    # Пробуем очистить строку от непечатаемых символов
                    clean_value = ''.join(c for c in row[9] if c.isdigit() or c == '.' or c == ',')
                    clean_value = clean_value.replace(',', '.')
                    if clean_value:
                        area = float(clean_value)
                    else:
                        print(f"Предупреждение: Не удалось преобразовать '{row[9]}' в число для площади детали {part_code}")
                except:
                    print(f"Предупреждение: Не удалось преобразовать '{row[9]}' в число для площади детали {part_code}")
        
        # Проверяем, что столбец K (индекс 10) существует и содержит число
        quantity = 0
        if len(row) > 10 and row[10]:
            try:
                quantity = int(row[10])
            except ValueError:
                try:
                    # Пробуем очистить строку от непечатаемых символов
                    clean_value = ''.join(c for c in row[10] if c.isdigit())
                    if clean_value:
                        quantity = int(clean_value)
                    else:
                        print(f"Предупреждение: Не удалось преобразовать '{row[10]}' в число для раскроя {cutting_number}, детали {part_code}")
                except:
                    print(f"Предупреждение: Не удалось преобразовать '{row[10]}' в число для раскроя {cutting_number}, детали {part_code}")
        
        if part_code and quantity > 0:
            cuttings[cutting_number].append({
                'part_code': part_code,
                'quantity': quantity,
                'area': area
            })
    
    print(f"Обработано {len(cuttings)} раскроев")
    return cuttings

# Получение данных о наличии деталей на складе
def get_stock_data(stock_data):
    stock = {}
    
    print(f"Обработка данных о складе из {len(stock_data)} строк")
    
    for row in stock_data[1:]:  # Пропускаем заголовок
        if not row or len(row) < 2:  # Пропускаем пустые строки или строки без нужных данных
            continue
        
        part_code = row[0].strip()
        
        # Получаем количество на складе
        quantity = 0
        if row[1]:
            try:
                quantity = int(row[1])
            except ValueError:
                try:
                    # Пробуем очистить строку от непечатаемых символов
                    clean_value = ''.join(c for c in row[1] if c.isdigit())
                    if clean_value:
                        quantity = int(clean_value)
                    else:
                        print(f"Предупреждение: Не удалось преобразовать '{row[1]}' в число для детали {part_code} на складе")
                except:
                    print(f"Предупреждение: Не удалось преобразовать '{row[1]}' в число для детали {part_code} на складе")
        
        if part_code and quantity > 0:
            stock[part_code] = quantity
    
    print(f"Обработано {len(stock)} деталей на складе")
    return stock

# Поиск оптимального набора раскроев с учетом наличия деталей на складе
def find_optimal_cuttings(required_parts, cuttings, stock):
    # Создаем копию требуемых деталей, чтобы не изменять оригинал
    remaining_parts = Counter()
    
    # Учитываем наличие деталей на складе
    parts_from_stock = Counter()
    parts_to_cut = Counter()
    
    for part, qty in required_parts.items():
        stock_qty = stock.get(part, 0)
        if stock_qty >= qty:
            # Если на складе достаточно деталей, берем их оттуда
            parts_from_stock[part] = qty
        else:
            # Если на складе недостаточно деталей, берем что есть и остальное вырезаем
            parts_from_stock[part] = stock_qty
            parts_to_cut[part] = qty - stock_qty
            remaining_parts[part] = qty - stock_qty
    
    print(f"Поиск оптимального набора раскроев для {len(remaining_parts)} деталей из {len(cuttings)} доступных раскроев")
    
    # Словарь для хранения выбранных раскроев и их количества
    selected_cuttings = Counter()
    
    # Словарь для хранения лишних деталей
    extra_parts = Counter()
    
    # Переменные для отслеживания площади и количества
    useful_area = 0  # Площадь нужных деталей
    waste_area = 0   # Площадь ненужных деталей
    useful_count = 0  # Количество нужных деталей
    waste_count = 0   # Количество ненужных деталей
    
    # Пока есть неудовлетворенные требования
    iteration = 0
    while sum(remaining_parts.values()) > 0 and iteration < 100:  # Ограничиваем количество итераций
        iteration += 1
        best_cutting = None
        best_score = -1
        
        # Перебираем все раскрои
        for cutting_number, parts in cuttings.items():
            # Считаем площадь нужных деталей в этом раскрое
            useful_area_in_cutting = 0
            total_area_in_cutting = 0
            
            for part in parts:
                part_code = part['part_code']
                quantity = part['quantity']
                area = part['area']
                
                # Общая площадь всех деталей этого типа в раскрое
                part_total_area = area * quantity
                total_area_in_cutting += part_total_area
                
                # Если деталь нужна, считаем полезную площадь
                if part_code in remaining_parts and remaining_parts[part_code] > 0:
                    useful_quantity = min(quantity, remaining_parts[part_code])
                    useful_area_in_cutting += area * useful_quantity
            
            # Если раскрой дает полезные детали
            if useful_area_in_cutting > 0:
                # Оценка эффективности: отношение полезной площади к общей площади
                score = useful_area_in_cutting / total_area_in_cutting
                
                if score > best_score:
                    best_score = score
                    best_cutting = cutting_number
        
        # Если не нашли подходящий раскрой, выходим из цикла
        if best_cutting is None:
            break
        
        # Добавляем выбранный раскрой
        selected_cuttings[best_cutting] += 1
        
        # Обновляем оставшиеся требования и учитываем лишние детали
        for part in cuttings[best_cutting]:
            part_code = part['part_code']
            quantity = part['quantity']
            area = part['area']
            
            if part_code in remaining_parts and remaining_parts[part_code] > 0:
                # Если деталь нужна
                used = min(quantity, remaining_parts[part_code])
                remaining_parts[part_code] -= used
                
                # Учитываем площадь и количество полезных деталей
                useful_area += area * used
                useful_count += used
                
                # Если остались лишние детали этого типа
                if quantity > used:
                    extra_parts[part_code] += (quantity - used)
                    # Учитываем площадь и количество лишних деталей
                    waste_area += area * (quantity - used)
                    waste_count += (quantity - used)
            else:
                # Если деталь не нужна вообще
                extra_parts[part_code] += quantity
                # Учитываем площадь и количество лишних деталей
                waste_area += area * quantity
                waste_count += quantity
    
    # Проверяем, все ли требования удовлетворены
    unsatisfied = {k: v for k, v in remaining_parts.items() if v > 0}
    
    # Рассчитываем общую эффективность
    total_efficiency = useful_area / (useful_area + waste_area) if (useful_area + waste_area) > 0 else 0
    
    return selected_cuttings, extra_parts, unsatisfied, useful_area, waste_area, total_efficiency, parts_from_stock, parts_to_cut, useful_count, waste_count

# Создание HTML-страницы с группировкой по раскроям и статусам
def create_html_report(components, stock, part_to_cutting, parts_to_cut, cuttings, selected_cuttings, extra_parts, target_product):
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Отчет по деталям изделия {target_product}</title>
        <style>
            body {{
                font-family: Arial, sans-serif;
                margin: 20px;
                display: flex;
                flex-wrap: wrap;
            }}
            .left-column {{
                width: 48%;
                margin-right: 2%;
            }}
            .right-column {{
                width: 48%;
            }}
            table {{
                border-collapse: collapse;
                width: 100%;
                margin-top: 10px;
                margin-bottom: 30px;
                table-layout: fixed;
            }}
            th, td {{
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
                overflow: hidden;
                text-overflow: ellipsis;
            }}
            th {{
                background-color: #f2f2f2;
                font-weight: bold;
            }}
            tr:nth-child(even) {{
                background-color: #f9f9f9;
            }}
            .status-stock {{
                color: green;
                font-weight: bold;
            }}
            .status-cutting {{
                color: blue;
                font-weight: bold;
            }}
            .status-not-found {{
                color: red;
                font-weight: bold;
            }}
            .status-buy {{
                color: orange;
                font-weight: bold;
            }}
            .status-extra {{
                color: gray;
            }}
            .efficiency {{
                color: gray;
                font-weight: normal;
            }}
            .error {{
                color: red;
                font-weight: bold;
            }}
            h1 {{
                color: #333;
                margin-top: 30px;
                width: 100%;
            }}
            h2 {{
                color: #555;
                margin-top: 20px;
            }}
            .eye-button {{
                cursor: pointer;
                margin-left: 5px;
                vertical-align: middle;
            }}
            .hidden-rows {{
                display: none;
            }}
            .summary-row {{
                color: gray;
                background-color: #f9f9f9;
            }}
            .col-1 {{
                width: 50%;
            }}
            .col-2 {{
                width: 20%;
            }}
            .col-3 {{
                width: 30%;
            }}
        </style>
        <script>
            function toggleExtraParts(tableId, buttonId) {{
                var table = document.getElementById(tableId);
                var button = document.getElementById(buttonId);
                var hiddenRows = table.getElementsByClassName('hidden-row');
                var summaryRow = table.getElementsByClassName('summary-row')[0];
                
                // Если нет скрытых строк, выходим
                if (hiddenRows.length === 0) return;
                
                // Переключаем видимость скрытых строк
                var isHidden = hiddenRows[0].classList.contains('hidden-rows');
                
                for (var i = 0; i < hiddenRows.length; i++) {{
                    if (isHidden) {{
                        hiddenRows[i].classList.remove('hidden-rows');
                    }} else {{
                        hiddenRows[i].classList.add('hidden-rows');
                    }}
                }}
                
                // Переключаем видимость строки с суммой
                if (isHidden) {{
                    summaryRow.classList.add('hidden-rows');
                    button.innerHTML = '🐵'; // Открытый глаз (обезьянка)
                }} else {{
                    summaryRow.classList.remove('hidden-rows');
                    button.innerHTML = '🙈'; // Закрытый глаз (обезьянка закрывающая глаза)
                }}
            }}
        </script>
    </head>
    <body>
        <h1>Отчет по деталям изделия {target_product}</h1>
        <div class="left-column">
    """
    
    # 1. Блоки для каждого раскроя
    if selected_cuttings:
        html += "<h2>Раскрои</h2>"
        
        table_id = 0
        for cutting_number, qty in selected_cuttings.items():
            table_id += 1
            current_table_id = f"table_{table_id}"
            current_button_id = f"button_{table_id}"
            
            # Рассчитываем эффективность раскроя
            useful_area = 0
            total_area = 0
            
            # Проверяем наличие дублирующихся артикулов в раскрое
            part_codes = [part['part_code'] for part in cuttings[cutting_number]]
            has_duplicates = len(part_codes) != len(set(part_codes))
            
            for part in cuttings[cutting_number]:
                part_code = part['part_code']
                quantity = part['quantity']
                area = part['area']
                
                # Общая площадь всех деталей в раскрое
                total_area += area * quantity
                
                # Если деталь нужна для изделия, считаем полезную площадь
                if part_code in parts_to_cut:
                    used_from_this_cutting = 0
                    for c, used in part_to_cutting.get(part_code, []):
                        if c == cutting_number:
                            used_from_this_cutting = used
                            break
                    
                    useful_area += area * used_from_this_cutting
            
            # Рассчитываем эффективность
            efficiency = 0
            if total_area > 0:
                efficiency = useful_area / total_area * 100
            
            # Форматируем эффективность: если 0%, то выводим с точностью до 1 знака
            efficiency_str = f"{int(efficiency)}%" if efficiency >= 1 else f"{efficiency:.1f}%".replace('.', ',')
            
            # Добавляем предупреждение о дублирующихся артикулах
            error_str = ' <span class="error">⚠️Ошибка</span>' if has_duplicates else ''
            
            html += f"""
            <h3>Раскрой {cutting_number} ({int(qty)} шт.) <span class="efficiency">эффективность {efficiency_str}{error_str}</span></h3>
            <table id="{current_table_id}">
                <tr>
            """
            
            # Получаем все детали в этом раскрое
            needed_parts = []
            extra_parts_in_cutting = []
            
            for part in cuttings[cutting_number]:
                part_code = part['part_code']
                quantity_in_cutting = part['quantity']
                
                # Определяем, нужна ли деталь и сколько
                total_needed = components.get(part_code, 0)
                stock_qty = stock.get(part_code, 0)
                
                # Если деталь нужна для изделия
                if part_code in components:
                    # Сколько нужно вырезать (с учетом склада)
                    to_cut = max(0, total_needed - stock_qty)
                    
                    # Определяем статус
                    used_from_this_cutting = 0
                    for c, used in part_to_cutting.get(part_code, []):
                        if c == cutting_number:
                            used_from_this_cutting = used
                            break
                    
                    # Формируем статус
                    status = f"нужно {int(used_from_this_cutting)}, лишние {int(quantity_in_cutting - used_from_this_cutting)}"
                    status_class = ""
                    
                    # Добавляем в список нужных деталей
                    needed_parts.append({
                        'part_code': part_code,
                        'stock_qty': stock_qty,
                        'status': status,
                        'needed': used_from_this_cutting,
                        'extra': quantity_in_cutting - used_from_this_cutting,
                        'status_class': status_class
                    })
                else:
                    # Деталь не нужна для изделия
                    status = f"нужно 0, лишние {int(quantity_in_cutting)}"
                    status_class = "status-extra"
                    
                    # Добавляем в список лишних деталей
                    extra_parts_in_cutting.append({
                        'part_code': part_code,
                        'stock_qty': stock_qty,
                        'status': status,
                        'needed': 0,
                        'extra': quantity_in_cutting,
                        'status_class': status_class
                    })
            
            # Подсчитываем суммарные значения для лишних деталей
            total_extra_parts = len(extra_parts_in_cutting)
            
            # Добавляем кнопку с глазом только если есть лишние детали
            if total_extra_parts > 0:
                html += f"""
                    <th class="col-1">Артикул <span id="{current_button_id}" class="eye-button" onclick="toggleExtraParts('{current_table_id}', '{current_button_id}')">🙈</span></th>
                """
            else:
                html += """
                    <th class="col-1">Артикул</th>
                """
            
            html += """
                    <th class="col-2">На складе</th>
                    <th class="col-3">Статус</th>
                </tr>
            """
            
            # Сначала выводим нужные детали
            for part in needed_parts:
                html += f"""
                <tr class="{part['status_class']}">
                    <td>{part['part_code']}</td>
                    <td>{int(part['stock_qty'])}</td>
                    <td>{part['status']}</td>
                </tr>
                """
            
            # Подсчитываем суммарные значения для лишних деталей
            total_stock_qty = sum(part['stock_qty'] for part in extra_parts_in_cutting)
            total_needed = sum(part['needed'] for part in extra_parts_in_cutting)
            total_extra = sum(part['extra'] for part in extra_parts_in_cutting)
            
            # Добавляем строку с суммой лишних деталей только если есть лишние детали
            if total_extra_parts > 0:
                html += f"""
                <tr class="summary-row">
                    <td>Лишних артикулов {total_extra_parts}</td>
                    <td>{int(total_stock_qty)}</td>
                    <td>нужно {int(total_needed)}, лишние {int(total_extra)}</td>
                </tr>
                """
                
                # Затем выводим лишние детали (изначально скрытые)
                for part in extra_parts_in_cutting:
                    html += f"""
                    <tr class="{part['status_class']} hidden-row hidden-rows">
                        <td>{part['part_code']}</td>
                        <td>{int(part['stock_qty'])}</td>
                        <td>{part['status']}</td>
                    </tr>
                    """
            
            html += "</table>"
        
        html += """
        </div>
        <div class="right-column">
        """
    else:
        html += """
        </div>
        <div class="right-column">
        """
    
    # 2. Блок для деталей, которые нужно купить
    parts_to_buy = {}
    for part, qty in components.items():
        if not is_cutting_part(part):  # Не раскройная деталь
            stock_qty = stock.get(part, 0)
            if stock_qty < qty:  # Нужно докупить
                parts_to_buy[part] = qty - stock_qty
    
    if parts_to_buy:
        table_id += 1
        current_table_id = f"table_{table_id}"
        current_button_id = f"button_{table_id}"
        
        html += f"""
        <h2>Нужно купить</h2>
        <table id="{current_table_id}">
            <tr>
                <th>Артикул</th>
                <th>На складе</th>
                <th>Купить</th>
            </tr>
        """
        
        for part, qty_to_buy in sorted(parts_to_buy.items()):
            stock_qty = stock.get(part, 0)
            
            html += f"""
            <tr>
                <td>{part}</td>
                <td>{int(stock_qty)}</td>
                <td>{int(qty_to_buy)}</td>
            </tr>
            """
        
        html += "</table>"
    
    # 3. Блок для деталей, которые есть на складе
    parts_in_stock = {}
    for part, qty in components.items():
        stock_qty = stock.get(part, 0)
        if stock_qty > 0:  # Есть на складе (хотя бы частично)
            parts_in_stock[part] = min(qty, stock_qty)  # Берем со склада сколько есть, но не больше чем нужно
    
    if parts_in_stock:
        table_id += 1
        current_table_id = f"table_{table_id}"
        current_button_id = f"button_{table_id}"
        
        html += f"""
        <h2>Есть на складе</h2>
        <table id="{current_table_id}">
            <tr>
                <th>Артикул</th>
                <th>На складе</th>
                <th>Берем</th>
            </tr>
        """
        
        for part, qty_used in sorted(parts_in_stock.items()):
            stock_qty = stock.get(part, 0)
            
            html += f"""
            <tr>
                <td>{part}</td>
                <td>{int(stock_qty)}</td>
                <td>{int(qty_used)}</td>
            </tr>
            """
        
        html += "</table>"
    
    html += """
        </div>
    </body>
    </html>
    """
    
    # Создаем временный файл для HTML
    fd, path = tempfile.mkstemp(suffix='.html')
    with os.fdopen(fd, 'w') as f:
        f.write(html)
    
    # Открываем HTML-файл в браузере
    webbrowser.open('file://' + path)
    
    return path

def main():
    # ID таблицы
    SHEET_ID = "1HOBicgw2MTZiuiahAejOGTUfCz_HgVYb7aDABejSHII"
    
    # Получение данных из таблицы
    print("Получение данных из таблицы...")
    schema_data = get_sheet_data(SHEET_ID, "Схема")
    cutting_data = get_sheet_data(SHEET_ID, "Раскрои")
    stock_data = get_sheet_data(SHEET_ID, "Склад")
    
    if not schema_data or not cutting_data:
        print("Не удалось получить данные из таблицы. Программа завершена.")
        return
    
    # Построение графа
    print("Построение графа изделий...")
    graph = build_graph(schema_data)
    
    # Целевое изделие
    target_product = "02.07.04.1"
    print(f"\nАнализ изделия: {target_product}")
    
    # Поиск всех компонентов
    components, operations = find_all_components(graph, target_product)
    
    # Фильтрация только раскройных деталей
    cutting_parts = {part: qty for part, qty in components.items() if is_cutting_part(part)}
    
    # Получение данных о раскроях
    cuttings = get_cutting_data(cutting_data)
    
    # Получение данных о наличии деталей на складе
    stock = get_stock_data(stock_data)
    
    if not cuttings:
        print("\nНе найдено данных о раскроях. Программа завершена.")
        return
    
    # Поиск оптимального набора раскроев
    print("\nПоиск оптимального набора раскроев...")
    selected_cuttings, extra_parts, unsatisfied, useful_area, waste_area, efficiency, parts_from_stock, parts_to_cut, useful_count, waste_count = find_optimal_cuttings(cutting_parts, cuttings, stock)
    
    # Вывод результатов
    print("\nОптимальный набор раскроев:")
    if selected_cuttings:
        for cutting, qty in selected_cuttings.items():
            # Преобразуем количество в целое число для вывода
            qty_int = int(qty)
            print(f"  Раскрой {cutting}: {qty_int} шт.")
    else:
        print("  Не найдено подходящих раскроев")
    
    print(f"\nКоличество найденных вариантов: {len(selected_cuttings)}")
    print(f"Общая эффективность: {efficiency*100:.1f}%")
    
    # Форматируем площади в миллионах с одним знаком после запятой
    useful_area_m = useful_area / 1000000
    waste_area_m = waste_area / 1000000
    print(f"Площадь полезных деталей (Y): {useful_area_m:.1f}м ({useful_count} шт.)")
    print(f"Площадь лишних деталей (N): {waste_area_m:.1f}м ({waste_count} шт.)")
    
    if unsatisfied:
        print("\nВНИМАНИЕ! Не все требуемые детали могут быть получены из доступных раскроев:")
        for part, qty in unsatisfied.items():
            # Преобразуем количество в целое число для вывода
            qty_int = int(qty)
            print(f"  {part}: не хватает {qty_int} шт.")
    
    # Создаем словарь для отслеживания, в каком раскрое будет раскраиваться каждая деталь
    part_to_cutting = {}
    
    # Заполняем словарь, проходя по выбранным раскроям и отслеживая количество деталей
    remaining_needed = Counter(parts_to_cut)  # Сколько деталей нам еще нужно вырезать
    
    # Проходим по выбранным раскроям в порядке их выбора
    for cutting_number in selected_cuttings:
        for part in cuttings[cutting_number]:
            part_code = part['part_code']
            quantity = part['quantity']
            
            if part_code in parts_to_cut and remaining_needed[part_code] > 0:
                # Определяем, сколько деталей мы берем из этого раскроя
                used = min(quantity, remaining_needed[part_code])
                remaining_needed[part_code] -= used
                
                # Добавляем информацию о раскрое
                if part_code not in part_to_cutting:
                    part_to_cutting[part_code] = []
                
                # Добавляем раскрой с указанием количества деталей
                part_to_cutting[part_code].append((cutting_number, used))

    # Выводим найденные раскройные детали с информацией о раскроях
    print("\nНайденные раскройные детали:")
    if cutting_parts:
        for part, qty in cutting_parts.items():
            # Преобразуем количество в целое число для вывода
            qty_int = int(qty)
            stock_qty = parts_from_stock.get(part, 0)
            cut_qty = parts_to_cut.get(part, 0)
            
            # Формируем строку с информацией о наличии на складе и необходимости вырезать
            stock_info = f"на складе {int(stock_qty)} шт., вырезать {int(cut_qty)} шт."
            
            if part in part_to_cutting:
                # Формируем строку с информацией о раскроях
                cutting_info = []
                for cutting, used in part_to_cutting[part]:
                    # Преобразуем количество в целое число для вывода
                    used_int = int(used)
                    cutting_info.append(f"{cutting} ({used_int} шт.)")
                
                cutting_str = ", ".join(cutting_info)
                print(f"  {part}: {stock_info} - Раскрой: {cutting_str}")
            else:
                if cut_qty > 0:
                    print(f"  {part}: {stock_info} - Раскрой: Не найден подходящий раскрой")
                else:
                    print(f"  {part}: {stock_info}")
    else:
        print("  Раскройные детали не найдены")
    
    # Создаем HTML-отчет и открываем его в браузере
    html_path = create_html_report(components, stock, part_to_cutting, parts_to_cut, cuttings, selected_cuttings, extra_parts, target_product)
    print(f"\nHTML-отчет создан и открыт в браузере: {html_path}")

if __name__ == "__main__":
    main() 