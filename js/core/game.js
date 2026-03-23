import { MapModule } from './map.js';
import { UIModule } from './ui.js';
import { EconomyModule } from './economy.js';
import { EventsModule } from './events.js';
import { StorageModule } from './storage.js';

export const Game = {
    maxAdsPerDay: 5, 
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
        inventory: [] 
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

        this.initMap();
        this.checkDailyLimits();
        this.renderMap();
        this.bindEvents();

        this.toast("Синхронизация с сервером..."); 

        await this.initStorage(vkUserId);

        this.updateMarkers();

        if (!this.state.car) {
            document.getElementById('difficulty-modal').style.display = 'flex';
        } else {
            document.getElementById('difficulty-modal').style.display = 'none';
            document.getElementById('resource-panel').style.display = 'flex';
            this.updateTopUI();
            
            if (this.state.currentCity) {
                // ФИКС ЗОНЫ КЛИКА: Добавлен iconSize
                let carIcon = L.divIcon({
                    className: 'marker-car leaflet-interactive', 
                    iconSize: [80, 40], 
                    iconAnchor: [40, 20],
                    html: `<img src="assets/cars/${this.state.car.img}" style="width: 80px; height: auto; filter: drop-shadow(0 5px 5px rgba(0,0,0,0.7)); pointer-events: auto;">`
                });
                
                this.carMarker = L.marker(this.state.currentCity.coords, {icon: carIcon, interactive: true, zIndexOffset: 1000}).addTo(this.map);
                
                this.carMarker.on('click', () => {
                    if (!this.state.isMoving) {
                        this.openTrunk();
                    } else {
                        this.toast("На скорости в багажник не лезут!");
                    }
                });
            }
        }
    },
};

Object.assign(Game, MapModule, UIModule, EconomyModule, EventsModule, StorageModule);