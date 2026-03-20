window.SaveManager = {
    save: function() {
        const data = {
            stats: GameLoop.stats, currentCar: GameLoop.currentCar,
            currentCityId: Engine.currentCity ? Engine.currentCity.id : null,
            startCitySet: Engine.startCitySet, passedCities: Array.from(Engine.passedCities)
        };
        localStorage.setItem('route_russia_save_v5', JSON.stringify(data));
    },
    load: function() {
        const saved = localStorage.getItem('route_russia_save_v5');
        return saved ? JSON.parse(saved) : null;
    },
    clear: function() { localStorage.removeItem('route_russia_save_v5'); }
};

window.GameLoop = {
    stats: { coins: 5000, gas: 0, food: 100, wake: 100, hp: 100, xp: 0, kmTraveled: 0, hoursPassed: 0 },
    currentCar: null,

    // Вызывается из app.js ПОСЛЕ выбора машины в гараже
    startNewGame: function(selectedCar) {
        this.currentCar = selectedCar;
        this.stats = { ...DataLoader.initialResources, kmTraveled: 0, hoursPassed: 0 };
        this.stats.gas = selectedCar.tankSize; // Полный бак на старте!
        this.updateUI();
    },

    loadSave: function(savedStats, savedCar) {
        this.stats = savedStats;
        this.currentCar = savedCar;
        this.updateUI();
    },

    tick: function(kmStep) {
        if (!this.currentCar) return;

        this.stats.kmTraveled += kmStep;
        const timePassed = kmStep / 80; // 80 км/ч
        this.stats.hoursPassed += timePassed;

        // Расход бензина (Формула: л/100км * пройденные км)
        const fuelBurned = (this.currentCar.consumption / 100) * kmStep;
        this.stats.gas -= fuelBurned;

        // Бодрость (700 км до нуля)
        this.stats.wake -= (kmStep / 700) * 100;

        // Еда (условно 12.5 монет за час = 300 в сутки)
        this.stats.coins -= (timePassed * 12.5);

        // Износ машины
        this.stats.hp -= (kmStep / 100);

        this.stats.gas = Math.max(0, this.stats.gas);
        this.stats.wake = Math.max(0, this.stats.wake);
        this.stats.hp = Math.max(0, this.stats.hp);
        this.stats.coins = Math.max(0, this.stats.coins);

        this.updateUI();

        if (this.stats.gas === 0) {
            Engine.pauseRoute();
            UI.showModal("Бак пуст!", "Бензин закончился на трассе! Начать заново?", true, 
                () => { SaveManager.clear(); window.location.reload(); }, () => {}
            );
        }
    },

    updateUI: function() {
        const tank = this.currentCar ? this.currentCar.tankSize : 0;
        UI.updateResources(this.stats.coins, this.stats.gas, tank, this.stats.food, this.stats.wake, this.stats.hp, this.stats.xp);
        
        if (document.getElementById('stat-km')) {
            document.getElementById('stat-km').innerText = Math.round(this.stats.kmTraveled);
            document.getElementById('stat-hours').innerText = Math.round(this.stats.hoursPassed);
        }
    }
};