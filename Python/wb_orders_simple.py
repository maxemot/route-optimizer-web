import requests
import json
from datetime import datetime, timedelta

# API-ключ
API_KEY = "eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwMjE3djEiLCJ0eXAiOiJKV1QifQ.eyJlbnQiOjEsImV4cCI6MTc1Njc4NDcyMywiaWQiOiIwMTk1NWNhZS1lZTkxLTc3ZTYtYjBlZC0wNTE0M2ExN2NjYTciLCJpaWQiOjQ1MTA3NTA0LCJvaWQiOjEzNjE0MjgsInMiOjc5MzQsInNpZCI6Ijg5ZjRiNjllLTFkNDYtNDZiYS1hN2JkLWU0NjRjODczODliMyIsInQiOmZhbHNlLCJ1aWQiOjQ1MTA3NTA0fQ.DwAo8YAbckfPvHa1fpd0cwKbvOJiVCWXbHhswr64Z_KqxjV40PS3SpzDoz-Q4eWlCHxNQeym7VujsfZnHicDRg"

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

def get_all_orders(start_date):
    """
    Получает все заказы начиная с указанной даты
    
    Args:
        start_date (str): Начальная дата в формате YYYY-MM-DD
        
    Returns:
        list: Список заказов
    """
    # Используем API для получения заказов
    url = "https://statistics-api.wildberries.ru/api/v1/supplier/orders"
    
    headers = {
        "Authorization": API_KEY
    }
    
    params = {
        "dateFrom": start_date  # Только один параметр - dateFrom
    }
    
    try:
        print(f"Запрашиваем все заказы начиная с {start_date}...")
        
        response = requests.get(url, headers=headers, params=params)
        
        # Выводим информацию о запросе для отладки
        print(f"URL запроса: {response.url}")
        print(f"Статус ответа: {response.status_code}")
        
        response.raise_for_status()
        orders = response.json()
        
        print(f"Получено {len(orders)} заказов")
        
        # Выводим пример заказа для отладки
        if orders:
            print(f"Пример заказа: {json.dumps(orders[0], indent=2, ensure_ascii=False)}")
        
        # Фильтруем заказы по дате (если нужно)
        end_date_obj = datetime.strptime(END_DATE, "%Y-%m-%d")
        filtered_orders = []
        
        for order in orders:
            # Проверяем, что заказ не позже конечной даты
            order_date_str = order.get("date", "").split("T")[0]  # Получаем только дату из строки даты
            if order_date_str:
                order_date = datetime.strptime(order_date_str, "%Y-%m-%d")
                if order_date <= end_date_obj:
                    filtered_orders.append(order)
        
        print(f"После фильтрации по дате осталось {len(filtered_orders)} заказов")
        
        return filtered_orders
        
    except requests.exceptions.RequestException as e:
        print(f"Ошибка при запросе к API: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Статус ошибки: {e.response.status_code}")
            print(f"Текст ошибки: {e.response.text}")
        return []

def get_sales(start_date):
    """
    Получает все продажи начиная с указанной даты
    
    Args:
        start_date (str): Начальная дата в формате YYYY-MM-DD
        
    Returns:
        list: Список продаж
    """
    url = "https://statistics-api.wildberries.ru/api/v1/supplier/sales"
    
    headers = {
        "Authorization": API_KEY
    }
    
    params = {
        "dateFrom": start_date  # Только один параметр - dateFrom
    }
    
    try:
        print(f"Запрашиваем все продажи начиная с {start_date}...")
        
        response = requests.get(url, headers=headers, params=params)
        
        # Выводим информацию о запросе для отладки
        print(f"URL запроса: {response.url}")
        print(f"Статус ответа: {response.status_code}")
        
        response.raise_for_status()
        sales = response.json()
        
        print(f"Получено {len(sales)} продаж")
        
        # Выводим пример продажи для отладки
        if sales:
            print(f"Пример продажи: {json.dumps(sales[0], indent=2, ensure_ascii=False)}")
        
        # Фильтруем продажи по дате (если нужно)
        end_date_obj = datetime.strptime(END_DATE, "%Y-%m-%d")
        filtered_sales = []
        
        for sale in sales:
            # Проверяем, что продажа не позже конечной даты
            sale_date_str = sale.get("date", "").split("T")[0]  # Получаем только дату из строки даты
            if sale_date_str:
                sale_date = datetime.strptime(sale_date_str, "%Y-%m-%d")
                if sale_date <= end_date_obj:
                    filtered_sales.append(sale)
        
        print(f"После фильтрации по дате осталось {len(filtered_sales)} продаж")
        
        return filtered_sales
        
    except requests.exceptions.RequestException as e:
        print(f"Ошибка при запросе к API: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Статус ошибки: {e.response.status_code}")
            print(f"Текст ошибки: {e.response.text}")
        return []

def get_products_info():
    """
    Получает информацию о товарах, включая предметы и теги
    
    Returns:
        dict: Словарь с информацией о товарах, где ключ - nmId
    """
    url = "https://suppliers-api.wildberries.ru/api/v3/supplies/stocks"
    
    headers = {
        "Authorization": API_KEY
    }
    
    try:
        print("Запрашиваем информацию о товарах...")
        
        response = requests.get(url, headers=headers)
        
        # Выводим информацию о запросе для отладки
        print(f"URL запроса: {response.url}")
        print(f"Статус ответа: {response.status_code}")
        
        response.raise_for_status()
        data = response.json()
        
        products = {}
        for item in data.get("stocks", []):
            nm_id = item.get("nmId")
            products[nm_id] = {
                "subject_id": item.get("subject", {}).get("id"),
                "subject_name": item.get("subject", {}).get("name", ""),
                "tags": item.get("tags", [])
            }
        
        print(f"Получена информация о {len(products)} товарах")
        return products
        
    except requests.exceptions.RequestException as e:
        print(f"Ошибка при запросе информации о товарах: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Статус ошибки: {e.response.status_code}")
            print(f"Текст ошибки: {e.response.text}")
        return {}

def main():
    print(f"Анализ заказов Wildberries за период с {START_DATE} по {END_DATE}\n")
    
    # Получаем все заказы
    all_orders = get_all_orders(START_DATE)
    
    if not all_orders:
        print("Не удалось получить данные о заказах. Пробуем получить данные о продажах...")
        all_sales = get_sales(START_DATE)
        if not all_sales:
            print("Не удалось получить данные о продажах.")
            return
        all_orders = all_sales
    
    # Получаем информацию о товарах
    products_info = get_products_info()
    
    results = []
    
    for category in CATEGORIES:
        print(f"\n{'=' * 60}")
        print(f"Обработка категории: {category['name']}")
        print(f"{'=' * 60}")
        
        category_orders = []
        
        # Фильтруем заказы по предметам и тегам
        for order in all_orders:
            nm_id = order.get("nmId")
            product_info = products_info.get(nm_id, {})
            
            # Проверяем, соответствует ли товар категории по предмету
            if category["subjectIds"] and product_info.get("subject_id") in category["subjectIds"]:
                category_orders.append(order)
                continue
                
            # Проверяем, соответствует ли товар категории по тегам
            if category["tagIds"]:
                product_tags = product_info.get("tags", [])
                if any(tag_id in category["tagIds"] for tag_id in product_tags):
                    category_orders.append(order)
        
        print(f"Найдено {len(category_orders)} заказов для категории '{category['name']}'")
        
        # Суммируем заказы
        total_sum = sum(order.get("totalPrice", 0) for order in category_orders)
        
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