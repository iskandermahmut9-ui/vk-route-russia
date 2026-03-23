import { Game } from './core/game.js';

// Делаем Game глобальным, чтобы HTML-кнопки с onclick="Game.buyItem(...)" продолжали работать!
window.Game = Game; 

document.addEventListener('DOMContentLoaded', () => {
    Game.init();
});