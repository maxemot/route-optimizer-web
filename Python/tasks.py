import pandas as pd
import os
import sys
from collections import defaultdict

def find_all_sources(df, target, visited=None):
    """Рекурсивно находит все исходные вершины для заданной целевой"""
    if visited is None:
        visited = set()
    
    if target in visited:
        return set()
    
    visited.add(target)
    sources = set()
    
    # Находим прямые источники для целевой вершины
    direct_sources = df[df['делаем деталь'].str.strip() == target]['берем деталь'].str.strip()
    
    for source in direct_sources:
        sources.add(source)
        # Рекурсивно ищем источники для каждого найденного source
        sources.update(find_all_sources(df, source, visited))
    
    return sources

def get_unique_nodes(target_product):
    try:
        # Путь к файлу
        file_path = '/Users/maksimshchegolikhin/Desktop/Programming/Table.csv'
        
        if not os.path.exists(file_path):
            print(f"❌ Ошибка: Файл не найден: {file_path}")
            return
            
        # Читаем нужные столбцы
        df = pd.read_csv(file_path, sep=';')
        
        # Находим все вершины, связанные с целевым продуктом
        all_related_nodes = find_all_sources(df, target_product)
        all_related_nodes.add(target_product)  # Добавляем сам целевой продукт
        
        # Фильтруем DataFrame, оставляя только строки, связанные с нашим продуктом
        df_filtered = df[
            (df['берем деталь'].str.strip().isin(all_related_nodes)) & 
            (df['делаем деталь'].str.strip().isin(all_related_nodes))
        ]
        
        # Если нет данных, выводим сообщение
        if df_filtered.empty:
            print(f"❌ Не найдены данные для изделия: {target_product}")
            return
        
        # Находим стартовые вершины (те, которые есть только в столбце A)
        all_sources = set(df_filtered['берем деталь'].str.strip())
        all_targets = set(df_filtered['делаем деталь'].str.strip())
        start_nodes = all_sources - all_targets
        
        # Находим все нестартовые вершины
        non_start_nodes = all_sources.union(all_targets) - start_nodes
        
        # Сортируем вершины для удобства чтения
        sorted_nodes = sorted(list(non_start_nodes))
        
        # Выводим результат
        print(f"\n📊 Уникальные нестартовые вершины для изделия {target_product}:")
        print("=" * 50)
        for i, node in enumerate(sorted_nodes, 1):
            print(f"{i}. {node}")
        print("=" * 50)
        print(f"Всего вершин: {len(sorted_nodes)}")
        
    except Exception as e:
        print(f"❌ Ошибка: {str(e)}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("❌ Пожалуйста, укажите название изделия в качестве аргумента")
        print("Пример: python get_nodes.py 02.07.01.С01")
        sys.exit(1)
    
    target_product = sys.argv[1].strip()
    get_unique_nodes(target_product)