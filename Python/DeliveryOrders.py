import requests
import pandas as pd
from datetime import datetime
import os
from collections import defaultdict

def get_fbs_orders(api_key):
    """Получает все сборочные задания"""
    
    url = "https://marketplace-api.wildberries.ru/api/v3/orders"
    headers = {
        "Authorization": api_key,
        "Content-Type": "application/json"
    }
    
    params = {
        "limit": 1000,
        "next": 0
    }
    
    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        print(f"🔍 Статус ответа: {response.status_code}")
        return response.json()
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Ошибка запроса: {e}")
        if hasattr(e.response, 'text'):
            print(f"📄 Текст ответа: {e.response.text}")
        return None

def get_orders_status(api_key, order_ids):
    """Получает статусы заказов и считает статистику"""
    
    url = "https://marketplace-api.wildberries.ru/api/v3/orders/status"
    headers = {
        "Authorization": api_key,
        "Content-Type": "application/json"
    }
    
    # Словарь для подсчета статусов
    status_counts = defaultdict(int)
    filtered_orders = {}  # Словарь для хранения ID заказов и их статусов
    
    # Разбиваем список заказов на группы по 1000 штук
    batch_size = 1000
    
    for i in range(0, len(order_ids), batch_size):
        batch = order_ids[i:i + batch_size]
        
        try:
            response = requests.post(url, headers=headers, json={"orders": batch})
            response.raise_for_status()
            
            # Получаем список объектов с информацией о статусах
            orders_status = response.json().get('orders', [])
            
            # Подсчитываем статусы и собираем нужные заказы
            for order in orders_status:
                if isinstance(order, dict):
                    supplier_status = order.get('supplierStatus', 'unknown')
                    wb_status = order.get('wbStatus', 'unknown')
                    status_pair = (supplier_status, wb_status)
                    status_counts[status_pair] += 1
                    
                    # Собираем заказы с нужными комбинациями статусов
                    if wb_status == 'waiting' and supplier_status in ['complete', 'confirm']:
                        filtered_orders[order.get('id')] = supplier_status
    
        except requests.exceptions.RequestException as e:
            print(f"❌ Ошибка при получении статусов: {e}")
            if hasattr(e.response, 'text'):
                print(f"📄 Текст ответа: {e.response.text}")
            continue
    
    # Выводим статистику по статусам
    print("\n📊 Статистика по статусам:")
    print("=" * 50)
    print(f"{'Статус продавца':<15} | {'Статус WB':<20} | {'Количество':>10}")
    print("-" * 50)
    
    for (supplier_status, wb_status), count in sorted(status_counts.items()):
        print(f"{supplier_status:<15} | {wb_status:<20} | {count:>10}")
    
    print("=" * 50)
    print()
    
    return filtered_orders

def process_orders(orders_data, filtered_orders):
    """Обрабатывает полученные данные и создает DataFrame"""
    
    if not orders_data or 'orders' not in orders_data:
        print("❌ Нет данных о заказах в ответе API")
        return None
    
    orders = []
    for order in orders_data['orders']:
        # Проверяем, есть ли заказ в списке отфильтрованных
        order_id = order.get('id')
        if order_id in filtered_orders:
            order_info = {
                'Номер заказа': order_id,
                'Артикул WB': order.get('article', ''),
                'Баркод': order.get('barcode', ''),
                'Название товара': order.get('name', ''),
                'Количество': order.get('quantity', 0),
                'Цена': order.get('price', 0),
                'Дата заказа': order.get('createdAt', ''),
                'Склад': order.get('warehouseName', ''),
                'Статус': f"{filtered_orders[order_id]}/waiting"
            }
            orders.append(order_info)
    
    if not orders:
        print("❌ Нет заказов с нужными статусами для обработки")
        return None
    
    df = pd.DataFrame(orders)
    
    # Подсчитываем количество заказов по каждому статусу
    status_counts = df['Статус'].value_counts()
    print("\n📊 Количество заказов по статусам:")
    for status, count in status_counts.items():
        print(f"✅ {status}: {count}")
    
    return df

def save_to_csv(df):
    """Сохраняет DataFrame в CSV файл"""
    
    if df is None:
        print("❌ Нет данных для сохранения")
        return
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    current_date = datetime.now().strftime("%Y-%m-%d_%H-%M")
    filename = f"wb_orders_{current_date}.csv"
    full_path = os.path.join(current_dir, filename)
    
    try:
        df.to_csv(full_path, index=False, encoding='utf-8-sig', sep=';')
        print(f"\n✅ Данные сохранены в файл:")
        print(f"📂 {full_path}")
        print(f"📊 Всего заказов: {len(df)}")
    except Exception as e:
        print(f"❌ Ошибка при сохранении файла: {e}")

def main():
    API_KEY = "eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwMTIwdjEiLCJ0eXAiOiJKV1QifQ.eyJlbnQiOjEsImV4cCI6MTc1NTE0Mzg4MiwiaWQiOiIwMTk0ZmFlMS1iMTI0LTc2M2EtYTI5OS00ZWFkMzBhMDBjNzciLCJpaWQiOjIyODU1MDkwLCJvaWQiOjEzNjE0MjgsInMiOjM4MzgsInNpZCI6Ijg5ZjRiNjllLTFkNDYtNDZiYS1hN2JkLWU0NjRjODczODliMyIsInQiOmZhbHNlLCJ1aWQiOjIyODU1MDkwfQ.7pX4vEgx-hfw6iywBb8V0LncnKJZFI4zEZ7meeIW2I7RNf6Ndnnuf8cokl6HMdEH7jL47ZaeOW_TWl1q4Gsr1Q"
    
    print("🔄 Получаем список всех заказов...")
    orders_data = get_fbs_orders(API_KEY)
    
    if orders_data and 'orders' in orders_data:
        # Получаем список ID всех заказов
        order_ids = [order['id'] for order in orders_data['orders']]
        print(f"📦 Всего получено заказов: {len(order_ids)}")
        
        print("🔄 Получаем статусы заказов...")
        filtered_orders = get_orders_status(API_KEY, order_ids)
        print(f"✅ Найдено заказов с нужными статусами: {len(filtered_orders)}")
        
        print("📝 Обрабатываем данные...")
        df = process_orders(orders_data, filtered_orders)
        save_to_csv(df)
    else:
        print("❌ Не удалось получить данные о заказах")

if __name__ == "__main__":
    main()