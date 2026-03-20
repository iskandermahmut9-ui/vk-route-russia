window.Game = {
    map: null, markers: {}, routeLines: [], carMarker: null,
    state: {
        coins: 1500, gas: 0, food: 100, wake: 100, hp: 100,
        car: null, diff: null, currentCity: null, history: [], collected: [], discovered: [], isMoving: false,
        hotelPaid: false, excPaid: false
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
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '' }).addTo(this.map);

        this.checkDailyBonus();
        this.renderMap();
        this.bindEvents();
        
        document.getElementById('difficulty-modal').style.display = 'flex';
    },

    checkDailyBonus: function() {
        let last = localStorage.getItem('rr_daily');
        let today = new Date().toDateString();
        if (last !== today) {
            this.state.coins += 1200;
            localStorage.setItem('rr_daily', today);
            this.toast("Ежедневный бонус: +1200 монет!");
        }
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
                this.toast("Кликните на столицу региона на карте, чтобы стартовать!");
            };
            list.appendChild(div);
        });
        document.getElementById('garage-modal').style.display = 'flex';
    },

    renderMap: function() {
        Data.cities.forEach(c => {
            let isHidden = c.tier === 3;
            let icon = L.divIcon({ className: `city-marker ${isHidden ? 'hidden-tier' : ''}`, iconSize: [16, 16], iconAnchor: [8,8] });
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
        
        let carIcon = L.divIcon({className: 'city-marker current', iconSize: [24, 24], iconAnchor: [12,12]});
        this.carMarker = L.marker(city.coords, {icon: carIcon, zIndexOffset: 1000}).addTo(this.map);

        document.getElementById('city-overlay').style.display = 'flex';
        document.getElementById('city-name').innerText = city.name;
        document.getElementById('city-tier').innerText = `СТАРТОВАЯ ТОЧКА`;
        document.getElementById('city-fact').innerText = "Бак полон. Жмите 'Ехать дальше' и выбирайте город на карте.";
        document.getElementById('city-shop').innerHTML = ''; 
    },

    confirmTravel: async function(targetCity) {
        const start = this.state.currentCity.coords;
        const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${targetCity.coords[1]},${targetCity.coords[0]}?overview=full&geometries=geojson`;
        
        try {
            const res = await fetch(url); const data = await res.json();
            const distKm = data.routes[0].distance / 1000;
            const routeCoords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);

            this.showConfirm(`Едем в ${targetCity.name}?`, `Расстояние: ${Math.round(distKm)} км.`, () => {
                this.executeTravel(targetCity, distKm, routeCoords);
            });
        } catch(e) { this.toast("Ошибка сети. Попробуйте другой город."); }
    },

    executeTravel: function(city, distKm, coords) {
        document.getElementById('city-overlay').style.display = 'none';
        
        let gameHours = distKm / 100;
        let realSeconds = (gameHours * 60) / 10; // 1 сек реал = 10 мин игр.
        let durationMs = realSeconds * 1000; 

        document.getElementById('travel-hud').style.display = 'block';
        document.getElementById('hud-target').innerText = city.name;
        document.getElementById('hud-time').innerText = Math.round(gameHours);

        let line = L.polyline(coords, {color: '#FF5722', weight: 4}).addTo(this.map);
        this.routeLines.push(line);
        this.state.isMoving = true;

        let gasDrain = this.state.car.id !== "bike" ? (this.state.car.cons / 100) * distKm : 0;
        let foodDrain = gameHours * 4.1; // 100% еды сгорает за 24ч
        let wakeDrain = (distKm / 700) * 100;
        let hpDrain = (distKm / 100) * this.state.car.hpLoss;

        let steps = coords.length;
        let intervalMs = 50;
        let totalIntervals = durationMs / intervalMs;
        let stepIncrement = steps / totalIntervals;
        let currentStep = 0;

        let moveInterval = setInterval(() => {
            currentStep += stepIncrement;
            if (currentStep >= steps - 1) currentStep = steps - 1;
            
            let pos = coords[Math.floor(currentStep)];
            this.carMarker.setLatLng(pos);
            if(window.innerWidth > 768) this.map.panTo(pos, {animate: true, duration: 0.1});

            Data.cities.forEach(c => {
                if (c.tier === 3 && !this.state.discovered.includes(c.id)) {
                    let distanceMeters = this.map.distance(pos, c.coords);
                    if (distanceMeters <= this.state.car.radius * 1000) {
                        this.state.discovered.push(c.id);
                        this.markers[c.id].getElement().classList.remove('hidden-tier');
                        this.markers[c.id].getElement().classList.add('discovered');
                        this.toast(`Радар нашел скрытую локацию: ${c.name}!`);
                    }
                }
            });

            if (currentStep >= steps - 1) {
                clearInterval(moveInterval);
                document.getElementById('travel-hud').style.display = 'none';
                
                this.state.gas = Math.max(0, this.state.gas - gasDrain);
                this.state.food = Math.max(0, this.state.food - foodDrain);
                this.state.wake = Math.max(0, this.state.wake - wakeDrain);
                this.state.hp = Math.max(0, this.state.hp - hpDrain);
                
                this.finishTravel(city, line);
            }
        }, intervalMs);
    },

    finishTravel: function(city, line) {
        this.state.isMoving = false;
        this.state.currentCity = city;
        this.state.history.push(city.id);
        
        this.routeLines.forEach(l => l.setStyle({color: '#555', weight: 3, dashArray: '5, 10'}));
        line.setStyle({color: '#FF5722', weight: 4, dashArray: null});

        this.updateMarkers();
        this.updateTopUI();
        
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
            let isHidden = Data.cities.find(c => c.id === id).tier === 3;
            let isDisc = this.state.discovered.includes(id);
            
            el.className = 'leaflet-marker-icon leaflet-zoom-animated leaflet-interactive city-marker';
            if (isHidden && !isDisc) el.classList.add('hidden-tier');
            if (isHidden && isDisc) el.classList.add('discovered');
            if (this.state.collected.includes(id)) el.classList.add('collected');
        });
    },

    // ====================================================
    // ДИНАМИЧЕСКИЙ МАГАЗИН ГОРОДА
    // ====================================================
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

        // 1. НОЧЛЕГ (Выбор)
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

        // 2. ЕДА (Выбор)
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

        // 3. БЕНЗИН (Динамический)
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

        // 4. СТО (Динамический)
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
            html += `<div class="shop-category"><h4>🎫 Культура</h4><div class="btn-group">`;
            html += `<button class="btn-shop ${this.state.excPaid ? 'purchased' : ''}" ${this.state.excPaid ? 'disabled' : ''} onclick="Game.buyItem('exc', ${p.exc}, 0)">
                <b>Экскурсия</b><small>Нужно для коллекции</small><span class="price">${p.exc} ₽</span></button>`;
            html += `</div></div>`;
        }

        document.getElementById('city-shop').innerHTML = html;
    },

    buyItem: function(type, price, amount) {
        if (this.state.coins < price) {
            this.toast("Не хватает монет!");
            return;
        }
        
        this.state.coins -= price;

        if (type === 'hotel') {
            this.state.wake = Math.min(100, this.state.wake + amount);
            this.state.hotelPaid = true;
            this.toast("Вы отлично отдохнули!");
        } else if (type === 'food') {
            this.state.food = Math.min(100, this.state.food + amount);
            this.toast("Сытость пополнена!");
        } else if (type === 'gas') {
            this.state.gas += amount;
            this.toast("Машина заправлена!");
        } else if (type === 'hp') {
            this.state.hp += amount;
            this.toast("Ремонт выполнен!");
        } else if (type === 'exc') {
            this.state.excPaid = true;
            this.toast("Вы посетили экскурсию!");
        }

        this.updateTopUI();
        
        // Проверка на добавление в Альбом
        if (this.state.hotelPaid && this.state.excPaid && !this.state.collected.includes(this.state.currentCity.id)) {
            this.state.collected.push(this.state.currentCity.id);
            this.toast("Условия выполнены! Карточка города добавлена в Альбом!");
            this.updateMarkers();
        }

        // Перерисовываем магазин, чтобы обновить кнопки и цены
        this.renderCityShop(this.state.currentCity);
    },

    leaveCity: function() {
        if (!this.state.hotelPaid && this.state.currentCity.tier !== 3) {
            // Спали в машине
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
                    this.toast("Неверно! Опыта нет."); 
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
        Data.cities.forEach(c => {
            let isCol = this.state.collected.includes(c.id);
            grid.innerHTML += `
                <div class="album-card ${isCol ? 'collected' : ''}">
                    <i class="fa-solid ${isCol ? 'fa-medal' : 'fa-lock'}"></i>
                    <div style="font-weight:bold; font-size:13px;">${c.name}</div>
                </div>`;
        });
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