import { garages } from '../data/cars.js';
import { cfoCities } from '../data/regions/cfo.js';

export const UIModule = {
    selectDifficulty: function(diff) {
        this.state.diff = diff;
        document.getElementById('difficulty-modal').style.display = 'none';
        
        const list = document.getElementById('garage-list'); list.innerHTML = '';
        garages[diff].forEach(car => {
            let div = document.createElement('div'); div.className = 'car-card';
            div.innerHTML = `
                <img src="assets/cars/${car.img}" class="car-img" alt="${car.name}">
                <h3>${car.name}</h3>
                <p>Бак: ${car.tank}л | Расход: ${car.cons}л<br>Радар: ${car.radius} км<br>Багажник: ${car.capacity} слотов</p>
            `;
            div.onclick = () => {
                this.state.car = car;
                this.state.gas = car.tank;
                this.state.inventory = []; // Инициализируем пустой багажник
                document.getElementById('garage-modal').style.display = 'none';
                document.getElementById('resource-panel').style.display = 'flex';
                this.updateTopUI();
                this.toast("Кликните на столицу на карте для старта!");
                this.saveGame();
            };
            list.appendChild(div);
        });
        document.getElementById('garage-modal').style.display = 'flex';
    },

    goBackToDiff: function() {
        document.getElementById('garage-modal').style.display = 'none';
        document.getElementById('difficulty-modal').style.display = 'flex';
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
        
        // ❌ ЗДЕСЬ БЫЛ БАГ С HOTEL-HINT. ОН УДАЛЕН. ❌

        let btnAd = document.getElementById('btn-city-ad');
        btnAd.innerText = `РЕКЛАМА (+500 🪙) [${this.maxAdsPerDay - this.state.adsWatched}]`;
        btnAd.onclick = () => {
            if (this.state.adsWatched < this.maxAdsPerDay) {
                this.watchAd(() => {
                    this.state.coins += 500;
                    this.playFloatingText("+500 🪙", true);
                    this.updateTopUI();
                    btnAd.innerText = `РЕКЛАМА (+500 🪙) [${this.maxAdsPerDay - this.state.adsWatched}]`;
                    this.saveGame();
                });
            } else {
                this.toast("Лимит рекламы на сегодня исчерпан!");
            }
        };

        // Гарантированно показываем кнопку выхода
        document.getElementById('btn-leave-city').style.display = 'block';

        // СБРОС ВКЛАДОК (Всегда открываем "Услуги" первой)
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector('[data-tab="tab-services"]').classList.add('active');
        document.getElementById('tab-services').classList.add('active');

        // Отрисовка магазинов и квестов
        this.renderCityShop(city);
        this.renderCityMayor(city);
    },

    renderCityMayor: function(city) {
        const p = this.prices ? this.prices[city.tier] : { exc: 200 }; 
        let html = `<button class="btn-action ${this.state.excPaid ? 'btn-leave' : ''}" style="margin-top:15px;" ${this.state.excPaid ? 'disabled' : ''} onclick="Game.startExcursion(${p.exc})">
            ${this.state.excPaid ? 'ЭКСКУРСИЯ ПРОЙДЕНА' : 'ВЗЯТЬ ЭКСКУРСИЮ (' + p.exc + ' 🪙)'}
        </button>`;
        document.getElementById('city-quests').innerHTML = html;
    },

    leaveCity: function() {
        if (!this.state.hotelPaid) {
            if(this.state.car.sleepBonus > 0) {
                this.state.wake = Math.min(100, this.state.wake + this.state.car.sleepBonus);
                this.toast(`Ночевка в машине (+${this.state.car.sleepBonus}% бодрости).`);
            } else {
                this.toast("Сон в этой машине не восстанавливает силы. Будьте осторожны!");
            }
        }
        this.updateTopUI();
        document.getElementById('city-overlay').style.display = 'none';
        this.saveGame();
    },

    openTrunk: function() {
        if (!this.state.car) return;
        if (this.state.isMoving) { 
            this.toast("Нельзя копаться в машине на ходу!"); 
            return; 
        }

        document.getElementById('car-sheet-name').innerText = this.state.car.name;
        document.getElementById('car-sheet-img').src = `assets/cars/${this.state.car.img}`;
        document.getElementById('car-sheet-tank').innerText = this.state.car.tank;
        document.getElementById('car-sheet-cons').innerText = this.state.car.cons;
        document.getElementById('car-sheet-rad').innerText = this.state.car.radius;

        let sleepText = this.state.car.sleepBonus > 0 ? 
            `<span style="color:#8BC34A;"><i class="fa-solid fa-bed"></i> Можно спать (+${this.state.car.sleepBonus}%)</span>` : 
            `<span style="color:#F44336;"><i class="fa-solid fa-ban"></i> Спать неудобно</span>`;
        document.getElementById('car-sheet-sleep').innerHTML = sleepText;

        if (!this.state.inventory) this.state.inventory = [];
        let maxCap = this.state.car.capacity;
        let currCap = this.state.inventory.length;
        document.getElementById('trunk-capacity').innerText = `(${currCap} / ${maxCap})`;

        let grid = document.getElementById('trunk-grid');
        grid.innerHTML = '';

        this.state.inventory.forEach(invItem => {
            let itemData = this.getItemData(invItem.id); 
            if (itemData) {
                grid.innerHTML += `
                    <div class="trunk-slot" style="border-color: #FF9800;">
                        <div class="trunk-slot-icon">${itemData.icon}</div>
                        <div class="trunk-slot-name">${itemData.name}</div>
                    </div>`;
            }
        });

        for (let i = currCap; i < maxCap; i++) {
            grid.innerHTML += `<div class="trunk-slot empty"><i class="fa-solid fa-plus" style="color:#444;"></i></div>`;
        }

        document.getElementById('car-modal').style.display = 'flex';
    },

    resetProgress: function() {
        this.showConfirm("НАЧАТЬ ЗАНОВО?", "Вы потеряете все монеты, товары, авто и альбом. Начать чистую игру?", async () => {
            this.state.car = null; 
            this.state.inventory = [];
            localStorage.clear();  
            await this.saveGame(); 
            window.location.reload(); 
        });
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
            if ((el.val / el.max) < 0.3) el.node.classList.add('danger-pulse');
            else el.node.classList.remove('danger-pulse');
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
        let collectedCities = cfoCities.filter(c => this.state.collected.includes(c.id));
        
        if (collectedCities.length === 0) {
            grid.innerHTML = "<p style='color:#aaa; grid-column: 1/-1;'>Альбом пока пуст. Оплачивайте отель и экскурсии в городах.</p>";
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
        c.innerHTML = ''; 
        let t = document.createElement('div'); t.className = 'toast'; t.innerText = msg;
        c.appendChild(t); 
        // 🛠 ФИКС ЗАВИСАНИЯ ПЛАШКИ: Теперь она исчезает сама через 2.5 секунды
        setTimeout(() => { if (t.parentNode) t.remove(); }, 2500);
    },

    playFloatingText: function(text, isPositive) {
        let el = document.createElement('div');
        el.className = `floating-text ${isPositive ? 'positive' : ''}`;
        el.innerText = text;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1500);
    },

    bindEvents: function() {
        document.getElementById('btn-leave-city').onclick = () => this.leaveCity();
        document.getElementById('btn-album').onclick = () => this.openAlbum();
        document.getElementById('btn-reset').onclick = () => this.resetProgress();
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                e.target.classList.add('active');
                let targetId = e.target.getAttribute('data-tab');
                document.getElementById(targetId).classList.add('active');
            }
        });
    }
};