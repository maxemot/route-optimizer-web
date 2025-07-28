import requests
import json
import time
import uuid
import csv
import io
from datetime import datetime

# API-ключ из предыдущих программ
API_KEY = "eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwMTIwdjEiLCJ0eXAiOiJKV1QifQ.eyJlbnQiOjEsImV4cCI6MTc1NTE0Mzg4MiwiaWQiOiIwMTk0ZmFlMS1iMTI0LTc2M2EtYTI5OS00ZWFkMzBhMDBjNzciLCJpaWQiOjIyODU1MDkwLCJvaWQiOjEzNjE0MjgsInMiOjM4MzgsInNpZCI6Ijg5ZjRiNjllLTFkNDYtNDZiYS1hN2JkLWU0NjRjODczODliMyIsInQiOmZhbHNlLCJ1aWQiOjIyODU1MDkwfQ.7pX4vEgx-hfw6iywBb8V0LncnKJZFI4zEZ7meeIW2I7RNf6Ndnnuf8cokl6HMdEH7jL47ZaeOW_TWl1q4Gsr1Q"

# Заголовки для запросов
HEADERS = {
    "Authorization": API_KEY,
    "Content-Type": "application/json"
}

# Даты для отчета в правильном формате (YYYY-MM-DD)
START_DATE = "2024-02-17"  # Было "17.02.2024"
END_DATE = "2024-02-23"    # Было "23.02.2024"

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

def create_report(category):
    """
    Создает отчет по заданной категории товаров
    
    Args:
        category (dict): Категория товаров с параметрами
        
    Returns:
        str: ID загрузки отчета
    """
    url = "https://seller-analytics-api.wildberries.ru/api/v2/nm-report/downloads"
    
    # Генерируем уникальный ID для отчета
    report_id = str(uuid.uuid4())
    
    # Формируем параметры запроса
    params = {
        "startDate": START_DATE,
        "endDate": END_DATE,
        "timezone": "Europe/Moscow",
        "aggregationLevel": "day",
        "skipDeletedNm": False
    }
    
    # Добавляем фильтры по предметам, если они указаны
    if category["subjectIds"]:
        params["subjectIDs"] = category["subjectIds"]  # Изменено с subjectIds на subjectIDs
    
    # Добавляем фильтры по тегам, если они указаны
    if category["tagIds"]:
        params["tagIDs"] = category["tagIds"]  # Изменено с tagIds на tagIDs
    
    # Формируем тело запроса
    payload = {
        "id": report_id,
        "reportType": "DETAIL_HISTORY_REPORT",
        "userReportName": f"Report for {category['name']}",  # Добавлено имя отчета
        "params": params
    }
    
    try:
        print(f"Создаем отчет для категории '{category['name']}'...")
        
        # Добавляем задержку между запросами, чтобы избежать ошибки "Too Many Requests"
        time.sleep(1)
        
        response = requests.post(url, headers=HEADERS, data=json.dumps(payload))
        
        # Выводим информацию о запросе для отладки
        print(f"URL запроса: {url}")
        print(f"Тело запроса: {json.dumps(payload, ensure_ascii=False)}")
        print(f"Статус ответа: {response.status_code}")
        
        response.raise_for_status()
        data = response.json()
        
        # Выводим ответ для отладки
        print(f"Ответ: {json.dumps(data, indent=2, ensure_ascii=False)}")
        
        # Проверяем структуру ответа
        if 'data' in data and 'downloadId' in data['data']:
            download_id = data['data']['downloadId']
            print(f"Получен ID загрузки: {download_id}")
            return download_id
        else:
            print(f"Неожиданная структура ответа: {data}")
            return None
        
    except requests.exceptions.RequestException as e:
        print(f"Ошибка при запросе к API: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Статус ошибки: {e.response.status_code}")
            print(f"Текст ошибки: {e.response.text}")
        return None

def get_report_file(download_id):
    """
    Получает файл отчета по ID загрузки
    
    Args:
        download_id (str): ID загрузки отчета
        
    Returns:
        str: Содержимое CSV-файла отчета
    """
    url = f"https://seller-analytics-api.wildberries.ru/api/v2/nm-report/downloads/file/{download_id}"
    
    max_attempts = 20  # Увеличено количество попыток
    attempt = 0
    
    while attempt < max_attempts:
        try:
            print(f"Попытка {attempt + 1} получения отчета...")
            
            # Добавляем задержку между запросами
            time.sleep(2)
            
            response = requests.get(url, headers=HEADERS)
            
            # Проверяем статус ответа
            if response.status_code == 200:
                print("Отчет успешно получен")
                return response.text
            elif response.status_code == 204:
                print("Отчет еще не готов, ожидаем...")
                time.sleep(3)  # Увеличено время ожидания между попытками
                attempt += 1
            else:
                response.raise_for_status()
                
        except requests.exceptions.RequestException as e:
            print(f"Ошибка при запросе к API: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Статус ошибки: {e.response.status_code}")
                print(f"Текст ошибки: {e.response.text}")
            return None
    
    print(f"Не удалось получить отчет после {max_attempts} попыток")
    return None

def parse_csv_report(csv_content):
    """
    Парсит CSV-отчет и вычисляет сумму заказов
    
    Args:
        csv_content (str): Содержимое CSV-файла отчета
        
    Returns:
        float: Сумма заказов
    """
    if not csv_content:
        return 0
    
    try:
        # Создаем объект для чтения CSV из строки
        csv_file = io.StringIO(csv_content)
        
        # Определяем разделитель (может быть ; или ,)
        sample = csv_content[:1000]
        delimiter = ';' if ';' in sample else ','
        
        reader = csv.DictReader(csv_file, delimiter=delimiter)
        
        # Выводим заголовки для отладки
        headers = reader.fieldnames
        if headers:
            print(f"Заголовки CSV: {headers}")
        
        # Ищем столбец с суммой заказов
        order_sum_column = None
        for possible_name in ['ordersSumRub', 'Заказали на сумму, ₽', 'Сумма заказов, ₽']:
            if possible_name in headers:
                order_sum_column = possible_name
                break
        
        if not order_sum_column:
            print("Не удалось найти столбец с суммой заказов")
            return 0
        
        # Суммируем значения в найденном столбце
        total_sum = 0
        for row in reader:
            # Преобразуем строку в число, заменяя запятую на точку
            value_str = row[order_sum_column].replace(',', '.').replace(' ', '')
            # Пропускаем пустые значения
            if value_str:
                try:
                    value = float(value_str)
                    total_sum += value
                except ValueError:
                    print(f"Не удалось преобразовать значение '{value_str}' в число")
        
        return total_sum
        
    except Exception as e:
        print(f"Ошибка при парсинге CSV: {e}")
        return 0

def main():
    print(f"Анализ заказов Wildberries за период с {START_DATE} по {END_DATE}\n")
    
    results = []
    
    for category in CATEGORIES:
        print(f"\n{'=' * 60}")
        print(f"Обработка категории: {category['name']}")
        print(f"{'=' * 60}")
        
        # Создаем отчет
        download_id = create_report(category)
        
        if not download_id:
            print(f"Не удалось создать отчет для категории '{category['name']}'")
            results.append((category['name'], 0))
            continue
        
        # Получаем файл отчета
        csv_content = get_report_file(download_id)
        
        if not csv_content:
            print(f"Не удалось получить отчет для категории '{category['name']}'")
            results.append((category['name'], 0))
            continue
        
        # Парсим отчет и вычисляем сумму заказов
        total_sum = parse_csv_report(csv_content)
        
        print(f"Сумма заказов для категории '{category['name']}': {total_sum:.2f} ₽")
        
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