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
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const provider = geminiKey ? 'gemini' : openaiKey ? 'openai' : null;
  const apiKey = geminiKey || openaiKey;
  const address = request.headers['cf-connecting-ip'] || request.socket.remoteAddress || 'unknown';
  const now = Date.now();
  if (now - dailyWindowStart >= 24 * 60 * 60 * 1000) { dailyWindowStart = now; dailyCount = 0; recentRequests.clear(); }
  const previous = recentRequests.get(address) || [];
  const active = previous.filter((time) => now - time < 60 * 60 * 1000);

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
      if (!apiKey) return json(response, 200, { plan: buildLocalPlan(profile), mode: 'local' });
      if (active.length >= 3 || dailyCount >= 20) return json(response, 200, { plan: buildLocalPlan(profile), mode: 'local', notice: 'Лимит запросов ИИ достигнут. Показан локальный вариант меню без ИИ.' });
      recentRequests.set(address, [...active, now]);
      dailyCount += 1;
      const prompt = `Create a practical one-day meal plan in Russian. Give 3 meals and 1 optional snack, with approximate calories and protein per meal, concise ingredients and preparation. Respect the goal, diet preference and allergies. Target about ${profile.calories} kcal; do not promise exact values. If allergies are listed, avoid those ingredients and remind user to check labels. Include a short non-medical disclaimer. User profile: ${JSON.stringify(profile)}.`;
      const result = provider === 'gemini'
        ? await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent', {
          method: 'POST',
          headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 1400 } }),
          signal: AbortSignal.timeout(60000),
        })
        : await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'gpt-5.4-mini', input: prompt, max_output_tokens: 1400 }),
          signal: AbortSignal.timeout(60000),
        });
      const payload = await result.json();
      if (!result.ok) {
        const code = [payload?.error?.code, payload?.error?.type, payload?.error?.status].filter(Boolean).join(' ');
        const service = provider === 'gemini' ? 'Gemini' : 'OpenAI';
        let errorMessage = `${service} отклонил запрос или исчерпан лимит. Показан локальный вариант меню без ИИ.`;
        if (result.status === 401 || result.status === 403) errorMessage = `${service} не принял ключ или у него нет доступа. Показан локальный вариант меню без ИИ.`;
        else if (result.status === 429 && /quota|billing|credit_balance|hard_limit|resource_exhausted/i.test(code)) errorMessage = `У ${service} исчерпан бесплатный лимит или кредиты. Показан локальный вариант меню без ИИ.`;
        else if (result.status === 429) errorMessage = `Достигнут лимит запросов ${service}. Показан локальный вариант меню без ИИ.`;
        else if (result.status === 404) errorMessage = `Модель ${service} недоступна для этого проекта. Показан локальный вариант меню без ИИ.`;
        else if (result.status >= 500) errorMessage = `${service} временно недоступен. Показан локальный вариант меню без ИИ.`;
        return json(response, 200, { plan: buildLocalPlan(profile), mode: 'local', notice: errorMessage });
      }
      const text = provider === 'gemini'
        ? (payload.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('\n').trim()
        : (payload.output || []).flatMap((item) => item.content || []).filter((part) => part.type === 'output_text').map((part) => part.text).join('\n').trim();
      if (!text) return json(response, 200, { plan: buildLocalPlan(profile), mode: 'local', notice: `Не удалось прочитать ответ ${provider === 'gemini' ? 'Gemini' : 'OpenAI'}. Показан локальный вариант меню.` });
      return json(response, 200, { plan: text, mode: 'ai', provider });
    } catch (error) {
      return json(response, error instanceof SyntaxError ? 400 : 502, { error: error instanceof SyntaxError ? 'Некорректные данные.' : `Ошибка связи с ${provider === 'gemini' ? 'Gemini' : 'OpenAI'}. Попробуйте позже.` });
    }
  });
}

const localRecipes = [
  { slot: 'breakfast', name: 'Овсяная каша с бананом', kcal: 390, protein: 12, diets: ['balanced', 'vegetarian', 'vegan', 'pescatarian'], allergens: ['gluten'], ingredients: 'овсяные хлопья, банан, растительное молоко', prep: 'Сварить хлопья и добавить нарезанный банан.' },
  { slot: 'breakfast', name: 'Омлет с овощами', kcal: 360, protein: 23, diets: ['balanced', 'vegetarian', 'pescatarian', 'low-carb'], allergens: ['eggs'], ingredients: 'яйца, томаты, шпинат', prep: 'Приготовить яйца с овощами на сковороде.' },
  { slot: 'breakfast', name: 'Тофу-скрэмбл с томатами', kcal: 340, protein: 24, diets: ['balanced', 'vegetarian', 'vegan', 'pescatarian', 'low-carb'], allergens: ['soy'], ingredients: 'тофу, томаты, шпинат', prep: 'Раскрошить тофу и обжарить с овощами.' },
  { slot: 'breakfast', name: 'Йогурт с ягодами и семенами', kcal: 330, protein: 20, diets: ['balanced', 'vegetarian', 'pescatarian', 'low-carb'], allergens: ['dairy'], ingredients: 'греческий йогурт, ягоды, семена чиа', prep: 'Смешать йогурт с ягодами и семенами.' },
  { slot: 'breakfast', name: 'Чиа-пудинг с ягодами', kcal: 350, protein: 10, diets: ['balanced', 'vegetarian', 'vegan', 'pescatarian', 'low-carb'], allergens: [], ingredients: 'семена чиа, кокосовый напиток, ягоды', prep: 'Заранее замочить чиа в кокосовом напитке и добавить ягоды.' },
  { slot: 'lunch', name: 'Чечевичный боул с овощами', kcal: 560, protein: 27, diets: ['balanced', 'vegetarian', 'vegan', 'pescatarian'], allergens: [], ingredients: 'чечевица, огурец, томат, зелень', prep: 'Отварить чечевицу и подать с нарезанными овощами.' },
  { slot: 'lunch', name: 'Курица с киноа и овощами', kcal: 590, protein: 44, diets: ['balanced'], allergens: [], ingredients: 'куриная грудка, киноа, кабачок, перец', prep: 'Запечь курицу и овощи, подать с отварной киноа.' },
  { slot: 'lunch', name: 'Салат с тунцом и яйцом', kcal: 510, protein: 38, diets: ['balanced', 'pescatarian', 'low-carb'], allergens: ['fish', 'eggs'], ingredients: 'тунец, яйцо, листья салата, огурец', prep: 'Смешать тунец с яйцом и свежими овощами.' },
  { slot: 'lunch', name: 'Нут с овощами и тахини', kcal: 540, protein: 22, diets: ['balanced', 'vegetarian', 'vegan', 'pescatarian'], allergens: ['sesame'], ingredients: 'нут, томаты, огурец, тахини', prep: 'Смешать готовый нут с овощами и соусом тахини.' },
  { slot: 'lunch', name: 'Тофу с гречкой и овощами', kcal: 520, protein: 29, diets: ['balanced', 'vegetarian', 'vegan', 'pescatarian'], allergens: ['soy'], ingredients: 'тофу, гречка, брокколи, морковь', prep: 'Обжарить тофу с овощами и подать с гречкой.' },
  { slot: 'lunch', name: 'Тофу-салат с овощами', kcal: 440, protein: 28, diets: ['balanced', 'vegetarian', 'vegan', 'pescatarian', 'low-carb'], allergens: ['soy'], ingredients: 'тофу, листья салата, огурец, томаты', prep: 'Нарезать тофу и смешать со свежими овощами.' },
  { slot: 'dinner', name: 'Лосось с брокколи', kcal: 540, protein: 39, diets: ['balanced', 'pescatarian', 'low-carb'], allergens: ['fish'], ingredients: 'лосось, брокколи, лимон', prep: 'Запечь рыбу и брокколи с лимоном.' },
  { slot: 'dinner', name: 'Курица с овощами', kcal: 500, protein: 43, diets: ['balanced', 'low-carb'], allergens: [], ingredients: 'куриная грудка, кабачок, перец, томаты', prep: 'Запечь курицу с сезонными овощами.' },
  { slot: 'dinner', name: 'Карри из нута', kcal: 530, protein: 21, diets: ['balanced', 'vegetarian', 'vegan', 'pescatarian'], allergens: [], ingredients: 'нут, томаты, кокосовое молоко, шпинат', prep: 'Потушить нут с томатами, кокосовым молоком и специями.' },
  { slot: 'dinner', name: 'Тофу с овощами', kcal: 480, protein: 30, diets: ['balanced', 'vegetarian', 'vegan', 'pescatarian', 'low-carb'], allergens: ['soy'], ingredients: 'тофу, брокколи, сладкий перец', prep: 'Быстро обжарить тофу и овощи.' },
  { slot: 'snack', name: 'Яблоко с миндалём', kcal: 210, protein: 5, diets: ['balanced', 'vegetarian', 'vegan', 'pescatarian', 'low-carb'], allergens: ['nuts'], ingredients: 'яблоко, миндаль', prep: 'Подать яблоко с небольшой порцией миндаля.' },
  { slot: 'snack', name: 'Творог с ягодами', kcal: 220, protein: 24, diets: ['balanced', 'vegetarian', 'pescatarian', 'low-carb'], allergens: ['dairy'], ingredients: 'творог, ягоды', prep: 'Смешать творог с ягодами.' },
  { slot: 'snack', name: 'Хумус с огурцом', kcal: 190, protein: 7, diets: ['balanced', 'vegetarian', 'vegan', 'pescatarian'], allergens: ['sesame'], ingredients: 'хумус, огурец, морковь', prep: 'Подать хумус с нарезанными овощами.' },
  { slot: 'snack', name: 'Эдамаме', kcal: 180, protein: 17, diets: ['balanced', 'vegetarian', 'vegan', 'pescatarian', 'low-carb'], allergens: ['soy'], ingredients: 'эдамаме, немного соли', prep: 'Отварить эдамаме и слегка посолить.' },
  { slot: 'snack', name: 'Банан и ягоды', kcal: 170, protein: 3, diets: ['balanced', 'vegetarian', 'vegan', 'pescatarian'], allergens: [], ingredients: 'банан, ягоды', prep: 'Подать свежий фрукт с ягодами.' },
];

function allergyCategories(value) {
  const text = String(value || '').toLowerCase();
  const groups = {
    nuts: ['орех', 'арахис', 'миндал', 'фундук', 'кешью', 'nut', 'peanut', 'almond'],
    dairy: ['молок', 'молоч', 'лактоз', 'сыр', 'творог', 'йогурт', 'dairy', 'milk', 'cheese'],
    eggs: ['яйц', 'egg'], gluten: ['глют', 'пшениц', 'мук', 'овёс', 'овсян', 'хлеб', 'gluten', 'wheat'],
    fish: ['рыб', 'лосос', 'тунец', 'fish', 'salmon', 'tuna'],
    soy: ['соя', 'тофу', 'эдамаме', 'soy', 'tofu'],
    sesame: ['кунжут', 'тахин', 'sesame'],
    shellfish: ['кревет', 'крев', 'морепродукт', 'shrimp', 'shellfish'],
  };
  return Object.entries(groups).filter(([, terms]) => terms.some((term) => text.includes(term))).map(([category]) => category);
}

function buildLocalPlan(profile) {
  const allergySet = allergyCategories(profile.allergies);
  const blockedText = String(profile.allergies || '').toLowerCase().split(/[,;]+/).map((item) => item.trim()).filter(Boolean);
  const slots = [
    { id: 'breakfast', label: 'Завтрак', share: 0.25 },
    { id: 'lunch', label: 'Обед', share: 0.35 },
    { id: 'dinner', label: 'Ужин', share: 0.3 },
    { id: 'snack', label: 'Перекус', share: 0.1 },
  ];
  const lines = ['ЛОКАЛЬНЫЙ ВАРИАНТ — составлен по набору рецептов без ИИ.', `Цель: около ${profile.calories} ккал в день. Калории и белок примерные.`, ''];
  let total = 0;
  for (const slot of slots) {
    const options = localRecipes.filter((recipe) => recipe.slot === slot.id && recipe.diets.includes(profile.diet)
      && !recipe.allergens.some((allergen) => allergySet.includes(allergen))
      && !blockedText.some((term) => `${recipe.name} ${recipe.ingredients}`.toLowerCase().includes(term)));
    if (!options.length) return 'Не удалось подобрать локальное меню с такими ограничениями. Уточните список продуктов, которых нужно избегать, или выберите другой тип питания.';
    const target = profile.calories * slot.share;
    const recipe = options.reduce((best, current) => Math.abs(current.kcal - target) < Math.abs(best.kcal - target) ? current : best);
    const factor = Math.max(0.7, Math.min(1.4, target / recipe.kcal));
    const kcal = Math.round(recipe.kcal * factor / 10) * 10;
    const protein = Math.round(recipe.protein * factor);
    total += kcal;
    lines.push(`${slot.label}: ${recipe.name} — ~${kcal} ккал, белок ~${protein} г. ${recipe.prep}`);
  }
  lines.push('', `Итого по этому примеру: около ${total} ккал.`, 'План ориентировочный, не медицинская рекомендация. При аллергии обязательно проверяйте состав и возможные следы на упаковке.');
  return lines.join('\n');
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
