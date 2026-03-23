import { MapModule } from './map.js';
import { UIModule } from './ui.js';
import { EconomyModule } from './economy.js';
import { EventsModule } from './events.js';
import { StorageModule } from './storage.js';

export const Game = {
    maxAdsPerDay: 5, // Перенесли константу сюда
    map: null, 
    markers: {}, 
    routeLines: [], 
    carMarker: null,
    animationInterval: null,
    
    state: {
        coins: 1500, gas: 0, food: 100, wake: 100, hp: 100, rating: 0, adsWatched: 0,
        car: null, diff: null, currentCity: null, history: [], collected: [], discovered: [],
        isMoving: false, hotelPaid: false, excPaid: false,
        driveMode: null, travelData: null, qteActive: false,
        newMedalCity: null,
        kmSinceEvent: 0, kmSinceQTE: 0,
        inventory: [] // <--- ДОБАВИТЬ ЭТУ СТРОЧКУ
    },

    init: async function() {
        let vkUserId = null;

        try {
            if (window.vkBridge) {
                await vkBridge.send('VKWebAppInit'); 
                const user = await vkBridge.send('VKWebAppGetUserInfo');
                document.getElementById('player-name').innerText = user.first_name;
                vkUserId = user.id; 
            }
        } catch (e) { 
            console.log("Демо-режим"); 
            vkUserId = 123456789; 
        }
        // Если игрок был в каком-то городе, ставим туда машину
            if (this.state.currentCity) {
                let carIcon = L.divIcon({
                    className: 'marker-car', 
                    html: `<img src="assets/cars/${this.state.car.img}" style="width: 40px; height: auto; filter: drop-shadow(0 5px 5px rgba(0,0,0,0.7));">`
                });
                // МЕНЯЕМ interactive НА true
                this.carMarker = L.marker(this.state.currentCity.coords, {icon: carIcon, interactive: true, zIndexOffset: 1000}).addTo(this.map);
                
                // ДОБАВЛЯЕМ КЛИК
                this.carMarker.on('click', () => {
                    this.openTrunk();
                });
            }

        // 1. МГНОВЕННО рисуем карту, чтобы не было серого экрана
        this.initMap();
        this.checkDailyLimits();
        this.renderMap();
        this.bindEvents();

        this.toast("Синхронизация с сервером..."); // Показываем игроку, что идет загрузка

        // 2. Идем в базу данных за сохранением
        await this.initStorage(vkUserId);

        // 3. После загрузки - обновляем цвета городов на карте
        this.updateMarkers();

        // 4. Распределяем логику: новая игра или продолжение
        if (!this.state.car) {
            // Новая игра - показываем выбор машины
            document.getElementById('difficulty-modal').style.display = 'flex';
        } else {
            // Продолжение - ЖЕСТКО ПРЯЧЕМ окно выбора и показываем ресурсы
            document.getElementById('difficulty-modal').style.display = 'none';
            document.getElementById('resource-panel').style.display = 'flex';
            this.updateTopUI();
            
            // Если игрок был в каком-то городе, ставим туда машину
            if (this.state.currentCity) {
                let carIcon = L.divIcon({
                    className: 'marker-car', 
                    html: `<img src="assets/cars/${this.state.car.img}" style="width: 40px; height: auto; filter: drop-shadow(0 5px 5px rgba(0,0,0,0.7));">`
                });
                this.carMarker = L.marker(this.state.currentCity.coords, {icon: carIcon, interactive: false, zIndexOffset: 1000}).addTo(this.map);
            }
        }
    },
};

// Вклеиваем все функции из других файлов в единый объект Game
Object.assign(Game, MapModule, UIModule, EconomyModule, EventsModule, StorageModule);