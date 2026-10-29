import * as webrtcElements from './common/webrtc.js';
import * as pageElements from './common/page.js';
import * as storageController from './storage.js';
import { MeetingType } from './common/signalling.js';

export async function meet(
    roomId: number,
    rooms: Map<string, webrtcElements.Room>,
    rtcConfiguration: RTCConfiguration
): Promise<void> {

    const room = rooms.get(`${roomId}`)!;
    room.signalling.restart();

    const peerConnectionId = room.getAndUpdatePeerConnectionId();

    if (room.signalling.accessKey) {
        if (room.meetingType &&
        room.meetingType === MeetingType.GUEST) {
            room.signalling.accessKey = '';
        }
    } else {
        room.meetingType = null;
    }

    pageElements.appendPeer(room.id, peerConnectionId);

    await room.initializePeerConnection(peerConnectionId, rtcConfiguration);

    pageElements.setProgress(room.id, peerConnectionId, 1);

    const peer = room.getPeer(peerConnectionId);
    await room.setupTracksAndDataHandlers(peer.peerConnection);
    await room.ifHostPrepareOffer(peer.peerConnection);

    const storage = storageController.load();
    storage.rooms.push(room.signalling.id);
    storageController.save(storage);
    pageElements.setRoomHostId(room.id, room.signalling.id);

    await room.waitForIceConnected(peer.peerConnection);
    pageElements.setProgress(room.id, peerConnectionId, 4);

    await room.waitForIceDisonnected(peer.peerConnection);
}
