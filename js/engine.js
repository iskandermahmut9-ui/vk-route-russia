window.Engine = {
    map: null, carMarker: null, routeLine: null, isMoving: false,
    startCitySet: false, currentCity: null, passedCities: new Set(),
    moveInterval: null, routeCoords: [], currentStep: 0, targetCity: null,

    init: function() {
        this.map = L.map('map', { zoomControl: false }).setView([55.75, 40.0], 6);
        L.control.zoom({position: 'topright'}).addTo(this.map);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(this.map);
        this.renderCities();
    },

    renderCities: function() {
        const defaultIcon = new L.Icon.Default(); // Вернули классические синие булавки
        DataLoader.cities.forEach(city => {
            const cityMarker = L.marker(city.coords, {icon: defaultIcon}).addTo(this.map);
            cityMarker.on('click', () => {
                if (this.isMoving) { UI.showToast("Машина в пути!"); return; }
                if (!this.startCitySet) { this.setStartCity(city); return; }
                if (this.currentCity && this.currentCity.id === city.id) { UI.showToast("Вы уже здесь."); return; }

                UI.showModal("Маршрут", `Отправиться в ${city.name}?`, true, 
                    () => { this.travelTo(city); }, () => {}
                );
            });
        });
    },

    setStartCity: function(city) {
        this.startCitySet = true;
        this.currentCity = city;
        if (!this.carMarker) this.carMarker = L.marker(city.coords).addTo(this.map);
        else this.carMarker.setLatLng(city.coords);
        
        UI.updateStatus(`Вы в городе ${city.name}. Выберите цель поездки!`);
        document.getElementById('trip-stats').style.display = 'flex';
        UI.openCityPanel(city);
        SaveManager.save(); // Сохраняем старт!
    },

    travelTo: async function(targetCity) {
        this.isMoving = true;
        this.targetCity = targetCity;
        this.passedCities.clear();
        
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
            this.resumeRoute();

        } catch (error) { UI.showToast("Ошибка навигатора!"); this.isMoving = false; }
    },

    resumeRoute: function() {
        this.moveInterval = setInterval(() => {
            if (this.currentStep >= this.routeCoords.length) {
                // ПРИЕХАЛИ!
                clearInterval(this.moveInterval);
                this.isMoving = false;
                this.map.removeLayer(this.routeLine); 
                this.currentCity = this.targetCity;
                UI.showToast(`Прибыли в ${this.targetCity.name}!`);
                UI.openCityPanel(this.targetCity); 
                SaveManager.save(); // Сохраняем прогресс по приезду!
                return;
            }

            const currentPos = this.routeCoords[this.currentStep];
            this.carMarker.setLatLng(currentPos);
            if(window.innerWidth > 768) this.map.panTo(currentPos, {animate: true, duration: 0.1});
            
            GameLoop.tick(2.0); // Машина физически едет и тратит ресурсы!
            this.checkPassingCities(currentPos);
            this.currentStep += 10;
        }, 50);
    },

    pauseRoute: function() { clearInterval(this.moveInterval); },

    checkPassingCities: function(currentPos) {
        DataLoader.cities.forEach(c => {
            if (c.id === this.targetCity.id || c.id === this.currentCity.id || this.passedCities.has(c.id)) return;
            const dist = this.map.distance(currentPos, c.coords);
            if (dist < 20000) { 
                this.passedCities.add(c.id);
                this.pauseRoute(); 
                UI.showModal("Указатель", `Вы проезжаете мимо: ${c.name}. Заехать?`, true, 
                    () => {
                        this.map.removeLayer(this.routeLine);
                        this.isMoving = false;
                        this.currentCity = c;
                        UI.openCityPanel(c);
                        UI.showToast(`Вы свернули в ${c.name}`);
                        SaveManager.save(); // Сохраняем незапланированную остановку
                    }, 
                    () => { this.resumeRoute(); }
                );
            }
        });
    }
};