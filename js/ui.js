window.UI = {
    init: function() {
        document.getElementById('player-name').innerText = VK_API.playerData.name;
        document.getElementById('player-avatar').src = VK_API.playerData.avatar;

        const sidebar = document.getElementById('game-panel');
        const handle = document.querySelector('.mobile-drag-handle');
        handle.addEventListener('click', () => {
            if(window.innerWidth <= 768) sidebar.classList.toggle('open');
        });
    },

    showToast: function(msg) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast'; toast.innerText = msg;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    },

    updateStatus: function(text) {
        document.getElementById('city-info').style.display = 'none';
        document.getElementById('status-text').style.display = 'block';
        // Очищаем старый текст, но оставляем статистику (ее не трогаем)
        document.getElementById('status-text').childNodes[0].nodeValue = '';
        document.getElementById('status-text').innerHTML = `<i class="fa-solid fa-car-side"></i> ${text}`;
        
        if(window.innerWidth <= 768) document.getElementById('game-panel').classList.remove('open');
    },

    // Обновленная модалка с поддержкой действия на "Отмену"
    showModal: function(title, text, isConfirm = false, onConfirm = null, onCancel = null) {
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-text').innerText = text;
        document.getElementById('custom-modal').style.display = 'flex';
        
        const btnOk = document.getElementById('btn-modal-ok');
        const btnCancel = document.getElementById('btn-modal-cancel');
        
        // Очистка старых событий
        btnOk.replaceWith(btnOk.cloneNode(true));
        btnCancel.replaceWith(btnCancel.cloneNode(true));
        const newBtnOk = document.getElementById('btn-modal-ok');
        const newBtnCancel = document.getElementById('btn-modal-cancel');

        if (isConfirm) {
            newBtnCancel.style.display = 'block'; 
            newBtnOk.innerText = 'ДА';
            
            newBtnOk.addEventListener('click', () => { 
                document.getElementById('custom-modal').style.display = 'none'; 
                if(onConfirm) onConfirm(); 
            });
            newBtnCancel.addEventListener('click', () => { 
                document.getElementById('custom-modal').style.display = 'none'; 
                if(onCancel) onCancel(); 
            });
        } else {
            newBtnCancel.style.display = 'none'; 
            newBtnOk.innerText = 'ПОНЯТНО';
            newBtnOk.addEventListener('click', () => { 
                document.getElementById('custom-modal').style.display = 'none'; 
                if(onConfirm) onConfirm();
            });
        }
    },

    updateResources: function(coins, gas, food, wake, hp, xp) {
        document.getElementById('val-coins').innerText = Math.round(coins);
        document.getElementById('val-gas').innerText = Math.round(gas);
        document.getElementById('val-food').innerText = Math.round(food);
        document.getElementById('val-wake').innerText = Math.round(wake);
        document.getElementById('val-hp').innerText = Math.round(hp); // Добавили HP обратно
        document.getElementById('val-xp').innerText = Math.round(xp);
    },

    openCityPanel: function(cityData) {
        document.getElementById('status-text').style.display = 'none';
        document.getElementById('city-info').style.display = 'block';
        
        document.getElementById('city-name').innerText = cityData.name;
        document.getElementById('city-tier').innerText = `Уровень ${cityData.tier}`;
        document.getElementById('city-fact').innerText = cityData.media.fact_text;
        
        document.getElementById('cost-hotel').innerText = cityData.economy_override.hotel_cost;
        document.getElementById('cost-exc').innerText = cityData.economy_override.excursion_cost;

        if(window.innerWidth <= 768) document.getElementById('game-panel').classList.add('open');
    }
};