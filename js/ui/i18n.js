import { translateText } from '../services/task.js';

export async function renderTranslatedText(element, text, originalLanguage) {
    const userLanguage = localStorage.getItem('actionPadLanguage') || 'en';
    if (originalLanguage && originalLanguage !== userLanguage) {
        element.textContent = 'Translating...';
        try {
            const translatedText = await translateText(text, userLanguage);
            element.textContent = translatedText;
            element.title = `Original: ${text}`;
        } catch (e) {
            element.textContent = text;
        }
    } else {
        element.textContent = text;
    }
}
