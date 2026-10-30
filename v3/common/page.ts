export function newRoom(roomId: number): void {
    const template = document.getElementById('room-template') as HTMLTemplateElement;

    const html = template!.innerHTML
        .replaceAll('roomId__', `roomId${roomId}`)
        .replaceAll('value="__"', `value="${roomId}"`)
        .replaceAll('--vroomid: __', `--vroomid: ${roomId}`)
        .replaceAll('closeRoomButton__', `closeRoomButton${roomId}`)
        .replaceAll('playpauseToggle__', `playpauseToggle${roomId}`)
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

export function setErrorMessage(roomId: number, error: string) {
    const roomDivs = document.querySelectorAll<HTMLDivElement>('div.errorMessage');
    const roomDiv = [...roomDivs].find((item) => {
        return getComputedStyle(item).getPropertyValue('--vroomid').trim() === `${roomId}`;
    });
    if (roomDiv) {
        roomDiv.textContent = error;
    }
}

export function clearErrorMessage(roomId: number) {
    const roomDivs = document.querySelectorAll<HTMLDivElement>('div.errorMessage');
    const roomDiv = [...roomDivs].find((item) => {
        return getComputedStyle(item).getPropertyValue('--vroomid').trim() === `${roomId}`;
    });
    if (roomDiv) {
        roomDiv.innerHTML = '';
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

export function closePeer(roomId: number, peerConnectionId: number) {
    const peerDivs = document.querySelectorAll<HTMLDivElement>('div.statusWheel');
    const peerDiv = [...peerDivs].find((item) => {
        return getComputedStyle(item).getPropertyValue('--vroomid').trim() === `${roomId}` &&
        getComputedStyle(item).getPropertyValue('--vpeerconnectionid').trim() === `${peerConnectionId}`;
    })!;
    peerDiv.remove();
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

export function setCloseEnabled(roomId: number, enabled: boolean) {
    const closeButtons = document.querySelectorAll<HTMLButtonElement>('button.closeRoomButton');
    const closeButton = [...closeButtons].find(
        (item) => {
            return getComputedStyle(item).getPropertyValue('--vroomid').trim() === `${roomId}`;
        })!;
    closeButton.disabled = !enabled;
}
