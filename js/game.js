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
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);

        this.checkDailyBonus();
        this.renderMap();
        this.bindEvents();
    },

    checkDailyBonus: function() {
        let last = localStorage.getItem('route_last_login');
        let today = new Date().toDateString();
        if (last !== today) {
            this.state.coins += 1000;
            this.state.coins += 200; // Условный бонус ВК
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
        this.toast("Кликните на город для старта!");
    },

    renderMap: function() {
        Data.cities.forEach(c => {
            let icon = L.divIcon({className: 'city-marker', iconSize: [16, 16], iconAnchor: [8,8]});
            let m = L.marker(c.coords, {icon: icon}).addTo(this.map);
            this.markers[c.id] = m;

            m.on('click', async () => {
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
        
        document.getElementById('status-text').style.display = 'none';
        document.getElementById('city-info').style.display = 'block';
        document.getElementById('city-name').innerText = city.name;
        document.getElementById('city-fact').innerText = "Счастливого пути! Ваши ресурсы полны.";
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

            this.showConfirm(`Едем в ${targetCity.name}?`, `Расстояние: ${Math.round(dist)} км.`, () => {
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

    // ====================================================
    // НОВАЯ ЛОГИКА ТРАТ (Дискретные шаги, а не проценты)
    // ====================================================
    openCityUI: function(city) {
        document.getElementById('status-text').style.display = 'none';
        document.getElementById('city-actions').style.display = 'block';
        document.getElementById('city-info').style.display = 'block';
        document.getElementById('city-name').innerText = city.name;
        document.getElementById('city-tier').innerText = `Уровень ${city.tier}`;
        document.getElementById('city-fact').innerText = city.fact;
        
        const p = Data.prices[city.tier];
        
        // 1. НОЧЛЕГ (3 шага: 0=В машине, 1=Мотель, 2=Отель)
        let slHotel = document.getElementById('sl-hotel');
        slHotel.min = 0; slHotel.max = 2; slHotel.step = 1; slHotel.value = 0;
        
        // 2. ЕДА (3 шага: 0=Голодать, 1=Перекус, 2=Обед)
        let slFood = document.getElementById('sl-food');
        slFood.min = 0; slFood.max = 2; slFood.step = 1; slFood.value = 0;
        
        // 3. БЕНЗИН (поштучно за 1 литр)
        const maxGas = Math.floor(this.state.car.tank - this.state.gas);
        let slGas = document.getElementById('sl-gas');
        slGas.min = 0; slGas.max = maxGas; slGas.step = 1; slGas.value = 0;
        
        // 4. РЕМОНТ (поштучно за 1%)
        const maxHp = Math.floor(100 - this.state.hp);
        let slHp = document.getElementById('sl-hp');
        slHp.min = 0; slHp.max = maxHp; slHp.step = 1; slHp.value = 0;

        document.getElementById('price-exc').innerText = p.exc;
        document.getElementById('chk-exc').checked = false;

        // Привязываем обработчики
        slHotel.oninput = () => this.updateSlidersLogic(p);
        slFood.oninput = () => this.updateSlidersLogic(p);
        slGas.oninput = () => this.updateSlidersLogic(p);
        slHp.oninput = () => this.updateSlidersLogic(p);

        this.updateSlidersLogic(p); // Вызываем для первичной отрисовки 0
        
        if(window.innerWidth <= 768) document.getElementById('game-panel').classList.add('open');
    },

    updateSlidersLogic: function(prices) {
        // Логика НОЧЛЕГА
        let hVal = parseInt(document.getElementById('sl-hotel').value);
        let hCost = 0, hText = "";
        this.tempHotelGain = 0; // Сохраняем во временную переменную для payCityBill

        if (hVal === 0) {
            hCost = 0; this.tempHotelGain = this.state.car.sleepBonus; hText = "В машине";
        } else if (hVal === 1) {
            hCost = Math.round(prices.hotel * 0.5); this.tempHotelGain = 60; hText = "Мотель";
        } else if (hVal === 2) {
            hCost = prices.hotel; this.tempHotelGain = 100; hText = "Отель";
        }
        document.getElementById('out-hotel').innerText = hCost;
        document.getElementById('gain-hotel').innerText = `+${this.tempHotelGain}% (${hText})`;

        // Логика ЕДЫ
        let fVal = parseInt(document.getElementById('sl-food').value);
        let fCost = 0, fText = "";
        this.tempFoodGain = 0;

        if (fVal === 0) {
            fCost = 0; this.tempFoodGain = 0; fText = "Голодать";
        } else if (fVal === 1) {
            fCost = Math.round(prices.food * 0.5); this.tempFoodGain = 50; fText = "Перекус";
        } else if (fVal === 2) {
            fCost = prices.food; this.tempFoodGain = 100; fText = "Плотный обед";
        }
        document.getElementById('out-food').innerText = fCost;
        document.getElementById('gain-food').innerText = `+${this.tempFoodGain}% (${fText})`;

        // Логика БЕНЗИНА
        let gVal = parseInt(document.getElementById('sl-gas').value);
        let gCost = gVal * prices.gasPerLiter;
        document.getElementById('out-gas').innerText = gCost;
        document.getElementById('gain-gas').innerText = `+${gVal} л.`;

        // Логика РЕМОНТА
        let hpVal = parseInt(document.getElementById('sl-hp').value);
        let hpCost = hpVal * prices.repairPerPercent;
        document.getElementById('out-hp').innerText = hpCost;
        document.getElementById('gain-hp').innerText = `+${hpVal}%`;

        // ИТОГО
        let sum = hCost + fCost + gCost + hpCost;
        if(document.getElementById('chk-exc').checked) sum += prices.exc;
        document.getElementById('total-bill').innerText = sum;
    },

    payCityBill: function() {
        let bill = parseInt(document.getElementById('total-bill').innerText);
        if (this.state.coins < bill) { this.toast("Недостаточно монет!"); return; }

        this.state.coins -= bill;

        // Применяем ресурсы из временных переменных
        this.state.wake = Math.min(100, this.state.wake + this.tempHotelGain);
        this.state.food = Math.min(100, this.state.food + this.tempFoodGain);
        this.state.gas += parseInt(document.getElementById('sl-gas').value);
        this.state.hp += parseInt(document.getElementById('sl-hp').value);

        // ПРОВЕРКА НА КОЛЛЕКЦИЮ ГОРОДА
        let hotelSpent = parseInt(document.getElementById('sl-hotel').value);
        let excBought = document.getElementById('chk-exc').checked;
        
        // Город засчитывается, если взят любой ночлег (кроме машины) И экскурсия
        if (hotelSpent > 0 && excBought) {
            if(!this.state.collected.includes(this.state.currentCity.id)) {
                this.state.collected.push(this.state.currentCity.id);
                this.toast("Карточка города добавлена в Альбом!");
                this.updateMarkers();
            }
        }

        document.getElementById('city-actions').style.display = 'none';
        document.getElementById('city-fact').innerText = "Оплата прошла успешно! Вы готовы ехать дальше.";
        this.updateTopUI();
    },

    // ====================================================

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
                if(i === q.right) { this.state.coins += 150; this.toast("Верно! +150 монет"); } 
                else { this.toast("Неверно! Опыта нет."); }
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

document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (window.vkBridge) {
            await vkBridge.send('VKWebAppInit'); 
            const user = await vkBridge.send('VKWebAppGetUserInfo');
            document.getElementById('player-name').innerText = user.first_name;
            document.getElementById('player-avatar').src = user.photo_200;
        }
    } catch (error) {
        console.log("Демо-режим.");
        document.getElementById('player-name').innerText = "Игрок";
    }
    Game.init();
});