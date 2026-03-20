window.DataLoader = {
    // ГАРАЖ 2.0: Настройки машин
    cars: {
        sedan: {
            id: "sedan", name: "Городской Седан", 
            tankSize: 50, consumption: 8, // 8 литров на 100 км
            radarRadius: 5000, // 5 км для поиска городов 3 уровня
            sleepBonus: 50 // Сон в машине дает 50% бодрости
        },
        suv: {
            id: "suv", name: "Внедорожник", 
            tankSize: 80, consumption: 14, // 14 литров на 100 км (жрет много!)
            radarRadius: 30000, // 30 км - легко находит скрытые локации
            sleepBonus: 50
        },
        camper: {
            id: "camper", name: "Автодом", 
            tankSize: 70, consumption: 18, 
            radarRadius: 10000, 
            sleepBonus: 100 // Можно спать на трассе и восстанавливать 100%!
        }
    },

    // Стартовые ресурсы игрока
    initialResources: { coins: 5000, gas: 50, food: 100, wake: 100, hp: 100, xp: 0 },

    // БАЗА ГОРОДОВ ЦФО
    cities: [
        // --- УРОВЕНЬ 1 (Столицы регионов) ---
        { 
            id: "moscow", name: "Москва", tier: 1, coords: [55.7558, 37.6173], 
            media: { fact_text: "Столица России. Самые дорогие отели и сложные квесты." },
            economy_override: { hotel_cost: 800, excursion_cost: 400 },
            quests: ["В каком году основана Москва?", "Назовите самую высокую башню Кремля."]
        },
        { 
            id: "tula", name: "Тула", tier: 1, coords: [54.1931, 37.6173], 
            media: { fact_text: "Оружейная столица, родина самоваров и пряников." },
            economy_override: { hotel_cost: 400, excursion_cost: 200 },
            quests: ["Кто Левша по профессии?", "Главный музей оружия находится в форме..."]
        },
        { 
            id: "vladimir", name: "Владимир", tier: 1, coords: [56.1290, 40.4066], 
            media: { fact_text: "Древняя столица Северо-Восточной Руси." },
            economy_override: { hotel_cost: 400, excursion_cost: 200 },
            quests: ["Как называются главные ворота во Владимире?"]
        },
        { 
            id: "ryazan", name: "Рязань", tier: 1, coords: [54.6269, 39.7416], 
            media: { fact_text: "Столица ВДВ и родина Сергея Есенина." },
            economy_override: { hotel_cost: 350, excursion_cost: 150 },
            quests: ["Что в Рязани 'с глазами'?"]
        },

        // --- УРОВЕНЬ 2 (Золотое кольцо / Крупные узлы) ---
        { 
            id: "suzdal", name: "Суздаль", tier: 2, coords: [56.4194, 40.4494], 
            media: { fact_text: "Город-музей. Более 200 памятников архитектуры." },
            economy_override: { hotel_cost: 500, excursion_cost: 150 }, // Отели дорогие из-за туристов
            quests: ["Какой напиток традиционно делают в Суздале?"]
        },
        { 
            id: "rostov", name: "Ростов Великий", tier: 2, coords: [57.1866, 39.4144], 
            media: { fact_text: "Знаменит своими звонницами и финифтью." },
            economy_override: { hotel_cost: 300, excursion_cost: 100 },
            quests: ["В каком фильме Гайдая герои бегали по стенам Ростовского кремля?"]
        },

        // --- УРОВЕНЬ 3 (Скрытые жемчужины - Не видны на карте!) ---
        { 
            id: "tarusa", name: "Таруса", tier: 3, coords: [54.7271, 37.1811], 
            media: { fact_text: "Город поэтов и художников на Оке." },
            economy_override: { hotel_cost: 0, excursion_cost: 0 }, // Бесплатный ночлег в палатке!
            quests: ["Памятник какой поэтессе стоит на берегу Оки в Тарусе?"]
        },
        { 
            id: "kozelsk", name: "Козельск", tier: 3, coords: [54.0333, 35.7833], 
            media: { fact_text: "«Город злой», сопротивлявшийся Батыю 7 недель." },
            economy_override: { hotel_cost: 0, excursion_cost: 0 },
            quests: ["Какая знаменитая пустынь находится рядом с Козельском?"]
        },
        { 
            id: "torzhok", name: "Торжок", tier: 3, coords: [57.0406, 34.9582], 
            media: { fact_text: "Золотое шитье и пожарские котлеты." },
            economy_override: { hotel_cost: 0, excursion_cost: 0 },
            quests: ["Какое блюдо воспел Пушкин, проезжая через Торжок?"]
        }
    ],

    init: async function() {
        console.log("База ЦФО загружена.");
    }
};