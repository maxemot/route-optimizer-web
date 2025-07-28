import requests
import json

def get_wb_subjects():
    """
    Получает список всех предметов (категорий) Wildberries
    
    Returns:
        list: Список всех предметов
    """
    url = "https://content-api.wildberries.ru/content/v2/object/all"
    
    # API-ключ из предыдущей программы
    headers = {
        "Authorization": "eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwMTIwdjEiLCJ0eXAiOiJKV1QifQ.eyJlbnQiOjEsImV4cCI6MTc1NTE0Mzg4MiwiaWQiOiIwMTk0ZmFlMS1iMTI0LTc2M2EtYTI5OS00ZWFkMzBhMDBjNzciLCJpaWQiOjIyODU1MDkwLCJvaWQiOjEzNjE0MjgsInMiOjM4MzgsInNpZCI6Ijg5ZjRiNjllLTFkNDYtNDZiYS1hN2JkLWU0NjRjODczODliMyIsInQiOmZhbHNlLCJ1aWQiOjIyODU1MDkwfQ.7pX4vEgx-hfw6iywBb8V0LncnKJZFI4zEZ7meeIW2I7RNf6Ndnnuf8cokl6HMdEH7jL47ZaeOW_TWl1q4Gsr1Q"
    }
    
    try:
        print("Запрашиваем список всех предметов Wildberries...")
        response = requests.get(url, headers=headers)
        
        # Выводим информацию о запросе для отладки
        print(f"Статус ответа: {response.status_code}")
        
        response.raise_for_status()
        data = response.json()
        
        # Выводим пример структуры ответа для отладки
        print(f"Пример структуры ответа: {json.dumps(data, indent=2, ensure_ascii=False)[:500]}...")
        
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

def find_subjects_by_names(subjects, target_names):
    """
    Находит subjectIds по заданным названиям категорий
    
    Args:
        subjects (list): Список всех предметов
        target_names (list): Список названий категорий для поиска
        
    Returns:
        list: Список найденных пар (subjectId, subjectName)
    """
    results = []
    
    # Преобразуем названия в нижний регистр для регистронезависимого поиска
    target_names_lower = [name.lower() for name in target_names]
    
    for subject in subjects:
        # Исправляем получение полей в соответствии с реальной структурой ответа
        subject_name = subject.get('subjectName', '')
        subject_id = subject.get('subjectID', 0)
        parent_name = subject.get('parentName', '')
        
        # Выводим информацию о категории для отладки
        # print(f"Проверяем: {subject_id} - {subject_name} (родитель: {parent_name})")
        
        # Проверяем, содержит ли название предмета одно из искомых названий
        if subject_name.lower() in target_names_lower or any(target.lower() in subject_name.lower() for target in target_names):
            results.append((subject_id, subject_name, parent_name))
    
    return results

def get_wb_subjects_by_name(name):
    """
    Получает список предметов (категорий) Wildberries по названию
    
    Args:
        name (str): Название для поиска
        
    Returns:
        list: Список найденных предметов
    """
    url = "https://content-api.wildberries.ru/content/v2/object/all"
    
    # API-ключ из предыдущей программы
    headers = {
        "Authorization": "eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwMTIwdjEiLCJ0eXAiOiJKV1QifQ.eyJlbnQiOjEsImV4cCI6MTc1NTE0Mzg4MiwiaWQiOiIwMTk0ZmFlMS1iMTI0LTc2M2EtYTI5OS00ZWFkMzBhMDBjNzciLCJpaWQiOjIyODU1MDkwLCJvaWQiOjEzNjE0MjgsInMiOjM4MzgsInNpZCI6Ijg5ZjRiNjllLTFkNDYtNDZiYS1hN2JkLWU0NjRjODczODliMyIsInQiOmZhbHNlLCJ1aWQiOjIyODU1MDkwfQ.7pX4vEgx-hfw6iywBb8V0LncnKJZFI4zEZ7meeIW2I7RNf6Ndnnuf8cokl6HMdEH7jL47ZaeOW_TWl1q4Gsr1Q"
    }
    
    # Добавляем параметр name для поиска
    params = {
        "name": name
    }
    
    try:
        print(f"Запрашиваем предметы Wildberries по названию: '{name}'...")
        response = requests.get(url, headers=headers, params=params)
        
        # Выводим информацию о запросе для отладки
        print(f"URL запроса: {response.url}")
        print(f"Статус ответа: {response.status_code}")
        
        response.raise_for_status()
        data = response.json()
        
        # Проверяем структуру ответа
        if 'data' in data:
            # Фильтруем результаты, оставляя только точные совпадения
            exact_matches = [item for item in data['data'] if item.get('subjectName', '') == name]
            print(f"Найдено {len(exact_matches)} точных совпадений из {len(data['data'])} результатов")
            return exact_matches
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
    # Получаем список всех предметов
    subjects = get_wb_subjects()
    
    if not subjects:
        print("Не удалось получить список предметов.")
        return
    
    print(f"Получено {len(subjects)} предметов.")
    
    # Выводим все полученные предметы
    print("\nСписок всех полученных предметов:")
    print("-" * 80)
    print(f"{'subjectID':<10} | {'subjectName':<40} | {'parentName'}")
    print("-" * 80)
    
    for subject in subjects:
        subject_id = subject.get('subjectID', 0)
        subject_name = subject.get('subjectName', '')
        parent_name = subject.get('parentName', '')
        print(f"{subject_id:<10} | {subject_name:<40} | {parent_name}")
    
    print("-" * 80)
    
    # Список искомых названий категорий
    target_names = [
        "Брудеры", 
        "Кормушки для животных", 
        "Поилки для животных", 
        "Грануляторы для комбикорма", 
        "Генераторы", 
        "Инкубаторы",
        "Печи туристические"
    ]
    
    # Находим subjectIds по названиям
    results = find_subjects_by_names(subjects, target_names)
    
    # Выводим результаты поиска
    print("\nНайденные subjectIds по заданным категориям:")
    print("-" * 80)
    print(f"{'subjectID':<10} | {'subjectName':<40} | {'parentName'}")
    print("-" * 80)
    
    for subject_id, subject_name, parent_name in results:
        print(f"{subject_id:<10} | {subject_name:<40} | {parent_name}")
    
    print("-" * 80)
    print(f"Всего найдено: {len(results)} категорий")
    
    # Сохраняем результаты в файл
    with open("wb_subject_ids_all.txt", "w", encoding="utf-8") as f:
        f.write("Список всех полученных предметов:\n")
        f.write("-" * 80 + "\n")
        f.write(f"{'subjectID':<10} | {'subjectName':<40} | {'parentName'}\n")
        f.write("-" * 80 + "\n")
        
        for subject in subjects:
            subject_id = subject.get('subjectID', 0)
            subject_name = subject.get('subjectName', '')
            parent_name = subject.get('parentName', '')
            f.write(f"{subject_id:<10} | {subject_name:<40} | {parent_name}\n")
        
        f.write("-" * 80 + "\n")
        
        f.write("\nНайденные subjectIds по заданным категориям:\n")
        f.write("-" * 80 + "\n")
        f.write(f"{'subjectID':<10} | {'subjectName':<40} | {'parentName'}\n")
        f.write("-" * 80 + "\n")
        
        for subject_id, subject_name, parent_name in results:
            f.write(f"{subject_id:<10} | {subject_name:<40} | {parent_name}\n")
        
        f.write("-" * 80 + "\n")
        f.write(f"Всего найдено: {len(results)} категорий\n")

    # Создаем список для хранения всех найденных результатов
    all_results = []
    
    # Для каждого названия выполняем отдельный запрос
    for name in target_names:
        subjects = get_wb_subjects_by_name(name)
        all_results.extend(subjects)
        print(f"Добавлено {len(subjects)} предметов для '{name}'")
    
    # Выводим результаты поиска
    print("\nНайденные subjectIds по заданным категориям (точное совпадение):")
    print("-" * 80)
    print(f"{'subjectID':<10} | {'subjectName':<40} | {'parentName'}")
    print("-" * 80)
    
    for subject in all_results:
        subject_id = subject.get('subjectID', 0)
        subject_name = subject.get('subjectName', '')
        parent_name = subject.get('parentName', '')
        print(f"{subject_id:<10} | {subject_name:<40} | {parent_name}")
    
    print("-" * 80)
    print(f"Всего найдено: {len(all_results)} категорий")
    
    # Сохраняем результаты в файл
    with open("wb_subject_ids_exact.txt", "w", encoding="utf-8") as f:
        f.write("Найденные subjectIds по заданным категориям (точное совпадение):\n")
        f.write("-" * 80 + "\n")
        f.write(f"{'subjectID':<10} | {'subjectName':<40} | {'parentName'}\n")
        f.write("-" * 80 + "\n")
        
        for subject in all_results:
            subject_id = subject.get('subjectID', 0)
            subject_name = subject.get('subjectName', '')
            parent_name = subject.get('parentName', '')
            f.write(f"{subject_id:<10} | {subject_name:<40} | {parent_name}\n")
        
        f.write("-" * 80 + "\n")
        f.write(f"Всего найдено: {len(all_results)} категорий\n")

if __name__ == "__main__":
    main() 