import * as pageElements from './common/page.js';
import * as webrtcElements from './common/webrtc.js';
import * as webrtc from './webrtc.js';
import * as storageController from './storage.js';

const rooms: Map<string, webrtcElements.Room> = new Map();
let nextRoomId = 0;

export function newRoom(rooms: Map<string, webrtcElements.Room>): void {
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
}

export function deleteRoom(
    roomId: number,
    rooms: Map<string, webrtcElements.Room>
): void {
    const room = rooms.get(`${roomId}`);
    if (room) {
        // for (
        //     const [_peerConnectionId, peerConnection] of
        //     Object.entries(room.peerConnections)
        // ) {
        //     peerConnection.close();
        // }
        // room.peerConnections.clear();
        rooms.delete(`${roomId}`);
    }

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
            pageElements.clearErrorMessage(roomId);
            const storage = storageController.load();
            await webrtc.meet(roomId,
                rooms,
                storage.rtcConfiguration);
        } catch (error) {
            const message = String(error);
            pageElements.setErrorMessage(roomId, message);
        }
        self.disabled = false;
        self.checked = false;
    } else {
        self.disabled = true;
        self.checked = true;
    }
}

document.addEventListener('click', (event) => {
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
    const closeRoomButton = (event.target as HTMLButtonElement).closest('button.closeRoomButton');
    if (closeRoomButton) {
        const roomId = getComputedStyle(closeRoomButton).getPropertyValue('--vroomid').trim();
        const roomIdNum = Number.parseInt(roomId);
        deleteRoom(roomIdNum, rooms);
        return;
    }
});

storageController.save(storageController.load());
