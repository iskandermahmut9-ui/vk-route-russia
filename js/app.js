document.addEventListener('DOMContentLoaded', async function() {
    await VK_API.init();
    UI.init();

    document.getElementById('btn-close-app').addEventListener('click', () => {
        UI.showModal("Выход", "Закрыть приложение?", true, () => {
            if (VK_API.isInit) vkBridge.send('VKWebAppClose', { status: 'success' });
            else window.close();
        }, () => {});
    });

    if (!localStorage.getItem('route_russia_onboarding_v5')) {
        document.getElementById('onboarding-modal').style.display = 'flex';
        document.getElementById('btn-close-onboarding').onclick = () => {
            document.getElementById('onboarding-modal').style.display = 'none';
            localStorage.setItem('route_russia_onboarding_v5', 'true');
            startGame();
        };
    } else { startGame(); }
});

async function startGame() {
    document.getElementById('resource-panel').style.display = 'flex';
    
    await DataLoader.init();
    Engine.init();

    const saved = SaveManager.load();
    
    if (saved && saved.startCitySet && saved.currentCar) {
        // ЗАГРУЗКА ИГРЫ
        GameLoop.loadSave(saved.stats, saved.currentCar);
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
        UI.showToast("Прогресс загружен!");
    } else {
        // НОВАЯ ИГРА -> ОТКРЫВАЕМ ГАРАЖ
        UI.renderGarage(DataLoader.cars, (selectedCar) => {
            GameLoop.startNewGame(selectedCar);
            UI.showToast("Выберите город для старта на карте!");
        });
    }
}