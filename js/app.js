document.addEventListener('DOMContentLoaded', async function() {
    console.log("Маршрут: Россия - Инициализация...");

    // 1. Ждем авторизацию ВК
    await VK_API.init();
    UI.init();

    // 2. Показываем онбординг (один раз)
    if (!localStorage.getItem('route_russia_onboarding')) {
        document.getElementById('onboarding-modal').style.display = 'flex';
        
        document.getElementById('btn-close-onboarding').onclick = () => {
            document.getElementById('onboarding-modal').style.display = 'none';
            localStorage.setItem('route_russia_onboarding', 'true');
            startGame(); // После онбординга запускаем игру
        };
    } else {
        startGame(); // Если онбординг пройден, запускаем сразу
    }
});

async function startGame() {
    // 1. Показываем панель ресурсов
    document.getElementById('resource-panel').style.display = 'flex';
    
    // 2. Грузим данные
    await DataLoader.init();
    
    // 3. Запускаем карту
    Engine.init();
    
    UI.showToast("Карта загружена! Нажмите на город (Казань или Владимир).");
}