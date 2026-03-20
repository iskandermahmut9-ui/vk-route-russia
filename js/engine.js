window.Engine = {
    map: null,
    carMarker: null,
    routeLine: null,
    isMoving: false,
    startCitySet: false, // Флаг: выбран ли стартовый город
    currentCity: null,   // Где мы сейчас
    passedCities: new Set(), // Чтобы не спрашивать про один город дважды

    // Переменные для управления паузой
    moveInterval: null,
    routeCoords: [],
    currentStep: 0,
    targetCity: null,

    init: function() {
        this.map = L.map('map', { zoomControl: false }).setView([55.75, 40.0], 6);
        L.control.zoom({position: 'topright'}).addTo(this.map);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(this.map);

        this.renderCities();
    },

    renderCities: function() {
        // Стандартная иконка Leaflet (Синяя булавка)
        const defaultIcon = new L.Icon.Default();

        DataLoader.cities.forEach(city => {
            const cityMarker = L.marker(city.coords, {icon: defaultIcon}).addTo(this.map);
            
            cityMarker.on('click', () => {
                if (this.isMoving) { UI.showToast("Машина в пути!"); return; }
                
                // 1. Если старт еще не задан
                if (!this.startCitySet) {
                    this.setStartCity(city);
                    return;
                }

                // 2. Если старт задан, едем в выбранный город
                if (this.currentCity.id === city.id) {
                    UI.showToast("Вы уже находитесь в этом городе.");
                    return;
                }

                UI.showModal("Маршрут?", `Отправиться в ${city.name}?`, true, 
                    () => { this.travelTo(city); }, 
                    () => {} // Отмена
                );
            });
        });
    },

    setStartCity: function(city) {
        this.startCitySet = true;
        this.currentCity = city;
        this.carMarker = L.marker(city.coords).addTo(this.map);
        
        UI.updateStatus(`Вы в городе ${city.name}. Выберите цель поездки!`);
        document.getElementById('trip-stats').style.display = 'flex'; // Показываем статистику
        
        // Сразу открываем панель стартового города
        UI.openCityPanel(city);
    },

    travelTo: async function(targetCity) {
        this.isMoving = true;
        this.targetCity = targetCity;
        this.passedCities.clear(); // Сбрасываем память проеханных городов
        
        const startCoords = this.carMarker.getLatLng();
        UI.updateStatus(`🚙 Строим маршрут в ${targetCity.name}...`);

        try {
            const url = `https://router.project-osrm.org/route/v1/driving/${startCoords.lng},${startCoords.lat};${targetCity.coords[1]},${targetCity.coords[0]}?overview=full&geometries=geojson`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.code !== "Ok") throw new Error("Нет пути");

            this.routeCoords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
            
            if (this.routeLine) this.map.removeLayer(this.routeLine);
            this.routeLine = L.polyline(this.routeCoords, {color: '#FF9800', weight: 5, opacity: 0.8}).addTo(this.map);

            UI.updateStatus(`🚗 Едем в ${targetCity.name}...`);
            this.currentStep = 0;
            this.resumeRoute(); // Запускаем движение

        } catch (error) {
            console.error(error);
            UI.showToast("Ошибка навигатора!");
            this.isMoving = false;
        }
    },

    resumeRoute: function() {
        this.moveInterval = setInterval(() => {
            if (this.currentStep >= this.routeCoords.length) {
                // Приехали в финал
                clearInterval(this.moveInterval);
                this.isMoving = false;
                this.map.removeLayer(this.routeLine); 
                this.currentCity = this.targetCity;
                UI.showToast(`Прибыли в ${this.targetCity.name}!`);
                UI.openCityPanel(this.targetCity); 
                return;
            }

            const currentPos = this.routeCoords[this.currentStep];
            this.carMarker.setLatLng(currentPos);
            if(window.innerWidth > 768) this.map.panTo(currentPos, {animate: true, duration: 0.1});
            
            // Трата ресурсов (каждый шаг анимации считаем за ~1.5 км для теста)
            GameLoop.tick(1.5); 

            // МЕХАНИКА: ПРОЕЗЖАЕМ МИМО
            this.checkPassingCities(currentPos);

            this.currentStep += 10; // Скорость анимации
        }, 50);
    },

    pauseRoute: function() {
        clearInterval(this.moveInterval);
    },

    checkPassingCities: function(currentPos) {
        DataLoader.cities.forEach(c => {
            // Игнорируем старт, финиш и уже отклоненные
            if (c.id === this.targetCity.id || c.id === this.currentCity.id || this.passedCities.has(c.id)) return;
            
            // Считаем дистанцию в метрах
            const dist = this.map.distance(currentPos, c.coords);
            
            if (dist < 20000) { // Если меньше 20 км
                this.passedCities.add(c.id);
                this.pauseRoute(); // Тормозим машину
                
                UI.showModal("Указатель на трассе", `Вы проезжаете мимо города ${c.name}. Заехать?`, true, 
                    () => {
                        // Согласился заехать
                        this.map.removeLayer(this.routeLine);
                        this.isMoving = false;
                        this.currentCity = c;
                        UI.openCityPanel(c);
                        UI.showToast(`Вы свернули в ${c.name}`);
                    }, 
                    () => {
                        // Отказался, едем дальше
                        this.resumeRoute();
                    }
                );
            }
        });
    }
};