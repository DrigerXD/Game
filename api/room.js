import { getCache } from '@vercel/functions';
import { createRoomHandler } from './room-core.js';

const handler = createRoomHandler(() => getCache({ namespace: 'wordloop-activity-v1' }));

export default handler;
