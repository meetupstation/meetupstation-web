export class Storage {
    rtcConfiguration: RTCConfiguration = {
        iceTransportPolicy: 'all',
        iceServers: [{
            urls: ['stun:u.matrix.am:3478']
        },{
            urls: [
                'turns:u.matrix.am:3478?transport=udp'
            ],
            username: 'dummy',
            credential: 'willnotwork'
        }]
    };
}

const parameterKey: string = 'storage';

export function load(): Storage {
    const storage: Storage = new Storage();
    const queryParams = new URLSearchParams(window.location.search);
    const storageParameter = queryParams.get(parameterKey);

    if (storageParameter) {
        try {
            const decoded = atob(storageParameter);
            const parsed = JSON.parse(decoded);

            if (parsed.rtcConfiguration) {
                storage.rtcConfiguration = {
                    iceServers: []
                };

                switch (parsed.rtcConfiguration.iceTransportPolicy) {
                case 'public':
                    storage.rtcConfiguration.iceTransportPolicy = parsed.rtcConfiguration.iceTransportPolicy;
                    break;
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
                                if (typeof(url) === 'string') {
                                    iceServerNew.urls.push(url);
                                }
                            }
                        }

                        storage.rtcConfiguration.iceServers!.push(iceServerNew);
                    }
                }
            }
        } catch (error) {
            console.error('while parsing storage parameter:', error);
        }
    }

    return storage;
}

export function save(storage: Storage): void {
    const jsonString = JSON.stringify(storage);
    const encoded = btoa(jsonString);

    const queryParams = new URLSearchParams(window.location.search);
    queryParams.set(parameterKey, encoded);

    try {
        const newUrl = `${window.location.pathname}?${queryParams.toString()}${window.location.hash}`;
        window.history.replaceState({}, '', newUrl);
    } catch (error) {
        console.error('while saving storage parameter:', error);
    }
}
