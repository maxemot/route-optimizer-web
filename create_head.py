from PIL import Image, ImageDraw
import os

# Создаем цветное изображение головы
def create_custom_head():
    # Размер блока (как в игре)
    BLOCK_SIZE = 20
    HEAD_SIZE = BLOCK_SIZE * 3  # Увеличиваем в 3 раза
    
    # Создаем новое изображение
    img = Image.new('RGB', (HEAD_SIZE, HEAD_SIZE), (255, 182, 193))  # Светло-розовый цвет
    
    # Рисуем контур (чтобы было заметнее в игре)
    draw = ImageDraw.Draw(img)
    draw.rectangle([(0, 0), (HEAD_SIZE-1, HEAD_SIZE-1)], outline=(0, 0, 0))
    
    # Рисуем "лицо" - два глаза и рот, увеличиваем их пропорционально
    draw.rectangle([(15, 15), (21, 21)], fill=(0, 0, 0))  # Левый глаз
    draw.rectangle([(36, 15), (42, 21)], fill=(0, 0, 0))  # Правый глаз
    draw.rectangle([(24, 36), (36, 42)], fill=(255, 0, 0))  # Рот
    
    # Сохраняем изображение
    img.save('friend_head.jpg')
    print("Файл friend_head.jpg создан успешно!")
    print("Теперь запустите игру: python3 snake_game.py")

if __name__ == "__main__":
    create_custom_head() 