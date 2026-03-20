window.VK_API = {
    isInit: false,
    playerData: { name: "Путешественник", avatar: "assets/ui/default_avatar.png" },

    init: async function() {
        const inIframe = window.self !== window.top;
        if (window.vkBridge && inIframe) {
            try {
                await vkBridge.send('VKWebAppInit');
                this.isInit = true;
                vkBridge.subscribe((e) => { /* логика темы старая */ });
                const user = await vkBridge.send('VKWebAppGetUserInfo');
                this.playerData.name = user.first_name;
                this.playerData.avatar = user.photo_200;
            } catch (error) { console.log("Ошибка ВК:", error); }
        }
    },

    // НОВАЯ ФУНКЦИЯ - ЗАКРЫТЬ ПРИЛОЖЕНИЕ
    closeApp: function() {
        if (this.isInit) {
            vkBridge.send('VKWebAppClose', { status: 'success' })
                .catch(e => console.log("Ошибка закрытия:", e));
        } else {
            UI.showToast("Демо-режим: Выход недоступен.");
        }
    },

    showRewardedAd: async function(onSuccess) { /* старая реклама */ }
};