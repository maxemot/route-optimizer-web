import requests
from datetime import datetime, timedelta
import json
from collections import defaultdict
from tabulate import tabulate
import time
import csv
import os

def get_wb_report(date_from, date_to):
    """
    Получает финансовый отчет Wildberries за указанный период
    
    Args:
        date_from (str): Дата начала отчета в формате "YYYY-MM-DD"
        date_to (str): Дата окончания отчета в формате "YYYY-MM-DD"
        
    Returns:
        list: Массив данных отчета
    """
    url = "https://statistics-api.wildberries.ru/api/v5/supplier/reportDetailByPeriod"
    
    # API-ключ
    headers = {
        "Authorization": "eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwMTIwdjEiLCJ0eXAiOiJKV1QifQ.eyJlbnQiOjEsImV4cCI6MTc1NTE0Mzg4MiwiaWQiOiIwMTk0ZmFlMS1iMTI0LTc2M2EtYTI5OS00ZWFkMzBhMDBjNzciLCJpaWQiOjIyODU1MDkwLCJvaWQiOjEzNjE0MjgsInMiOjM4MzgsInNpZCI6Ijg5ZjRiNjllLTFkNDYtNDZiYS1hN2JkLWU0NjRjODczODliMyIsInQiOmZhbHNlLCJ1aWQiOjIyODU1MDkwfQ.7pX4vEgx-hfw6iywBb8V0LncnKJZFI4zEZ7meeIW2I7RNf6Ndnnuf8cokl6HMdEH7jL47ZaeOW_TWl1q4Gsr1Q"
    }
    
    params = {
        "dateFrom": date_from,
        "dateTo": date_to
    }
    
    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()  # Проверка на ошибки HTTP
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Ошибка при запросе к API: {e}")
        return []

def get_storage_report(date_from, date_to):
    """
    Получает отчет по хранению Wildberries за указанный период
    
    Args:
        date_from (str): Дата начала отчета в формате "YYYY-MM-DD"
        date_to (str): Дата окончания отчета в формате "YYYY-MM-DD"
        
    Returns:
        list: Массив данных отчета по хранению
    """
    # API-ключ
    headers = {
        "Authorization": "eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwMTIwdjEiLCJ0eXAiOiJKV1QifQ.eyJlbnQiOjEsImV4cCI6MTc1NTE0Mzg4MiwiaWQiOiIwMTk0ZmFlMS1iMTI0LTc2M2EtYTI5OS00ZWFkMzBhMDBjNzciLCJpaWQiOjIyODU1MDkwLCJvaWQiOjEzNjE0MjgsInMiOjM4MzgsInNpZCI6Ijg5ZjRiNjllLTFkNDYtNDZiYS1hN2JkLWU0NjRjODczODliMyIsInQiOmZhbHNlLCJ1aWQiOjIyODU1MDkwfQ.7pX4vEgx-hfw6iywBb8V0LncnKJZFI4zEZ7meeIW2I7RNf6Ndnnuf8cokl6HMdEH7jL47ZaeOW_TWl1q4Gsr1Q"
    }
    
    # Шаг 1: Запрашиваем генерацию отчета
    request_url = "https://seller-analytics-api.wildberries.ru/api/v1/paid_storage"
    params = {
        "dateFrom": date_from,
        "dateTo": date_to
    }
    
    try:
        print("Запрашиваем генерацию отчета по хранению...")
        response = requests.get(request_url, headers=headers, params=params)
        response.raise_for_status()
        task_data = response.json()
        
        task_id = task_data.get('data', {}).get('taskId')
        
        if not task_id:
            print("Не удалось получить ID задания для отчета по хранению.")
            return []
        
        print(f"Получен ID задания: {task_id}")
        
        # Шаг 2: Проверяем статус отчета
        status_url = f"https://seller-analytics-api.wildberries.ru/api/v1/paid_storage/tasks/{task_id}/status"
        status = ""
        
        print("Ожидаем формирование отчета...")
        while status != "done":
            time.sleep(1)
            status_response = requests.get(status_url, headers=headers)
            status_response.raise_for_status()
            status_data = status_response.json()
            status = status_data.get('data', {}).get('status', '')
            
            if status == "error":
                print("Ошибка при формировании отчета.")
                return []
        
        # Шаг 3: Скачиваем отчет
        download_url = f"https://seller-analytics-api.wildberries.ru/api/v1/paid_storage/tasks/{task_id}/download"
        download_response = requests.get(download_url, headers=headers)
        download_response.raise_for_status()
        
        download_data = download_response.json()
        
        if 'data' in download_data:
            storage_report = download_data['data']
        else:
            storage_report = download_data
        
        print(f"Получено записей в отчете по хранению: {len(storage_report) if isinstance(storage_report, list) else 'Неизвестно'}")
        
        return storage_report
        
    except requests.exceptions.RequestException as e:
        print(f"Ошибка при запросе к API хранения: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Статус ошибки: {e.response.status_code}")
        return []

def analyze_report_detailed(report_data, storage_data=None):
    """
    Анализирует отчет и суммирует различные показатели по группам брендов
    
    Args:
        report_data (list): Данные отчета
        storage_data (list, optional): Данные отчета по хранению
        
    Returns:
        dict: Суммы различных показателей по группам брендов
    """
    brand_groups = {
        "CF": ["Crazy Ferma"],
        "TT+SH": ["Trend Tribe", "Smarty House"],
        "Пусто": [""]
    }
    
    # Создаем структуру для хранения всех показателей
    metrics = [
        "ppvz_for_pay",    # К перечислению
        "delivery_rub",    # Доставка
        "penalty",         # Штрафы
        "storage_fee",     # Хранение
        "deduction",       # Удержания
        "acceptance"       # Приемка
    ]
    
    # Инициализируем словарь для хранения результатов
    results = {}
    for group in list(brand_groups.keys()) + ["Другие бренды"]:
        results[group] = {metric: 0.0 for metric in metrics}
    
    # Анализируем основной отчет
    for item in report_data:
        brand_name = item.get("brand_name", "")
        doc_type = item.get("doc_type_name", "")
        
        # Определяем, к какой группе относится бренд
        group_found = False
        group_name = None
        
        for g_name, brands in brand_groups.items():
            if brand_name in brands:
                group_name = g_name
                group_found = True
                break
        
        if not group_found:
            group_name = "Другие бренды"
        
        # Обрабатываем все метрики
        for metric in metrics:
            value = float(item.get(metric, 0))
            
            # Для перечислений учитываем тип документа
            if metric == "ppvz_for_pay" and doc_type == "Возврат":
                results[group_name][metric] -= value
            else:
                results[group_name][metric] += value
    
    # Сохраняем общую сумму хранения из основного отчета
    total_storage_fee_main = sum(results[group]["storage_fee"] for group in results)
    
    # Если есть данные по хранению, обновляем значения хранения
    if storage_data:
        # Сбрасываем значения хранения
        for group in results:
            results[group]["storage_fee"] = 0.0
        
        # Анализируем отчет по хранению
        for item in storage_data:
            # Проверяем разные возможные ключи для бренда
            brand_name = item.get("brand", item.get("brandName", item.get("brand_name", "")))
            # Проверяем разные возможные ключи для цены хранения
            storage_price = float(item.get("warehousePrice", item.get("warehouse_price", item.get("storagePrice", item.get("storage_price", 0)))))
            
            # Определяем, к какой группе относится бренд
            group_found = False
            group_name = None
            
            for g_name, brands in brand_groups.items():
                if brand_name in brands:
                    group_name = g_name
                    group_found = True
                    break
            
            if not group_found:
                group_name = "Другие бренды"
            
            # Добавляем сумму хранения
            results[group_name]["storage_fee"] += storage_price
    
    # Сохраняем общую сумму хранения из отчета по хранению
    total_storage_fee_storage = sum(results[group]["storage_fee"] for group in results) if storage_data else 0
    
    return results, total_storage_fee_main, total_storage_fee_storage

def format_number(value):
    """
    Форматирует число для красивого отображения в таблице
    
    Args:
        value (float): Число для форматирования
        
    Returns:
        str: Отформатированное число (только целая часть)
    """
    # Округляем до целого числа
    value_int = int(round(value))
    
    # Форматируем с разделителями тысяч
    if abs(value_int) < 1000:
        return str(value_int)
    else:
        return f"{value_int:,}".replace(",", " ")

def get_week_range(start_date, end_date):
    """
    Разбивает диапазон дат на недели (понедельник-воскресенье)
    
    Args:
        start_date (datetime): Начальная дата
        end_date (datetime): Конечная дата
        
    Returns:
        list: Список кортежей (начало_недели, конец_недели)
    """
    weeks = []
    current_date = start_date
    
    while current_date <= end_date:
        # Находим понедельник текущей недели
        monday = current_date - timedelta(days=current_date.weekday())
        # Находим воскресенье текущей недели
        sunday = monday + timedelta(days=6)
        
        # Ограничиваем конец недели конечной датой
        week_end = min(sunday, end_date)
        
        weeks.append((monday, week_end))
        
        # Переходим к следующей неделе
        current_date = sunday + timedelta(days=1)
    
    return weeks

def is_period_longer_than_week(date_from, date_to):
    """
    Проверяет, длиннее ли период одной недели
    
    Args:
        date_from (str): Дата начала в формате "YYYY-MM-DD"
        date_to (str): Дата окончания в формате "YYYY-MM-DD"
        
    Returns:
        bool: True если период длиннее недели
    """
    start_date = datetime.strptime(date_from, "%Y-%m-%d")
    end_date = datetime.strptime(date_to, "%Y-%m-%d")
    
    return (end_date - start_date).days > 7

def analyze_report_for_csv(report_data, storage_data=None):
    """
    Анализирует отчет для создания CSV (объединяет "Пусто" с "CF")
    
    Args:
        report_data (list): Данные отчета
        storage_data (list, optional): Данные отчета по хранению
        
    Returns:
        dict: Суммы показателей для CF и TT+SH
    """
    brand_groups = {
        "CF": ["Crazy Ferma", ""],  # Добавляем пустые бренды к CF
        "TT+SH": ["Trend Tribe", "Smarty House"]
    }
    
    # Создаем структуру для хранения показателей (без приемки)
    metrics = [
        "ppvz_for_pay",    # К перечислению
        "delivery_rub",    # Логистика
        "penalty",         # Штрафы
        "storage_fee",     # Хранение
        "deduction"        # Удержания
    ]
    
    # Инициализируем словарь для хранения результатов
    results = {}
    for group in brand_groups.keys():
        results[group] = {metric: 0.0 for metric in metrics}
    
    # Анализируем основной отчет
    for item in report_data:
        brand_name = item.get("brand_name", "")
        doc_type = item.get("doc_type_name", "")
        
        # Определяем, к какой группе относится бренд
        group_name = None
        for g_name, brands in brand_groups.items():
            if brand_name in brands:
                group_name = g_name
                break
        
        if group_name:  # Игнорируем неизвестные бренды
            # Обрабатываем все метрики
            for metric in metrics:
                value = float(item.get(metric, 0))
                
                # Для перечислений учитываем тип документа
                if metric == "ppvz_for_pay" and doc_type == "Возврат":
                    results[group_name][metric] -= value
                else:
                    results[group_name][metric] += value
    
    # Сохраняем исходные данные хранения из основного отчета
    total_storage_from_main = results["CF"]["storage_fee"] + results["TT+SH"]["storage_fee"]
    
    # Если есть данные по хранению, обновляем значения хранения
    if storage_data:
        # Сбрасываем значения хранения
        for group in results:
            results[group]["storage_fee"] = 0.0
        
        # Анализируем отчет по хранению
        for item in storage_data:
            brand_name = item.get("brand", item.get("brandName", item.get("brand_name", "")))
            storage_price = float(item.get("warehousePrice", item.get("warehouse_price", item.get("storagePrice", item.get("storage_price", 0)))))
            
            # Определяем, к какой группе относится бренд
            group_name = None
            for g_name, brands in brand_groups.items():
                if brand_name in brands:
                    group_name = g_name
                    break
            
            if group_name:  # Игнорируем неизвестные бренды
                results[group_name]["storage_fee"] += storage_price
    else:
        # Если нет данных paid_storage, распределяем хранение пропорционально К_перечислению
        total_revenue = results["CF"]["ppvz_for_pay"] + results["TT+SH"]["ppvz_for_pay"]
        
        if total_revenue > 0 and total_storage_from_main > 0:
            # Рассчитываем пропорции на основе К_перечислению
            cf_ratio = results["CF"]["ppvz_for_pay"] / total_revenue
            ttsh_ratio = results["TT+SH"]["ppvz_for_pay"] / total_revenue
            
            # Перераспределяем хранение пропорционально
            results["CF"]["storage_fee"] = total_storage_from_main * cf_ratio
            results["TT+SH"]["storage_fee"] = total_storage_from_main * ttsh_ratio
            
            print(f"  Данные хранения перераспределены пропорционально: CF={int(results['CF']['storage_fee'])}, TT+SH={int(results['TT+SH']['storage_fee'])}")
        else:
            # Если нет К_перечислению для расчета пропорций, делим примерно 50/50
            results["CF"]["storage_fee"] = total_storage_from_main * 0.5
            results["TT+SH"]["storage_fee"] = total_storage_from_main * 0.5
            print(f"  Данные хранения распределены поровну: CF={int(results['CF']['storage_fee'])}, TT+SH={int(results['TT+SH']['storage_fee'])}")
    
    return results

def create_weekly_csv(date_from, date_to):
    """
    Создает CSV файл с недельными данными
    
    Args:
        date_from (str): Дата начала отчета в формате "YYYY-MM-DD"
        date_to (str): Дата окончания отчета в формате "YYYY-MM-DD"
    """
    start_date = datetime.strptime(date_from, "%Y-%m-%d")
    end_date = datetime.strptime(date_to, "%Y-%m-%d")
    
    # Получаем недели для расчета времени
    weeks = get_week_range(start_date, end_date)
    estimated_time_minutes = len(weeks)  # Примерно 1 минута на неделю
    
    print(f"📊 Создание недельного CSV отчета:")
    print(f"   Период: {date_from} - {date_to}")
    print(f"   Недель: {len(weeks)}")
    print(f"   ⏱️  Примерное время: ~{estimated_time_minutes} минут")
    print(f"   (API лимит: 1 запрос хранения в минуту)")
    print()
    
    print("Получение данных за весь период...")
    
    # Получаем основной отчет за весь период одним запросом
    print("Запрашиваем основной отчет за весь период...")
    all_report_data = get_wb_report(date_from, date_to)
    
    if not all_report_data:
        print("Не удалось получить данные основного отчета.")
        return
    
    print(f"Получено {len(all_report_data)} записей в основном отчете.")
    
    # Получаем недели
    weeks = get_week_range(start_date, end_date)
    
    # Подготавливаем данные для CSV
    csv_data = []
    
    print(f"\nОбрабатываем {len(weeks)} недель...")
    
    for i, (week_start, week_end) in enumerate(weeks):
        week_from = week_start.strftime("%Y-%m-%d")
        week_to = week_end.strftime("%Y-%m-%d")
        
        print(f"Обработка недели {i+1}/{len(weeks)}: с {week_from} по {week_to}...")
        
        # Добавляем паузу между запросами хранения (кроме первого)
        if i > 0:
            print("  Пауза 65 сек (лимит API: 1 запрос в минуту)...")
            time.sleep(65)  # API лимит: 1 запрос в минуту
        
        # Фильтруем данные основного отчета для текущей недели
        week_report_data = []
        for item in all_report_data:
            # Извлекаем дату из записи (может быть в разных полях)
            record_date_str = item.get("date", item.get("rr_dt", item.get("rrd_id", "")))
            if record_date_str:
                try:
                    # Обрабатываем разные форматы даты
                    if "T" in record_date_str:
                        record_date = datetime.strptime(record_date_str.split("T")[0], "%Y-%m-%d")
                    else:
                        record_date = datetime.strptime(record_date_str, "%Y-%m-%d")
                    
                    # Проверяем, попадает ли дата в текущую неделю
                    if week_start <= record_date <= week_end:
                        week_report_data.append(item)
                except (ValueError, TypeError):
                    continue
        
        # Получаем данные хранения для текущей недели отдельным запросом
        print(f"  Запрашиваем данные хранения за неделю...")
        week_storage_data = get_storage_report(week_from, week_to)
        
        print(f"  Найдено записей: основной отчет={len(week_report_data)}, хранение={len(week_storage_data) if week_storage_data else 0}")
        
        if not week_report_data:
            print(f"  Нет данных за неделю {week_from} - {week_to}")
            # Добавляем пустую строку для недели без данных
            row = {
                'Неделя': f"{week_from} - {week_to}",
                'CF_К_перечислению': 0, 'CF_Логистика': 0, 'CF_Штрафы': 0, 'CF_Хранение': 0, 'CF_Удержания': 0,
                'TT+SH_К_перечислению': 0, 'TT+SH_Логистика': 0, 'TT+SH_Штрафы': 0, 'TT+SH_Хранение': 0, 'TT+SH_Удержания': 0
            }
            csv_data.append(row)
            continue
        
        # Анализируем данные недели
        week_results = analyze_report_for_csv(week_report_data, week_storage_data)
        
        # Показываем результаты хранения для первых недель
        if i < 3:
            storage_info = "пропорционально" if not week_storage_data else f"из API: {len(week_storage_data)} записей"
            print(f"  Результат хранения ({storage_info}): CF={int(week_results['CF']['storage_fee'])}, TT+SH={int(week_results['TT+SH']['storage_fee'])}")
        
        # Формируем строку CSV
        row = {
            'Неделя': f"{week_from} - {week_to}",
            'CF_К_перечислению': int(round(week_results['CF']['ppvz_for_pay'])),
            'CF_Логистика': int(round(week_results['CF']['delivery_rub'])),
            'CF_Штрафы': int(round(week_results['CF']['penalty'])),
            'CF_Хранение': int(round(week_results['CF']['storage_fee'])),
            'CF_Удержания': int(round(week_results['CF']['deduction'])),
            'TT+SH_К_перечислению': int(round(week_results['TT+SH']['ppvz_for_pay'])),
            'TT+SH_Логистика': int(round(week_results['TT+SH']['delivery_rub'])),
            'TT+SH_Штрафы': int(round(week_results['TT+SH']['penalty'])),
            'TT+SH_Хранение': int(round(week_results['TT+SH']['storage_fee'])),
            'TT+SH_Удержания': int(round(week_results['TT+SH']['deduction']))
        }
        
        csv_data.append(row)
    
    # Создаем CSV файл в папке Documents
    documents_path = os.path.expanduser("~/Documents")
    csv_filename = f"wb_weekly_report_{date_from}_to_{date_to}.csv"
    csv_filepath = os.path.join(documents_path, csv_filename)
    
    # Записываем CSV
    if csv_data:
        fieldnames = ['Неделя', 'CF_К_перечислению', 'CF_Логистика', 'CF_Штрафы', 'CF_Хранение', 'CF_Удержания',
                     'TT+SH_К_перечислению', 'TT+SH_Логистика', 'TT+SH_Штрафы', 'TT+SH_Хранение', 'TT+SH_Удержания']
        
        with open(csv_filepath, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(csv_data)
        
        print(f"\nCSV файл создан: {csv_filepath}")
        print(f"Обработано недель: {len(csv_data)}")
        
        # Выводим содержимое CSV для проверки
        print("\nСодержимое CSV файла:")
        for row in csv_data:
            print(f"  {row['Неделя']}: CF К_перечислению={row['CF_К_перечислению']}, TT+SH К_перечислению={row['TT+SH_К_перечислению']}")
    else:
        print("Нет данных для создания CSV файла")

def main():
    # Даты для отчета
    date_from = "2025-05-26"
    date_to = "2025-07-20"
    
    print(f"Получение финансового отчета Wildberries за период с {date_from} по {date_to}...")
    
    # Проверяем, длиннее ли период одной недели
    if is_period_longer_than_week(date_from, date_to):
        print("Период длиннее недели - создаем CSV файл с недельной разбивкой...")
        create_weekly_csv(date_from, date_to)
        return
    
    # Обычная обработка для периодов до недели
    # Получаем данные основного отчета
    report_data = get_wb_report(date_from, date_to)
    
    if not report_data:
        print("Не удалось получить данные основного отчета.")
        return
    
    print(f"Получено {len(report_data)} записей в основном отчете.")
    
    # Получаем данные отчета по хранению
    storage_data = get_storage_report(date_from, date_to)
    
    if not storage_data:
        print("Не удалось получить данные отчета по хранению.")
        storage_data = None
    else:
        print(f"Получено {len(storage_data)} записей в отчете по хранению.")
    
    # Анализируем отчеты
    results, total_storage_fee_main, total_storage_fee_storage = analyze_report_detailed(report_data, storage_data)
    
    # Подготавливаем данные для таблицы
    headers = [
        "Группа", 
        "К перечислению", 
        "Доставка", 
        "Штрафы", 
        "Хранение", 
        "Удержания", 
        "Приемка"
    ]
    
    # Определяем порядок вывода групп
    group_order = ["CF", "TT+SH", "Пусто", "Другие бренды"]
    
    # Формируем строки таблицы
    table_data = []
    totals = {metric: 0.0 for metric in ["ppvz_for_pay", "delivery_rub", "penalty", "storage_fee", "deduction", "acceptance"]}
    
    for group in group_order:
        if group in results:
            row = [
                group,
                format_number(results[group]['ppvz_for_pay']),
                format_number(results[group]['delivery_rub']),
                format_number(results[group]['penalty']),
                format_number(results[group]['storage_fee']),
                format_number(results[group]['deduction']),
                format_number(results[group]['acceptance'])
            ]
            table_data.append(row)
            
            # Суммируем для итоговой строки
            for metric in totals.keys():
                totals[metric] += results[group][metric]
    
    # Добавляем итоговую строку
    total_row = [
        "ИТОГО",
        format_number(totals['ppvz_for_pay']),
        format_number(totals['delivery_rub']),
        format_number(totals['penalty']),
        format_number(totals['storage_fee']),
        format_number(totals['deduction']),
        format_number(totals['acceptance'])
    ]
    table_data.append(total_row)
    
    # Выводим таблицу
    print("\nФинансовый отчет по группам брендов:")
    print(tabulate(table_data, headers=headers, tablefmt="pretty"))
    
    # Проверяем совпадение сумм хранения
    print("\nСравнение сумм хранения:")
    print(f"В reportDetailByPeriod хранение = {format_number(total_storage_fee_main)}")
    print(f"В paid_storage хранение = {format_number(total_storage_fee_storage)}")
    
    if abs(total_storage_fee_main - total_storage_fee_storage) < 1:
        print("Суммы совпадают")
    else:
        print("Суммы не совпадают")
    
    # Сохраняем отчет в файл
    with open(f"wb_report_{date_from}_to_{date_to}.txt", "w", encoding="utf-8") as f:
        f.write(f"Финансовый отчет Wildberries за период с {date_from} по {date_to}\n\n")
        f.write(tabulate(table_data, headers=headers, tablefmt="pretty"))
        f.write("\n\nСравнение сумм хранения:\n")
        f.write(f"В reportDetailByPeriod хранение = {format_number(total_storage_fee_main)}\n")
        f.write(f"В paid_storage хранение = {format_number(total_storage_fee_storage)}\n")
        
        if abs(total_storage_fee_main - total_storage_fee_storage) < 1:
            f.write("Суммы совпадают\n")
        else:
            f.write("Суммы не совпадают\n")

if __name__ == "__main__":
    main() 