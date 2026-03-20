window.Game = {
    map: null, markers: {}, routeLines: [],
    state: {
        coins: 1000, gas: 0, food: 100, wake: 100, hp: 100,
        car: null, diff: null, mode: null,
        currentCity: null, history: [], collected: []
    },

    init: function() {
        this.map = L.map('map', { zoomControl: false }).setView([55.75, 38.0], 6);
        L.control.zoom({position: 'topright'}).addTo(this.map);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '' }).addTo(this.map);

        this.checkDailyBonus();
        this.renderMap();
        this.bindEvents();
    },

    checkDailyBonus: function() {
        let last = localStorage.getItem('route_last_login');
        let today = new Date().toDateString();
        if (last !== today) {
            this.state.coins += 1000;
            this.state.coins += 200; // Бонус за группу ВК
            localStorage.setItem('route_last_login', today);
            this.toast("Ежедневный бонус: +1200 монет (с учетом ВК)!");
        }
        this.updateTopUI();
    },

    selectDifficulty: function(diff) {
        this.state.diff = diff;
        document.getElementById('difficulty-modal').style.display = 'none';
        
        const list = document.getElementById('garage-list'); list.innerHTML = '';
        Data.garages[diff].forEach(car => {
            let div = document.createElement('div'); div.className = 'car-card';
            div.innerHTML = `<h3>${car.name}</h3><p>Бак: ${car.tank}л | Расход: ${car.cons}л</p>`;
            div.onclick = () => {
                this.state.car = car;
                this.state.gas = car.tank;
                document.getElementById('garage-modal').style.display = 'none';
                document.getElementById('mode-modal').style.display = 'flex';
            };
            list.appendChild(div);
        });
        document.getElementById('garage-modal').style.display = 'flex';
    },

    selectMode: function(mode) {
        this.state.mode = mode;
        document.getElementById('mode-modal').style.display = 'none';
        document.getElementById('resource-panel').style.display = 'flex';
        this.updateTopUI();
        this.toast("Кликните на город, с которого начнется путешествие!");
    },

    renderMap: function() {
        Data.cities.forEach(c => {
            let icon = L.divIcon({className: 'city-marker', iconSize: [16, 16], iconAnchor: [8,8]});
            let m = L.marker(c.coords, {icon: icon}).addTo(this.map);
            this.markers[c.id] = m;

            m.on('click', async () => {
                if (!this.state.currentCity) {
                    this.setStartCity(c);
                } else {
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
        
        document.getElementById('status-text').style.display = 'none';
        document.getElementById('city-info').style.display = 'block';
        document.getElementById('city-name').innerText = city.name;
        document.getElementById('city-fact').innerText = "Счастливого пути! Ваши ресурсы полны.";
        
        // ВАЖНО: Прячем ползунки трат в стартовом городе!
        document.getElementById('city-actions').style.display = 'none'; 
        
        if(window.innerWidth <= 768) document.getElementById('game-panel').classList.add('open');
    },

    confirmTravel: async function(targetCity) {
        const start = this.state.currentCity.coords;
        const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${targetCity.coords[1]},${targetCity.coords[0]}?overview=full&geometries=geojson`;
        
        try {
            const res = await fetch(url); const data = await res.json();
            const dist = data.routes[0].distance / 1000;
            const routeCoords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);

            this.showConfirm(`Едем в ${targetCity.name}?`, `Расстояние: ${Math.round(dist)} км. Убедитесь, что хватит бензина.`, () => {
                this.executeTravel(targetCity, dist, routeCoords);
            });
        } catch(e) { this.toast("Ошибка прокладки маршрута"); }
    },

    executeTravel: function(city, distKm, coords) {
        let line = L.polyline(coords, {color: '#FF5722', weight: 4}).addTo(this.map);
        this.routeLines.push(line);

        if (this.state.car.id !== "bike") {
            this.state.gas -= (this.state.car.cons / 100) * distKm;
        } else {
            this.state.food -= (distKm * 0.5);
        }
        this.state.wake -= (distKm / 700) * 100;
        this.state.food -= (distKm * 0.05);
        this.state.hp -= (distKm / 100) * this.state.car.hpLoss;

        if(this.state.gas < 0) this.state.gas = 0;
        if(this.state.wake < 0) this.state.wake = 0;
        if(this.state.food < 0) this.state.food = 0;
        if(this.state.hp < 0) this.state.hp = 0;

        this.updateTopUI();

        this.state.currentCity = city;
        this.state.history.push(city.id);
        this.updateMarkers();
        this.map.panTo(city.coords);
        
        this.routeLines.forEach(l => l.setStyle({color: '#888', weight: 2}));
        line.setStyle({color: '#FF5722', weight: 4});

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
            el.className = 'leaflet-marker-icon leaflet-zoom-animated leaflet-interactive city-marker';
            if (this.state.collected.includes(id)) el.classList.add('collected');
            if (this.state.currentCity && this.state.currentCity.id === id) el.classList.add('current');
        });
    },

    openCityUI: function(city) {
        document.getElementById('status-text').style.display = 'none';
        document.getElementById('city-actions').style.display = 'block'; // Показываем ползунки
        document.getElementById('city-info').style.display = 'block';
        document.getElementById('city-name').innerText = city.name;
        document.getElementById('city-tier').innerText = `Уровень ${city.tier}`;
        document.getElementById('city-fact').innerText = city.fact || "Вы прибыли в город!";
        
        const p = Data.prices[city.tier];
        const maxGas = this.state.car.tank - this.state.gas;
        
        this.setupSlider('hotel', p.hotel, 100 - this.state.wake, '%');
        this.setupSlider('food', p.food, 100 - this.state.food, '%');
        this.setupSlider('hp', p.repair, 100 - this.state.hp, '%');
        this.setupSlider('gas', p.gasPerLiter * maxGas, maxGas, 'л.');

        document.getElementById('price-exc').innerText = p.exc;
        document.getElementById('chk-exc').checked = false;

        this.calcTotal();
        if(window.innerWidth <= 768) document.getElementById('game-panel').classList.add('open');
    },

    setupSlider: function(id, maxPrice, maxGain, unit) {
        let sl = document.getElementById(`sl-${id}`);
        sl.max = Math.max(0, maxPrice); sl.value = 0;
        document.getElementById(`out-${id}`).innerText = 0;
        document.getElementById(`gain-${id}`).innerText = `+0${unit}`;
        
        sl.oninput = () => {
            document.getElementById(`out-${id}`).innerText = sl.value;
            let gain = maxPrice > 0 ? (sl.value / maxPrice) * maxGain : 0;
            document.getElementById(`gain-${id}`).innerText = `+${Math.round(gain)}${unit}`;
            this.calcTotal();
        };
    },

    calcTotal: function() {
        let sum = ['hotel','food','gas','hp'].reduce((acc, id) => acc + parseInt(document.getElementById(`sl-${id}`).value), 0);
        if(document.getElementById('chk-exc').checked) sum += Data.prices[this.state.currentCity.tier].exc;
        document.getElementById('total-bill').innerText = sum;
    },

    payCityBill: function() {
        let bill = parseInt(document.getElementById('total-bill').innerText);
        if (this.state.coins < bill) { this.toast("Недостаточно монет!"); return; }

        this.state.coins -= bill;
        const p = Data.prices[this.state.currentCity.tier];

        if(p.hotel > 0) this.state.wake += (document.getElementById('sl-hotel').value / p.hotel) * (100 - this.state.wake);
        if(p.food > 0) this.state.food += (document.getElementById('sl-food').value / p.food) * (100 - this.state.food);
        if(p.repair > 0) this.state.hp += (document.getElementById('sl-hp').value / p.repair) * (100 - this.state.hp);
        
        let maxGas = this.state.car.tank - this.state.gas;
        if(maxGas > 0 && p.gasPerLiter > 0) this.state.gas += (document.getElementById('sl-gas').value / (p.gasPerLiter * maxGas)) * maxGas;

        let hotelSpent = parseInt(document.getElementById('sl-hotel').value);
        let excBought = document.getElementById('chk-exc').checked;
        
        if (hotelSpent > 0 && excBought) {
            if(!this.state.collected.includes(this.state.currentCity.id)) {
                this.state.collected.push(this.state.currentCity.id);
                this.toast("Поздравляем! Карточка города добавлена в Альбом!");
                this.updateMarkers();
            }
        }

        document.getElementById('city-actions').style.display = 'none';
        document.getElementById('city-fact').innerText = "Готов к отправлению дальше.";
        this.updateTopUI();
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
                if(i === q.right) { this.state.coins += 100; this.toast("Верно! +100 монет"); } 
                else { this.toast("Неверно!"); }
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
                    <div style="font-weight:bold; font-size:14px;">${c.name}</div>
                    <div style="font-size:10px; color:#888;">${isCol ? 'Собрано' : 'Не изучено'}</div>
                </div>`;
        });
        document.getElementById('album-modal').style.display = 'flex';
    },

    toast: function(msg) {
        let c = document.getElementById('toast-container');
        let t = document.createElement('div'); t.className = 'toast'; t.innerText = msg;
        c.appendChild(t); setTimeout(() => t.remove(), 3000);
    },

    bindEvents: function() {
        document.getElementById('btn-pay-city').onclick = () => this.payCityBill();
        document.getElementById('btn-album').onclick = () => this.openAlbum();
        const handle = document.querySelector('.mobile-drag-handle');
        if(handle) handle.onclick = () => { if(window.innerWidth<=768) document.getElementById('game-panel').classList.toggle('open'); };
    }
};

// =====================================================================
// КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: ИНИЦИАЛИЗАЦИЯ ВК (БЕЗ НЕЕ БУДЕТ ЗАВИСАНИЕ!)
// =====================================================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (window.vkBridge) {
            await vkBridge.send('VKWebAppInit'); // <- ИМЕННО ЭТА СТРОЧКА УБИРАЕТ СЕРЫЙ ЭКРАН С ЗАГРУЗКОЙ
            const user = await vkBridge.send('VKWebAppGetUserInfo');
            document.getElementById('player-name').innerText = user.first_name;
            document.getElementById('player-avatar').src = user.photo_200;
        }
    } catch (error) {
        console.log("Запущено вне ВК, демо-режим.");
        document.getElementById('player-name').innerText = "Игрок";
    }
    
    // Запускаем игру!
    Game.init();
});