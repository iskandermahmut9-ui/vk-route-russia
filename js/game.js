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
        } catch (e) { console.log("Запущено вне ВК"); }

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
            this.state.coins += 1200; // 1000 + 200 ВК бонус
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
                this.toast("Кликните на город на карте (Столицу), чтобы стартовать!");
            };
            list.appendChild(div);
        });
        document.getElementById('garage-modal').style.display = 'flex';
    },

    renderMap: function() {
        Data.cities.forEach(c => {
            let isHidden = c.tier === 3;
            let icon = L.divIcon({
                className: `city-marker ${isHidden ? 'hidden-tier' : ''}`, 
                iconSize: [16, 16], iconAnchor: [8,8]
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
        
        let carIcon = L.divIcon({className: 'city-marker current', iconSize: [24, 24], iconAnchor: [12,12]});
        this.carMarker = L.marker(city.coords, {icon: carIcon, zIndexOffset: 1000}).addTo(this.map);

        document.getElementById('status-text').style.display = 'none';
        document.getElementById('city-info').style.display = 'block';
        document.getElementById('city-name').innerText = city.name;
        document.getElementById('city-tier').innerText = `СТАРТОВАЯ ТОЧКА`;
        document.getElementById('city-fact').innerText = "Бак полон. Вы готовы начать экспедицию.";
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

    // ЧЕСТНАЯ АНИМАЦИЯ ПОЕЗДКИ И ТРАТА РЕСУРСОВ
    executeTravel: function(city, distKm, coords) {
        document.getElementById('city-info').style.display = 'none';
        document.getElementById('status-text').style.display = 'block';
        document.getElementById('status-text').innerHTML = `<i class="fa-solid fa-car-side"></i> Едем в ${city.name}...`;
        if(window.innerWidth <= 768) document.getElementById('game-panel').classList.remove('open');

        let line = L.polyline(coords, {color: '#FF5722', weight: 4}).addTo(this.map);
        this.routeLines.push(line);
        this.state.isMoving = true;

        // Математика (Ресурсы тратятся от дистанции)
        let totalGasDrain = this.state.car.id !== "bike" ? (this.state.car.cons / 100) * distKm : 0;
        let totalFoodDrain = this.state.car.id !== "bike" ? (distKm * 0.05) : (distKm * 0.5); // Велик жрет еду
        let totalWakeDrain = (distKm / 700) * 100;
        let totalHpDrain = (distKm / 100) * this.state.car.hpLoss;

        let steps = coords.length;
        let currentStep = 0;
        let speed = Math.max(1, Math.floor(steps / 60)); 

        let moveInterval = setInterval(() => {
            currentStep += speed;
            if (currentStep >= steps - 1) currentStep = steps - 1;
            
            let pos = coords[currentStep];
            this.carMarker.setLatLng(pos);
            if(window.innerWidth > 768) this.map.panTo(pos, {animate: true, duration: 0.1});

            // МЕХАНИКА: ПОИСК СКРЫТЫХ ГОРОДОВ (УРОВЕНЬ 3)
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

            if (currentStep === steps - 1) {
                clearInterval(moveInterval);
                
                // Финальное списание ресурсов
                this.state.gas -= totalGasDrain;
                this.state.food -= totalFoodDrain;
                this.state.wake -= totalWakeDrain;
                this.state.hp -= totalHpDrain;

                if(this.state.gas < 0) this.state.gas = 0;
                if(this.state.wake < 0) this.state.wake = 0;
                if(this.state.food < 0) this.state.food = 0;
                if(this.state.hp < 0) this.state.hp = 0;
                
                this.finishTravel(city, line);
            }
        }, 40);
    },

    finishTravel: function(city, line) {
        this.state.isMoving = false;
        this.state.currentCity = city;
        this.state.history.push(city.id);
        
        // Рисуем шлейф истории
        this.routeLines.forEach(l => l.setStyle({color: '#555', weight: 3, dashArray: '5, 10'}));
        line.setStyle({color: '#FF5722', weight: 4, dashArray: null});

        this.updateMarkers();
        this.updateTopUI();
        
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
            // Сохраняем логику скрытых и найденных городов
            let isHidden = Data.cities.find(c => c.id === id).tier === 3;
            let isDisc = this.state.discovered.includes(id);
            
            el.className = 'leaflet-marker-icon leaflet-zoom-animated leaflet-interactive city-marker';
            if (isHidden && !isDisc) el.classList.add('hidden-tier');
            if (isHidden && isDisc) el.classList.add('discovered');
            if (this.state.collected.includes(id)) el.classList.add('collected');
        });
    },

    // ====================================================
    // МЕНЮ ГОРОДА И СВОБОДНАЯ ПОКУПКА
    // ====================================================
    openCityUI: function(city) {
        this.state.hotelPaid = false;
        this.state.excPaid = false;

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
        document.getElementById('car-sleep-val').innerText = this.state.car.sleepBonus;
        
        if (p.hotelMax > 0) {
            chkHotel.disabled = false; chkHotel.checked = false; wrapHotel.style.display = 'none';
            slHotel.min = p.hotelMin; slHotel.max = p.hotelMax; slHotel.step = 50; slHotel.value = p.hotelMin;
        } else {
            chkHotel.disabled = true; chkHotel.checked = false; wrapHotel.style.display = 'none'; // Нет отелей
        }
        chkHotel.onchange = () => { wrapHotel.style.display = chkHotel.checked ? 'block' : 'none'; this.calcCityBill(p); };
        slHotel.oninput = () => this.calcCityBill(p);

        // ЕДА
        let chkFood = document.getElementById('chk-food');
        let wrapFood = document.getElementById('wrap-food');
        let slFood = document.getElementById('sl-food');

        if (p.foodMax > 0) {
            chkFood.disabled = false; chkFood.checked = false; wrapFood.style.display = 'none';
            slFood.min = p.foodMin; slFood.max = p.foodMax; slFood.step = 50; slFood.value = p.foodMin;
        } else {
            chkFood.disabled = true; chkFood.checked = false; wrapFood.style.display = 'none';
        }
        chkFood.onchange = () => { wrapFood.style.display = chkFood.checked ? 'block' : 'none'; this.calcCityBill(p); };
        slFood.oninput = () => this.calcCityBill(p);

        // БЕНЗИН И РЕМОНТ (Отображаем как ползунки)
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

        // Отель (от 50% до 100%)
        this.tempHotelGain = 0;
        if (document.getElementById('chk-hotel').checked && p.hotelMax > 0) {
            let cost = parseInt(document.getElementById('sl-hotel').value);
            total += cost;
            document.getElementById('out-hotel').innerText = cost;
            let percent = p.hotelMax === p.hotelMin ? 100 : 50 + ((cost - p.hotelMin) / (p.hotelMax - p.hotelMin)) * 50;
            this.tempHotelGain = Math.round(percent);
            document.getElementById('gain-hotel').innerText = `+${this.tempHotelGain}%`;
        }

        // Еда
        this.tempFoodGain = 0;
        if (document.getElementById('chk-food').checked && p.foodMax > 0) {
            let cost = parseInt(document.getElementById('sl-food').value);
            total += cost;
            document.getElementById('out-food').innerText = cost;
            let percent = p.foodMax === p.foodMin ? 100 : 50 + ((cost - p.foodMin) / (p.foodMax - p.foodMin)) * 50;
            this.tempFoodGain = Math.round(percent);
            document.getElementById('gain-food').innerText = `+${this.tempFoodGain}%`;
        }

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
        if (this.state.coins < bill) { this.toast("Недостаточно монет! Пройдите опросы или посмотрите рекламу."); return; }

        this.state.coins -= bill;

        if (document.getElementById('chk-hotel').checked) {
            this.state.wake = Math.min(100, this.state.wake + this.tempHotelGain);
            this.state.hotelPaid = true;
        }
        if (document.getElementById('chk-food').checked) {
            this.state.food = Math.min(100, this.state.food + this.tempFoodGain);
        }
        
        if (this.state.car.id !== "bike") {
            this.state.gas += parseInt(document.getElementById('sl-gas').value);
            this.state.hp += Math.min(100, this.state.hp + parseInt(document.getElementById('sl-hp').value));
        }

        if (document.getElementById('chk-exc').checked) this.state.excPaid = true;

        // ПРОВЕРКА НА КАРТОЧКУ ГОРОДА
        if (this.state.hotelPaid && this.state.excPaid) {
            if(!this.state.collected.includes(this.state.currentCity.id)) {
                this.state.collected.push(this.state.currentCity.id);
                this.toast("Город пройден! Карточка добавлена в Альбом.");
                this.updateMarkers();
            }
        } else {
            this.toast("Услуги оплачены!");
        }

        // Обнуляем интерфейс
        document.getElementById('chk-hotel').checked = false;
        document.getElementById('chk-food').checked = false;
        document.getElementById('chk-exc').checked = false;
        if(document.getElementById('sl-gas')) document.getElementById('sl-gas').value = 0;
        if(document.getElementById('sl-hp')) document.getElementById('sl-hp').value = 0;
        this.calcCityBill(Data.prices[this.state.currentCity.tier]);
        this.updateTopUI();
    },

    // ЛОГИКА ОТЪЕЗДА
    leaveCity: function() {
        if (!this.state.hotelPaid) {
            // Если не снимали жилье - спим в машине бесплатно
            this.state.wake = Math.min(100, this.state.wake + this.state.car.sleepBonus);
            this.toast(`Ночевка в машине (+${this.state.car.sleepBonus}% бодрости).`);
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
                if(i === q.right) { 
                    let reward = Data.prices[city.tier].quizReward;
                    this.state.coins += reward; 
                    this.toast(`Верно! Вы заработали ${reward} монет.`); 
                } else { 
                    this.toast("Неверный ответ! Вы ничего не заработали."); 
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
        document.getElementById('btn-pay-city').onclick = () => this.payCityBill();
        document.getElementById('btn-leave-city').onclick = () => this.leaveCity();
        document.getElementById('btn-album').onclick = () => this.openAlbum();
        const handle = document.querySelector('.mobile-drag-handle');
        if(handle) handle.onclick = () => { if(window.innerWidth<=768) document.getElementById('game-panel').classList.toggle('open'); };
    }
};

document.addEventListener('DOMContentLoaded', () => Game.init());