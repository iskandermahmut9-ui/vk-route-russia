import { prices } from '../data/prices.js';
import { marketItems } from '../data/market.js'; // Подключаем базу товаров

export const EconomyModule = {
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

    renderCityShop: function(city) {
        const p = prices[city.tier];
        let html = "";

        // === СТАНДАРТНЫЕ УСЛУГИ (Отель, Еда, АЗС, СТО, Экскурсии) ===
        // (Они остаются без изменений)
        html += `<div class="shop-category"><h4>🛏️ Ночлег</h4><div class="btn-group">`;
        if (p.hotel > 0) {
            let isFull = this.state.wake >= 100 || this.state.hotelPaid;
            html += `<button class="btn-shop ${this.state.hotelPaid ? 'purchased' : ''}" ${isFull ? 'disabled' : ''} onclick="Game.buyItem('hotel', ${p.hotel}, 100, 'assets/ui/hotel.png')">
                <div class="btn-shop-title">Гостиница</div><div class="btn-shop-desc">+100% бодрости</div><div class="btn-shop-price">${p.hotel} 🪙</div></button>`;
        }
        if (p.hostel > 0) {
            let isFull = this.state.wake >= 100 || this.state.hotelPaid;
            html += `<button class="btn-shop ${this.state.hotelPaid ? 'purchased' : ''}" ${isFull ? 'disabled' : ''} onclick="Game.buyItem('hotel', ${p.hostel}, 60, 'assets/ui/hostel.png')">
                <div class="btn-shop-title">Мотель</div><div class="btn-shop-desc">+60% бодрости</div><div class="btn-shop-price">${p.hostel} 🪙</div></button>`;
        }
        html += `</div></div>`;

        html += `<div class="shop-category"><h4>🍔 Питание</h4><div class="btn-group">`;
        if (p.rest > 0) {
            let isFull = this.state.food >= 100;
            html += `<button class="btn-shop" ${isFull ? 'disabled' : ''} onclick="Game.buyItem('food', ${p.rest}, 100, 'assets/ui/rest.png')">
                <div class="btn-shop-title">Ресторан</div><div class="btn-shop-desc">+100% сытости</div><div class="btn-shop-price">${p.rest} 🪙</div></button>`;
        }
        if (p.fastfood > 0) {
            let isFull = this.state.food >= 100;
            html += `<button class="btn-shop" ${isFull ? 'disabled' : ''} onclick="Game.buyItem('food', ${p.fastfood}, 50, 'assets/ui/fastfood.png')">
                <div class="btn-shop-title">Столовая</div><div class="btn-shop-desc">+50% сытости</div><div class="btn-shop-price">${p.fastfood} 🪙</div></button>`;
        }
        html += `</div></div>`;

        if (this.state.car.id !== "bike" && p.gas > 0) {
            let missingGas = Math.floor(this.state.car.tank - this.state.gas);
            let fullPrice = missingGas * p.gas;
            let tenPrice = 10 * p.gas;
            html += `<div class="shop-category"><h4>⛽ АЗС (${p.gas} 🪙/л)</h4><div class="btn-group">`;
            html += `<button class="btn-shop" style="border:1px solid #444; background:#2a2a2a;" ${missingGas < 10 ? 'disabled' : ''} onclick="Game.buyItem('gas', ${tenPrice}, 10, null)">
                <div class="btn-shop-title">+10 Литров</div><div class="btn-shop-price">${tenPrice} 🪙</div></button>`;
            html += `<button class="btn-shop" style="border:1px solid #444; background:#2a2a2a;" ${missingGas <= 0 ? 'disabled' : ''} onclick="Game.buyItem('gas', ${fullPrice}, ${missingGas}, null)">
                <div class="btn-shop-title">Полный бак</div><div class="btn-shop-price">${fullPrice} 🪙</div></button>`;
            html += `</div></div>`;
        }

        if (this.state.car.id !== "bike" && p.repair > 0) {
            let missingHp = Math.floor(100 - this.state.hp);
            let fullPrice = missingHp * p.repair;
            let tenPrice = 10 * p.repair;
            html += `<div class="shop-category"><h4>🔧 Автосервис</h4><div class="btn-group">`;
            html += `<button class="btn-shop" style="border:1px solid #444; background:#2a2a2a;" ${missingHp < 10 ? 'disabled' : ''} onclick="Game.buyItem('hp', ${tenPrice}, 10, null)">
                <div class="btn-shop-title">+10% Ремонт</div><div class="btn-shop-price">${tenPrice} 🪙</div></button>`;
            html += `<button class="btn-shop" style="border:1px solid #444; background:#2a2a2a;" ${missingHp <= 0 ? 'disabled' : ''} onclick="Game.buyItem('hp', ${fullPrice}, ${missingHp}, null)">
                <div class="btn-shop-title">Починить всё</div><div class="btn-shop-price">${fullPrice} 🪙</div></button>`;
            html += `</div></div>`;
        }

        if (p.exc > 0) {
            html += `<div class="shop-category"><h4>🎫 Культура</h4><div class="btn-group">`;
            html += `<button class="btn-shop ${this.state.excPaid ? 'purchased' : ''}" style="border:1px solid #444; background:#2a2a2a;" ${this.state.excPaid ? 'disabled' : ''} onclick="Game.startExcursion(${p.exc})">
                <div class="btn-shop-title">Взять Экскурсию</div><div class="btn-shop-desc">Для Альбома</div><div class="btn-shop-price">${p.exc} 🪙</div></button>`;
            html += `</div></div>`;
        }

        // === НОВЫЙ БЛОК: РЫНОК И СКУПКА ===
        html += this.renderMarketSection(city);

        document.getElementById('city-shop').innerHTML = html;
    },

    // Отрисовка рынка (Торговля)
    renderMarketSection: function(city) {
        let items = marketItems[city.tier];
        let html = `<div class="shop-category" style="border: 2px solid #FF9800; border-radius: 10px; margin-top: 20px;">
                        <h4 style="color: #FF9800;">📦 Городской Рынок</h4><div class="btn-group">`;
        
        // Покупка местных товаров
        items.forEach(item => {
            let currentInv = this.state.inventory.length;
            let maxCap = this.state.car.capacity;
            let isFull = currentInv >= maxCap;
            
            html += `<button class="btn-shop" style="background:#2a2a2a !important;" ${isFull ? 'disabled' : ''} onclick="Game.buyMarketItem('${item.id}')">
                <div style="font-size: 35px; margin-bottom: 5px;">${item.icon}</div>
                <div class="btn-shop-title">${item.name}</div>
                <div class="btn-shop-desc">В багажник</div>
                <div class="btn-shop-price" style="color: #FF9800;">Купить за ${item.basePrice} 🪙</div></button>`;
        });
        html += `</div></div>`;

        // Скупка товаров из багажника
        if (this.state.inventory.length > 0) {
            html += `<div class="shop-category" style="border: 2px solid #4CAF50; border-radius: 10px; margin-top: 15px;">
                        <h4 style="color: #4CAF50;">💰 Местный Скупщик</h4><div class="btn-group">`;
            
            this.state.inventory.forEach((invItem, index) => {
                let dist = 0;
                // Считаем дистанцию от места покупки (в километрах)
                if (invItem.originId !== city.id) {
                    dist = this.map.distance(invItem.originCoords, city.coords) / 1000;
                }
                let itemData = this.getItemData(invItem.id);
                // Формула цены: База + (Км * Множитель прибыли)
                let sellPrice = Math.floor(itemData.basePrice + (dist * itemData.profitMult));
                
                let btnStyle = invItem.originId === city.id ? 'background:#555 !important;' : 'background:#1b3320 !important; border: 1px solid #4CAF50;';
                let btnText = invItem.originId === city.id ? 'Здесь не купят дорого' : `Продать за ${sellPrice} 🪙`;

                html += `<button class="btn-shop" style="${btnStyle}" onclick="Game.sellMarketItem(${index}, ${sellPrice})">
                    <div style="font-size: 30px;">${itemData.icon}</div>
                    <div class="btn-shop-title">${itemData.name}</div>
                    <div class="btn-shop-desc" style="font-size:10px;">Привезено из: ${invItem.originName}</div>
                    <div class="btn-shop-price" style="color: #4CAF50;">${btnText}</div></button>`;
            });
            html += `</div></div>`;
        }
        return html;
    },

    // Поиск данных о товаре по его ID
    getItemData: function(id) {
        for (let tier in marketItems) {
            let found = marketItems[tier].find(i => i.id === id);
            if (found) return found;
        }
        return null;
    },

    buyMarketItem: function(itemId) {
        let itemData = this.getItemData(itemId);
        if (!itemData) return;
        
        if (this.state.coins < itemData.basePrice) {
            this.toast("Не хватает монет!"); return;
        }
        if (this.state.inventory.length >= this.state.car.capacity) {
            this.toast("Багажник полон!"); return;
        }

        this.state.coins -= itemData.basePrice;
        
        // Кладем в багажник и ЗАПОМИНАЕМ, где купили
        this.state.inventory.push({
            id: itemId,
            originId: this.state.currentCity.id,
            originName: this.state.currentCity.name,
            originCoords: this.state.currentCity.coords,
            buyPrice: itemData.basePrice
        });

        this.playFloatingText(`-${itemData.basePrice} 🪙`, false);
        this.toast(`Куплено: ${itemData.name}`);
        this.updateTopUI();
        this.renderCityShop(this.state.currentCity);
        this.saveGame();
    },

    sellMarketItem: function(index, sellPrice) {
        let invItem = this.state.inventory[index];
        this.state.coins += sellPrice;
        this.state.inventory.splice(index, 1); // Удаляем из багажника

        this.playFloatingText(`+${sellPrice} 🪙`, true);
        this.toast(`Продано за ${sellPrice} монет!`);
        this.updateTopUI();
        this.renderCityShop(this.state.currentCity);
        this.saveGame();
    },

    // === СТАНДАРТНЫЕ ПОКУПКИ (Остались без изменений) ===
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
        this.saveGame();
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
                    let reward = prices[this.state.currentCity.tier].quizReward;
                    this.state.coins += reward;
                    this.state.rating += 1;
                    this.playFloatingText(`+${reward} 🪙`, true);
                    this.playFloatingText(`+1 📸`, true);
                    this.toast("Верный ответ!");
                } else { 
                    this.toast("Неверный ответ! Вы ничего не заработали."); 
                }
                
                this.state.excPaid = true;
                this.updateTopUI();
                this.checkCityCompletion();
                this.renderCityShop(this.state.currentCity);
                this.saveGame(); 
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
    }
};