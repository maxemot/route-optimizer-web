import requests
import json

def get_wb_tags():
    """
    Получает список ярлыков (тегов) Wildberries
    
    Returns:
        list: Список ярлыков
    """
    url = "https://content-api.wildberries.ru/content/v2/tags"
    
    # API-ключ из предыдущей программы
    headers = {
        "Authorization": "eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwMTIwdjEiLCJ0eXAiOiJKV1QifQ.eyJlbnQiOjEsImV4cCI6MTc1NTE0Mzg4MiwiaWQiOiIwMTk0ZmFlMS1iMTI0LTc2M2EtYTI5OS00ZWFkMzBhMDBjNzciLCJpaWQiOjIyODU1MDkwLCJvaWQiOjEzNjE0MjgsInMiOjM4MzgsInNpZCI6Ijg5ZjRiNjllLTFkNDYtNDZiYS1hN2JkLWU0NjRjODczODliMyIsInQiOmZhbHNlLCJ1aWQiOjIyODU1MDkwfQ.7pX4vEgx-hfw6iywBb8V0LncnKJZFI4zEZ7meeIW2I7RNf6Ndnnuf8cokl6HMdEH7jL47ZaeOW_TWl1q4Gsr1Q"
    }
    
    try:
        print("Запрашиваем список ярлыков Wildberries...")
        response = requests.get(url, headers=headers)
        
        # Выводим информацию о запросе для отладки
        print(f"URL запроса: {response.url}")
        print(f"Статус ответа: {response.status_code}")
        
        response.raise_for_status()
        data = response.json()
        
        # Выводим пример структуры ответа для отладки
        print(f"Пример структуры ответа: {json.dumps(data, indent=2, ensure_ascii=False)}")
        
        # Проверяем структуру ответа
        if 'data' in data:
            return data['data']
        else:
            print(f"Неожиданная структура ответа: {data}")
            return []
        
    except requests.exceptions.RequestException as e:
        print(f"Ошибка при запросе к API: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Статус ошибки: {e.response.status_code}")
            print(f"Текст ошибки: {e.response.text}")
        return []

def main():
    # Получаем список ярлыков
    tags = get_wb_tags()
    
    if not tags:
        print("Не удалось получить список ярлыков.")
        return
    
    print(f"Получено {len(tags)} ярлыков.")
    
    # Выводим все полученные ярлыки
    print("\nСписок ярлыков Wildberries:")
    print("-" * 60)
    print(f"{'ID':<5} | {'Название':<30} | {'Цвет'}")
    print("-" * 60)
    
    for tag in tags:
        tag_id = tag.get('id', 0)
        tag_name = tag.get('name', '')
        tag_color = tag.get('color', '')
        print(f"{tag_id:<5} | {tag_name:<30} | #{tag_color}")
    
    print("-" * 60)
    
    # Сохраняем результаты в файл
    with open("wb_tags.txt", "w", encoding="utf-8") as f:
        f.write("Список ярлыков Wildberries:\n")
        f.write("-" * 60 + "\n")
        f.write(f"{'ID':<5} | {'Название':<30} | {'Цвет'}\n")
        f.write("-" * 60 + "\n")
        
        for tag in tags:
            tag_id = tag.get('id', 0)
            tag_name = tag.get('name', '')
            tag_color = tag.get('color', '')
            f.write(f"{tag_id:<5} | {tag_name:<30} | #{tag_color}\n")
        
        f.write("-" * 60 + "\n")
        f.write(f"Всего ярлыков: {len(tags)}\n")
    
    # Сохраняем результаты в JSON-файл для возможного использования в других программах
    with open("wb_tags.json", "w", encoding="utf-8") as f:
        json.dump(tags, f, ensure_ascii=False, indent=2)
    
    print("\nРезультаты сохранены в файлы wb_tags.txt и wb_tags.json")

if __name__ == "__main__":
    main() 