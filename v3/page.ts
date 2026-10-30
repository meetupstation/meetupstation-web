import * as pageElements from './common/page.js';
import * as webrtcElements from './common/webrtc.js';
import * as webrtc from './webrtc.js';
import * as storageController from './storage.js';

const rooms: Map<string, webrtcElements.Room> = new Map();
let nextRoomId = 0;

export function newRoom(rooms: Map<string, webrtcElements.Room>): number {
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

    return roomId;
}

export function deleteRoom(
    roomId: number,
    rooms: Map<string, webrtcElements.Room>
): void {
    const room = rooms.get(`${roomId}`)!;

    const storage = storageController.load();
    storage.rooms = storage.rooms.filter(item => item !== room.signalling.id);
    storageController.save(storage);

    for (const [_,peer] of room.peers) {
        pageElements.closePeer(roomId, peer.connectionId);
        peer.peerConnection.close();
    }
    room.peers.clear();
    rooms.delete(`${roomId}`);

    pageElements.deleteRoom(roomId);
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

export async function roomTogglePlay(
    roomId: number,
    self: HTMLInputElement) {

    if (self.checked) {
        try {
            pageElements.setCloseEnabled(roomId, false);
            pageElements.clearErrorMessage(roomId);
            const storage = storageController.load();
            await webrtc.meet(roomId,
                rooms,
                storage.rtcConfiguration);
        } catch (error) {
            const message = String(error);
            pageElements.setErrorMessage(roomId, message);
        }
        pageElements.setCloseEnabled(roomId, true);
        self.disabled = false;
        self.checked = false;
    } else {
        webrtc.interruptMeet(roomId, rooms);
        self.disabled = true;
        self.checked = true;
    }
}

export async function roomToggleCamera(
    roomId: number,
    self: HTMLInputElement) {
    if (self.checked) {
        try {
            await webrtc.startCamera(roomId, rooms);
        } catch (error) {
            const message = String(error);
            pageElements.setErrorMessage(roomId, message);
            self.checked = false;
        }
    }
}

export async function roomToggleMic(
    roomId: number,
    self: HTMLInputElement) {
    if (self.checked) {
        try {
            await webrtc.startMic(roomId, rooms);
        } catch (error) {
            const message = String(error);
            pageElements.setErrorMessage(roomId, message);
            self.checked = false;
        }
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
        newRoom(rooms);
        return;
    }
    const playPauseToggle = (event.target as HTMLInputElement).closest('input.playpauseToggle') as HTMLInputElement;
    if (playPauseToggle) {
        const roomId = getComputedStyle(playPauseToggle).getPropertyValue('--vroomid').trim();
        const roomIdNum = Number.parseInt(roomId);
        roomTogglePlay(roomIdNum, playPauseToggle);
        return;
    }
    const cameraToggle = (event.target as HTMLInputElement).closest('input.cameraToggle') as HTMLInputElement;
    if (cameraToggle) {
        const roomId = getComputedStyle(cameraToggle).getPropertyValue('--vroomid').trim();
        const roomIdNum = Number.parseInt(roomId);
        await roomToggleCamera(roomIdNum, cameraToggle);
        return;
    }
    const micToggle = (event.target as HTMLInputElement).closest('input.micToggle') as HTMLInputElement;
    if (micToggle) {
        const roomId = getComputedStyle(micToggle).getPropertyValue('--vroomid').trim();
        const roomIdNum = Number.parseInt(roomId);
        await roomToggleMic(roomIdNum, micToggle);
        return;
    }
    const closeRoomButton = (event.target as HTMLButtonElement).closest('button.closeRoomButton');
    if (closeRoomButton) {
        const roomId = getComputedStyle(closeRoomButton).getPropertyValue('--vroomid').trim();
        const roomIdNum = Number.parseInt(roomId);
        deleteRoom(roomIdNum, rooms);
        return;
    }
});

const storage = storageController.load();
storageController.save(storage);

for (const room of storage.rooms) {
    pageElements.setHostId(room);
    const roomId = newRoom(rooms);

    const roomPlayInputs = document.querySelectorAll<HTMLInputElement>('input.playpauseToggle');
    const roomPlayInput = [...roomPlayInputs].find((item) => {
        return getComputedStyle(item).getPropertyValue('--vroomid').trim() === `${roomId}`;
    })!;

    roomPlayInput.checked = true;
    roomTogglePlay(roomId, roomPlayInput);
}
