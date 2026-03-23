import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// 🟢 ВСТАВЬ СВОИ ДАННЫЕ СЮДА (Это безопасно)
const SUPABASE_URL = 'https://yfpjgrjarulwdsxswgpx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmcGpncmphcnVsd2RzeHN3Z3B4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMjQ2NTksImV4cCI6MjA4OTgwMDY1OX0.ZwOGceLXeN9bZQq02zDDsh52NmqMGI_s4b2npkfq-4c';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const StorageModule = {
    vkId: null,
    saveTimer: null,

    initStorage: async function(vkId) {
        this.vkId = vkId;
        this.toast("Синхронизация с сервером...");

        try {
            // Ищем сохранение игрока по его VK ID
            const { data, error } = await supabase
                .from('saves')
                .select('game_data')
                .eq('vk_id', this.vkId)
                .single();

            if (data && data.game_data) {
                // Если игра найдена — загружаем прогресс
                Object.assign(this.state, data.game_data);
                console.log("Сохранение загружено!");
            } else {
                // Если игрок зашел впервые — сохраняем стартовые данные
                await this.saveGame();
                console.log("Создан новый профиль!");
            }
            
            // Включаем автосохранение каждые 2 минуты (120 000 мс)
            this.saveTimer = setInterval(() => this.saveGame(), 120000);

        } catch (err) {
            console.error("Ошибка загрузки:", err);
            this.toast("Играем локально (ошибка сети)");
        }
    },

    saveGame: async function() {
        if (!this.vkId) return;

        try {
            // Upsert означает: обнови, если есть, или создай, если нет
            const { error } = await supabase
                .from('saves')
                .upsert({ 
                    vk_id: this.vkId, 
                    game_data: this.state,
                    last_save: new Date().toISOString()
                });
            
            if (error) throw error;
            console.log("Игра сохранена в облако");
        } catch (err) {
            console.error("Ошибка сохранения:", err);
        }
    }
};