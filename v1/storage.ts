export class Storage {
    rooms: string[] = [];
    rtcConfiguration: RTCConfiguration = {
        iceServers: [
        ],
        iceTransportPolicy: 'all'
    };
    signalServer: string = '';
}

const parameterKey: string = 'storage';

export function loadSerialized(serialized: string): Storage {
    const storage: Storage = new Storage();
    const parsed = JSON.parse(serialized);

    if (parsed.rtcConfiguration) {
        storage.rtcConfiguration = {
            iceServers: []
        };

        switch (parsed.rtcConfiguration.iceTransportPolicy) {
        // case 'public': deprecated
        //     storage.rtcConfiguration.iceTransportPolicy = parsed.rtcConfiguration.iceTransportPolicy;
        //     break;
        case 'relay':
            storage.rtcConfiguration.iceTransportPolicy = parsed.rtcConfiguration.iceTransportPolicy;
            break;
        default:
            storage.rtcConfiguration.iceTransportPolicy = 'all';
        }

        if (Array.isArray(parsed.rtcConfiguration.iceServers)) {
            for (const iceServer of parsed.rtcConfiguration.iceServers) {
                const iceServerNew: RTCIceServer = {
                    urls: []
                };

                if (typeof(iceServer.urls) === 'string') {
                    iceServerNew.urls = iceServer.urls;
                } else if (Array.isArray(iceServer.urls)) {
                    iceServerNew.urls = [];
                    for (const url of iceServer.urls) {
                        if (typeof(url) === 'string' && url) {
                            iceServerNew.urls.push(url);
                        }
                    }
                }

                if (typeof(iceServer.username) === 'string') {
                    iceServerNew.username = iceServer.username;
                }

                if (typeof(iceServer.credential) === 'string') {
                    iceServerNew.credential = iceServer.credential;
                }

                if (iceServerNew.urls.length) {
                    storage.rtcConfiguration.iceServers!.push(iceServerNew);
                }
            }
        }
    }

    if (parsed.rooms) {
        if (Array.isArray(parsed.rooms)) {
            for (const room of parsed.rooms) {
                if (typeof(room) === 'string' && room) {
                    storage.rooms.push(room);
                }
            }
        }
    }

    if (parsed.signalServer && typeof(parsed.signalServer) === 'string') {
        storage.signalServer = parsed.signalServer;
    }

    return storage;
}

export function load(): Storage {
    const storage: Storage = new Storage();
    const queryParams = new URLSearchParams(window.location.search);
    const storageParameter = queryParams.get(parameterKey);

    if (storageParameter) {
        try {
            const decoded = new TextDecoder().decode(Uint8Array.fromBase64(storageParameter, { alphabet: 'base64url' }));
            return loadSerialized(decoded);
        } catch (error) {
            console.error('while parsing storage parameter:', error);
            throw error;
        }
    }

    return storage;
}

export function saveSerialize(storage: Storage): string {
    const jsonString = JSON.stringify(storage, null, 2);
    return jsonString;
}

export function save(storage: Storage): void {
    const encoded = new TextEncoder().encode(saveSerialize(storage)).toBase64({ alphabet: 'base64url', omitPadding: true });

    const queryParams = new URLSearchParams(window.location.search);
    queryParams.set(parameterKey, encoded);

    try {
        const newUrl = `${window.location.pathname}?${queryParams.toString()}${window.location.hash}`;
        window.history.replaceState({}, '', newUrl);
    } catch (error) {
        console.error('while saving storage parameter:', error);
        throw error;
    }
}
