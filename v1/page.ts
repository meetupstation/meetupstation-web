import * as pageElements from './common/page.js';
import * as webrtcElements from './common/webrtc.js';
import * as webrtc from './webrtc.js';
import * as storageController from './storage.js';

const rooms: Map<string, webrtcElements.Room> = new Map();
let nextRoomId = 0;

export async function newRoom(rooms: Map<string, webrtcElements.Room>): Promise<void> {
    const roomId = nextRoomId;
    ++nextRoomId;

    const hostId = pageElements.getHostId();
    const storage = storageController.load();

    rooms.set(
        `${roomId}`,
        new webrtcElements.Room(roomId, hostId, storage.signalServer)
    );

    pageElements.newRoom(roomId);
    pageElements.setRoomHostId(roomId, hostId);

    const storageRoom = storage.rooms[hostId];
    if (storageRoom) {
        if (storageRoom.camera) {
            await roomToggleCamera(roomId);
        }
        if (storageRoom.microphone) {
            await roomToggleMic(roomId);
        }
    }

    while (true) {
        try {
            pageElements.clearErrorMessage(roomId);
            await webrtc.meet(roomId,
                rooms,
                storage.rtcConfiguration);
        } catch (error) {
            const message = String(error);
            pageElements.setErrorMessage(roomId, message);
        }
        if (webrtc.interruptMeetReset(roomId, rooms)) {
            break;
        }
    }
}

export async function deleteRoom(
    roomId: number,
    rooms: Map<string, webrtcElements.Room>
): Promise<void> {
    await webrtc.interruptMeet(roomId, rooms);

    const room = rooms.get(`${roomId}`)!;
    const roomSignallingId = room.signalling.id;

    for (const [_,peer] of room.peers) {
        pageElements.closePeer(roomId, peer.connectionId);
        peer.peerConnection.close();
    }
    room.peers.clear();
    rooms.delete(`${roomId}`);

    pageElements.deleteRoom(roomId);

    const deleteFromStorage = (() => {
        for (const [_, room] of rooms) {
            if (room.signalling.id === roomSignallingId) {
                return false;
            }
        }
        return true;
    })();

    if (deleteFromStorage) {
        const storage = storageController.load();
        delete storage.rooms[roomSignallingId];
        storageController.save(storage);
    }
}

export function settingsToggle(self: HTMLInputElement): void {
    if (self.checked) {
        try {
            const storage = storageController.load();
            pageElements.setSettings(storageController.saveSerialize(storage));
        } catch (error) {
            console.error('while loading settings:', error);
            self.checked = false;
        }
    } else {
        try {
            const storage = storageController.loadSerialized(pageElements.getSettings());
            storageController.save(storage);
        } catch (error) {
            console.error('while loading settings:', error);
            self.checked = true;
        }
    }
}

export async function roomToggleCamera(
    roomId: number) {
    const checked = pageElements.getRoomCameraChecked(roomId);
    try {
        if (checked) {
            await webrtc.startCamera(roomId, rooms);
        } else {
            await webrtc.stopCamera(roomId, rooms);
        }
    } catch (error) {
        const message = String(error);
        pageElements.setErrorMessage(roomId, message);
        pageElements.setRoomCameraChecked(roomId, !checked);
    }
}

export async function roomToggleMic(
    roomId: number) {
    const checked = pageElements.getRoomMicChecked(roomId);
    try {
        if (checked) {
            await webrtc.startMic(roomId, rooms);
        } else {
            await webrtc.stopMic(roomId, rooms);
        }
    } catch (error) {
        const message = String(error);
        pageElements.setErrorMessage(roomId, message);
        pageElements.setRoomMicChecked(roomId, !checked);
    }
}

document.addEventListener('click', async (event) => {
    const settingsToggleElement = (event.target as HTMLInputElement).closest('input#settingsToggle') as HTMLInputElement;
    if (settingsToggleElement) {
        settingsToggle(settingsToggleElement);
        return;
    }
    const newRoomButton = (event.target as HTMLButtonElement).closest('button#newRoomButton');
    if (newRoomButton) {
        await newRoom(rooms);
        return;
    }
    const cameraToggle = (event.target as HTMLInputElement).closest('input.cameraToggle') as HTMLInputElement;
    if (cameraToggle) {
        const roomId = getComputedStyle(cameraToggle).getPropertyValue('--vroomid').trim();
        const roomIdNum = Number.parseInt(roomId);
        const storageRoom = storage.rooms[pageElements.getRoomHostId(roomIdNum)];
        if (storageRoom) {
            await roomToggleCamera(roomIdNum);
        }
        return;
    }
    const micToggle = (event.target as HTMLInputElement).closest('input.micToggle') as HTMLInputElement;
    if (micToggle) {
        const roomId = getComputedStyle(micToggle).getPropertyValue('--vroomid').trim();
        const roomIdNum = Number.parseInt(roomId);
        const storageRoom = storage.rooms[pageElements.getRoomHostId(roomIdNum)];
        if (storageRoom) {
            await roomToggleMic(roomIdNum);
        }
        return;
    }
    const closeRoomButton = (event.target as HTMLButtonElement).closest('button.closeRoomButton');
    if (closeRoomButton) {
        const roomId = getComputedStyle(closeRoomButton).getPropertyValue('--vroomid').trim();
        const roomIdNum = Number.parseInt(roomId);
        await deleteRoom(roomIdNum, rooms);
        return;
    }
    const audioToggle = (event.target as HTMLInputElement).closest('input.audioToggle') as HTMLInputElement;
    if (audioToggle) {
        const roomId = getComputedStyle(audioToggle).getPropertyValue('--vroomid').trim();
        const roomIdNum = Number.parseInt(roomId);

        const peerConnectionId = getComputedStyle(audioToggle).getPropertyValue('--vpeerconnectionid').trim();
        const peerConnectionIdNum = Number.parseInt(peerConnectionId);

        const streamId = getComputedStyle(audioToggle).getPropertyValue('--vstreamid').trim();

        await pageElements.mediaToggleAudio(roomIdNum, peerConnectionIdNum, streamId, audioToggle);
        return;
    }
    const videoPlayButton = (event.target as HTMLButtonElement).closest('button.videoPlayButton') as HTMLButtonElement;
    if (videoPlayButton) {
        const roomId = getComputedStyle(videoPlayButton).getPropertyValue('--vroomid').trim();
        const roomIdNum = Number.parseInt(roomId);

        const peerConnectionId = getComputedStyle(videoPlayButton).getPropertyValue('--vpeerconnectionid').trim();
        const peerConnectionIdNum = Number.parseInt(peerConnectionId);

        const streamId = getComputedStyle(videoPlayButton).getPropertyValue('--vstreamid').trim();

        await pageElements.mediaPlayVideo(roomIdNum, peerConnectionIdNum, streamId);
        return;
    }
});

const storage = storageController.load();
storageController.save(storage);

for (const room in storage.rooms) {
    pageElements.setHostId(room);
    await newRoom(rooms);
}
