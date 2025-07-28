from PIL import Image, ImageOps
import os
import sys

def save_friend_image():
    try:
        print("Извлечение изображения друга из первоначальной фотографии...")
        
        # Путь к файлу изображения
        # Пользователь должен сохранить фото друга как original_photo.jpg
        # или можно использовать скриншот из предыдущего сообщения
        original_photo = "original_photo.jpg"
        
        if not os.path.exists(original_photo):
            print(f"Ошибка: Файл {original_photo} не найден.")
            print("Пожалуйста, сохраните фото вашего друга как 'original_photo.jpg' в той же папке")
            print("и запустите этот скрипт снова.")
            return False
        
        # Открываем изображение
        img = Image.open(original_photo)
        
        # Определяем размер головы (в 3 раза больше блока игры)
        BLOCK_SIZE = 20
        HEAD_SIZE = BLOCK_SIZE * 3
        
        # Изменяем размер изображения, сохраняя пропорции
        img = img.resize((HEAD_SIZE, HEAD_SIZE))
        
        # Сохраняем обработанное изображение
        img.save("friend_head.jpg")
        
        print("Изображение друга успешно сохранено как 'friend_head.jpg'")
        print("Теперь запустите игру: python3 snake_game.py")
        return True
        
    except Exception as e:
        print(f"Ошибка при обработке изображения: {e}")
        return False

if __name__ == "__main__":
    # Выводим инструкцию
    print("=" * 60)
    print("СОХРАНЕНИЕ ФОТО ДРУГА ДЛЯ ИГРЫ ЗМЕЙКА")
    print("=" * 60)
    print("1. Сохраните фото вашего друга как 'original_photo.jpg' в этой папке")
    print("2. Запустите этот скрипт")
    print("3. Запустите игру: python3 snake_game.py")
    print("=" * 60)
    
    # Создаем пример изображения, если оригинала нет
    if not os.path.exists("original_photo.jpg"):
        try:
            # Создаем временное изображение с инструкцией
            temp_img = Image.new('RGB', (300, 300), (255, 255, 255))
            temp_img.save("original_photo.jpg")
            print("Создан пример файла 'original_photo.jpg'.")
            print("Замените его на реальное фото вашего друга и запустите скрипт снова.")
        except:
            print("Не удалось создать пример файла.")
    else:
        save_friend_image() 