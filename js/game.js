window.Game = {
    map: null, markers: {}, routeLines: [], carMarker: null,
    state: {
        coins: 5000, gas: 0, food: 100, wake: 100, hp: 100,
        car: null, diff: null, mode: null,
        currentCity: null, history: [], collected: [], isMoving: false,
        hasPaidHotel: false, hasPaidExc: false
    },

    init: function() {
        this.map = L.map('map', { zoomControl: false }).setView([55.75, 38.0], 6);
        L.control.zoom({position: 'topright'}).addTo(this.map);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '' }).addTo(this.map);

        this.renderMap();
        this.bindEvents();
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
                document.getElementById('resource-panel').style.display = 'flex';
                this.updateTopUI();
                this.toast("Кликните на город на карте для старта!");
            };
            list.appendChild(div);
        });
        document.getElementById('garage-modal').style.display = 'flex';
    },

    renderMap: function() {
        Data.cities.forEach(c => {
            let icon = L.divIcon({className: 'city-marker', iconSize: [16, 16], iconAnchor: [8,8]});
            let m = L.marker(c.coords, {icon: icon}).addTo(this.map);
            this.markers[c.id] = m;

            m.on('click', async () => {
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

        document.getElementById('status-text').style.display = 'none';
        document.getElementById('city-info').style.display = 'block';
        document.getElementById('city-name').innerText = city.name;
        document.getElementById('city-tier').innerText = `Стартовая точка`;
        document.getElementById('city-fact').innerText = "Вы готовы к экспедиции. Выберите следующую точку на карте.";
        document.getElementById('city-actions').style.display = 'none'; 
        
        if(window.innerWidth <= 768) document.getElementById('game-panel').classList.add('open');
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
        } catch(e) { this.toast("Ошибка навигатора"); }
    },

    executeTravel: function(city, distKm, coords) {
        document.getElementById('city-info').style.display = 'none';
        document.getElementById('status-text').style.display = 'block';
        document.getElementById('status-text').innerHTML = `<i class="fa-solid fa-car-side"></i> Едем в ${city.name}...`;
        if(window.innerWidth <= 768) document.getElementById('game-panel').classList.remove('open');

        let line = L.polyline(coords, {color: '#FF5722', weight: 4}).addTo(this.map);
        this.routeLines.push(line);

        // Деньги НЕ списываем автоматически. Тратятся только ресурсы (Сытость, Бензин, Бодрость, Прочность)
        if (this.state.car.id !== "bike") this.state.gas -= (this.state.car.cons / 100) * distKm;
        else this.state.food -= (distKm * 0.5);
        
        this.state.wake -= (distKm / 700) * 100;
        this.state.food -= (distKm * 0.05);
        this.state.hp -= (distKm / 100) * this.state.car.hpLoss;

        if(this.state.gas < 0) this.state.gas = 0;
        if(this.state.wake < 0) this.state.wake = 0;
        if(this.state.food < 0) this.state.food = 0;
        if(this.state.hp < 0) this.state.hp = 0;

        this.updateTopUI();
        this.state.isMoving = true;

        // АНИМАЦИЯ МАШИНКИ ПО ТРАССЕ
        let step = 0;
        let speed = Math.max(1, Math.floor(coords.length / 40)); 
        let moveInterval = setInterval(() => {
            step += speed;
            if (step >= coords.length - 1) {
                step = coords.length - 1;
                clearInterval(moveInterval);
                this.carMarker.setLatLng(coords[step]);
                this.finishTravel(city, line);
            } else {
                this.carMarker.setLatLng(coords[step]);
                if(window.innerWidth > 768) this.map.panTo(coords[step], {animate: true, duration: 0.1});
            }
        }, 50);
    },

    finishTravel: function(city, line) {
        this.state.isMoving = false;
        this.state.currentCity = city;
        this.state.history.push(city.id);
        
        this.routeLines.forEach(l => l.setStyle({color: '#666', weight: 3, dashArray: '5, 10'}));
        line.setStyle({color: '#FF5722', weight: 4, dashArray: null});
        this.updateMarkers();
        
        // КВЕСТ СРАЗУ ПО ПРИЕЗДУ
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
        });
    },

    // ====================================================
    // МАГАЗИН (Свобода выбора)
    // ====================================================
    openCityUI: function(city) {
        // Сбрасываем флаги
        this.state.hasPaidHotel = false;
        this.state.hasPaidExc = false;

        document.getElementById('status-text').style.display = 'none';
        document.getElementById('city-actions').style.display = 'block';
        document.getElementById('city-info').style.display = 'block';
        document.getElementById('city-name').innerText = city.name;
        document.getElementById('city-tier').innerText = `Уровень ${city.tier}`;
        document.getElementById('city-fact').innerText = city.fact;
        
        const p = Data.prices[city.tier];
        
        // НОЧЛЕГ
        let chkHotel = document.getElementById('chk-hotel');
        let wrapHotel = document.getElementById('wrap-hotel');
        let slHotel = document.getElementById('sl-hotel');
        
        chkHotel.checked = false; wrapHotel.style.display = 'none';
        slHotel.min = p.hotelMin; slHotel.max = p.hotelMax; slHotel.step = 50; slHotel.value = p.hotelMin;
        
        chkHotel.onchange = () => { wrapHotel.style.display = chkHotel.checked ? 'block' : 'none'; this.calcCityBill(p); };
        slHotel.oninput = () => this.calcCityBill(p);

        // ЕДА
        let chkFood = document.getElementById('chk-food');
        let wrapFood = document.getElementById('wrap-food');
        let slFood = document.getElementById('sl-food');

        chkFood.checked = false; wrapFood.style.display = 'none';
        slFood.min = p.foodMin; slFood.max = p.foodMax; slFood.step = 50; slFood.value = p.foodMin;
        
        chkFood.onchange = () => { wrapFood.style.display = chkFood.checked ? 'block' : 'none'; this.calcCityBill(p); };
        slFood.oninput = () => this.calcCityBill(p);

        // БЕНЗИН И РЕМОНТ
        let wrapGas = document.getElementById('wrap-gas-hp');
        if (this.state.car.id === "bike" || (p.gas === 0 && p.repair === 0)) {
            wrapGas.style.display = 'none';
        } else {
            wrapGas.style.display = 'block';
            let maxGas = Math.max(0, Math.floor(this.state.car.tank - this.state.gas));
            let slGas = document.getElementById('sl-gas');
            slGas.min = 0; slGas.max = maxGas; slGas.step = 1; slGas.value = 0;
            
            let maxHp = Math.max(0, Math.floor(100 - this.state.hp));
            let slHp = document.getElementById('sl-hp');
            slHp.min = 0; slHp.max = maxHp; slHp.step = 1; slHp.value = 0;

            slGas.oninput = () => this.calcCityBill(p);
            slHp.oninput = () => this.calcCityBill(p);
        }

        // ЭКСКУРСИЯ
        document.getElementById('price-exc').innerText = p.exc;
        document.getElementById('chk-exc').checked = false;
        document.getElementById('chk-exc').onchange = () => this.calcCityBill(p);

        this.calcCityBill(p);
        if(window.innerWidth <= 768) document.getElementById('game-panel').classList.add('open');
    },

    calcCityBill: function(p) {
        let total = 0;

        // Отель (от 50% до 100% бодрости)
        this.tempHotelGain = 0;
        if (document.getElementById('chk-hotel').checked) {
            let cost = parseInt(document.getElementById('sl-hotel').value);
            total += cost;
            document.getElementById('out-hotel').innerText = cost;
            let percent = p.hotelMax === p.hotelMin ? 100 : 50 + ((cost - p.hotelMin) / (p.hotelMax - p.hotelMin)) * 50;
            this.tempHotelGain = Math.round(percent);
            document.getElementById('gain-hotel').innerText = `+${this.tempHotelGain}%`;
        }

        // Еда (от 50% до 100% сытости)
        this.tempFoodGain = 0;
        if (document.getElementById('chk-food').checked) {
            let cost = parseInt(document.getElementById('sl-food').value);
            total += cost;
            document.getElementById('out-food').innerText = cost;
            let percent = p.foodMax === p.foodMin ? 100 : 50 + ((cost - p.foodMin) / (p.foodMax - p.foodMin)) * 50;
            this.tempFoodGain = Math.round(percent);
            document.getElementById('gain-food').innerText = `+${this.tempFoodGain}%`;
        }

        // Бензин и Ремонт
        if (this.state.car.id !== "bike" && p.gas > 0) {
            let gVal = parseInt(document.getElementById('sl-gas').value);
            let gCost = gVal * p.gas;
            total += gCost;
            document.getElementById('out-gas').innerText = gCost;
            document.getElementById('gain-gas').innerText = `+${gVal} л.`;

            let hpVal = parseInt(document.getElementById('sl-hp').value);
            let hpCost = hpVal * p.repair;
            total += hpCost;
            document.getElementById('out-hp').innerText = hpCost;
            document.getElementById('gain-hp').innerText = `+${hpVal}%`;
        }

        if(document.getElementById('chk-exc').checked) total += p.exc;

        document.getElementById('total-bill').innerText = total;
    },

    payCityBill: function() {
        let bill = parseInt(document.getElementById('total-bill').innerText);
        if (bill === 0) { this.toast("Вы ничего не выбрали для покупки."); return; }
        if (this.state.coins < bill) { this.toast("Недостаточно монет!"); return; }

        this.state.coins -= bill;

        if (document.getElementById('chk-hotel').checked) {
            this.state.wake = Math.min(100, this.state.wake + this.tempHotelGain);
            this.state.hasPaidHotel = true;
        }
        if (document.getElementById('chk-food').checked) {
            this.state.food = Math.min(100, this.state.food + this.tempFoodGain);
        }
        
        if (this.state.car.id !== "bike") {
            this.state.gas += parseInt(document.getElementById('sl-gas').value);
            this.state.hp += parseInt(document.getElementById('sl-hp').value);
        }

        if (document.getElementById('chk-exc').checked) {
            this.state.hasPaidExc = true;
        }

        // ПРОВЕРКА НА КАРТОЧКУ ГОРОДА
        if (this.state.hasPaidHotel && this.state.hasPaidExc) {
            if(!this.state.collected.includes(this.state.currentCity.id)) {
                this.state.collected.push(this.state.currentCity.id);
                this.toast("Поздравляем! Карточка города добавлена в Альбом!");
                this.updateMarkers();
            }
        }

        // Сбрасываем ползунки на 0 после оплаты
        document.getElementById('chk-hotel').checked = false;
        document.getElementById('chk-food').checked = false;
        document.getElementById('chk-exc').checked = false;
        if(document.getElementById('sl-gas')) document.getElementById('sl-gas').value = 0;
        if(document.getElementById('sl-hp')) document.getElementById('sl-hp').value = 0;
        this.calcCityBill(Data.prices[this.state.currentCity.tier]);
        
        this.toast("Услуги успешно оплачены!");
        this.updateTopUI();
    },

    // ЛОГИКА ОТЪЕЗДА
    leaveCity: function() {
        if (!this.state.hasPaidHotel) {
            // Спал в машине
            this.state.wake = Math.min(100, this.state.wake + this.state.car.sleepBonus);
            this.toast(`Вы переночевали в машине (+${this.state.car.sleepBonus}% бодрости).`);
        }
        this.updateTopUI();
        document.getElementById('city-info').style.display = 'none';
        document.getElementById('status-text').style.display = 'block';
        document.getElementById('status-text').innerHTML = `<i class="fa-solid fa-map-location-dot"></i> Выберите следующий город на карте.`;
        if(window.innerWidth <= 768) document.getElementById('game-panel').classList.remove('open');
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
                if(i === q.right) { this.state.coins += 150; this.toast("Верный ответ! +150 монет от спонсоров."); } 
                else { this.toast("Увы, ответ неверный."); }
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
        c.appendChild(t); setTimeout(() => t.remove(), 4000);
    },

    bindEvents: function() {
        document.getElementById('btn-pay-city').onclick = () => this.payCityBill();
        document.getElementById('btn-leave-city').onclick = () => this.leaveCity();
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
    } catch (error) { document.getElementById('player-name').innerText = "Игрок"; }
    
    document.getElementById('difficulty-modal').style.display = 'flex';
    Game.init();
});