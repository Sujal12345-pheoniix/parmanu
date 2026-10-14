import app from '../server';
import http from 'http';

async function verify() {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(3002, () => resolve()));
  console.log('Test server listening on port 3002');

  try {
    // 1. Test Health
    const resHealth = await fetch('http://localhost:3002/api/v1/health');
    const health = await resHealth.json();
    console.log('✅ Health status:', health.status, 'DB:', health.services.database.status);

    // 2. Test News Feed
    const resFeed = await fetch('http://localhost:3002/api/v1/source-items?limit=3');
    const feed = await resFeed.json();
    console.log(`✅ News feed items returned: ${feed.data.length}, total in DB: ${feed.meta.total}`);
    console.log(`   Sample headline: "${feed.data[0].headline}"`);
    console.log(`   Provenance: ${feed.data[0].provenanceState} from ${feed.data[0].source.name}`);

    // 3. Test Categories
    const resCat = await fetch('http://localhost:3002/api/v1/source-items?category=India&limit=2');
    const cat = await resCat.json();
    console.log(`✅ Category query 'India': ${cat.data.length} articles`);

    // 4. Test Static Frontend UI
    const resUi = await fetch('http://localhost:3002/');
    const uiText = await resUi.text();
    console.log(`✅ Static Web UI loaded: ${uiText.includes('PARMANU') ? 'OK' : 'FAILED'} (${uiText.length} bytes)`);

  } finally {
    server.close();
  }
}

verify().catch((e) => {
  console.error('API verification failed:', e);
  process.exit(1);
});
