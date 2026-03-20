window.Data = {
    // Гаражи (Разделены по сложности)
    garages: {
        normal: [
            { id: "sedan", name: "Современный Седан", tank: 50, cons: 8, hpLoss: 0.8 },
            { id: "suv", name: "Современный Внедорожник", tank: 80, cons: 12, hpLoss: 0.3 },
            { id: "camper", name: "Автодом", tank: 70, cons: 15, hpLoss: 0.5 }
        ],
        hard: [
            { id: "lada", name: "ВАЗ 2107", tank: 40, cons: 10, hpLoss: 2.0 },
            { id: "uaz", name: "УАЗ Буханка", tank: 75, cons: 16, hpLoss: 1.5 },
            { id: "gazel", name: "Старая Газель", tank: 60, cons: 18, hpLoss: 1.8 }
        ],
        ultra: [
            { id: "bike", name: "Велосипед", tank: 0, cons: 0, hpLoss: 0.1 } // Особая логика в движке
        ]
    },

    // Стоимость 100% восполнения ресурса (зависит от уровня города)
    prices: {
        1: { hotel: 800, food: 600, repair: 500, gasPerLiter: 55, exc: 300 },
        2: { hotel: 500, food: 400, repair: 300, gasPerLiter: 50, exc: 150 },
        3: { hotel: 0, food: 200, repair: 0, gasPerLiter: 0, exc: 0 } // Глухомань
    },

    // Города ЦФО
    cities: [
        { id: "moscow", name: "Москва", tier: 1, coords: [55.7558, 37.6173], fact: "Столица России.", quests: [{q: "Год основания?", a: ["1147", "1242", "1380"], right: 0}] },
        { id: "tula", name: "Тула", tier: 1, coords: [54.1931, 37.6173], fact: "Оружейная столица.", quests: [{q: "Знаменитый тульский продукт?", a: ["Пряник", "Чак-чак", "Пастила"], right: 0}] },
        { id: "vladimir", name: "Владимир", tier: 1, coords: [56.1290, 40.4066], fact: "Древняя столица.", quests: [{q: "Главные ворота?", a: ["Золотые", "Серебряные", "Медные"], right: 0}] },
        { id: "suzdal", name: "Суздаль", tier: 2, coords: [56.4194, 40.4494], fact: "Город-музей.", quests: [{q: "Какой напиток здесь популярен?", a: ["Медовуха", "Квас", "Сбитень"], right: 0}] },
        { id: "tarusa", name: "Таруса", tier: 3, coords: [54.7271, 37.1811], fact: "Город поэтов.", quests: [{q: "Река в Тарусе?", a: ["Ока", "Волга", "Дон"], right: 0}] }
    ]
};