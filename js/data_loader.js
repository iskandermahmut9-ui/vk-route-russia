window.DataLoader = {
    // Гараж 2.0: Уровни сложности
    cars: {
        sedan: {
            id: "sedan", name: "🚙 Городской Седан", 
            tankSize: 50, consumption: 8, // 8 л на 100 км
            radarRadius: 5000, sleepBonus: 50,
            desc: "Экономичный. Радиус поиска секретов: 5 км."
        },
        suv: {
            id: "suv", name: "🚜 Внедорожник", 
            tankSize: 80, consumption: 14, // 14 л на 100 км
            radarRadius: 30000, sleepBonus: 50,
            desc: "Жрет бензин. Радиус поиска секретов: 30 км."
        },
        camper: {
            id: "camper", name: "🚐 Автодом", 
            tankSize: 70, consumption: 18, // 18 л на 100 км
            radarRadius: 10000, sleepBonus: 100,
            desc: "Медленный. 100% бодрости при сне на трассе."
        }
    },

    initialResources: { coins: 5000, food: 100, wake: 100, hp: 100, xp: 0 },

    cities: [
        // ================= УРОВЕНЬ 1 (Столицы) =================
        { id: "moscow", name: "Москва", tier: 1, coords: [55.7558, 37.6173], media: { fact_text: "Город федерального значения. Нулевой километр." }, economy_override: { hotel_cost: 800, excursion_cost: 400 } },
        { id: "belgorod", name: "Белгород", tier: 1, coords: [50.5997, 36.5982], media: { fact_text: "Город первого салюта." }, economy_override: { hotel_cost: 350, excursion_cost: 150 } },
        { id: "bryansk", name: "Брянск", tier: 1, coords: [53.2415, 34.3715], media: { fact_text: "Город партизанской славы." }, economy_override: { hotel_cost: 300, excursion_cost: 150 } },
        { id: "vladimir", name: "Владимир", tier: 1, coords: [56.1290, 40.4066], media: { fact_text: "Древняя столица Северо-Восточной Руси." }, economy_override: { hotel_cost: 400, excursion_cost: 200 } },
        { id: "voronezh", name: "Воронеж", tier: 1, coords: [51.6607, 39.2002], media: { fact_text: "Колыбель русского регулярного флота." }, economy_override: { hotel_cost: 400, excursion_cost: 180 } },
        { id: "ivanovo", name: "Иваново", tier: 1, coords: [57.0003, 40.9739], media: { fact_text: "Город невест и текстильная столица." }, economy_override: { hotel_cost: 250, excursion_cost: 100 } },
        { id: "kaluga", name: "Калуга", tier: 1, coords: [54.5138, 36.2612], media: { fact_text: "Колыбель космонавтики (здесь жил Циолковский)." }, economy_override: { hotel_cost: 350, excursion_cost: 150 } },
        { id: "kostroma", name: "Кострома", tier: 1, coords: [57.7679, 40.9268], media: { fact_text: "Ювелирная столица и родина Снегурочки." }, economy_override: { hotel_cost: 350, excursion_cost: 150 } },
        { id: "kursk", name: "Курск", tier: 1, coords: [51.7308, 36.1930], media: { fact_text: "Город воинской славы. Курская дуга." }, economy_override: { hotel_cost: 300, excursion_cost: 150 } },
        { id: "lipetsk", name: "Липецк", tier: 1, coords: [52.6102, 39.5947], media: { fact_text: "Центр металлургии и минеральных вод." }, economy_override: { hotel_cost: 300, excursion_cost: 150 } },
        { id: "krasnogorsk", name: "Красногорск", tier: 1, coords: [55.8224, 37.3274], media: { fact_text: "Административный центр Московской области." }, economy_override: { hotel_cost: 450, excursion_cost: 250 } },
        { id: "orel", name: "Орёл", tier: 1, coords: [52.9668, 36.0624], media: { fact_text: "Город первого салюта и писателей (Тургенев, Лесков)." }, economy_override: { hotel_cost: 250, excursion_cost: 100 } },
        { id: "ryazan", name: "Рязань", tier: 1, coords: [54.6269, 39.7416], media: { fact_text: "Столица ВДВ." }, economy_override: { hotel_cost: 350, excursion_cost: 150 } },
        { id: "smolensk", name: "Смоленск", tier: 1, coords: [54.7826, 31.9340], media: { fact_text: "Город-щит на западных рубежах России." }, economy_override: { hotel_cost: 300, excursion_cost: 150 } },
        { id: "tambov", name: "Тамбов", tier: 1, coords: [52.7316, 41.4432], media: { fact_text: "Тамбовский волк тебе товарищ!" }, economy_override: { hotel_cost: 250, excursion_cost: 100 } },
        { id: "tver", name: "Тверь", tier: 1, coords: [56.8596, 35.9118], media: { fact_text: "Город между Москвой и Петербургом." }, economy_override: { hotel_cost: 350, excursion_cost: 150 } },
        { id: "tula", name: "Тула", tier: 1, coords: [54.1931, 37.6173], media: { fact_text: "Пряники, самовары, оружие." }, economy_override: { hotel_cost: 400, excursion_cost: 200 } },
        { id: "yaroslavl", name: "Ярославль", tier: 1, coords: [57.6265, 39.8938], media: { fact_text: "Столица Золотого кольца." }, economy_override: { hotel_cost: 450, excursion_cost: 250 } },

        // ================= УРОВЕНЬ 2 (Золотое кольцо / Крупные узлы) =================
        { id: "sergiev_posad", name: "Сергиев Посад", tier: 2, coords: [56.3000, 38.1333], media: { fact_text: "Троице-Сергиева Лавра." }, economy_override: { hotel_cost: 350, excursion_cost: 150 } },
        { id: "pereslavl", name: "Переславль-Залесский", tier: 2, coords: [56.7388, 38.8559], media: { fact_text: "Родина потешного флота Петра I." }, economy_override: { hotel_cost: 300, excursion_cost: 150 } },
        { id: "rostov_velikiy", name: "Ростов Великий", tier: 2, coords: [57.1866, 39.4144], media: { fact_text: "Ростовская финифть и звонницы." }, economy_override: { hotel_cost: 300, excursion_cost: 100 } },
        { id: "suzdal", name: "Суздаль", tier: 2, coords: [56.4194, 40.4494], media: { fact_text: "Город-заповедник." }, economy_override: { hotel_cost: 450, excursion_cost: 200 } },
        { id: "uglich", name: "Углич", tier: 2, coords: [57.5272, 38.3314], media: { fact_text: "Место гибели царевича Дмитрия." }, economy_override: { hotel_cost: 300, excursion_cost: 100 } },
        { id: "alexandrov", name: "Александров", tier: 2, coords: [56.3986, 38.7180], media: { fact_text: "Александровская слобода." }, economy_override: { hotel_cost: 250, excursion_cost: 100 } },
        { id: "murom", name: "Муром", tier: 2, coords: [55.5786, 42.0467], media: { fact_text: "Родина Ильи Муромца." }, economy_override: { hotel_cost: 300, excursion_cost: 150 } },
        { id: "gorohovec", name: "Гороховец", tier: 2, coords: [56.2052, 42.6749], media: { fact_text: "Купеческие палаты." }, economy_override: { hotel_cost: 250, excursion_cost: 100 } },
        { id: "ples", name: "Плёс", tier: 2, coords: [57.4589, 41.5161], media: { fact_text: "Русская Швейцария на Волге." }, economy_override: { hotel_cost: 600, excursion_cost: 200 } }, // Плес очень дорогой!

        // ================= УРОВЕНЬ 3 (Скрытые локации - не видны на старте) =================
        { id: "myshkin", name: "Мышкин", tier: 3, coords: [57.7889, 38.4552], media: { fact_text: "Город мышей и уютных музеев." }, economy_override: { hotel_cost: 0, excursion_cost: 0 } },
        { id: "borovsk", name: "Боровск", tier: 3, coords: [55.2058, 36.4866], media: { fact_text: "Город фресок и старообрядцев." }, economy_override: { hotel_cost: 0, excursion_cost: 0 } },
        { id: "tarusa", name: "Таруса", tier: 3, coords: [54.7271, 37.1811], media: { fact_text: "Приют поэтов Цветаевой и Паустовского." }, economy_override: { hotel_cost: 0, excursion_cost: 0 } },
        { id: "izborsk", name: "Изборск", tier: 3, coords: [57.7088, 27.8605], media: { fact_text: "Древнейшая крепость." }, economy_override: { hotel_cost: 0, excursion_cost: 0 } },
        { id: "pechory", name: "Печоры", tier: 3, coords: [57.8171, 27.6063], media: { fact_text: "Монастырь в пещерах." }, economy_override: { hotel_cost: 0, excursion_cost: 0 } },
        { id: "staritsa", name: "Старица", tier: 3, coords: [56.5103, 34.9355], media: { fact_text: "Город белого камня и пещер." }, economy_override: { hotel_cost: 0, excursion_cost: 0 } },
        { id: "torzhok", name: "Торжок", tier: 3, coords: [57.0406, 34.9582], media: { fact_text: "Пожарские котлеты и золотошвеи." }, economy_override: { hotel_cost: 0, excursion_cost: 0 } },
        { id: "vishniy_volochek", name: "Вышний Волочёк", tier: 3, coords: [57.5878, 34.5627], media: { fact_text: "Русская Венеция." }, economy_override: { hotel_cost: 0, excursion_cost: 0 } },
        { id: "kasimov", name: "Касимов", tier: 3, coords: [54.9406, 41.3951], media: { fact_text: "Столица татарского ханства в лесах." }, economy_override: { hotel_cost: 0, excursion_cost: 0 } },
        { id: "rylsk", name: "Рыльск", tier: 3, coords: [51.5661, 34.6822], media: { fact_text: "Красивый купеческий город." }, economy_override: { hotel_cost: 0, excursion_cost: 0 } },
        { id: "yelets", name: "Елец", tier: 3, coords: [52.6245, 38.5042], media: { fact_text: "Кружева и модерн." }, economy_override: { hotel_cost: 0, excursion_cost: 0 } },
        { id: "zadonsk", name: "Задонск", tier: 3, coords: [52.3900, 38.9248], media: { fact_text: "Русский Иерусалим." }, economy_override: { hotel_cost: 0, excursion_cost: 0 } },
        { id: "dmitrov", name: "Дмитров", tier: 3, coords: [56.3435, 39.5226], media: { fact_text: "Земляные валы." }, economy_override: { hotel_cost: 0, excursion_cost: 0 } },
        { id: "zaraysk", name: "Зарайск", tier: 3, coords: [54.7579, 38.8778], media: { fact_text: "Самый сохранившийся малый кремль." }, economy_override: { hotel_cost: 0, excursion_cost: 0 } },
        { id: "kozelsk", name: "Козельск", tier: 3, coords: [54.0333, 35.7833], media: { fact_text: "Город злой, рядом Оптина пустынь." }, economy_override: { hotel_cost: 0, excursion_cost: 0 } },
        { id: "chekalin", name: "Чекалин", tier: 3, coords: [54.0988, 36.2486], media: { fact_text: "Самый маленький город России." }, economy_override: { hotel_cost: 0, excursion_cost: 0 } }
    ],

    init: async function() { console.log("База ЦФО загружена."); }
};