window.DataLoader = {
    cities: [
        { 
            id: "moscow", name: "Москва", tier: 1, coords: [55.7558, 37.6173], 
            media: { fact_text: "Столица России. Нулевой километр всех дорог." },
            economy_override: { hotel_cost: 400, excursion_cost: 200 }
        },
        { 
            id: "kazan", name: "Казань", tier: 1, coords: [55.7963, 49.1088], 
            media: { fact_text: "Третья столица. Место пересечения религий и культур." },
            economy_override: { hotel_cost: 300, excursion_cost: 150 }
        },
        { 
            id: "vladimir", name: "Владимир", tier: 2, coords: [56.1290, 40.4066], 
            media: { fact_text: "Древняя столица Северо-Восточной Руси." },
            economy_override: { hotel_cost: 250, excursion_cost: 100 }
        }
    ],

    init: async function() {
        console.log("Данные успешно загружены.");
        // В продакшене здесь будет: 
        // const response = await fetch('data/cities.json');
        // this.cities = await response.json();
    }
};