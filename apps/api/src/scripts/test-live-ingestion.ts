import { prisma } from '../prisma/client';
import { IngestionService } from '../ingestion/ingestion.service';

async function main() {
  console.log('🔄 Testing live ingestion against real RSS data sources...');
  const ingestionService = new IngestionService();

  // Find The Hindu source
  const theHindu = await prisma.newsSource.findUnique({
    where: { slug: 'the-hindu' },
  });

  if (!theHindu) {
    throw new Error('The Hindu news source not found in database');
  }

  console.log(`📡 Ingesting from: ${theHindu.name} (${theHindu.feedUrl})`);
  const resultHindu = await ingestionService.ingestSource(theHindu);
  console.log('📊 Result The Hindu:', resultHindu);

  // Find NDTV source
  const ndtv = await prisma.newsSource.findUnique({
    where: { slug: 'ndtv-news' },
  });

  if (ndtv) {
    console.log(`📡 Ingesting from: ${ndtv.name} (${ndtv.feedUrl})`);
    const resultNdtv = await ingestionService.ingestSource(ndtv);
    console.log('📊 Result NDTV:', resultNdtv);
  }

  // Verify stored items in database
  const count = await prisma.sourceItem.count();
  const sampleItems = await prisma.sourceItem.findMany({
    take: 5,
    orderBy: { publishedAt: 'desc' },
    include: { source: true },
  });

  console.log(`\n✅ Total real source items currently in database: ${count}`);
  console.log('📰 Sample ingested genuine articles:');
  for (const item of sampleItems) {
    console.log(` - [${item.provenanceState}] [${item.source.name}] "${item.headline}"`);
    console.log(`   URL: ${item.canonicalUrl}`);
    console.log(`   Published: ${item.publishedAt.toISOString()} | Retain until: ${item.retainUntil.toISOString()}`);
  }
}

main()
  .catch((e) => {
    console.error('Live ingestion test failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
