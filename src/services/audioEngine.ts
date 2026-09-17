/**
 * Audio Engine Bridge
 * Re-exports the unified, centralized AudioPlayer service from src/player/AudioPlayer.ts
 */

import { audioPlayer } from '../player/AudioPlayer';

export { audioPlayer as audioEngine, audioPlayer, AudioPlayer } from '../player/AudioPlayer';
export default audioPlayer;
