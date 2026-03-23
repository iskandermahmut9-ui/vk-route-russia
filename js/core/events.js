import { events as storyEvents } from '../data/events.js';
import { cfoCities } from '../data/regions/cfo.js';

export const EventsModule = {
    watchAd: function(onSuccess) {
        this.state.adsWatched++;
        localStorage.setItem('rr_ads', this.state.adsWatched);
        this.toast("Смотрим рекламу...");
        setTimeout(() => onSuccess(), 2000);
    },

    spawnQTE: function() {
        this.state.qteActive = true;
        let types = [
            { id: 'camera', icon: 'fa-camera', color: '#F44336', text: 'КАМЕРА! ЖМИ!', penalty: {coins: 250}, msgFail: "Вспышка! Штраф -250 🪙" },
            { id: 'hole', icon: 'fa-triangle-exclamation', color: '#F44336', text: 'ЯМА! ЖМИ ЧТОБЫ ОБЪЕХАТЬ!', penalty: {hp: 15}, msgFail: "Удар подвески! Прочность -15%" },
            { id: 'photo', icon: 'fa-image', color: '#4CAF50', text: 'КРАСИВЫЙ ВИД! ЖМИ!', bonus: {coins: 100, rating: 5}, msgSuccess: "+100 🪙 и +5 📸" }
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
                this.state.coins += qte.bonus.coins; 
                this.state.rating += qte.bonus.rating; 
                this.playFloatingText(qte.msgSuccess, true);
                this.updateTopUI();
            } else {
                this.playFloatingText("УВЕРНУЛСЯ!", true);
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
                    this.playFloatingText(qte.msgFail, false);
                }
            }
        }, 1500);
    },

    triggerStoryEvent: function() {
        let ev = storyEvents[Math.floor(Math.random() * storyEvents.length)];
        
        if (ev.id === "police") {
            if (this.state.driveMode.speed === 140) {
                ev.desc = "ВЫ ПРЕВЫСИЛИ СКОРОСТЬ! Инспектор требует 500 монет.";
                ev.choices = [{ text: "Оплатить штраф (500)", action: "police_pay", cost: 500, val: 0, msg: "Вы оплатили огромный штраф." }];
            } else {
                ev.desc = "Инспектор намекает на 'штраф на месте' за грязные номера (100 монет).";
                ev.choices = [
                    { text: "Дать взятку (100)", action: "coins", cost: 100, val: 0, msg: "Вы откупились и поехали дальше." },
                    { text: "Качать права", action: "mixed_road", cost: 0, val: 0, msg: "Вас продержали 2 часа. Вы устали и проголодались (-20% еды и бодрости)." }
                ];
            }
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
                
                if (choice.action === "secret") {
                    this.state.food = Math.max(0, this.state.food - 20);
                    let hiddenCity = cfoCities.find(c => c.tier === 3 && !this.state.discovered.includes(c.id));
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
    }
};