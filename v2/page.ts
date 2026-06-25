import * as webrtcElements from './webrtcElements.js';
import * as webrtc from './webrtc.js';
import * as pageElements from './pageElements.js';

const rooms: Map<string, webrtcElements.Room> = new Map();

export function newRoom(rooms: Map<string, webrtcElements.Room>): void {
    const nextRoomIdLabel = document.getElementById('nextRoomId');

    const roomId = parseInt(nextRoomIdLabel!.innerText);
    nextRoomIdLabel!.innerText = `${roomId + 1}`;

    rooms.set(
        `${roomId}`,
        new webrtcElements.Room(roomId, rooms)
    );

    const roomControlPaneDiv = document.createElement('div');
    roomControlPaneDiv.innerHTML = `
    <div class='roomControlPane' id='roomControlPane${roomId}'>
        <input type='text' id='roomId${roomId}'>
        <div>
            <input type='checkbox' id='roomControlToggleCamera${roomId}'>
            <label for='roomControlToggleCamera${roomId}'>
            🎦
            </label>
            <input type='checkbox' id='roomControlToggleMicrophone${roomId}'>
            <label for='roomControlToggleMicrophone${roomId}'>
            ⏺️
            </label>
            <input type='checkbox' id='roomControlTogglePlay${roomId}' toggle-room-id='${roomId}'>
            <label for='roomControlTogglePlay${roomId}'>
            ▶️
            </label>
            <button id='roomControlButtonStop${roomId}' delete-room-id='${roomId}'>.
            </button>
            <label for='roomControlButtonStop${roomId}'>
            ⏹️
            </label>
            <input type='checkbox' id='roomControlToggleRepeat${roomId}' checked>
            <label for='roomControlToggleRepeat${roomId}'>
            🔁
            </label>
            <label for='roomControlToggleRepeat${roomId}'>
            🔂
            </label>
        </div>
        <div>
            <label class='roomProgress' id='roomProgress${roomId}'>
            </label>
        </div>
        <div>
            <label class='roomError' id='roomError${roomId}'>
            </label>
        </div>
    </div>`;
    document.getElementById('roomControlList')!.appendChild(roomControlPaneDiv);
}

export function deleteRoom(
    roomId: number,
    rooms: Map<string, webrtcElements.Room>
): void {
    const room = rooms.get(`${roomId}`);
    if (room) {
        for (
            const [_peerConnectionId, peerConnection] of
            Object.entries(room.peerConnections)
        ) {
            peerConnection.close();
        }
        room.peerConnections.clear();
        rooms.delete(`${roomId}`);
    }
    document.getElementById(`roomControlPane${roomId}`)?.remove();
}

export async function roomTogglePlay(
    roomId: number,
    rooms: Map<string, webrtcElements.Room>,
    self: HTMLInputElement) {
    const elements = [
        document.querySelector<HTMLInputElement>(`#roomId${roomId}`)!,
        document.querySelector<HTMLInputElement>(`#roomControlToggleCamera${roomId}`)!,
        document.querySelector<HTMLInputElement>(`#roomControlToggleMicrophone${roomId}`)!
    ];
    pageElements.roomSetProgress(roomId, '');

    if (self.checked) {
        try {
            for (const element of elements) {
                element.disabled = true;
            }

            await webrtc.meet(roomId, rooms);

            const roomPausing = document.getElementById(`roomPausing${roomId}`);
            if (roomPausing) {
                roomPausing.remove();
            }

            pageElements.roomSetProgress(roomId, '');
        } catch (error) {
            pageElements.roomSetError(roomId, `${error}`);
        }

        self.checked = false;
        for (const element of elements) {
            element.disabled = false;
        }
    } else {
        pageElements.roomSetProgress(roomId, 'paused');
        
        for (const element of elements) {
            element.disabled = false;
        }
        self.checked = true;

        pageElements.roomPause(roomId);
    }
}

document.getElementById('newRoom')!.addEventListener('click', () => {
    newRoom(rooms);
});

document.addEventListener('click', e => {
    const deleteButton = (e.target as HTMLElement).closest('[delete-room-id]');
    const toggleButton = (e.target as HTMLElement).closest('[toggle-room-id]');

    if (deleteButton) {
        const roomId = Number(deleteButton.getAttribute('delete-room-id'));
        deleteRoom(roomId, rooms);
    } else if (toggleButton instanceof HTMLInputElement) {
        const roomId = Number(toggleButton.getAttribute('toggle-room-id'));
        roomTogglePlay(roomId, rooms, toggleButton);
    }
});
