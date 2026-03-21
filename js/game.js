const MAX_ADS_PER_DAY = 5;

window.Game = {
    map: null, markers: {}, routeLines: [], carMarker: null,
    state: {
        coins: 1500, gas: 0, food: 100, wake: 100, hp: 100, rating: 0, adsWatched: 0,
        car: null, diff: null, currentCity: null, history: [], collected: [], discovered: [],
        isMoving: false, hotelPaid: false, excPaid: false,
        driveMode: null, travelData: null, qteActive: false,
        newMedalCity: null,
        // Счетчики для 100% появления событий
        kmSinceEvent: 0, kmSinceQTE: 0
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

        this.checkDailyLimits();
        this.renderMap();
        this.bindEvents();
        document.getElementById('difficulty-modal').style.display = 'flex';
    },

    checkDailyLimits: function() {
        let last = localStorage.getItem('rr_daily');
        let today = new Date().toDateString();
        if (last !== today) {
            this.state.coins += 1200;
            this.state.adsWatched = 0; 
            localStorage.setItem('rr_daily', today);
            localStorage.setItem('rr_ads', 0);
            this.toast("Ежедневный бонус: +1200 монет!");
        } else {
            this.state.adsWatched = parseInt(localStorage.getItem('rr_ads') || 0);
        }
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

    goBackToDiff: function() {
        document.getElementById('garage-modal').style.display = 'none';
        document.getElementById('difficulty-modal').style.display = 'flex';
    },

    renderMap: function() {
        Data.cities.forEach(c => {
            let isHidden = c.tier === 3;
            let tierClass = c.tier === 1 ? 'marker-tier-1' : (c.tier === 2 ? 'marker-tier-2' : 'marker-tier-3');
            if (isHidden) tierClass += ' hidden-tier';
            
            // ВЕРНУЛИ АККУРАТНЫЕ ПИНЫ НА КАРТУ
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
        
        let carIcon = L.divIcon({className: 'marker-car', html: `<img src="assets/cars/${this.state.car.img}" class="driving-car-icon">`});
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
                    <h3 style="color:#8BC34A;">Релакс (70 км/ч)</h3><p>Больше интерактива на дороге.</p></div>
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
            this.state.kmSinceEvent += tickKm;
            this.state.kmSinceQTE += tickKm;
            document.getElementById('hud-dist').innerText = Math.round(td.kmPassedTotal);

            // Траты ресурсов
            let wakeDrain = (tickKm / 700) * 100;
            let foodDrain = (tickKm / 700) * 100 * (this.state.car.id !== "bike" ? 1 : 2);
            let gasDrain = this.state.car.id !== "bike" ? (this.state.car.cons / 100) * tickKm * this.state.driveMode.gasMult : 0;
            let hpDrain = (tickKm / 100) * this.state.car.hpLoss;

            // Жестко блокируем минусы
            this.state.wake = Math.max(0, this.state.wake - wakeDrain);
            this.state.food = Math.max(0, this.state.food - foodDrain);
            this.state.gas = Math.max(0, this.state.gas - gasDrain);
            this.state.hp = Math.max(0, this.state.hp - hpDrain);

            this.updateTopUI();

            // === ИДЕАЛЬНАЯ ЛОГИКА ОКОНЧАНИЯ БЕНЗИНА ===
            if (this.state.gas <= 0 && this.state.car.id !== "bike") {
                clearInterval(this.animationInterval);
                this.state.isMoving = false;
                
                document.getElementById('event-img').src = `assets/events/moshen.png`;
                document.getElementById('event-title').innerText = "БАК ПУСТ!";
                document.getElementById('event-desc').innerText = "Машина заглохла. На обочине останавливается мутный тип: 'Слыш, брат, обсох? Дам 10 литров, но цена двойная.' Либо вызывайте эвакуатор.";
                
                let actionsDiv = document.getElementById('event-actions');
                actionsDiv.innerHTML = '';
                
                // Вариант 1: Барыга (140 монет)
                let btnBuy = document.createElement('button');
                btnBuy.className = 'btn-action';
                btnBuy.innerText = "Купить 10л (140 🪙)";
                btnBuy.onclick = () => {
                    if (this.state.coins >= 140) {
                        this.state.coins -= 140;
                        this.state.gas = 10;
                        this.playFloatingText("-140 🪙", false);
                        this.updateTopUI();
                        document.getElementById('event-modal').style.display='none';
                        this.resumeTravel();
                    } else {
                        this.toast("У вас нет 140 монет! Ищите другой выход.");
                    }
                };
                actionsDiv.appendChild(btnBuy);

                // Вариант 2: Эвакуатор
                let adLimitStr = `[Осталось ${MAX_ADS_PER_DAY - this.state.adsWatched}]`;
                let btnTow = document.createElement('button');
                btnTow.className = 'btn-action';
                btnTow.style.background = "#2196F3";
                btnTow.innerText = `Эвакуатор за Рекламу ${adLimitStr}`;
                btnTow.onclick = () => {
                    if (this.state.adsWatched < MAX_ADS_PER_DAY) {
                        document.getElementById('event-modal').style.display='none';
                        this.watchAd(() => {
                            this.teleportToNearestCity(pos, td.line);
                        });
                    } else {
                        this.toast("Лимит рекламы исчерпан!");
                    }
                };
                actionsDiv.appendChild(btnTow);

                // Вариант 3: Конец игры
                let btnDie = document.createElement('button');
                btnDie.className = 'btn-action btn-leave';
                btnDie.innerText = "Сдаться (Начать заново)";
                btnDie.onclick = () => { window.location.reload(); };
                actionsDiv.appendChild(btnDie);

                document.getElementById('event-modal').style.display = 'flex';
                return;
            }

            // Штраф за сон
            if (this.state.wake <= 0) td.stepInc = (td.coords.length / totalTicks) * 0.2; 

            // === ГАРАНТИРОВАННЫЙ ИНТЕРАКТИВ (ПО КИЛОМЕТРАЖУ) ===
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
                this.finishTravel(td.city, td.line);
            }
        }, 40);
    },

    watchAd: function(onSuccess) {
        this.state.adsWatched++;
        localStorage.setItem('rr_ads', this.state.adsWatched);
        this.toast("Смотрим рекламу...");
        setTimeout(() => onSuccess(), 2000);
    },

    teleportToNearestCity: function(currentPos, currentLine) {
        let minDist = Infinity;
        let closestCity = null;
        Data.cities.forEach(c => {
            let dist = this.map.distance(currentPos, c.coords);
            if (dist < minDist) { minDist = dist; closestCity = c; }
        });

        this.toast(`Вас отбуксировали в: ${closestCity.name}`);
        this.map.removeLayer(currentLine); 
        this.carMarker.setLatLng(closestCity.coords);
        this.map.panTo(closestCity.coords);
        
        this.state.gas = 2; // Чуть бензина для выживания
        this.finishTravel(closestCity, currentLine); 
    },

    spawnQTE: function() {
        this.state.qteActive = true;
        let types = [
            { id: 'camera', icon: 'fa-camera', color: '#F44336', text: 'КАМЕРА! ЖМИ!', penalty: {coins: 250}, msgFail: "Вспышка! Штраф -250 монет." },
            { id: 'hole', icon: 'fa-triangle-exclamation', color: '#F44336', text: 'ЯМА! ЖМИ ЧТОБЫ ОБЪЕХАТЬ!', penalty: {hp: 15}, msgFail: "Удар подвески! Прочность -15%." },
            { id: 'photo', icon: 'fa-image', color: '#4CAF50', text: 'КРАСИВЫЙ ВИД! ЖМИ!', bonus: {coins: 100, rating: 5}, msgSuccess: "Отличный кадр! +5 Очков Блогера и донат." }
        ];
        
        let qte = types[Math.floor(Math.random() * types.length)];
        let layer = document.getElementById('qte-layer');
        
        layer.innerHTML = `
            <div class="qte-container">
                <button id="qte-btn" style="font-size: 50px; padding: 20px; border-radius: 50%; width: 120px; height: 120px; border: 5px solid #fff; cursor: pointer; box-shadow: 0 0 30px rgba(0,0,0,0.9); animation: pulse 0.5s infinite alternate; background: ${qte.color}; color: #fff;">
                    <i class="fa-solid ${qte.icon}"></i>
                </button>
                <div class="qte-warning">${qte.text}</div>
            </div>`;
        layer.style.display = 'block';

        let clicked = false;
        document.getElementById('qte-btn').onclick = () => {
            clicked = true;
            layer.style.display = 'none';
            this.state.qteActive = false;
            
            if (qte.bonus) {
                let n = Math.floor(Math.random() * 4) + 1; 
                let imgName = n === 4 ? "natures4.png" : `nature${n}.png`;
                document.getElementById('event-img').src = `assets/events/${imgName}`;
                document.getElementById('event-title').innerText = "Красивый Пейзаж";
                document.getElementById('event-desc').innerText = qte.msgSuccess;
                
                let btnOk = document.createElement('button');
                btnOk.className = 'btn-action'; btnOk.innerText = "ОТЛИЧНО";
                btnOk.onclick = () => {
                    this.state.coins += qte.bonus.coins; 
                    this.state.rating += qte.bonus.rating; // +5 Очков Блогера
                    this.playFloatingText(`+${qte.bonus.coins} 🪙`, true);
                    this.playFloatingText(`+${qte.bonus.rating} 📸`, true);
                    this.updateTopUI();
                    document.getElementById('event-modal').style.display = 'none';
                };
                document.getElementById('event-actions').innerHTML = '';
                document.getElementById('event-actions').appendChild(btnOk);
                document.getElementById('event-modal').style.display = 'flex';
            } else {
                this.toast("Увернулись!");
            }
        };

        setTimeout(() => {
            if (!clicked) {
                layer.style.display = 'none';
                this.state.qteActive = false;
                if (qte.penalty) {
                    if(qte.penalty.coins) this.state.coins = Math.max(0, this.state.coins - qte.penalty.coins);
                    if(qte.penalty.hp) this.state.hp = Math.max(0, this.state.hp - qte.penalty.hp);
                    this.updateTopUI();
                    
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
        let ev = Data.events[Math.floor(Math.random() * Data.events.length)];
        if (ev.id === "police") {
            if (this.state.driveMode.speed === 140) ev.choices[0].msg = "Штраф за превышение: -500 монет!";
            else ev.choices[0].msg = "Счастливого пути. Вы потеряли немного времени.";
        }

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
                if (choice.cost > 0 && this.state.coins < choice.cost) {
                    this.toast("Не хватает монет!"); return;
                }
                if (choice.cost > 0) {
                    this.state.coins -= choice.cost;
                    this.playFloatingText(`-${choice.cost} 🪙`, false);
                }

                if (choice.action === "hp") this.state.hp = Math.max(0, Math.min(100, this.state.hp + choice.val));
                if (choice.action === "food") this.state.food = Math.max(0, Math.min(100, this.state.food + choice.val));
                if (choice.action === "coins") { 
                    this.state.coins += choice.val; 
                    if(choice.val > 0) this.playFloatingText(`+${choice.val} 🪙`, true);
                }
                
                if (choice.action === "mixed_girl") { this.state.wake = Math.min(100, this.state.wake + 20); this.state.food = Math.max(0, this.state.food - 20); }
                if (choice.action === "mixed_road") { this.state.wake = Math.max(0, this.state.wake - 20); this.state.food = Math.max(0, this.state.food - 20); }
                if (choice.action === "mixed_grandpa") { this.state.coins += 200; this.state.gas = Math.max(0, this.state.gas - 5); this.playFloatingText(`+200 🪙`, true); }
                if (choice.action === "mixed_cake") { this.state.food = 100; if(Math.random() > 0.5) this.state.wake = 0; }
                if (choice.action === "police" && this.state.driveMode.speed === 140) { this.state.coins = Math.max(0, this.state.coins - 500); this.playFloatingText(`-500 🪙`, false); }
                
                if (choice.action === "secret") {
                    this.state.food = Math.max(0, this.state.food - 20);
                    let hiddenCity = Data.cities.find(c => c.tier === 3 && !this.state.discovered.includes(c.id));
                    if (hiddenCity) {
                        this.state.discovered.push(hiddenCity.id);
                        this.markers[hiddenCity.id].getElement().classList.remove('hidden-tier');
                        this.markers[hiddenCity.id].getElement().classList.add('marker-discovered');
                        this.toast(`Автостопщик показал: ${hiddenCity.name}!`);
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

        this.toast(`Едем в ${passingCity.name}...`);
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
        
        if(line) line.setStyle({color: '#555', weight: 3, dashArray: '5, 10', opacity: 1});
        this.updateMarkers();
        this.updateTopUI();
        
        this.openCityUI(city);
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
        
        if (this.state.car.sleepBonus > 0) {
            document.getElementById('hotel-hint').innerText = `В этой машине можно спать (+${this.state.car.sleepBonus}% бодрости).`;
        } else {
            document.getElementById('hotel-hint').innerText = "Сон в этой машине не восстанавливает бодрость.";
        }

        let btnAd = document.getElementById('btn-city-ad');
        btnAd.innerText = `РЕКЛАМА (+500 🪙) [${MAX_ADS_PER_DAY - this.state.adsWatched}]`;
        btnAd.onclick = () => {
            if (this.state.adsWatched < MAX_ADS_PER_DAY) {
                this.watchAd(() => {
                    this.state.coins += 500;
                    this.playFloatingText("+500 🪙", true);
                    this.updateTopUI();
                    btnAd.innerText = `РЕКЛАМА (+500 🪙) [${MAX_ADS_PER_DAY - this.state.adsWatched}]`;
                });
            } else {
                this.toast("Лимит рекламы на сегодня исчерпан!");
            }
        };

        document.getElementById('btn-leave-city').style.display = 'block';
        this.renderCityShop(city);
    },

    renderCityShop: function(city) {
        const p = Data.prices[city.tier];
        let html = "";

        // МАГАЗИН БЕЗ РАМОК, ТЕКСТ НАД КАРТИНКАМИ
        html += `<div class="shop-category"><h4>🛏️ Ночлег</h4><div class="btn-group">`;
        if (p.hotel > 0) {
            let isFull = this.state.wake >= 100 || this.state.hotelPaid;
            html += `<button class="btn-shop ${this.state.hotelPaid ? 'purchased' : ''}" ${isFull ? 'disabled' : ''} onclick="Game.buyItem('hotel', ${p.hotel}, 100, 'assets/ui/hotel.png')">
                <img src="assets/ui/hotel.png" class="btn-shop-img">
                <div class="btn-shop-title">Гостиница</div><div class="btn-shop-desc">+100% бодрости</div><div class="btn-shop-price">${p.hotel} 🪙</div></button>`;
        }
        if (p.hostel > 0) {
            let isFull = this.state.wake >= 100 || this.state.hotelPaid;
            html += `<button class="btn-shop ${this.state.hotelPaid ? 'purchased' : ''}" ${isFull ? 'disabled' : ''} onclick="Game.buyItem('hotel', ${p.hostel}, 80, 'assets/ui/hostel.png')">
                <img src="assets/ui/hostel.png" class="btn-shop-img">
                <div class="btn-shop-title">Мотель</div><div class="btn-shop-desc">+80% бодрости</div><div class="btn-shop-price">${p.hostel} 🪙</div></button>`;
        }
        html += `</div></div>`;

        html += `<div class="shop-category"><h4>🍔 Питание</h4><div class="btn-group">`;
        if (p.rest > 0) {
            let isFull = this.state.food >= 100;
            html += `<button class="btn-shop" ${isFull ? 'disabled' : ''} onclick="Game.buyItem('food', ${p.rest}, 100, 'assets/ui/rest.png')">
                <img src="assets/ui/rest.png" class="btn-shop-img">
                <div class="btn-shop-title">Ресторан</div><div class="btn-shop-desc">+100% сытости</div><div class="btn-shop-price">${p.rest} 🪙</div></button>`;
        }
        if (p.fastfood > 0) {
            let isFull = this.state.food >= 100;
            html += `<button class="btn-shop" ${isFull ? 'disabled' : ''} onclick="Game.buyItem('food', ${p.fastfood}, 80, 'assets/ui/fastfood.png')">
                <img src="assets/ui/fastfood.png" class="btn-shop-img">
                <div class="btn-shop-title">Столовая</div><div class="btn-shop-desc">+80% сытости</div><div class="btn-shop-price">${p.fastfood} 🪙</div></button>`;
        }
        html += `</div></div>`;

        if (this.state.car.id !== "bike" && p.gas > 0) {
            let missingGas = Math.floor(this.state.car.tank - this.state.gas);
            let fullPrice = missingGas * p.gas;
            let tenPrice = 10 * p.gas;
            html += `<div class="shop-category"><h4>⛽ АЗС (${p.gas} 🪙/л)</h4><div class="btn-group">`;
            html += `<button class="btn-shop" style="border:1px solid #444 !important; background:#2a2a2a !important; padding:10px !important; border-radius:8px !important;" ${missingGas < 10 ? 'disabled' : ''} onclick="Game.buyItem('gas', ${tenPrice}, 10, null)">
                <div class="btn-shop-title">+10 Литров</div><div class="btn-shop-price">${tenPrice} 🪙</div></button>`;
            html += `<button class="btn-shop" style="border:1px solid #444 !important; background:#2a2a2a !important; padding:10px !important; border-radius:8px !important;" ${missingGas <= 0 ? 'disabled' : ''} onclick="Game.buyItem('gas', ${fullPrice}, ${missingGas}, null)">
                <div class="btn-shop-title">Полный бак</div><div class="btn-shop-price">${fullPrice} 🪙</div></button>`;
            html += `</div></div>`;
        }

        if (this.state.car.id !== "bike" && p.repair > 0) {
            let missingHp = Math.floor(100 - this.state.hp);
            let fullPrice = missingHp * p.repair;
            let tenPrice = 10 * p.repair;
            html += `<div class="shop-category"><h4>🔧 Автосервис</h4><div class="btn-group">`;
            html += `<button class="btn-shop" style="border:1px solid #444 !important; background:#2a2a2a !important; padding:10px !important; border-radius:8px !important;" ${missingHp < 10 ? 'disabled' : ''} onclick="Game.buyItem('hp', ${tenPrice}, 10, null)">
                <div class="btn-shop-title">+10% Ремонт</div><div class="btn-shop-price">${tenPrice} 🪙</div></button>`;
            html += `<button class="btn-shop" style="border:1px solid #444 !important; background:#2a2a2a !important; padding:10px !important; border-radius:8px !important;" ${missingHp <= 0 ? 'disabled' : ''} onclick="Game.buyItem('hp', ${fullPrice}, ${missingHp}, null)">
                <div class="btn-shop-title">Починить всё</div><div class="btn-shop-price">${fullPrice} 🪙</div></button>`;
            html += `</div></div>`;
        }

        if (p.exc > 0) {
            html += `<div class="shop-category" style="border:none;"><h4>🎫 Культура</h4><div class="btn-group">`;
            html += `<button class="btn-shop ${this.state.excPaid ? 'purchased' : ''}" style="border:1px solid #444 !important; background:#2a2a2a !important; padding:10px !important; border-radius:8px !important;" ${this.state.excPaid ? 'disabled' : ''} onclick="Game.startExcursion(${p.exc})">
                <div class="btn-shop-title">Взять Экскурсию</div><div class="btn-shop-desc">Для Альбома</div><div class="btn-shop-price">${p.exc} 🪙</div></button>`;
            html += `</div></div>`;
        }

        document.getElementById('city-shop').innerHTML = html;
    },

    buyItem: function(type, price, amount, imgSrc) {
        if (this.state.coins < price) { this.toast("Не хватает монет!"); return; }
        this.state.coins -= price;

        if (imgSrc) {
            let animImg = document.createElement('img');
            animImg.src = imgSrc;
            animImg.className = 'zoom-purchase-img';
            document.body.appendChild(animImg);
            setTimeout(() => animImg.remove(), 1500);
        }

        this.playFloatingText(`-${price} 🪙`, false);

        if (type === 'hotel') { this.state.wake = Math.min(100, this.state.wake + amount); this.state.hotelPaid = true; } 
        else if (type === 'food') { this.state.food = Math.min(100, this.state.food + amount); } 
        else if (type === 'gas') { this.state.gas += amount; } 
        else if (type === 'hp') { this.state.hp = Math.min(100, this.state.hp + amount); } 

        this.updateTopUI();
        this.checkCityCompletion();
        this.renderCityShop(this.state.currentCity);
    },

    playFloatingText: function(text, isPositive) {
        let el = document.createElement('div');
        el.className = `floating-text ${isPositive ? 'positive' : ''}`;
        el.innerText = text;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1500);
    },

    // НАСТОЯЩИЙ ФЕЙЕРВЕРК ЧАСТИЦАМИ ИЗ ЦЕНТРА
    playFireworks: function() {
        for (let i = 0; i < 40; i++) {
            let p = document.createElement('div');
            p.className = 'firework-particle';
            p.style.left = '50%';
            p.style.top = '50%';
            let angle = Math.random() * Math.PI * 2;
            let velocity = 50 + Math.random() * 150;
            p.style.setProperty('--dx', Math.cos(angle) * velocity + 'px');
            p.style.setProperty('--dy', Math.sin(angle) * velocity + 'px');
            p.style.color = ['#FFD700', '#FF5722', '#4CAF50', '#2196F3'][Math.floor(Math.random()*4)];
            document.body.appendChild(p);
            setTimeout(() => p.remove(), 1200);
        }
    },

    startExcursion: function(price) {
        if (this.state.coins < price) { this.toast("Не хватает монет!"); return; }
        
        this.state.coins -= price;
        this.playFloatingText(`-${price} 🪙`, false);
        this.updateTopUI();
        
        let guideImg = Math.random() > 0.5 ? "guide_m.png" : "guide_f.png";
        document.getElementById('quest-guide-img').src = `assets/quests/${guideImg}`;
        document.getElementById('quest-city-name').innerText = this.state.currentCity.name;

        let q = this.state.currentCity.quests[0];
        document.getElementById('quest-text').innerText = q.q;
        let ansDiv = document.getElementById('quest-answers'); ansDiv.innerHTML = '';
        
        q.a.forEach((ans, i) => {
            let b = document.createElement('button'); b.className = 'btn-action'; b.innerText = ans;
            b.onclick = () => {
                document.getElementById('quest-modal').style.display = 'none';
                if(i === q.right) { 
                    // +1 ОЧКО БЛОГЕРА ЗА ОТВЕТ НА ЭКСКУРСИИ
                    this.state.rating += 1; 
                    this.playFloatingText(`+1 📸`, true);
                    this.playFireworks();
                    this.toast("Верный ответ!");
                } else { 
                    this.toast("Неверный ответ!"); 
                }
                
                this.state.excPaid = true;
                this.updateTopUI();
                this.checkCityCompletion();
                this.renderCityShop(this.state.currentCity);
            };
            ansDiv.appendChild(b);
        });
        document.getElementById('quest-modal').style.display = 'flex';
    },

    checkCityCompletion: function() {
        if (this.state.hotelPaid && this.state.excPaid && !this.state.collected.includes(this.state.currentCity.id)) {
            this.state.collected.push(this.state.currentCity.id);
            this.state.newMedalCity = this.state.currentCity.id; 
            
            this.toast("Отлично! Город добавлен в Альбом!");
            document.getElementById('btn-album').classList.add('btn-glow'); 
            
            this.updateMarkers();
        }
    },

    leaveCity: function() {
        if (!this.state.hotelPaid) {
            if(this.state.car.sleepBonus > 0) {
                this.state.wake = Math.min(100, this.state.wake + this.state.car.sleepBonus);
                this.toast(`Ночевка в машине (+${this.state.car.sleepBonus}% бодрости).`);
            } else {
                this.toast("Вы не отдохнули. Будьте осторожны на трассе!");
            }
        }
        this.updateTopUI();
        document.getElementById('city-overlay').style.display = 'none';
    },

    updateTopUI: function() {
        document.getElementById('val-coins').innerText = Math.round(this.state.coins);
        document.getElementById('val-rating').innerText = Math.round(this.state.rating);
        
        let els = {
            gas: { val: this.state.gas, max: this.state.car ? this.state.car.tank : 100, node: document.getElementById('val-gas').parentNode },
            food: { val: this.state.food, max: 100, node: document.getElementById('val-food').parentNode },
            wake: { val: this.state.wake, max: 100, node: document.getElementById('val-wake').parentNode },
            hp: { val: this.state.hp, max: 100, node: document.getElementById('val-hp').parentNode }
        };

        for (let key in els) {
            let el = els[key];
            let displayNode = el.node.querySelector('span');
            displayNode.innerText = Math.round(el.val);
            
            if ((el.val / el.max) < 0.3) {
                el.node.classList.add('danger-pulse');
            } else {
                el.node.classList.remove('danger-pulse');
            }
        }
    },

    showConfirm: function(title, text, onYes) {
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-text').innerText = text;
        document.getElementById('btn-modal-cancel').style.display = 'block';
        document.getElementById('custom-modal').style.display = 'flex';
        document.getElementById('btn-modal-ok').onclick = () => { document.getElementById('custom-modal').style.display='none'; onYes(); };
        document.getElementById('btn-modal-cancel').onclick = () => { document.getElementById('custom-modal').style.display='none'; };
    },

    openAlbum: function() {
        document.getElementById('btn-album').classList.remove('btn-glow');

        let grid = document.getElementById('album-grid'); grid.innerHTML = '';
        let collectedCities = Data.cities.filter(c => this.state.collected.includes(c.id));
        
        if (collectedCities.length === 0) {
            grid.innerHTML = "<p style='color:#aaa;'>Альбом пока пуст. Оплачивайте отель и экскурсии в городах.</p>";
        } else {
            collectedCities.forEach(c => {
                let isNew = (c.id === this.state.newMedalCity);
                grid.innerHTML += `
                    <div class="album-card collected ${isNew ? 'new-medal' : ''}">
                        <i class="fa-solid fa-medal"></i>
                        <div style="font-weight:bold; font-size:13px;">${c.name}</div>
                    </div>`;
            });
            this.state.newMedalCity = null; 
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