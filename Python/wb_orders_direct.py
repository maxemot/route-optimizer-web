import requests
import json
from datetime import datetime, timedelta
import csv
import os
import time

# API-ключ
API_KEY = "eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwMjE3djEiLCJ0eXAiOiJKV1QifQ.eyJlbnQiOjEsImV4cCI6MTc1Njc4NDcyMywiaWQiOiIwMTk1NWNhZS1lZTkxLTc3ZTYtYjBlZC0wNTE0M2ExN2NjYTciLCJpaWQiOjQ1MTA3NTA0LCJvaWQiOjEzNjE0MjgsInMiOjc5MzQsInNpZCI6Ijg5ZjRiNjllLTFkNDYtNDZiYS1hN2JkLWU0NjRjODczODliMyIsInQiOmZhbHNlLCJ1aWQiOjQ1MTA3NTA0fQ.DwAo8YAbckfPvHa1fpd0cwKbvOJiVCWXbHhswr64Z_KqxjV40PS3SpzDoz-Q4eWlCHxNQeym7VujsfZnHicDRg"

# Заголовки для запросов
HEADERS = {
    "Authorization": API_KEY,
    "Content-Type": "application/json"
}

# Даты для анализа
START_DATE = "2025-03-31"
END_DATE = "2025-04-06"

# Категории товаров для анализа
CATEGORIES = [
    {"name": "Брудеры", "subjects": ["Брудеры"], "articles": []},
    {"name": "Кормушки и поилки", "subjects": ["Кормушки для животных", "Поилки для животных"], "articles": []},
    {"name": "Грануляторы", "subjects": ["Грануляторы для комбикорма"], "articles": []},
    {"name": "Перосъемные машины", "subjects": ["Перосъемные машины"], "articles": []},
    {"name": "Клетки для птиц", "subjects": ["Клетки для птиц"], "articles": []},
    {"name": "Генераторы", "subjects": ["Генераторы"], "articles": []},
    {"name": "Инкубаторы", "subjects": ["Инкубаторы"], "articles": []},
    {"name": "Печи туристические", "subjects": ["Печи туристические"], "articles": []},
    {"name": "Будки для собак", "subjects": ["Будки для собак"], "articles": []},
    {"name": "Клетки для животных", "subjects": ["Клетки для животных"], "articles": []}
]

def get_orders_for_date(date_str):
    """
    Получает все заказы за указанную дату
    
    Args:
        date_str (str): Дата в формате YYYY-MM-DD
        
    Returns:
        list: Список заказов
    """
    # Используем API для получения заказов
    url = "https://statistics-api.wildberries.ru/api/v1/supplier/orders"
    
    params = {
        "dateFrom": date_str,  # Дата в формате YYYY-MM-DD
        "flag": 1  # Выгружаем информацию обо всех заказах с датой, равной переданному параметру dateFrom
    }
    
    try:
        print(f"Запрашиваем заказы за {date_str}...")
        
        response = requests.get(url, headers=HEADERS, params=params)
        
        # Выводим информацию о запросе для отладки
        print(f"URL запроса: {response.url}")
        print(f"Статус ответа: {response.status_code}")
        
        response.raise_for_status()
        orders = response.json()
        
        print(f"Получено {len(orders)} заказов за {date_str}")
        
        # Выводим пример заказа для отладки
        if orders and len(orders) > 0:
            print(f"Пример заказа: {json.dumps(orders[0], indent=2, ensure_ascii=False)}")
        
        return orders
        
    except requests.exceptions.RequestException as e:
        print(f"Ошибка при запросе к API: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Статус ошибки: {e.response.status_code}")
            print(f"Текст ошибки: {e.response.text}")
        return []

def get_date_range(start_date_str, end_date_str):
    """
    Генерирует список дат в заданном диапазоне
    
    Args:
        start_date_str (str): Начальная дата в формате YYYY-MM-DD
        end_date_str (str): Конечная дата в формате YYYY-MM-DD
        
    Returns:
        list: Список дат в формате YYYY-MM-DD
    """
    start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
    end_date = datetime.strptime(end_date_str, "%Y-%m-%d")
    
    date_list = []
    current_date = start_date
    
    while current_date <= end_date:
        date_list.append(current_date.strftime("%Y-%m-%d"))
        current_date += timedelta(days=1)
    
    return date_list

def save_to_csv(results, date_range, total_orders, grand_total):
    """
    Сохраняет результаты анализа в CSV файл
    
    Args:
        results (list): Список результатов анализа
        date_range (str): Диапазон дат анализа
        total_orders (int): Общее количество заказов
        grand_total (float): Общая сумма заказов
    """
    # Создаем имя файла с диапазоном дат
    filename = f"wb_orders_report_{START_DATE}_to_{END_DATE}.csv"
    
    try:
        with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            
            # Записываем заголовок
            writer.writerow(['Предмет(ы)', 'Количество заказов', 'Сумма заказов, ₽'])
            
            # Записываем данные по каждой категории
            for subjects, count, total in results:
                writer.writerow([subjects, count, f"{total:.2f}"])
            
            # Записываем итоговую строку
            writer.writerow(['ИТОГО', total_orders, f"{grand_total:.2f}"])
        
        print(f"\nРезультаты сохранены в файл: {os.path.abspath(filename)}")
        
    except Exception as e:
        print(f"Ошибка при сохранении результатов в CSV: {e}")

def main():
    print(f"Анализ заказов Wildberries за период с {START_DATE} по {END_DATE}\n")
    
    # Получаем список дат для анализа
    date_list = get_date_range(START_DATE, END_DATE)
    print(f"Будут проанализированы следующие даты: {', '.join(date_list)}")
    
    # Словарь для хранения заказов по категориям
    all_orders = []
    
    # Получаем заказы за каждую дату с учетом ограничения API
    for date_str in date_list:
        orders = get_orders_for_date(date_str)
        all_orders.extend(orders)
        
        # Ждем 61 секунду перед следующим запросом (ограничение API - 1 запрос в минуту)
        if date_str != date_list[-1]:  # Не ждем после последней даты
            print(f"Ожидаем 61 секунду перед следующим запросом (ограничение API)...")
            time.sleep(61)
    
    if not all_orders:
        print("Не удалось получить данные о заказах.")
        return
    
    print(f"\nВсего получено {len(all_orders)} заказов за период с {START_DATE} по {END_DATE}")
    
    # Фильтруем отмененные заказы
    active_orders = [order for order in all_orders if not order.get('isCancel')]
    print(f"Всего активных (неотмененных) заказов: {len(active_orders)} из {len(all_orders)}")
    
    # Анализируем заказы по категориям
    results = []
    
    for category in CATEGORIES:
        print(f"\n{'=' * 60}")
        print(f"Обработка категории: {category['name']}")
        print(f"{'=' * 60}")
        
        category_orders = []
        
        for order in active_orders:
            # Проверяем, соответствует ли товар категории по предмету
            subject = order.get("subject", "")
            if category["subjects"] and any(subj.lower() in subject.lower() for subj in category["subjects"]):
                category_orders.append(order)
                continue
                
            # Проверяем, соответствует ли товар категории по артикулу
            article = order.get("supplierArticle", "")
            if category["articles"] and any(art.lower() in article.lower() for art in category["articles"]):
                category_orders.append(order)
        
        print(f"Найдено {len(category_orders)} активных заказов для категории '{category['name']}'")
        
        # Суммируем заказы по priceWithDisc
        total_sum = sum(order.get("priceWithDisc", 0) for order in category_orders)
        
        print(f"Общая сумма активных заказов для категории '{category['name']}': {total_sum:.2f} ₽")
        
        # Формируем строку с точными названиями предметов
        subject_names = ", ".join(category["subjects"]) if category["subjects"] else ""
        
        results.append((subject_names, len(category_orders), total_sum))
    
    # Выводим итоговую таблицу результатов
    print("\n\n")
    print(f"{'=' * 80}")
    print(f"ИТОГОВЫЕ РЕЗУЛЬТАТЫ ЗА ПЕРИОД С {START_DATE} ПО {END_DATE} (ТОЛЬКО АКТИВНЫЕ ЗАКАЗЫ)")
    print(f"{'=' * 80}")
    print(f"{'Предмет(ы)':<40} | {'Кол-во заказов':<15} | {'Сумма заказов, ₽':<15}")
    print(f"{'-' * 80}")
    
    grand_total = 0
    total_orders = 0
    for subjects, count, total in results:
        print(f"{subjects:<40} | {count:<15} | {total:.2f}")
        grand_total += total
        total_orders += count
    
    print(f"{'-' * 80}")
    print(f"{'ИТОГО:':<40} | {total_orders:<15} | {grand_total:.2f}")
    print(f"{'=' * 80}")
    
    # Сохраняем результаты в CSV файл
    date_range = f"{START_DATE} - {END_DATE}"
    save_to_csv(results, date_range, total_orders, grand_total)

if __name__ == "__main__":
    main() 