import requests
import json
import time
import csv
import os
from datetime import datetime, timedelta

# API-ключ
API_KEY = "eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwMTIwdjEiLCJ0eXAiOiJKV1QifQ.eyJlbnQiOjEsImV4cCI6MTc1NTE0Mzg4MiwiaWQiOiIwMTk0ZmFlMS1iMTI0LTc2M2EtYTI5OS00ZWFkMzBhMDBjNzciLCJpaWQiOjIyODU1MDkwLCJvaWQiOjEzNjE0MjgsInMiOjM4MzgsInNpZCI6Ijg5ZjRiNjllLTFkNDYtNDZiYS1hN2JkLWU0NjRjODczODliMyIsInQiOmZhbHNlLCJ1aWQiOjIyODU1MDkwfQ.7pX4vEgx-hfw6iywBb8V0LncnKJZFI4zEZ7meeIW2I7RNf6Ndnnuf8cokl6HMdEH7jL47ZaeOW_TWl1q4Gsr1Q"

# Заголовки для запросов
HEADERS = {
    "Authorization": API_KEY,
    "Content-Type": "application/json"
}

# Даты для отчета в формате YYYY-MM-DD
START_DATE = "2024-03-17"  # Изменил на больший период
END_DATE = "2024-05-04"    # Изменил на больший период

# Категории товаров для анализа
CATEGORIES = [
    {"name": "Брудеры", "subjectIds": [5555], "tagIds": []},
    {"name": "Кормушки и поилки", "subjectIds": [1121, 3235], "tagIds": []},
    {"name": "Гранулятор", "subjectIds": [8510], "tagIds": []},
    {"name": "Перосьемка (+шпарчан)", "subjectIds": [], "tagIds": [1263558]},
    {"name": "Курятники и клетки для птиц", "subjectIds": [], "tagIds": [1248702, 1248701]},
    {"name": "Контейнеры", "subjectIds": [3863], "tagIds": []},
    {"name": "Инкубаторы", "subjectIds": [5256], "tagIds": []},
    {"name": "Клетки для животных/кроликов", "subjectIds": [], "tagIds": [1248701]},
    {"name": "Будки для собак", "subjectIds": [], "tagIds": []},
    {"name": "Печь", "subjectIds": [589], "tagIds": []},
    {"name": "Гнездо", "subjectIds": [], "tagIds": [1263409]}
]

def get_monday_of_week(date):
    """Получает понедельник недели для заданной даты"""
    days_since_monday = date.weekday()
    monday = date - timedelta(days=days_since_monday)
    return monday

def get_friday_of_week(date):
    """Получает пятницу недели для заданной даты"""
    monday = get_monday_of_week(date)
    friday = monday + timedelta(days=4)
    return friday

def get_weekly_periods(start_date, end_date):
    """Разбивает интервал на недельные периоды (понедельник-пятница)"""
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    
    periods = []
    current_monday = get_monday_of_week(start)
    
    while current_monday <= end:
        week_start = max(current_monday, start)
        week_end = min(get_friday_of_week(current_monday), end)
        
        periods.append({
            'start': week_start.strftime("%Y-%m-%d"),
            'end': week_end.strftime("%Y-%m-%d"),
            'start_display': week_start.strftime("%d.%m"),
            'end_display': week_end.strftime("%d.%m")
        })
        
        current_monday += timedelta(days=7)
    
    return periods

def get_sales_by_subject(subject_id, start_date, end_date):
    """
    Получает статистику продаж по предмету (категории)
    
    Args:
        subject_id (int): ID предмета
        start_date (str): Начальная дата в формате YYYY-MM-DD
        end_date (str): Конечная дата в формате YYYY-MM-DD
        
    Returns:
        float: Сумма продаж
    """
    # Используем формат RFC3339 как требует документация
    date_from_rfc3339 = f"{start_date}T00:00:00"
    
    url = "https://statistics-api.wildberries.ru/api/v1/supplier/sales"
    
    params = {
        "dateFrom": date_from_rfc3339,
        "flag": 1,  # Получаем все данные за период
        "subjectId": subject_id
    }
    
    try:
        print(f"Запрашиваем статистику продаж для предмета ID={subject_id}...")
        
        # Добавляем задержку между запросами
        time.sleep(1)
        
        response = requests.get(url, headers=HEADERS, params=params)
        
        # Выводим информацию о запросе для отладки
        print(f"URL запроса: {response.url}")
        print(f"Статус ответа: {response.status_code}")
        
        response.raise_for_status()
        data = response.json()
        
        # Выводим пример ответа для отладки
        print(f"Пример ответа: {json.dumps(data[:2] if data else [], indent=2, ensure_ascii=False)}")
        
        # Фильтруем данные по дате окончания и суммируем продажи
        end_date_obj = datetime.strptime(end_date, "%Y-%m-%d")
        total_sum = 0
        
        for item in data:
            # Проверяем дату продажи
            sale_date_str = item.get("date", "")
            if sale_date_str:
                try:
                    sale_date = datetime.strptime(sale_date_str[:10], "%Y-%m-%d")
                    if sale_date <= end_date_obj:
                        total_sum += item.get("finishedPrice", 0)
                except ValueError:
                    # Если не удается распарсить дату, все равно считаем
                    total_sum += item.get("finishedPrice", 0)
            else:
                total_sum += item.get("finishedPrice", 0)
        
        return total_sum
        
    except requests.exceptions.RequestException as e:
        print(f"Ошибка при запросе к API: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Статус ошибки: {e.response.status_code}")
            print(f"Текст ошибки: {e.response.text}")
        return 0

def get_sales_by_tag(tag_id, start_date, end_date):
    """
    Получает статистику продаж по тегу
    
    Args:
        tag_id (int): ID тега
        start_date (str): Начальная дата в формате YYYY-MM-DD
        end_date (str): Конечная дата в формате YYYY-MM-DD
        
    Returns:
        float: Сумма продаж
    """
    # Используем формат RFC3339 как требует документация
    date_from_rfc3339 = f"{start_date}T00:00:00"
    
    url = "https://statistics-api.wildberries.ru/api/v1/supplier/sales"
    
    params = {
        "dateFrom": date_from_rfc3339,
        "flag": 1,  # Получаем все данные за период
        "tagIds": tag_id
    }
    
    try:
        print(f"Запрашиваем статистику продаж для тега ID={tag_id}...")
        
        # Добавляем задержку между запросами
        time.sleep(1)
        
        response = requests.get(url, headers=HEADERS, params=params)
        
        # Выводим информацию о запросе для отладки
        print(f"URL запроса: {response.url}")
        print(f"Статус ответа: {response.status_code}")
        
        response.raise_for_status()
        data = response.json()
        
        # Выводим пример ответа для отладки
        print(f"Пример ответа: {json.dumps(data[:2] if data else [], indent=2, ensure_ascii=False)}")
        
        # Фильтруем данные по дате окончания и суммируем продажи
        end_date_obj = datetime.strptime(end_date, "%Y-%m-%d")
        total_sum = 0
        
        for item in data:
            # Проверяем дату продажи
            sale_date_str = item.get("date", "")
            if sale_date_str:
                try:
                    sale_date = datetime.strptime(sale_date_str[:10], "%Y-%m-%d")
                    if sale_date <= end_date_obj:
                        total_sum += item.get("finishedPrice", 0)
                except ValueError:
                    # Если не удается распарсить дату, все равно считаем
                    total_sum += item.get("finishedPrice", 0)
            else:
                total_sum += item.get("finishedPrice", 0)
        
        return total_sum
        
    except requests.exceptions.RequestException as e:
        print(f"Ошибка при запросе к API: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Статус ошибки: {e.response.status_code}")
            print(f"Текст ошибки: {e.response.text}")
        return 0

def get_category_sales(category, start_date, end_date):
    """Получает общие продажи по категории за период"""
    total_sum = 0
    
    # Получаем статистику по предметам
    for subject_id in category["subjectIds"]:
        subject_sum = get_sales_by_subject(subject_id, start_date, end_date)
        total_sum += subject_sum
    
    # Получаем статистику по тегам
    for tag_id in category["tagIds"]:
        tag_sum = get_sales_by_tag(tag_id, start_date, end_date)
        total_sum += tag_sum
    
    return total_sum

def create_csv_report(periods, category_data):
    """Создает CSV файл с отчетом"""
    # Путь к папке Documents
    documents_path = os.path.expanduser("~/Documents")
    csv_filename = f"wb_sales_report_{START_DATE}_to_{END_DATE}.csv"
    csv_path = os.path.join(documents_path, csv_filename)
    
    with open(csv_path, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        
        # Создаем заголовки
        headers = ['']
        for period in periods:
            headers.extend([period['start_display'], ''])
        
        # Строка с началом периода
        start_row = ['Начало периода']
        for period in periods:
            start_row.extend([period['start_display'], ''])
        
        # Строка с концом периода
        end_row = ['Конец периода']
        for period in periods:
            end_row.extend([period['end_display'], ''])
        
        # Строка с предметами
        subject_row = ['Предмет']
        for _ in periods:
            subject_row.extend(['Ozon', 'WB'])
        
        # Записываем заголовки
        writer.writerow(headers)
        writer.writerow(start_row)
        writer.writerow(end_row)
        writer.writerow(subject_row)
        
        # Записываем данные по категориям
        for category_name, weekly_data in category_data.items():
            row = [category_name]
            for period_idx in range(len(periods)):
                row.extend(['', f"р.{weekly_data[period_idx]:.0f}"])  # Ozon пустой, WB с данными
            writer.writerow(row)
        
        # Строка с суммой
        sum_row = ['Сумма']
        for period_idx in range(len(periods)):
            period_total = sum(data[period_idx] for data in category_data.values())
            sum_row.extend(['', f"р.{period_total:.0f}"])
        writer.writerow(sum_row)
    
    print(f"CSV файл сохранен: {csv_path}")
    return csv_path

def is_long_period(start_date, end_date):
    """Проверяет, больше ли период недели"""
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    return (end - start).days > 7

def main():
    print(f"Анализ продаж Wildberries за период с {START_DATE} по {END_DATE}\n")
    
    # Проверяем, больше ли период недели
    if is_long_period(START_DATE, END_DATE):
        print("Период больше недели. Создается CSV отчет с разбивкой по неделям...\n")
        
        # Получаем недельные периоды
        periods = get_weekly_periods(START_DATE, END_DATE)
        
        print("Недельные периоды:")
        for i, period in enumerate(periods, 1):
            print(f"Неделя {i}: {period['start']} - {period['end']} ({period['start_display']} - {period['end_display']})")
        print()
        
        # Собираем данные по категориям и неделям
        category_data = {}
    
    for category in CATEGORIES:
        print(f"\n{'=' * 60}")
        print(f"Обработка категории: {category['name']}")
        print(f"{'=' * 60}")
        
            weekly_sales = []
            
            for period in periods:
                print(f"\nПериод {period['start_display']} - {period['end_display']}:")
                
                period_sum = get_category_sales(category, period['start'], period['end'])
                weekly_sales.append(period_sum)
                
                print(f"Сумма продаж: {period_sum:.2f} ₽")
            
            category_data[category['name']] = weekly_sales
            
            total_category_sum = sum(weekly_sales)
            print(f"Общая сумма для категории '{category['name']}': {total_category_sum:.2f} ₽")
        
        # Создаем CSV файл
        csv_path = create_csv_report(periods, category_data)
        
        # Выводим итоговую таблицу
        print("\n\n")
        print(f"{'=' * 80}")
        print(f"ИТОГОВЫЕ РЕЗУЛЬТАТЫ ПО НЕДЕЛЯМ")
        print(f"{'=' * 80}")
        
        # Заголовок таблицы
        header = f"{'Категория':<30}"
        for period in periods:
            header += f" | {period['start_display']}-{period['end_display']:<8}"
        header += f" | {'Итого':<10}"
        print(header)
        print("-" * len(header))
        
        # Данные по категориям
        grand_totals = [0] * len(periods)
        grand_total = 0
        
        for category_name, weekly_data in category_data.items():
            row = f"{category_name:<30}"
            category_total = 0
            
            for i, amount in enumerate(weekly_data):
                row += f" | {amount:>10.0f}"
                grand_totals[i] += amount
                category_total += amount
            
            row += f" | {category_total:>10.0f}"
            grand_total += category_total
            print(row)
        
        # Итоговая строка
        print("-" * len(header))
        total_row = f"{'ИТОГО:':<30}"
        for total in grand_totals:
            total_row += f" | {total:>10.0f}"
        total_row += f" | {grand_total:>10.0f}"
        print(total_row)
        print(f"{'=' * 80}")
        
    else:
        # Стандартная обработка для коротких периодов
        results = []
        
        for category in CATEGORIES:
            print(f"\n{'=' * 60}")
            print(f"Обработка категории: {category['name']}")
            print(f"{'=' * 60}")
            
            total_sum = get_category_sales(category, START_DATE, END_DATE)
        print(f"Общая сумма продаж для категории '{category['name']}': {total_sum:.2f} ₽")
        
        results.append((category['name'], total_sum))
    
    # Выводим итоговую таблицу результатов
    print("\n\n")
    print(f"{'=' * 60}")
    print(f"ИТОГОВЫЕ РЕЗУЛЬТАТЫ")
    print(f"{'=' * 60}")
    print(f"{'Категория':<30} | {'Сумма продаж, ₽'}")
    print(f"{'-' * 60}")
    
    grand_total = 0
    for name, total in results:
        print(f"{name:<30} | {total:.2f}")
        grand_total += total
    
    print(f"{'-' * 60}")
    print(f"{'ИТОГО:':<30} | {grand_total:.2f}")
    print(f"{'=' * 60}")

if __name__ == "__main__":
    main() 