import client from './redisClient.js';

const TTL = Number(process.env.SESSION_TTL_SECONDS || 1209600);

const key = (id) => `bgaudit:session:${id}`;

export async function saveSession(id, data) {
  await client.set(key(id), JSON.stringify(data), { EX: TTL });
}

export async function getSession(id) {
  const str = await client.get(key(id));
  return str ? JSON.parse(str) : null;
}

export async function deleteSession(id) {
  await client.del(key(id));
}