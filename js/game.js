window.Game = {
    map: null, markers: {}, routeLines: [], carMarker: null,
    state: {
        coins: 1500, gas: 0, food: 100, wake: 100, hp: 100,
        car: null, diff: null, currentCity: null, history: [], collected: [], discovered: [],
        isMoving: false, hotelPaid: false, excPaid: false,
        driveMode: null, kmSinceEvent: 0 // Счетчик для сюрпризов
    },

    init: async function() {
        try {
            if (window.vkBridge) {
                await vkBridge.send('VKWebAppInit'); 
                const user = await vkBridge.send('VKWebAppGetUserInfo');
                document.getElementById('player-name').innerText = user.first_name;
                document.getElementById('player-avatar').src = user.photo_200;
            }
        } catch (e) { console.log("Демо-режим"); }

        this.map = L.map('map', { zoomControl: false }).setView([55.75, 38.0], 6);
        L.control.zoom({position: 'topright'}).addTo(this.map);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);

        this.renderMap();
        this.bindEvents();
        document.getElementById('difficulty-modal').style.display = 'flex';
    },

    selectDifficulty: function(diff) {
        this.state.diff = diff;
        document.getElementById('difficulty-modal').style.display = 'none';
        
        const list = document.getElementById('garage-list'); list.innerHTML = '';
        Data.garages[diff].forEach(car => {
            let div = document.createElement('div'); div.className = 'car-card';
            div.innerHTML = `<h3>${car.name}</h3><p>Бак: ${car.tank}л | Расход: ${car.cons}л<br>Радар: ${car.radius} км</p>`;
            div.onclick = () => {
                this.state.car = car;
                this.state.gas = car.tank;
                document.getElementById('garage-modal').style.display = 'none';
                document.getElementById('resource-panel').style.display = 'flex';
                this.updateTopUI();
                this.toast("Кликните на столицу на карте для старта!");
            };
            list.appendChild(div);
        });
        document.getElementById('garage-modal').style.display = 'flex';
    },

    renderMap: function() {
        Data.cities.forEach(c => {
            let isHidden = c.tier === 3;
            // ИСПОЛЬЗУЕМ КРАСИВЫЕ ПИНЫ РАЗНЫХ ЦВЕТОВ
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
                if (!this.state.currentCity) this.setStartCity(c);
                else {
                    if (this.state.currentCity.id === c.id) return;
                    this.confirmTravel(c);
                }
            });
        });
    },

    setStartCity: function(city) {
        this.state.currentCity = city;
        this.state.history.push(city.id);
        this.updateMarkers();
        
        // Машинка теперь иконка!
        let carIcon = L.divIcon({className: 'marker-car', html: '<i class="fa-solid fa-car-side"></i>'});
        this.carMarker = L.marker(city.coords, {icon: carIcon}).addTo(this.map);

        this.toast(`Старт из: ${city.name}. Выберите следующую точку на карте!`);
    },

    confirmTravel: async function(targetCity) {
        const start = this.state.currentCity.coords;
        const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${targetCity.coords[1]},${targetCity.coords[0]}?overview=full&geometries=geojson`;
        
        try {
            const res = await fetch(url); const data = await res.json();
            const distKm = data.routes[0].distance / 1000;
            const routeCoords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);

            // ВМЕСТО ЕЗДЫ СРАЗУ, ОТКРЫВАЕМ ВЫБОР РЕЖИМА
            document.getElementById('drive-target-name').innerText = targetCity.name;
            document.getElementById('drive-target-dist').innerText = Math.round(distKm);
            
            let modesHtml = `
                <div class="diff-card" onclick="Game.startTravel(${JSON.stringify(targetCity).replace(/"/g, '&quot;')}, ${distKm}, ${JSON.stringify(routeCoords)}, 70, 1.0, 1.5)">
                    <h3 style="color:#8BC34A;">Релакс (70 км/ч)</h3><p>Долго (тратится много еды), норм. расход, макс. поиск секретов.</p></div>
                <div class="diff-card" onclick="Game.startTravel(${JSON.stringify(targetCity).replace(/"/g, '&quot;')}, ${distKm}, ${JSON.stringify(routeCoords)}, 100, 1.0, 1.0)">
                    <h3 style="color:#2196F3;">Оптимальный (100 км/ч)</h3><p>Баланс времени, расхода и поиска.</p></div>
                <div class="diff-card" onclick="Game.startTravel(${JSON.stringify(targetCity).replace(/"/g, '&quot;')}, ${distKm}, ${JSON.stringify(routeCoords)}, 140, 1.5, 0)">
                    <h3 style="color:#F44336;">Тапка в пол (140 км/ч)</h3><p>Быстро, но расход бензина х1.5. Радар отключен. Штрафы.</p></div>
            `;
            document.getElementById('drive-modes-container').innerHTML = modesHtml;
            document.getElementById('drive-mode-modal').style.display = 'flex';

        } catch(e) { this.toast("Ошибка сети. Попробуйте другой город."); }
    },

    startTravel: function(city, distKm, coords, speed, gasMult, radMult) {
        document.getElementById('drive-mode-modal').style.display = 'none';
        this.state.driveMode = { speed: speed, gasMult: gasMult, radMult: radMult };
        this.executeTravel(city, distKm, coords);
    },

    // ПЛАВНАЯ АНИМАЦИЯ И СОБЫТИЯ НА ТРАССЕ
    executeTravel: function(city, distKm, coords) {
        document.getElementById('city-overlay').style.display = 'none';
        
        let gameHours = distKm / this.state.driveMode.speed;
        document.getElementById('travel-hud').style.display = 'block';
        document.getElementById('hud-target').innerText = city.name;
        document.getElementById('hud-time').innerText = Math.round(gameHours);
        document.getElementById('hud-dist').innerText = "0";

        let line = L.polyline(coords, {color: '#FF5722', weight: 4}).addTo(this.map);
        this.routeLines.push(line);
        this.state.isMoving = true;

        let steps = coords.length;
        let currentStep = 0;
        let kmPassedTotal = 0;
        
        // Точная интерполяция по координатам
        this.animationInterval = setInterval(() => {
            currentStep += 0.5; // Плавный шаг
            
            if (currentStep >= steps - 1) {
                this.finalizeTravel(city, line, distKm);
                return;
            }

            let idx = Math.floor(currentStep);
            let frac = currentStep - idx;
            let p1 = coords[idx];
            let p2 = coords[idx + 1];
            
            // Интерполяция позиции
            let lat = p1[0] + (p2[0] - p1[0]) * frac;
            let lng = p1[1] + (p2[1] - p1[1]) * frac;
            let pos = [lat, lng];
            
            this.carMarker.setLatLng(pos);
            if(window.innerWidth > 768) this.map.panTo(pos, {animate: true, duration: 0.1});

            // Математика за этот микро-шаг (приближенно)
            let stepKm = distKm / steps * 0.5;
            kmPassedTotal += stepKm;
            this.state.kmSinceEvent += stepKm;
            document.getElementById('hud-dist').innerText = Math.round(kmPassedTotal);

            // Трата (700 км = 100%)
            let drainPct = (stepKm / 700) * 100;
            this.state.wake -= drainPct;
            this.state.food -= drainPct * (this.state.car.id !== "bike" ? 1 : 2); // велик жрет еду х2
            
            if (this.state.car.id !== "bike") {
                this.state.gas -= (this.state.car.cons / 100) * stepKm * this.state.driveMode.gasMult;
            }
            this.state.hp -= (stepKm / 100) * this.state.car.hpLoss;

            this.updateTopUI();

            // Проверка на проигрыш (Бензин 0)
            if (this.state.gas <= 0 && this.state.car.id !== "bike") {
                clearInterval(this.animationInterval);
                this.showConfirm("Бак пуст!", "Вы заглохли на трассе. Вызвать эвакуатор за 1000 монет?", () => {
                    if (this.state.coins >= 1000) {
                        this.state.coins -= 1000; this.state.gas = 10; this.updateTopUI(); this.resumeTravel();
                    } else { this.toast("Денег нет! Игра окончена."); setTimeout(() => window.location.reload(), 2000); }
                });
                return;
            }

            // МЕХАНИКА: СОБЫТИЯ НА ТРАССЕ (~300 км)
            if (this.state.kmSinceEvent >= 300) {
                this.state.kmSinceEvent = 0;
                clearInterval(this.animationInterval);
                this.triggerRandomEvent();
                return;
            }

            // МЕХАНИКА: ЗАЕЗД В ГОРОДА (Включая 3 уровень)
            if (this.state.driveMode.radMult > 0) {
                Data.cities.forEach(c => {
                    if (c.id !== city.id && c.id !== this.state.currentCity.id && !this.state.history.includes(c.id)) {
                        let distMeters = this.map.distance(pos, c.coords);
                        let radar = this.state.car.radius * this.state.driveMode.radMult * 1000;
                        if (distMeters <= radar) {
                            clearInterval(this.animationInterval);
                            this.triggerPassingCity(c, city, line, distKm - kmPassedTotal, coords.slice(idx));
                        }
                    }
                });
            }

        }, 20); // Быстрый интервал для плавности
    },

    resumeTravel: function() {
        // Просто перезапускаем интервал
        this.state.isMoving = true;
        // Для упрощения, продолжаем с текущими параметрами. В полной версии тут нужен рестарт executeTravel от текущей точки.
    },

    triggerRandomEvent: function() {
        let events = [
            { t: "Попутчик", d: "Вы подвезли веселого студента. Он дал вам на бензин.", coins: 200, hp: 0 },
            { t: "Камера ГИБДД", d: "Вспышка! Вы превысили скорость.", coins: -250, hp: 0 },
            { t: "Яма на дороге", d: "Удар подвески был сильным.", coins: 0, hp: -10 }
        ];
        let ev = events[Math.floor(Math.random() * events.length)];
        
        // Если тапка в пол - шанс камеры выше.
        if(this.state.driveMode.speed === 140 && Math.random() < 0.5) ev = events[1];

        document.getElementById('event-title').innerText = ev.t;
        document.getElementById('event-desc').innerText = ev.d;
        
        let btnOk = document.createElement('button');
        btnOk.className = 'btn-action'; btnOk.innerText = "ПОНЯТНО";
        btnOk.onclick = () => {
            this.state.coins += ev.coins;
            this.state.hp += ev.hp;
            document.getElementById('event-modal').style.display = 'none';
            this.updateTopUI();
            this.state.isMoving = true; // Возобновляем (в идеале перестроить маршрут)
            this.toast("Событие обработано. Движение пока не возобновлено в демо-отрезке (нажмите на город заново).");
        };
        document.getElementById('event-actions').innerHTML = '';
        document.getElementById('event-actions').appendChild(btnOk);
        document.getElementById('event-modal').style.display = 'flex';
    },

    triggerPassingCity: function(passingCity, targetCity, line, remainingKm, remainingCoords) {
        this.state.history.push(passingCity.id); // Чтобы не спрашивать дважды
        document.getElementById('passing-city-name').innerText = passingCity.name;
        
        if (passingCity.tier === 3) {
            this.markers[passingCity.id].getElement().classList.remove('hidden-tier');
            this.markers[passingCity.id].getElement().classList.add('marker-discovered');
        }

        document.getElementById('passing-modal').style.display = 'flex';
        
        document.getElementById('btn-passing-yes').onclick = () => {
            document.getElementById('passing-modal').style.display = 'none';
            this.finishTravel(passingCity, line); // Завершаем поездку здесь!
        };
        document.getElementById('btn-passing-no').onclick = () => {
            document.getElementById('passing-modal').style.display = 'none';
            this.toast("Едем дальше по маршруту. (В демо нажмите на город цели снова)");
        };
    },

    finalizeTravel: function(city, line, distKm) {
        clearInterval(this.animationInterval);
        this.finishTravel(city, line);
    },

    finishTravel: function(city, line) {
        this.state.isMoving = false;
        this.state.currentCity = city;
        this.state.history.push(city.id);
        document.getElementById('travel-hud').style.display = 'none';
        
        this.routeLines.forEach(l => l.setStyle({color: '#555', weight: 3, dashArray: '5, 10'}));
        line.setStyle({color: '#FF5722', weight: 4, dashArray: null});

        this.updateMarkers();
        this.updateTopUI();
        
        document.getElementById('quest-city-name').innerText = city.name;
        if(city.quests && city.quests.length > 0) {
            this.showQuest(city);
        } else {
            this.openCityUI(city);
        }
    },

    updateMarkers: function() {
        Object.keys(this.markers).forEach(id => {
            let m = this.markers[id];
            let el = m.getElement();
            if(!el) return;
            
            let c = Data.cities.find(x => x.id === id);
            if (this.state.collected.includes(id)) {
                el.className = 'map-pin marker-collected leaflet-marker-icon leaflet-zoom-animated leaflet-interactive';
            }
        });
    },

    // МАГАЗИН (Мелкие кнопки)
    openCityUI: function(city) {
        this.state.hotelPaid = false;
        this.state.excPaid = false;

        document.getElementById('city-overlay').style.display = 'flex';
        document.getElementById('city-name').innerText = city.name;
        document.getElementById('city-tier').innerText = `Уровень ${city.tier}`;
        document.getElementById('city-fact').innerText = city.fact;
        
        this.renderCityShop(city);
    },

    renderCityShop: function(city) {
        const p = Data.prices[city.tier];
        let html = "";

        // 1. НОЧЛЕГ
        html += `<div class="shop-category"><h4>🛏️ Ночлег</h4><div class="btn-group">`;
        if (p.hotel > 0) {
            let isFull = this.state.wake >= 100 || this.state.hotelPaid;
            html += `<button class="btn-shop ${this.state.hotelPaid ? 'purchased' : ''}" ${isFull ? 'disabled' : ''} onclick="Game.buyItem('hotel', ${p.hotel}, 100)">
                <b>Отель</b><small>+100% бодрости</small><span class="price">${p.hotel} ₽</span></button>`;
        }
        if (p.hostel > 0) {
            let isFull = this.state.wake >= 100 || this.state.hotelPaid;
            html += `<button class="btn-shop ${this.state.hotelPaid ? 'purchased' : ''}" ${isFull ? 'disabled' : ''} onclick="Game.buyItem('hotel', ${p.hostel}, 80)">
                <b>Хостел</b><small>+80% бодрости</small><span class="price">${p.hostel} ₽</span></button>`;
        }
        html += `</div></div>`;

        // 2. ЕДА
        html += `<div class="shop-category"><h4>🍔 Питание</h4><div class="btn-group">`;
        if (p.rest > 0) {
            let isFull = this.state.food >= 100;
            html += `<button class="btn-shop" ${isFull ? 'disabled' : ''} onclick="Game.buyItem('food', ${p.rest}, 100)">
                <b>Ресторан</b><small>+100% сытости</small><span class="price">${p.rest} ₽</span></button>`;
        }
        if (p.fastfood > 0) {
            let isFull = this.state.food >= 100;
            html += `<button class="btn-shop" ${isFull ? 'disabled' : ''} onclick="Game.buyItem('food', ${p.fastfood}, 80)">
                <b>Фастфуд</b><small>+80% сытости</small><span class="price">${p.fastfood} ₽</span></button>`;
        }
        html += `</div></div>`;

        // 3. БЕНЗИН
        if (this.state.car.id !== "bike" && p.gas > 0) {
            let missingGas = Math.floor(this.state.car.tank - this.state.gas);
            let fullPrice = missingGas * p.gas;
            let tenPrice = 10 * p.gas;
            html += `<div class="shop-category"><h4>⛽ АЗС (${p.gas} ₽/литр)</h4><div class="btn-group">`;
            html += `<button class="btn-shop" ${missingGas < 10 ? 'disabled' : ''} onclick="Game.buyItem('gas', ${tenPrice}, 10)">
                <b>+10 Литров</b><span class="price">${tenPrice} ₽</span></button>`;
            html += `<button class="btn-shop" ${missingGas <= 0 ? 'disabled' : ''} onclick="Game.buyItem('gas', ${fullPrice}, ${missingGas})">
                <b>Полный бак</b><span class="price">${fullPrice} ₽</span></button>`;
            html += `</div></div>`;
        }

        // 4. СТО
        if (this.state.car.id !== "bike" && p.repair > 0) {
            let missingHp = Math.floor(100 - this.state.hp);
            let fullPrice = missingHp * p.repair;
            let tenPrice = 10 * p.repair;
            html += `<div class="shop-category"><h4>🔧 Автосервис</h4><div class="btn-group">`;
            html += `<button class="btn-shop" ${missingHp < 10 ? 'disabled' : ''} onclick="Game.buyItem('hp', ${tenPrice}, 10)">
                <b>+10% Ремонта</b><span class="price">${tenPrice} ₽</span></button>`;
            html += `<button class="btn-shop" ${missingHp <= 0 ? 'disabled' : ''} onclick="Game.buyItem('hp', ${fullPrice}, ${missingHp})">
                <b>Починить всё</b><span class="price">${fullPrice} ₽</span></button>`;
            html += `</div></div>`;
        }

        // 5. ЭКСКУРСИЯ
        if (p.exc > 0) {
            html += `<div class="shop-category" style="border:none;"><h4>🎫 Культура</h4><div class="btn-group">`;
            html += `<button class="btn-shop ${this.state.excPaid ? 'purchased' : ''}" ${this.state.excPaid ? 'disabled' : ''} onclick="Game.buyItem('exc', ${p.exc}, 0)">
                <b>Экскурсия</b><small>Нужно для коллекции</small><span class="price">${p.exc} ₽</span></button>`;
            html += `</div></div>`;
        }

        document.getElementById('city-shop').innerHTML = html;
    },

    buyItem: function(type, price, amount) {
        if (this.state.coins < price) { this.toast("Не хватает монет!"); return; }
        this.state.coins -= price;

        if (type === 'hotel') {
            this.state.wake = Math.min(100, this.state.wake + amount);
            this.state.hotelPaid = true;
        } else if (type === 'food') {
            this.state.food = Math.min(100, this.state.food + amount);
        } else if (type === 'gas') {
            this.state.gas += amount;
        } else if (type === 'hp') {
            this.state.hp += amount;
        } else if (type === 'exc') {
            this.state.excPaid = true;
        }

        this.updateTopUI();
        
        if (this.state.hotelPaid && this.state.excPaid && !this.state.collected.includes(this.state.currentCity.id)) {
            this.state.collected.push(this.state.currentCity.id);
            this.toast("Условия выполнены! Карточка города добавлена в Альбом!");
            this.updateMarkers();
        }

        this.renderCityShop(this.state.currentCity);
    },

    leaveCity: function() {
        if (!this.state.hotelPaid && this.state.currentCity.tier !== 3) {
            this.state.wake = Math.min(100, this.state.wake + this.state.car.sleepBonus);
            this.toast(`Ночевка в машине (+${this.state.car.sleepBonus}% бодрости).`);
        }
        
        this.updateTopUI();
        document.getElementById('city-overlay').style.display = 'none';
        this.toast("Выберите следующий город на карте!");
    },

    updateTopUI: function() {
        document.getElementById('val-coins').innerText = Math.round(this.state.coins);
        document.getElementById('val-gas').innerText = Math.round(this.state.gas);
        document.getElementById('val-food').innerText = Math.round(this.state.food);
        document.getElementById('val-wake').innerText = Math.round(this.state.wake);
        document.getElementById('val-hp').innerText = Math.round(this.state.hp);
    },

    showConfirm: function(title, text, onYes) {
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-text').innerText = text;
        document.getElementById('custom-modal').style.display = 'flex';
        document.getElementById('btn-modal-ok').onclick = () => { document.getElementById('custom-modal').style.display='none'; onYes(); };
        document.getElementById('btn-modal-cancel').onclick = () => { document.getElementById('custom-modal').style.display='none'; };
    },

    showQuest: function(city) {
        let q = city.quests[0];
        document.getElementById('quest-text').innerText = q.q;
        let ansDiv = document.getElementById('quest-answers'); ansDiv.innerHTML = '';
        
        q.a.forEach((ans, i) => {
            let b = document.createElement('button'); b.className = 'btn-action'; b.innerText = ans;
            b.onclick = () => {
                document.getElementById('quest-modal').style.display = 'none';
                if(i === q.right) { 
                    let reward = Data.prices[city.tier].quizReward;
                    this.state.coins += reward; 
                    this.toast(`Верно! Вы заработали ${reward} монет.`); 
                } else { 
                    this.toast("Неверный ответ! Опыта нет."); 
                }
                this.updateTopUI();
                this.openCityUI(city);
            };
            ansDiv.appendChild(b);
        });
        document.getElementById('quest-modal').style.display = 'flex';
    },

    openAlbum: function() {
        let grid = document.getElementById('album-grid'); grid.innerHTML = '';
        
        // ПОКАЗЫВАЕМ ТОЛЬКО СОБРАННЫЕ ГОРОДА
        let collectedCities = Data.cities.filter(c => this.state.collected.includes(c.id));
        
        if (collectedCities.length === 0) {
            grid.innerHTML = "<p style='color:#aaa;'>Альбом пока пуст. Выполняйте условия в городах.</p>";
        } else {
            collectedCities.forEach(c => {
                grid.innerHTML += `
                    <div class="album-card collected">
                        <i class="fa-solid fa-medal"></i>
                        <div style="font-weight:bold; font-size:13px;">${c.name}</div>
                    </div>`;
            });
        }
        document.getElementById('album-modal').style.display = 'flex';
    },

    toast: function(msg) {
        let c = document.getElementById('toast-container');
        let t = document.createElement('div'); t.className = 'toast'; t.innerText = msg;
        c.appendChild(t); setTimeout(() => t.remove(), 4000);
    },

    bindEvents: function() {
        document.getElementById('btn-leave-city').onclick = () => this.leaveCity();
        document.getElementById('btn-album').onclick = () => this.openAlbum();
    }
};

document.addEventListener('DOMContentLoaded', () => Game.init());