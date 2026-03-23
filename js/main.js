import { Game } from './core/game.js';

// Делаем Game глобальным, чтобы HTML-кнопки с onclick="Game.buyItem(...)" продолжали работать!
window.Game = Game; 

// Вызываем инициализацию напрямую, без addEventListener
Game.init();