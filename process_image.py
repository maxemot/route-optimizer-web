import pygame
import sys
import os
from PIL import Image, ImageOps

pygame.init()

# Размер блока в игре
BLOCK_SIZE = 20

def create_head_image():
    try:
        # Путь к текущей директории
        current_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Создаем пустое изображение с зеленым фоном (как запасной вариант)
        image = Image.new('RGB', (BLOCK_SIZE, BLOCK_SIZE), (0, 255, 0))
        
        # Сохраняем изображение
        head_path = os.path.join(current_dir, "friend_head.jpg")
        image.save(head_path)
        print(f"Изображение головы создано: {head_path}")
        
        print("Для использования реального изображения:")
        print("1. Поместите фотографию друга в файл friend_head.jpg в той же папке")
        print("2. Запустите игру snake_game.py")
        
    except Exception as e:
        print(f"Ошибка при создании изображения: {e}")

if __name__ == "__main__":
    create_head_image() 