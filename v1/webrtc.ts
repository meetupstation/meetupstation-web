import * as webrtcElements from './common/webrtc.js';
import * as pageElements from './common/page.js';
import * as storageController from './storage.js';
import * as signalling from './common/signalling.js';

export async function meet(
    roomId: number,
    rooms: Map<string, webrtcElements.Room>,
    rtcConfiguration: RTCConfiguration
): Promise<void> {

    while (true) {
        const room = rooms.get(`${roomId}`)!;

        for (const [_,peer] of room.peers) {
            if ([
                'connected',
                'completed'
            ].indexOf(peer.peerConnection.iceConnectionState) === -1) {
                closePeer(roomId, peer.connectionId, rooms);
            }
        }

        if (room.meetingType === signalling.MeetingType.GUEST) {
            for (const [_,peer] of room.peers) {
                try {
                    await room.waitForIceClosed(peer.peerConnection);
                } catch (_)
                {}

                if (room.interruptMeet) {
                    return;
                }

                closePeer(roomId, peer.connectionId, rooms);
            }
        }

        room.signalling.restart();

        const peerConnectionId = room.getAndUpdatePeerConnectionId();

        if (room.signalling.accessKey) {
            if (room.meetingType &&
            room.meetingType === signalling.MeetingType.GUEST) {
                room.signalling.accessKey = '';
            }
        } else if (room.meetingType !== signalling.MeetingType.GUEST) {
            room.meetingType = null;
        }

        pageElements.appendPeer(room.id, peerConnectionId);

        await room.initializePeerConnection(peerConnectionId, rtcConfiguration);

        pageElements.setPeerProgress(room.id, peerConnectionId, 1);

        const peer = room.getPeer(peerConnectionId);

        peer.peerConnection.ontrack = async function (event) {
            const track = event.track;
            const stream = event.streams[0];

            try {
                await pageElements.setPeerMediaStream(room.id, peerConnectionId, stream, track.kind);
            } catch (error) {
                console.error('ontrack():', error);
            }

            track.addEventListener('unmute', async () => {
                if (track.kind === 'video') {
                    await pageElements.mediaPlayVideo(room.id, peerConnectionId, stream.id);
                }
            });

        // track.addEventListener('unmute', () =>
        //     pageElements.setRemoteVisible(this.id, peerConnectionId, track.kind, true));
        // track.addEventListener('mute', () =>
        //     pageElements.setRemoteVisible(this.id, peerConnectionId, track.kind, false));
        };
        peer.peerConnection.onicecandidate = (event) => {
            if (event.candidate === null) {
                room.signalling.localSessionDescription =
                        btoa(JSON.stringify(peer.peerConnection.localDescription));
            } else {
                room.signalling.localCandidates.push(btoa(JSON.stringify(event.candidate)));
            }
        };

        await room.ifHostPrepareOffer(peer.peerConnection);

        const storage = storageController.load();
        if (storage.rooms[room.signalling.id] === undefined) {
            storage.rooms[room.signalling.id] = {
                camera: room.cameraTrack != null,
                microphone: room.micTrack != null
            };
        };
        storageController.save(storage);
        pageElements.setRoomHostId(room.id, room.signalling.id);
        pageElements.setRoomMediaControlEnabled(room.id, true);

        if (await room.waitForIceConnected(peer.peerConnection)) {
            pageElements.setPeerProgress(room.id, peerConnectionId, 4);
        }

        if (room.interruptMeet) {
            return;
        }
    }
}

export async function interruptMeet(
    roomId: number,
    rooms: Map<string, webrtcElements.Room>
): Promise<void> {
    const room = rooms.get(`${roomId}`)!;
    room.interruptMeet = true;

    const stepWait = 200;
    while (room.interruptMeet === true) {
        await new Promise(resolve => setTimeout(resolve, stepWait));
    }
}

export function interruptMeetReset(
    roomId: number,
    rooms: Map<string, webrtcElements.Room>
): boolean {
    const room = rooms.get(`${roomId}`)!;
    const result = room.interruptMeet;
    room.interruptMeet = false;
    return result;
}

export async function startCamera(roomId: number,
    rooms: Map<string, webrtcElements.Room>) {

    const room = rooms.get(`${roomId}`);
    if (room === null) {
        return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const cameraTracks = stream.getVideoTracks();
    const cameraTrack = cameraTracks[room!.nextCameraTrackIndex];
    room!.nextCameraTrackIndex = (room!.nextCameraTrackIndex + 1) % cameraTracks.length;

    room!.setCameraTrack(cameraTrack);
}

export async function stopCamera(roomId: number,
    rooms: Map<string, webrtcElements.Room>) {

    const room = rooms.get(`${roomId}`);
    if (room === null) {
        return;
    }

    room!.setCameraTrack(null);
}

export async function startMic(roomId: number,
    rooms: Map<string, webrtcElements.Room>) {

    const room = rooms.get(`${roomId}`);
    if (room === null) {
        return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const micTrack = stream.getAudioTracks()[0];
    room!.setMicTrack(micTrack);
}

export async function stopMic(roomId: number,
    rooms: Map<string, webrtcElements.Room>) {

    const room = rooms.get(`${roomId}`);
    if (room === null) {
        return;
    }

    room!.setMicTrack(null);
}

export function closePeer(roomId: number,
    peerConnectionId: number,
    rooms: Map<string, webrtcElements.Room>) {
    const room = rooms.get(`${roomId}`)!;
    pageElements.closePeer(roomId, peerConnectionId);
    room.peers.get(peerConnectionId)!.peerConnection.close();
    room.peers.delete(peerConnectionId);
}
