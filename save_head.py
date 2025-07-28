import pygame
import os
from PIL import Image, ImageOps

"""
Этот скрипт поможет сохранить фото друга для использования в игре "Змейка".
Вы можете использовать его двумя способами:
1. Сохраните фото вашего друга как screenshot.png в текущей папке
2. Вручную скопируйте любое изображение как friend_head.jpg в текущую папку
"""

def save_head_from_screenshot():
    try:
        # Проверяем, существует ли скриншот
        screenshot_path = os.path.join(os.getcwd(), "screenshot.png")
        if os.path.exists(screenshot_path):
            print("Найден файл screenshot.png")
            
            # Открываем и обрабатываем изображение
            img = Image.open(screenshot_path)
            
            # Обрезаем изображение до квадрата (просто берем центральную часть)
            width, height = img.size
            size = min(width, height)
            left = (width - size) // 2
            top = (height - size) // 2
            right = left + size
            bottom = top + size
            
            # Обрезаем изображение
            img = img.crop((left, top, right, bottom))
            
            # Изменяем размер до 20x20 пикселей
            img = img.resize((20, 20))
            
            # Сохраняем обработанное изображение
            head_path = os.path.join(os.getcwd(), "friend_head.jpg")
            img.save(head_path)
            
            print(f"Изображение успешно сохранено: {head_path}")
            print("Теперь вы можете запустить игру: python3 snake_game.py")
            return True
        else:
            print("Файл screenshot.png не найден")
            return False
            
    except Exception as e:
        print(f"Ошибка при обработке изображения: {e}")
        return False

if __name__ == "__main__":
    print("Сохранение изображения головы для игры змейка...")
    
    if not save_head_from_screenshot():
        print("\nИнструкция по использованию своего изображения:")
        print("1. Сохраните фото вашего друга как screenshot.png в этой папке")
        print("2. Запустите этот скрипт снова: python3 save_head.py")
        print("   ИЛИ")
        print("3. Вручную скопируйте готовое изображение как friend_head.jpg в эту папку")
        print("4. Запустите игру: python3 snake_game.py") 