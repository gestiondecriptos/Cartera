// Claves de API opcionales: se leen de js/config.js (API_KEYS) o, en GitHub Actions, de los «Secrets» (variables de entorno).
import { API_KEYS } from './config.js';

export const getKey = name => API_KEYS[name] || (typeof process !== 'undefined' && process.env?.[name]) || '';
