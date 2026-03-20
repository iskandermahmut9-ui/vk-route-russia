window.DataLoader = {
    // Начальные ресурсы игрока
    initialResources: { coins: 5000, gas: 100, food: 100, wake: 100, xp: 0 },

    cities: [
        { 
            id: "moscow", name: "Москва", tier: 1, coords: [55.7558, 37.6173], 
            media: { fact_text: "Столица России. Нулевой километр всех дорог." },
            economy_override: { hotel_cost: 400, excursion_cost: 200 }
        },
        { 
            id: "vladimir", name: "Владимир", tier: 1, // СТАЛ 1 УРОВНЕМ
            coords: [56.1290, 40.4066], 
            media: { fact_text: "Древняя столица Северо-Восточной Руси. Ворота Золотого кольца." },
            economy_override: { hotel_cost: 350, excursion_cost: 180 } // Подняли цены
        },
        { 
            id: "kazan", name: "Казань", tier: 1, coords: [55.7963, 49.1088], 
            media: { fact_text: "Третья столица. Место пересечения религий и культур." },
            economy_override: { hotel_cost: 300, excursion_cost: 150 }
        }
    ],

    init: async function() {
        console.log("Данные загружены.");
    }
};