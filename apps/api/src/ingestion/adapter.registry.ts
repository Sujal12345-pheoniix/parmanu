import { SourceType } from '@parmanu/types';
import {
  SourceAdapter,
  RssSourceConnector,
  GovernmentFeedConnector,
  GuardianApiConnector,
  GNewsApiConnector,
  PrWireConnector,
  InstagramApiConnector,
  ConnectorError,
  ConnectorFailureType,
} from '../connectors';

export class AdapterRegistry {
  private adapters = new Map<SourceType, SourceAdapter>();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    const rssAdapter = new RssSourceConnector();
    const govAdapter = new GovernmentFeedConnector();
    const guardianAdapter = new GuardianApiConnector();
    const gnewsAdapter = new GNewsApiConnector();
    const prWireAdapter = new PrWireConnector();
    const instagramAdapter = new InstagramApiConnector();

    this.register('RSS', rssAdapter);
    this.register('ATOM', rssAdapter);
    this.register('GOVERNMENT_FEED', govAdapter);
    this.register('API_GUARDIAN', guardianAdapter);
    this.register('API_GNEWS', gnewsAdapter);
    this.register('MANUAL_PR', prWireAdapter);
    this.register('INSTAGRAM_API', instagramAdapter);
  }

  public register(sourceType: SourceType, adapter: SourceAdapter): void {
    this.adapters.set(sourceType, adapter);
  }

  public getAdapter(sourceType: SourceType): SourceAdapter {
    const adapter = this.adapters.get(sourceType);
    if (!adapter) {
      throw new ConnectorError(
        ConnectorFailureType.MISSING_CONFIG,
        `No registered ingestion adapter found for source type: ${sourceType}`,
        undefined,
        false
      );
    }
    return adapter;
  }

  public hasAdapter(sourceType: SourceType): boolean {
    return this.adapters.has(sourceType);
  }

  public listAdapters(): Array<{
    sourceType: SourceType;
    id: string;
    name: string;
    supportedContentTypes: string[];
    attributionRequirement: string;
  }> {
    const list: Array<{
      sourceType: SourceType;
      id: string;
      name: string;
      supportedContentTypes: string[];
      attributionRequirement: string;
    }> = [];

    for (const [sourceType, adapter] of this.adapters.entries()) {
      list.push({
        sourceType,
        id: adapter.id,
        name: adapter.name,
        supportedContentTypes: adapter.supportedContentTypes,
        attributionRequirement: adapter.attributionRequirement,
      });
    }

    return list;
  }
}

export const defaultAdapterRegistry = new AdapterRegistry();
