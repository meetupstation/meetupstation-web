export enum MeetingType {
    HOST,
    GUEST
};

export class SignallingScope {
    id: string = '';
    accessKey: string = '';
    server: string;

    complete: boolean = false;
    localSessionDescription: string = '';
    localCandidates: string[] = [];
    remoteSessionDescription: string = '';
    remoteCandidates: string[] = [];

    constructor(id: string, server: string) {
        this.id = id;
        this.accessKey = '';
        this.server = server;
    }

    restart() {
        this.complete = false;
        this.localSessionDescription = '';
        this.localCandidates = [];
        this.remoteSessionDescription = '';
        this.remoteCandidates = [];
    }

    location(suffix: string): string {
        return (this.server ? this.server + '/' : '') + suffix;
    }

    async hostPost(): Promise<void> {

        const body = {
            id: this.id,
            description: this.localSessionDescription,
            candidates: this.localCandidates,
            accessKey: this.accessKey
        };
        this.localSessionDescription = '';
        this.localCandidates = [];

        try {
            const hostSignal = await fetch(
                this.location('api/host'),
                {
                    method: 'POST',
                    body: JSON.stringify(body),
                    headers: {
                        'Content-type': 'application/json; charset=UTF-8'
                    }
                }
            );

            if (!hostSignal.ok) {
                throw new Error('posting host signal: room is already being negotiated at the moment');
            }

            const hostSignalJson = await hostSignal.json();

            this.id = hostSignalJson.id;
            this.accessKey = hostSignalJson.accessKey;
        } catch (error) {
            this.localSessionDescription = body.description || this.localSessionDescription;
            const candidates = this.localCandidates;
            this.localCandidates = body.candidates;
            for (const candidate of candidates) {
                this.localCandidates.push(candidate);
            }
            throw error;
        }
    }

    async hostGet(): Promise<void> {
        if (this.remoteSessionDescription || this.remoteCandidates.length) {
            return;
        }

        const q = new URLSearchParams({ id: this.id, accessKey: this.accessKey });
        const hostSignal =
            await fetch(this.location(`api/host?${q}`),{method: 'GET'});
        if (!hostSignal.ok) {
            this.complete = true;
            throw new Error('getting host signal: room is not found or already being negotiated at the moment');
        }

        const hostSignalJson = await hostSignal.json();

        this.remoteSessionDescription = hostSignalJson.description;
        this.remoteCandidates = hostSignalJson.candidates;
        this.accessKey = hostSignalJson.accessKey;
    }

    async guestPost(): Promise<void> {

        const body = {
            id: this.id,
            description: this.localSessionDescription,
            candidates: this.localCandidates,
            accessKey: this.accessKey
        };
        this.localSessionDescription = '';
        this.localCandidates = [];

        try {
            const guestSignal = await fetch(
                this.location('api/guest'),
                {
                    method: 'POST',
                    body: JSON.stringify(body),
                    headers: {
                        'Content-type': 'application/json; charset=UTF-8'
                    }
                }
            );

            if (!guestSignal.ok) {
                this.complete = true;
                throw new Error('posting guest signal: room is not found or already being negotiated at the moment');
            }

            //const guestSignalJson =
            await guestSignal.json();
        } catch (error) {
            this.localSessionDescription = body.description || this.localSessionDescription;
            const candidates = this.localCandidates;
            this.localCandidates = body.candidates;
            for (const candidate of candidates) {
                this.localCandidates.push(candidate);
            }
            throw error;
        }
    }

    async guestGet(): Promise<void> {
        if (this.remoteSessionDescription || this.remoteCandidates.length) {
            return;
        }

        const q = new URLSearchParams({ id: this.id, accessKey: this.accessKey });
        const guestSignal =
            await fetch(this.location(`api/guest?${q}`),{method: 'GET'});
        if (!guestSignal.ok) {
            throw new Error('getting guest signal: room is not found or already being negotiated at the moment');
        }

        const guestSignalJson = await guestSignal.json();

        this.remoteSessionDescription = guestSignalJson.description;
        this.remoteCandidates = guestSignalJson.candidates;
    }

    async polling(peerConnection: RTCPeerConnection,
        meetingType: MeetingType) {

        if (this.complete) {
            return;
        }

        if (meetingType === MeetingType.HOST) {
            return await this.hostPolling(peerConnection);
        } else {
            return await this.guestPolling(peerConnection);
        }
    }

    async guestPolling(peerConnection: RTCPeerConnection): Promise<void> {
        if (this.complete) {
            return;
        }

        try {
            await this.hostGet();
        } catch (error) {
            if (this.complete) {
                if (!this.accessKey) {
                    this.complete = false;
                }
                return;
            } else {
                throw error;
            }
        }

        if (this.remoteSessionDescription) {
            // prepareDataChannel(room, peerConnection);

            const remoteSessionDescription = this.remoteSessionDescription;
            this.remoteSessionDescription = '';

            if (!peerConnection.remoteDescription) {
                await peerConnection.setRemoteDescription(
                    JSON.parse(atob(remoteSessionDescription))
                );

                const localStream = new MediaStream();
                for (const transceiver of peerConnection.getTransceivers()) {
                    transceiver.direction = 'sendrecv';
                    transceiver.sender.setStreams(localStream);
                }

                const answerDescription = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answerDescription);

                this.localSessionDescription = btoa(JSON.stringify(peerConnection.localDescription));
            }
        }

        if (this.remoteCandidates.length) {
            const remoteCandidates = this.remoteCandidates;
            this.remoteCandidates = [];

            if (peerConnection.remoteDescription) {
                for (const candidate of remoteCandidates) {
                    await peerConnection.addIceCandidate(JSON.parse(atob(candidate)));
                }
            }
        }

        if (this.localSessionDescription || this.localCandidates.length) {
            await this.guestPost();
        }
    }

    async hostPolling(peerConnection: RTCPeerConnection): Promise<void> {
        if (this.complete) {
            // does not seem to happen
            // just does not poll after connected
            return;
        }

        if (this.localSessionDescription || this.localCandidates.length) {
            await this.hostPost();
        }

        await this.guestGet();

        if (this.remoteSessionDescription) {
            const remoteSessionDescription = this.remoteSessionDescription;
            this.remoteSessionDescription = '';

            if (!peerConnection.remoteDescription) {
                await peerConnection.setRemoteDescription(
                    JSON.parse(atob(remoteSessionDescription))
                );
            }
        }

        if (this.remoteCandidates.length) {
            const remoteCandidates = this.remoteCandidates;
            this.remoteCandidates = [];

            if (peerConnection.remoteDescription) {
                for (const candidate of remoteCandidates) {
                    await peerConnection.addIceCandidate(JSON.parse(atob(candidate)));
                }
            }
        }
    }
}
