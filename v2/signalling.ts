import * as webrtcElements from './webrtcElements.js';

export class HostHandle {
    id: string;
    accessKey: string;

    constructor(id: string, accessKey: string) {
        this.id = id;
        this.accessKey = accessKey;
    }
};

export async function hostPost(
    room: webrtcElements.Room,
    operationInfo: string
): Promise<void> {
    const hostSignal = await fetch(
        'api/host',
        {
            method: 'POST',
            body: JSON.stringify({
                id: room.signalId,
                description: room.localSessionDescription,
                candidates: room.localCandidates,
                accessKey: room.signalAccessKey
            }),
            headers: {
                'Content-type': 'application/json; charset=UTF-8'
            }
        }
    );

    if (!hostSignal.ok) {
        throw new webrtcElements.ControlledError(`while ${operationInfo}`);
    }

    const hostSignalJson = await hostSignal.json();

    room.signalId = hostSignalJson.id;
    room.signalAccessKey = hostSignalJson.accessKey;
}

export async function hostGet(
    room: webrtcElements.Room,
    operationInfo: string
): Promise<void> {
    if (room.remoteSessionDescription || room.remoteCandidates.length) {
        return;
    }

    const hostSignal =
        await fetch(
            `api/host?id=${room.signalId}&accessKey=${room.signalAccessKey}`,
            {
                method: 'GET'
            }
        );
    if (!hostSignal.ok) {
        throw new webrtcElements.ControlledError(`while ${operationInfo}: ${room.signalId} not set up`);
    }

    const hostSignalJson = await hostSignal.json();

    room.remoteSessionDescription = hostSignalJson.description;
    room.remoteCandidates = hostSignalJson.candidates;
    room.signalAccessKey = hostSignalJson.accessKey;
}

export async function guestPost(
    room: webrtcElements.Room,
    operationInfo: string
): Promise<void> {
    const guestSignal = await fetch(
        'api/guest',
        {
            method: 'POST',
            body: JSON.stringify({
                hostId: room.signalId,
                description: room.localSessionDescription,
                candidates: room.localCandidates,
                accessKey: room.signalAccessKey
            }),
            headers: {
                'Content-type': 'application/json; charset=UTF-8'
            }
        }
    );

    if (!guestSignal.ok) {
        throw new webrtcElements.ControlledError(`while ${operationInfo}`);
    }

    //const guestSignalJson =
    await guestSignal.json();
}

export async function guestGet(
    room: webrtcElements.Room,
    operationInfo: string
): Promise<void> {
    if (room.remoteSessionDescription || room.remoteCandidates.length) {
        return;
    }

    const guestSignal =
        await fetch(
            `api/guest?hostId=${room.signalId}&accessKey=${room.signalAccessKey}`,
            {
                method: 'GET'
            }
        );
    if (!guestSignal.ok) {
        throw new webrtcElements.ControlledError(`while ${operationInfo}: ${room.signalId} not set up`);
    }

    const guestSignalJson = await guestSignal.json();

    room.remoteSessionDescription = guestSignalJson.description;
    room.remoteCandidates = guestSignalJson.candidates;
}
