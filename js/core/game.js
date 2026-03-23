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
        try {
            if (window.vkBridge) {
                await vkBridge.send('VKWebAppInit'); 
                const user = await vkBridge.send('VKWebAppGetUserInfo');
                document.getElementById('player-name').innerText = user.first_name;
            }
        } catch (e) { console.log("Демо-режим"); }

        this.initMap(); // Функция придет из map.js
        this.checkDailyLimits(); // Функция придет из economy.js
        this.renderMap(); 
        this.bindEvents(); // Функция придет из ui.js
        document.getElementById('difficulty-modal').style.display = 'flex';
    }
};

// Вклеиваем все функции из других файлов в единый объект Game
Object.assign(Game, MapModule, UIModule, EconomyModule, EventsModule, StorageModule);