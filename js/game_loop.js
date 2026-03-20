window.SaveManager = {
    save: function() {
        const data = {
            stats: GameLoop.stats,
            currentCityId: Engine.currentCity ? Engine.currentCity.id : null,
            startCitySet: Engine.startCitySet,
            passedCities: Array.from(Engine.passedCities)
        };
        localStorage.setItem('route_russia_save', JSON.stringify(data));
        console.log("💾 Прогресс сохранен!");
    },
    load: function() {
        const saved = localStorage.getItem('route_russia_save');
        return saved ? JSON.parse(saved) : null;
    },
    clear: function() {
        localStorage.removeItem('route_russia_save');
    }
};

window.GameLoop = {
    stats: { coins: 5000, gas: 100, food: 100, wake: 100, hp: 100, xp: 0, kmTraveled: 0, hoursPassed: 0 },

    init: function() {
        this.stats = { ...DataLoader.initialResources, kmTraveled: 0, hoursPassed: 0 };
        this.updateUI();
    },

    tick: function(kmStep) {
        this.stats.kmTraveled += kmStep;
        this.stats.hoursPassed += (kmStep / 80); // Условная скорость 80 км/ч

        // Трата ресурсов 
        this.stats.gas -= (kmStep * 0.08); 
        this.stats.food -= (kmStep * 0.04); 
        this.stats.wake -= (kmStep * 0.06); 
        this.stats.hp -= (kmStep * 0.01); 

        // Не уходим в минус
        this.stats.gas = Math.max(0, this.stats.gas);
        this.stats.food = Math.max(0, this.stats.food);
        this.stats.wake = Math.max(0, this.stats.wake);
        this.stats.hp = Math.max(0, this.stats.hp);

        this.updateUI();

        // Проигрыш - закончился бензин
        if (this.stats.gas === 0) {
            Engine.pauseRoute();
            UI.showModal("Бак пуст!", "Бензин закончился на трассе! Начать экспедицию заново?", true, 
                () => {
                    SaveManager.clear();
                    window.location.reload(); // Перезагружаем игру
                }, 
                () => {} // Отмена
            );
        }
    },

    updateUI: function() {
        UI.updateResources(this.stats.coins, this.stats.gas, this.stats.food, this.stats.wake, this.stats.hp, this.stats.xp);
        
        if (document.getElementById('stat-km')) {
            document.getElementById('stat-km').innerText = Math.round(this.stats.kmTraveled);
            document.getElementById('stat-hours').innerText = Math.round(this.stats.hoursPassed);
        }
    }
};