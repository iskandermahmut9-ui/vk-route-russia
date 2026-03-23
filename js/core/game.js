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
        kmSinceEvent: 0, kmSinceQTE: 0
    },

    init: async function() {
        let vkUserId = null;

        try {
            if (window.vkBridge) {
                await vkBridge.send('VKWebAppInit'); 
                const user = await vkBridge.send('VKWebAppGetUserInfo');
                document.getElementById('player-name').innerText = user.first_name;
                vkUserId = user.id; // Достаем реальный ID игрока
            }
        } catch (e) { 
            console.log("Демо-режим (вне ВК)"); 
            vkUserId = 123456789; // Тестовый ID для проверки в браузере
        }

        // 1. Сначала загружаем данные из облака!
        await this.initStorage(vkUserId);

        // 2. Только потом собираем карту и остальное
        this.initMap();
        this.checkDailyLimits();
        this.renderMap();
        this.bindEvents();

        // 3. Логика старта:
        if (!this.state.car) {
            // Если машины нет (новая игра) — показываем выбор сложности
            document.getElementById('difficulty-modal').style.display = 'flex';
        } else {
            // Если машина есть (загрузили из базы) — сразу показываем интерфейс
            document.getElementById('resource-panel').style.display = 'flex';
            this.updateTopUI();
            
            // Если игрок сохранился посреди поездки — восстанавливаем маршрут (задел на будущее)
            if (this.state.isMoving) {
                 this.toast("Вы вернулись в пути!");
            } else if (this.state.currentCity) {
                 this.openCityUI(this.state.currentCity);
            }
        }
    },
};

// Вклеиваем все функции из других файлов в единый объект Game
Object.assign(Game, MapModule, UIModule, EconomyModule, EventsModule, StorageModule);