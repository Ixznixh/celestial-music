/**
 * Server-Side Provider Manager
 * Real YouTube Music service provider.
 */

import { youtubeMusicService } from './youtubeMusic';

export class ServerProviderManager {
  public getService() {
    return youtubeMusicService;
  }

  public getStatus() {
    return {
      provider: 'youtube_music',
      initialized: true,
    };
  }
}

export const serverProviderManager = new ServerProviderManager();

