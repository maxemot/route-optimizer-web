import pygame
import time
import random
import os

# Инициализация pygame
pygame.init()

# Определение цветов
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (213, 50, 80)
GREEN = (0, 255, 0)
BLUE = (50, 153, 213)

# Настройки экрана
WIDTH, HEIGHT = 800, 600
BLOCK_SIZE = 20
HEAD_SIZE = BLOCK_SIZE * 3  # Размер головы в 3 раза больше
GAME_SPEED = 15

# Инициализация экрана
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption('Змейка')
clock = pygame.time.Clock()

# Шрифты
font_style = pygame.font.SysFont("bahnschrift", 25)
score_font = pygame.font.SysFont("comicsansms", 35)

# Загрузка и обработка изображения головы друга
# Сохраняем фото друга в ту же папку, где находится игра
current_dir = os.path.dirname(os.path.abspath(__file__))
head_image_path = os.path.join(current_dir, "friend_head.jpg")

# Проверка наличия изображения
use_custom_head = os.path.exists(head_image_path)

if use_custom_head:
    try:
        # Загружаем основное изображение
        head_image = pygame.image.load(head_image_path)
        head_image = pygame.transform.scale(head_image, (HEAD_SIZE, HEAD_SIZE))
        
        # Создаем повернутые варианты для каждого направления
        head_right = head_image  # Оригинальное изображение для движения вправо
        head_left = pygame.transform.flip(head_image, True, False)  # Отразить по горизонтали для движения влево
        head_up = pygame.transform.rotate(head_image, 90)  # Повернуть для движения вверх
        head_down = pygame.transform.rotate(head_image, -90)  # Повернуть для движения вниз
    except:
        use_custom_head = False
        print("Не удалось загрузить изображение головы")

def display_score(score):
    """Отображает текущий счет на экране"""
    value = score_font.render(f"Счет: {score}", True, BLACK)
    screen.blit(value, [10, 10])

def draw_snake(snake_list, direction):
    """Отрисовывает змейку на экране"""
    for i, block in enumerate(snake_list):
        if i == len(snake_list) - 1 and use_custom_head:  # Это голова змейки
            # Вычисляем положение так, чтобы центр большой головы совпадал с координатами
            head_x = block[0] - (HEAD_SIZE - BLOCK_SIZE) // 2
            head_y = block[1] - (HEAD_SIZE - BLOCK_SIZE) // 2
            
            # Выбираем правильное изображение головы в зависимости от направления
            if direction == "RIGHT":
                screen.blit(head_right, [head_x, head_y])
            elif direction == "LEFT":
                screen.blit(head_left, [head_x, head_y])
            elif direction == "UP":
                screen.blit(head_up, [head_x, head_y])
            elif direction == "DOWN":
                screen.blit(head_down, [head_x, head_y])
        else:  # Это тело змейки
            pygame.draw.rect(screen, GREEN, [block[0], block[1], BLOCK_SIZE, BLOCK_SIZE])

def message(msg, color):
    """Выводит сообщение на экран"""
    mesg = font_style.render(msg, True, color)
    screen.blit(mesg, [WIDTH // 6, HEIGHT // 3])

def game_loop():
    """Основной игровой цикл"""
    game_over = False
    game_close = False
    
    # Начальное положение змейки
    x = WIDTH // 2
    y = HEIGHT // 2
    
    # Начальное изменение координат
    x_change = 0
    y_change = 0
    
    # Текущее направление (изначально нет направления)
    direction = "RIGHT"
    
    # Змейка представлена как список сегментов
    snake_list = []
    length_of_snake = 1
    
    # Начальное положение еды
    foodx = round(random.randrange(0, WIDTH - BLOCK_SIZE) / BLOCK_SIZE) * BLOCK_SIZE
    foody = round(random.randrange(0, HEIGHT - BLOCK_SIZE) / BLOCK_SIZE) * BLOCK_SIZE
    
    while not game_over:
        
        # Экран конца игры
        while game_close:
            screen.fill(WHITE)
            message("Вы проиграли! Нажмите Q для выхода или C для повторной игры", RED)
            display_score(length_of_snake - 1)
            pygame.display.update()
            
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    game_over = True
                    game_close = False
                if event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_q:
                        game_over = True
                        game_close = False
                    if event.key == pygame.K_c:
                        game_loop()
        
        # Обработка ввода
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                game_over = True
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_LEFT and x_change == 0:
                    x_change = -BLOCK_SIZE
                    y_change = 0
                    direction = "LEFT"
                elif event.key == pygame.K_RIGHT and x_change == 0:
                    x_change = BLOCK_SIZE
                    y_change = 0
                    direction = "RIGHT"
                elif event.key == pygame.K_UP and y_change == 0:
                    y_change = -BLOCK_SIZE
                    x_change = 0
                    direction = "UP"
                elif event.key == pygame.K_DOWN and y_change == 0:
                    y_change = BLOCK_SIZE
                    x_change = 0
                    direction = "DOWN"
        
        # Проверка выхода за границы
        if x >= WIDTH or x < 0 or y >= HEIGHT or y < 0:
            game_close = True
        
        # Обновление позиции змейки
        x += x_change
        y += y_change
        
        # Рисование
        screen.fill(WHITE)
        pygame.draw.rect(screen, RED, [foodx, foody, BLOCK_SIZE, BLOCK_SIZE])
        
        # Добавление нового блока для змейки
        snake_head = []
        snake_head.append(x)
        snake_head.append(y)
        snake_list.append(snake_head)
        
        # Удаление лишних сегментов
        if len(snake_list) > length_of_snake:
            del snake_list[0]
        
        # Проверка столкновения с самой собой
        for segment in snake_list[:-1]:
            if segment == snake_head:
                game_close = True
        
        # Рисуем змейку и счет
        draw_snake(snake_list, direction)
        display_score(length_of_snake - 1)
        
        pygame.display.update()
        
        # Проверка на поедание еды
        if x == foodx and y == foody:
            foodx = round(random.randrange(0, WIDTH - BLOCK_SIZE) / BLOCK_SIZE) * BLOCK_SIZE
            foody = round(random.randrange(0, HEIGHT - BLOCK_SIZE) / BLOCK_SIZE) * BLOCK_SIZE
            length_of_snake += 1
        
        # Установка скорости игры
        clock.tick(GAME_SPEED)
    
    # Завершение игры
    pygame.quit()
    quit()

# Запуск игры
if __name__ == "__main__":
    game_loop() 