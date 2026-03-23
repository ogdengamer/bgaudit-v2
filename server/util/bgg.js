import { parseStringPromise } from 'xml2js';

const BGG_LOGIN_URL = 'https://boardgamegeek.com/login/api/v1';
const BGG_COLLECTION_URL = 'https://boardgamegeek.com/xmlapi2/collection';

// Log in to BGG and return a cookie string we can use for authenticated requests
async function getBGGCookie(username, password) {
  const response = await fetch(BGG_LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credentials: { username, password } })
  });

  if (!response.ok) {
    throw new Error('BGG login failed — check your username and password');
  }

  // BGG sets cookies twice — once valid, once deleted. We want only the valid ones.
  // A deleted cookie has "Expires=Thu, 01 Jan 1970" in it (Unix epoch)
  const rawCookies = response.headers.getSetCookie();
  const validCookies = rawCookies
    .filter(c => !c.includes('01 Jan 1970') && !c.includes('expires=Thu, 01-Jan-1970'))
    .map(c => c.split(';')[0]);  // keep only the name=value part, drop the directives

  if (validCookies.length === 0) {
    throw new Error('BGG login did not return valid session cookies');
  }

  return validCookies.join('; ');
}

// Fetch the collection from BGG XML API, retrying if BGG returns 202 (still queuing)
async function fetchWithRetry(url, headers, maxAttempts = 5, delayMs = 3000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(url, { headers });

    if (response.status === 200) {
      return await response.text();
    }

    if (response.status === 202) {
      // BGG queues large requests — 202 means "try again in a moment"
      console.log(`BGG returned 202, attempt ${attempt}/${maxAttempts} — retrying in ${delayMs}ms`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      continue;
    }

    throw new Error(`BGG collection request failed with status ${response.status}`);
  }

  throw new Error('BGG collection request timed out after multiple attempts');
}

// Parse the BGG XML response and extract the fields we need
async function parseCollection(xml) {
  const parsed = await parseStringPromise(xml, { explicitArray: false });
  const items = parsed?.items?.item;

  if (!items) return [];

  // xml2js gives us a single object if there's one item, array if multiple
  const itemArray = Array.isArray(items) ? items : [items];

  return itemArray.map(item => ({
    id: item.$.objectid,
    name: item.name?._ ?? item.name ?? '',
    location: item.privateinfo?.$?.invlocation ?? ''
  }));
}

// Main export — fetches a BGG collection with private fields using username/password auth
export async function fetchBGGCollection(username, password) {
  if (!username || !password) {
    throw new Error('Username and password are required');
  }

  const cookie = await getBGGCookie(username, password);

  const url = `${BGG_COLLECTION_URL}?username=${encodeURIComponent(username)}&own=1&showprivate=1`;

  const xml = await fetchWithRetry(url, {
    'Cookie': cookie,
    'User-Agent': 'bgaudit/1.0 (personal shelf audit tool)'
  });

  return await parseCollection(xml);
}