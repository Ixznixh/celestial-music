/**
 * Server-Side Provider Manager
 * Real Pure YouTube service provider.
 */

import { youtubeMusicService } from './youtubeMusic';

export class ServerProviderManager {
  public getService() {
    return youtubeMusicService;
  }

  public getStatus() {
    return {
      provider: 'youtube',
      initialized: true,
    };
  }
}

export const serverProviderManager = new ServerProviderManager();

