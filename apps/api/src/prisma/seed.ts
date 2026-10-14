import { prisma } from './client';
import { hashPassword } from '../security/auth';

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Seed Default Admin User
  const adminPassword = await hashPassword('AdminPass123456!');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@parmanu.dev' },
    update: {},
    create: {
      email: 'admin@parmanu.dev',
      name: 'Parmanu Administrator',
      passwordHash: adminPassword,
      role: 'ADMIN',
    },
  });
  console.log('✅ Admin user ready:', adminUser.email);

  // 2. Seed Default Editor User
  const editorPassword = await hashPassword('EditorPass123456!');
  const editorUser = await prisma.user.upsert({
    where: { email: 'editor@parmanu.dev' },
    update: {},
    create: {
      email: 'editor@parmanu.dev',
      name: 'Editorial Lead',
      passwordHash: editorPassword,
      role: 'EDITOR',
    },
  });
  console.log('✅ Editor user ready:', editorUser.email);

  // 3. Seed Priority News Sources (Approved in Prompt 1)
  const sources = [
    {
      name: 'The Hindu',
      slug: 'the-hindu',
      type: 'RSS' as const,
      feedUrl: 'https://www.thehindu.com/feeder/default.rss',
      category: ['India', 'Politics', 'World'],
      language: 'en',
      country: 'IN',
      pollingIntervalMinutes: 15,
      attributionName: 'The Hindu',
      attributionUrl: 'https://www.thehindu.com',
      isActive: true,
    },
    {
      name: 'NDTV News',
      slug: 'ndtv-news',
      type: 'RSS' as const,
      feedUrl: 'https://feeds.feedburner.com/ndtvnews-top-stories',
      category: ['India', 'Breaking', 'National'],
      language: 'en',
      country: 'IN',
      pollingIntervalMinutes: 15,
      attributionName: 'NDTV',
      attributionUrl: 'https://www.ndtv.com',
      isActive: true,
    },
    {
      name: 'Times of India',
      slug: 'times-of-india',
      type: 'RSS' as const,
      feedUrl: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
      category: ['India', 'Entertainment', 'National'],
      language: 'en',
      country: 'IN',
      pollingIntervalMinutes: 15,
      attributionName: 'Times of India',
      attributionUrl: 'https://timesofindia.indiatimes.com',
      isActive: true,
    },
    {
      name: 'The Economic Times',
      slug: 'economic-times',
      type: 'RSS' as const,
      feedUrl: 'https://economictimes.indiatimes.com/rssfeedsdefault.cms',
      category: ['Business', 'Economy', 'Markets'],
      language: 'en',
      country: 'IN',
      pollingIntervalMinutes: 15,
      attributionName: 'The Economic Times',
      attributionUrl: 'https://economictimes.indiatimes.com',
      isActive: true,
    },
    {
      name: 'ESPN Cricinfo',
      slug: 'espn-cricinfo',
      type: 'RSS' as const,
      feedUrl: 'https://www.espncricinfo.com/rss/content/story/feeds/0.xml',
      category: ['Sports', 'Cricket'],
      language: 'en',
      country: 'IN',
      pollingIntervalMinutes: 15,
      attributionName: 'ESPN Cricinfo',
      attributionUrl: 'https://www.espncricinfo.com',
      isActive: true,
    },
    {
      name: 'PR Newswire',
      slug: 'pr-newswire',
      type: 'RSS' as const,
      feedUrl: 'https://www.prnewswire.com/rss/news-releases-list.rss',
      category: ['Business', 'Creator', 'Brands'],
      language: 'en',
      country: 'IN',
      pollingIntervalMinutes: 30,
      attributionName: 'PR Newswire',
      attributionUrl: 'https://www.prnewswire.com',
      isActive: true,
    },
  ];

  for (const src of sources) {
    const created = await prisma.newsSource.upsert({
      where: { slug: src.slug },
      update: {
        feedUrl: src.feedUrl,
        attributionName: src.attributionName,
        attributionUrl: src.attributionUrl,
        category: src.category,
      },
      create: src,
    });
    console.log(`✅ Seeded news source: ${created.name} (${created.slug})`);
  }

  // 4. Seed Seed Creator and Brand Profiles
  const creator = await prisma.creatorProfile.upsert({
    where: { instagramHandle: 'beerbiceps' },
    update: {},
    create: {
      displayName: 'Ranveer Allahbadia',
      instagramHandle: 'beerbiceps',
      bio: 'Podcaster, entrepreneur, and content creator.',
      category: ['Podcasting', 'Fitness', 'Entrepreneurship'],
      followerRange: '1M-5M',
      isVerified: true,
      officialLinks: { youtube: 'https://youtube.com/c/BeerBiceps' },
    },
  });
  console.log('✅ Seeded creator profile:', creator.displayName);

  const brand = await prisma.brandProfile.upsert({
    where: { slug: 'boat-lifestyle' },
    update: {},
    create: {
      name: 'boAt Lifestyle',
      slug: 'boat-lifestyle',
      sector: 'Consumer Electronics',
      description: 'Audio and wearable electronics brand founded in India.',
      officialLinks: { website: 'https://www.boat-lifestyle.com' },
    },
  });
  console.log('✅ Seeded brand profile:', brand.name);

  console.log('✨ Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
