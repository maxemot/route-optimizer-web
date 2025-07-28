from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import os
import math

# Используем увеличенный размер для лучшего качества
BLOCK_SIZE = 20
HEAD_SIZE = BLOCK_SIZE * 3
QUALITY_SIZE = HEAD_SIZE * 2  # Увеличиваем размер для качественной обработки

def create_high_quality_head():
    """Создаем высококачественное изображение головы для игры змейка"""
    try:
        # Создаем изображение высокого разрешения
        img = Image.new('RGB', (QUALITY_SIZE, QUALITY_SIZE), (219, 172, 152))  # Телесный цвет
        draw = ImageDraw.Draw(img)
        
        # Волосы (с градиентом для реалистичности)
        for y in range(35):
            darkness = 70 + int(y * 0.7)  # Постепенно темнеет
            color = (darkness, max(30, darkness-40), max(20, darkness-60))
            draw.line([(0, y), (QUALITY_SIZE, y)], fill=color, width=1)
        
        # Затемнение по краям волос для объема
        for x in range(QUALITY_SIZE):
            for y in range(35):
                if x < 20 or x > QUALITY_SIZE-20:
                    darkness = 60 + int(y * 0.5)
                    color = (darkness, max(25, darkness-45), max(15, darkness-65))
                    draw.point((x, y), fill=color)
        
        # Лицо (добавляем тени для объема)
        for x in range(QUALITY_SIZE):
            for y in range(35, QUALITY_SIZE):
                # Вычисляем расстояние от центра для создания овала
                dx = (x - QUALITY_SIZE/2) / (QUALITY_SIZE/2)
                dy = (y - QUALITY_SIZE/2) / (QUALITY_SIZE/2)
                distance = math.sqrt(dx*dx + dy*dy)
                
                # Добавляем затемнение по краям для эффекта объема
                if 0.7 < distance < 1.0:
                    factor = (distance - 0.7) * 3.3  # Контроль затемнения
                    base_color = (219, 172, 152)
                    r = max(80, int(base_color[0] * (1 - factor)))
                    g = max(60, int(base_color[1] * (1 - factor)))
                    b = max(50, int(base_color[2] * (1 - factor)))
                    draw.point((x, y), fill=(r, g, b))
        
        # Глаза (с бликами для реалистичности)
        # Левый глаз
        eye_size = 15
        left_eye_x, left_eye_y = QUALITY_SIZE//3, QUALITY_SIZE//3
        draw.ellipse([(left_eye_x-eye_size, left_eye_y-eye_size), 
                      (left_eye_x+eye_size, left_eye_y+eye_size)], fill=(255, 255, 255))
        draw.ellipse([(left_eye_x-10, left_eye_y-10), 
                      (left_eye_x+10, left_eye_y+10)], fill=(50, 50, 80))
        draw.ellipse([(left_eye_x-5, left_eye_y-5), 
                      (left_eye_x+5, left_eye_y+5)], fill=(0, 0, 0))
        draw.ellipse([(left_eye_x-2, left_eye_y-2), 
                      (left_eye_x+0, left_eye_y+0)], fill=(255, 255, 255))
        
        # Правый глаз
        right_eye_x, right_eye_y = 2*QUALITY_SIZE//3, QUALITY_SIZE//3
        draw.ellipse([(right_eye_x-eye_size, right_eye_y-eye_size), 
                       (right_eye_x+eye_size, right_eye_y+eye_size)], fill=(255, 255, 255))
        draw.ellipse([(right_eye_x-10, right_eye_y-10), 
                      (right_eye_x+10, right_eye_y+10)], fill=(50, 50, 80))
        draw.ellipse([(right_eye_x-5, right_eye_y-5), 
                      (right_eye_x+5, right_eye_y+5)], fill=(0, 0, 0))
        draw.ellipse([(right_eye_x-2, right_eye_y-2), 
                      (right_eye_x+0, right_eye_y+0)], fill=(255, 255, 255))
        
        # Брови
        brow_width = 25
        draw.line([(left_eye_x-brow_width, left_eye_y-eye_size-5), 
                   (left_eye_x+brow_width, left_eye_y-eye_size-10)], fill=(50, 30, 20), width=5)
        draw.line([(right_eye_x-brow_width, right_eye_y-eye_size-10), 
                   (right_eye_x+brow_width, right_eye_y-eye_size-5)], fill=(50, 30, 20), width=5)
        
        # Рот (открытый с деталями)
        mouth_x, mouth_y = QUALITY_SIZE//2, 2*QUALITY_SIZE//3
        # Внутренняя часть рта (красная)
        draw.ellipse([(mouth_x-25, mouth_y-20), (mouth_x+25, mouth_y+20)], fill=(150, 0, 0))
        # Внутренняя часть (еще темнее)
        draw.ellipse([(mouth_x-18, mouth_y-5), (mouth_x+18, mouth_y+15)], fill=(120, 0, 0))
        # Язык
        draw.ellipse([(mouth_x-10, mouth_y+0), (mouth_x+10, mouth_y+18)], fill=(200, 50, 80))
        
        # Зубы (верхний ряд)
        tooth_width = 7
        for i in range(-2, 3):
            tooth_x = mouth_x + i * tooth_width
            draw.rectangle([(tooth_x-3, mouth_y-18), (tooth_x+3, mouth_y-5)], fill=(240, 240, 240))
        
        # Применяем фильтры для повышения качества
        # Немного размываем для смягчения пикселей
        img = img.filter(ImageFilter.GaussianBlur(0.5))
        
        # Повышаем резкость для деталей
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(1.5)
        
        # Увеличиваем контраст
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.2)
        
        # Уменьшаем до нужного размера для игры (60x60)
        img = img.resize((HEAD_SIZE, HEAD_SIZE), Image.LANCZOS)
        
        # Сохраняем с высоким качеством
        img.save('friend_head.jpg', quality=95)
        print("Изображение головы высокого качества создано!")
        return True
        
    except Exception as e:
        print(f"Ошибка создания изображения: {e}")
        return False

if __name__ == "__main__":
    print("Создание высококачественного изображения головы...")
    if create_high_quality_head():
        print("Изображение создано успешно!")
        print("Запустите игру командой: python3 snake_game.py")
    else:
        print("Не удалось создать изображение.") 