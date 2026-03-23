import { prices } from '../data/prices.js';
import { marketItems } from '../data/market.js'; 

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
        // Сохраняем prices локально, чтобы ui.js мог забрать цену экскурсии
        this.prices = prices; 
        
        // === Вкладка 1: УСЛУГИ ===
        let sHtml = "";
        sHtml += `<div class="shop-category"><h4>🛏️ Ночлег</h4><div class="btn-group">`;
        if (p.hotel > 0) {
            let isFull = this.state.wake >= 100 || this.state.hotelPaid;
            sHtml += `<button class="btn-shop ${this.state.hotelPaid ? 'purchased' : ''}" ${isFull ? 'disabled' : ''} onclick="Game.buyItem('hotel', ${p.hotel}, 100, 'assets/ui/hotel.png')">
                <img src="assets/ui/hotel.png" class="btn-shop-img">
                <div class="btn-shop-title">Гостиница</div><div class="btn-shop-desc">+100% бодрости</div><div class="btn-shop-price">${p.hotel} 🪙</div></button>`;
        }
        if (p.hostel > 0) {
            let isFull = this.state.wake >= 100 || this.state.hotelPaid;
            sHtml += `<button class="btn-shop ${this.state.hotelPaid ? 'purchased' : ''}" ${isFull ? 'disabled' : ''} onclick="Game.buyItem('hotel', ${p.hostel}, 60, 'assets/ui/hostel.png')">
                <img src="assets/ui/hostel.png" class="btn-shop-img">
                <div class="btn-shop-title">Мотель</div><div class="btn-shop-desc">+60% бодрости</div><div class="btn-shop-price">${p.hostel} 🪙</div></button>`;
        }
        sHtml += `</div></div>`;

        sHtml += `<div class="shop-category"><h4>🍔 Питание</h4><div class="btn-group">`;
        if (p.rest > 0) {
            let isFull = this.state.food >= 100;
            sHtml += `<button class="btn-shop" ${isFull ? 'disabled' : ''} onclick="Game.buyItem('food', ${p.rest}, 100, 'assets/ui/rest.png')">
                <img src="assets/ui/rest.png" class="btn-shop-img">
                <div class="btn-shop-title">Ресторан</div><div class="btn-shop-desc">+100% сытости</div><div class="btn-shop-price">${p.rest} 🪙</div></button>`;
        }
        if (p.fastfood > 0) {
            let isFull = this.state.food >= 100;
            sHtml += `<button class="btn-shop" ${isFull ? 'disabled' : ''} onclick="Game.buyItem('food', ${p.fastfood}, 50, 'assets/ui/fastfood.png')">
                <img src="assets/ui/fastfood.png" class="btn-shop-img">
                <div class="btn-shop-title">Столовая</div><div class="btn-shop-desc">+50% сытости</div><div class="btn-shop-price">${p.fastfood} 🪙</div></button>`;
        }
        sHtml += `</div></div>`;

        if (this.state.car.id !== "bike" && p.gas > 0) {
            let missingGas = Math.floor(this.state.car.tank - this.state.gas);
            let fullPrice = missingGas * p.gas;
            let tenPrice = 10 * p.gas;
            sHtml += `<div class="shop-category"><h4>⛽ АЗС (${p.gas} 🪙/л)</h4><div class="btn-group">`;
            sHtml += `<button class="btn-shop" style="border:1px solid #444; background:#2a2a2a;" ${missingGas < 10 ? 'disabled' : ''} onclick="Game.buyItem('gas', ${tenPrice}, 10, null)">
                <div class="btn-shop-title" style="margin-top:10px;">+10 Литров</div><div class="btn-shop-price" style="margin-bottom:10px;">${tenPrice} 🪙</div></button>`;
            sHtml += `<button class="btn-shop" style="border:1px solid #444; background:#2a2a2a;" ${missingGas <= 0 ? 'disabled' : ''} onclick="Game.buyItem('gas', ${fullPrice}, ${missingGas}, null)">
                <div class="btn-shop-title" style="margin-top:10px;">Полный бак</div><div class="btn-shop-price" style="margin-bottom:10px;">${fullPrice} 🪙</div></button>`;
            sHtml += `</div></div>`;
        }

        if (this.state.car.id !== "bike" && p.repair > 0) {
            let missingHp = Math.floor(100 - this.state.hp);
            let fullPrice = missingHp * p.repair;
            let tenPrice = 10 * p.repair;
            sHtml += `<div class="shop-category" style="border:none;"><h4>🔧 Автосервис</h4><div class="btn-group">`;
            sHtml += `<button class="btn-shop" style="border:1px solid #444; background:#2a2a2a;" ${missingHp < 10 ? 'disabled' : ''} onclick="Game.buyItem('hp', ${tenPrice}, 10, null)">
                <div class="btn-shop-title" style="margin-top:10px;">+10% Ремонт</div><div class="btn-shop-price" style="margin-bottom:10px;">${tenPrice} 🪙</div></button>`;
            sHtml += `<button class="btn-shop" style="border:1px solid #444; background:#2a2a2a;" ${missingHp <= 0 ? 'disabled' : ''} onclick="Game.buyItem('hp', ${fullPrice}, ${missingHp}, null)">
                <div class="btn-shop-title" style="margin-top:10px;">Починить всё</div><div class="btn-shop-price" style="margin-bottom:10px;">${fullPrice} 🪙</div></button>`;
            sHtml += `</div></div>`;
        }

        document.getElementById('city-shop').innerHTML = sHtml;

        // === Вкладка 2: РЫНОК (Заполняем отдельный контейнер) ===
        document.getElementById('city-market').innerHTML = this.renderMarketSection(city);
    },

    // Отрисовка рынка (Торговля)
    renderMarketSection: function(city) {
        let items = marketItems[city.tier];
        let html = `<h4 style="color: #FF9800; margin-bottom: 15px;">📥 Местные товары</h4>`;
        
        if (!this.state.inventory) this.state.inventory = [];

        // Покупка местных товаров
        items.forEach(item => {
            let currentInv = this.state.inventory.length;
            let maxCap = this.state.car.capacity;
            let isFull = currentInv >= maxCap;
            
            html += `
            <div class="market-item">
                <div class="market-item-icon">${item.icon}</div>
                <div class="market-item-info">
                    <div class="market-item-title">${item.name}</div>
                    <div class="market-item-origin">Цена: ${item.basePrice} 🪙</div>
                </div>
                <button class="market-btn market-btn-buy" ${isFull ? 'disabled' : ''} onclick="Game.buyMarketItem('${item.id}')">КУПИТЬ</button>
            </div>`;
        });

        // Скупка товаров из багажника
        if (this.state.inventory.length > 0) {
            html += `<h4 style="color: #4CAF50; margin: 25px 0 15px 0;">📤 Скупщик</h4>`;
            
            this.state.inventory.forEach((invItem, index) => {
                let dist = 0;
                if (invItem.originId !== city.id) {
                    dist = this.map.distance(invItem.originCoords, city.coords) / 1000;
                }
                let itemData = this.getItemData(invItem.id);
                let sellPrice = Math.floor(itemData.basePrice + (dist * itemData.profitMult));
                let isLocal = invItem.originId === city.id;

                html += `
                <div class="market-item" style="${isLocal ? 'opacity:0.6;' : 'border-color:#4CAF50;'}">
                    <div class="market-item-icon">${itemData.icon}</div>
                    <div class="market-item-info">
                        <div class="market-item-title">${itemData.name}</div>
                        <div class="market-item-origin">Привезено: ${invItem.originName}</div>
                    </div>
                    <button class="market-btn market-btn-sell" ${isLocal ? 'style="background:#555;"' : ''} onclick="Game.sellMarketItem(${index}, ${sellPrice})">
                        ${isLocal ? 'ЗА ' + sellPrice : 'ПРОДАТЬ ЗА ' + sellPrice}
                    </button>
                </div>`;
            });
        } else {
            html += `<div style="margin-top: 30px; text-align: center; color: #666; font-size: 12px;">Багажник пуст. Скупщику нечего предложить.</div>`;
        }
        return html;
    },

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
        this.state.inventory.splice(index, 1); 

        this.playFloatingText(`+${sellPrice} 🪙`, true);
        this.toast(`Продано за ${sellPrice} монет!`);
        this.updateTopUI();
        this.renderCityShop(this.state.currentCity);
        this.saveGame();
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
                    let reward = this.prices[this.state.currentCity.tier].quizReward;
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
                
                // Перерисовываем Мэрию, чтобы обновить кнопку
                this.renderCityMayor(this.state.currentCity);
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