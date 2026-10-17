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

  // 4. Seed Top Indian Creator Profiles
  const creatorsData = [
    {
      displayName: 'Ranveer Allahbadia',
      instagramHandle: 'beerbiceps',
      bio: 'Podcaster, entrepreneur, and founder of Monk Entertainment and BeerBiceps Media.',
      category: ['Creator Economy', 'Podcasting', 'Entrepreneurship', 'Fitness'],
      followerRange: '1M-5M',
      isVerified: true,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      officialLinks: { youtube: 'https://youtube.com/c/BeerBiceps', instagram: 'https://instagram.com/beerbiceps' },
    },
    {
      displayName: 'Shlok Srivastava',
      instagramHandle: 'techburner',
      bio: 'Tech storyteller, gadgets reviewer, and founder of Overlays Clothing and Layers.',
      category: ['Policy & Tech', 'Technology', 'Gadgets', 'Creator Economy'],
      followerRange: '1M-5M',
      isVerified: true,
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      officialLinks: { youtube: 'https://youtube.com/c/TechBurner', instagram: 'https://instagram.com/techburner' },
    },
    {
      displayName: 'Prajakta Koli',
      instagramHandle: 'mostlysane',
      bio: 'Actor, creator, UNDP India Youth Climate Champion, and author.',
      category: ['Culture & Cinema', 'Climate', 'Entertainment', 'Creator Economy'],
      followerRange: '5M-10M',
      isVerified: true,
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
      officialLinks: { youtube: 'https://youtube.com/c/MostlySane', instagram: 'https://instagram.com/mostlysane' },
    },
    {
      displayName: "Faye D'Souza",
      instagramHandle: 'fayedsonline',
      bio: 'Independent journalist, editor, and news anchor delivering unbiased, fact-checked Indian news.',
      category: ['Policy & Tech', 'Investigative', 'National News', 'Journalism'],
      followerRange: '1M-5M',
      isVerified: true,
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      officialLinks: { instagram: 'https://instagram.com/fayedsonline', youtube: 'https://youtube.com/c/FayeDSouza' },
    },
    {
      displayName: 'Tanmay Bhat',
      instagramHandle: 'tanmaybhat',
      bio: 'YouTuber, comedian, investor, and finance content creator.',
      category: ['Creator Economy', 'Finance & Startups', 'Entertainment'],
      followerRange: '1M-5M',
      isVerified: true,
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      officialLinks: { youtube: 'https://youtube.com/c/TanmayBhatYT', instagram: 'https://instagram.com/tanmaybhat' },
    },
    {
      displayName: 'Kusha Kapila',
      instagramHandle: 'kushakapila',
      bio: 'Digital creator, actor, and host navigating Indian culture and entertainment.',
      category: ['Culture & Cinema', 'Entertainment', 'Fashion', 'Creator Economy'],
      followerRange: '1M-5M',
      isVerified: true,
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
      officialLinks: { instagram: 'https://instagram.com/kushakapila' },
    },
  ];

  const seededCreators: Record<string, any> = {};
  for (const c of creatorsData) {
    const creator = await prisma.creatorProfile.upsert({
      where: { instagramHandle: c.instagramHandle },
      update: {
        displayName: c.displayName,
        bio: c.bio,
        category: c.category,
        avatarUrl: c.avatarUrl,
        followerRange: c.followerRange,
        isVerified: c.isVerified,
        officialLinks: c.officialLinks,
      },
      create: c,
    });
    seededCreators[c.instagramHandle] = creator;
    console.log(`✅ Seeded creator profile: ${creator.displayName} (@${creator.instagramHandle})`);
  }

  // 5. Seed Top Brands
  const brandsData = [
    {
      name: 'boAt Lifestyle',
      slug: 'boat-lifestyle',
      sector: 'Consumer Electronics',
      description: 'Audio, smartwatches, and wearable electronics brand founded in India.',
      logoUrl: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=80&auto=format&fit=crop&q=80',
      officialLinks: { website: 'https://www.boat-lifestyle.com' },
    },
    {
      name: 'CRED',
      slug: 'cred',
      sector: 'Fintech & Rewards',
      description: 'Indian fintech company offering credit card management and member rewards.',
      logoUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=80&auto=format&fit=crop&q=80',
      officialLinks: { website: 'https://cred.club' },
    },
    {
      name: 'Nykaa',
      slug: 'nykaa',
      sector: 'Beauty & Fashion E-commerce',
      description: 'Premier omnichannel beauty, wellness, and fashion destination in India.',
      logoUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=80&auto=format&fit=crop&q=80',
      officialLinks: { website: 'https://www.nykaa.com' },
    },
    {
      name: 'Lenskart',
      slug: 'lenskart',
      sector: 'Eyewear & Retail',
      description: 'Multinational optical prescription eyewear retail chain based in India.',
      logoUrl: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=80&auto=format&fit=crop&q=80',
      officialLinks: { website: 'https://www.lenskart.com' },
    },
  ];

  const seededBrands: Record<string, any> = {};
  for (const b of brandsData) {
    const brand = await prisma.brandProfile.upsert({
      where: { slug: b.slug },
      update: {
        name: b.name,
        sector: b.sector,
        description: b.description,
        logoUrl: b.logoUrl,
        officialLinks: b.officialLinks,
      },
      create: b,
    });
    seededBrands[b.slug] = brand;
    console.log(`✅ Seeded brand profile: ${brand.name} (${brand.slug})`);
  }

  // 6. Seed Collaboration Claims with ASCI #ad Disclosure Audits
  const collabsData = [
    {
      creatorHandle: 'techburner',
      brandSlug: 'boat-lifestyle',
      campaignName: 'boAt Nirvana Ion ANC Earphones Flagship Launch',
      claimType: 'BRAND_COLLABORATION' as const,
      provenanceState: 'OFFICIAL_CONFIRMED' as const,
      reviewNote: 'Verified ASCI #ad disclosure present in video description and pinned comment.',
    },
    {
      creatorHandle: 'beerbiceps',
      brandSlug: 'cred',
      campaignName: 'The Ranveer Show (TRS) Financial Independence Series',
      claimType: 'SPONSORED_POST' as const,
      provenanceState: 'OFFICIAL_CONFIRMED' as const,
      reviewNote: 'Corroborated sponsor card at 00:45 and YouTube paid partnership badge enabled.',
    },
    {
      creatorHandle: 'mostlysane',
      brandSlug: 'nykaa',
      campaignName: 'Nykaa All-Star Beauty Festival & Sustainable Cosmetics',
      claimType: 'AMBASSADOR' as const,
      provenanceState: 'OFFICIAL_CONFIRMED' as const,
      reviewNote: 'Official press release and co-branded Instagram reel verified with #collab disclosure.',
    },
    {
      creatorHandle: 'tanmaybhat',
      brandSlug: 'lenskart',
      campaignName: 'Lenskart Air Progressive Eyewear Campaign',
      claimType: 'BRAND_COLLABORATION' as const,
      provenanceState: 'CORROBORATED' as const,
      reviewNote: 'Verified sponsored comedy sketch with explicit brand integration disclosure.',
    },
  ];

  for (const collab of collabsData) {
    const creator = seededCreators[collab.creatorHandle];
    const brand = seededBrands[collab.brandSlug];
    if (creator && brand) {
      const existing = await prisma.collaborationClaim.findFirst({
        where: {
          creatorProfileId: creator.id,
          brandProfileId: brand.id,
          campaignName: collab.campaignName,
        },
      });
      if (!existing) {
        await prisma.collaborationClaim.create({
          data: {
            creatorProfileId: creator.id,
            brandProfileId: brand.id,
            campaignName: collab.campaignName,
            claimType: collab.claimType,
            provenanceState: collab.provenanceState,
            reviewNote: collab.reviewNote,
            claimDate: new Date(),
          },
        });
        console.log(`✅ Seeded collaboration claim: ${creator.displayName} x ${brand.name}`);
      }
    }
  }

  console.log('✨ Seed completed successfully with full creator intelligence.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
