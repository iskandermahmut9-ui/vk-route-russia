window.SaveManager = { /* Код SaveManager из прошлого сообщения оставляем без изменений */ };

window.GameLoop = {
    stats: { coins: 5000, gas: 50, food: 100, wake: 100, hp: 100, xp: 0, kmTraveled: 0, hoursPassed: 0 },
    currentCar: null,

    init: function() {
        this.stats = { ...DataLoader.initialResources, kmTraveled: 0, hoursPassed: 0 };
        // Для теста берем Седан. Позже сделаем выбор через модальное окно.
        this.currentCar = DataLoader.cars.sedan; 
        this.stats.gas = this.currentCar.tankSize; // Заливаем полный бак
        this.updateUI();
    },

    // ВНИМАНИЕ: Честный расчет ресурсов от пройденных километров
    tick: function(kmStep) {
        if (!this.currentCar) return;

        this.stats.kmTraveled += kmStep;
        
        // Время: скорость 80 км/ч (1 км = 0.0125 часа)
        const timePassed = kmStep / 80;
        this.stats.hoursPassed += timePassed;

        // БЕНЗИН: Расход = (литры на 100 км / 100) * пройденные километры
        const fuelBurned = (this.currentCar.consumption / 100) * kmStep;
        this.stats.gas -= fuelBurned;

        // БОДРОСТЬ (Сон): Падает до 0 за 700 км пробега
        const wakeBurned = (kmStep / 700) * 100;
        this.stats.wake -= wakeBurned;

        // ЕДА: Списываем условно 12.5 монет за каждый час в пути (300 монет в сутки)
        this.stats.coins -= (timePassed * 12.5);

        // ИЗНОС: 1% на 100 км для седана
        this.stats.hp -= (kmStep / 100);

        // Защита от ухода в минус
        this.stats.gas = Math.max(0, this.stats.gas);
        this.stats.wake = Math.max(0, this.stats.wake);
        this.stats.hp = Math.max(0, this.stats.hp);
        this.stats.coins = Math.max(0, this.stats.coins);

        this.updateUI();

        // Проверка: Бак пуст!
        if (this.stats.gas === 0) {
            Engine.pauseRoute();
            UI.showModal("Бак пуст!", "Бензин закончился на трассе! Вызывайте эвакуатор.", false, () => {});
        }
    },

    updateUI: function() {
        // Меняем в UI отображение Бензина на Литры (вместо процентов)
        const gasText = `${Math.round(this.stats.gas)} / ${this.currentCar ? this.currentCar.tankSize : 50} л.`;
        
        if(document.getElementById('val-coins')) document.getElementById('val-coins').innerText = Math.round(this.stats.coins);
        if(document.getElementById('val-gas')) document.getElementById('val-gas').innerText = gasText;
        if(document.getElementById('val-wake')) document.getElementById('val-wake').innerText = Math.round(this.stats.wake);
        if(document.getElementById('val-hp')) document.getElementById('val-hp').innerText = Math.round(this.stats.hp);
        if(document.getElementById('val-xp')) document.getElementById('val-xp').innerText = Math.round(this.stats.xp);
        
        if (document.getElementById('stat-km')) {
            document.getElementById('stat-km').innerText = Math.round(this.stats.kmTraveled);
            document.getElementById('stat-hours').innerText = Math.round(this.stats.hoursPassed);
        }
    }
};