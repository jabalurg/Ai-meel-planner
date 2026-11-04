const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const host = '127.0.0.1';
const port = 4173;
const root = __dirname;
const publicFiles = new Set(['index.html', 'planner.html', 'styles.css', 'app.js', 'planner.js']);
const recentRequests = new Map();
let dailyCount = 0;
let dailyWindowStart = Date.now();
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

const server = http.createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, `http://${host}:${port}`).pathname);
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }

  if (pathname === '/api/meal-plan') {
    if (request.method !== 'POST') {
      response.writeHead(405, { Allow: 'POST' }).end();
      return;
    }
    generateMealPlan(request, response);
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!publicFiles.has(relativePath)) {
    response.writeHead(404).end('Not found');
    return;
  }

  const filePath = path.join(root, relativePath);
  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(404).end('Not found');
      return;
    }

    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(filePath)],
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    });
    response.end(request.method === 'HEAD' ? undefined : contents);
  });
});

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(body));
}

function generateMealPlan(request, response) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json(response, 503, { error: 'OpenAI не настроен. Перезапустите сервер через start-with-ai.ps1 и введите API-ключ.' });
  const address = request.headers['cf-connecting-ip'] || request.socket.remoteAddress || 'unknown';
  const now = Date.now();
  if (now - dailyWindowStart >= 24 * 60 * 60 * 1000) { dailyWindowStart = now; dailyCount = 0; recentRequests.clear(); }
  const previous = recentRequests.get(address) || [];
  const active = previous.filter((time) => now - time < 60 * 60 * 1000);
  if (active.length >= 3 || dailyCount >= 20) return json(response, 429, { error: 'Лимит генераций достигнут. Попробуйте позже.' });

  let size = 0;
  const chunks = [];
  request.on('data', (chunk) => {
    size += chunk.length;
    if (size > 8192) { request.destroy(); }
    else chunks.push(chunk);
  });
  request.on('end', async () => {
    try {
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const profile = validateProfile(data);
      if (!profile) return json(response, 400, { error: 'Проверьте введённые данные.' });
      recentRequests.set(address, [...active, now]);
      dailyCount += 1;
      const prompt = `Create a practical one-day meal plan in Russian. Give 3 meals and 1 optional snack, with approximate calories and protein per meal, concise ingredients and preparation. Respect the goal, diet preference and allergies. Target about ${profile.calories} kcal; do not promise exact values. If allergies are listed, avoid those ingredients and remind user to check labels. Include a short non-medical disclaimer. User profile: ${JSON.stringify(profile)}.`;
      const result = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-5.4-mini', input: prompt, max_output_tokens: 1400 }),
        signal: AbortSignal.timeout(60000),
      });
      const payload = await result.json();
      if (!result.ok) {
        const code = payload?.error?.code || payload?.error?.type || '';
        let errorMessage = 'OpenAI отклонил запрос. Проверьте настройки API и попробуйте ещё раз.';
        if (result.status === 401) errorMessage = 'OpenAI не принял API-ключ. Создайте новый ключ и запустите сервер с ним.';
        else if (result.status === 429 && /quota|billing|credit_balance|hard_limit/i.test(code)) errorMessage = 'На API-аккаунте нет доступных кредитов или достигнут лимит расходов. Проверьте оплату и лимиты OpenAI API.';
        else if (result.status === 429) errorMessage = 'Превышен лимит запросов OpenAI. Подождите немного и попробуйте снова.';
        else if (result.status === 403) errorMessage = 'У API-ключа нет доступа к выбранной модели или проекту. Проверьте настройки проекта OpenAI.';
        else if (result.status === 404) errorMessage = 'Выбранная модель недоступна для этого API-проекта. Проверьте доступ к моделям OpenAI.';
        else if (result.status >= 500) errorMessage = 'Сервис OpenAI временно недоступен. Попробуйте позже.';
        return json(response, 502, { error: errorMessage });
      }
      const text = (payload.output || []).flatMap((item) => item.content || []).filter((part) => part.type === 'output_text').map((part) => part.text).join('\n').trim();
      if (!text) return json(response, 502, { error: 'Не удалось прочитать ответ OpenAI. Попробуйте ещё раз.' });
      return json(response, 200, { plan: text });
    } catch (error) {
      return json(response, error instanceof SyntaxError ? 400 : 502, { error: error instanceof SyntaxError ? 'Некорректные данные.' : 'Ошибка связи с OpenAI. Попробуйте позже.' });
    }
  });
}

function validateProfile(data) {
  if (!data || typeof data !== 'object') return null;
  const age = Number(data.age), height = Number(data.height), weight = Number(data.weight);
  const sex = ['female', 'male'].includes(data.sex) ? data.sex : null;
  const activity = { low: 1.2, light: 1.375, moderate: 1.55, high: 1.725 }[data.activity];
  const goalAdjustment = { lose: -300, maintain: 0, gain: 200 }[data.goal];
  const diet = ['balanced', 'vegetarian', 'vegan', 'pescatarian', 'low-carb'].includes(data.diet) ? data.diet : null;
  if (!Number.isInteger(age) || age < 19 || age > 78 || height < 120 || height > 230 || weight < 35 || weight > 250 || !sex || !activity || goalAdjustment === undefined || !diet) return null;
  const bmr = (10 * weight) + (6.25 * height) - (5 * age) + (sex === 'male' ? 5 : -161);
  const calories = Math.max(1200, Math.round((bmr * activity + goalAdjustment) / 50) * 50);
  return { age, height, weight, sex, activity: data.activity, goal: data.goal, diet, calories, allergies: String(data.allergies || '').slice(0, 240) };
}

server.listen(port, host, () => {
  console.log(`MealMate is available at http://localhost:${port}/`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
