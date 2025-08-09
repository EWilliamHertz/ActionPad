const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY"; // IMPORTANT: Replace with your actual key and secure it!

export const translateText = async (text, targetLanguage) => {
    if (!text || !targetLanguage) return text;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
    const prompt = `Translate this text to ${targetLanguage}: "${text}"`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const data = await response.json();
        return data.candidates[0].content.parts[0].text.trim();
    } catch (error) {
        console.error('Failed to fetch translation:', error);
        return text;
    }
};

export const generateSubtasksAI = async (taskName, taskDescription) => {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
    const prompt = `You are a project management assistant. Break down the following task into a short, actionable list of subtasks.
    Task Name: "${taskName}"
    Description: "${taskDescription || 'No description'}"
    Respond ONLY with a JavaScript-style array of strings, like this: ["First subtask", "Second subtask", "Third subtask"]`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(`AI API error: ${response.status} - ${errorBody.error.message}`);
        }
        const data = await response.json();
        const rawText = data.candidates[0].content.parts[0].text;

        const jsonText = rawText.replace(/`/g, '').replace('javascript', '').trim();
        const subtasks = JSON.parse(jsonText);
        return subtasks.map(text => ({ text, isCompleted: false }));

    } catch (error) {
        console.error('Failed to generate subtasks with AI:', error);
        throw error;
    }
};
