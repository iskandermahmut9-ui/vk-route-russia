export const marketItems = {
    // Тир 1: Крупные города (Дешевый ширпотреб, маленькая наценка)
    1: [
        { id: "smartphone", name: "Партия Смартфонов", icon: "📱", basePrice: 200, profitMult: 0.5 },
        { id: "clothes", name: "Брендовая одежда", icon: "👕", basePrice: 150, profitMult: 0.6 },
        { id: "tools", name: "Стройматериалы", icon: "🧱", basePrice: 100, profitMult: 0.4 },
        { id: "coffee", name: "Зерновой кофе", icon: "☕", basePrice: 120, profitMult: 0.5 }
    ],
    // Тир 2: Средние города (Региональный колорит, хорошая наценка)
    2: [
        { id: "honey", name: "Бочонок Меда", icon: "🍯", basePrice: 300, profitMult: 1.2 },
        { id: "crystal", name: "Хрустальная ваза", icon: "🏺", basePrice: 400, profitMult: 1.5 },
        { id: "fish", name: "Копченая рыба", icon: "🐟", basePrice: 250, profitMult: 1.0 },
        { id: "samovar", name: "Резной Самовар", icon: "🫖", basePrice: 500, profitMult: 1.6 }
    ],
    // Тир 3: Скрытые города (Уникальные артефакты, огромная прибыль)
    3: [
        { id: "amber", name: "Кусок Янтаря", icon: "💎", basePrice: 1000, profitMult: 3.0 },
        { id: "meteorite", name: "Осколок метеорита", icon: "☄️", basePrice: 1500, profitMult: 4.0 },
        { id: "manuscript", name: "Древняя летопись", icon: "📜", basePrice: 2000, profitMult: 5.0 }
    ]
};