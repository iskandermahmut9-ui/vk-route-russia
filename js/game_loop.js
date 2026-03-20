window.GameLoop = {
    stats: {
        coins: 5000, gas: 100, food: 100, wake: 100, hp: 100, xp: 0,
        kmTraveled: 0, hoursPassed: 0
    },

    init: function() {
        // Подтягиваем начальные значения из DataLoader
        this.stats = { ...DataLoader.initialResources, kmTraveled: 0, hoursPassed: 0 };
        this.updateUI();
    },

    // Эта функция вызывается из engine.js во время движения машинки
    tick: function(kmStep) {
        this.stats.kmTraveled += kmStep;
        this.stats.hoursPassed += (kmStep / 80); // Условная средняя скорость 80 км/ч

        // Трата ресурсов (настраивается баланс)
        this.stats.gas -= (kmStep * 0.08); // 8% бака на 100 км
        this.stats.food -= (kmStep * 0.04); 
        this.stats.wake -= (kmStep * 0.06); 
        this.stats.hp -= (kmStep * 0.01); // Машина ломается медленно

        // Не даем уйти в минус
        this.stats.gas = Math.max(0, this.stats.gas);
        this.stats.food = Math.max(0, this.stats.food);
        this.stats.wake = Math.max(0, this.stats.wake);
        this.stats.hp = Math.max(0, this.stats.hp);

        this.updateUI();

        // Проверка на проигрыш (Закончился бензин)
        if (this.stats.gas === 0) {
            Engine.pauseRoute();
            UI.showModal("Бак пуст!", "Бензин закончился на трассе! Попросите помощь или посмотрите рекламу.", false, () => {});
        }
    },

    updateUI: function() {
        UI.updateResources(this.stats.coins, this.stats.gas, this.stats.food, this.stats.wake, this.stats.hp, this.stats.xp);
        
        // Обновляем счетчики пробега
        document.getElementById('stat-km').innerText = Math.round(this.stats.kmTraveled);
        document.getElementById('stat-hours').innerText = Math.round(this.stats.hoursPassed);
    }
};