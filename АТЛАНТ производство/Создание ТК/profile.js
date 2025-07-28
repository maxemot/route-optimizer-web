/**
 * Функция для открытия профиля пользователя
 * Отображает логин, дату и статистику по техкартам
 */
function showUserProfile() {
  try {
    // Получаем имя пользователя из активной сессии
    const userEmail = Session.getActiveUser().getEmail();
    const username = userEmail.split('@')[0];
    
    // Получаем информацию о доступе и уровне пользователя
    const accessInfo = getUserAccessInfo(userEmail);
    const hasSalaryAccess = accessInfo.access === 1;
    
    // Получаем текущую дату
    const currentDate = new Date();
    const formattedDate = Utilities.formatDate(currentDate, Session.getScriptTimeZone(), "dd.MM.yyyy");
    
    // Получаем данные за текущий и предыдущий месяцы
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    // Получаем первое число текущего месяца
    const currentMonthStart = new Date(currentYear, currentMonth, 1);
    
    // Получаем первое число предыдущего месяца
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const prevMonthStart = new Date(prevYear, prevMonth, 1);
    
    // Получаем название текущего и предыдущего месяцев
    const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", 
                        "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
    const currentMonthName = monthNames[currentMonth];
    const prevMonthName = monthNames[prevMonth];
    
    // Получаем статистику за каждый месяц
    const currentMonthStats = getMonthlyStats(username, currentMonthStart, currentDate, accessInfo.level);
    const prevMonthStats = getMonthlyStats(username, prevMonthStart, currentMonthStart, accessInfo.level);
    
    // Форматируем значения согласно требованиям
    const formatHours = (hours) => hours.toFixed(1).replace('.', ',') + 'ч';
    const formatIncome = (income) => Math.round(income) + 'руб';
    
    // Используем аватар с первой буквой имени, т.к. доступ к People API ограничен
    // Ошибка: "The caller does not have permission to request people/me. Request requires one of the following scopes: [profile]."
    const firstLetter = username.charAt(0).toUpperCase();
    
    // Формируем HTML для отображения профиля
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <base target="_top">
          <meta charset="UTF-8">
          <title>Профиль пользователя</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
            }
            .profile-container {
              max-width: 800px;
              margin: 0 auto;
              background-color: white;
              border-radius: 10px;
              padding: 20px;
            }
            .profile-header {
              display: flex;
              align-items: center;
              margin-bottom: 20px;
              padding-bottom: 15px;
              border-bottom: 1px solid #eee;
            }
            .avatar {
              width: 80px;
              height: 80px;
              background-color: #9166AA;
              border-radius: 50%;
              color: white;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 32px;
              font-weight: bold;
              margin-right: 20px;
              overflow: hidden;
            }
            .avatar img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
            .user-info {
              flex: 1;
            }
            .username {
              font-size: 24px;
              font-weight: bold;
              margin: 0 0 5px 0;
            }
            .date {
              color: #666;
              margin: 0;
            }
            .stats-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
              font-size: 16px; /* Увеличенный на 2 пункта размер шрифта */
            }
            .stats-table th, .stats-table td {
              padding: 12px 15px;
              text-align: center;
              border: 1px solid #ddd;
            }
            .stats-table th {
              background-color: #f2f2f2;
              font-weight: bold;
            }
            .stats-table td.month {
              font-weight: bold;
              text-align: left;
            }
            .section-title {
              font-size: 18px;
              font-weight: bold;
              margin: 30px 0 15px 0;
              color: #333;
            }
            .income {
              color: #28a745;
              font-weight: bold;
              font-size: 18px; /* Увеличенный на 4 пункта размер шрифта */
            }
            @keyframes countUp {
              from { opacity: 0.8; color: #28a745; }
              to { opacity: 1; color: #28a745; }
            }
            @keyframes pulsate {
              0% { transform: scale(1); }
              50% { transform: scale(1.05); }
              100% { transform: scale(1); }
            }
            .animated-income {
              animation: countUp 0.1s ease-out;
            }
            .pulsate {
              display: inline-block;
              animation: pulsate 0.8s ease-in-out;
            }
          </style>
          <script>
            // Функция анимации счетчика
            function animateCounter(elementId, targetValue, duration) {
              const element = document.getElementById(elementId);
              if (!element) return;
              
              // Начальное значение
              let startValue = 0;
              
              // Конвертируем целевое значение в число
              targetValue = parseInt(targetValue, 10);
              if (isNaN(targetValue)) targetValue = 0;
              
              // Защита от деления на ноль
              if (targetValue === 0) {
                element.textContent = "0руб";
                return;
              }
              
              // Количество шагов (приблизительно 60 кадров в секунду)
              const steps = duration * 60;
              const increment = targetValue / steps;
              let currentValue = startValue;
              let currentStep = 0;
              
              function updateCounter() {
                currentStep++;
                
                if (currentStep <= steps) {
                  // Увеличиваем значение
                  currentValue += increment;
                  
                  // Округляем значение для отображения (всегда с 0 в конце - до десятков)
                  let displayValue = Math.floor(currentValue / 10) * 10;
                  
                  // Обновляем текст
                  element.textContent = displayValue + "руб";
                  
                  // Добавляем эффект мигания при изменении
                  element.classList.remove('animated-income');
                  void element.offsetWidth; // Перезапускаем анимацию
                  element.classList.add('animated-income');
                  
                  // Планируем следующее обновление
                  requestAnimationFrame(updateCounter);
                } else {
                  // Убеждаемся, что в конце отображается точное значение
                  // Округляем до десятков для итогового отображения (всегда вниз)
                  let finalValue = Math.floor(targetValue / 10) * 10;
                  element.textContent = finalValue + "руб";
                  
                  // Добавляем эффект пульсации после завершения основной анимации
                  setTimeout(function() {
                    element.classList.add('pulsate');
                    // Удаляем класс пульсации после завершения анимации,
                    // чтобы можно было повторить анимацию при необходимости
                    setTimeout(function() {
                      element.classList.remove('pulsate');
                    }, 800); // 800мс - длительность анимации pulsate
                  }, 100); // Небольшая задержка перед пульсацией
                }
              }
              
              // Запускаем анимацию
              updateCounter();
            }
            
            // Запускаем анимацию после загрузки страницы
            window.onload = function() {
              if (${hasSalaryAccess}) {
                // Получаем целевые значения из data-атрибутов
                const prevMonthIncome = document.getElementById('prevMonthIncome').getAttribute('data-value');
                const currentMonthIncome = document.getElementById('currentMonthIncome').getAttribute('data-value');
                
                // Запускаем анимацию с задержкой 300мс для лучшего восприятия
                setTimeout(function() {
                  animateCounter('prevMonthIncome', prevMonthIncome, 3); // 3 секунды
                  animateCounter('currentMonthIncome', currentMonthIncome, 3); // 3 секунды
                }, 300);
              }
            };
          </script>
        </head>
        <body>
          <div class="profile-container">
            <div class="profile-header">
              <div class="avatar">${firstLetter}</div>
              <div class="user-info">
                <h1 class="username">${username}</h1>
                <p class="date">Текущая дата: ${formattedDate}</p>
              </div>
            </div>
            
            <h2 class="section-title">Статистика выполнения техкарт</h2>
            
            <table class="stats-table">
              <thead>
                <tr>
                  <th style="text-align: left;">Месяц</th>
                  <th>Сделано ТК</th>
                  <th>Время работы</th>
                  <th>Доход (руб)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="month">${prevMonthName}</td>
                  <td>${prevMonthStats.completedTasks}</td>
                  <td>${formatHours(prevMonthStats.totalHours)}</td>
                  <td class="income">
                    ${hasSalaryAccess 
                      ? `<span id="prevMonthIncome" data-value="${Math.round(prevMonthStats.totalIncome)}">0руб</span>` 
                      : '<span>Данные недоступны</span>'}
                  </td>
                </tr>
                <tr>
                  <td class="month">${currentMonthName}</td>
                  <td>${currentMonthStats.completedTasks}</td>
                  <td>${formatHours(currentMonthStats.totalHours)}</td>
                  <td class="income">
                     ${hasSalaryAccess 
                       ? `<span id="currentMonthIncome" data-value="${Math.round(currentMonthStats.totalIncome)}">0руб</span>` 
                       : '<span>Данные недоступны</span>'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `;
    
    // Отображаем HTML в диалоговом окне
    const htmlOutput = HtmlService.createHtmlOutput(html)
      .setWidth(850)
      .setHeight(500);
    
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Профиль');
    
  } catch (e) {
    Logger.log('Ошибка при отображении профиля: ' + e.stack);
    SpreadsheetApp.getUi().alert('Произошла ошибка: ' + e.message);
  }
}

/**
 * Получает информацию о профиле пользователя, включая фото
 * @param {string} userEmail - Email пользователя
 * @return {Object} Информация о пользователе
 */
function getUserProfileInfo(userEmail) {
  try {
    const userInfo = {
      photoUrl: null
    };
    
    // Вариант 1: Получаем фото напрямую из профиля Google
    try {
      Logger.log('Пытаемся получить фото через People API...');
      
      // Проверяем, доступно ли API
      if (typeof People !== 'undefined') {
        // Получаем информацию о текущем пользователе
        const response = People.People.getBatchGet({
          resourceNames: ['people/me'],
          personFields: 'photos'
        });
        
        Logger.log('Ответ от People API: ' + JSON.stringify(response));
        
        if (response && response.responses && response.responses.length > 0) {
          const person = response.responses[0].person;
          if (person && person.photos && person.photos.length > 0) {
            // Берем URL первой фотографии
            userInfo.photoUrl = person.photos[0].url;
            Logger.log('Найден URL фото: ' + userInfo.photoUrl);
          }
        }
      } else {
        Logger.log('People API не определен. Библиотека People API не подключена.');
      }
    } catch (e) {
      Logger.log('Ошибка при получении фото через People API: ' + e.toString());
      
      // Вариант 2: Пробуем получить фото через ContactsApp (устаревший метод, но может работать)
      try {
        Logger.log('Пробуем получить фото через ContactsApp...');
        if (typeof ContactsApp !== 'undefined') {
          const contact = ContactsApp.getContact(userEmail);
          if (contact) {
            // Получаем изображение через контакт
            const contactImage = contact.getImageUrl();
            if (contactImage) {
              userInfo.photoUrl = contactImage;
              Logger.log('Найден URL фото через ContactsApp: ' + userInfo.photoUrl);
            }
          }
        }
      } catch (e2) {
        Logger.log('Ошибка при получении фото через ContactsApp: ' + e2.toString());
      }
      
      // Вариант 3: Пробуем получить фото через Apps Script User API
      try {
        Logger.log('Пробуем создать URL фото на основе email через Gravatar...');
        // Используем Gravatar как запасной вариант
        const hash = Utilities.computeDigest(
          Utilities.DigestAlgorithm.MD5,
          userEmail.trim().toLowerCase()
        );
        
        // Преобразуем хеш в строку hex
        const hexHash = Array.prototype.map.call(
          hash,
          function(byte) {
            return ('0' + (byte & 0xFF).toString(16)).slice(-2);
          }
        ).join('');
        
        // Создаем URL Gravatar
        userInfo.photoUrl = 'https://www.gravatar.com/avatar/' + hexHash + '?d=404';
        Logger.log('Создан URL Gravatar: ' + userInfo.photoUrl);
      } catch (e3) {
        Logger.log('Ошибка при создании URL Gravatar: ' + e3.toString());
      }
    }
    
    // Выводим результат
    Logger.log('Итоговый URL фото: ' + (userInfo.photoUrl || 'не найден'));
    return userInfo;
  } catch (e) {
    Logger.log('Общая ошибка при получении информации о пользователе: ' + e.toString());
    return { photoUrl: null };
  }
}

/**
 * Получает информацию о доступе и уровне сотрудника из листа "Доступы"
 * @param {string} email - Email пользователя для поиска
 * @return {{level: number, access: number}} - Объект с уровнем и флагом доступа
 */
function getUserAccessInfo(email) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const accessSheet = ss.getSheetByName("Доступы");
    if (!accessSheet) {
      Logger.log('Лист "Доступы" не найден.');
      return { level: 0, access: 0 };
    }

    const data = accessSheet.getDataRange().getValues();
    // Ищем пользователя в столбце B (индекс 1)
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] && data[i][1].toString().trim().toLowerCase() === email.trim().toLowerCase()) {
        const userLevel = parseInt(data[i][34], 10) || 0; // Уровень в столбце AI (индекс 34)
        const salaryAccess = parseInt(data[i][36], 10) || 0; // Доступ к ЗП в столбце AK (индекс 36)
        return { level: userLevel, access: salaryAccess };
      }
    }
    
    Logger.log('Пользователь ' + email + ' не найден в листе "Доступы".');
    return { level: 0, access: 0 }; // Возвращаем значения по умолчанию, если не нашли

  } catch (e) {
    Logger.log('Ошибка при получении данных из листа "Доступы": ' + e.toString());
    return { level: 0, access: 0 };
  }
}


/**
 * Функция для получения статистики за указанный месяц
 * @param {string} username - имя пользователя
 * @param {Date} startDate - начало периода
 * @param {Date} endDate - конец периода
 * @param {number} userLevel - уровень сотрудника
 * @return {Object} объект со статистикой
 */
function getMonthlyStats(username, startDate, endDate, userLevel) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tkSheet = ss.getSheetByName("ТК");
    
    if (!tkSheet) {
      Logger.log('Вкладка "ТК" не найдена');
      return {
        completedTasks: 0,
        totalHours: 0,
        totalIncome: 0
      };
    }
    
    // Получаем все данные с вкладки ТК
    const data = tkSheet.getDataRange().getValues();

    // Ставки по уровням
    const rates = {
      1: 320, // руб/час
      2: 360,
      3: 400
    };
    const userRate = rates[userLevel] || 0; // Получаем ставку или 0, если уровень не найден
    
    let completedTasks = 0;
    let totalMinutes = 0;
    let totalIncome = 0;
    
    // Пропускаем заголовок таблицы
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const taskStatus = row[5]; // Статус (Столбец F)
      const endTime = row[7] ? new Date(row[7]) : null; // Время окончания (Столбец H)
      const worker = row[8]; // Работник (Столбец I)
      const timeInMinutes = row[12]; // Время в минутах из столбца M (индекс 12)
      
      // Проверяем, что задача выполнена, соответствует текущему пользователю и попадает в указанный период
      if (taskStatus === 'готово' && worker === username && endTime && 
          endTime >= startDate && endTime < endDate) {
        
        completedTasks++;
        
        if (timeInMinutes && !isNaN(timeInMinutes)) {
          const minutes = Number(timeInMinutes);
          totalMinutes += minutes;
          // Рассчитываем доход на основе времени из столбца M и ставки пользователя
          totalIncome += (minutes / 60) * userRate;
        }
      }
    }
    
    // Переводим общее время из минут в часы
    const totalHours = totalMinutes / 60;
    
    return {
      completedTasks,
      totalHours,
      totalIncome
    };
    
  } catch (e) {
    Logger.log('Ошибка при получении статистики: ' + e);
    return {
      completedTasks: 0,
      totalHours: 0,
      totalIncome: 0
    };
  }
} 