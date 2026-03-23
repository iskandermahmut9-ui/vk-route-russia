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
                <p>Бак: ${car.tank}л | Расход: ${car.cons}л<br>Радар: ${car.radius} км</p>
            `;
            div.onclick = () => {
                this.state.car = car;
                this.state.gas = car.tank;
                document.getElementById('garage-modal').style.display = 'none';
                document.getElementById('resource-panel').style.display = 'flex';
                this.updateTopUI();
                this.toast("Кликните на столицу на карте для старта!");
                
                // Мгновенное сохранение после старта!
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
        document.querySelector('.city-panel').scrollTop = 0; 

        document.getElementById('city-name').innerText = city.name;
        document.getElementById('city-tier').innerText = `Уровень ${city.tier}`;
        document.getElementById('city-fact').innerText = city.fact;
        
        if (this.state.car.sleepBonus > 0) {
            document.getElementById('hotel-hint').innerText = `В этой машине можно спать (+${this.state.car.sleepBonus}% бодрости).`;
        } else {
            document.getElementById('hotel-hint').innerText = "Сон в этой машине не восстанавливает бодрость.";
        }

        let btnAd = document.getElementById('btn-city-ad');
        btnAd.innerText = `РЕКЛАМА (+500 🪙) [${this.maxAdsPerDay - this.state.adsWatched}]`;
        btnAd.onclick = () => {
            if (this.state.adsWatched < this.maxAdsPerDay) {
                this.watchAd(() => {
                    this.state.coins += 500;
                    this.playFloatingText("+500 🪙", true);
                    this.updateTopUI();
                    btnAd.innerText = `РЕКЛАМА (+500 🪙) [${this.maxAdsPerDay - this.state.adsWatched}]`;
                    this.saveGame(); // Сохраняем после просмотра рекламы
                });
            } else {
                this.toast("Лимит рекламы на сегодня исчерпан!");
            }
        };

        document.getElementById('btn-leave-city').style.display = 'block';
        this.renderCityShop(city);
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
        this.saveGame(); // Сохраняем прогресс перед выездом
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
        let collectedCities = cfoCities.filter(c => this.state.collected.includes(c.id));
        
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
        c.innerHTML = ''; 
        let t = document.createElement('div'); t.className = 'toast'; t.innerText = msg;
        c.appendChild(t); 
    },

    playFloatingText: function(text, isPositive) {
        let el = document.createElement('div');
        el.className = `floating-text ${isPositive ? 'positive' : ''}`;
        el.innerText = text;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1500);
    },
    openTrunk: function() {
        if (!this.state.car) return;
        if (this.state.isMoving) { 
            this.toast("Нельзя открыть багажник на ходу!"); 
            return; 
        }

        let maxCap = this.state.car.capacity;
        let currCap = this.state.inventory.length;
        document.getElementById('trunk-capacity').innerText = `(${currCap} / ${maxCap} слотов)`;

        let grid = document.getElementById('trunk-grid');
        grid.innerHTML = '';

        if (currCap === 0) {
            grid.innerHTML = "<p style='color:#aaa; grid-column: 1 / -1; text-align: center; padding: 20px;'>Багажник пуст. Зайдите на Рынок в любом городе.</p>";
        } else {
            this.state.inventory.forEach(invItem => {
                let itemData = this.getItemData(invItem.id); 
                grid.innerHTML += `
                    <div class="album-card" style="border: 1px solid #FF9800; background: #2a2a2a;">
                        <div style="font-size: 40px;">${itemData.icon}</div>
                        <div style="font-weight:bold; font-size:12px; margin-top: 5px;">${itemData.name}</div>
                        <div style="font-size:10px; color:#aaa;">Из: ${invItem.originName}</div>
                    </div>`;
            });
        }
        document.getElementById('trunk-modal').style.display = 'flex';
    },

    bindEvents: function() {
        document.getElementById('btn-leave-city').onclick = () => this.leaveCity();
        document.getElementById('btn-album').onclick = () => this.openAlbum();
    }
};