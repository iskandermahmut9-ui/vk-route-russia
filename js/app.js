document.addEventListener('DOMContentLoaded', async function() {
    console.log("Маршруты: Россия - Старт");
    await VK_API.init();
    UI.init();

    // Вешаем логику на кнопку закрытия в шапке
    document.getElementById('btn-close-app').addEventListener('click', () => {
        UI.showModal("Выход", "Вы уверены, что хотите закрыть приложение?", true, () => {
            VK_API.closeApp();
        });
    });

    if (!localStorage.getItem('route_russia_onboarding_v2')) {
        document.getElementById('onboarding-modal').style.display = 'flex';
        document.getElementById('btn-close-onboarding').onclick = () => {
            document.getElementById('onboarding-modal').style.display = 'none';
            localStorage.setItem('route_russia_onboarding_v2', 'true');
            startGame();
        };
    } else { startGame(); }
});

async function startGame() {
    document.getElementById('resource-panel').style.display = 'flex';
    await DataLoader.init();
    Engine.init();

    // Устанавливаем начальные ресурсы из DataLoader
    const res = DataLoader.initialResources;
    UI.updateResources(res.coins, res.gas, res.food, res.wake, res.xp);
    
    UI.showToast("Нажмите на город (Казань или Владимир).");
}