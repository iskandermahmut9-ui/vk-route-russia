window.Game = {
    map: null, markers: {}, routeLines: [], carMarker: null,
    state: {
        coins: 1500, gas: 0, food: 100, wake: 100, hp: 100,
        car: null, diff: null, currentCity: null, history: [], collected: [], discovered: [],
        isMoving: false, hotelPaid: false, excPaid: false,
        driveMode: null, travelData: null, qteActive: false
    },

    init: async function() {
        try {
            if (window.vkBridge) {
                await vkBridge.send('VKWebAppInit'); 
                const user = await vkBridge.send('VKWebAppGetUserInfo');
                document.getElementById('player-name').innerText = user.first_name;
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
            div.innerHTML = `
                <img src="assets/cars/${car.img}" class="car-img" alt="${car.name}">
                <h3>${car.name}</h3>
                <p>Бак: ${car.tank}л | Расход: ${car.cons}л<br>Радар: ${car.radius} км</p>
            `;
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
            let tierClass = c.tier === 1 ? 'marker-tier-1' : (c.tier === 2 ? 'marker-tier-2' : 'marker-tier-3');
            if (isHidden) tierClass += ' hidden-tier';
            
            let icon = L.divIcon({ className: `map-pin ${tierClass}`, html: '<i class="fa-solid fa-location-dot"></i>', iconSize: [30, 30], iconAnchor: [15,30] });
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
        
        let carIcon = L.divIcon({className: 'marker-car', html: '<i class="fa-solid fa-car-side"></i>'});
        this.carMarker = L.marker(city.coords, {icon: carIcon}).addTo(this.map);

        document.getElementById('city-overlay').style.display = 'none';
        this.toast(`Старт задан. Выберите следующую цель на карте!`);
    },

    confirmTravel: async function(targetCity) {
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
                    <h3 style="color:#8BC34A;">Релакс (70 км/ч)</h3><p>Много интерактива, долгий путь.</p></div>
                <div class="diff-card" onclick="Game.startTravel(${JSON.stringify(targetCity).replace(/"/g, '&quot;')}, ${distKm}, ${JSON.stringify(routeCoords)}, 100, 1.0, 1.0)">
                    <h3 style="color:#2196F3;">Оптимальный (100 км/ч)</h3><p>Баланс времени и событий.</p></div>
                <div class="diff-card" onclick="Game.startTravel(${JSON.stringify(targetCity).replace(/"/g, '&quot;')}, ${distKm}, ${JSON.stringify(routeCoords)}, 140, 1.5, 0)">
                    <h3 style="color:#F44336;">Тапка в пол (140 км/ч)</h3><p>Расход х1.5, штрафы, без радара.</p></div>
            `;
            document.getElementById('drive-modes-container').innerHTML = modesHtml;
            document.getElementById('drive-mode-modal').style.display = 'flex';

        } catch(e) { this.toast("Ошибка сети. Попробуйте другой город."); }
    },

    startTravel: function(city, distKm, coords, speed, gasMult, radMult) {
        document.getElementById('drive-mode-modal').style.display = 'none';
        this.state.driveMode = { speed: speed, gasMult: gasMult, radMult: radMult };
        
        let plannedLine = L.polyline(coords, {color: '#FF5722', weight: 4, opacity: 0.5, dashArray: '5, 10'}).addTo(this.map);
        this.routeLines.push(plannedLine);

        let gameHours = distKm / speed;
        let realSeconds = (gameHours * 60) / 30; 
        let durationMs = realSeconds * 1000;
        
        let intervalMs = 40;
        let totalTicks = durationMs / intervalMs;

        this.state.travelData = {
            city: city, line: plannedLine, coords: coords,
            distKm: distKm,
            currentStep: 0, kmPassedTotal: 0,
            stepInc: coords.length / totalTicks
        };

        document.getElementById('travel-hud').style.display = 'block';
        document.getElementById('hud-target').innerText = city.name;
        document.getElementById('hud-time').innerText = Math.round(gameHours);
        
        this.resumeTravel();
    },

    resumeTravel: function() {
        let td = this.state.travelData;
        this.state.isMoving = true;
        document.getElementById('travel-hud').style.display = 'block';

        this.animationInterval = setInterval(() => {
            td.currentStep += td.stepInc;

            if (td.currentStep >= td.coords.length - 1) td.currentStep = td.coords.length - 1;

            let idx = Math.floor(td.currentStep);
            let nextIdx = Math.min(idx + 1, td.coords.length - 1);
            let frac = td.currentStep - idx;

            let p1 = td.coords[idx];
            let p2 = td.coords[nextIdx];

            let lat = p1[0] + (p2[0] - p1[0]) * frac;
            let lng = p1[1] + (p2[1] - p1[1]) * frac;
            let pos = [lat, lng];

            this.carMarker.setLatLng(pos);
            if(window.innerWidth > 768) this.map.panTo(pos, {animate: true, duration: 0.1});

            let tickKm = td.distKm * (td.stepInc / td.coords.length);
            td.kmPassedTotal += tickKm;
            document.getElementById('hud-dist').innerText = Math.round(td.kmPassedTotal);

            // Траты ресурсов
            let wakeDrain = (tickKm / 700) * 100;
            let foodDrain = (tickKm / 700) * 100 * (this.state.car.id !== "bike" ? 1 : 2);
            let gasDrain = this.state.car.id !== "bike" ? (this.state.car.cons / 100) * tickKm * this.state.driveMode.gasMult : 0;
            let hpDrain = (tickKm / 100) * this.state.car.hpLoss;

            this.state.wake -= wakeDrain;
            this.state.food -= foodDrain;
            this.state.gas -= gasDrain;
            this.state.hp -= hpDrain;

            this.updateTopUI();

            // ИНТЕРАКТИВ (QTE НА ТРАССЕ)
            if (Math.random() < 0.005 && !this.state.qteActive) {
                this.spawnQTE();
            }

            // ПРОВЕРКИ СЮЖЕТА (Примерно шанс на большое событие)
            if (Math.random() < 0.001 && !this.state.qteActive) {
                clearInterval(this.animationInterval);
                this.state.isMoving = false;
                this.triggerStoryEvent();
                return;
            }

            if (this.state.driveMode.radMult > 0) {
                for (let c of Data.cities) {
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
                this.state.gas = Math.max(0, this.state.gas);
                this.state.food = Math.max(0, this.state.food);
                this.state.wake = Math.max(0, this.state.wake);
                this.state.hp = Math.max(0, this.state.hp);
                this.finishTravel(td.city, td.line);
            }

        }, 40);
    },

    // МЕХАНИКА ВСПЛЫВАЮЩИХ ЗНАКОВ (QTE)
    spawnQTE: function() {
        this.state.qteActive = true;
        let types = [
            { id: 'camera', icon: 'fa-camera', color: '#F44336', text: 'КАМЕРА!', penalty: {coins: -250}, msgFail: "Вспышка! Штраф -250 ₽." },
            { id: 'hole', icon: 'fa-triangle-exclamation', color: '#212121', text: 'ЯМА!', penalty: {hp: -15}, msgFail: "Удар подвески! Прочность -15%." },
            { id: 'photo', icon: 'fa-image', color: '#4CAF50', text: 'ФОТО!', bonus: {coins: 300}, msgSuccess: "Отличный кадр! Донат +300 ₽." }
        ];
        
        let qte = types[Math.floor(Math.random() * types.length)];
        let layer = document.getElementById('qte-layer');
        let btn = document.getElementById('qte-btn');
        
        btn.innerHTML = `<i class="fa-solid ${qte.icon}"></i><br><span style="font-size:12px;">${qte.text}</span>`;
        btn.style.background = qte.color;
        layer.style.display = 'block';

        let clicked = false;
        
        btn.onclick = () => {
            clicked = true;
            layer.style.display = 'none';
            this.state.qteActive = false;
            
            if (qte.bonus) {
                // Если успели сфоткать - рандомная картинка природы
                let n = Math.floor(Math.random() * 4) + 1; 
                let imgName = n === 4 ? "natures4.png" : `nature${n}.png`;
                document.getElementById('event-img').src = `assets/events/${imgName}`;
                document.getElementById('event-title').innerText = "Красивый Пейзаж";
                document.getElementById('event-desc').innerText = qte.msgSuccess;
                
                let btnOk = document.createElement('button');
                btnOk.className = 'btn-action'; btnOk.innerText = "ОТЛИЧНО";
                btnOk.onclick = () => {
                    this.state.coins += qte.bonus.coins; this.updateTopUI();
                    document.getElementById('event-modal').style.display = 'none';
                };
                document.getElementById('event-actions').innerHTML = '';
                document.getElementById('event-actions').appendChild(btnOk);
                document.getElementById('event-modal').style.display = 'flex';
            } else {
                this.toast("Увернулись!");
            }
        };

        // Если не нажали за 2 секунды
        setTimeout(() => {
            if (!clicked) {
                layer.style.display = 'none';
                this.state.qteActive = false;
                if (qte.penalty) {
                    if(qte.penalty.coins) this.state.coins += qte.penalty.coins;
                    if(qte.penalty.hp) this.state.hp += qte.penalty.hp;
                    this.updateTopUI();
                    
                    // Показываем окно штрафа
                    document.getElementById('event-img').src = `assets/events/${qte.id}.png`;
                    document.getElementById('event-title').innerText = "НЕ УСПЕЛИ!";
                    document.getElementById('event-desc').innerText = qte.msgFail;
                    
                    let btnOk = document.createElement('button');
                    btnOk.className = 'btn-action'; btnOk.innerText = "ПОНЯТНО";
                    btnOk.onclick = () => { document.getElementById('event-modal').style.display = 'none'; };
                    document.getElementById('event-actions').innerHTML = '';
                    document.getElementById('event-actions').appendChild(btnOk);
                    document.getElementById('event-modal').style.display = 'flex';
                }
            }
        }, 2000);
    },

    triggerStoryEvent: function() {
        // Большие сюжетные события (Мошенники, Бабушки)
        let ev = Data.events[Math.floor(Math.random() * Data.events.length)];
        
        document.getElementById('event-img').src = `assets/events/${ev.img}`;
        document.getElementById('event-title').innerText = ev.title;
        document.getElementById('event-desc').innerText = ev.desc;
        document.getElementById('event-actions').innerHTML = '';
        
        ev.choices.forEach(choice => {
            let btn = document.createElement('button');
            btn.className = 'btn-action'; 
            if (choice.cost > 0) btn.style.background = "#444";
            btn.innerText = choice.text;
            
            btn.onclick = () => {
                if (this.state.coins < choice.cost) {
                    this.toast("У вас нет столько денег!"); return;
                }
                this.state.coins -= choice.cost;

                if (choice.action === "hp") this.state.hp = Math.max(0, Math.min(100, this.state.hp + choice.val));
                if (choice.action === "food") this.state.food = Math.max(0, Math.min(100, this.state.food + choice.val));
                if (choice.action === "coins") this.state.coins += choice.val;
                
                if (choice.action === "mixed_girl") { this.state.wake = Math.min(100, this.state.wake + 20); this.state.food -= 20; }
                if (choice.action === "mixed_road") { this.state.wake -= 20; this.state.food -= 20; }
                if (choice.action === "mixed_grandpa") { this.state.coins += 200; this.state.gas -= 5; }
                if (choice.action === "mixed_cake") { this.state.food = 100; if(Math.random() > 0.5) this.state.wake = 0; }
                if (choice.action === "secret") {
                    this.state.food -= 20;
                    let hiddenCity = Data.cities.find(c => c.tier === 3 && !this.state.discovered.includes(c.id));
                    if (hiddenCity) {
                        this.state.discovered.push(hiddenCity.id);
                        this.markers[hiddenCity.id].getElement().classList.remove('hidden-tier');
                        this.markers[hiddenCity.id].getElement().classList.add('marker-discovered');
                        this.toast(`Автостопщик показал на карте: ${hiddenCity.name}!`);
                    }
                }

                this.toast(choice.msg);
                this.updateTopUI();
                document.getElementById('event-modal').style.display = 'none';
                this.resumeTravel(); 
            };
            document.getElementById('event-actions').appendChild(btn);
        });

        document.getElementById('event-modal').style.display = 'flex';
    },

    triggerPassingCity: function(passingCity) {
        this.state.history.push(passingCity.id);
        document.getElementById('passing-city-name').innerText = passingCity.name;
        
        if (passingCity.tier === 3) {
            this.markers[passingCity.id].getElement().classList.remove('hidden-tier');
            this.markers[passingCity.id].getElement().classList.add('marker-discovered');
            this.state.discovered.push(passingCity.id);
        }

        document.getElementById('passing-modal').style.display = 'flex';
        
        document.getElementById('btn-passing-yes').onclick = () => {
            document.getElementById('passing-modal').style.display = 'none';
            this.detourToCity(passingCity);
        };
        document.getElementById('btn-passing-no').onclick = () => {
            document.getElementById('passing-modal').style.display = 'none';
            this.resumeTravel();
        };
    },

    detourToCity: async function(passingCity) {
        let td = this.state.travelData;
        let currentPos = this.carMarker.getLatLng();

        this.map.removeLayer(td.line);
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
            td.line.addTo(this.map);
            this.resumeTravel();
        }
    },

    finishTravel: function(city, line) {
        this.state.isMoving = false;
        this.state.currentCity = city;
        this.state.history.push(city.id);
        document.getElementById('travel-hud').style.display = 'none';
        
        line.setStyle({color: '#555', weight: 3, dashArray: '5, 10', opacity: 1});
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
            if (this.state.collected.includes(id)) {
                el.className = 'map-pin marker-collected leaflet-marker-icon leaflet-zoom-animated leaflet-interactive';
            }
        });
    },

    openCityUI: function(city) {
        this.state.hotelPaid = false;
        this.state.excPaid = false;

        let cityImgSrc = city.id === "moscow" ? "assets/cities/moscow.png" : `assets/cities/tier${city.tier}.png`;
        document.getElementById('city-header-img').src = cityImgSrc;

        document.getElementById('city-overlay').style.display = 'flex';
        document.getElementById('city-name').innerText = city.name;
        document.getElementById('city-tier').innerText = `Уровень ${city.tier}`;
        document.getElementById('city-fact').innerText = city.fact;
        
        if (this.state.car.id === "camper" || this.state.car.id === "lada_camper") {
            document.getElementById('hotel-hint').innerText = `В этой машине можно спать (+${this.state.car.sleepBonus}% бодрости).`;
        } else {
            document.getElementById('hotel-hint').innerText = "Сон в этой машине не восстанавливает бодрость.";
        }

        document.getElementById('btn-leave-city').style.display = 'block';
        this.renderCityShop(city);
    },

    renderCityShop: function(city) {
        const p = Data.prices[city.tier];
        let html = "";

        html += `<div class="shop-category"><h4>🛏️ Ночлег</h4><div class="btn-group">`;
        if (p.hotel > 0) {
            let isFull = this.state.wake >= 100 || this.state.hotelPaid;
            html += `<button class="btn-shop ${this.state.hotelPaid ? 'purchased' : ''}" ${isFull ? 'disabled' : ''} onclick="Game.buyItem('hotel', ${p.hotel}, 100)">
                <img src="assets/ui/hotel.png" class="btn-shop-img">
                <div class="btn-shop-content"><b>Гостиница</b><small>+100% бодрости</small><span class="price">${p.hotel} ₽</span></div></button>`;
        }
        if (p.hostel > 0) {
            let isFull = this.state.wake >= 100 || this.state.hotelPaid;
            html += `<button class="btn-shop ${this.state.hotelPaid ? 'purchased' : ''}" ${isFull ? 'disabled' : ''} onclick="Game.buyItem('hotel', ${p.hostel}, 80)">
                <img src="assets/ui/hostel.png" class="btn-shop-img">
                <div class="btn-shop-content"><b>Мотель</b><small>+80% бодрости</small><span class="price">${p.hostel} ₽</span></div></button>`;
        }
        html += `</div></div>`;

        html += `<div class="shop-category"><h4>🍔 Питание</h4><div class="btn-group">`;
        if (p.rest > 0) {
            let isFull = this.state.food >= 100;
            html += `<button class="btn-shop" ${isFull ? 'disabled' : ''} onclick="Game.buyItem('food', ${p.rest}, 100)">
                <img src="assets/ui/rest.png" class="btn-shop-img">
                <div class="btn-shop-content"><b>Ресторан</b><small>+100% сытости</small><span class="price">${p.rest} ₽</span></div></button>`;
        }
        if (p.fastfood > 0) {
            let isFull = this.state.food >= 100;
            html += `<button class="btn-shop" ${isFull ? 'disabled' : ''} onclick="Game.buyItem('food', ${p.fastfood}, 80)">
                <img src="assets/ui/fastfood.png" class="btn-shop-img">
                <div class="btn-shop-content"><b>Столовая</b><small>+80% сытости</small><span class="price">${p.fastfood} ₽</span></div></button>`;
        }
        html += `</div></div>`;

        if (this.state.car.id !== "bike" && p.gas > 0) {
            let missingGas = Math.floor(this.state.car.tank - this.state.gas);
            let fullPrice = missingGas * p.gas;
            let tenPrice = 10 * p.gas;
            html += `<div class="shop-category"><h4>⛽ АЗС (${p.gas} ₽/л)</h4><div class="btn-group">`;
            html += `<button class="btn-shop" style="padding:10px !important" ${missingGas < 10 ? 'disabled' : ''} onclick="Game.buyItem('gas', ${tenPrice}, 10)">
                <b>+10 Литров</b><span class="price">${tenPrice} ₽</span></button>`;
            html += `<button class="btn-shop" style="padding:10px !important" ${missingGas <= 0 ? 'disabled' : ''} onclick="Game.buyItem('gas', ${fullPrice}, ${missingGas})">
                <b>Полный бак</b><span class="price">${fullPrice} ₽</span></button>`;
            html += `</div></div>`;
        }

        if (this.state.car.id !== "bike" && p.repair > 0) {
            let missingHp = Math.floor(100 - this.state.hp);
            let fullPrice = missingHp * p.repair;
            let tenPrice = 10 * p.repair;
            html += `<div class="shop-category"><h4>🔧 Автосервис</h4><div class="btn-group">`;
            html += `<button class="btn-shop" style="padding:10px !important" ${missingHp < 10 ? 'disabled' : ''} onclick="Game.buyItem('hp', ${tenPrice}, 10)">
                <b>+10% Ремонт</b><span class="price">${tenPrice} ₽</span></button>`;
            html += `<button class="btn-shop" style="padding:10px !important" ${missingHp <= 0 ? 'disabled' : ''} onclick="Game.buyItem('hp', ${fullPrice}, ${missingHp})">
                <b>Починить всё</b><span class="price">${fullPrice} ₽</span></button>`;
            html += `</div></div>`;
        }

        if (p.exc > 0) {
            html += `<div class="shop-category" style="border:none;"><h4>🎫 Культура</h4><div class="btn-group">`;
            html += `<button class="btn-shop ${this.state.excPaid ? 'purchased' : ''}" style="padding:10px !important" ${this.state.excPaid ? 'disabled' : ''} onclick="Game.buyItem('exc', ${p.exc}, 0)">
                <b>Взять Экскурсию</b><small>Для Альбома</small><span class="price">${p.exc} ₽</span></button>`;
            html += `</div></div>`;
        }

        document.getElementById('city-shop').innerHTML = html;
    },

    buyItem: function(type, price, amount) {
        if (this.state.coins < price) { this.toast("Не хватает монет!"); return; }
        this.state.coins -= price;

        if (type === 'hotel') { this.state.wake = Math.min(100, this.state.wake + amount); this.state.hotelPaid = true; } 
        else if (type === 'food') { this.state.food = Math.min(100, this.state.food + amount); } 
        else if (type === 'gas') { this.state.gas += amount; } 
        else if (type === 'hp') { this.state.hp += amount; } 
        else if (type === 'exc') { this.state.excPaid = true; }

        this.updateTopUI();
        
        if (this.state.hotelPaid && this.state.excPaid && !this.state.collected.includes(this.state.currentCity.id)) {
            this.state.collected.push(this.state.currentCity.id);
            this.toast("Условия выполнены! Карточка добавлена в Альбом!");
            this.updateMarkers();
        }

        this.renderCityShop(this.state.currentCity);
    },

    leaveCity: function() {
        if (!this.state.hotelPaid) {
            if(this.state.car.sleepBonus > 0) {
                this.state.wake = Math.min(100, this.state.wake + this.state.car.sleepBonus);
                this.toast(`Ночевка в машине (+${this.state.car.sleepBonus}% бодрости).`);
            } else {
                this.toast("Сон в этой машине не восстанавливает силы. Едем дальше.");
            }
        }
        this.updateTopUI();
        document.getElementById('city-overlay').style.display = 'none';
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
        document.getElementById('btn-modal-cancel').style.display = 'block';
        document.getElementById('custom-modal').style.display = 'flex';
        document.getElementById('btn-modal-ok').onclick = () => { document.getElementById('custom-modal').style.display='none'; onYes(); };
        document.getElementById('btn-modal-cancel').onclick = () => { document.getElementById('custom-modal').style.display='none'; };
    },

    showQuest: function(city) {
        let guideImg = Math.random() > 0.5 ? "guide_m.png" : "guide_f.png";
        document.getElementById('quest-guide-img').src = `assets/quests/${guideImg}`;

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
        let collectedCities = Data.cities.filter(c => this.state.collected.includes(c.id));
        
        if (collectedCities.length === 0) {
            grid.innerHTML = "<p style='color:#aaa;'>Альбом пока пуст. Оплачивайте отель и экскурсии в городах.</p>";
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