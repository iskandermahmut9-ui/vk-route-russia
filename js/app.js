document.addEventListener('DOMContentLoaded', async function() {
    await VK_API.init();
    UI.init();

    document.getElementById('btn-close-app').addEventListener('click', () => {
        UI.showModal("Выход", "Закрыть приложение?", true, () => {
            if (VK_API.isInit) vkBridge.send('VKWebAppClose', { status: 'success' });
            else window.close();
        }, () => {});
    });

    if (!localStorage.getItem('route_russia_onboarding_v4')) {
        document.getElementById('onboarding-modal').style.display = 'flex';
        document.getElementById('btn-close-onboarding').onclick = () => {
            document.getElementById('onboarding-modal').style.display = 'none';
            localStorage.setItem('route_russia_onboarding_v4', 'true');
            startGame();
        };
    } else { startGame(); }
});

async function startGame() {
    document.getElementById('resource-panel').style.display = 'flex';
    
    await DataLoader.init();
    Engine.init();

    // ПЫТАЕМСЯ ЗАГРУЗИТЬ СОХРАНЕНИЕ
    const saved = SaveManager.load();
    
    if (saved && saved.startCitySet) {
        // Восстанавливаем данные
        GameLoop.stats = saved.stats;
        Engine.startCitySet = saved.startCitySet;
        Engine.passedCities = new Set(saved.passedCities);
        
        if (saved.currentCityId) {
            Engine.currentCity = DataLoader.cities.find(c => c.id === saved.currentCityId);
            Engine.carMarker = L.marker(Engine.currentCity.coords).addTo(Engine.map);
            Engine.map.setView(Engine.currentCity.coords, 6);
            
            document.getElementById('trip-stats').style.display = 'flex';
            UI.updateStatus(`Вы в городе ${Engine.currentCity.name}. Выберите цель поездки!`);
            UI.openCityPanel(Engine.currentCity);
        }
        GameLoop.updateUI();
        UI.showToast("Прогресс загружен! Поехали дальше!");
    } else {
        // Если сохранений нет - начинаем новую игру
        GameLoop.init(); 
        UI.showToast("Нажмите на город для старта экспедиции.");
    }
}