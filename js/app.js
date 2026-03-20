document.addEventListener('DOMContentLoaded', async function() {
    await VK_API.init();
    UI.init();

    // Кнопка закрытия (Фикс: если не ВК, закрывает вкладку)
    document.getElementById('btn-close-app').addEventListener('click', () => {
        UI.showModal("Выход", "Закрыть приложение?", true, () => {
            if (VK_API.isInit) {
                vkBridge.send('VKWebAppClose', { status: 'success' });
            } else {
                window.close(); // Для обычного браузера
            }
        });
    });

    if (!localStorage.getItem('route_russia_onboarding_v3')) {
        document.getElementById('onboarding-modal').style.display = 'flex';
        document.getElementById('btn-close-onboarding').onclick = () => {
            document.getElementById('onboarding-modal').style.display = 'none';
            localStorage.setItem('route_russia_onboarding_v3', 'true');
            startGame();
        };
    } else { startGame(); }
});

async function startGame() {
    document.getElementById('resource-panel').style.display = 'flex';
    
    await DataLoader.init();
    Engine.init();
    GameLoop.init(); // ЗАПУСКАЕМ ЭКОНОМИКУ!
}