export class RoomClosed {
    roomId: number;

    constructor(roomId: number) {
        this.roomId = roomId;
    }
}

export class UserMedia {
    stream: MediaStream|null = null;
    audio: boolean = false;
    video: boolean = false;
};

export function roomRemoveRemoteVideo(roomId: number, peerId: string): void {
    const remoteVideoPaneDiv = document.getElementById(
        `remoteVideoPane_${roomId}_${peerId}`
    );
    if (remoteVideoPaneDiv) {
        remoteVideoPaneDiv.remove();
    }
}

export function roomPause(roomId: number): void {
    const roomControlPane = document.getElementById(`roomControlPane${roomId}`)!;
    if (!document.getElementById(`roomPausing${roomId}`)) {
        const roomPausing = document.createElement('label');
        roomPausing.id = `roomPausing${roomId}`;
        roomControlPane.appendChild(roomPausing);
    }
}

export function assertRoomActive(roomId: number): void {
    if (document.getElementById(`roomPausing${roomId}`) ||
        !document.getElementById(`roomControlPane${roomId}`)) {
        throw new RoomClosed(roomId);
    }
}

export function roomRepeatChecked(roomId: number): boolean {
    const el = document.querySelector<HTMLInputElement>(
        `#roomControlToggleRepeat${roomId}`
    );

    return el?.checked ?? false;
}

export function roomSetProgress(roomId: number, value: string): void {
    assertRoomActive(roomId);

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

export function roomSetError(roomId: number, error: string): void {
    assertRoomActive(roomId);

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
    _stream: MediaStream
): void {
}

export function roomSetRemoteVideoStream(
    roomId: number,
    peerId: string,
    stream: MediaStream
): void {

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

export function getRoomIdentifier(roomId: number): string {
    return document.querySelector<HTMLInputElement>(`#roomId${roomId}`)!.value;
}

export function setRoomIdentifier(roomId: number, id: string): void {
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
