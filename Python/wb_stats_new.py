import requests
import json
import time
import csv
import os
from datetime import datetime, timedelta

# API-ключ из wb_orders_direct.py
API_KEY = "eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwNTIwdjEiLCJ0eXAiOiJKV1QifQ.eyJlbnQiOjEsImV4cCI6MTc2NDg2ODI1OSwiaWQiOiIwMTk3M2U3Zi1lOTU2LTcxYzUtYTY5Yi0wNjYxNzhhYTU0NWEiLCJpaWQiOjQ1MTA3NTA0LCJvaWQiOjEzNjE0MjgsInMiOjc5MzQsInNpZCI6Ijg5ZjRiNjllLTFkNDYtNDZiYS1hN2JkLWU0NjRjODczODliMyIsInQiOmZhbHNlLCJ1aWQiOjQ1MTA3NTA0fQ.Pj11Q4IhKPMU-ZSvgoyDU_X0a8Eh20GdRhRSAaeB6fisASnRzkVb_oD7iK5oZ-ldu7K7NzkolxR8zBFrgPtREg"

# Заголовки для запросов
HEADERS = {
    "Authorization": API_KEY,
    "Content-Type": "application/json"
}

# Даты для отчета
START_DATE = "2025-06-16"
END_DATE = "2025-07-20"

# Категории товаров для анализа с соответствующими названиями предметов
CATEGORIES = [
    {"name": "Брудеры", "object_names": ["Брудеры"]},
    {"name": "Кормушки и поилки", "object_names": ["Кормушки для животных", "Поилки для животных"]},
    {"name": "Гранулятор", "object_names": ["Грануляторы для комбикорма"]},
    {"name": "Перосьемка (+шпарчан)", "object_names": ["Перосъемные машины"]},
    {"name": "Курятники и клетки для птиц", "object_names": ["Клетки для птиц", "Курятники"]},
    {"name": "Контейнеры", "object_names": ["Контейнеры"]},
    {"name": "Инкубаторы", "object_names": ["Инкубаторы"]},
    {"name": "Клетки для животных/кроликов", "object_names": ["Клетки для животных"]},
    {"name": "Будки для собак", "object_names": ["Будки для собак"]},
    {"name": "Печь", "object_names": ["Печи туристические"]},
    {"name": "Гнездо", "object_names": ["Гнезда для птиц"]}
]

def get_weekly_periods(start_date, end_date):
    """Разбивает интервал на недельные периоды (понедельник-воскресенье)"""
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    
    periods = []
    
    # Находим первый понедельник
    current_monday = start
    while current_monday.weekday() != 0:  # 0 = понедельник
        current_monday -= timedelta(days=1)
    
    while current_monday <= end:
        week_start = max(current_monday, start)
        week_end = min(current_monday + timedelta(days=6), end)  # воскресенье
        
        periods.append({
            'start': week_start.strftime("%Y-%m-%d %H:%M:%S").replace(" 00:00:00", " 00:00:00"),
            'end': week_end.strftime("%Y-%m-%d %H:%M:%S").replace(" 00:00:00", " 23:59:59"),
            'start_display': week_start.strftime("%d.%m"),
            'end_display': week_end.strftime("%d.%m")
        })
        
        current_monday += timedelta(days=7)
    
    return periods

def get_all_cards_for_period(period_start, period_end):
    """
    Получает ВСЕ карточки за указанный период без фильтров
    
    Args:
        period_start (str): Начало периода в формате "YYYY-MM-DD HH:MM:SS"
        period_end (str): Конец периода в формате "YYYY-MM-DD HH:MM:SS"
        
    Returns:
        list: Список всех карточек за период
    """
    url = "https://seller-analytics-api.wildberries.ru/api/v2/nm-report/detail"
    
    # Формируем тело запроса БЕЗ фильтров
    payload = {
        "brandNames": [],
        "objectIDs": [],
        "tagIDs": [],
        "nmIDs": [],
        "timezone": "Europe/Moscow",
        "period": {
            "begin": period_start,
            "end": period_end
        },
        "orderBy": {
            "field": "ordersSumRub",
            "mode": "desc"
        },
        "page": 1
    }
    
    all_cards = []
    page_count = 0
    
    try:
        print(f"Запрашиваем ВСЕ карточки за период: {period_start} - {period_end}")
        
        # Обрабатываем пагинацию
        while True:
            page_count += 1
            
            # Задержка между запросами страниц пагинации (кроме первой страницы)
            if payload["page"] > 1:
                print("  Пауза 21 сек между запросами страниц пагинации (лимит API)...")
                time.sleep(21)   # 21 секунда между страницами пагинации
            
            response = requests.post(url, headers=HEADERS, data=json.dumps(payload))
            
            # Выводим информацию о запросе для отладки
            print(f"URL запроса: {url}")
            print(f"Статус ответа: {response.status_code}")
            print(f"Страница: {payload['page']}")
            
            response.raise_for_status()
            data = response.json()
            
            # Проверяем наличие ошибок в ответе
            if data.get("error", False):
                print(f"Ошибка в ответе API: {data.get('errorText', 'Неизвестная ошибка')}")
                if data.get("additionalErrors"):
                    for error in data["additionalErrors"]:
                        print(f"  - {error.get('field', '')}: {error.get('description', '')}")
                break
            
            # Обрабатываем данные
            cards = data.get("data", {}).get("cards", [])
            print(f"Получено {len(cards)} карточек на странице {payload['page']}")
            
            all_cards.extend(cards)
            
            # Проверяем, есть ли следующая страница
            if not data.get("data", {}).get("isNextPage", False):
                break
            else:
                print("📄 Запрашивается еще одна страница (isNextPage: true)")
            
            # Переходим к следующей странице
            payload["page"] += 1
        
        print(f"Всего получено {len(all_cards)} карточек за период ({page_count} страниц)")
        return all_cards
        
    except requests.exceptions.RequestException as e:
        print(f"Ошибка при запросе к API: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Статус ошибки: {e.response.status_code}")
            print(f"Текст ошибки: {e.response.text}")
        return []

def filter_cards_by_categories(cards):
    """
    Фильтрует карточки по категориям на основе object.name
    
    Args:
        cards (list): Список всех карточек
        
    Returns:
        dict: Словарь с категориями и их статистикой
    """
    # Инициализируем результат
    category_stats = {}
    for category in CATEGORIES:
        category_stats[category['name']] = {
            "orders_sum": 0, 
            "buyouts_sum": 0, 
            "orders_count": 0, 
            "buyouts_count": 0,
            "cards_count": 0
        }
    
    # Карточки, которые не попали ни в одну категорию
    unmatched_objects = set()
    
    for card in cards:
        object_name = card.get("object", {}).get("name", "")
        stats = card.get("statistics", {}).get("selectedPeriod", {})
        
        # Ищем подходящую категорию
        category_found = False
        
        for category in CATEGORIES:
            # Проверяем, содержится ли название предмета в списке объектов категории
            if any(obj_name.lower() in object_name.lower() for obj_name in category["object_names"]):
                category_stats[category['name']]["orders_sum"] += stats.get("ordersSumRub", 0)
                category_stats[category['name']]["buyouts_sum"] += stats.get("buyoutsSumRub", 0)
                category_stats[category['name']]["orders_count"] += stats.get("ordersCount", 0)
                category_stats[category['name']]["buyouts_count"] += stats.get("buyoutsCount", 0)
                category_stats[category['name']]["cards_count"] += 1
                category_found = True
                break
        
        if not category_found and object_name:
            unmatched_objects.add(object_name)
    
    # Выводим информацию о нераспределенных объектах
    if unmatched_objects:
        print(f"\nОбъекты, не попавшие ни в одну категорию ({len(unmatched_objects)}):")
        for obj in sorted(unmatched_objects):
            print(f"  - {obj}")
    
    return category_stats

def create_csv_report(periods, all_weekly_data):
    """Создает CSV файл с отчетом в папке Documents"""
    # Путь к папке Documents
    documents_path = os.path.expanduser("~/Documents")
    csv_filename = f"wb_analytics_report_{START_DATE}_to_{END_DATE}.csv"
    csv_path = os.path.join(documents_path, csv_filename)
    
    with open(csv_path, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        
        # Создаем заголовки (только для заказов)
        headers = ['Категория']
        for period in periods:
            headers.append(f"Неделя {period['start_display']}-{period['end_display']} (Заказы ₽)")
        headers.append('Итого заказы ₽')
        
        writer.writerow(headers)
        
        # Записываем данные по категориям (только заказы)
        for category in CATEGORIES:
            category_name = category['name']
            row = [category_name]
            total_orders = 0
            
            for period_idx in range(len(periods)):
                orders_sum = all_weekly_data[period_idx].get(category_name, {}).get("orders_sum", 0)
                
                row.append(f"{orders_sum:.0f}")
                total_orders += orders_sum
            
            row.append(f"{total_orders:.0f}")
            writer.writerow(row)
        
        # Строка с суммой (только заказы)
        sum_row = ['ИТОГО']
        grand_total_orders = 0
        
        for period_idx in range(len(periods)):
            period_orders_total = sum(
                all_weekly_data[period_idx].get(cat['name'], {}).get("orders_sum", 0) 
                for cat in CATEGORIES
            )
            
            sum_row.append(f"{period_orders_total:.0f}")
            grand_total_orders += period_orders_total
        
        sum_row.append(f"{grand_total_orders:.0f}")
        writer.writerow(sum_row)
    
    print(f"\nCSV файл сохранен: {csv_path}")
    return csv_path

def main():
    print(f"Анализ статистики Wildberries через Analytics API v2 за период с {START_DATE} по {END_DATE}\n")
    print("🚀 ОПТИМИЗИРОВАННАЯ ВЕРСИЯ: 1 запрос на неделю + локальная фильтрация\n")
    
    # Получаем недельные периоды
    periods = get_weekly_periods(START_DATE, END_DATE)
    
    print("Недельные периоды (понедельник-воскресенье):")
    for i, period in enumerate(periods, 1):
        print(f"Неделя {i}: {period['start']} - {period['end']} ({period['start_display']} - {period['end_display']})")
    print(f"\nВсего будет сделано {len(periods)} запросов к API\n")
    
    # Собираем данные по неделям
    all_weekly_data = []
    
    for period_idx, period in enumerate(periods, 1):
        print(f"\n{'=' * 70}")
        print(f"НЕДЕЛЯ {period_idx}: {period['start_display']} - {period['end_display']}")
        print(f"{'=' * 70}")
        
        # Добавляем задержку между запросами недель
        if period_idx > 1:
            print("  Пауза 25 сек между запросами недель (лимит API)...")
            time.sleep(25)
        
        # Получаем ВСЕ карточки за период
        all_cards = get_all_cards_for_period(period['start'], period['end'])
        
        if not all_cards:
            print("Не удалось получить данные за этот период")
            # Добавляем пустую статистику
            empty_stats = {}
            for category in CATEGORIES:
                empty_stats[category['name']] = {
                    "orders_sum": 0, "buyouts_sum": 0, 
                    "orders_count": 0, "buyouts_count": 0, 
                    "cards_count": 0
                }
            all_weekly_data.append(empty_stats)
            continue
        
        # Фильтруем карточки по категориям
        print(f"\nФильтруем {len(all_cards)} карточек по категориям...")
        weekly_stats = filter_cards_by_categories(all_cards)
        all_weekly_data.append(weekly_stats)
        
        # Выводим итоги по неделе
        print(f"\nИтоги недели {period_idx}:")
        for category_name, stats in weekly_stats.items():
            if stats["cards_count"] > 0:
                print(f"  {category_name}: {stats['cards_count']} карточек, "
                      f"заказы {stats['orders_sum']:.0f}₽, выкупы {stats['buyouts_sum']:.0f}₽")
    
    # Создаем CSV файл
    csv_path = create_csv_report(periods, all_weekly_data)
    
    # Выводим итоговую таблицу
    print("\n\n")
    print(f"{'=' * 100}")
    print(f"ИТОГОВЫЕ РЕЗУЛЬТАТЫ ПО НЕДЕЛЯМ")
    print(f"{'=' * 100}")
    
    # Заголовок таблицы
    header = f"{'Категория':<35}"
    for period in periods:
        header += f" | {period['start_display']}-{period['end_display']} З/В"
    header += f" | {'Итого З/В':<15}"
    print(header)
    print("-" * len(header))
    
    # Данные по категориям
    for category in CATEGORIES:
        category_name = category['name']
        row = f"{category_name:<35}"
        category_total_orders = 0
        category_total_buyouts = 0
        
        for week_data in all_weekly_data:
            stats = week_data.get(category_name, {})
            orders = stats.get("orders_sum", 0)
            buyouts = stats.get("buyouts_sum", 0)
            row += f" | {orders:>6.0f}/{buyouts:>6.0f}"
            category_total_orders += orders
            category_total_buyouts += buyouts
        
        row += f" | {category_total_orders:>6.0f}/{category_total_buyouts:>6.0f}"
        print(row)
    
    print(f"{'=' * 100}")
    
    # Подсчет общих итогов
    grand_total_orders = sum(
        sum(week_data.get(cat['name'], {}).get("orders_sum", 0) for cat in CATEGORIES)
        for week_data in all_weekly_data
    )
    grand_total_buyouts = sum(
        sum(week_data.get(cat['name'], {}).get("buyouts_sum", 0) for cat in CATEGORIES)
        for week_data in all_weekly_data
    )
    
    print(f"\nОБЩИЕ ИТОГИ:")
    print(f"Всего заказов: {grand_total_orders:.2f} ₽")
    print(f"Всего выкупов: {grand_total_buyouts:.2f} ₽")
    print(f"Конверсия в выкуп: {(grand_total_buyouts/grand_total_orders*100 if grand_total_orders > 0 else 0):.1f}%")
    print(f"\n📊 Использовано запросов к API: {len(periods)} (вместо {len(CATEGORIES) * len(periods)})")

if __name__ == "__main__":
    main() 