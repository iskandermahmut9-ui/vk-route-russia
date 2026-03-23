import { cfoCities } from '../data/regions/cfo.js';

export const MapModule = {
    initMap: function() {
        // Карта остается прежней
        this.map = L.map('map', { zoomControl: false }).setView([55.75, 38.0], 6);
        L.control.zoom({position: 'topright'}).addTo(this.map);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);
    },

    renderMap: function() {
        cfoCities.forEach(c => {
            let isHidden = c.tier === 3;
            let tierClass = c.tier === 1 ? 'marker-tier-1' : (c.tier === 2 ? 'marker-tier-2' : 'marker-tier-3');
            if (isHidden) tierClass += ' hidden-tier';
            
            let icon = L.divIcon({ 
                className: `map-pin ${tierClass}`, 
                html: '<i class="fa-solid fa-location-dot"></i>', 
                iconSize: [30, 30], iconAnchor: [15,30] 
            });
            let m = L.marker(c.coords, {icon: icon}).addTo(this.map);
            this.markers[c.id] = m;

            m.on('click', () => {
                if (this.state.isMoving) return;
                
                if (!this.state.currentCity) {
                    this.setStartCity(c);
                } else if (this.state.currentCity.id === c.id) {
                    this.openCityUI(c);
                } else {
                    this.confirmTravel(c);
                }
            });
        });
    },

    setStartCity: function(city) {
        this.state.currentCity = city;
        this.state.history.push(city.id);
        this.updateMarkers();
        
        // ДОБАВЛЕН КЛАСС leaflet-interactive И УВЕЛИЧЕН РАЗМЕР (80px)
        let carIcon = L.divIcon({
            className: 'marker-car leaflet-interactive', 
            html: `<img src="assets/cars/${this.state.car.img}" style="width: 80px; height: auto; filter: drop-shadow(0 5px 5px rgba(0,0,0,0.7)); pointer-events: auto;">`
        });
        
        // INTERACTIVE: TRUE
        this.carMarker = L.marker(city.coords, {icon: carIcon, interactive: true, zIndexOffset: 1000}).addTo(this.map);
        
        // ВЕШАЕМ КЛИК
        this.carMarker.on('click', () => {
            if (!this.state.isMoving) {
                this.openTrunk();
            } else {
                this.toast("На скорости в багажник не лезут!");
            }
        });

        document.getElementById('city-overlay').style.display = 'none';
        this.toast(`Старт задан. Выберите следующую цель на карте!`);
        this.saveGame();
    },

    confirmTravel: async function(targetCity) {
        // Логика маршрута без изменений
        const start = this.state.currentCity.coords;
        const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${targetCity.coords[1]},${targetCity.coords[0]}?overview=full&geometries=geojson`;
        
        try {
            const res = await fetch(url); const data = await res.json();
            const distKm = data.routes[0].distance / 1000;
            const routeCoords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);

            document.getElementById('drive-target-name').innerText = targetCity.name;
            document.getElementById('drive-target-dist').innerText = Math.round(distKm);
            
            let modesHtml = `
                <div class="diff-card" onclick="Game.startTravel(${JSON.stringify(targetCity).replace(/"/g, '&quot;')}, ${distKm}, ${JSON.stringify(routeCoords)}, 70, 1.0, 1.5)">
                    <h3 style="color:#8BC34A;">Релакс (70 км/ч)</h3><p>Упор на интерактив и события.</p></div>
                <div class="diff-card" onclick="Game.startTravel(${JSON.stringify(targetCity).replace(/"/g, '&quot;')}, ${distKm}, ${JSON.stringify(routeCoords)}, 100, 1.0, 1.0)">
                    <h3 style="color:#2196F3;">Оптимальный (100 км/ч)</h3><p>Баланс времени и событий.</p></div>
                <div class="diff-card" onclick="Game.startTravel(${JSON.stringify(targetCity).replace(/"/g, '&quot;')}, ${distKm}, ${JSON.stringify(routeCoords)}, 140, 1.5, 0)">
                    <h3 style="color:#F44336;">Гонщик (140 км/ч)</h3><p>Частый ДПС, пробитые колеса.</p></div>
            `;
            document.getElementById('drive-modes-container').innerHTML = modesHtml;
            document.getElementById('drive-mode-modal').style.display = 'flex';
        } catch(e) { this.toast("Маршрут заблокирован. Попробуйте другой город."); }
    },

    startTravel: function(city, distKm, coords, speed, gasMult, radMult) {
        document.getElementById('drive-mode-modal').style.display = 'none';
        this.state.driveMode = { speed: speed, gasMult: gasMult, radMult: radMult };
        
        let plannedLine = L.polyline(coords, {color: '#FFD700', weight: 4, opacity: 0.6, dashArray: '5, 10'}).addTo(this.map);
        this.routeLines.push(plannedLine);

        let gameHours = distKm / speed;
        let realSeconds = (gameHours * 60) / 10; 
        let durationMs = realSeconds * 1000;
        
        let intervalMs = 40;
        let totalTicks = durationMs / intervalMs;

        this.activeRouteLine = plannedLine;

        this.state.travelData = {
            city: city, coords: coords,
            distKm: distKm, currentStep: 0, kmPassedTotal: 0, stepInc: coords.length / totalTicks
        };

        document.getElementById('travel-hud').style.display = 'block';
        document.getElementById('hud-target').innerText = city.name;
        document.getElementById('hud-time').innerText = Math.round(gameHours);
        
        this.resumeTravel();
    },

    resumeTravel: function() {
        let td = this.state.travelData;
        if (!td) return; 

        if (this.animationInterval) clearInterval(this.animationInterval);

        if (!this.state.driveMode) {
            this.state.driveMode = { speed: 100, gasMult: 1.0, radMult: 1.0 };
        }

        this.state.isMoving = true;
        document.getElementById('travel-hud').style.display = 'block';
        
        // ЗАКРЫВАЕМ ПАСПОРТ МАШИНЫ, ЕСЛИ ОН ОТКРЫТ
        document.getElementById('car-modal').style.display = 'none';

        this.animationInterval = setInterval(() => {
            td.currentStep += td.stepInc;
            if (td.currentStep >= td.coords.length - 1) td.currentStep = td.coords.length - 1;

            let idx = Math.floor(td.currentStep);
            let nextIdx = Math.min(idx + 1, td.coords.length - 1);
            let frac = td.currentStep - idx;

            let lat = td.coords[idx][0] + (td.coords[nextIdx][0] - td.coords[idx][0]) * frac;
            let lng = td.coords[idx][1] + (td.coords[nextIdx][1] - td.coords[idx][1]) * frac;
            let pos = [lat, lng];

            this.carMarker.setLatLng(pos);
            if(window.innerWidth > 900) this.map.panTo(pos, {animate: true, duration: 0.1});

            let tickKm = td.distKm * (td.stepInc / td.coords.length);
            td.kmPassedTotal += tickKm;
            this.state.kmSinceEvent += tickKm;
            this.state.kmSinceQTE += tickKm;
            document.getElementById('hud-dist').innerText = Math.round(td.kmPassedTotal);

            let wakeDrain = (tickKm / 700) * 100;
            let foodDrain = (tickKm / 700) * 100 * (this.state.car.id !== "bike" ? 1 : 2);
            let gasDrain = this.state.car.id !== "bike" ? (this.state.car.cons / 100) * tickKm * this.state.driveMode.gasMult : 0;
            let hpDrain = (tickKm / 100) * this.state.car.hpLoss;

            this.state.wake = Math.max(0, this.state.wake - wakeDrain);
            this.state.food = Math.max(0, this.state.food - foodDrain);
            this.state.gas = Math.max(0, this.state.gas - gasDrain);
            this.state.hp = Math.max(0, this.state.hp - hpDrain);

            this.updateTopUI();

            if (this.state.gas <= 0 && this.state.car.id !== "bike") {
                clearInterval(this.animationInterval); 
                this.state.isMoving = false;
                
                document.getElementById('event-img').src = `assets/events/evakuator.png`; // Сменим картинку
                document.getElementById('event-title').innerText = "БАК ПУСТ!";
                document.getElementById('event-desc').innerText = "Машина заглохла. Либо вызывайте эвакуатор, либо платите мутному типу на обочине за 10 литров бодяги.";
                
                let actionsDiv = document.getElementById('event-actions');
                actionsDiv.innerHTML = '';
                
                let btnBuy = document.createElement('button');
                btnBuy.className = 'btn-action'; btnBuy.style.background = "#FF9800";
                btnBuy.innerText = "Купить 10л (140 🪙)";
                btnBuy.onclick = () => {
                    if (this.state.coins >= 140) {
                        this.state.coins -= 140; this.state.gas = 10;
                        this.playFloatingText("-140 🪙", false); this.updateTopUI();
                        document.getElementById('event-modal').style.display='none';
                        this.resumeTravel(); 
                    } else { this.toast("Не хватает монет!"); }
                };
                actionsDiv.appendChild(btnBuy);

                let btnTow = document.createElement('button');
                btnTow.className = 'btn-action'; btnTow.style.background = "#2196F3";
                btnTow.innerText = `Эвакуатор в ближ. город (Реклама)`;
                btnTow.onclick = () => {
                        document.getElementById('event-modal').style.display='none';
                        this.watchAd(() => { this.teleportToNearestCity(pos, this.activeRouteLine); });
                };
                actionsDiv.appendChild(btnTow);

                let btnDie = document.createElement('button');
                btnDie.className = 'btn-action btn-leave reset-btn';
                btnDie.innerText = "Сдаться (Начать заново)";
                btnDie.onclick = () => { window.location.reload(); };
                actionsDiv.appendChild(btnDie);

                document.getElementById('event-modal').style.display = 'flex';
                return;
            }

            if (this.state.wake <= 0) td.stepInc = (td.coords.length / totalTicks) * 0.2; 

            if (this.state.kmSinceQTE >= 70 && !this.state.qteActive) {
                this.state.kmSinceQTE = 0;
                this.spawnQTE(); 
            }

            if (this.state.kmSinceEvent >= 150 && !this.state.qteActive) {
                this.state.kmSinceEvent = 0;
                clearInterval(this.animationInterval); 
                this.state.isMoving = false;
                this.triggerStoryEvent();
                return;
            }

            if (this.state.driveMode.radMult > 0) {
                for (let c of cfoCities) {
                    if (c.id !== td.city.id && c.id !== this.state.currentCity.id && !this.state.history.includes(c.id)) {
                        let distanceMeters = this.map.distance(pos, c.coords);
                        let radar = this.state.car.radius * this.state.driveMode.radMult * 1000;
                        if (distanceMeters <= radar) {
                            clearInterval(this.animationInterval);
                            this.state.isMoving = false;
                            this.triggerPassingCity(c);
                            return;
                        }
                    }
                }
            }

            if (td.currentStep >= td.coords.length - 1) {
                clearInterval(this.animationInterval);
                this.finishTravel(td.city, this.activeRouteLine);
            }
        }, 40);
    },

    teleportToNearestCity: function(currentPos, currentLine) {
        let minDist = Infinity;
        let closestCity = null;
        cfoCities.forEach(c => {
            let dist = this.map.distance(currentPos, c.coords);
            if (dist < minDist) { minDist = dist; closestCity = c; }
        });

        this.toast(`Вас отбуксировали в: ${closestCity.name}`);
        if (currentLine) this.map.removeLayer(currentLine); 
        this.carMarker.setLatLng(closestCity.coords);
        this.map.panTo(closestCity.coords);
        
        this.state.gas = 2; 
        this.finishTravel(closestCity, currentLine); 
    },

    detourToCity: async function(passingCity) {
        let td = this.state.travelData;
        let currentPos = this.carMarker.getLatLng();

        if (this.activeRouteLine) this.map.removeLayer(this.activeRouteLine);
        let drivenCoords = td.coords.slice(0, Math.floor(td.currentStep) + 1);
        drivenCoords.push([currentPos.lat, currentPos.lng]);
        let drivenLine = L.polyline(drivenCoords, {color: '#555', weight: 3, dashArray: '5, 10'}).addTo(this.map);
        this.routeLines.push(drivenLine);

        this.toast(`Перестраиваем маршрут в ${passingCity.name}...`);
        const url = `https://router.project-osrm.org/route/v1/driving/${currentPos.lng},${currentPos.lat};${passingCity.coords[1]},${passingCity.coords[0]}?overview=full&geometries=geojson`;

        try {
            const res = await fetch(url); const data = await res.json();
            const newDistKm = data.routes[0].distance / 1000;
            const newCoords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
            this.startTravel(passingCity, newDistKm, newCoords, this.state.driveMode.speed, this.state.driveMode.gasMult, this.state.driveMode.radMult);
        } catch(e) {
            if (this.activeRouteLine) this.activeRouteLine.addTo(this.map);
            this.resumeTravel();
        }
    },

    finishTravel: function(city, line) {
        this.state.isMoving = false;
        this.state.currentCity = city;
        this.state.history.push(city.id);
        document.getElementById('travel-hud').style.display = 'none';
        
        if(line) line.setStyle({color: '#555', weight: 3, dashArray: '5, 10', opacity: 1});
        this.updateMarkers();
        
        Object.keys(this.markers).forEach(id => {
            this.markers[id].getElement().classList.remove('marker-current');
            if (id === city.id) this.markers[id].getElement().classList.add('marker-current');
        });

        this.updateTopUI();
        this.openCityUI(city);
        this.saveGame(); 
    },

    updateMarkers: function() {
        Object.keys(this.markers).forEach(id => {
            let m = this.markers[id];
            let el = m.getElement();
            if(!el) return;
            if (this.state.collected.includes(id)) {
                el.className = 'map-pin marker-collected leaflet-marker-icon leaflet-zoom-animated leaflet-interactive';
            }
        });
    }
};