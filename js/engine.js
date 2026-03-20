window.Engine = {
    map: null,
    carMarker: null,
    routeLine: null,
    isMoving: false,

    init: function() {
        console.log("Запуск движка карты...");
        
        // 1. Рисуем карту (Центр - где-то между Москвой и Казанью)
        this.map = L.map('map', { zoomControl: false }).setView([55.75, 40.0], 6);
        L.control.zoom({position: 'topright'}).addTo(this.map);
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO'
        }).addTo(this.map);

        // 2. Ставим машинку на старт (Москва)
        this.carMarker = L.marker([55.7558, 37.6173]).addTo(this.map);

        // 3. Рисуем города из базы
        this.renderCities();
    },

    renderCities: function() {
        DataLoader.cities.forEach(city => {
            const cityMarker = L.marker(city.coords).addTo(this.map);
            
            cityMarker.on('click', () => {
                if (this.isMoving) {
                    UI.showToast("Машина уже в пути! Не отвлекайте водителя.");
                    return;
                }
                
                UI.showModal("Проложить маршрут?", `Вы уверены, что хотите поехать в ${city.name}?`, true, () => {
                    this.travelTo(city);
                });
            });
        });
    },

    // Функция запроса дороги у OSRM и анимации
    travelTo: async function(targetCity) {
        this.isMoving = true;
        const startCoords = this.carMarker.getLatLng();
        document.getElementById('status-text').innerHTML = `🚙 Строим маршрут в ${targetCity.name}...`;

        try {
            // Обращение к OSRM (Важно: OSRM ест координаты в формате lng,lat)
            const url = `https://router.project-osrm.org/route/v1/driving/${startCoords.lng},${startCoords.lat};${targetCity.coords[1]},${targetCity.coords[0]}?overview=full&geometries=geojson`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.code !== "Ok") throw new Error("Маршрут не найден");

            // Конвертируем ответ OSRM обратно для Leaflet (lat, lng)
            const routeCoords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
            
            // Рисуем синюю линию будущего пути
            if (this.routeLine) this.map.removeLayer(this.routeLine);
            this.routeLine = L.polyline(routeCoords, {color: '#3498db', weight: 4, dashArray: '10, 10'}).addTo(this.map);

            document.getElementById('status-text').innerHTML = `🚗 Едем в ${targetCity.name}!`;

            // Запускаем анимацию по точкам
            let step = 0;
            const interval = setInterval(() => {
                if (step >= routeCoords.length) {
                    // Приехали!
                    clearInterval(interval);
                    this.isMoving = false;
                    this.map.removeLayer(this.routeLine); // Убираем линию
                    UI.showToast(`Вы прибыли в ${targetCity.name}!`);
                    UI.openCityPanel(targetCity); // Открываем интерфейс города
                    return;
                }

                // Двигаем маркер и камеру
                this.carMarker.setLatLng(routeCoords[step]);
                this.map.panTo(routeCoords[step], {animate: true, duration: 0.1});
                
                // Скорость машинки (перепрыгиваем через 5 точек для скорости)
                step += 5; 
            }, 50);

        } catch (error) {
            console.error(error);
            UI.showToast("Ошибка навигатора! Невозможно проложить путь.");
            this.isMoving = false;
        }
    }
};