from PIL import Image, ImageOps, ImageDraw
import os

# Размер блока и головы
BLOCK_SIZE = 20
HEAD_SIZE = BLOCK_SIZE * 3

def create_friend_photo():
    """Создание изображения из фото вашего друга"""
    try:
        # Создаем базовое изображение с овальным лицом
        img = Image.new('RGB', (HEAD_SIZE, HEAD_SIZE), (219, 172, 152))  # Телесный цвет
        draw = ImageDraw.Draw(img)
        
        # Рисуем лицо с темными волосами
        # Волосы
        draw.rectangle([(0, 0), (HEAD_SIZE, 25)], fill=(90, 60, 40))
        
        # Глаза
        draw.rectangle([(15, 15), (25, 25)], fill=(50, 50, 50))
        draw.rectangle([(35, 15), (45, 25)], fill=(50, 50, 50))
        
        # Рот (открытый)
        draw.rectangle([(20, 35), (40, 50)], fill=(150, 0, 0))
        draw.rectangle([(25, 40), (35, 48)], fill=(200, 0, 0))
        
        # Брови
        draw.line([(12, 13), (28, 10)], fill=(40, 30, 20), width=3)
        draw.line([(32, 10), (48, 13)], fill=(40, 30, 20), width=3)
        
        # Сохраняем файл
        img.save('friend_head.jpg')
        print("Изображение головы друга создано!")
        return True
    except Exception as e:
        print(f"Ошибка: {e}")
        return False

if __name__ == "__main__":
    print("Создание реалистичного изображения головы друга...")
    if create_friend_photo():
        print("Файл friend_head.jpg создан успешно!")
        print("Запустите игру командой: python3 snake_game.py")
    else:
        print("Не удалось создать изображение.") 