from PIL import Image
import os

# Размер головы для игры
BLOCK_SIZE = 20
HEAD_SIZE = BLOCK_SIZE * 3  # 60x60 пикселей

def convert_screenshot_to_head():
    """Конвертирует screenshot.png в friend_head.jpg для игры"""
    try:
        # Проверяем существование файла
        screenshot_path = "screenshot.png"
        if not os.path.exists(screenshot_path):
            print(f"Ошибка: Файл {screenshot_path} не найден")
            return False
            
        print(f"Найден файл {screenshot_path}")
        
        # Открываем изображение
        img = Image.open(screenshot_path)
        print(f"Изображение открыто: размер {img.width}x{img.height}, формат {img.format}, режим {img.mode}")
        
        # Преобразуем RGBA в RGB (удаляем прозрачность)
        if img.mode == 'RGBA':
            print("Конвертируем RGBA в RGB...")
            background = Image.new('RGB', img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[3])  # 3 - это альфа-канал
            img = background
        
        # Обрезаем до квадрата
        width, height = img.size
        size = min(width, height)
        left = (width - size) // 2
        top = (height - size) // 2
        right = left + size
        bottom = top + size
        
        img = img.crop((left, top, right, bottom))
        print(f"Изображение обрезано до {size}x{size}")
        
        # Изменяем размер до размера головы
        img = img.resize((HEAD_SIZE, HEAD_SIZE), Image.LANCZOS)
        print(f"Размер изменен до {HEAD_SIZE}x{HEAD_SIZE}")
        
        # Увеличиваем контрастность
        from PIL import ImageEnhance
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.2)
        
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(1.5)
        
        # Сохраняем как JPG
        img.save("friend_head.jpg", "JPEG", quality=95)
        print("Изображение успешно сохранено как friend_head.jpg")
        
        return True
        
    except Exception as e:
        print(f"Ошибка при обработке изображения: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("КОНВЕРТАЦИЯ СКРИНШОТА В ИЗОБРАЖЕНИЕ ГОЛОВЫ")
    print("=" * 60)
    
    if convert_screenshot_to_head():
        print("\nУспешно! Теперь запустите игру:")
        print("python3 snake_game.py")
    else:
        print("\nНе удалось конвертировать изображение.")
        print("Убедитесь, что файл screenshot.png существует в текущей папке.") 