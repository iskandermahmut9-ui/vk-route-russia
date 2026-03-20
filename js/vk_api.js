window.VK_API = {
    isInit: false,
    playerData: { name: "Путешественник", avatar: "assets/ui/default_avatar.png" },

    init: async function() {
        if (window.vkBridge) {
            try {
                await vkBridge.send('VKWebAppInit');
                this.isInit = true;
                
                // Подписка на смену темы
                vkBridge.subscribe((e) => {
                    if (e.detail.type === 'VKWebAppUpdateConfig') {
                        const scheme = e.detail.data.scheme || 'client_light';
                        if (scheme.includes('dark')) {
                            document.body.classList.remove('vk-light'); document.body.classList.add('vk-dark');
                        } else {
                            document.body.classList.remove('vk-dark'); document.body.classList.add('vk-light');
                        }
                    }
                });

                // Бесшовное получение профиля (без кнопок авторизации)
                const user = await vkBridge.send('VKWebAppGetUserInfo');
                this.playerData.name = user.first_name;
                this.playerData.avatar = user.photo_200;
                console.log("VK API: Профиль загружен");

            } catch (error) {
                console.log("Запущено вне ВКонтакте (Web-режим)");
            }
        }
    },

    // Монетизация: Показ рекламы за вознаграждение
    showRewardedAd: async function(onSuccess) {
        if (!this.isInit) {
            // Заглушка для тестов в обычном браузере
            UI.showToast("Демо-режим: Реклама просмотрена (+500 монет)");
            onSuccess();
            return;
        }

        try {
            const check = await vkBridge.send('VKWebAppCheckNativeAds', { ad_format: 'reward' });
            if (check.result) {
                const adData = await vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'reward' });
                if (adData.result) {
                    onSuccess();
                } else {
                    UI.showToast("Просмотр рекламы отменен.");
                }
            } else {
                UI.showToast("Реклама сейчас недоступна. Попробуйте позже.");
            }
        } catch (e) {
            console.error(e);
            UI.showToast("Ошибка вызова рекламы.");
        }
    }
};