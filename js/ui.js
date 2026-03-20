window.UI = {
    init: function() {
        document.getElementById('player-name').innerText = VK_API.playerData.name;
        document.getElementById('player-avatar').src = VK_API.playerData.avatar;

        // Логика раскрытия панели на мобильных
        const sidebar = document.getElementById('game-panel');
        const handle = document.querySelector('.mobile-drag-handle');
        
        handle.addEventListener('click', () => {
            if(window.innerWidth <= 768) {
                sidebar.classList.toggle('open');
            }
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
        document.getElementById('status-text').innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${text}`;
        
        // На мобильных сворачиваем панель при старте движения
        if(window.innerWidth <= 768) document.getElementById('game-panel').classList.remove('open');
    },

    // Модалки старые...
    showModal: function(title, text, isConfirm = false, onConfirm = null) {
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-text').innerText = text;
        document.getElementById('custom-modal').style.display = 'flex';
        const btnOk = document.getElementById('btn-modal-ok');
        const btnCancel = document.getElementById('btn-modal-cancel');
        btnOk.onclick = null; btnCancel.onclick = null;
        if (isConfirm) {
            btnCancel.style.display = 'block'; btnOk.innerText = 'ДА';
            btnOk.onclick = () => { document.getElementById('custom-modal').style.display = 'none'; if(onConfirm) onConfirm(); };
            btnCancel.onclick = () => { document.getElementById('custom-modal').style.display = 'none'; };
        } else {
            btnCancel.style.display = 'none'; btnOk.innerText = 'ПОНЯТНО';
            btnOk.onclick = () => { document.getElementById('custom-modal').style.display = 'none'; };
        }
    },

    // ОБНОВЛЕНИЕ 5 РЕСУРСОВ
    updateResources: function(coins, gas, food, wake, xp) {
        document.getElementById('val-coins').innerText = Math.round(coins);
        document.getElementById('val-gas').innerText = Math.round(gas);
        document.getElementById('val-food').innerText = Math.round(food);
        document.getElementById('val-wake').innerText = Math.round(wake);
        document.getElementById('val-xp').innerText = Math.round(xp);
    },

    openCityPanel: function(cityData) {
        document.getElementById('status-text').style.display = 'none';
        document.getElementById('city-info').style.display = 'block';
        
        document.getElementById('city-name').innerText = cityData.name;
        document.getElementById('city-tier').innerText = `Столица региона (Уровень ${cityData.tier})`;
        document.getElementById('city-fact').innerText = cityData.media.fact_text;
        
        document.getElementById('cost-hotel').innerText = cityData.economy_override.hotel_cost;
        document.getElementById('cost-exc').innerText = cityData.economy_override.excursion_cost;

        // На мобильных автоматически раскрываем панель при въезде
        if(window.innerWidth <= 768) document.getElementById('game-panel').classList.add('open');
    }
};