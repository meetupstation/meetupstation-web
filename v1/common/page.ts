export function newRoom(roomId: number): void {
    const template = document.getElementById('room-template') as HTMLTemplateElement;

    const html = template!.innerHTML
        .replaceAll('roomId__', `roomId${roomId}`)
        .replaceAll('value="__"', `value="${roomId}"`)
        .replaceAll('--vroomid: __', `--vroomid: ${roomId}`)
        .replaceAll('closeRoomButton__', `closeRoomButton${roomId}`)
        .replaceAll('cameraToggle__', `cameraToggle${roomId}`)
        .replaceAll('micToggle__', `micToggle${roomId}`);

    const templateRoomId = document.createElement('template');
    templateRoomId.innerHTML = html;

    const fragment = templateRoomId.content;
    const radioElement = fragment.querySelector<HTMLInputElement>('.roomRadio');

    if (radioElement) {
        radioElement.checked = true;
    }

    document.body.appendChild(fragment.cloneNode(true));
}

export function deleteRoom(
    roomId: number
): void {
    const roomRadioOption = document.getElementById(`roomId${roomId}`);
    const roomDivs = document.querySelectorAll<HTMLDivElement>('div.room');
    const roomDiv = [...roomDivs].find((item) => {
        return getComputedStyle(item).getPropertyValue('--vroomid').trim() === `${roomId}`;
    });

    roomRadioOption?.remove();
    roomDiv?.remove();
}

export function getSettings(): string {
    const settingsElement = document.querySelector<HTMLTextAreaElement>('#settings');
    return settingsElement!.value;
}

export function setSettings(settings: string): void {
    const settingsElement = document.querySelector<HTMLTextAreaElement>('#settings');
    settingsElement!.value = settings;
}

const errorMessageTimeouts: Record<number, number> = {};

export function setErrorMessage(roomId: number, error: string) {
    clearTimeout(errorMessageTimeouts[roomId]);
    delete errorMessageTimeouts[roomId];

    const roomDivs = document.querySelectorAll<HTMLDivElement>('div.errorMessage');
    const roomDiv = [...roomDivs].find((item) => {
        return getComputedStyle(item).getPropertyValue('--vroomid').trim() === `${roomId}`;
    });
    if (roomDiv) {
        roomDiv.textContent = error;
    }
}

export function clearErrorMessage(roomId: number) {
    clearTimeout(errorMessageTimeouts[roomId]);
    delete errorMessageTimeouts[roomId];

    const roomDivs = document.querySelectorAll<HTMLDivElement>('div.errorMessage');
    const roomDiv = [...roomDivs].find((item) => {
        return getComputedStyle(item).getPropertyValue('--vroomid').trim() === `${roomId}`;
    });
    if (roomDiv) {
        errorMessageTimeouts[roomId] = window.setTimeout(() => {
            roomDiv.innerHTML = '';
        }, 3_000);
    }
}

export function appendPeer(roomId: number, peerConnectionId: number) {
    const roomDivs = document.querySelectorAll<HTMLDivElement>('div.peers');
    const roomDiv = [...roomDivs].find(
        (item) => {
            return getComputedStyle(item).getPropertyValue('--vroomid').trim() === `${roomId}`;
        })!;

    const template = document.getElementById('peer-template') as HTMLTemplateElement;

    const html = template!.innerHTML
        .replaceAll('roomId__', `roomId${roomId}`)
        .replaceAll('--vpeerconnectionid: __', `--vpeerconnectionid: ${peerConnectionId}`);

    const templatePeer = document.createElement('template');
    templatePeer.innerHTML = html;

    roomDiv.appendChild(templatePeer.content.cloneNode(true));
}

export function closePeer(roomId: number, peerConnectionId: number) {
    const peerDivs = document.querySelectorAll<HTMLDivElement>('div.statusWheel');
    const peerDiv = [...peerDivs].find((item) => {
        return getComputedStyle(item).getPropertyValue('--vroomid').trim() === `${roomId}` &&
        getComputedStyle(item).getPropertyValue('--vpeerconnectionid').trim() === `${peerConnectionId}`;
    })!;
    peerDiv.remove();

    closeMediaStreams(roomId, peerConnectionId);
}

export function setPeerProgress(roomId: number,
    peerConnectionId: number,
    progress: number) {

    const peerDivs = document.querySelectorAll<HTMLDivElement>('div.statusWheel');
    const peerDiv = [...peerDivs].find((item) => {
        return getComputedStyle(item).getPropertyValue('--vroomid').trim() === `${roomId}` &&
        getComputedStyle(item).getPropertyValue('--vpeerconnectionid').trim() === `${peerConnectionId}`;
    })!;

    peerDiv.style.setProperty('--vp', `${progress}`);
}

export function getHostId() {
    const hostIdElement = document.querySelector<HTMLInputElement>('input#hostId');
    return hostIdElement!.value;
}

export function setHostId(hostId: string) {
    const hostIdElement = document.querySelector<HTMLInputElement>('input#hostId');
    return hostIdElement!.value = hostId;
}

export function getRoomHostId(roomId: number) {
    const roomDivs = document.querySelectorAll<HTMLDivElement>('div.room');
    const roomDiv = [...roomDivs].find(
        (item) => {
            return getComputedStyle(item).getPropertyValue('--vroomid').trim() === `${roomId}`;
        })!;

    const jsonHostId = getComputedStyle(roomDiv).getPropertyValue('--vhostid').trim();
    return JSON.parse(jsonHostId);
}

export function setRoomHostId(roomId: number, hostId: string) {
    const roomDivs = document.querySelectorAll<HTMLDivElement>('div.room');
    const roomDiv = [...roomDivs].find(
        (item) => {
            return getComputedStyle(item).getPropertyValue('--vroomid').trim() === `${roomId}`;
        })!;
    roomDiv.style.setProperty('--vhostid', JSON.stringify(hostId));
}

export function getRoomCameraChecked(roomId: number) {
    const inputCameras = document.querySelectorAll<HTMLInputElement>('input.cameraToggle');
    const inputCamera = [...inputCameras].find(
        (item) => {
            return getComputedStyle(item).getPropertyValue('--vroomid').trim() === `${roomId}`;
        })!;
    return inputCamera.checked;
}

export function setRoomCameraChecked(roomId: number, checked: boolean) {
    const inputCameras = document.querySelectorAll<HTMLInputElement>('input.cameraToggle');
    const inputCamera = [...inputCameras].find(
        (item) => {
            return getComputedStyle(item).getPropertyValue('--vroomid').trim() === `${roomId}`;
        })!;
    inputCamera.checked = checked;
}

export function getRoomMicChecked(roomId: number) {
    const inputMics = document.querySelectorAll<HTMLInputElement>('input.micToggle');
    const inputMic = [...inputMics].find(
        (item) => {
            return getComputedStyle(item).getPropertyValue('--vroomid').trim() === `${roomId}`;
        })!;
    return inputMic.checked;
}

export function setRoomMicChecked(roomId: number, checked: boolean) {
    const inputMics = document.querySelectorAll<HTMLInputElement>('input.micToggle');
    const inputMic = [...inputMics].find(
        (item) => {
            return getComputedStyle(item).getPropertyValue('--vroomid').trim() === `${roomId}`;
        })!;
    inputMic.checked = checked;
}

export function setRoomMediaControlEnabled(roomId: number, enabled: boolean) {
    const inputCameras = document.querySelectorAll<HTMLInputElement>('input.cameraToggle');
    const inputCamera = [...inputCameras].find(
        (item) => {
            return getComputedStyle(item).getPropertyValue('--vroomid').trim() === `${roomId}`;
        })!;
    inputCamera.disabled = !enabled;

    const inputMics = document.querySelectorAll<HTMLInputElement>('input.micToggle');
    const inputMic = [...inputMics].find(
        (item) => {
            return getComputedStyle(item).getPropertyValue('--vroomid').trim() === `${roomId}`;
        })!;
    inputMic.disabled = !enabled;
}

export async function setPeerMediaStream(roomId: number,
    peerConnectionId: number,
    stream: MediaStream) {
    const roomDivs = document.querySelectorAll<HTMLDivElement>('div.media');
    const roomDiv = [...roomDivs].find(
        (item) => {
            return getComputedStyle(item).getPropertyValue('--vroomid').trim() === `${roomId}`;
        })!;

    const peerMedias = roomDiv.querySelectorAll<HTMLDivElement>('div.peerMedia');
    const peerMedia = [...peerMedias].find(
        (item) => {
            return getComputedStyle(item).getPropertyValue('--vpeerconnectionid').trim() === `${peerConnectionId}` &&
            getComputedStyle(item).getPropertyValue('--vstreamid').trim() === `${stream.id}`;
        });

    if (!peerMedia) {
        const template = document.getElementById('peer-media-template') as HTMLTemplateElement;

        const html = template!.innerHTML
            .replaceAll('roomId__', `roomId${roomId}`) // useless currently
            .replaceAll('--vpeerconnectionid: __', `--vpeerconnectionid: ${peerConnectionId}`)
            .replaceAll('--vstreamid: __', `--vstreamid: ${stream.id}`)
            .replaceAll('audioToggle__', `audioToggle_${stream.id}`)
            .replaceAll('videoPlayButton__', `videoPlayButton_${stream.id}`);

        // const templatePeer = document.createElement('template');
        // templatePeer.innerHTML = html;

        // roomDiv.appendChild(templatePeer.content.cloneNode(true));
        // this upper structure at first seems to work, but iOS does not
        // render the video, unless full screen. below is ok with iOS
        const fragment = document.createRange().createContextualFragment(html);
        roomDiv.appendChild(fragment);
    }

    const peerVideos = roomDiv.querySelectorAll<HTMLVideoElement>('video');
    const peerVideo = [...peerVideos].find(
        (item) => {
            return getComputedStyle(item).getPropertyValue('--vpeerconnectionid').trim() === `${peerConnectionId}` &&
        getComputedStyle(item).getPropertyValue('--vstreamid').trim() === `${stream.id}`;
        })!;

    peerVideo.srcObject = stream;

    const peerAudioToggles = roomDiv.querySelectorAll<HTMLInputElement>('input');
    const peerAudioToggle = [...peerAudioToggles].find(
        (item) => {
            return getComputedStyle(item).getPropertyValue('--vpeerconnectionid').trim() === `${peerConnectionId}` &&
        getComputedStyle(item).getPropertyValue('--vstreamid').trim() === `${stream.id}`;
        })!;

    peerAudioToggle.checked = !peerVideo.muted;
}

export function closeMediaStreams(roomId: number, peerConnectionId: number) {

    const roomDivs = document.querySelectorAll<HTMLDivElement>('div.media');
    const roomDiv = [...roomDivs].find(
        (item) => {
            return getComputedStyle(item).getPropertyValue('--vroomid').trim() === `${roomId}`;
        })!;
    const peerMedias = roomDiv.querySelectorAll<HTMLDivElement>('div.peerMedia');
    for (const peerMedia of peerMedias) {
        if (getComputedStyle(peerMedia).getPropertyValue('--vpeerconnectionid').trim() === `${peerConnectionId}`) {
            peerMedia.remove();
        }
    }
}

export async function mediaToggleAudio(
    roomId: number,
    peerConnectionId: number,
    streamId: string) {
    try {
        const roomDivs = document.querySelectorAll<HTMLDivElement>('div.media');
        const roomDiv = [...roomDivs].find(
            (item) => {
                return getComputedStyle(item).getPropertyValue('--vroomid').trim() === `${roomId}`;
            })!;
        const peerMedias = roomDiv.querySelectorAll<HTMLDivElement>('div.peerMedia');
        const peerMedia = [...peerMedias].find(
            (item) => {
                return getComputedStyle(item).getPropertyValue('--vpeerconnectionid').trim() === `${peerConnectionId}` &&
            getComputedStyle(item).getPropertyValue('--vstreamid').trim() === `${streamId}`;
            })!;

        const videoElement = peerMedia.querySelector<HTMLAudioElement>('video')!;

        const unmuteAudioInput = peerMedia.querySelector<HTMLInputElement>('input')!;

        videoElement.muted = !unmuteAudioInput.checked;
    } catch (error) {
        const message = String(error);
        setErrorMessage(roomId, message);
    }
}

export async function mediaPlayVideo(
    roomId: number,
    peerConnectionId: number,
    streamId: string) {
    try {
        const roomDivs = document.querySelectorAll<HTMLDivElement>('div.media');
        const roomDiv = [...roomDivs].find(
            (item) => {
                return getComputedStyle(item).getPropertyValue('--vroomid').trim() === `${roomId}`;
            })!;
        const peerMedias = roomDiv.querySelectorAll<HTMLDivElement>('div.peerMedia');
        const peerMedia = [...peerMedias].find(
            (item) => {
                return getComputedStyle(item).getPropertyValue('--vpeerconnectionid').trim() === `${peerConnectionId}` &&
            getComputedStyle(item).getPropertyValue('--vstreamid').trim() === `${streamId}`;
            })!;

        const videoElement = peerMedia.querySelector<HTMLAudioElement>('video')!;

        const playVideoButton = peerMedia.querySelector<HTMLButtonElement>('button')!;

        await videoElement.play();
        playVideoButton.disabled = true;
    } catch (error) {
        const message = String(error);
        setErrorMessage(roomId, message);
    }
}
