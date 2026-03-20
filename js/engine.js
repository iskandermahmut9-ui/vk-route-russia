window.Engine = {
    map: null,
    carMarker: null,
    routeLine: null,
    isMoving: false,

    init: function() {
        console.log("Запуск карты...");
        
        // Рисуем карту (Центр - Владимир)
        this.map = L.map('map', { zoomControl: false }).setView([56.12, 40.40], 6);
        L.control.zoom({position: 'topright'}).addTo(this.map);
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; CARTO' // Аттрибуцию спрячем в CSS, тут оставим для порядка
        }).addTo(this.map);

        // Машинка на старте (Москва)
        this.carMarker = L.marker([55.7558, 37.6173]).addTo(this.map);

        this.renderCities();
    },

    renderCities: function() {
        DataLoader.cities.forEach(city => {
            // Создаем кастомный желтый круглый маркер (через DivIcon)
            const cityIcon = L.divIcon({
                className: 'city-marker',
                iconSize: [20, 20], // Размер кружка
                iconAnchor: [10, 10] // Центрирование
            });

            const cityMarker = L.marker(city.coords, {icon: cityIcon}).addTo(this.map);
            
            cityMarker.on('click', () => {
                if (this.isMoving) { UI.showToast("Машина в пути!"); return; }
                UI.showModal("Маршрут?", `Поехать в ${city.name}?`, true, () => { this.travelTo(city); });
            });
        });
    },

    travelTo: async function(targetCity) {
        this.isMoving = true;
        const startCoords = this.carMarker.getLatLng();
        UI.updateStatus(`🚙 Строим маршрут в ${targetCity.name}...`);

        try {
            const url = `https://router.project-osrm.org/route/v1/driving/${startCoords.lng},${startCoords.lat};${targetCity.coords[1]},${targetCity.coords[0]}?overview=full&geometries=geojson`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.code !== "Ok") throw new Error("Нет пути");

            const routeCoords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
            
            if (this.routeLine) this.map.removeLayer(this.routeLine);
            // ЦВЕТ ТРЕКА - ОРАНЖЕВЫЙ
            this.routeLine = L.polyline(routeCoords, {color: '#FF9800', weight: 5, opacity: 0.8}).addTo(this.map);

            UI.updateStatus(`🚗 Едем в ${targetCity.name}!`);

            let step = 0;
            const interval = setInterval(() => {
                if (step >= routeCoords.length) {
                    clearInterval(interval);
                    this.isMoving = false;
                    this.map.removeLayer(this.routeLine); 
                    UI.showToast(`Прибыли в ${targetCity.name}!`);
                    UI.openCityPanel(targetCity); 
                    return;
                }
                this.carMarker.setLatLng(routeCoords[step]);
                // На мобильных не центрируем карту резко, чтобы панель снизу не мешала
                if(window.innerWidth > 768) this.map.panTo(routeCoords[step], {animate: true, duration: 0.1});
                
                step += 8; // Чуть быстрее едем
            }, 50);

        } catch (error) {
            console.error(error);
            UI.showToast("Ошибка навигатора!");
            this.isMoving = false;
        }
    }
};