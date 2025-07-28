require('dotenv').config();
const { kv } = require('@vercel/kv');

async function updateReleaseTime() {
  const now = new Date().toISOString();
  try {
    await kv.set('releaseTime', now);
    console.log(`✅ Release time updated in Vercel KV to: ${now}`);
  } catch (error) {
    console.error('❌ Failed to update release time in Vercel KV:', error);
    process.exit(1); // Выходим с ошибкой, чтобы остановить процесс деплоя
  }
}

updateReleaseTime(); 