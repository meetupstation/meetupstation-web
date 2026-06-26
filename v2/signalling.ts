import * as webrtcElements from './webrtcElements.js';

export class Host {
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
): Promise<Host> {
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

    return new Host(hostSignalJson.id, hostSignalJson.accessKey);
}
