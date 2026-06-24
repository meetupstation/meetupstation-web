import * as webrtcElements from './webrtcElements';

export class UserMedia {
    stream: MediaStream|null = null;
    audio: boolean = false;
    video: boolean = false;
};

export function roomRemoveRemoteVideo(roomId: number, peerId: string) {
    const remoteVideoPaneDiv = document.getElementById(
        `remoteVideoPane_${roomId}_${peerId}`
    );
    if (remoteVideoPaneDiv) {
        remoteVideoPaneDiv.remove();
    }
}

export function roomPausing(roomId: number): boolean {
    if (document.getElementById(`roomPausing${roomId}`) ||
        !document.getElementById(`roomControlPane${roomId}`)) {
        return true;
    }

    return false;
}

export function roomRepeatChecked(roomId: number): boolean {
    const el = document.querySelector<HTMLInputElement>(
        `#roomControlToggleRepeat${roomId}`
    );

    return el?.checked ?? false;
}

export function roomSetProgress(roomId: number, value: string): void {
    const roomProgress = document.getElementById(`roomProgress${roomId}`);
    if (roomProgress) {
        if (value) {
            value = 'ⓘ ' + value;
        }
        roomProgress.innerText = value;
        roomClearError(roomId);
    }
}

function roomClearError(roomId: number) {
    roomSetError(roomId, '');
}

function roomSetError(roomId: number, error: string): void {
    const roomErrorLabel = document.getElementById(`roomError${roomId}`);
    if (roomErrorLabel) {
        roomErrorLabel.innerText = error;
    }
}

export function roomSetPeerConnectionStatus(
    roomId: number,
    peerConnectionId: string,
    value: string
): void {
    const remoteVideoStatusLabel =
        document.getElementById(`remoteVideoStatusLabel_${roomId}_${peerConnectionId}`);
    if (remoteVideoStatusLabel) {
        if (value) {
            value = 'ⓘ ' + value;
        }
        remoteVideoStatusLabel.innerText = value;
    }
}

export function roomSetLocalVideoStream(
    _roomId: number,
    _rooms: [webrtcElements.Room],
    _stream: MediaStream
): void {
}

export function roomSetRemoteVideoStream(
    roomId: number,
    rooms: [webrtcElements.Room],
    peerId: string,
    stream: MediaStream
): void {

    if (rooms[roomId] === undefined) {
        return;
    }

    const remoteVideosPaneDiv = document.getElementById('remoteVideosPane');
    if (!remoteVideosPaneDiv) {
        return;
    }

    let remotePlayer =
        document.querySelector<HTMLVideoElement>(
            `#remoteVideo_${roomId}_${peerId}`
        );
    if (!remotePlayer) {
        const remoteVideoStatusLabel = document.createElement('label');
        remoteVideoStatusLabel.id = `remoteVideoStatusLabel_${roomId}_${peerId}`;
        remotePlayer = document.createElement('video') as HTMLVideoElement;
        remotePlayer.id = `remoteVideo_${roomId}_${peerId}`;
        remotePlayer.autoplay = true;
        remotePlayer.controls = true;
        remotePlayer.playsInline = true;
        // remotePlayer.setAttribute('autoplay', 'autoplay');
        // remotePlayer.setAttribute('controls', 'controls');
        // remotePlayer.setAttribute('playsinline', 'playsinline');

        const remoteVideoPaneDiv = document.createElement('div');
        remoteVideoPaneDiv.id = `remoteVideoPane_${roomId}_${peerId}`;
        remoteVideoPaneDiv.classList.add('remoteVideoPane');

        remoteVideoPaneDiv.appendChild(remotePlayer);
        remoteVideoPaneDiv.appendChild(document.createElement('br'));
        remoteVideoPaneDiv.appendChild(remoteVideoStatusLabel);

        remoteVideosPaneDiv.appendChild(remoteVideoPaneDiv);
    }

    remotePlayer.srcObject = stream;
}

export function getRoomId(roomId: number): string {
    return document.querySelector<HTMLInputElement>(`#roomId${roomId}`)!.value;
}

export function setRoomId(roomId: number, id: string): void {
    document.querySelector<HTMLInputElement>(`#roomId${roomId}`)!.value = id;
}

export async function getUserMedia(
    roomId: number
): Promise<UserMedia> {
    const result = new UserMedia();

    const doCamera =
        document.querySelector<HTMLInputElement>(
            `#roomControlToggleCamera${roomId}`
        )?.checked;
    const doMicrophone =
        document.querySelector<HTMLInputElement>(
            `#roomControlToggleMicrophone${roomId}`
        )?.checked;

    if (!doMicrophone && !doCamera) {
        result.stream = null;
    } else if (doMicrophone && !doCamera) {
        result.stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true
        });
        result.audio = true;
    } else if (doCamera) {
        result.stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        result.audio = true;
        result.video = true;
    }
    // else if (mediaElement.value === 'Video HQ') {
    //     result.stream = await navigator.mediaDevices.getUserMedia({
    //         video: {
    //             facingMode: 'environment'
    //         },
    //         audio: true
    //     });
    //     result.audio = true;
    //     result.video = true;
    // }

    return result;
}

export function resetDataControllers(): void { }