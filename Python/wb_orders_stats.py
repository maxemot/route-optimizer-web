import requests
import json
import time
from datetime import datetime, timedelta

# API-ключ
API_KEY = "eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwMTIwdjEiLCJ0eXAiOiJKV1QifQ.eyJlbnQiOjEsImV4cCI6MTc1NTE0Mzg4MiwiaWQiOiIwMTk0ZmFlMS1iMTI0LTc2M2EtYTI5OS00ZWFkMzBhMDBjNzciLCJpaWQiOjIyODU1MDkwLCJvaWQiOjEzNjE0MjgsInMiOjM4MzgsInNpZCI6Ijg5ZjRiNjllLTFkNDYtNDZiYS1hN2JkLWU0NjRjODczODliMyIsInQiOmZhbHNlLCJ1aWQiOjIyODU1MDkwfQ.7pX4vEgx-hfw6iywBb8V0LncnKJZFI4zEZ7meeIW2I7RNf6Ndnnuf8cokl6HMdEH7jL47ZaeOW_TWl1q4Gsr1Q"

# Заголовки для запросов
HEADERS = {
    "Authorization": API_KEY,
    "Content-Type": "application/json"
}

# Даты для отчета в формате YYYY-MM-DD
START_DATE = "2024-02-17"
END_DATE = "2024-02-23"

# Категории товаров для анализа
CATEGORIES = [
    {"name": "Брудеры", "subjectIds": [5555], "tagIds": []},
    {"name": "Кормушки и поилки", "subjectIds": [1121, 3235], "tagIds": []},
    {"name": "Гранулятор", "subjectIds": [8510], "tagIds": []},
    {"name": "Перосьемка (+шпарчан)", "subjectIds": [], "tagIds": [1263558]},
    {"name": "Курятник", "subjectIds": [], "tagIds": [1248702]},
    {"name": "Контейнер", "subjectIds": [3863], "tagIds": []},
    {"name": "Клетки", "subjectIds": [], "tagIds": [1248701]},
    {"name": "Инкубатор 64", "subjectIds": [5256], "tagIds": []},
    {"name": "Конусы", "subjectIds": [], "tagIds": [1263555]},
    {"name": "Гнездо", "subjectIds": [], "tagIds": [1263409]},
    {"name": "Печь", "subjectIds": [589], "tagIds": []}
]

def get_orders_by_subject(subject_id, start_date, end_date):
    """
    Получает статистику заказов по предмету (категории)
    
    Args:
        subject_id (int): ID предмета
        start_date (str): Начальная дата в формате YYYY-MM-DD
        end_date (str): Конечная дата в формате YYYY-MM-DD
        
    Returns:
        float: Сумма заказов
    """
    # Преобразуем даты в формат timestamp
    start_timestamp = int(datetime.strptime(start_date, "%Y-%m-%d").timestamp())
    end_timestamp = int(datetime.strptime(end_date, "%Y-%m-%d").timestamp() + 86399)  # Конец дня
    
    url = "https://statistics-api.wildberries.ru/api/v1/supplier/orders"
    
    params = {
        "dateFrom": start_timestamp,
        "dateTo": end_timestamp,
        "subjectId": subject_id
    }
    
    try:
        print(f"Запрашиваем статистику заказов для предмета ID={subject_id}...")
        
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
        
        # Суммируем заказы
        total_sum = sum(item.get("totalPrice", 0) for item in data)
        
        return total_sum
        
    except requests.exceptions.RequestException as e:
        print(f"Ошибка при запросе к API: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Статус ошибки: {e.response.status_code}")
            print(f"Текст ошибки: {e.response.text}")
        return 0

def get_orders_by_tag(tag_id, start_date, end_date):
    """
    Получает статистику заказов по тегу
    
    Args:
        tag_id (int): ID тега
        start_date (str): Начальная дата в формате YYYY-MM-DD
        end_date (str): Конечная дата в формате YYYY-MM-DD
        
    Returns:
        float: Сумма заказов
    """
    # Преобразуем даты в формат timestamp
    start_timestamp = int(datetime.strptime(start_date, "%Y-%m-%d").timestamp())
    end_timestamp = int(datetime.strptime(end_date, "%Y-%m-%d").timestamp() + 86399)  # Конец дня
    
    url = "https://statistics-api.wildberries.ru/api/v1/supplier/orders"
    
    params = {
        "dateFrom": start_timestamp,
        "dateTo": end_timestamp,
        "tagIds": tag_id
    }
    
    try:
        print(f"Запрашиваем статистику заказов для тега ID={tag_id}...")
        
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
        
        # Суммируем заказы
        total_sum = sum(item.get("totalPrice", 0) for item in data)
        
        return total_sum
        
    except requests.exceptions.RequestException as e:
        print(f"Ошибка при запросе к API: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Статус ошибки: {e.response.status_code}")
            print(f"Текст ошибки: {e.response.text}")
        return 0

def main():
    print(f"Анализ заказов Wildberries за период с {START_DATE} по {END_DATE}\n")
    
    results = []
    
    for category in CATEGORIES:
        print(f"\n{'=' * 60}")
        print(f"Обработка категории: {category['name']}")
        print(f"{'=' * 60}")
        
        total_sum = 0
        
        # Получаем статистику по предметам
        for subject_id in category["subjectIds"]:
            subject_sum = get_orders_by_subject(subject_id, START_DATE, END_DATE)
            print(f"Сумма заказов для предмета ID={subject_id}: {subject_sum:.2f} ₽")
            total_sum += subject_sum
        
        # Получаем статистику по тегам
        for tag_id in category["tagIds"]:
            tag_sum = get_orders_by_tag(tag_id, START_DATE, END_DATE)
            print(f"Сумма заказов для тега ID={tag_id}: {tag_sum:.2f} ₽")
            total_sum += tag_sum
        
        print(f"Общая сумма заказов для категории '{category['name']}': {total_sum:.2f} ₽")
        
        results.append((category['name'], total_sum))
    
    # Выводим итоговую таблицу результатов
    print("\n\n")
    print(f"{'=' * 60}")
    print(f"ИТОГОВЫЕ РЕЗУЛЬТАТЫ")
    print(f"{'=' * 60}")
    print(f"{'Категория':<30} | {'Сумма заказов, ₽'}")
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