// Verifies BGG_API_TOKEN works by fetching a public game (Catan, id 13).
// Run in the container: docker compose exec app npm run check-bgg-token
import { fetchWithRetry, bggApiHeaders } from '../util/bgg.js';

try {
  const xml = await fetchWithRetry('https://boardgamegeek.com/xmlapi2/thing?id=13', bggApiHeaders());
  const name = xml.match(/<name type="primary"[^>]*value="([^"]+)"/)?.[1];
  console.log(`BGG token OK (fetched "${name ?? 'unknown'}")`);
} catch (err) {
  console.error(`BGG token check failed: ${err.message}`);
  process.exit(1);
}
