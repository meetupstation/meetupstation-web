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
    hostId: string,
    description: string,
    candidate: string,
    accessKey: string,
    operationInfo: string
): Promise<HostHandle> {
    const hostSignal = await fetch(
        'api/host',
        {
            method: 'POST',
            body: JSON.stringify({
                id: hostId,
                description: description,
                candidate: candidate,
                accessKey: accessKey
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

    return new HostHandle(hostSignalJson.id, hostSignalJson.accessKey);
}

export async function hostGet(
    room: webrtcElements.Room,
    operationInfo: string
): Promise<void> {
    const hostSignal =
        await fetch(
            `api/host?id=${room.signalId}`,
            {
                method: 'GET'
            }
        );
    if (!hostSignal.ok) {
        throw new webrtcElements.ControlledError(`${room.signalId} not set up, while ${operationInfo}`);
    }

    const hostSignalJson = await hostSignal.json();

    room.remoteSessionDescription = hostSignalJson.description;
    room.remoteCandidates = hostSignalJson.description;
}
